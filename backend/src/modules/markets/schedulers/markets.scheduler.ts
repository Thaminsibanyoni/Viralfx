import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketsService } from '../services/markets.service';
import { MarketSettlementService } from '../services/market-settlement.service';
import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class MarketsScheduler implements OnModuleInit {
  private readonly logger = new Logger(MarketsScheduler.name);
  constructor(
  private readonly marketsService: MarketsService,
  private readonly settlementService: MarketSettlementService,
  private readonly prisma: PrismaService) {}
  onModuleInit() {
  this.logger.log('Markets scheduler initialized');
  }

  // Auto-close expired markets every 5 minutes
  @Cron('*/5 * * * *') // Every 5 minutes
  async checkExpiredMarkets(): Promise<void> {
  this.logger.log('Checking for expired markets');
  try {
  const now = new Date();
  const expiredMarkets = await this.prisma.market.findMany({
  where: {
  status: 'ACTIVE',
  endDate: {
  lte: now
          }
        },
  include: {
  outcomes: true
        }
      });
  if (expiredMarkets.length === 0) {
  this.logger.log('No expired markets found');
  return;
      }
  this.logger.log(`Found ${expiredMarkets.length} expired markets, initiating auto-closure`);
  for (const market of expiredMarkets) {
  try {
  await this.marketsService.closeMarket(market.id, 'Market expired automatically');

          // Queue settlement processing
  await this.settlementService.settleMarket({
  marketId: market.id,
  reason: 'Market expired automatically',
  settlementMethod: 'AUTOMATIC'
          });
  this.logger.log(`Auto-closed expired market: ${market.title}`);
        } catch (error) {
  this.logger.error(`Failed to auto-close expired market ${market.id}:`, error);
        }
      }
  this.logger.log(`Expired market check completed: ${expiredMarkets.length} markets processed`);
    } catch (error) {
  this.logger.error('Failed to check expired markets:', error);
    }
  }

  // Update market prices every 2 minutes during business hours
  @Cron('*/2 * * * *') // Every 2 minutes
  async updateMarketPrices(): Promise<void> {
  const now = new Date();
  const hour = now.getHours();
  const isBusinessHours = hour >= 9 && hour <= 17; // 9 AM to 5 PM
  if (!isBusinessHours) {
  return; // Skip during non-business hours
    }
  this.logger.log('Starting scheduled market price updates');
  try {
  const activeMarkets = await this.prisma.market.findMany({
  where: {
  status: 'ACTIVE',
  endDate: {
  gt: now
          }
        },
  select: {
  id: true,
  title: true
        },
  take: 50 // Limit to prevent overwhelming the system
      });
  if (activeMarkets.length === 0) {
  this.logger.log('No active markets found for price updates');
  return;
      }
  let updated = 0;
  for (const market of activeMarkets) {
  try {
  await this.marketsService.updateMarketPrices(market.id);
  updated++;

          // Small delay between updates to prevent overwhelming the system
  await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
  this.logger.warn(`Failed to update prices for market ${market.id}:`, error.message);
        }
      }
  this.logger.log(`Market price update completed: ${updated}/${activeMarkets.length} markets updated`);
    } catch (error) {
  this.logger.error('Failed to update market prices:', error);
    }
  }

  // Clean up old settlement records daily at 3 AM
  @Cron('0 3 * * *') // Every day at 3 AM
  async cleanupOldSettlements(): Promise<void> {
  this.logger.log('Starting daily settlement record cleanup');
  try {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // This would clean up old settlement history records
      // For now, just log the action
  const totalBets = await this.prisma.bet.count({
  where: {
  settledAt: {
  lt: thirtyDaysAgo
          }
        }
      });

      // Delete old settlement notifications
  const deletedNotifications = await this.prisma.notification.deleteMany({
  where: {
  type: 'MARKET_SETTLED',
  createdAt: {
  lt: thirtyDaysAgo
          }
        }
      });
  this.logger.log(
        `Daily settlement cleanup completed: ${totalBets} old bet records, ${deletedNotifications.count} notifications cleaned up`
      );
    } catch (error) {
  this.logger.error('Daily settlement cleanup failed:', error);
    }
  }

  // Generate market performance reports weekly on Sundays at 4 AM
  @Cron('0 4 * * 0') // Every Sunday at 4 AM
  async generateWeeklyReports(): Promise<void> {
  this.logger.log('Starting weekly market performance report generation');
  try {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalMarkets, settledMarkets, activeMarkets] = await Promise.all([
  this.prisma.market.count({
  where: {
  createdAt: { gte: weekAgo }
          }
        }),
  this.prisma.market.count({
  where: {
  status: 'SETTLED',
  updatedAt: { gte: weekAgo }
          }
        }),
  this.prisma.market.count({
  where: {
  status: 'ACTIVE'
          }
        })
      ]);

      // Get market statistics for the week
  const marketStats = await this.calculateWeeklyMarketStats(weekAgo);
  const report = {
  period: {
  start: weekAgo.toISOString(),
  end: new Date().toISOString()
        },
  overview: {
  totalCreated: totalMarkets,
  totalSettled: settledMarkets,
  currentlyActive: activeMarkets,
  settlementRate: totalMarkets > 0 ? (settledMarkets / totalMarkets) * 100 : 0
        },
  statistics: marketStats,
  insights: this.generateWeeklyMarketInsights(marketStats)
      };

      // Store report in database (would have reports table)
  this.logger.log('Weekly market performance report generated', {
  totalCreated: report.overview.totalCreated,
  totalSettled: report.overview.totalSettled,
  currentlyActive: report.overview.currentlyActive,
  settlementRate: report.overview.settlementRate
      });
  this.logger.log('Weekly market performance report generation completed');
    } catch (error) {
  this.logger.error('Weekly market performance report generation failed:', error);
    }
  }

  // Monitor market health every 15 minutes
  @Cron('*/15 * * * *') // Every 15 minutes
  async monitorMarketHealth(): Promise<void> {
  this.logger.log('Starting market health monitoring');
  try {
  const now = new Date();
  const thresholdTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      // Check for markets that haven't been updated recently
  const staleMarkets = await this.prisma.market.findMany({
  where: {
  status: 'ACTIVE',
  OR: [
            {
  lastPriceUpdate: {
  lt: thresholdTime
              }
            },
            {
  lastPriceUpdate: {
  isSet: false
              }
            }
          ]
        },
  select: {
  id: true,
  title: true,
  lastPriceUpdate: true
        }
      });
  if (staleMarkets.length > 0) {
  this.logger.warn(`Found ${staleMarkets.length} markets with stale price data`);

        // Update stale markets
  for (const market of staleMarkets) {
  try {
  await this.marketsService.updateMarketPrices(market.id);
          } catch (error) {
  this.logger.error(`Failed to update stale market ${market.id}:`, error);
          }
        }
      }

      // Check for markets with unusual betting patterns
  const unusualMarkets = await this.detectUnusualBettingPatterns();
  if (unusualMarkets.length > 0) {
  this.logger.warn(`Detected ${unusualMarkets.length} markets with unusual betting patterns`);

        // Would trigger alerts or notifications for review
      }
  this.logger.log('Market health monitoring completed');
    } catch (error) {
  this.logger.error('Market health monitoring failed:', error);
    }
  }

  // Archive old inactive markets monthly on the 1st at 2 AM
  @Cron('0 2 1 * *') // 1st of every month at 2 AM
  async archiveOldMarkets(): Promise<void> {
  this.logger.log('Starting monthly market archival');
  try {
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oldMarkets = await this.prisma.market.findMany({
  where: {
  OR: [
            {
  status: 'SETTLED',
  updatedAt: {
  lt: threeMonthsAgo
              }
            },
            {
  status: 'CLOSED',
  endDate: {
  lt: threeMonthsAgo
              }
            }
          ]
        },
  select: {
  id: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: new Date()
        }
      });
  if (oldMarkets.length === 0) {
  this.logger.log('No markets requiring archival');
  return;
      }

      // Archive markets (would move to archive table)
  const archivedCount = await this.prisma.market.updateMany({
  where: {
  id: { in: oldMarkets.map(m => m.id) }
        },
  data: {
  status: 'ARCHIVED',
  metadata: {
  archivedAt: new Date().toISOString(),
  originalStatus: oldMarkets.map(m => m.status)
          }
        }
      });
  this.logger.log(`Archived ${archivedCount.count} old markets`);
    } catch (error) {
  this.logger.error('Monthly market archival failed:', error);
    }
  }

  private async calculateWeeklyMarketStats(sinceDate: Date): Promise<any> {
  try {
  const [
  totalVolume,
  totalBets,
  averageOdds,
  categoryPerformance,
  topMarkets,
      ] = await Promise.all([
  this.prisma.market.aggregate({
  where: {
  totalVolume: { gt: 0 }
          },
  _sum: { totalVolume: true }
        }),
  this.prisma.bet.aggregate({
  where: {
  createdAt: { gte: sinceDate }
          },
  _count: { id: true }
        }),
  this.prisma.bet.aggregate({
  where: {
  createdAt: { gte: sinceDate }
          },
  _avg: { odds: true }
        }),
  this.calculateCategoryPerformance(sinceDate),
  this.getTopPerformingMarkets(sinceDate)
      ]);
  return {
  totalVolume: totalVolume._sum.totalVolume || 0,
  totalBets: totalBets._count.id || 0,
  averageOdds: averageOdds._avg.odds || 1.0,
  categoryPerformance,
  topMarkets
      };
    } catch (error) {
  this.logger.error('Failed to calculate weekly market stats:', error);
  return {
  totalVolume: 0,
  totalBets: 0,
  averageOdds: 1.0,
  categoryPerformance: [],
  topMarkets: []
      };
    }
  }

  private async calculateCategoryPerformance(sinceDate: Date): Promise<Array<any>> {
  try {
  const categories = await this.prisma.market.groupBy({
  by: ['category'],
  where: {
  createdAt: { gte: sinceDate }
        },
  _count: { id: true },
  _sum: { totalVolume: true },
  _avg: { initialPrice: true }
      });
  return Object.entries(categories).map(([category, data]) => ({
  category,
  marketCount: data._count.id,
  totalVolume: data._sum.totalVolume || 0,
  averageInitialPrice: data._avg.initialPrice || 0
      })).sort((a, b) => b.totalVolume - a.totalVolume);
    } catch (error) {
  this.logger.error('Failed to calculate category performance:', error);
  return [];
    }
  }

  private async getTopPerformingMarkets(sinceDate: Date): Promise<Array<any>> {
  try {
  const topMarkets = await this.prisma.market.findMany({
  where: {
  createdAt: { gte: sinceDate }
          },
  include: {
  topic: {
  select: { name: true }
            }
          },
  orderBy: { totalVolume: 'desc' },
  take: 10
        });
  return topMarkets.map(market => ({
  marketId: market.id,
  title: market.title,
  category: market.category,
  totalVolume: market.totalVolume,
  profitLoss: 0, // Would calculate from bets data
  topicName: market.topic?.name || 'Unknown'
        }));
      } catch (error) {
  this.logger.error('Failed to get top performing markets:', error);
  return [];
      }
    }

  private generateWeeklyMarketInsights(stats: any): string[] {
  const insights: string[] = [];
  if (stats.totalVolume > 100000) {
  insights.push('High trading volume indicates strong market engagement');
      }
  if (stats.totalBets > 10000) {
  insights.push('High betting activity suggests popular market categories');
      }
  if (stats.averageOdds > 2.5) {
  insights.push('Higher odds indicate riskier markets or favorable conditions');
      } else if (stats.averageOdds < 1.8) {
  insights.push('Lower odds suggest safer markets with predictable outcomes');
      }
  if (stats.categoryPerformance.length > 0) {
  const topCategory = stats.categoryPerformance[0];
  insights.push(`${topCategory.category} category leads with ${topCategory.marketCount} markets`);
      }
  return insights;
    }

  private async detectUnusualBettingPatterns(): Promise<Array<any>> {
      // This would analyze betting patterns for unusual activity
      // For now, return mock data
  return [];
    }
  }