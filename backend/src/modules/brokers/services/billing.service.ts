import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { format, addMonths, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { BrokerBill, BillStatus, PaymentMethod } from '../entities/broker-bill.entity';
import { Broker, BrokerTier } from '../entities/broker.entity';
import { InitiatePaymentDto } from '../dto/payment.dto';
import { PaymentGatewayService } from '../../../modules/payment/services/payment-gateway.service';
import { NotificationService } from '../../../modules/notifications/services/notification.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoiceGeneratorService } from '../../billing/services/invoice-generator.service';
import { StorageService } from '../../../modules/storage/services/storage.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly currency: string;
  private readonly vatRate: number;
  private readonly gracePeriodDays: number;
  private readonly suspensionDays: number;

  constructor(
    @InjectRepository(BrokerBill)
    private billRepository: Repository<BrokerBill>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    private configService: ConfigService,
    private paymentGatewayService: PaymentGatewayService,
    private notificationService: NotificationService,
    private prismaService: PrismaService,
    private invoiceGeneratorService: InvoiceGeneratorService,
    private storageService: StorageService,
    @InjectQueue('broker-billing') private billingQueue: Queue,
  ) {
    this.currency = this.configService.get<string>('BILLING_CURRENCY', 'ZAR');
    this.vatRate = this.configService.get<number>('BILLING_VAT_RATE', 0.15);
    this.gracePeriodDays = this.configService.get<number>('BILLING_GRACE_PERIOD_DAYS', 7);
    this.suspensionDays = this.configService.get<number>('BILLING_SUSPENSION_DAYS', 30);
  }

  async generateMonthlyBill(brokerId: string, period: Date): Promise<BrokerBill> {
    this.logger.log(`Generating monthly bill for broker ${brokerId} for period ${period}`);

    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new NotFoundException(`Broker not found: ${brokerId}`);
    }

    // Check if bill already exists for this period
    const existingBill = await this.billRepository.findOne({
      where: {
        brokerId,
        period: startOfMonth(period),
      },
    });

    if (existingBill) {
      this.logger.log(`Bill already exists for broker ${brokerId} for period ${period}`);
      return existingBill;
    }

    // Calculate fees
    const baseFee = this.calculateBaseFee(broker.tier);
    const transactionFees = await this.calculateTransactionFees(brokerId, period);
    const volumeDiscount = await this.calculateVolumeDiscount(brokerId, period);
    const additionalServices = await this.calculateAdditionalServices(brokerId, period);

    // Calculate totals
    const subtotal = baseFee + transactionFees + additionalServices - volumeDiscount;
    const vat = subtotal * this.vatRate;
    const total = subtotal + vat;

    // Create bill
    const bill = this.billRepository.create({
      brokerId,
      period: startOfMonth(period),
      baseFee,
      transactionFees,
      volumeDiscount,
      additionalServices,
      subtotal,
      vat,
      total,
      status: BillStatus.PENDING,
      dueDate: addMonths(period, 1),
    });

    const savedBill = await this.billRepository.save(bill);

    // Generate invoice URL
    const invoiceUrl = await this.generateInvoiceUrl(savedBill);
    savedBill.invoiceUrl = invoiceUrl;
    await this.billRepository.save(savedBill);

    // Send bill notification
    await this.sendBillNotification(savedBill.id);

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'GENERATE_BILL',
        entityType: 'BROKER_BILL',
        entityId: savedBill.id,
        oldValues: null,
        newValues: JSON.stringify({
          brokerId,
          period: period.toISOString(),
          total,
          status: BillStatus.PENDING,
        }),
        userId: null,
        ipAddress: null,
        userAgent: null,
      },
    });

    this.logger.log(`Generated bill ${savedBill.id} for broker ${brokerId}: R${total.toFixed(2)}`);
    return savedBill;
  }

  calculateBaseFee(tier: BrokerTier): number {
    const baseFees = {
      [BrokerTier.STARTER]: 500, // R500/month
      [BrokerTier.VERIFIED]: 1500, // R1500/month
      [BrokerTier.PREMIUM]: 5000, // R5000/month
      [BrokerTier.ENTERPRISE]: 15000, // R15000/month
    };

    return baseFees[tier] || baseFees[BrokerTier.STARTER];
  }

  private async calculateTransactionFees(brokerId: string, period: Date): Promise<number> {
    // In a real implementation, this would query actual trading volume
    // For now, simulate transaction fees based on broker tier and estimated volume
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });

    const estimatedVolumes = {
      [BrokerTier.STARTER]: 100000, // R100k monthly volume
      [BrokerTier.VERIFIED]: 500000, // R500k monthly volume
      [BrokerTier.PREMIUM]: 2000000, // R2M monthly volume
      [BrokerTier.ENTERPRISE]: 10000000, // R10M monthly volume
    };

    const volume = estimatedVolumes[broker.tier] || 0;
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

    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['broker'],
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
          amount: bill.total,
          currency: this.currency,
          reference: `BILL-${bill.id}`,
          description: `ViralFX Broker Bill - ${format(bill.period, 'MMMM yyyy')}`,
          customer: {
            email: bill.broker.paymentInfo.billingEmail || bill.broker.contactEmail,
            name: bill.broker.companyName,
          },
          callbackUrl: paymentDto.callbackUrl,
          cancelUrl: paymentDto.cancelUrl,
          metadata: {
            billId: bill.id,
            brokerId: bill.brokerId,
            type: 'BROKER_BILL',
          },
        }
      );

      // Update bill with payment details
      bill.paymentMethod = paymentDto.paymentMethod;
      bill.paymentGateway = paymentDto.paymentMethod;
      bill.paymentReference = paymentResult.reference;
      bill.paymentDetails = {
        transactionId: paymentResult.transactionId,
        amount: bill.total,
        currency: this.currency,
        status: 'INITIATED',
        metadata: paymentResult,
      };

      await this.billRepository.save(bill);

      this.logger.log(`Payment initiated for bill ${billId}: ${paymentResult.paymentUrl}`);
      return {
        paymentUrl: paymentResult.paymentUrl,
        reference: paymentResult.reference,
        amount: bill.total,
        currency: this.currency,
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

      const bill = await this.billRepository.findOne({
        where: { id: billId },
        relations: ['broker'],
      });

      if (!bill) {
        this.logger.warn(`Bill not found for webhook reference: ${reference}`);
        return;
      }

      // Update bill status based on payment status
      if (status === 'SUCCESS' || status === 'COMPLETED') {
        bill.status = BillStatus.PAID;
        bill.paidDate = new Date();
        bill.paymentDetails = {
          ...bill.paymentDetails,
          status,
          transactionId,
        };

        // Send payment confirmation
        await this.sendPaymentConfirmation(bill);

        // Log audit
        await this.prismaService.auditLog.create({
          data: {
            action: 'PAYMENT_CONFIRMED',
            entityType: 'BROKER_BILL',
            entityId: bill.id,
            oldValues: JSON.stringify({ status: BillStatus.PENDING }),
            newValues: JSON.stringify({ status: BillStatus.PAID, paidDate: bill.paidDate }),
            userId: null,
            ipAddress: null,
            userAgent: null,
          },
        });

        this.logger.log(`Payment confirmed for bill ${billId}`);
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        bill.status = BillStatus.PENDING;
        bill.paymentDetails = {
          ...bill.paymentDetails,
          status,
          transactionId,
        };

        this.logger.warn(`Payment failed for bill ${billId}: ${status}`);
      }

      await this.billRepository.save(bill);
    } catch (error) {
      this.logger.error(`Failed to handle payment webhook from ${gateway}:`, error);
      throw error;
    }
  }

  async sendBillNotification(billId: string): Promise<void> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['broker'],
    });

    if (!bill) {
      throw new NotFoundException(`Bill not found: ${billId}`);
    }

    await this.notificationService.sendBillNotification(bill.brokerId, {
      billId: bill.id,
      amount: bill.total,
      dueDate: bill.dueDate,
      invoiceUrl: bill.invoiceUrl,
      companyName: bill.broker.companyName,
      billingEmail: bill.broker.paymentInfo.billingEmail || bill.broker.contactEmail,
    });
  }

  private async sendPaymentConfirmation(bill: BrokerBill): Promise<void> {
    await this.notificationService.sendPaymentConfirmation(bill.brokerId, {
      billId: bill.id,
      amount: bill.total,
      paidDate: bill.paidDate,
      transactionId: bill.paymentDetails?.transactionId,
      companyName: bill.broker.companyName,
      billingEmail: bill.broker.paymentInfo.billingEmail || bill.broker.contactEmail,
    });
  }

  private async generateInvoiceUrl(bill: BrokerBill): Promise<string> {
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

  async getBrokerBills(brokerId: string, options: { page?: number; limit?: number; status?: BillStatus } = {}) {
    const { page = 1, limit = 10, status } = options;

    const queryBuilder = this.billRepository.createQueryBuilder('bill')
      .where('bill.brokerId = :brokerId', { brokerId })
      .orderBy('bill.createdAt', 'DESC');

    if (status) {
      queryBuilder.andWhere('bill.status = :status', { status });
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [bills, total] = await queryBuilder.getManyAndCount();

    return {
      bills,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getBill(billId: string): Promise<BrokerBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['broker'],
    });

    if (!bill) {
      throw new NotFoundException(`Bill not found: ${billId}`);
    }

    return bill;
  }

  async checkOverdueBills(): Promise<void> {
    this.logger.log('Checking for overdue bills');

    const now = new Date();
    const overdueBills = await this.billRepository
      .createQueryBuilder('bill')
      .where('bill.status = :status', { status: BillStatus.PENDING })
      .andWhere('bill.dueDate < :now', { now })
      .getMany();

    for (const bill of overdueBills) {
      const daysOverdue = Math.floor((now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > this.suspensionDays) {
        // Suspend broker for bills overdue > suspensionDays
        await this.suspendBrokerForOverdueBill(bill.brokerId);
        bill.status = BillStatus.OVERDUE;
        await this.billRepository.save(bill);

        this.logger.warn(`Broker ${bill.brokerId} suspended for overdue bill ${bill.id}`);
      } else if (daysOverdue > this.gracePeriodDays) {
        // Mark as overdue and send reminder
        bill.status = BillStatus.OVERDUE;
        await this.billRepository.save(bill);

        await this.sendOverdueReminder(bill);
        this.logger.warn(`Bill ${bill.id} marked as overdue, ${daysOverdue} days past due`);
      }
    }
  }

  private async suspendBrokerForOverdueBill(brokerId: string): Promise<void> {
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) return;

    broker.isActive = false;
    broker.status = 'SUSPENDED';
    await this.brokerRepository.save(broker);

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
        userAgent: null,
      },
    });
  }

  private async sendOverdueReminder(bill: BrokerBill): Promise<void> {
    await this.notificationService.sendComplianceAlert(bill.brokerId, {
      id: bill.id,
      brokerId: bill.brokerId,
      type: 'OVERDUE_BILL',
      severity: 'HIGH',
      message: `Your bill of R${bill.total.toFixed(2)} is overdue. Please make payment to avoid service suspension.`,
      details: {
        billId: bill.id,
        amount: bill.total,
        dueDate: bill.dueDate,
        daysOverdue: Math.floor((new Date().getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      },
      recommendations: ['Pay outstanding amount immediately', 'Update payment method if needed'],
      createdAt: new Date(),
      status: 'OPEN',
    });
  }
}