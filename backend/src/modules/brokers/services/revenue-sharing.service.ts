import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
// COMMENTED OUT (TypeORM entity deleted): import { BrokerClient } from '../entities/broker-client.entity';
// COMMENTED OUT (TypeORM entity deleted): import { Broker } from '../entities/broker.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerBill, BillStatus } from '../entities/broker-bill.entity';
import { PaymentGatewayService } from "../../payment/services/payment-gateway.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface PayoutCalculation {
  brokerId: string;
  period: {
    start: Date;
    end: Date;
  };
  totalRevenue: number;
  platformShare: number;
  brokerShare: number;
  volumeDiscount: number;
  performanceBonus: number;
  netPayout: number;
  breakdown: {
    commissionRevenue: number;
    referralRevenue: number;
    bonusRevenue: number;
    adjustments: number;
  };
  transactionCount: number;
  clientCount: number;
}

export interface RevenueReport {
  period: {
    start: Date;
    end: Date;
  };
  totalPlatformRevenue: number;
  totalBrokerPayouts: number;
  netPlatformRevenue: number;
  brokerBreakdown: Array<{
    brokerId: string;
    brokerName: string;
    tier: string;
    revenue: number;
    payout: number;
    platformShare: number;
    clientCount: number;
    transactionCount: number;
  }>;
  trends: {
    monthlyRevenue: Array<{
      month: string;
      revenue: number;
      payouts: number;
    }>;
    growthMetrics: {
      revenueGrowth: number;
      payoutGrowth: number;
      clientGrowth: number;
    };
  };
}

export interface CommissionStructure {
  defaultSplit: {
    platform: number;  // 70%
    broker: number;    // 30%
  };
  volumeDiscounts: Array<{
    minVolume: number;
    discount: number;
  }>;
  performanceBonuses: Array<{
    threshold: number;
    bonus: number;
  }>;
  tierMultipliers: Record<string, number>;
}

@Injectable()
export class RevenueSharingService {
  private readonly logger = new Logger(RevenueSharingService.name);
  private readonly commissionStructure: CommissionStructure;

  constructor(
        private prismaService: PrismaService,
    private paymentGatewayService: PaymentGatewayService,
    private notificationService: NotificationService,
    private configService: ConfigService,
    @InjectQueue('payout-processing') private payoutQueue: Queue) {
    this.commissionStructure = {
      defaultSplit: {
        platform: this.configService.get<number>('PLATFORM_COMMISSION_RATE', 0.7),
        broker: this.configService.get<number>('BROKER_COMMISSION_RATE', 0.3)
      },
      volumeDiscounts: [
        { minVolume: 1000000, discount: 0.02 },    // 2% discount for R1M+
        { minVolume: 5000000, discount: 0.05 },    // 5% discount for R5M+
        { minVolume: 10000000, discount: 0.08 },   // 8% discount for R10M+
        { minVolume: 25000000, discount: 0.10 },   // 10% discount for R25M+
      ],
      performanceBonuses: [
        { threshold: 100000, bonus: 0.01 },       // 1% bonus for R100k+ monthly
        { threshold: 500000, bonus: 0.02 },       // 2% bonus for R500k+ monthly
        { threshold: 1000000, bonus: 0.03 },      // 3% bonus for R1M+ monthly
      ],
      tierMultipliers: {
        STARTER: 1.0,
        PROFESSIONAL: 1.05,
        ENTERPRISE: 1.10
      }
    };
  }

