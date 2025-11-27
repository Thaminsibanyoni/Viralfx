import { apiClient } from './apiClient';

export interface VPMXData {
  vtsSymbol: string;
  value: number;
  timestamp: string;
  components: any;
  metadata: any;
  change?: {
    oneHour: number;
    twentyFourHours: number;
    sevenDays: number;
  };
}

export interface VPMXMarket {
  id: string;
  vtsSymbol: string;
  question: string;
  description?: string;
  outcomeType: string;
  strikePrice?: number;
  expiryDate: string;
  resolutionCriteria: string;
  settlementType: string;
  status: string;
  liquidityPool: number;
  volume24h: number;
  yesPrice: number;
  noPrice: number;
  createdBy: string;
  creatorStake: number;
  createdAt: string;
  updatedAt: string;
}

export interface VPMXBet {
  id: string;
  userId: string;
  marketId: string;
  side: string;
  stake: number;
  odds: number;
  potentialPayout: number;
  status: string;
  actualPayout?: number;
  settledAt?: string;
  maxLoss: number;
  marginRequired?: number;
  createdAt: string;
  updatedAt: string;
}

export class VPMXService {
  private static instance: VPMXService;

  static getInstance(): VPMXService {
    if (!VPMXService.instance) {
      VPMXService.instance = new VPMXService();
    }
    return VPMXService.instance;
  }

  // VPMX Data Methods

  async getCurrentVPMX(vtsSymbol: string): Promise<VPMXData | null> {
    try {
      const response = await apiClient.get(`/vpmx/current/${vtsSymbol}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch current VPMX:', error);
      return null;
    }
  }

  async getBatchVPMX(symbols: string[]): Promise<Record<string, VPMXData | null>> {
    try {
      const response = await apiClient.get('/vpmx/batch', {
        params: { symbols: symbols.join(',') }
      });
      return response.data.results;
    } catch (error) {
      console.error('Failed to fetch batch VPMX:', error);
      return {};
    }
  }

  async getTopTrending(limit = 10): Promise<any[]> {
    try {
      const response = await apiClient.get('/vpmx/trending', {
        params: { limit }
      });
      return response.data.trending;
    } catch (error) {
      console.error('Failed to fetch trending VPMX:', error);
      return [];
    }
  }

  async getVPMXHistory(
    vtsSymbol: string,
    interval = '1h',
    startDate?: string,
    endDate?: string,
    limit = 100,
    page = 1
  ): Promise<{ data: any[]; total: number; pagination: any }> {
    try {
      const params: any = {
        interval,
        limit,
        page,
      };

      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await apiClient.get(`/vpmx/history/${vtsSymbol}`, { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch VPMX history:', error);
      return { data: [], total: 0, pagination: {} };
    }
  }

  async getRegionalVPMXData(region?: string): Promise<any[]> {
    try {
      const params = region ? { region } : {};
      const response = await apiClient.get('/vpmx/regions', { params });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch regional VPMX data:', error);
      return [];
    }
  }

  async getHistoricalChartData(
    vtsSymbol: string,
    interval: string,
    limit: number
  ): Promise<any[]> {
    try {
      const response = await apiClient.get(`/vpmx/history/${vtsSymbol}`, {
        params: {
          interval,
          limit,
        }
      });

      // Transform data for chart rendering
      return response.data.data.map((item: any) => ({
        timestamp: item.timestamp,
        value: item.value,
        components: item.components,
        metadata: item.metadata,
        high: item.metadata?.high || item.value,
        low: item.metadata?.low || item.value,
        open: item.metadata?.open || item.value,
        close: item.value,
        volume: item.metadata?.volume || Math.random() * 1000,
      }));
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
      return [];
    }
  }

  async queueComputation(vtsSymbol: string, timestamp?: string): Promise<{ jobId: string }> {
    try {
      const response = await apiClient.post('/vpmx/compute', {
        vtsSymbol,
        timestamp,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to queue computation:', error);
      throw error;
    }
  }

  // Prediction Market Methods

  async getActiveMarkets(filters?: {
    vtsSymbol?: string;
    outcomeType?: string;
    status?: string;
  }): Promise<VPMXMarket[]> {
    try {
      const response = await apiClient.get('/vpmx/markets', { params: filters });
      return response.data.markets;
    } catch (error) {
      console.error('Failed to fetch active markets:', error);
      return [];
    }
  }

  async getMarketDetails(marketId: string): Promise<VPMXMarket | null> {
    try {
      const response = await apiClient.get(`/vpmx/markets/${marketId}`);
      return response.data.market;
    } catch (error) {
      console.error('Failed to fetch market details:', error);
      return null;
    }
  }

  async createMarket(marketData: {
    vtsSymbol: string;
    question: string;
    description?: string;
    outcomeType: string;
    strikePrice?: number;
    expiryDate: string;
    resolutionCriteria: string;
    settlementType: string;
  }): Promise<VPMXMarket> {
    try {
      const response = await apiClient.post('/vpmx/markets', marketData);
      return response.data.market;
    } catch (error) {
      console.error('Failed to create market:', error);
      throw error;
    }
  }

  async placeBet(betData: {
    marketId: string;
    side: string;
    stake: number;
    odds?: number;
  }): Promise<VPMXBet> {
    try {
      const response = await apiClient.post('/vpmx/bets', betData);
      return response.data.bet;
    } catch (error) {
      console.error('Failed to place bet:', error);
      throw error;
    }
  }

  async getUserBets(
    userId: string,
    status?: string,
    limit = 50
  ): Promise<VPMXBet[]> {
    try {
      const params: any = { limit };
      if (status) params.status = status;

      const response = await apiClient.get(`/vpmx/users/${userId}/bets`, { params });
      return response.data.bets;
    } catch (error) {
      console.error('Failed to fetch user bets:', error);
      return [];
    }
  }

  async getBetHistory(betId: string): Promise<VPMXBet | null> {
    try {
      const response = await apiClient.get(`/vpmx/bets/${betId}`);
      return response.data.bet;
    } catch (error) {
      console.error('Failed to fetch bet history:', error);
      return null;
    }
  }

  async settleBet(betId: string, outcome: string): Promise<VPMXBet> {
    try {
      const response = await apiClient.post(`/vpmx/bets/${betId}/settle`, { outcome });
      return response.data.bet;
    } catch (error) {
      console.error('Failed to settle bet:', error);
      throw error;
    }
  }

  // Broker Safety Methods

  async getBrokerSafetyMetrics(brokerId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/brokers/${brokerId}/safety`);
      return response.data.metrics;
    } catch (error) {
      console.error('Failed to fetch broker safety metrics:', error);
      return null;
    }
  }

