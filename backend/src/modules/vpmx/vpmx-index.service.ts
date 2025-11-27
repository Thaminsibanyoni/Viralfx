import { Injectable, Logger } from '@nestjs/common';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { VPMXResult, RegionalVPMXData } from './interfaces/vpmx.interface';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class VPMXIndexService {
  private readonly logger = new Logger(VPMXIndexService.name);
  private readonly WEBSOCKET_TOPIC = 'vpmx:update';
  private readonly GLOBAL_INDEX_KEY = 'vpmx:global:index';
  private readonly REGIONAL_INDEXES_KEY = 'vpmx:regional:indexes';

  constructor(
    private readonly wsGateway: WebSocketGateway,
    private readonly redis: RedisService,
  ) {}

  /**
   * Update real-time index with new VPMX result
   */
  async updateRealtimeIndex(result: VPMXResult): Promise<void> {
    try {
      // Update global index cache
      await this.updateGlobalIndex(result);

      // Update regional data if applicable
      await this.updateRegionalIndexes(result);

      // Broadcast to WebSocket clients
      await this.broadcastUpdate(result);

      // Update real-time aggregates
      await this.updateRealtimeAggregates(result);

      this.logger.debug(`Real-time VPMX updated for ${result.vtsSymbol}: ${result.value}`);
    } catch (error) {
      this.logger.error(`Failed to update real-time index for ${result.vtsSymbol}`, error);
    }
  }

  /**
   * Update global VPMX index
   */
  private async updateGlobalIndex(result: VPMXResult): Promise<void> {
    const globalIndex = await this.getGlobalIndexData();

    // Add new result to global index
    globalIndex.entries.push({
      symbol: result.vtsSymbol,
      value: result.value,
      timestamp: result.timestamp,
      metadata: result.metadata,
    });

    // Keep only top 100 entries by value
    globalIndex.entries.sort((a, b) => b.value - a.value);
    globalIndex.entries = globalIndex.entries.slice(0, 100);

    // Calculate global index metrics
    globalIndex.totalValue = globalIndex.entries.reduce((sum, entry) => sum + entry.value, 0);
    globalIndex.averageValue = globalIndex.totalValue / globalIndex.entries.length;
    globalIndex.lastUpdated = new Date();

    // Cache global index
    await this.redis.setex(
      this.GLOBAL_INDEX_KEY,
      300, // 5 minutes cache
      JSON.stringify(globalIndex)
    );
  }

  /**
   * Update regional VPMX indexes
   */
  private async updateRegionalIndexes(result: VPMXResult): Promise<void> {
    const regionalIndexes = await this.getRegionalIndexData();

    // For now, we'll update a generic "global" region
    // In a full implementation, you'd determine regions from the VTS symbol
    const region = this.extractRegionFromSymbol(result.vtsSymbol);

    if (!regionalIndexes[region]) {
      regionalIndexes[region] = {
        region,
        entries: [],
        totalValue: 0,
        averageValue: 0,
        lastUpdated: new Date(),
      };
    }

    // Add result to regional index
    regionalIndexes[region].entries.push({
      symbol: result.vtsSymbol,
      value: result.value,
      timestamp: result.timestamp,
      metadata: result.metadata,
    });

    // Update regional metrics
    regionalIndexes[region].entries.sort((a, b) => b.value - a.value);
    regionalIndexes[region].entries = regionalIndexes[region].entries.slice(0, 50);
    regionalIndexes[region].totalValue = regionalIndexes[region].entries.reduce(
      (sum, entry) => sum + entry.value,
      0
    );
    regionalIndexes[region].averageValue = regionalIndexes[region].totalValue / regionalIndexes[region].entries.length;
    regionalIndexes[region].lastUpdated = new Date();

    // Cache regional indexes
    await this.redis.setex(
      this.REGIONAL_INDEXES_KEY,
      300, // 5 minutes cache
      JSON.stringify(regionalIndexes)
    );
  }

  /**
   * Broadcast VPMX update to WebSocket clients
   */
  private async broadcastUpdate(result: VPMXResult): Promise<void> {
    const payload = {
      type: 'VPMX_UPDATE',
      data: {
        vtsSymbol: result.vtsSymbol,
        value: result.value,
        timestamp: result.timestamp,
        components: result.components,
        metadata: result.metadata,
      },
    };

    // Broadcast to general VPMX topic
    await this.wsGateway.broadcast(this.WEBSOCKET_TOPIC, payload);

    // Also broadcast to symbol-specific topic
    const symbolTopic = `vpmx:${result.vtsSymbol}`;
    await this.wsGateway.broadcast(symbolTopic, {
      type: 'SYMBOL_UPDATE',
      ...payload.data,
    });
  }

  /**
   * Update real-time aggregates
   */
  private async updateRealtimeAggregates(result: VPMXResult): Promise<void> {
    const aggregateKey = `vpmx:aggregate:realtime:${result.vtsSymbol}`;
    const timestamp = Date.now();

    // Get existing aggregate data
    const existing = await this.redis.get(aggregateKey);
    let aggregate = existing ? JSON.parse(existing) : {
      symbol: result.vtsSymbol,
      open: result.value,
      high: result.value,
      low: result.value,
      close: result.value,
      volume: 0,
      count: 0,
      startTime: timestamp,
      lastUpdate: timestamp,
    };

    // Update aggregate values
    aggregate.high = Math.max(aggregate.high, result.value);
    aggregate.low = Math.min(aggregate.low, result.value);
    aggregate.close = result.value;
    aggregate.count += 1;
    aggregate.lastUpdate = timestamp;

    // Cache for 5 minutes
    await this.redis.setex(aggregateKey, 300, JSON.stringify(aggregate));
  }

  /**
   * Get current global VPMX index
   */
  async getGlobalIndexData(): Promise<any> {
    const cached = await this.redis.get(this.GLOBAL_INDEX_KEY);

    if (cached) {
      return JSON.parse(cached);
    }

    return {
      entries: [],
      totalValue: 0,
      averageValue: 0,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get regional VPMX index data
   */
  async getRegionalIndexData(): Promise<Record<string, any>> {
    const cached = await this.redis.get(this.REGIONAL_INDEXES_KEY);

    if (cached) {
      return JSON.parse(cached);
    }

    return {};
  }

  /**
   * Get real-time VPMX ticker data
   */
  async getTickerData(vtsSymbol: string): Promise<any> {
    const aggregateKey = `vpmx:aggregate:realtime:${vtsSymbol}`;
    const cached = await this.redis.get(aggregateKey);

    if (!cached) {
      return null;
    }

    const aggregate = JSON.parse(cached);

    // Calculate percentage changes
    const changes = await this.calculatePercentageChanges(vtsSymbol, aggregate.close);

    return {
      symbol: vtsSymbol,
      price: aggregate.close,
      change: changes.current,
      changePercent: changes.currentPercent,
      high: aggregate.high,
      low: aggregate.low,
      open: aggregate.open,
      volume: aggregate.volume,
      count: aggregate.count,
      lastUpdate: aggregate.lastUpdate,
      // Additional change periods
      oneHourChange: changes.oneHour,
      oneHourChangePercent: changes.oneHourPercent,
      twentyFourHourChange: changes.twentyFourHour,
      twentyFourHourChangePercent: changes.twentyFourHourPercent,
    };
  }

  /**
   * Get top trending symbols
   */
  async getTopTrending(limit = 10): Promise<any[]> {
    const globalIndex = await this.getGlobalIndexData();

    return globalIndex.entries
      .slice(0, limit)
      .map(entry => ({
        symbol: entry.symbol,
        value: entry.value,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      }));
  }

  /**
   * Get regional leaders
   */
  async getRegionalLeaders(region: string, limit = 10): Promise<any[]> {
    const regionalIndexes = await this.getRegionalIndexData();

    if (!regionalIndexes[region]) {
      return [];
    }

    return regionalIndexes[region].entries
      .slice(0, limit)
      .map(entry => ({
        symbol: entry.symbol,
        value: entry.value,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      }));
  }

  /**
   * Broadcast market update
   */
  async broadcastMarketUpdate(marketData: any): Promise<void> {
    const payload = {
      type: 'MARKET_UPDATE',
      data: marketData,
    };

    await this.wsGateway.broadcast('vpmx:markets', payload);
  }

  /**
   * Subscribe to VPMX updates for specific symbols
   */
  async subscribeToSymbols(symbols: string[], clientId: string): Promise<void> {
    for (const symbol of symbols) {
      const topic = `vpmx:${symbol}`;
      await this.wsGateway.subscribe(clientId, topic);
    }

    // Also subscribe to general updates
    await this.wsGateway.subscribe(clientId, this.WEBSOCKET_TOPIC);
  }

  /**
   * Unsubscribe from VPMX updates
   */
  async unsubscribeFromSymbols(symbols: string[], clientId: string): Promise<void> {
    for (const symbol of symbols) {
      const topic = `vpmx:${symbol}`;
      await this.wsGateway.unsubscribe(clientId, topic);
    }
  }

  /**
   * Get historical price data for charting
   */
  async getHistoricalChartData(
    vtsSymbol: string,
    interval: string,
    limit: number,
  ): Promise<any[]> {
    const chartKey = `vpmx:chart:${vtsSymbol}:${interval}`;

    // Try to get cached chart data
    const cached = await this.redis.lrange(chartKey, 0, -1);

    if (cached.length > 0) {
      return cached.map(entry => JSON.parse(entry));
    }

    // Return empty array if no cached data
    // In a real implementation, you'd query the database
    return [];
  }

  /**
   * Cache chart data point
   */
  async cacheChartDataPoint(
    vtsSymbol: string,
    interval: string,
    dataPoint: any,
  ): Promise<void> {
    const chartKey = `vpmx:chart:${vtsSymbol}:${interval}`;

    // Add new data point
    await this.redis.lpush(chartKey, JSON.stringify(dataPoint));

    // Keep only last 1000 points
    await this.redis.ltrim(chartKey, 0, 999);

    // Set expiry (24 hours for most intervals, longer for daily/weekly)
    const ttl = interval.includes('d') || interval.includes('w') ? 86400 * 7 : 86400;
    await this.redis.expire(chartKey, ttl);
  }

  /**
   * Extract region from VTS symbol
   */
  private extractRegionFromSymbol(vtsSymbol: string): string {
    const parts = vtsSymbol.split(':');
    return parts.length > 1 ? parts[1] : 'GLOBAL';
  }

  /**
   * Calculate percentage changes for different time periods
   */
  private async calculatePercentageChanges(
    vtsSymbol: string,
    currentValue: number,
  ): Promise<any> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);

    // Get historical values
    const [oneHourValue, twentyFourHourValue] = await Promise.all([
      this.getValueAtTime(vtsSymbol, oneHourAgo),
      this.getValueAtTime(vtsSymbol, twentyFourHoursAgo),
    ]);

    const changes = {
      current: 0,
      currentPercent: 0,
      oneHour: 0,
      oneHourPercent: 0,
      twentyFourHour: 0,
      twentyFourHourPercent: 0,
    };

    if (oneHourValue) {
      changes.oneHour = currentValue - oneHourValue;
      changes.oneHourPercent = ((currentValue - oneHourValue) / oneHourValue) * 100;
    }

    if (twentyFourHourValue) {
      changes.twentyFourHour = currentValue - twentyFourHourValue;
      changes.twentyFourHourPercent = ((currentValue - twentyFourHourValue) / twentyFourHourValue) * 100;
    }

    // Current change uses the most recent historical value available
    const referenceValue = oneHourValue || twentyFourHourValue;
    if (referenceValue) {
      changes.current = currentValue - referenceValue;
      changes.currentPercent = ((currentValue - referenceValue) / referenceValue) * 100;
    }

    return changes;
  }

  /**
   * Get VPMX value at specific timestamp
   */
  private async getValueAtTime(vtsSymbol: string, timestamp: number): Promise<number | null> {
    const historyKey = `vpmx:history:${vtsSymbol}`;

    // Get cached historical data
    const cached = await this.redis.lrange(historyKey, 0, -1);

    if (cached.length === 0) {
      return null;
    }

    // Find the value closest to the requested timestamp
    let closestValue: number | null = null;
    let minDiff = Infinity;

    for (const entry of cached) {
      const data = JSON.parse(entry);
      const diff = Math.abs(Date.parse(data.timestamp) - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closestValue = data.value;
      }
    }

    return closestValue;
  }

  /**
   * Initialize index service with default data
   */
  async initializeIndex(): Promise<void> {
    this.logger.log('Initializing VPMX Index Service');

    try {
      // Initialize global index
      const globalIndex = await this.getGlobalIndexData();
      await this.redis.setex(
        this.GLOBAL_INDEX_KEY,
        300,
        JSON.stringify(globalIndex)
      );

      // Initialize regional indexes
      const regionalIndexes = await this.getRegionalIndexData();
      await this.redis.setex(
        this.REGIONAL_INDEXES_KEY,
        300,
        JSON.stringify(regionalIndexes)
      );

      this.logger.log('VPMX Index Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize VPMX Index Service', error);
    }
  }
}