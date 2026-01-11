import { Controller, Post, Get, Body, Headers, Ip, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiExcludeController, ApiOperation } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DepositService } from '../services/deposit.service';
import { WithdrawalService } from '../services/withdrawal.service';
import { PaymentGatewayService } from "../../payment/services/payment-gateway.service";
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

interface PaystackWebhookData {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    customer?: {
      email: string;
    };
    metadata?: any;
  };
}

interface PayFastWebhookData {
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: string;
  amount_gross: number;
  amount_fee: number;
  amount_net: number;
  custom_str1?: string; // Transaction ID
  custom_str2?: string; // User ID
}

interface OzowWebhookData {
  TransactionReference: string;
  Amount: number;
  Currency: string;
  TransactionStatus: string;
  OrderId?: string;
}

@ApiExcludeController()
@Controller('api/v1/payments/webhooks')
export class PaymentWebhookController {
  private readonly allowedIps = [
    '52.31.139.75', // Paystack
    '52.49.173.169', // Paystack
    '52.214.14.220', // Paystack
    // Add PayFast and Ozow IPs
  ];
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly depositService: DepositService,
    private readonly withdrawalService: WithdrawalService,
    private readonly paymentGatewayService: PaymentGatewayService,
    @InjectQueue('wallet-deposit')
    private readonly depositQueue: Queue,
    @InjectQueue('wallet-withdrawal')
    private readonly withdrawalQueue: Queue,
    @InjectRedis() private readonly redis: Redis) {}

  @Post('paystack')
  @ApiOperation({ summary: 'Paystack webhook handler' })
  async handlePaystackWebhook(
    @Body() webhookData: PaystackWebhookData,
    @Headers('x-paystack-signature') signature: string,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response): Promise<Response> {
    try {
      // Validate IP whitelist
      if (!this.isAllowedIp(ip)) {
        this.logger.warn(`Paystack webhook from unauthorized IP: ${ip}`);
        return res.status(HttpStatus.FORBIDDEN).json({ error: 'Unauthorized' });
      }

      // Verify signature
      const isValid = await this.paymentGatewayService.verifyWebhook('paystack', webhookData, signature);
      if (!isValid) {
        this.logger.warn('Invalid Paystack webhook signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Log webhook for debugging
      this.logger.log(`Paystack webhook: ${webhookData.event} - ${webhookData.data.reference}`);

      // Process webhook asynchronously
      await this.depositService.processDepositWebhook('paystack', {
        ...webhookData,
        gateway: 'paystack',
        ip,
        userAgent
      });

      // Return immediately to prevent retries
      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error('Paystack webhook error:', error.stack || error.message);
      // Still return 200 to prevent retries
      return res.status(HttpStatus.OK).json({ received: true, error: 'Logged for review' });
    }
  }

  @Post('payfast')
  @ApiOperation({ summary: 'PayFast webhook handler' })
  async handlePayFastWebhook(
    @Body() webhookData: PayFastWebhookData,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response): Promise<Response> {
    try {
      // Validate IP whitelist (PayFast has multiple IPs, implement proper validation)
      if (!this.isAllowedIp(ip)) {
        this.logger.warn(`PayFast webhook from unauthorized IP: ${ip}`);
        return res.status(HttpStatus.FORBIDDEN).json({ error: 'Unauthorized' });
      }

      // Verify PayFast ITN (Instant Transaction Notification)
      const isValid = await this.paymentGatewayService.verifyWebhook('payfast', webhookData);
      if (!isValid) {
        this.logger.warn('Invalid PayFast ITN signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Log webhook for debugging
      this.logger.log(`PayFast webhook: ${webhookData.payment_status} - ${webhookData.m_payment_id}`);

      // Map PayFast status to our format
      const mappedData = {
        event: webhookData.payment_status === 'COMPLETE' ? 'charge.success' : 'charge.failed',
        reference: webhookData.custom_str1 || webhookData.m_payment_id,
        amount: webhookData.amount_gross,
        currency: 'ZAR', // PayFast typically uses ZAR
        status: webhookData.payment_status === 'COMPLETE' ? 'successful' : 'failed',
        metadata: {
          paymentId: webhookData.pf_payment_id,
          fee: webhookData.amount_fee,
          netAmount: webhookData.amount_net,
          customData: webhookData.custom_str2
        }
      };

      // Process webhook asynchronously
      await this.depositService.processDepositWebhook('payfast', {
        ...mappedData,
        gateway: 'payfast',
        ip,
        userAgent,
        originalData: webhookData
      });

      // PayFast expects specific response format
      return res.status(HttpStatus.OK).send('OK');
    } catch (error) {
      this.logger.error('PayFast webhook error:', error.stack || error.message);
      return res.status(HttpStatus.OK).send('OK');
    }
  }

  @Post('ozow')
  @ApiOperation({ summary: 'Ozow webhook handler' })
  async handleOzowWebhook(
    @Body() webhookData: OzowWebhookData,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
    @Req() req: Request,
    @Res() res: Response): Promise<Response> {
    try {
      // Validate IP whitelist
      if (!this.isAllowedIp(ip)) {
        this.logger.warn(`Ozow webhook from unauthorized IP: ${ip}`);
        return res.status(HttpStatus.FORBIDDEN).json({ error: 'Unauthorized' });
      }

      // Verify Ozow signature
      const isValid = await this.paymentGatewayService.verifyWebhook('ozow', webhookData);
      if (!isValid) {
        this.logger.warn('Invalid Ozow webhook signature');
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' });
      }

      // Log webhook for debugging
      this.logger.log(`Ozow webhook: ${webhookData.TransactionStatus} - ${webhookData.TransactionReference}`);

      // Map Ozow status to our format
      const mappedData = {
        event: webhookData.TransactionStatus === 'Complete' ? 'charge.success' : 'charge.failed',
        reference: webhookData.TransactionReference,
        amount: webhookData.Amount,
        currency: webhookData.Currency,
        status: webhookData.TransactionStatus === 'Complete' ? 'successful' : 'failed',
        metadata: {
          orderId: webhookData.OrderId
        }
      };

      // Process webhook asynchronously
      await this.depositService.processDepositWebhook('ozow', {
        ...mappedData,
        gateway: 'ozow',
        ip,
        userAgent,
        originalData: webhookData
      });

      return res.status(HttpStatus.OK).json({ received: true });
    } catch (error) {
      this.logger.error('Ozow webhook error:', error.stack || error.message);
      return res.status(HttpStatus.OK).json({ received: true, error: 'Logged for review' });
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Webhook health check' })
  async healthCheck(@Res() res: Response): Promise<Response> {
    return res.status(HttpStatus.OK).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }

  private isAllowedIp(ip: string): boolean {
    // For development, allow all IPs
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // In production, check against whitelist
    return this.allowedIps.includes(ip);
  }

  private async logWebhook(gateway: string, data: any, ip: string): Promise<void> {
    try {
      const logKey = `webhook:${gateway}:${Date.now()}`;
      await this.redis.setex(logKey, 86400, JSON.stringify({
        gateway,
        ip,
        timestamp: new Date().toISOString(),
        data
      }));
    } catch (error) {
      this.logger.error('Failed to log webhook:', error.stack || error.message);
    }
  }
}
