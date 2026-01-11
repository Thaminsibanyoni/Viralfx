import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from "../../../prisma/prisma.service";
import { WalletService } from '../services/wallet.service';
import { DepositService } from '../services/deposit.service';
import { WithdrawalService } from '../services/withdrawal.service';
// Transaction entity removed;

@Injectable()
export class WalletScheduler {
  private readonly logger = new Logger(WalletScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
    private readonly withdrawalService: WithdrawalService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingDeposits(): Promise<void> {
    this.logger.debug('Processing pending deposits');
    try {
      // Get pending deposits that are older than 1 minute
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const pendingDeposits = await this.prisma.deposit.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: oneMinuteAgo
          }
        },
        take: 50 // Process in batches
      });

      for (const deposit of pendingDeposits) {
        try {
          await this.depositService.processDeposit(deposit.id);
        } catch (error) {
          this.logger.error(`Failed to process deposit ${deposit.id}:`, error);
          continue;
        }
      }
      if (pendingDeposits.length > 0) {
        this.logger.log(`Processed ${pendingDeposits.length} pending deposits`);
      }
    } catch (error) {
      this.logger.error('Failed to process pending deposits:', error);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processPendingWithdrawals(): Promise<void> {
    this.logger.debug('Processing pending withdrawals');
    try {
      // Get pending withdrawals
      const pendingWithdrawals = await this.prisma.withdrawal.findMany({
        where: {
          status: 'PENDING'
        },
        take: 25 // Process in smaller batches due to security
      });

      for (const withdrawal of pendingWithdrawals) {
        try {
          await this.withdrawalService.processWithdrawal(withdrawal.id);
        } catch (error) {
          this.logger.error(`Failed to process withdrawal ${withdrawal.id}:`, error);
          continue;
        }
      }
      if (pendingWithdrawals.length > 0) {
        this.logger.log(`Processed ${pendingWithdrawals.length} pending withdrawals`);
      }
    } catch (error) {
      this.logger.error('Failed to process pending withdrawals:', error);
    }
  }

  @Cron('0 0 * * *') // Daily at midnight
  async calculateDailyInterest(): Promise<void> {
    this.logger.log('Starting daily interest calculation');
    try {
      // Get all active wallets
      const wallets = await this.prisma.wallet.findMany({
        where: {
          isActive: true,
          balance: {
            gt: 0
          }
        }
      });

      for (const wallet of wallets) {
        try {
          await this.walletService.calculateInterest(wallet.id);
        } catch (error) {
          this.logger.error(`Failed to calculate interest for wallet ${wallet.id}:`, error);
          continue;
        }
      }
      this.logger.log(`Calculated daily interest for ${wallets.length} wallets`);
    } catch (error) {
      this.logger.error('Failed to calculate daily interest:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reconcileWalletBalances(): Promise<void> {
    this.logger.log('Starting wallet balance reconciliation');
    try {
      // Get wallets that haven't been reconciled in the last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const walletsToReconcile = await this.prisma.wallet.findMany({
        where: {
          isActive: true,
          OR: [
            { lastReconciledAt: null },
            { lastReconciledAt: { lt: oneHourAgo } }
          ]
        },
        take: 100 // Process in batches
      });

      for (const wallet of walletsToReconcile) {
        try {
          await this.walletService.reconcileBalance(wallet.id);
        } catch (error) {
          this.logger.error(`Failed to reconcile balance for wallet ${wallet.id}:`, error);
          continue;
        }
      }
      this.logger.log(`Reconciled balances for ${walletsToReconcile.length} wallets`);
    } catch (error) {
      this.logger.error('Failed to reconcile wallet balances:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateDailyReports(): Promise<void> {
    this.logger.log('Starting daily wallet reports generation');
    try {
      // Generate daily transaction reports
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const report = await this.walletService.generateDailyReport(today, tomorrow);

      // Store report
      await this.prisma.walletReport.create({
        data: {
          reportType: 'DAILY_SUMMARY',
          date: today,
          data: report,
          generatedAt: new Date()
        }
      });
      this.logger.log('Generated daily wallet report');
    } catch (error) {
      this.logger.error('Failed to generate daily reports:', error);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async cleanupOldTransactions(): Promise<void> {
    this.logger.log('Starting old transactions cleanup');
    try {
      // Clean up completed transactions older than 1 year
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const result = await this.prisma.transaction.deleteMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            lt: oneYearAgo
          }
        }
      });
      this.logger.log(`Cleaned up ${result.count} old transactions`);
    } catch (error) {
      this.logger.error('Failed to cleanup old transactions:', error);
    }
  }

  @Cron('0 */30 * * * *') // Every 30 minutes
  async monitorLargeTransactions(): Promise<void> {
    this.logger.debug('Monitoring large transactions');
    try {
      // Get recent large transactions (above $10,000)
      const threshold = 10000; // $10,000
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const largeTransactions = await this.prisma.transaction.findMany({
        where: {
          amount: {
            gt: threshold
          },
          createdAt: {
            gte: thirtyMinutesAgo
          },
          status: {
            not: 'COMPLETED'
          }
        }
      });

      if (largeTransactions.length > 0) {
        this.logger.warn(`Found ${largeTransactions.length} large transactions pending review`);

        // Create alerts for compliance team
        for (const transaction of largeTransactions) {
          await this.prisma.notification.create({
            data: {
              userId: transaction.userId,
              type: 'COMPLIANCE_ALERT',
              title: 'Large Transaction Alert',
              message: `Large transaction of $${transaction.amount} requires review`,
              metadata: {
                transactionId: transaction.id,
                amount: transaction.amount,
                alertType: 'LARGE_TRANSACTION',
                status: 'PENDING',
                priority: 'HIGH'
              }
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to monitor large transactions:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async updateExchangeRates(): Promise<void> {
    this.logger.log('Starting exchange rates update');
    try {
      // Update exchange rates for all supported currencies
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH'];

      for (const currency of currencies) {
        try {
          await this.walletService.updateExchangeRate(currency);
        } catch (error) {
          this.logger.error(`Failed to update exchange rate for ${currency}:`, error);
          continue;
        }
      }
      this.logger.log(`Updated exchange rates for ${currencies.length} currencies`);
    } catch (error) {
      this.logger.error('Failed to update exchange rates:', error);
    }
  }

  @Cron('0 0 1 * *') // Monthly on the 1st at midnight
  async generateMonthlyStatements(): Promise<void> {
    this.logger.log('Starting monthly statement generation');
    try {
      // Get all active wallets
      const wallets = await this.prisma.wallet.findMany({
        where: {
          isActive: true
        }
      });

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      lastMonth.setHours(0, 0, 0, 0);

      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      for (const wallet of wallets) {
        try {
          const statement = await this.walletService.generateMonthlyStatement(
            wallet.id,
            lastMonth,
            thisMonth
          );

          // Create notification for user
          await this.prisma.notification.create({
            data: {
              userId: wallet.userId,
              type: 'MONTHLY_STATEMENT',
              title: 'Monthly Wallet Statement Available',
              message: `Your monthly statement for ${lastMonth.toLocaleDateString()} is now available.`,
              metadata: {
                statementId: statement.id,
                period: `${lastMonth.toISOString()} - ${thisMonth.toISOString()}`,
                status: 'PENDING'
              }
            }
          });
        } catch (error) {
          this.logger.error(`Failed to generate statement for wallet ${wallet.id}:`, error);
          continue;
        }
      }
      this.logger.log(`Generated monthly statements for ${wallets.length} wallets`);
    } catch (error) {
      this.logger.error('Failed to generate monthly statements:', error);
    }
  }

  @Cron('*/15 * * * *') // Every 15 minutes
  async checkWalletHealth(): Promise<void> {
    this.logger.debug('Checking wallet system health');
    try {
      // Get wallet health metrics
      const healthMetrics = await this.walletService.getHealthMetrics();

      // Check for anomalies
      if (healthMetrics.errorRate > 0.05) { // 5% error rate threshold
        this.logger.warn(`High error rate detected: ${healthMetrics.errorRate * 100}%`);

        // Create alert for system administrators
        await this.prisma.notification.create({
          data: {
            type: 'SYSTEM_ALERT',
            title: 'Wallet System Health Alert',
            message: `High error rate detected in wallet system: ${healthMetrics.errorRate * 100}%`,
            metadata: {
              errorRate: healthMetrics.errorRate,
              responseTime: healthMetrics.averageResponseTime,
              alertType: 'WALLET_HEALTH',
              status: 'PENDING',
              priority: 'HIGH'
            }
          }
        });
      }

      if (healthMetrics.pendingTransactions > 1000) {
        this.logger.warn(`High pending transaction count: ${healthMetrics.pendingTransactions}`);

        // Create alert for system administrators
        await this.prisma.notification.create({
          data: {
            type: 'SYSTEM_ALERT',
            title: 'Wallet Queue Alert',
            message: `High number of pending transactions: ${healthMetrics.pendingTransactions}`,
            metadata: {
              pendingTransactions: healthMetrics.pendingTransactions,
              alertType: 'WALLET_QUEUE',
              status: 'PENDING',
              priority: 'MEDIUM'
            }
          }
        });
      }
    } catch (error) {
      this.logger.error('Failed to check wallet health:', error);
    }
  }
}