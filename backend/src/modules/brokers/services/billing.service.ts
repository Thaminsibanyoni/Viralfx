import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { PaymentMethod, BrokerTier } from '../enums/broker.enum';
import { InitiatePaymentDto } from '../dto/payment.dto';
import { PaymentGatewayService } from "../../../modules/payment/services/payment-gateway.service";
import { NotificationService } from "../../../modules/notifications/services/notification.service";
import { InvoiceGeneratorService } from "../../../modules/billing/services/invoice-generator.service";
import { StorageService } from "../../../modules/storage/services/storage.service";

// Bill status enum to replace deleted entity
enum BillStatus {
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly currency: string;
  private readonly vatRate: number;
  private readonly gracePeriodDays: number;
  private readonly suspensionDays: number;

  constructor(
        private configService: ConfigService,
    private paymentGatewayService: PaymentGatewayService,
    private notificationService: NotificationService,
    private prismaService: PrismaService,
    private invoiceGeneratorService: InvoiceGeneratorService,
    private storageService: StorageService,
    @InjectQueue('broker-billing') private billingQueue: Queue) {
    this.currency = this.configService.get<string>('BILLING_CURRENCY', 'ZAR');
    this.vatRate = this.configService.get<number>('BILLING_VAT_RATE', 0.15);
    this.gracePeriodDays = this.configService.get<number>('BILLING_GRACE_PERIOD_DAYS', 7);
    this.suspensionDays = this.configService.get<number>('BILLING_SUSPENSION_DAYS', 30);
  }

  async generateMonthlyBill(brokerId: string, period: Date): Promise<any> {
    this.logger.log(`Generating monthly bill for broker ${brokerId} for period ${period}`);

    const broker = await this.prismaService.broker.findUnique({ where: { id: brokerId } });
    if (!broker) {
      throw new NotFoundException(`Broker not found: ${brokerId}`);
    }

    // Check if bill already exists for this period
    const periodStart = startOfMonth(period);
    const existingBill = await this.prismaService.brokerBill.findFirst({
      where: {
        brokerId,
        periodStart
      }
    });

    if (existingBill) {
      this.logger.log(`Bill already exists for broker ${brokerId} for period ${period}`);
      return existingBill;
    }

    // Calculate fees
    const baseFee = this.calculateBaseFee(broker.tier as BrokerTier);
    const transactionFees = await this.calculateTransactionFees(brokerId, period);
    const volumeDiscount = await this.calculateVolumeDiscount(brokerId, period);
    const additionalServices = await this.calculateAdditionalServices(brokerId, period);

    // Calculate totals
    const subtotal = baseFee + transactionFees + additionalServices - volumeDiscount;
    const vat = subtotal * this.vatRate;
    const total = subtotal + vat;

    // Create bill
    const bill = await this.prismaService.brokerBill.create({
      data: {
        brokerId,
        periodStart,
        periodEnd: endOfMonth(period),
        dueDate: addMonths(period, 1),
        baseFee,
        totalCommission: transactionFees,
        volumeDiscount,
        performanceBonus: additionalServices,
        tierMultiplier: 1,
        vatAmount: vat,
        totalAmount: total,
        status: BillStatus.PENDING,
        clientCount: 0,
        transactionCount: 0
      }
    });

    // Generate invoice URL
    const invoiceUrl = await this.generateInvoiceUrl(bill);
    await this.prismaService.brokerBill.update({
      where: { id: bill.id },
      data: {
        // Assuming there's an invoiceUrl field or we store it in volumeBreakdown
        volumeBreakdown: { invoiceUrl }
      }
    });

    // Send bill notification
    await this.sendBillNotification(bill.id);

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'GENERATE_BILL',
        entityType: 'BROKER_BILL',
        entityId: bill.id,
        oldValues: null,
        newValues: JSON.stringify({
          brokerId,
          period: period.toISOString(),
          total,
          status: BillStatus.PENDING
        }),
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });

    this.logger.log(`Generated bill ${bill.id} for broker ${brokerId}: R${total.toFixed(2)}`);
    return bill;
  }

  calculateBaseFee(tier: BrokerTier): number {
    const baseFees: Record<BrokerTier, number> = {
      [BrokerTier.STARTER]: 500, // R500/month
      [BrokerTier.VERIFIED]: 1500, // R1500/month
      [BrokerTier.PREMIUM]: 5000, // R5000/month
      [BrokerTier.ENTERPRISE]: 15000 // R15000/month
    };

    return baseFees[tier] || baseFees[BrokerTier.STARTER];
  }

  private async calculateTransactionFees(brokerId: string, period: Date): Promise<number> {
    // In a real implementation, this would query actual trading volume
    // For now, simulate transaction fees based on broker tier and estimated volume
    const broker = await this.prismaService.broker.findUnique({ where: { id: brokerId } });

    const estimatedVolumes: Record<BrokerTier, number> = {
      [BrokerTier.STARTER]: 100000, // R100k monthly volume
      [BrokerTier.VERIFIED]: 500000, // R500k monthly volume
      [BrokerTier.PREMIUM]: 2000000, // R2M monthly volume
      [BrokerTier.ENTERPRISE]: 10000000 // R10M monthly volume
    };

    const volume = estimatedVolumes[broker.tier as BrokerTier] || 0;
    const transactionFeeRate = 0.001; // 0.1% transaction fee
    return volume * transactionFeeRate;
  }

  private async calculateVolumeDiscount(brokerId: string, period: Date): Promise<number> {
    // Calculate discount based on trading volume
    const transactionFees = await this.calculateTransactionFees(brokerId, period);

    // Volume-based discount tiers
    if (transactionFees > 10000) {
      return transactionFees * 0.15; // 15% discount for high volume
    } else if (transactionFees > 5000) {
      return transactionFees * 0.10; // 10% discount for medium volume
    } else if (transactionFees > 1000) {
      return transactionFees * 0.05; // 5% discount for low volume
    }

    return 0; // No discount for very low volume
  }

  private async calculateAdditionalServices(brokerId: string, period: Date): Promise<number> {
    // In a real implementation, this would check for additional services used
    // For now, return 0 as no additional services are configured
    return 0;
  }

  async processBillPayment(billId: string, paymentDto: InitiatePaymentDto): Promise<any> {
    this.logger.log(`Processing payment for bill ${billId} via ${paymentDto.paymentMethod}`);

    const bill = await this.prismaService.brokerBill.findUnique({
      where: { id: billId },
      include: { broker: true }
    });

    if (!bill) {
      throw new NotFoundException(`Bill not found: ${billId}`);
    }

    if (bill.status !== BillStatus.PENDING && bill.status !== BillStatus.OVERDUE) {
      throw new BadRequestException(`Bill is not payable. Current status: ${bill.status}`);
    }

    try {
      const paymentResult = await this.paymentGatewayService.processPayment(
        paymentDto.paymentMethod.toLowerCase(),
        {
          amount: Number(bill.totalAmount),
          currency: this.currency,
          reference: `BILL-${bill.id}`,
          description: `ViralFX Broker Bill - ${format(bill.periodStart, 'MMMM yyyy')}`,
          customer: {
            email: broker.paymentInfo?.billingEmail || broker.contactEmail,
            name: broker.companyName
          },
          callbackUrl: paymentDto.callbackUrl,
          cancelUrl: paymentDto.cancelUrl,
          metadata: {
            billId: bill.id,
            brokerId: bill.brokerId,
            type: 'BROKER_BILL'
          }
        }
      );

      // Update bill with payment details
      await this.prismaService.brokerBill.update({
        where: { id: billId },
        data: {
          paymentMethod: paymentDto.paymentMethod,
          transactionId: paymentResult.reference,
          commissionBreakdown: {
            transactionId: paymentResult.transactionId,
            amount: Number(bill.totalAmount),
            currency: this.currency,
            status: 'INITIATED',
            metadata: paymentResult
          }
        }
      });

      this.logger.log(`Payment initiated for bill ${billId}: ${paymentResult.paymentUrl}`);
      return {
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        amount: Number(bill.totalAmount),
        currency: this.currency
      };
    } catch (error) {
      this.logger.error(`Failed to process payment for bill ${billId}:`, error);
      throw error;
    }
  }

  async handlePaymentWebhook(gateway: string, webhookData: any): Promise<void> {
    this.logger.log(`Handling payment webhook from ${gateway}`);

    try {
      // Verify webhook signature
      const isValid = await this.paymentGatewayService.verifyWebhook(gateway, webhookData);
      if (!isValid) {
        throw new Error('Invalid webhook signature');
      }

      const { reference, status, amount, transactionId } = webhookData;

      // Extract bill ID from reference
      const billId = reference.replace('BILL-', '');

      const bill = await this.prismaService.brokerBill.findUnique({
        where: { id: billId },
        include: { broker: true }
      });

      if (!bill) {
        this.logger.warn(`Bill not found for webhook reference: ${reference}`);
        return;
      }

      // Update bill status based on payment status
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        await this.prismaService.brokerBill.update({
          where: { id: billId },
          data: {
            status: BillStatus.PAID,
            paidAt: new Date(),
            commissionBreakdown: {
              ...bill.commissionBreakdown,
              status,
              transactionId
            }
          }
        });

        // Send payment confirmation
        await this.sendPaymentConfirmation(bill);

        // Log audit
        await this.prismaService.auditLog.create({
          data: {
            action: 'PAYMENT_CONFIRMED',
            entityType: 'BROKER_BILL',
            entityId: bill.id,
            oldValues: JSON.stringify({ status: BillStatus.PENDING }),
            newValues: JSON.stringify({ status: BillStatus.PAID, paidDate: new Date() }),
            userId: null,
            ipAddress: null,
            userAgent: null
          }
        });

        this.logger.log(`Payment confirmed for bill ${billId}`);
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        await this.prismaService.brokerBill.update({
          where: { id: billId },
          data: {
            status: BillStatus.PENDING,
            commissionBreakdown: {
              ...bill.commissionBreakdown,
              status,
              transactionId
            }
          }
        });

        this.logger.warn(`Payment failed for bill ${billId}: ${status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle payment webhook from ${gateway}:`, error);
      throw error;
    }
  }

  async sendBillNotification(billId: string): Promise<void> {
    const bill = await this.prismaService.brokerBill.findUnique({
      where: { id: billId },
      include: { broker: true }
    });

    if (!bill) {
      throw new NotFoundException(`Bill not found: ${billId}`);
    }

    await this.notificationService.sendBillNotification(bill.brokerId, {
      billId: bill.id,
      amount: Number(bill.totalAmount),
      dueDate: bill.dueDate,
      invoiceUrl: bill.volumeBreakdown?.invoiceUrl,
      companyName: bill.broker.companyName,
      billingEmail: bill.broker.paymentInfo?.billingEmail || bill.broker.contactEmail
    });
  }

  private async sendPaymentConfirmation(bill: any): Promise<void> {
    await this.notificationService.sendPaymentConfirmation(bill.brokerId, {
      billId: bill.id,
      amount: Number(bill.totalAmount),
      paidDate: bill.paidAt,
      transactionId: bill.commissionBreakdown?.transactionId,
      companyName: bill.broker.companyName,
      billingEmail: bill.broker.paymentInfo?.billingEmail || bill.broker.contactEmail
    });
  }

  private async generateInvoiceUrl(bill: any): Promise<string> {
    try {
      // Generate PDF invoice
      const pdfBuffer = await this.invoiceGeneratorService.generateInvoice(bill);

      // Upload to storage
      const invoiceUrl = await this.storageService.uploadFile(
        pdfBuffer,
        `invoices/${bill.id}.pdf`,
        { contentType: 'application/pdf' }
      );

      this.logger.log(`Invoice generated and uploaded for bill ${bill.id}`);
      return invoiceUrl;

    } catch (error) {
      this.logger.error(`Failed to generate invoice for bill ${bill.id}:`, error);
      throw new Error(`Invoice generation failed: ${error.message}`);
    }
  }

  async getBrokerBills(brokerId: string, options: { page?: number; limit?: number; status?: string } = {}) {
    const { page = 1, limit = 10, status } = options;

    const where: any = { brokerId };
    if (status) {
      where.status = status;
    }

    const [bills, total] = await Promise.all([
      this.prismaService.brokerBill.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prismaService.brokerBill.count({ where })
    ]);

    return {
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getBill(billId: string): Promise<any> {
    const bill = await this.prismaService.brokerBill.findUnique({
      where: { id: billId },
      include: { broker: true }
    });

    if (!bill) {
      throw new NotFoundException(`Bill not found: ${billId}`);
    }

    return bill;
  }

  async checkOverdueBills(): Promise<void> {
    this.logger.log('Checking for overdue bills');

    const now = new Date();
    const overdueBills = await this.prismaService.brokerBill.findMany({
      where: {
        status: BillStatus.PENDING,
        dueDate: {
          lt: now
        }
      },
      include: {
        broker: true
      }
    });

    for (const bill of overdueBills) {
      const daysOverdue = Math.floor((now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > this.suspensionDays) {
        // Suspend broker for bills overdue > suspensionDays
        await this.suspendBrokerForOverdueBill(bill.brokerId);
        await this.prismaService.brokerBill.update({
          where: { id: bill.id },
          data: {
            status: BillStatus.OVERDUE
          }
        });

        this.logger.warn(`Broker ${bill.brokerId} suspended for overdue bill ${bill.id}`);
      } else if (daysOverdue > this.gracePeriodDays) {
        // Mark as overdue and send reminder
        await this.prismaService.brokerBill.update({
          where: { id: bill.id },
          data: {
            status: BillStatus.OVERDUE
          }
        });

        await this.sendOverdueReminder(bill);
        this.logger.warn(`Bill ${bill.id} marked as overdue, ${daysOverdue} days past due`);
      }
    }
  }

  private async suspendBrokerForOverdueBill(brokerId: string): Promise<void> {
    const broker = await this.prismaService.broker.findUnique({ where: { id: brokerId } });
    if (!broker) return;

    await this.prismaService.broker.update({
      where: { id: brokerId },
      data: {
        isActive: false,
        status: 'SUSPENDED'
      }
    });

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'SUSPEND_BROKER',
        entityType: 'BROKER',
        entityId: brokerId,
        oldValues: JSON.stringify({ isActive: true, status: 'ACTIVE' }),
        newValues: JSON.stringify({ isActive: false, status: 'SUSPENDED' }),
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });
  }

  private async sendOverdueReminder(bill: any): Promise<void> {
    await this.notificationService.sendComplianceAlert(bill.brokerId, {
      id: bill.id,
      brokerId: bill.brokerId,
      type: 'OVERDUE_BILL',
      severity: 'HIGH',
      message: `Your bill of R${Number(bill.totalAmount).toFixed(2)} is overdue. Please make payment to avoid service suspension.`,
      details: {
        billId: bill.id,
        amount: Number(bill.totalAmount),
        dueDate: bill.dueDate,
        daysOverdue: Math.floor((new Date().getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24))
      },
      recommendations: ['Pay outstanding amount immediately', 'Update payment method if needed'],
      createdAt: new Date(),
      status: 'OPEN'
    });
  }
}
