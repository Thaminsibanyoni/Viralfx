import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { RedisModule } from '@nestjs-modules/ioredis';
import { OracleController } from './controller/oracle.controller';
import { ValidatorController } from './controller/validator.controller';
import { OracleCoordinatorService } from './services/oracle-coordinator.service';
import { ConsensusService } from './services/consensus.service';
import { ProofGeneratorService } from './services/proof-generator.service';
import { RealSocialDataService } from './services/real-social-data.service';
import { SocialDataIntegrationService } from './services/social-data-integration.service';
import { OracleProof } from './entities/oracle-proof.entity';
import { ValidatorNode } from './entities/validator-node.entity';
import { IngestModule } from '../ingest/ingest.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OracleProof, ValidatorNode]),
    HttpModule,
    RedisModule.forRootAsync({
      useFactory: () => ({
        config: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db: parseInt(process.env.REDIS_DB || '0'),
        },
      }),
    }),
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
  ],
})
export class OracleModule {}