import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs-modules/ioredis';

import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { WalletService } from './services/wallet.service';
import { CurrencyConverterService } from './services/currency-converter.service';
import { LedgerService } from './services/ledger.service';
import { DepositService } from './services/deposit.service';
import { WithdrawalService } from './services/withdrawal.service';
import { WalletController } from './controllers/wallet.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { TransactionProcessor } from './processors/transaction.processor';
import { DepositProcessor } from './processors/deposit.processor';
import { WithdrawalProcessor } from './processors/withdrawal.processor';
import { WebSocketModule } from '../websocket/websocket.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction]),
    BullModule.registerQueue(
      {
        name: 'wallet-transaction',
        settings: {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
        },
      },
      {
        name: 'wallet-deposit',
        settings: {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
        },
      },
      {
        name: 'wallet-withdrawal',
        settings: {
          redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379,
          },
        },
      }
    ),
    RedisModule,
    WebSocketModule,
    NotificationModule,
    PaymentModule,
  ],
  controllers: [WalletController, PaymentWebhookController],
  providers: [
    WalletService,
    CurrencyConverterService,
    LedgerService,
    DepositService,
    WithdrawalService,
    TransactionProcessor,
    DepositProcessor,
    WithdrawalProcessor,
  ],
  exports: [
    WalletService,
    CurrencyConverterService,
    LedgerService,
    DepositService,
    WithdrawalService,
  ],
})
export class WalletModule {}