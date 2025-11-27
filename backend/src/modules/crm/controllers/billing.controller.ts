import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BillingService } from '../services/billing.service';
import { GenerateInvoiceDto } from '../dto/generate-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('CRM - Billing')
@ApiBearerAuth()
@Controller('api/v1/crm/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices/generate')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Generate invoice for broker' })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async generateInvoice(@Body() generateInvoiceDto: GenerateInvoiceDto) {
    const invoice = await this.billingService.generateInvoice(generateInvoiceDto);

    return {
      success: true,
      message: 'Invoice generated successfully',
      data: invoice,
    };
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices with filtering' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  @ApiQuery({ name: 'brokerId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getInvoices(
    @Query() query: any,
    @Req() req: any,
  ) {
    const filters = {
      brokerId: req.user.role === UserRole.BROKER ? req.user.id : query.brokerId,
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.billingService.getInvoices(filters);

    return {
      success: true,
      data: result.invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiResponse({ status: 200, description: 'Invoice details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getInvoiceById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const invoice = await this.billingService.getInvoiceById(id, req.user);

    return {
      success: true,
      data: invoice,
    };
  }

  @Get('invoices/:id/pdf')
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiResponse({ status: 200, description: 'PDF downloaded successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async generateInvoicePDF(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const pdfBuffer = await this.billingService.generateInvoicePDF(id, req.user);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=invoice-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Post('invoices/:id/send')
  @ApiOperation({ summary: 'Send invoice via email' })
  @ApiResponse({ status: 200, description: 'Invoice sent successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @HttpCode(HttpStatus.OK)
  async sendInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const result = await this.billingService.sendInvoice(id, req.user);

    return {
      success: true,
      message: 'Invoice sent successfully',
      data: result,
    };
  }

  @Post('payments')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Record payment' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async recordPayment(@Body() recordPaymentDto: RecordPaymentDto) {
    const payment = await this.billingService.recordPayment(recordPaymentDto);

    return {
      success: true,
      message: 'Payment recorded successfully',
      data: payment,
    };
  }

  @Get('payments')
  @ApiOperation({ summary: 'List payments' })
  @ApiResponse({ status: 200, description: 'Payments retrieved successfully' })
  @ApiQuery({ name: 'brokerId', required: false, type: String })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getPayments(@Query() query: any) {
    const filters = {
      brokerId: query.brokerId,
      invoiceId: query.invoiceId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.billingService.getPayments(filters);

    return {
      success: true,
      data: result.payments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('brokers/:brokerId/summary')
  @ApiOperation({ summary: 'Get billing summary for broker' })
  @ApiResponse({ status: 200, description: 'Billing summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Broker not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getBrokerBillingSummary(
    @Param('brokerId', ParseUUIDPipe) brokerId: string,
    @Req() req: any,
  ) {
    const summary = await this.billingService.getBrokerBillingSummary(brokerId, req.user);

    return {
      success: true,
      data: summary,
    };
  }

  @Get('revenue/analytics')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], example: 'month' })
  async getRevenueAnalytics(@Query() query: any) {
    const filters = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      groupBy: query.groupBy || 'month',
    };

    const analytics = await this.billingService.getRevenueAnalytics(filters);

    return {
      success: true,
      data: analytics,
    };
  }

  @Post('invoices/:id/void')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Void invoice' })
  @ApiResponse({ status: 200, description: 'Invoice voided successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @HttpCode(HttpStatus.OK)
  async voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidData: { reason: string },
  ) {
    const invoice = await this.billingService.voidInvoice(id, voidData.reason);

    return {
      success: true,
      message: 'Invoice voided successfully',
      data: invoice,
    };
  }

  @Get('overdue')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get overdue invoices' })
  @ApiResponse({ status: 200, description: 'Overdue invoices retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'daysOverdue', required: false, type: Number, example: 30 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getOverdueInvoices(@Query() query: any) {
    const filters = {
      daysOverdue: parseInt(query.daysOverdue) || 30,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.billingService.getOverdueInvoices(filters);

    return {
      success: true,
      data: result.invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  // Additional endpoints to match frontend expectations

  @Post('invoices')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createInvoice(
    @Body() invoiceData: {
      brokerId: string;
      invoiceNumber?: string;
      issueDate?: string;
      dueDate?: string;
      items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        vatRate?: number;
      }>;
      notes?: string;
    },
  ) {
    const invoice = await this.billingService.createInvoice(invoiceData);

    return {
      success: true,
      message: 'Invoice created successfully',
      data: invoice,
    };
  }

  @Post('payments/initiate')
  @ApiOperation({ summary: 'Initiate payment for invoice' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async initiatePayment(
    @Body() paymentData: {
      invoiceId: string;
      method: 'paystack' | 'payfast' | 'wallet';
      returnUrl?: string;
      cancelUrl?: string;
    },
  ) {
    const result = await this.billingService.initiatePayment(paymentData);

    return {
      success: true,
      message: 'Payment initiated successfully',
      data: result,
    };
  }

  @Get('invoices/:id/payments')
  @ApiOperation({ summary: 'Get payment history for invoice' })
  @ApiResponse({ status: 200, description: 'Payment history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoicePaymentHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: any,
  ) {
    const filters = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 10,
    };

    const result = await this.billingService.getInvoicePaymentHistory(id, filters);

    return {
      success: true,
      data: result.payments,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get billing summary and analytics' })
  @ApiResponse({ status: 200, description: 'Billing summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'groupBy', required: false, enum: ['day', 'week', 'month'], example: 'month' })
  async getBillingSummary(@Query() query: any) {
    const filters = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      groupBy: query.groupBy || 'month',
    };

    const summary = await this.billingService.getBillingSummary(filters);

    return {
      success: true,
      data: summary,
    };
  }

  @Get('analytics')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get detailed billing analytics' })
  @ApiResponse({ status: 200, description: 'Billing analytics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d', '1y'], example: '30d' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getBillingAnalytics(@Query() query: any) {
    const filters = {
      period: query.period,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const analytics = await this.billingService.getBillingAnalytics(filters);

    return {
      success: true,
      data: analytics,
    };
  }

  @Post('invoices/:id/write-off')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Write off invoice' })
  @ApiResponse({ status: 200, description: 'Invoice written off successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async writeOffInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() writeOffData: { reason: string; amount: number; notes?: string },
  ) {
    const result = await this.billingService.writeOffInvoice(id, writeOffData);

    return {
      success: true,
      message: 'Invoice written off successfully',
      data: result,
    };
  }

  @Post('invoices/:id/void')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Void invoice' })
  @ApiResponse({ status: 200, description: 'Invoice voided successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async voidInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() voidData: { reason: string },
  ) {
    await this.billingService.voidInvoice(id, voidData.reason);

    return {
      success: true,
      message: 'Invoice voided successfully',
    };
  }

  @Get('export')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Export billing data' })
  @ApiResponse({ status: 200, description: 'Billing data exported successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'excel'], example: 'excel' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async exportBillingData(@Query() query: any, @Res() res: Response) {
    const filters = {
      format: query.format || 'excel',
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    };

    const exportData = await this.billingService.exportBillingData(filters);

    // Set appropriate headers for file download
    const filename = `billing-export-${new Date().toISOString().split('T')[0]}.${filters.format}`;
    const contentType = filters.format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': exportData.length,
    });

    res.end(exportData);
  }

  @Get('templates')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get invoice templates' })
  @ApiResponse({ status: 200, description: 'Invoice templates retrieved successfully' })
  async getInvoiceTemplates() {
    const templates = await this.billingService.getInvoiceTemplates();

    return {
      success: true,
      data: templates,
    };
  }

  @Post('templates')
  @Roles(UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Create invoice template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async createInvoiceTemplate(
    @Body() templateData: {
      name: string;
      description: string;
      template: string;
      variables?: Array<{
        name: string;
        label: string;
        type: 'text' | 'number' | 'date';
        required: boolean;
      }>;
    },
  ) {
    const template = await this.billingService.createInvoiceTemplate(templateData);

    return {
      success: true,
      message: 'Invoice template created successfully',
      data: template,
    };
  }
}