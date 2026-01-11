import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { User } from "../../../common/enums/user-role.enum";
import { PaymentRequest, PaymentResponse } from '../interfaces/payment-provider.interface';
import { PaystackProvider } from '../providers/paystack.provider';
import { PayFastProvider } from '../providers/payfast.provider';
import { EFTProvider } from '../providers/eft.provider';
import { OzowProvider } from '../providers/ozow.provider';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private paystackProvider: PaystackProvider,
    private payfastProvider: PayFastProvider,
    private eftProvider: EFTProvider,
    private ozowProvider: OzowProvider) {}

  async createInvoice(createDto: any) {
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.prisma.invoice.create({
      data: {
        ...createDto,
        invoiceNumber
      }
    });

    return invoice;
  }

  async getInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        payments: true
      }
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
  }) {
    const {
      customerId,
      customerType,
      type,
      status,
      page = 1,
      limit = 20
    } = filters;

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (customerType) where.customerType = customerType;
    if (type) where.type = type;
    if (status) where.status = status;

    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: {
          items: true,
          payments: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.invoice.count({ where })
    ]);

    return { invoices, total };
  }

  async generateBrokerMonthlyInvoices(brokerId?: string) {
    // Get brokers with active subscriptions
    const subscriptions = await this.prisma.brokerSubscription.findMany({
      where: {
        ...(brokerId && { brokerId }),
        status: 'ACTIVE'
      },
      include: {
        broker: true,
        brokerAccount: true
      }
    });

    const generatedInvoices = [];

    for (const subscription of subscriptions) {
      const invoice = await this.generateBrokerSubscriptionInvoice(subscription);
      if (invoice) {
        generatedInvoices.push(invoice);
      }
    }

    return generatedInvoices;
  }

  async generateBrokerSubscriptionInvoice(subscription: any) {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    // Check if invoice already exists for this period
    const existingInvoice = await this.prisma.brokerInvoice.findFirst({
      where: {
        brokerId: subscription.brokerId,
        periodStart,
        periodEnd
      }
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
    const apiUsageResult = await this.prisma.apiUsageRecord.aggregate({
      where: {
        subscriptionId: subscription.id,
        createdAt: {
          gte: periodStart,
          lte: periodEnd
        }
      },
      _sum: {
        cost: true
      }
    });

    if (apiUsageResult._sum.cost) {
      apiUsageFee = apiUsageResult._sum.cost;
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

    const invoice = await this.prisma.brokerInvoice.create({
      data: {
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
        status: 'DRAFT'
      }
    });

    // Create invoice items
    await this.createBrokerInvoiceItems(invoice, subscription, {
      subscriptionFee,
      apiUsageFee,
      transactionFee,
      overageFee
    });

    return invoice;
  }

  async processPayment(paymentDto: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: paymentDto.invoiceId }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const payment = await this.prisma.invoicePayment.create({
      data: {
        ...paymentDto,
        status: 'PENDING'
      }
    });

    return payment;
  }

  // Real payment integration methods
  async initiateBrokerPayment(invoiceId: string, provider: string, returnUrl: string, cancelUrl: string): Promise<PaymentResponse> {
    const invoice = await this.prisma.brokerInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        brokerAccount: {
          include: {
            broker: true
          }
        }
      }
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
      webhookUrl: `${process.env.API_BASE_URL}/api/v1/crm/payments/webhook/${provider.toLowerCase()}`
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
        icon: '/assets/payment-providers/paystack.png'
      },
      {
        name: 'payfast',
        displayName: 'PayFast',
        description: 'Pay with card, EFT, or instant EFT',
        currencies: this.payfastProvider.getSupportedCurrencies(),
        icon: '/assets/payment-providers/payfast.png'
      },
      {
        name: 'eft',
        displayName: 'EFT Bank Transfer',
        description: 'Direct bank transfer from all major South African banks',
        currencies: this.eftProvider.getSupportedCurrencies(),
        banks: this.eftProvider.getSupportedBanks(),
        icon: '/assets/payment-providers/eft.png'
      },
      {
        name: 'ozow',
        displayName: 'Ozow',
        description: 'Instant EFT payment solution',
        currencies: this.ozowProvider.getSupportedCurrencies(),
        banks: this.ozowProvider.getSupportedBanks(),
        icon: '/assets/payment-providers/ozow.png'
      },
    ];
  }

  async getPaymentHistory(invoiceId: string) {
    return await this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getOverdueInvoices() {
    const now = new Date();
    return await this.prisma.invoice.findMany({
      where: {
        dueDate: { lt: now },
        status: { in: ['SENT', 'PARTIALLY_PAID'] }
      },
      include: {
        items: true
      }
    });
  }

  async getBillingMetrics(dateRange?: { start: Date; end: Date }) {
    const whereClause: any = {};
    if (dateRange) {
      whereClause.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end
      };
    }

    const [
      totalInvoices,
      _totalRevenue,
      paidInvoices,
      overdueInvoices,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: whereClause }),
      this.prisma.invoice.aggregate({
        where: whereClause,
        _sum: { totalAmount: true }
      }),
      this.prisma.invoice.count({ where: { ...whereClause, status: 'PAID' } }),
      this.getOverdueInvoices(),
    ]);

    const totalRevenue = _totalRevenue._sum.totalAmount || 0;

    return {
      totalInvoices,
      totalRevenue,
      paidInvoices,
      overdueInvoices: overdueInvoices.length,
      averageInvoiceValue: totalInvoices > 0 ? totalRevenue / totalInvoices : 0,
      collectionRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
    };
  }

  private async createBrokerInvoiceItems(
    invoice: any,
    subscription: any,
    amounts: {
      subscriptionFee: number;
      apiUsageFee: number;
      transactionFee: number;
      overageFee: number;
    }) {
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
        referenceType: 'SUBSCRIPTION'
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
        referenceType: 'SUBSCRIPTION'
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
        referenceType: 'SUBSCRIPTION'
      });
    }

    if (items.length > 0) {
      await this.prisma.invoiceItem.createMany({
        data: items
      });
    }
  }

  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const count = await this.prisma.invoice.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1)
        }
      }
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private async generateBrokerInvoiceNumber(): Promise<string> {
    const prefix = 'BRK';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const count = await this.prisma.brokerInvoice.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1)
        }
      }
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  // Methods expected by BillingController
  async generateInvoice(generateDto: GenerateInvoiceDto) {
    const invoiceNumber = await this.generateBrokerInvoiceNumber();

    const invoice = await this.prisma.brokerInvoice.create({
      data: {
        ...generateDto,
        invoiceNumber,
        status: 'DRAFT',
        issueDate: new Date()
      }
    });

    return invoice;
  }

  async getInvoiceById(invoiceId: string, user: User) {
    const invoice = await this.prisma.brokerInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        brokerAccount: true,
        payments: true,
        items: true
      }
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

  async sendInvoice(invoiceId: string, user: User) {
    const invoice = await this.getInvoiceById(invoiceId, user);

    // For now, simulate email sending
    // In production, integrate with email service
    return {
      sent: true,
      sentAt: new Date(),
      recipient: invoice.brokerAccount?.broker?.email
    };
  }

  async recordPayment(recordDto: RecordPaymentDto) {
    const invoice = await this.prisma.brokerInvoice.findUnique({
      where: { id: recordDto.invoiceId }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    const payment = await this.prisma.brokerPayment.create({
      data: {
        ...recordDto,
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    // Update invoice status
    const payments = await this.prisma.brokerPayment.findMany({
      where: { invoiceId: recordDto.invoiceId, status: 'COMPLETED' }
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    if (totalPaid >= invoice.totalAmount) {
      await this.prisma.brokerInvoice.update({
        where: { id: recordDto.invoiceId },
        data: {
          status: 'PAID',
          paidAt: new Date()
        }
      });
    } else {
      await this.prisma.brokerInvoice.update({
        where: { id: recordDto.invoiceId },
        data: { status: 'PARTIALLY_PAID' }
      });
    }

    return payment;
  }

  async getPayments(filters: {
    brokerId?: string;
    invoiceId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      brokerId,
      invoiceId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = filters;

    const where: any = {};
    if (brokerId) where.brokerId = brokerId;
    if (invoiceId) where.invoiceId = invoiceId;
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };

    const [payments, total] = await Promise.all([
      this.prisma.brokerPayment.findMany({
        where,
        include: {
          invoice: true,
          broker: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.brokerPayment.count({ where })
    ]);

    return {
      payments,
      page,
      limit,
      total
    };
  }

  async getBrokerBillingSummary(brokerId: string, user: User) {
    // Check permissions
    if (user.role === 'BROKER' && brokerId !== user.id) {
      throw new ForbiddenException('Access denied');
    }

    const [
      totalInvoices,
      paidInvoices,
      _totalBilled,
      _totalPaid,
      _outstandingBalance,
    ] = await Promise.all([
      this.prisma.brokerInvoice.count({ where: { brokerId } }),
      this.prisma.brokerInvoice.count({ where: { brokerId, status: 'PAID' } }),
      this.prisma.brokerInvoice.aggregate({
        where: { brokerId },
        _sum: { totalAmount: true }
      }),
      this.prisma.brokerPayment.aggregate({
        where: { brokerId, status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      this.prisma.brokerInvoice.aggregate({
        where: { brokerId, status: 'SENT' },
        _sum: { totalAmount: true }
      }),
    ]);

    const totalBilled = _totalBilled._sum.totalAmount || 0;
    const totalPaid = _totalPaid._sum.amount || 0;
    const outstandingBalance = _outstandingBalance._sum.totalAmount || 0;

    return {
      totalInvoices,
      paidInvoices,
      overdueInvoices: 0,
      totalBilled,
      totalPaid,
      outstandingBalance,
      paymentRate: totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0
    };
  }

  async getRevenueAnalytics(filters: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: string;
  }) {
    const { startDate, endDate, groupBy = 'month' } = filters;

    const invoices = await this.prisma.brokerInvoice.findMany({
      where: {
        ...(startDate && { createdAt: { gte: startDate } }),
        ...(endDate && { createdAt: { lte: endDate } })
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by period
    const grouped = new Map<string, any>();

    for (const invoice of invoices) {
      const date = new Date(invoice.createdAt);
      let key: string;

      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          period: key,
          invoiceCount: 0,
          revenue: 0,
          paidRevenue: 0
        });
      }

      const group = grouped.get(key);
      group.invoiceCount++;
      group.revenue += invoice.totalAmount;
      if (invoice.status === 'PAID') {
        group.paidRevenue += invoice.totalAmount;
      }
    }

    return Array.from(grouped.values());
  }

  async voidInvoice(invoiceId: string, reason: string) {
    const invoice = await this.prisma.brokerInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot void paid invoice');
    }

    return await this.prisma.brokerInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        notes: reason
      }
    });
  }

  async getOverdueInvoicesList(filters: {
    daysOverdue?: number;
    page?: number;
    limit?: number;
  }) {
    const { daysOverdue = 30, page = 1, limit = 10 } = filters;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const where: any = {
      dueDate: { lt: new Date() },
      status: { in: ['SENT', 'PARTIALLY_PAID'] },
      dueDate: { lte: cutoffDate }
    };

    const [invoices, total] = await Promise.all([
      this.prisma.brokerInvoice.findMany({
        where,
        include: {
          brokerAccount: {
            include: {
              broker: true
            }
          }
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.brokerInvoice.count({ where })
    ]);

    return {
      invoices,
      page,
      limit,
      total
    };
  }
}