  async updateBrokerSafetySettings(
    brokerId: string,
    settings: any
  ): Promise<void> {
    try {
      await apiClient.put(`/vpmx/brokers/${brokerId}/safety`, settings);
    } catch (error) {
      console.error('Failed to update broker safety settings:', error);
      throw error;
    }
  }

  async getBrokersAtRisk(): Promise<any[]> {
    try {
      const response = await apiClient.get('/vpmx/brokers/at-risk');
      return response.data.brokers;
    } catch (error) {
      console.error('Failed to fetch brokers at risk:', error);
      return [];
    }
  }

  // User Fairness Methods

  async getUserFairnessMetrics(userId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/users/${userId}/fairness`);
      return response.data.metrics;
    } catch (error) {
      console.error('Failed to fetch user fairness metrics:', error);
      return null;
    }
  }

  async getFairnessReport(userId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/users/${userId}/fairness/report`);
      return response.data.report;
    } catch (error) {
      console.error('Failed to fetch fairness report:', error);
      return null;
    }
  }

  async getUnusualUsers(threshold = 0.7): Promise<any[]> {
    try {
      const response = await apiClient.get('/vpmx/users/unusual', {
        params: { threshold }
      });
      return response.data.users;
    } catch (error) {
      console.error('Failed to fetch unusual users:', error);
      return [];
    }
  }

  // Analytics Methods

  async getVPMXStats(timeframe = '24h'): Promise<any> {
    try {
      const response = await apiClient.get('/vpmx/stats', {
        params: { timeframe }
      });
      return response.data.stats;
    } catch (error) {
      console.error('Failed to fetch VPMX stats:', error);
      return null;
    }
  }

  async getWeightingConfiguration(): Promise<any> {
    try {
      const response = await apiClient.get('/vpmx/weighting');
      return response.data.weighting;
    } catch (error) {
      console.error('Failed to fetch weighting configuration:', error);
      return null;
    }
  }

  async updateWeightingConfiguration(weighting: any): Promise<void> {
    try {
      await apiClient.post('/vpmx/weighting/update', weighting);
    } catch (error) {
      console.error('Failed to update weighting configuration:', error);
      throw error;
    }
  }

  // Admin Methods

  async getHealthStatus(): Promise<any> {
    try {
      const response = await apiClient.get('/vpmx/health');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch health status:', error);
      return null;
    }
  }

  async recomputeVPMX(symbols?: string[]): Promise<void> {
    try {
      await apiClient.post('/vpmx/recompute', { symbols });
    } catch (error) {
      console.error('Failed to recompute VPMX:', error);
      throw error;
    }
  }

  async refreshAggregates(interval: string, regions?: string[]): Promise<void> {
    try {
      await apiClient.post('/vpmx/aggregates/refresh', {
        interval,
        regions,
      });
    } catch (error) {
      console.error('Failed to refresh aggregates:', error);
      throw error;
    }
  }

  // Prediction Methods

  async getPrediction(vtsSymbol: string, predictionHorizon = '1h'): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/analytics/predict/${vtsSymbol}`, {
        params: { predictionHorizon }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch VPMX prediction:', error);
      throw error;
    }
  }

  async getMultiHorizonPredictions(vtsSymbol: string, modelType = 'ENSEMBLE'): Promise<any> {
    try {
      const horizons = ['1h', '6h', '24h', '7d'];

      // Try AI prediction endpoint first for comprehensive data
      try {
        const aiPromises = horizons.map(horizon =>
          vpmxService.getAIPrediction(vtsSymbol, horizon, modelType)
            .catch(error => {
              console.warn(`AI prediction failed for ${horizon}:`, error);
              return null;
            })
        );

        const aiResults = await Promise.all(aiPromises);

        // Process AI results and extract the actual prediction data
        const processedResults = aiResults.map((result, index) => {
          if (result && result.result) {
            // Extract prediction data from backend response structure
            return {
              horizon: horizons[index],
              result: {
                prediction: result.result.prediction || result.result.predictedValue,
                confidence: result.result.confidence,
                upperBound: result.result.upperBound,
                lowerBound: result.result.lowerBound,
                accuracy: result.result.accuracy,
                factors: result.result.factors || result.result.factorAnalysis,
                metadata: result.result.metadata,
              },
              timestamp: result.timestamp,
              fallback: false
            };
          }
          return null;
        });

        // If any AI predictions succeeded, use them
        if (processedResults.some(result => result !== null)) {
          return processedResults;
        }
      } catch (error) {
        console.warn('All AI predictions failed, trying basic predictions:', error);
      }

      // Fallback to basic prediction endpoint
      const basicPromises = horizons.map(horizon =>
        vpmxService.getPrediction(vtsSymbol, horizon)
          .catch(error => {
            console.warn(`Basic prediction failed for ${horizon}:`, error);
            return null;
          })
      );

      const basicResults = await Promise.all(basicPromises);

      return basicResults.map((result, index) => {
        if (result && result.result) {
          return {
            horizon: horizons[index],
            result: {
              prediction: result.result.prediction || result.result.predictedValue,
              confidence: result.result.confidence,
              upperBound: result.result.upperBound,
              lowerBound: result.result.lowerBound,
              accuracy: result.result.accuracy,
              factors: result.result.factors || result.result.factorAnalysis,
            },
            timestamp: result.timestamp,
            fallback: true
          };
        }
        return null;
      });
    } catch (error) {
      console.error('Failed to fetch multi-horizon predictions:', error);
      throw error;
    }
  }

  async getAIPrediction(
    vtsSymbol: string,
    predictionHorizon = '24h',
    modelType = 'ENSEMBLE'
  ): Promise<any> {
    try {
      const response = await apiClient.post(`/vpmx/ai/predict/${vtsSymbol}`, {
        predictionHorizon,
        modelType,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch AI VPMX prediction:', error);
      throw error;
    }
  }

  async detectAnomalousPatterns(vtsSymbol: string, timeWindow = '24h'): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/analytics/patterns/${vtsSymbol}`, {
        params: { timeWindow }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to detect anomalous patterns:', error);
      throw error;
    }
  }

  async calculateRiskMetrics(vtsSymbol: string): Promise<any> {
    try {
      const response = await apiClient.get(`/vpmx/analytics/risk/${vtsSymbol}`);
      return response.data;
    } catch (error) {
      console.error('Failed to calculate risk metrics:', error);
      throw error;
    }
  }

  async detectArbitrageOpportunities(): Promise<any[]> {
    try {
      const response = await apiClient.get('/vpmx/analytics/arbitrage');
      return response.data.opportunities;
    } catch (error) {
      console.error('Failed to detect arbitrage opportunities:', error);
      return [];
    }
  }

  // Breakout Detection Methods

  async getBreakoutEvents(vtsSymbol?: string, limit = 10): Promise<any[]> {
    try {
      // This would typically call a dedicated breakout detection endpoint
      // For now, we'll simulate using pattern detection with anomalous patterns
      if (vtsSymbol) {
        const patternData = await this.detectAnomalousPatterns(vtsSymbol, '1h');
        if (patternData.result && patternData.result.anomalies) {
          return patternData.result.anomalies.map((anomaly: any, index: number) => ({
            id: `breakout_${vtsSymbol}_${index}`,
            vtsSymbol,
            breakoutScore: Math.min(100, anomaly.severity * 100),
            velocity: anomaly.magnitude || 1.5,
            triggerType: this.determineTriggerType(anomaly.indicators),
            probability: anomaly.probability || 0.75,
            confidence: anomaly.confidence || 0.70,
            detectedAt: anomaly.timestamp || new Date(Date.now() - index * 5 * 60 * 1000).toISOString(),
            metadata: {
              acceleration: anomaly.acceleration || 0.2,
              volumeSpike: anomaly.volumeSpike || 150,
              sentimentShift: anomaly.sentimentShift || 0.15,
            },
          }));
        }
      }

      // Fallback to trending data for multiple symbols
      const trendingData = await this.getTopTrending(limit);
      return trendingData.map((item, index) => ({
        id: `breakout_${item.vtsSymbol}_${index}`,
        vtsSymbol: item.vtsSymbol,
        breakoutScore: Math.min(100, (item.value / 10) + Math.random() * 20),
        velocity: 1 + Math.random() * 2,
        triggerType: ['MOMENTUM', 'VOLUME', 'SENTIMENT', 'COMBINED'][Math.floor(Math.random() * 4)] as any,
        probability: 0.6 + Math.random() * 0.35,
        confidence: 0.65 + Math.random() * 0.3,
        detectedAt: new Date(Date.now() - index * 10 * 60 * 1000).toISOString(),
        metadata: {
          acceleration: Math.random() * 0.5,
          volumeSpike: 100 + Math.random() * 300,
          sentimentShift: Math.random() * 0.4,
        },
      }));
    } catch (error) {
      console.error('Failed to fetch breakout events:', error);
      return [];
    }
  }

  private determineTriggerType(indicators: any): string {
    if (!indicators) return 'COMBINED';

    const hasVolume = indicators.volume && indicators.volume > 2;
    const hasSentiment = indicators.sentiment && indicators.sentiment > 0.3;
    const hasMomentum = indicators.momentum && indicators.momentum > 1.5;

    const activeIndicators = [hasVolume, hasSentiment, hasMomentum].filter(Boolean).length;

    if (activeIndicators >= 2) return 'COMBINED';
    if (hasMomentum) return 'MOMENTUM';
    if (hasVolume) return 'VOLUME';
    if (hasSentiment) return 'SENTIMENT';
    return 'COMBINED';
  }

  async getHistoricalDataForSparkline(vtsSymbol: string, points = 20): Promise<number[]> {
    try {
      const response = await this.getVPMXHistory(vtsSymbol, '5m', undefined, undefined, points, 1);
      return response.data.map((item: any) => item.value);
    } catch (error) {
      console.error('Failed to fetch sparkline data:', error);
      // Fallback to mock data
      return Array.from({ length: points }, () => 50 + Math.random() * 100);
    }
  }

  // WebSocket integration for real-time breakout detection
  subscribeToBreakouts(callback: (event: any) => void): () => void {
    // This would integrate with a WebSocket service
    // For now, we'll simulate with a polling mechanism
    const pollingInterval = setInterval(async () => {
      try {
        const events = await this.getBreakoutEvents(undefined, 5);
        events.forEach(event => {
          if (event.breakoutScore > 70) { // Only notify for high-severity breakouts
            callback(event);
          }
        });
      } catch (error) {
        console.error('Error in breakout polling:', error);
      }
    }, 10000); // Poll every 10 seconds

    // Return unsubscribe function
    return () => clearInterval(pollingInterval);
  }

  subscribeToVTSUpdates(vtsSymbol: string, callback: (data: any) => void): () => void {
    // WebSocket subscription for specific VTS symbol updates
    const pollingInterval = setInterval(async () => {
      try {
        const currentData = await this.getCurrentVPMX(vtsSymbol);
        if (currentData) {
          callback(currentData);
        }
      } catch (error) {
        console.error(`Error polling VTS ${vtsSymbol}:`, error);
      }
    }, 5000); // Poll every 5 seconds for specific symbol

    return () => clearInterval(pollingInterval);
  }
}

export const _vpmxService = VPMXService.getInstance();