import { Module } from '@nestjs/common';
import { BetService } from "./services/bet.service";
import { LedgerService } from '../wallet/services/ledger.service';

@Module({
  imports: [],
  providers: [BetService, LedgerService],
  exports: [BetService]
})
export class BettingModule {}
