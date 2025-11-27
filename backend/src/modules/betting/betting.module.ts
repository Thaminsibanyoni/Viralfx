import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bet } from './entities/bet.entity';
import { BetAuditLog } from './entities/bet-audit-log.entity';
import { BetService } from './services/bet.service';
import { LedgerService } from '../wallet/services/ledger.service';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../wallet/entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bet, BetAuditLog, Wallet, Transaction]),
  ],
  providers: [BetService, LedgerService],
  exports: [BetService],
})
export class BettingModule {}