import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OracleController } from "./controller/oracle.controller";
import { ValidatorController } from "./controller/validator.controller";
import { OracleCoordinatorService } from "./services/oracle-coordinator.service";
import { ConsensusService } from "./services/consensus.service";
import { ProofGeneratorService } from "./services/proof-generator.service";
import { RealSocialDataService } from "./services/real-social-data.service";
import { SocialDataIntegrationService } from "./services/social-data-integration.service";

// Note: TypeORM entities removed - using Prisma models directly
// The OracleProof and ValidatorNode entities are now managed via Prisma

import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [
    HttpModule,
    IngestModule,
  ],
  controllers: [OracleController, ValidatorController],
  providers: [
    OracleCoordinatorService,
    ConsensusService,
    ProofGeneratorService,
    RealSocialDataService,
    SocialDataIntegrationService,
  ],
  exports: [
    OracleCoordinatorService,
    ConsensusService,
    ProofGeneratorService,
    RealSocialDataService,
    SocialDataIntegrationService,
  ]
})
export class OracleModule {}