  async calculateMonthlyPayout(brokerId: string, year: number, month: number): Promise<PayoutCalculation> {
    this.logger.log(`Calculating monthly payout for broker ${brokerId}, ${year}-${month}`);

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get broker details
    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    // Get orders for the period
    const orders = await this.prismaService.order.findMany({
      where: {
        brokerId: brokerId,
        status: 'FILLED',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Get unique clients
    const clientIds = [...new Set(orders.map(order => order.userId))];
    const clientCount = clientIds.length;

    // Calculate total revenue
    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.feeAmount), 0);
    const totalVolume = orders.reduce((sum, order) => sum + Number(order.totalValue), 0);

    // Apply commission split
    let platformShare = totalRevenue * this.commissionStructure.defaultSplit.platform;
    let brokerShare = totalRevenue * this.commissionStructure.defaultSplit.broker;

    // Apply volume discounts
    const volumeDiscount = this.calculateVolumeDiscount(totalVolume);
    brokerShare += brokerShare * volumeDiscount; // Broker gets additional from volume discount

    // Apply performance bonus
    const performanceBonus = this.calculatePerformanceBonus(totalRevenue);
    brokerShare += brokerShare * performanceBonus;

    // Apply tier multiplier
    const tierMultiplier = this.commissionStructure.tierMultipliers[broker.tier] || 1.0;
    brokerShare *= tierMultiplier;

    // Calculate breakdown
    const commissionRevenue = totalRevenue;
    const referralRevenue = 0; // Would calculate from referral programs
    const bonusRevenue = brokerShare - (totalRevenue * this.commissionStructure.defaultSplit.broker);
    const adjustments = 0; // Would calculate from manual adjustments

    const netPayout = brokerShare;

    this.logger.log(`Payout calculated for broker ${brokerId}: R${netPayout.toFixed(2)}`);

    return {
      brokerId,
      period: { start: startDate, end: endDate },
      totalRevenue,
      platformShare,
      brokerShare,
      volumeDiscount,
      performanceBonus,
      netPayout,
      breakdown: {
        commissionRevenue,
        referralRevenue,
        bonusRevenue,
        adjustments
      },
      transactionCount: orders.length,
      clientCount
    };
  }

  private calculateVolumeDiscount(volume: number): number {
    for (const discount of this.commissionStructure.volumeDiscounts.reverse()) {
      if (volume >= discount.minVolume) {
        return discount.discount;
      }
    }
    return 0;
  }

  private calculatePerformanceBonus(revenue: number): number {
    for (const bonus of this.commissionStructure.performanceBonuses.reverse()) {
      if (revenue >= bonus.threshold) {
        return bonus.bonus;
      }
    }
    return 0;
  }

  async processMonthlyPayouts(year: number, month: number): Promise<void> {
    this.logger.log(`Processing monthly payouts for ${year}-${month}`);

    // Get all active brokers
    const brokers = await this.prisma.broker.findMany({ where: { isActive: true } });

    const payoutPromises = brokers.map(async (broker) => {
      try {
        const payout = await this.calculateMonthlyPayout(broker.id, year, month);

        // Create bill record
        const bill = this.prisma.billrepository.create({
          brokerId: broker.id,
          period: new Date(year, month - 1, 1),
          baseFee: 0, // No base fee, pure revenue sharing
          transactionFees: payout.platformShare,
          additionalServices: 0,
          vat: 0, // VAT handled separately
          total: payout.platformShare,
          status: BillStatus.PENDING,
          dueDate: new Date(year, month, 15) // Due on 15th of next month
        });

        await this.prisma.billrepository.upsert(bill);

        // Queue payout processing
        await this.payoutQueue.add('process-broker-payout', {
          brokerId: broker.id,
          payout,
          billId: bill.id
        });

        this.logger.log(`Payout processed for broker ${broker.id}: R${payout.netPayout.toFixed(2)}`);
      } catch (error) {
        this.logger.error(`Failed to process payout for broker ${broker.id}:`, error);
      }
    });

    await Promise.all(payoutPromises);
  }

  async generateRevenueReport(startDate: Date, endDate: Date): Promise<RevenueReport> {
    this.logger.log(`Generating revenue report from ${startDate} to ${endDate}`);

    // Get all orders in the period
    const orders = await this.prismaService.order.findMany({
      where: {
        status: 'FILLED',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    // Group by broker
    const brokerRevenue = new Map<string, {
      broker: Broker;
      revenue: number;
      transactionCount: number;
      clientIds: Set<string>;
    }>();

    orders.forEach(order => {
      if (order.brokerId) {
        if (!brokerRevenue.has(order.brokerId)) {
          brokerRevenue.set(order.brokerId, {
            broker: null, // Will be populated later
            revenue: 0,
            transactionCount: 0,
            clientIds: new Set()
          });
        }

        const data = brokerRevenue.get(order.brokerId);
        data.revenue += Number(order.feeAmount);
        data.transactionCount += 1;
        data.clientIds.add(order.userId);
      }
    });

    // Get broker details and calculate payouts
    const brokerBreakdown = await Promise.all(
      Array.from(brokerRevenue.entries()).map(async ([brokerId, data]) => {
        const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
        data.broker = broker;

        const payoutCalculation = await this.calculateMonthlyPayout(
          brokerId,
          startDate.getFullYear(),
          startDate.getMonth() + 1
        );

        return {
          brokerId,
          brokerName: broker?.companyName || 'Unknown',
          tier: broker?.tier || 'STARTER',
          revenue: data.revenue,
          payout: payoutCalculation.netPayout,
          platformShare: payoutCalculation.platformShare,
          clientCount: data.clientIds.size,
          transactionCount: data.transactionCount
        };
      })
    );

    // Calculate totals
    const totalPlatformRevenue = brokerBreakdown.reduce((sum, broker) => sum + broker.platformShare, 0);
    const totalBrokerPayouts = brokerBreakdown.reduce((sum, broker) => sum + broker.payout, 0);
    const netPlatformRevenue = totalPlatformRevenue;

    // Generate monthly revenue trends (last 12 months)
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const month = new Date();
      month.setMonth(month.getMonth() - i);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

      const monthOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= monthStart && orderDate <= monthEnd;
      });

      const monthRevenue = monthOrders.reduce((sum, order) => sum + Number(order.feeAmount), 0);
      const monthPayouts = monthOrders.reduce((sum, order) => {
        // Simplified payout calculation for trends
        return sum + (Number(order.feeAmount) * 0.3);
      }, 0);

      monthlyRevenue.push({
        month: monthStart.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        revenue: monthRevenue,
        payouts: monthPayouts
      });
    }

    return {
      period: { start: startDate, end: endDate },
      totalPlatformRevenue,
      totalBrokerPayouts,
      netPlatformRevenue,
      brokerBreakdown,
      trends: {
        monthlyRevenue,
        growthMetrics: {
          revenueGrowth: this.calculateGrowthRate(monthlyRevenue, 'revenue'),
          payoutGrowth: this.calculateGrowthRate(monthlyRevenue, 'payouts'),
          clientGrowth: this.calculateClientGrowth(brokerBreakdown)
        }
      }
    };
  }

  private calculateGrowthRate(data: Array<{ revenue: number; payouts: number }>, metric: 'revenue' | 'payouts'): number {
    if (data.length < 2) return 0;

    const current = data[data.length - 1][metric];
    const previous = data[data.length - 2][metric];

    return previous > 0 ? ((current - previous) / previous) * 100 : 0;
  }

  private calculateClientGrowth(brokerBreakdown: any[]): number {
    // Simplified client growth calculation
    // In practice, this would compare client counts across periods
    return 5.2; // Mock 5.2% growth
  }

  async initiatePayout(brokerId: string, payout: PayoutCalculation): Promise<boolean> {
    this.logger.log(`Initiating payout for broker ${brokerId}: R${payout.netPayout.toFixed(2)}`);

    try {
      const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
      if (!broker) {
        throw new Error(`Broker not found: ${brokerId}`);
      }

      // Process payout through payment gateway
      const payoutResult = await this.paymentGatewayService.processPayout({
        recipientId: brokerId,
        amount: payout.netPayout,
        currency: 'ZAR',
        reference: `BROKER-PAYOUT-${brokerId}-${payout.period.start.getFullYear()}-${payout.period.start.getMonth() + 1}`,
        description: `Monthly broker payout for ${broker.companyName}`,
        metadata: {
          brokerId,
          period: payout.period,
          transactionCount: payout.transactionCount,
          clientCount: payout.clientCount
        }
      });

      if (payoutResult.success) {
        // Update bill status
        await this.prisma.billrepository.update(
          { brokerId, period: payout.period.start },
          { status: BillStatus.PAID }
        );

        // Send notification
        await this.notificationService.sendBrokerPayoutConfirmation(brokerId, {
          amount: payout.netPayout,
          period: payout.period,
          transactionId: payoutResult.transactionId
        });

        this.logger.log(`Payout successfully processed for broker ${brokerId}`);
        return true;
      } else {
        this.logger.error(`Payout failed for broker ${brokerId}: ${payoutResult.error}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Failed to initiate payout for broker ${brokerId}:`, error);
      return false;
    }
  }

  async getBrokerPayoutHistory(brokerId: string, limit: number = 12): Promise<Array<{
    period: Date;
    amount: number;
    status: string;
    processedDate?: Date;
    transactionId?: string;
  }>> {
    const bills = await this.prisma.billrepository.findMany({
      where: { brokerId },
      order: { period: 'DESC' },
      take: limit
    });

    return bills.map(bill => ({
      period: bill.period,
      amount: bill.transactionFees, // This represents the platform share
      status: bill.status,
      processedDate: bill.updatedAt,
      transactionId: bill.paymentTransactionId
    }));
  }

  async getCommissionStructure(): Promise<CommissionStructure> {
    return this.commissionStructure;
  }

  async updateCommissionStructure(updates: Partial<CommissionStructure>): Promise<void> {
    // In a real implementation, this would update the configuration in the database
    this.logger.log('Commission structure updated:', updates);
  }

  async validatePayoutCalculation(payout: PayoutCalculation): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic arithmetic
    const calculatedTotal = payout.platformShare + payout.brokerShare;
    if (Math.abs(calculatedTotal - payout.totalRevenue) > 0.01) {
      errors.push('Platform and broker shares do not sum to total revenue');
    }

    // Validate ranges
    if (payout.totalRevenue < 0) {
      errors.push('Total revenue cannot be negative');
    }

    if (payout.netPayout < 0) {
      errors.push('Net payout cannot be negative');
    }

    // Warnings for unusual values
    if (payout.clientCount === 0 && payout.totalRevenue > 0) {
      warnings.push('Revenue generated without any clients');
    }

    if (payout.transactionCount === 0 && payout.totalRevenue > 0) {
      warnings.push('Revenue generated without any transactions');
    }

    if (payout.volumeDiscount > 0.15) {
      warnings.push('Volume discount exceeds 15%');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}
