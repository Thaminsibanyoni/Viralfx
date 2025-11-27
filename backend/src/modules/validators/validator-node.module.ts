import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ValidatorNodeService } from './services/validator-node.service';
import { ValidatorNode } from '../oracle/entities/validator-node.entity';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    TypeOrmModule.forFeature([ValidatorNode]),
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  providers: [ValidatorNodeService],
  exports: [ValidatorNodeService],
})
export class ValidatorNodeModule {}