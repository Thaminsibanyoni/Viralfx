import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Request,
  Res,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { InitiatePaymentDto, WebhookPaymentDto } from '../dto/payment.dto';
import { BillingService } from '../services/billing.service';
import { BrokerBill, BillStatus } from '../entities/broker-bill.entity';
import { UserRole } from '@prisma/client';
import { Response } from 'express';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get(':brokerId/bills')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get broker bills' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Bills retrieved successfully' })
  async getBills(
    @Param('brokerId') brokerId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: BillStatus,
  ): Promise<any> {
    const result = await this.billingService.getBrokerBills(brokerId, { page, limit, status });
    return {
      success: true,
      data: result.bills,
      pagination: result.pagination,
    };
  }

  @Get(':brokerId/bills/:billId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get bill details' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Bill details retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Bill not found' })
  async getBill(
    @Param('brokerId') brokerId: string,
    @Param('billId') billId: string,
  ): Promise<any> {
    const bill = await this.billingService.getBill(billId);
    return {
      success: true,
      data: bill,
    };
  }

  @Post(':brokerId/bills/:billId/pay')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Initiate bill payment' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiBody({ type: InitiatePaymentDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment initiated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Bill is not payable' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Bill not found' })
  @HttpCode(HttpStatus.OK)
  async initiatePayment(
    @Param('brokerId') brokerId: string,
    @Param('billId') billId: string,
    @Body() paymentDto: InitiatePaymentDto,
  ): Promise<any> {
    const paymentResult = await this.billingService.processBillPayment(billId, paymentDto);
    return {
      success: true,
      message: 'Payment initiated successfully',
      data: paymentResult,
    };
  }

  @Post('webhooks/:gateway')
  @ApiOperation({ summary: 'Handle payment gateway webhooks' })
  @ApiParam({ name: 'gateway', description: 'Payment gateway (paystack, payfast, ozow)' })
  @ApiBody({ description: 'Webhook payload from payment gateway' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Webhook processed successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Invalid webhook signature' })
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() webhookData: any,
    @Headers('x-paystack-signature') paystackSignature?: string,
    @Headers('x-payfast-signature') payfastSignature?: string,
  ): Promise<any> {
    // Attach signature to webhook data for verification
    if (paystackSignature) {
      webhookData.signature = paystackSignature;
    } else if (payfastSignature) {
      webhookData.signature = payfastSignature;
    }

    try {
      await this.billingService.handlePaymentWebhook(gateway, webhookData);
      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Webhook processing failed',
        error: error.message,
      };
    }
  }

  @Get(':brokerId/invoices/:billId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Download invoice PDF' })
  @ApiParam({ name: 'brokerId', description: 'Broker ID' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invoice downloaded successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Bill not found' })
  async downloadInvoice(
    @Param('brokerId') brokerId: string,
    @Param('billId') billId: string,
    @Res() res: Response,
  ): Promise<void> {
    const bill = await this.billingService.getBill(billId);

    // In a real implementation, this would generate a PDF invoice
    // For now, we'll return a placeholder PDF
    const pdfBuffer = Buffer.from('Invoice PDF placeholder content');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${bill.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  }

  // Broker self-service billing endpoints
  @Get('me/bills')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker bills' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Bills retrieved successfully' })
  async getMyBills(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: BillStatus,
  ): Promise<any> {
    // This would be implemented when broker authentication is added
    // For now, return a placeholder
    return {
      success: true,
      message: 'My bills endpoint - requires broker authentication',
    };
  }

  @Get('me/bills/:billId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current broker bill details' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Bill details retrieved successfully' })
  async getMyBill(@Request() req, @Param('billId') billId: string): Promise<any> {
    return {
      success: true,
      message: 'My bill details endpoint - requires broker authentication',
    };
  }

  @Post('me/bills/:billId/pay')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate payment for current broker bill' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiBody({ type: InitiatePaymentDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Payment initiated successfully' })
  async payMyBill(
    @Request() req,
    @Param('billId') billId: string,
    @Body() paymentDto: InitiatePaymentDto,
  ): Promise<any> {
    return {
      success: true,
      message: 'Pay my bill endpoint - requires broker authentication',
    };
  }

  @Get('me/invoices/:billId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Download current broker invoice' })
  @ApiParam({ name: 'billId', description: 'Bill ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Invoice downloaded successfully' })
  async downloadMyInvoice(
    @Request() req,
    @Param('billId') billId: string,
    @Res() res: Response,
  ): Promise<void> {
    // Return a placeholder for now
    const pdfBuffer = Buffer.from('My Invoice PDF placeholder');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${billId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  }

  // Admin billing management endpoints
  @Post('generate-monthly-bills')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate monthly bills for all brokers' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Monthly bills generation initiated' })
  async generateMonthlyBills(): Promise<any> {
    // This would trigger the billing scheduler to run immediately
    // For now, return a placeholder
    return {
      success: true,
      message: 'Monthly bills generation initiated',
    };
  }

  @Post('check-overdue-bills')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Check and handle overdue bills' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Overdue bills check completed' })
  async checkOverdueBills(): Promise<any> {
    await this.billingService.checkOverdueBills();
    return {
      success: true,
      message: 'Overdue bills check completed',
    };
  }

  @Get('reports/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get billing summary report' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Billing summary retrieved successfully' })
  async getBillingSummary(): Promise<any> {
    // Return placeholder billing summary
    return {
      success: true,
      data: {
        totalRevenue: 150000,
        paidBills: 45,
        pendingBills: 12,
        overdueBills: 3,
        thisMonthRevenue: 25000,
      },
    };
  }

  @Get('reports/detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get detailed billing report' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Detailed billing report retrieved successfully' })
  async getDetailedBillingReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('brokerId') brokerId?: string,
  ): Promise<any> {
    return {
      success: true,
      message: 'Detailed billing report endpoint - requires implementation',
    };
  }
}