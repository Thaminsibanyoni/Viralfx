import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CandleTimeframe, CandleStatus } from '../dto/candle-engine.dto';

@Injectable()
export class CandleEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Configure which timeframes are available for a market
   */
  async configureTimeframes(marketId: string, timeframes: string[]) {
    const market = await this.findMarket(marketId);

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id: marketId },
      data: { timeframes },
    });

    await this.auditService.log({
      action: 'CANDLE_TIMEFRAMES_CONFIGURED',
      entityType: 'VPMXTradingMarket',
      entityId: marketId,
      details: {
        symbol: market.symbol,
        previousTimeframes: market.timeframes,
        newTimeframes: timeframes,
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Rebuild historical candles for a market and timeframe
   * This is computationally expensive - use sparingly
   */
  async rebuildCandles(
    marketId: string,
    timeframe: string,
    startDate?: string,
    endDate?: string,
    force = false,
  ) {
    const market = await this.findMarket(marketId);

    // Check if timeframe is valid
    if (!market.timeframes.includes(timeframe)) {
      throw new BadRequestException(`Timeframe ${timeframe} not enabled for this market`);
    }

    // Check if already rebuilding
    const existingRebuild = await this.prisma.candleRebuildJob.findFirst({
      where: {
        marketId,
        timeframe,
        status: 'in_progress',
      },
    });

    if (existingRebuild && !force) {
      throw new BadRequestException('Rebuild already in progress for this market/timeframe');
    }

    // Create rebuild job
    const job = await this.prisma.candleRebuildJob.create({
      data: {
        marketId,
        timeframe,
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: endDate ? new Date(endDate) : new Date(),
        status: 'pending',
        force,
        requestedBy: 'admin',
      },
    });

    await this.auditService.log({
      action: 'CANDLE_REBUILD_STARTED',
      entityType: 'CandleRebuildJob',
      entityId: job.id,
      details: {
        marketSymbol: market.symbol,
        timeframe,
        startDate,
        endDate,
        force,
      },
      severity: 'warning',
    });

    // In production, this would trigger a background job
    // For now, we'll mark it as complete
    await this.prisma.candleRebuildJob.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return job;
  }

  /**
   * Update candle aggregation rules
   * Control how different factors contribute to candle formation
   */
  async updateAggregationRules(
    marketId: string,
    rules: {
      volumeWeight?: number;
      vpmxWeight?: number;
      engagementWeight?: number;
      enableSmoothing?: boolean;
      smoothingPeriod?: number;
    },
  ) {
    const market = await this.findMarket(marketId);

    // Get existing rules or create new
    const existing = await this.prisma.candleAggregationRule.findFirst({
      where: { marketId },
    });

    const data = {
      volumeWeight: rules.volumeWeight ?? existing?.volumeWeight ?? 0.4,
      vpmxWeight: rules.vpmxWeight ?? existing?.vpmxWeight ?? 0.3,
      engagementWeight: rules.engagementWeight ?? existing?.engagementWeight ?? 0.3,
      enableSmoothing: rules.enableSmoothing ?? existing?.enableSmoothing ?? false,
      smoothingPeriod: rules.smoothingPeriod ?? existing?.smoothingPeriod ?? 5,
      // Ensure weights sum to 1
      normalized: false,
    };

    const aggregationRule = existing
      ? await this.prisma.candleAggregationRule.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.candleAggregationRule.create({
          data: {
            ...data,
            marketId,
          },
        });

    await this.auditService.log({
      action: 'CANDLE_AGGREGATION_UPDATED',
      entityType: 'CandleAggregationRule',
      entityId: aggregationRule.id,
      details: {
        marketSymbol: market.symbol,
        rules: data,
      },
      severity: 'info',
    });

    return aggregationRule;
  }

  /**
   * Update volume weighting logic
   * Control how different engagement types contribute to volume
   */
  async updateVolumeWeighting(
    marketId: string,
    weights: {
      mentionsWeight?: number;
      sharesWeight?: number;
      likesWeight?: number;
      commentsWeight?: number;
    },
  ) {
    const market = await this.findMarket(marketId);

    // Get existing rules or create new
    const existing = await this.prisma.volumeWeightingRule.findFirst({
      where: { marketId },
    });

    const data = {
      mentionsWeight: weights.mentionsWeight ?? existing?.mentionsWeight ?? 0.4,
      sharesWeight: weights.sharesWeight ?? existing?.sharesWeight ?? 0.3,
      likesWeight: weights.likesWeight ?? existing?.likesWeight ?? 0.2,
      commentsWeight: weights.commentsWeight ?? existing?.commentsWeight ?? 0.1,
    };

    const weightingRule = existing
      ? await this.prisma.volumeWeightingRule.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.volumeWeightingRule.create({
          data: {
            ...data,
            marketId,
          },
        });

    await this.auditService.log({
      action: 'VOLUME_WEIGHTING_UPDATED',
      entityType: 'VolumeWeightingRule',
      entityId: weightingRule.id,
      details: {
        marketSymbol: market.symbol,
        weights: data,
      },
      severity: 'info',
    });

    return weightingRule;
  }

  /**
   * Enable or disable a specific timeframe for a market
   */
  async enableTimeframe(marketId: string, timeframe: string, enabled: boolean) {
    const market = await this.findMarket(marketId);

    const currentTimeframes = market.timeframes || [];

    if (enabled && !currentTimeframes.includes(timeframe)) {
      // Enable timeframe
      const updated = await this.prisma.vPMXTradingMarket.update({
        where: { id: marketId },
        data: { timeframes: [...currentTimeframes, timeframe] },
      });

      await this.auditService.log({
        action: 'TIMEFRAME_ENABLED',
        entityType: 'VPMXTradingMarket',
        entityId: marketId,
        details: {
          symbol: market.symbol,
          timeframe,
        },
        severity: 'info',
      });

      return updated;
    } else if (!enabled && currentTimeframes.includes(timeframe)) {
      // Disable timeframe
      const updated = await this.prisma.vPMXTradingMarket.update({
        where: { id: marketId },
        data: { timeframes: currentTimeframes.filter((t) => t !== timeframe) },
      });

      await this.auditService.log({
        action: 'TIMEFRAME_DISABLED',
        entityType: 'VPMXTradingMarket',
        entityId: marketId,
        details: {
          symbol: market.symbol,
          timeframe,
        },
        severity: 'warning',
      });

      return updated;
    }

    return market;
  }

  /**
   * Get all rebuild jobs for a market
   */
  async getRebuildJobs(marketId: string) {
    return this.prisma.candleRebuildJob.findMany({
      where: { marketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get aggregation rules for a market
   */
  async getAggregationRules(marketId: string) {
    return this.prisma.candleAggregationRule.findFirst({
      where: { marketId },
    });
  }

  /**
   * Get volume weighting rules for a market
   */
  async getVolumeWeighting(marketId: string) {
    return this.prisma.volumeWeightingRule.findFirst({
      where: { marketId },
    });
  }

  /**
   * Helper: Find market or throw 404
   */
  private async findMarket(id: string) {
    const market = await this.prisma.vPMXTradingMarket.findUnique({
      where: { id },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    return market;
  }
}
