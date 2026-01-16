import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayService } from '../../payment/services/payment-gateway.service';
import { UsageService } from "./usage.service";
import { PlansService } from "./plans.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { StorageService } from "../../storage/services/storage.service";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { API_CURRENCY_CONFIG } from '../interfaces/api-marketplace.interface';
import { InvoiceWithDetails, InvoiceLineItem } from '../interfaces/api-marketplace.interface';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private paymentGateway: PaymentGatewayService,
    private usageService: UsageService,
    private plansService: PlansService,
    private notificationService: NotificationService,
    private storageService: StorageService) {}

  async generateInvoice(
    customerId: string,
    customerType: 'USER' | 'BROKER',
    period: { start: Date; end: Date }): Promise<InvoiceWithDetails> {
    // Check if invoice already exists for this period
    const existing = await this.prisma.apiInvoice.findFirst({
      where: {
        customerId,
        customerType,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end
      }
    });

    if (existing) {
      throw new BadRequestException('Invoice already exists for this billing period');
    }

    // Get all active API keys for the customer
    const where = customerType === 'USER'
      ? { userId: customerId, revoked: false }
      : { brokerId: customerId, revoked: false };

    const apiKeys = await this.prisma.apiKey.findMany({
      where,
      include: {
        plan: {
          include: { product: true }
        }
      }
    });

    if (apiKeys.length === 0) {
      throw new BadRequestException('No active API keys found for this customer');
    }

    // Calculate line items
    const lineItems: InvoiceLineItem[] = [];
    let subtotal = 0;

    // Monthly subscription fees
    const uniquePlans = new Map();
    apiKeys.forEach(key => {
      if (!uniquePlans.has(key.planId)) {
        uniquePlans.set(key.planId, key.plan);
      }
    });

    for (const plan of uniquePlans.values()) {
      const keyCount = apiKeys.filter(k => k.planId === plan.id).length;
      const monthlyFee = Number(plan.monthlyFee) * keyCount;

      lineItems.push({
        description: `${plan.name} Plan - ${plan.product.name} (${keyCount} key${keyCount > 1 ? 's' : ''})`,
        quantity: keyCount,
        unitPrice: Number(plan.monthlyFee),
        amount: monthlyFee,
        currency: API_CURRENCY_CONFIG.DEFAULT_CURRENCY
      });

      subtotal += monthlyFee;
    }

    // Calculate overage fees
    for (const key of apiKeys) {
      if (key.plan.perCallFee && key.plan.quota) {
        const overage = Math.max(0, key.usageCount - key.plan.quota);
        if (overage > 0) {
          const overageFee = await this.plansService.calculateOverageFees(
            key.planId,
            overage);

          lineItems.push({
            description: `Overage fees - ${key.plan.product.name} (${overage} calls beyond quota)`,
            quantity: overage,
            unitPrice: Number(key.plan.perCallFee),
            amount: overageFee,
            currency: API_CURRENCY_CONFIG.DEFAULT_CURRENCY
          });

          subtotal += overageFee;
        }
      }
    }

    // Add VAT
    const vatAmount = subtotal * API_CURRENCY_CONFIG.VAT_RATE;
    const totalAmount = subtotal + vatAmount;

    // Create invoice
    const invoice = await this.prisma.apiInvoice.create({
      data: {
        customerId,
        customerType,
        billingPeriodStart: period.start,
        billingPeriodEnd: period.end,
        amountDue: totalAmount,
        amountPaid: 0,
        currency: API_CURRENCY_CONFIG.DEFAULT_CURRENCY,
        status: 'PENDING',
        metadata: {
          lineItems,
          subtotal,
          vatAmount,
          vatRate: API_CURRENCY_CONFIG.VAT_RATE
        }
      }
    });

    // Generate PDF invoice
    const pdfUrl = await this.generateInvoicePdf(invoice.id, lineItems);

    // Update invoice with PDF URL
    const updatedInvoice = await this.prisma.apiInvoice.update({
      where: { id: invoice.id },
      data: { invoicePdfUrl: pdfUrl }
    });

    // Prepare invoice with details for email
    const invoiceWithDetails: InvoiceWithDetails = {
      ...updatedInvoice,
      lineItems,
      customer: await this.getCustomerDetails(customerId, customerType)
    };

    // Send invoice email notification
    try {
      await this.sendInvoiceEmail(invoiceWithDetails);
    } catch (error) {
      this.logger.warn(`Failed to send invoice email for ${invoice.id}:`, error.message);
      // Continue without failing the invoice generation
    }

    return invoiceWithDetails;
  }

  async processPayment(invoiceId: string, gateway: 'paystack' | 'payfast' | 'ozow'): Promise<{
    paymentUrl: string;
    reference: string;
  }> {
    const invoice = await this.prisma.apiInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        // We don't have direct relations to User/Broker, so we'll need to fetch separately
      }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'PENDING') {
      throw new BadRequestException('Invoice is not pending payment');
    }

    const customer = await this.getCustomerDetails(
      invoice.customerId!,
      invoice.customerType as 'USER' | 'BROKER');

    // Create payment via gateway
    const payment = await this.paymentGateway.createPayment({
      amount: Number(invoice.amountDue),
      currency: invoice.currency,
      reference: `API-INVOICE-${invoice.id}`,
      email: customer?.email || '',
      callbackUrl: `${process.env.API_BASE_URL}/api/v1/api-marketplace/billing/webhooks/${gateway}`,
      metadata: {
        invoiceId,
        type: 'api-marketplace',
        customerId: invoice.customerId,
        customerType: invoice.customerType
      }
    });

    // Update invoice with payment reference
    await this.prisma.apiInvoice.update({
      where: { id: invoiceId },
      data: {
        metadata: {
          ...invoice.metadata,
          paymentReference: payment.reference,
          gateway
        }
      }
    });

    return {
      paymentUrl: payment.paymentUrl,
      reference: payment.reference
    };
  }

  async handlePaymentWebhook(
    gateway: string,
    webhookData: any): Promise<void> {
    // Verify webhook signature
    const isValid = await this.paymentGateway.verifyWebhook(gateway, webhookData);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const invoiceId = webhookData.metadata?.invoiceId;
    if (!invoiceId) {
      throw new BadRequestException('Invoice ID not found in webhook data');
    }

    const invoice = await this.prisma.apiInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (webhookData.status === 'success' || webhookData.event === 'charge.success') {
      await this.prisma.apiInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'PAID',
          amountPaid: invoice.amountDue,
          paidAt: new Date(),
          metadata: {
            ...invoice.metadata,
            paymentCompletedAt: new Date(),
            transactionId: webhookData.transaction_id || webhookData.reference
          }
        }
      });

      // Trigger webhook to customer
      // TODO: Implement webhook service to notify customers
    } else if (webhookData.status === 'failed' || webhookData.event === 'charge.failed') {
      await this.prisma.apiInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'FAILED',
          metadata: {
            ...invoice.metadata,
            paymentFailedAt: new Date(),
            failureReason: webhookData.reason || webhookData.message
          }
        }
      });
    }
  }

  async getInvoices(
    customerId: string,
    customerType: 'USER' | 'BROKER',
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {}) {
    const where: any = {
      customerId,
      customerType
    };

    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.prisma.apiInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.apiInvoice.count({ where }),
    ]);

    return {
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getInvoice(id: string): Promise<InvoiceWithDetails | null> {
    const invoice = await this.prisma.apiInvoice.findUnique({
      where: { id }
    });

    if (!invoice) {
      return null;
    }

    const lineItems = invoice.metadata?.lineItems || [];

    return {
      ...invoice,
      lineItems,
      customer: invoice.customerId
        ? await this.getCustomerDetails(invoice.customerId, invoice.customerType as 'USER' | 'BROKER')
        : undefined
    };
  }

  async retryFailedPayment(invoiceId: string): Promise<{
    paymentUrl: string;
    reference: string;
  }> {
    const invoice = await this.prisma.apiInvoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'FAILED') {
      throw new BadRequestException('Invoice is not in failed status');
    }

    // Reset status to pending
    await this.prisma.apiInvoice.update({
      where: { id: invoiceId },
      data: { status: 'PENDING' }
    });

    // Retry with the original gateway
    const gateway = invoice.metadata?.gateway;
    if (!gateway) {
      throw new BadRequestException('No payment gateway found for this invoice');
    }

    return this.processPayment(invoiceId, gateway as 'paystack' | 'payfast' | 'ozow');
  }

  private async generateInvoicePdf(
    invoiceId: string,
    lineItems: InvoiceLineItem[]): Promise<string> {
    try {
      // Fetch complete invoice details
      const invoice = await this.prisma.apiInvoice.findUnique({
        where: { id: invoiceId }
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Get customer details
      const customer = await this.getCustomerDetails(
        invoice.customerId!,
        invoice.customerType as 'USER' | 'BROKER');

      // Create PDF document
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points

      // Embed font
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const { width, height } = page.getSize();
      const margin = 50;
      let yPosition = height - margin;

      // Header section
      page.drawText('ViralFX API Invoice', {
        x: margin,
        y: yPosition,
        size: 24,
        font: helveticaBoldFont,
        color: rgb(0.294, 0, 0.51) // Purple #4B0082
      });
      yPosition -= 40;

      // Invoice details
      page.drawText(`Invoice ID: ${invoiceId}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });
      yPosition -= 20;

      page.drawText(`Invoice Date: ${new Date().toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });
      yPosition -= 20;

      page.drawText(`Due Date: ${this.getInvoiceDueDate(invoice.billingPeriodEnd).toLocaleDateString()}`, {
        x: margin,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });
      yPosition -= 20;

      // Customer information
      if (customer) {
        page.drawText('Bill To:', {
          x: margin,
          y: yPosition,
          size: 14,
          font: helveticaBoldFont
        });
        yPosition -= 20;

        page.drawText(customer.firstName || customer.companyName || 'Valued Customer', {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaFont
        });
        yPosition -= 20;

        page.drawText(customer.email, {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaFont
        });
        yPosition -= 20;
      }

      // Billing period
      yPosition -= 20;
      page.drawText('Billing Period:', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont
      });
      yPosition -= 20;

      page.drawText(
        `${invoice.billingPeriodStart.toLocaleDateString()} - ${invoice.billingPeriodEnd.toLocaleDateString()}`,
        {
          x: margin,
          y: yPosition,
          size: 12,
          font: helveticaFont
        }
      );
      yPosition -= 40;

      // Line items table header
      page.drawText('Description', {
        x: margin,
        y: yPosition,
        size: 12,
        font: helveticaBoldFont
      });

      page.drawText('Quantity', {
        x: margin + 300,
        y: yPosition,
        size: 12,
        font: helveticaBoldFont
      });

      page.drawText('Unit Price', {
        x: margin + 380,
        y: yPosition,
        size: 12,
        font: helveticaBoldFont
      });

      page.drawText('Amount', {
        x: margin + 480,
        y: yPosition,
        size: 12,
        font: helveticaBoldFont
      });
      yPosition -= 20;

      // Draw line under header
      page.drawLine({
        start: { x: margin, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 20;

      // Line items
      for (const item of lineItems) {
        // Wrap long descriptions
        const maxDescriptionWidth = 280;
        const descriptionLines = this.wrapText(item.description, maxDescriptionWidth, helveticaFont, 12);

        for (let i = 0; i < descriptionLines.length; i++) {
          page.drawText(descriptionLines[i], {
            x: margin,
            y: yPosition,
            size: 12,
            font: helveticaFont
          });

          if (i === 0) {
            page.drawText(item.quantity.toString(), {
              x: margin + 300,
              y: yPosition,
              size: 12,
              font: helveticaFont
            });

            page.drawText(`${invoice.currency} ${item.unitPrice.toFixed(2)}`, {
              x: margin + 380,
              y: yPosition,
              size: 12,
              font: helveticaFont
            });

            page.drawText(`${invoice.currency} ${item.amount.toFixed(2)}`, {
              x: margin + 480,
              y: yPosition,
              size: 12,
              font: helveticaFont
            });
          }

          yPosition -= 18;
        }

        yPosition -= 10; // Extra space between items
      }

      // Totals section
      yPosition -= 20;
      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const vatAmount = subtotal * API_CURRENCY_CONFIG.VAT_RATE;
      const total = subtotal + vatAmount;

      // Draw line before totals
      page.drawLine({
        start: { x: margin + 350, y: yPosition },
        end: { x: width - margin, y: yPosition },
        thickness: 1,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 25;

      page.drawText('Subtotal:', {
        x: margin + 350,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });

      page.drawText(`${invoice.currency} ${subtotal.toFixed(2)}`, {
        x: margin + 480,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });
      yPosition -= 20;

      page.drawText(`VAT (${(API_CURRENCY_CONFIG.VAT_RATE * 100)}%):`, {
        x: margin + 350,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });

      page.drawText(`${invoice.currency} ${vatAmount.toFixed(2)}`, {
        x: margin + 480,
        y: yPosition,
        size: 12,
        font: helveticaFont
      });
      yPosition -= 20;

      // Total
      page.drawText('Total:', {
        x: margin + 350,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont
      });

      page.drawText(`${invoice.currency} ${total.toFixed(2)}`, {
        x: margin + 480,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont
      });
      yPosition -= 40;

      // Footer
      yPosition = height - 700; // Fixed position for footer
      page.drawText('Payment Instructions:', {
        x: margin,
        y: yPosition,
        size: 14,
        font: helveticaBoldFont
      });
      yPosition -= 20;

      page.drawText('Please pay this invoice by the due date to avoid service interruption.', {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaFont
      });
      yPosition -= 20;

      page.drawText('For questions about this invoice, contact our billing team.', {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaFont
      });
      yPosition -= 20;

      page.drawText('Email: billing@viralfx.com', {
        x: margin,
        y: yPosition,
        size: 11,
        font: helveticaFont
      });

      // Company info at bottom
      yPosition = 50;
      page.drawText('ViralFX API Services', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 15;

      page.drawText('Company Registration: 2020/123456/07', {
        x: margin,
        y: yPosition,
        size: 10,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5)
      });

      // Save PDF to buffer
      const pdfBytes = await pdfDoc.save();

      // Generate S3 path
      const path = `invoices/api/${invoiceId}.pdf`;

      // Upload to S3
      const url = await this.storageService.uploadFile(Buffer.from(pdfBytes), path, {
        contentType: 'application/pdf',
        metadata: {
          invoiceId,
          customerId: invoice.customerId!,
          customerType: invoice.customerType
        }
      });

      this.logger.log(`PDF invoice generated and uploaded: ${url}`);
      return url;

    } catch (error) {
      this.logger.error(`Failed to generate PDF for invoice ${invoiceId}:`, error);
      // Return fallback URL
      return `https://s3.viralfx.com/invoices/api/${invoiceId}.pdf`;
    }
  }

  /**
   * Helper method to wrap text for PDF
   */
  private wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }

  /**
   * Send invoice email notification
   */
  private async sendInvoiceEmail(invoice: InvoiceWithDetails): Promise<void> {
    try {
      if (!invoice.customer?.email) {
        this.logger.warn(`No email address available for invoice ${invoice.id}`);
        return;
      }

      // Calculate totals if not provided
      const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
      const vatAmount = subtotal * API_CURRENCY_CONFIG.VAT_RATE;
      const total = subtotal + vatAmount;

      // Prepare template data - rely on EmailProcessor to render by template name
      const templateData = {
        invoiceId: invoice.id,
        customerName: invoice.customer.firstName || invoice.customer.companyName || 'Valued Customer',
        amount: invoice.amountDue,
        currency: invoice.currency,
        dueDate: this.getInvoiceDueDate(invoice.billingPeriodEnd).toLocaleDateString(),
        lineItems: invoice.lineItems,
        pdfUrl: invoice.invoicePdfUrl || '',
        billingPeriod: `${invoice.billingPeriodStart.toLocaleDateString()} - ${invoice.billingPeriodEnd.toLocaleDateString()}`,
        subtotal,
        vatAmount,
        vatRate: API_CURRENCY_CONFIG.VAT_RATE,
        issueDate: new Date().toLocaleDateString()
      };

      await this.notificationService.sendEmail({
        to: invoice.customer.email,
        subject: `Your API Invoice from ViralFX - ${invoice.id}`,
        template: 'api-invoice',
        data: templateData
      });

      this.logger.log(`Invoice email sent for ${invoice.id} to ${invoice.customer.email}`);
    } catch (error) {
      this.logger.error(`Failed to send invoice email for ${invoice.id}:`, error);
      // Don't throw - email failure shouldn't block invoice generation
    }
  }

  private async getCustomerDetails(
    customerId: string,
    customerType: 'USER' | 'BROKER'): Promise<{ id: string; email: string; firstName?: string; lastName?: string; companyName?: string } | null> {
    if (customerType === 'USER') {
      const user = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });
      return user;
    } else {
      const broker = await this.prisma.broker.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          contactEmail: true,
          companyName: true
        }
      });
      if (broker) {
        return {
          id: broker.id,
          email: broker.contactEmail,
          companyName: broker.companyName
        };
      }
    }
    return null;
  }

  /**
   * Get invoice due date based on billing period end and configured due days
   */
  private getInvoiceDueDate(billingPeriodEnd: Date): Date {
    const dueDays = parseInt(this.config.get<string>('API_INVOICE_DUE_DAYS', '7'));
    return new Date(billingPeriodEnd.getTime() + dueDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Get configured invoice due days
   */
  private getInvoiceDueDays(): number {
    return parseInt(this.config.get<string>('API_INVOICE_DUE_DAYS', '7'));
  }
}
