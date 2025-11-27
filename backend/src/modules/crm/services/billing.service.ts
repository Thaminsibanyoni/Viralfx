import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceItem } from '../entities/invoice-item.entity';
import { InvoicePayment } from '../entities/invoice-payment.entity';
import { BrokerSubscription } from '../entities/broker-subscription.entity';
import { BrokerInvoice } from '../entities/broker-invoice.entity';
import { BrokerPayment } from '../entities/broker-payment.entity';
import { ApiUsageRecord } from '../../api-marketplace/entities/api-usage-record.entity';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { ProcessPaymentDto } from '../dto/process-payment.dto';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { User } from '../../users/entities/user.entity';
import { PaymentRequest, PaymentResponse } from '../interfaces/payment-provider.interface';
import { PaystackProvider } from '../providers/paystack.provider';
import { PayFastProvider } from '../providers/payfast.provider';
import { EFTProvider } from '../providers/eft.provider';
import { OzowProvider } from '../providers/ozow.provider';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(InvoicePayment)
    private invoicePaymentRepository: Repository<InvoicePayment>,
    @InjectRepository(BrokerSubscription)
    private brokerSubscriptionRepository: Repository<BrokerSubscription>,
    @InjectRepository(BrokerInvoice)
    private brokerInvoiceRepository: Repository<BrokerInvoice>,
    @InjectRepository(BrokerPayment)
    private brokerPaymentRepository: Repository<BrokerPayment>,
    @InjectRepository(ApiUsageRecord)
    private apiUsageRecordRepository: Repository<ApiUsageRecord>,
    private dataSource: DataSource,
    private paystackProvider: PaystackProvider,
    private payfastProvider: PayFastProvider,
    private eftProvider: EFTProvider,
    private ozowProvider: OzowProvider,
  ) {}

  async createInvoice(createDto: CreateInvoiceDto): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = this.invoiceRepository.create({
      ...createDto,
      invoiceNumber,
    });

    return await this.invoiceRepository.save(invoice);
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['items', 'payments'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async getInvoices(filters: {
    customerId?: string;
    customerType?: string;
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: Invoice[]; total: number }> {
    const {
      customerId,
      customerType,
      type,
      status,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (customerType) where.customerType = customerType;
    if (type) where.type = type;
    if (status) where.status = status;

    const [invoices, total] = await this.invoiceRepository.findAndCount({
      where,
      relations: ['items', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { invoices, total };
  }

  async generateBrokerMonthlyInvoices(brokerId?: string): Promise<BrokerInvoice[]> {
    // Get brokers with active subscriptions
    const queryBuilder = this.brokerSubscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.broker', 'broker')
      .leftJoinAndSelect('subscription.brokerAccount', 'account')
      .where('subscription.status = :status', { status: 'ACTIVE' });

    if (brokerId) {
      queryBuilder.andWhere('subscription.brokerId = :brokerId', { brokerId });
    }

    const subscriptions = await queryBuilder.getMany();
    const generatedInvoices: BrokerInvoice[] = [];

    for (const subscription of subscriptions) {
      const invoice = await this.generateBrokerSubscriptionInvoice(subscription);
      if (invoice) {
        generatedInvoices.push(invoice);
      }
    }

    return generatedInvoices;
  }

  async generateBrokerSubscriptionInvoice(
    subscription: BrokerSubscription,
  ): Promise<BrokerInvoice | null> {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    // Check if invoice already exists for this period
    const existingInvoice = await this.brokerInvoiceRepository.findOne({
      where: {
        brokerId: subscription.brokerId,
        periodStart,
        periodEnd,
      },
    });

    if (existingInvoice) {
      return null;
    }

    // Calculate amounts
    let subscriptionFee = subscription.price;
    let apiUsageFee = 0;
    let transactionFee = 0;
    let overageFee = 0;

    // Get API usage for the period
    const apiUsageResult = await this.apiUsageRecordRepository
      .createQueryBuilder('usage')
      .select('SUM(usage.cost)', 'totalCost')
      .where('usage.subscriptionId = :subscriptionId', { subscriptionId: subscription.id })
      .andWhere('usage.createdAt BETWEEN :periodStart AND :periodEnd', {
        periodStart,
        periodEnd,
      })
      .getRawOne();

    if (apiUsageResult && apiUsageResult.totalCost) {
      apiUsageFee = parseFloat(apiUsageResult.totalCost);
    }

    // Check for overages
    if (subscription.apiCallsLimit && subscription.apiCallsUsed > subscription.apiCallsLimit) {
      const overageCalls = subscription.apiCallsUsed - subscription.apiCallsLimit;
      overageFee = overageCalls * 0.001; // $0.001 per overage call
    }

    // Calculate subtotal and tax (assuming 15% VAT)
    const subtotal = subscriptionFee + apiUsageFee + transactionFee + overageFee;
    const vatAmount = subtotal * 0.15;
    const totalAmount = subtotal + vatAmount;

    const invoiceNumber = await this.generateBrokerInvoiceNumber();

    const invoice = this.brokerInvoiceRepository.create({
      brokerId: subscription.brokerId,
      brokerAccountId: subscription.brokerAccountId,
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      periodStart,
      periodEnd,
      subscriptionFee,
      apiUsageFee,
      transactionFee,
      overageFee,
      vatAmount,
      totalAmount,
      status: 'DRAFT',
    });

    const savedInvoice = await this.brokerInvoiceRepository.save(invoice);

    // Create invoice items
    await this.createBrokerInvoiceItems(savedInvoice, subscription, {
      subscriptionFee,
      apiUsageFee,
      transactionFee,
      overageFee,
    });

    return savedInvoice;
  }

  async processPayment(paymentDto: ProcessPaymentDto): Promise<InvoicePayment> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: paymentDto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const payment = this.invoicePaymentRepository.create({
      ...paymentDto,
      status: 'PENDING',
    });

    return await this.invoicePaymentRepository.save(payment);
  }

  // Real payment integration methods
  async initiateBrokerPayment(invoiceId: string, provider: string, returnUrl: string, cancelUrl: string): Promise<PaymentResponse> {
    const invoice = await this.brokerInvoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['brokerAccount', 'brokerAccount.broker'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const paymentRequest: PaymentRequest = {
      customerEmail: invoice.brokerAccount?.broker?.email || 'customer@example.com',
      customerName: invoice.brokerAccount?.broker?.companyName || 'Customer',
      amount: invoice.totalAmount,
      currency: 'ZAR',
      reference: invoice.invoiceNumber,
      invoiceId: invoice.id,
      brokerId: invoice.brokerId,
      callbackUrl: returnUrl,
      cancelUrl,
      webhookUrl: `${process.env.API_BASE_URL}/api/v1/crm/payments/webhook/${provider.toLowerCase()}`,
    };

    const paymentProvider = this.getPaymentProvider(provider);
    return await paymentProvider.createPayment(paymentRequest);
  }

  private getPaymentProvider(provider: string) {
    switch (provider.toLowerCase()) {
      case 'paystack':
        return this.paystackProvider;
      case 'payfast':
        return this.payfastProvider;
      case 'eft':
        return this.eftProvider;
      case 'ozow':
        return this.ozowProvider;
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }

  async getAvailablePaymentProviders(): Promise<any[]> {
    return [
      {
        name: 'paystack',
        displayName: 'Paystack',
        description: 'Pay with card, bank transfer, or USSD',
        currencies: this.paystackProvider.getSupportedCurrencies(),
        icon: '/assets/payment-providers/paystack.png',
      },
      {
        name: 'payfast',
        displayName: 'PayFast',
        description: 'Pay with card, EFT, or instant EFT',
        currencies: this.payfastProvider.getSupportedCurrencies(),
        icon: '/assets/payment-providers/payfast.png',
      },
      {
        name: 'eft',
        displayName: 'EFT Bank Transfer',
        description: 'Direct bank transfer from all major South African banks',
        currencies: this.eftProvider.getSupportedCurrencies(),
        banks: this.eftProvider.getSupportedBanks(),
        icon: '/assets/payment-providers/eft.png',
      },
      {
        name: 'ozow',
        displayName: 'Ozow',
        description: 'Instant EFT payment solution',
        currencies: this.ozowProvider.getSupportedCurrencies(),
        banks: this.ozowProvider.getSupportedBanks(),
        icon: '/assets/payment-providers/ozow.png',
      },
    ];
  }

  async getPaymentHistory(invoiceId: string): Promise<InvoicePayment[]> {
    return await this.invoicePaymentRepository.find({
      where: { invoiceId },
      order: { createdAt: 'DESC' },
    });
  }

  async getOverdueInvoices(): Promise<Invoice[]> {
    const now = new Date();
    return await this.invoiceRepository.find({
      where: {
        dueDate: { lt: now },
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
      },
      relations: ['items'],
    });
  }

  async getBillingMetrics(dateRange?: { start: Date; end: Date }): Promise<any> {
    const whereClause: any = {};
    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      };
    }

    const [
      totalInvoices,
      totalRevenue,
      paidInvoices,
      overdueInvoices,
      avgInvoiceValue,
    ] = await Promise.all([
      this.invoiceRepository.count({ where: whereClause }),
      this.invoiceRepository.sum('totalAmount', { where: whereClause }),
      this.invoiceRepository.count({ where: { ...whereClause, status: 'PAID' } }),
      this.getOverdueInvoices(),
      this.getAverageInvoiceValue(whereClause),
    ]);

    return {
      totalInvoices,
      totalRevenue: totalRevenue || 0,
      paidInvoices,
      overdueInvoices: overdueInvoices.length,
      averageInvoiceValue: avgInvoiceValue || 0,
      collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
    };
  }

  private async createBrokerInvoiceItems(
    invoice: BrokerInvoice,
    subscription: BrokerSubscription,
    amounts: {
      subscriptionFee: number;
      apiUsageFee: number;
      transactionFee: number;
      overageFee: number;
    },
  ): Promise<void> {
    const items = [];

    if (amounts.subscriptionFee > 0) {
      items.push({
        invoiceId: invoice.id,
        description: `${subscription.tier} Subscription - ${subscription.planType}`,
        quantity: 1,
        unitPrice: amounts.subscriptionFee,
        total: amounts.subscriptionFee,
        itemType: 'SUBSCRIPTION',
        referenceId: subscription.id,
        referenceType: 'SUBSCRIPTION',
      });
    }

    if (amounts.apiUsageFee > 0) {
      items.push({
        invoiceId: invoice.id,
        description: 'API Usage Charges',
        quantity: 1,
        unitPrice: amounts.apiUsageFee,
        total: amounts.apiUsageFee,
        itemType: 'API_USAGE',
        referenceId: subscription.id,
        referenceType: 'SUBSCRIPTION',
      });
    }

    if (amounts.overageFee > 0) {
      items.push({
        invoiceId: invoice.id,
        description: 'API Usage Overage Charges',
        quantity: 1,
        unitPrice: amounts.overageFee,
        total: amounts.overageFee,
        itemType: 'OVERAGE',
        referenceId: subscription.id,
        referenceType: 'SUBSCRIPTION',
      });
    }

    if (items.length > 0) {
      await this.invoiceItemRepository.save(items);
    }
  }

  
  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const count = await this.invoiceRepository.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1),
        },
      },
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private async generateBrokerInvoiceNumber(): Promise<string> {
    const prefix = 'BRK';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const count = await this.brokerInvoiceRepository.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1),
        },
      },
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private async getAverageInvoiceValue(whereClause: any): Promise<number> {
    const result = await this.invoiceRepository
      .createQueryBuilder('invoice')
      .select('AVG(invoice.totalAmount)', 'average')
      .where(whereClause)
      .getRawOne();

    return result?.average ? parseFloat(result.average) : 0;
  }

  // Methods expected by BillingController
  async generateInvoice(generateDto: GenerateInvoiceDto): Promise<BrokerInvoice> {
    const invoiceNumber = await this.generateBrokerInvoiceNumber();

    const invoice = this.brokerInvoiceRepository.create({
      ...generateDto,
      invoiceNumber,
      status: 'DRAFT',
      issueDate: new Date(),
    });

    return await this.brokerInvoiceRepository.save(invoice);
  }

  async getInvoiceById(invoiceId: string, user: User): Promise<BrokerInvoice> {
    const invoice = await this.brokerInvoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['brokerAccount', 'payments', 'items'],
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check access permissions
    if (user.role === 'BROKER' && invoice.brokerId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    return invoice;
  }

  async generateInvoicePDF(invoiceId: string, user: User): Promise<Buffer> {
    const invoice = await this.getInvoiceById(invoiceId, user);

    // For now, return a dummy PDF buffer
    // In production, use a PDF library like PDFKit or Puppeteer
    const pdfContent = `Invoice: ${invoice.invoiceNumber}\nAmount: ${invoice.totalAmount}`;
    return Buffer.from(pdfContent);
  }

  async sendInvoice(invoiceId: string, user: User): Promise<any> {
    const invoice = await this.getInvoiceById(invoiceId, user);

    // For now, simulate email sending
    // In production, integrate with email service
    return {
      sent: true,
      sentAt: new Date(),
      recipient: invoice.brokerAccount?.broker?.email,
    };
  }

  async recordPayment(recordDto: RecordPaymentDto): Promise<BrokerPayment> {
    const invoice = await this.brokerInvoiceRepository.findOne({
      where: { id: recordDto.invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const payment = this.brokerPaymentRepository.create({
      ...recordDto,
      status: 'COMPLETED',
      completedAt: new Date(),
    });

    const savedPayment = await this.brokerPaymentRepository.save(payment);

    // Update invoice status
    const totalPaid = await this.brokerPaymentRepository.sum('amount', {
      where: { invoiceId: recordDto.invoiceId, status: 'COMPLETED' },
    });

    if (totalPaid >= invoice.totalAmount) {
      invoice.status = 'PAID';
      invoice.paidAt = new Date();
    } else {
      invoice.status = 'PARTIALLY_PAID';
    }

    await this.brokerInvoiceRepository.save(invoice);

    return savedPayment;
  }

  async getPayments(filters: {
    brokerId?: string;
    invoiceId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ payments: BrokerPayment[]; page: number; limit: number; total: number }> {
    const {
      brokerId,
      invoiceId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = filters;

    const queryBuilder = this.brokerPaymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.invoice', 'invoice')
      .leftJoinAndSelect('payment.broker', 'broker');

    if (brokerId) {
      queryBuilder.andWhere('payment.brokerId = :brokerId', { brokerId });
    }
    if (invoiceId) {
      queryBuilder.andWhere('payment.invoiceId = :invoiceId', { invoiceId });
    }
    if (startDate) {
      queryBuilder.andWhere('payment.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('payment.createdAt <= :endDate', { endDate });
    }

    const [payments, total] = await queryBuilder
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      payments,
      page,
      limit,
      total,
    };
  }

  async getBrokerBillingSummary(brokerId: string, user: User): Promise<any> {
    // Check permissions
    if (user.role === 'BROKER' && brokerId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const [
      totalInvoices,
      paidInvoices,
      overdueInvoices,
      totalBilled,
      totalPaid,
      outstandingBalance,
    ] = await Promise.all([
      this.brokerInvoiceRepository.count({ where: { brokerId } }),
      this.brokerInvoiceRepository.count({ where: { brokerId, status: 'PAID' } }),
      this.getOverdueBrokerInvoicesCount(brokerId),
      this.brokerInvoiceRepository.sum('totalAmount', { where: { brokerId } }),
      this.brokerPaymentRepository.sum('amount', {
        where: { brokerId, status: 'COMPLETED' }
      }),
      this.brokerInvoiceRepository.sum('totalAmount', {
        where: { brokerId, status: 'SENT' }
      }),
    ]);

    return {
      totalInvoices: totalInvoices || 0,
      paidInvoices: paidInvoices || 0,
      overdueInvoices: overdueInvoices || 0,
      totalBilled: totalBilled || 0,
      totalPaid: totalPaid || 0,
      outstandingBalance: outstandingBalance || 0,
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0,
    };
  }

  async getRevenueAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: string;
  }): Promise<any> {
    const { startDate, endDate, groupBy = 'month' } = filters;

    const queryBuilder = this.brokerInvoiceRepository
      .createQueryBuilder('invoice')
      .select([
        `DATE_TRUNC('${groupBy}', invoice.createdAt) as period`,
        'COUNT(*)::int as invoiceCount',
        'SUM(invoice.totalAmount) as revenue',
        'SUM(CASE WHEN invoice.status = :paid THEN invoice.totalAmount ELSE 0 END) as paidRevenue',
      ])
      .setParameter('paid', 'PAID');

    if (startDate) {
      queryBuilder.andWhere('invoice.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('invoice.createdAt <= :endDate', { endDate });
    }

    queryBuilder.groupBy(`DATE_TRUNC('${groupBy}', invoice.createdAt)`);
    queryBuilder.orderBy('period', 'ASC');

    return await queryBuilder.getRawMany();
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<BrokerInvoice> {
    const invoice = await this.brokerInvoiceRepository.findOne({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot void paid invoice');
    }

    invoice.status = 'VOID';
    invoice.notes = reason;

    return await this.brokerInvoiceRepository.save(invoice);
  }

  async getOverdueInvoices(filters: {
    daysOverdue?: number;
    page?: number;
    limit?: number;
  }): Promise<{ invoices: BrokerInvoice[]; page: number; limit: number; total: number }> {
    const { daysOverdue = 30, page = 1, limit = 10 } = filters;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const queryBuilder = this.brokerInvoiceRepository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.brokerAccount', 'brokerAccount')
      .leftJoinAndSelect('invoice.broker', 'broker')
      .where('invoice.dueDate < :now', { now: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['SENT', 'PARTIALLY_PAID']
      })
      .andWhere('invoice.dueDate <= :cutoffDate', { cutoffDate });

    const [invoices, total] = await queryBuilder
      .orderBy('invoice.dueDate', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      invoices,
      page,
      limit,
      total,
    };
  }

  private async getOverdueBrokerInvoicesCount(brokerId: string): Promise<number> {
    const queryBuilder = this.brokerInvoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.brokerId = :brokerId', { brokerId })
      .andWhere('invoice.dueDate < :now', { now: new Date() })
      .andWhere('invoice.status IN (:...statuses)', {
        statuses: ['SENT', 'PARTIALLY_PAID']
      });

    return await queryBuilder.getCount();
  }
}