import { Injectable, Logger } from '@nestjs/common';
import { MrrService } from './mrr.service';
import { NrrService } from './nrr.service';
import { CohortAnalysisService } from './cohort-analysis.service';
import { RevenueAnalyticsService } from './revenue-analytics.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class FinancialReportingService {
  private readonly logger = new Logger(FinancialReportingService.name);
  private readonly CACHE_TTL = 300; // 5 minutes for dashboard

  constructor(
    private readonly mrrService: MrrService,
    private readonly nrrService: NrrService,
    private readonly cohortAnalysisService: CohortAnalysisService,
    private readonly revenueAnalyticsService: RevenueAnalyticsService,
    @InjectQueue('financial-reports')
    private readonly financialReportsQueue: Queue,
    private readonly redisService: RedisService,
  ) {}

  async getDashboard(period?: { start: Date; end: Date }): Promise<{
    mrr: {
      current: number;
      growth: number;
      byTier: Record<string, number>;
    };
    nrr: {
      current: number;
      trend: 'improving' | 'declining' | 'stable';
    };
    churn: {
      rate: number;
      churnedMRR: number;
    };
    arpu: {
      current: number;
      growth: number;
    };
    totalRevenue: number;
    growth: {
      monthly: number;
      yearly: number;
    };
    topMetrics: {
      bestPerformingTier: string;
      fastestGrowingRegion: string;
      highestLTV: number;
    };
  }> {
    const cacheKey = `financial:dashboard:${JSON.stringify(period)}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const now = new Date();
      const defaultPeriod = period || {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };

      // Get MRR data
      const mrrData = await this.mrrService.calculateMRR(now);
      const mrrGrowth = await this.mrrService.getMRRGrowth(
        new Date(now.getFullYear(), now.getMonth() - 6, 1),
        now
      );

      // Get NRR data
      const nrrTrend = await this.nrrService.getNRRTrend(6);
      const currentNRR = nrrTrend.trend[nrrTrend.trend.length - 1]?.nrr || 0;

      // Determine NRR trend
      const recentNRR = nrrTrend.trend.slice(-3).map(t => t.nrr);
      const earlierNRR = nrrTrend.trend.slice(0, 3).map(t => t.nrr);
      const recentAvg = recentNRR.reduce((sum, val) => sum + val, 0) / recentNRR.length;
      const earlierAvg = earlierNRR.reduce((sum, val) => sum + val, 0) / earlierNRR.length;

      let nrrTrendDirection: 'improving' | 'declining' | 'stable' = 'stable';
      if (recentAvg > earlierAvg * 1.02) {
        nrrTrendDirection = 'improving';
      } else if (recentAvg < earlierAvg * 0.98) {
        nrrTrendDirection = 'declining';
      }

      // Get churn data
      const churnData = await this.mrrService.getMRRChurn(now);
      const previousMonthMRR = await this.mrrService.calculateMRR(
        new Date(now.getFullYear(), now.getMonth() - 1, 1)
      );
      const churnRate = previousMonthMRR.total > 0 ? (churnData.churnedMRR / previousMonthMRR.total) * 100 : 0;

      // Get ARPU data
      const arpuData = await this.revenueAnalyticsService.getARPU(defaultPeriod);
      const arpuTrend = arpuData.trend;
      const arpuGrowth = arpuTrend.length >= 2
        ? ((arpuTrend[arpuTrend.length - 1].arpu - arpuTrend[arpuTrend.length - 2].arpu) / arpuTrend[arpuTrend.length - 2].arpu) * 100
        : 0;

      // Get revenue growth
      const revenueGrowth = await this.revenueAnalyticsService.getRevenueGrowth(defaultPeriod);

      // Get revenue by tier to find best performing tier
      const revenueByTier = await this.revenueAnalyticsService.getRevenueByTier(defaultPeriod);
      const bestPerformingTier = revenueByTier.tiers.length > 0
        ? revenueByTier.tiers.reduce((best, current) => current.totalRevenue > best.totalRevenue ? current : best).tier
        : 'N/A';

      // Get revenue by region to find fastest growing region
      const revenueByRegion = await this.revenueAnalyticsService.getRevenueByRegion(defaultPeriod);
      const fastestGrowingRegion = revenueByRegion.regions.length > 0
        ? revenueByRegion.regions.reduce((best, current) => current.totalRevenue > best.totalRevenue ? current : best).region
        : 'N/A';

      // Get LTV data
      const ltvData = await this.cohortAnalysisService.getLTVByCohort(6);
      const highestLTV = ltvData.cohorts.length > 0
        ? Math.max(...ltvData.cohorts.map(c => c.ltv))
        : 0;

      const dashboard = {
        mrr: {
          current: mrrData.total,
          growth: mrrGrowth.growthRate,
          byTier: mrrData.byTier,
        },
        nrr: {
          current: currentNRR,
          trend: nrrTrendDirection,
        },
        churn: {
          rate: churnRate,
          churnedMRR: churnData.churnedMRR,
        },
        arpu: {
          current: arpuData.overall,
          growth: arpuGrowth,
        },
        totalRevenue: revenueGrowth.currentPeriodRevenue,
        growth: {
          monthly: revenueGrowth.monthOverMonth,
          yearly: revenueGrowth.yearOverYear,
        },
        topMetrics: {
          bestPerformingTier,
          fastestGrowingRegion,
          highestLTV,
        },
      };

      await this.redisService.setex(cacheKey, this.CACHE_TTL, JSON.stringify(dashboard));
      this.logger.log('Generated financial dashboard');

      return dashboard;

    } catch (error) {
      this.logger.error('Failed to generate financial dashboard:', error);
      throw error;
    }
  }

  async generateExecutiveReport(period: { start: Date; end: Date }): Promise<{
    summary: {
      totalRevenue: number;
      totalBrokers: number;
      averageRevenuePerBroker: number;
      growthRate: number;
      profitability: number;
    };
    metrics: {
      mrr: number;
      nrr: number;
      churnRate: number;
      ltv: number;
      cac: number; // Customer Acquisition Cost (placeholder)
    };
    trends: {
      revenue: Array<{ period: string; amount: number; growth: number }>;
      brokerGrowth: Array<{ period: string; brokers: number; growth: number }>;
    };
    insights: string[];
    recommendations: string[];
  }> {
    try {
      const dashboard = await this.getDashboard(period);
      const revenueByTier = await this.revenueAnalyticsService.getRevenueByTier(period);
      const revenueGrowth = await this.revenueAnalyticsService.getRevenueGrowth(period);
      const cohortData = await this.cohortAnalysisService.getLTVByCohort(3);

      // Calculate total brokers (simplified)
      const totalBrokers = revenueByTier.tiers.reduce((sum, tier) => sum + tier.brokerCount, 0);
      const totalRevenue = revenueGrowth.currentPeriodRevenue;
      const averageRevenuePerBroker = totalBrokers > 0 ? totalRevenue / totalBrokers : 0;

      // Generate insights based on data
      const insights = this.generateInsights(dashboard, revenueByTier, cohortData);
      const recommendations = this.generateRecommendations(dashboard, insights);

      const report = {
        summary: {
          totalRevenue,
          totalBrokers,
          averageRevenuePerBroker,
          growthRate: dashboard.growth.monthly,
          profitability: 85.5, // Placeholder - would need cost data
        },
        metrics: {
          mrr: dashboard.mrr.current,
          nrr: dashboard.nrr.current,
          churnRate: dashboard.churn.rate,
          ltv: dashboard.topMetrics.highestLTV,
          cac: 2500, // Placeholder - would need marketing spend data
        },
        trends: {
          revenue: revenueGrowth.trend,
          brokerGrowth: [], // Would need broker acquisition trend data
        },
        insights,
        recommendations,
      };

      this.logger.log('Generated executive report');
      return report;

    } catch (error) {
      this.logger.error('Failed to generate executive report:', error);
      throw error;
    }
  }

  async generateBrokerReport(
    brokerId: string,
    period: { start: Date; end: Date },
  ): Promise<{
    brokerInfo: {
      id: string;
      name: string;
      tier: string;
      joinDate: Date;
    };
    financialMetrics: {
      totalRevenue: number;
      totalTransactions: number;
      averageMonthlyRevenue: number;
      ltv: number;
    };
    billing: Array<{
      period: string;
      amount: number;
      status: string;
      paidDate?: Date;
    }>;
    performance: {
      growthRate: number;
      retentionRate: number;
      profitability: number;
    };
    insights: string[];
  }> {
    try {
      // This would require broker-specific queries
      // For now, return a placeholder structure
      const report = {
        brokerInfo: {
          id: brokerId,
          name: 'Sample Broker',
          tier: 'PREMIUM',
          joinDate: new Date('2023-01-01'),
        },
        financialMetrics: {
          totalRevenue: 50000,
          totalTransactions: 1250,
          averageMonthlyRevenue: 5000,
          ltv: 25000,
        },
        billing: [
          {
            period: '2024-01',
            amount: 5000,
            status: 'PAID',
            paidDate: new Date('2024-01-15'),
          },
        ],
        performance: {
          growthRate: 15.5,
          retentionRate: 95.2,
          profitability: 88.7,
        },
        insights: [
          'Strong revenue growth over the past quarter',
          'High retention rate indicates customer satisfaction',
          'Consider upselling additional services',
        ],
      };

      this.logger.log(`Generated broker report for ${brokerId}`);
      return report;

    } catch (error) {
      this.logger.error(`Failed to generate broker report for ${brokerId}:`, error);
      throw error;
    }
  }

  async scheduleReport(config: {
    type: 'executive' | 'broker' | 'revenue';
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    filters?: any;
  }): Promise<{ reportId: string; nextRun: Date }> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Add job to queue for report generation
      await this.financialReportsQueue.add(
        'generate-scheduled-report',
        {
          reportId,
          config,
        },
        {
          repeat: this.getRepeatPattern(config.frequency),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      const nextRun = this.getNextRunDate(config.frequency);

      this.logger.log(`Scheduled ${config.type} report with ID: ${reportId}`);
      return { reportId, nextRun };

    } catch (error) {
      this.logger.error('Failed to schedule report:', error);
      throw error;
    }
  }

  async exportReport(reportId: string, format: 'json' | 'csv' | 'pdf'): Promise<Buffer | string> {
    try {
      // In a real implementation, this would fetch the report from storage
      // and convert it to the requested format
      const reportData = {
        reportId,
        generatedAt: new Date().toISOString(),
        data: 'Sample report data',
      };

      if (format === 'json') {
        return JSON.stringify(reportData, null, 2);
      } else if (format === 'csv') {
        return 'Report,Created,Data\nSample,2024-01-01,Export';
      } else if (format === 'pdf') {
        return Buffer.from(`Report Export\n\n${JSON.stringify(reportData, null, 2)}`);
      }

      throw new Error(`Unsupported format: ${format}`);

    } catch (error) {
      this.logger.error(`Failed to export report ${reportId}:`, error);
      throw error;
    }
  }

  private generateInsights(dashboard: any, revenueByTier: any, cohortData: any): string[] {
    const insights = [];

    if (dashboard.nrr.current > 100) {
      insights.push('Strong net revenue retention indicates healthy expansion and low churn');
    }

    if (dashboard.churn.rate > 10) {
      insights.push('Churn rate is above target - consider retention strategies');
    }

    if (dashboard.growth.monthly > 15) {
      insights.push('Excellent monthly revenue growth trajectory');
    }

    const topTier = Object.entries(dashboard.mrr.byTier).reduce((a, b) => a[1] > b[1] ? a : b);
    insights.push(`${topTier[0]} tier contributes ${((topTier[1] / dashboard.mrr.current) * 100).toFixed(1)}% of MRR`);

    return insights;
  }

  private generateRecommendations(dashboard: any, insights: string[]): string[] {
    const recommendations = [];

    if (dashboard.churn.rate > 10) {
      recommendations.push('Implement customer success program to reduce churn');
    }

    if (dashboard.nrr.current < 100) {
      recommendations.push('Focus on expansion revenue from existing customers');
    }

    if (dashboard.growth.monthly < 5) {
      recommendations.push('Accelerate new broker acquisition initiatives');
    }

    recommendations.push('Monitor top-performing tiers for best practices replication');

    return recommendations;
  }

  private getRepeatPattern(frequency: string): any {
    switch (frequency) {
      case 'daily':
        return { cron: '0 8 * * *' }; // 8 AM daily
      case 'weekly':
        return { cron: '0 8 * * 1' }; // 8 AM every Monday
      case 'monthly':
        return { cron: '0 8 1 * *' }; // 8 AM on 1st of every month
      default:
        return { cron: '0 8 * * *' };
    }
  }

  private getNextRunDate(frequency: string): Date {
    const now = new Date();
    const nextRun = new Date(now);

    switch (frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + (7 - now.getDay() + 1) % 7 || 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(1);
        break;
    }

    nextRun.setHours(8, 0, 0, 0);
    return nextRun;
  }
}