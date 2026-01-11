import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
// COMMENTED OUT (cross-module entity import): import { Broker } from '../brokers/entities/broker.entity';
import { FinancialReportingService } from "./services/financial-reporting.service";
import { MrrService } from "./services/mrr.service";
import { NrrService } from "./services/nrr.service";
import { CohortAnalysisService } from "./services/cohort-analysis.service";
import { RevenueAnalyticsService } from "./services/revenue-analytics.service";
import { FinancialReportingController } from "./controllers/financial-reporting.controller";

@Module({
  imports: [
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
  exports: [FinancialReportingService]
})
export class FinancialReportingModule {}
