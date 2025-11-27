import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PaymentGatewayService } from './services/payment-gateway.service';

@Module({
  imports: [ConfigModule],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentModule {}