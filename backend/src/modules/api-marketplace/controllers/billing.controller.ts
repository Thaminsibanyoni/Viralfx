import { 
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsageService } from '../services/usage.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { AdminAuthGuard } from "../../admin/guards/admin-auth.guard";

@ApiTags('API Marketplace - Billing')
@Controller('api/v1/api-marketplace/billing')
export class BillingController {
  constructor(
    private readonly usageService: UsageService) {}

  @Get('invoices')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user invoices' })
  @ApiResponse({ status: 200, description: 'Invoices retrieved successfully' })
  async getUserInvoices(
    @Req() req: any,
    @Query('status') status?: 'PENDING' | 'PAID' | 'OVERDUE',
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.usageService.getUserInvoices(userId, brokerId, status, limit, offset);
  }

  @Get('invoices/:invoiceId')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiResponse({ status: 200, description: 'Invoice details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.usageService.getInvoice(invoiceId, userId, brokerId);
  }

  @Post('invoices/:invoiceId/pay')
  @HttpCode(HttpStatus.OK)
  @Throttle(5, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pay an invoice' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async payInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() req: any,
    @Body('paymentMethod') paymentMethod: 'paystack' | 'payfast' | 'ozow'): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.usageService.payInvoice(invoiceId, userId, brokerId, paymentMethod);
  }

  @Get('invoices/:invoiceId/pdf')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiResponse({ status: 200, description: 'Invoice PDF generated successfully' })
  async downloadInvoicePdf(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.usageService.downloadInvoicePdf(invoiceId, userId, brokerId);
  }

  @Get('usage-summary')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get billing usage summary' })
  @ApiResponse({ status: 200, description: 'Usage summary retrieved successfully' })
  async getUsageSummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getBillingUsageSummary(userId, brokerId, dateRange);
  }

  @Get('payment-methods')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved successfully' })
  async getPaymentMethods(): Promise<any> {
    return this.usageService.getAvailablePaymentMethods();
  }

  @Get('billing-overview')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get platform billing overview' })
  @ApiResponse({ status: 200, description: 'Billing overview retrieved successfully' })
  async getBillingOverview(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getPlatformBillingOverview(dateRange);
  }

  @Post('generate-invoice')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Generate invoice for a user/broker' })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully' })
  async generateInvoice(
    @Body(ValidationPipe) data: {
      customerId: string;
      customerType: 'USER' | 'BROKER';
      billingPeriodStart: string;
      billingPeriodEnd: string;
      customItems?: Array<{
        description: string;
        amount: number;
        quantity?: number;
      }>;
    }): Promise<any> {
    return this.usageService.generateInvoice(data);
  }

  @Get('revenue-analytics')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiResponse({ status: 200, description: 'Revenue analytics retrieved successfully' })
  async getRevenueAnalytics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'day' | 'week' | 'month' = 'month'): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getRevenueAnalytics(dateRange, groupBy);
  }

  @Get('overdue-invoices')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({ summary: 'Get overdue invoices' })
  @ApiResponse({ status: 200, description: 'Overdue invoices retrieved successfully' })
  async getOverdueInvoices(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0): Promise<any> {
    return this.usageService.getOverdueInvoices(limit, offset);
  }
}
