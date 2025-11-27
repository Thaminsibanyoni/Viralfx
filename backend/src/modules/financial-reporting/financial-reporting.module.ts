import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { BrokerBill } from '../brokers/entities/broker-bill.entity';
import { Broker } from '../brokers/entities/broker.entity';
import { BrokerClient } from '../brokers/entities/broker-client.entity';
import { PrismaModule } from '../prisma/prisma.module';
import { FinancialReportingService } from './services/financial-reporting.service';
import { MrrService } from './services/mrr.service';
import { NrrService } from './services/nrr.service';
import { CohortAnalysisService } from './services/cohort-analysis.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { FinancialReportingController } from './controllers/financial-reporting.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrokerBill, Broker, BrokerClient]),
    PrismaModule,
    BullModule.registerQueue({ name: 'financial-reports' }),
    ConfigModule,
  ],
  controllers: [FinancialReportingController],
  providers: [
    FinancialReportingService,
    MrrService,
    NrrService,
    CohortAnalysisService,
    RevenueAnalyticsService,
  ],
  exports: [FinancialReportingService],
})
export class FinancialReportingModule {}