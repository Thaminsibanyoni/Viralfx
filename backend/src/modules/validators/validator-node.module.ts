import { Module } from '@nestjs/common';
import { ValidatorNodeService } from "./services/validator-node.service";
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
        ConfigModule,
    ScheduleModule.forRoot(),
  ],
  providers: [ValidatorNodeService],
  exports: [ValidatorNodeService]
})
export class ValidatorNodeModule {}
