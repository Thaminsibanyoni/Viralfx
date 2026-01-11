import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InvoiceGeneratorService } from './services/invoice-generator.service';

@Module({
  imports: [ConfigModule],
  providers: [InvoiceGeneratorService],
  exports: [InvoiceGeneratorService],
})
export class BillingModule {}
