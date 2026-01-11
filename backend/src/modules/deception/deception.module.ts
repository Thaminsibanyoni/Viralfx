import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { DeceptionService } from "./services/deception.service";
import { DeceptionAnalysisService } from "./services/deception-analysis.service";
import { DeceptionController } from "./controllers/deception.controller";
// import { DeceptionProcessor } from "./processors/deception.processor"; // Temporarily disabled - files not found
import { CacheModule } from '@nestjs/cache-manager';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    HttpModule,
   // CacheModule, // Temporarily disabled - Processor file not found
   // RedisModule, // Temporarily disabled - Processor file not found
    BullModule.registerQueue({
      name: 'deception-analysis'
    }),
    BullModule.registerQueue({
      name: 'high-risk-content'
    }),
  ],
  controllers: [DeceptionController],
  providers: [
    DeceptionService,
    DeceptionAnalysisService,
   // DeceptionProcessor, // Temporarily disabled - Processor file not found
  ],
  exports: [
    DeceptionService,
    DeceptionAnalysisService,
  ]
})
export class DeceptionModule {}
