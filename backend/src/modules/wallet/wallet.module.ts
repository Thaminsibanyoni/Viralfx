import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WalletService } from "./services/wallet.service";
import { CurrencyConverterService } from "./services/currency-converter.service";
import { LedgerService } from "./services/ledger.service";
import { DepositService } from "./services/deposit.service";
import { WithdrawalService } from "./services/withdrawal.service";
import { WalletController } from "./controllers/wallet.controller";
import { PaymentWebhookController } from "./controllers/payment-webhook.controller";
import { TransactionProcessor } from "./processors/transaction.processor";
import { DepositProcessor } from "./processors/deposit.processor";
import { WithdrawalProcessor } from "./processors/withdrawal.processor";
import { WebSocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueueAsync(
      {
        name: 'wallet-transaction',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'wallet-deposit',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      },
      {
        name: 'wallet-withdrawal',
        useFactory: (configService: ConfigService) => ({
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379)
          }
        }),
        inject: [ConfigService]
      }
    ),
    forwardRef(() => WebSocketModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => PaymentModule),
  ],
  controllers: [WalletController, PaymentWebhookController],
  providers: [
    WalletService,
    CurrencyConverterService,
    LedgerService,
    DepositService,
    WithdrawalService,
    // Processors temporarily disabled
    // TransactionProcessor,
    // DepositProcessor,
    // WithdrawalProcessor,
  ],
  exports: [
    WalletService,
    CurrencyConverterService,
    LedgerService,
    DepositService,
    WithdrawalService,
  ]
})
export class WalletModule {}
