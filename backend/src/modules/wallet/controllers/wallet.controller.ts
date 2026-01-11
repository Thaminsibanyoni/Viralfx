import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
  Logger
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";

import { WalletService } from '../services/wallet.service';
import { DepositService } from '../services/deposit.service';
import { WithdrawalService } from '../services/withdrawal.service';
import { LedgerService } from '../services/ledger.service';
import { CreateWalletDto } from '../dto/create-wallet.dto';
import { DepositDto } from '../dto/deposit.dto';
import { WithdrawalDto } from '../dto/withdrawal.dto';
import { TransferDto } from '../dto/transfer.dto';
import { WalletResponseDto } from '../dto/wallet-response.dto';
import { TransactionResponseDto } from '../dto/transaction-response.dto';

@ApiTags('Wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly depositService: DepositService,
    private readonly withdrawalService: WithdrawalService,
    private readonly ledgerService: LedgerService) {}

  @Post()
  @Throttle(10, 60) // 10 requests per minute
  @ApiOperation({ summary: 'Create a new wallet' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully', type: WalletResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createWallet(
    @Body() createWalletDto: CreateWalletDto,
    @CurrentUser() user: { id: string }): Promise<WalletResponseDto> {
    const wallet = await this.walletService.createWallet(
      user.id,
      createWalletDto.currency,
      createWalletDto.walletType
    );
    return WalletResponseDto.toDTO(wallet);
  }

  @Get()
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get user wallets' })
  @ApiResponse({ status: 200, description: 'Wallets retrieved successfully', type: [WalletResponseDto] })
  async getWallets(@CurrentUser() user: { id: string }): Promise<WalletResponseDto[]> {
    const wallets = await this.walletService.getWalletsByUserId(user.id);
    return wallets.map(wallet => WalletResponseDto.toDTO(wallet));
  }

  @Get(':id')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get wallet by ID' })
  @ApiResponse({ status: 200, description: 'Wallet retrieved successfully', type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(
    @Param('id') id: string,
    @CurrentUser() user: { id: string }): Promise<WalletResponseDto> {
    const wallet = await this.walletService.getWallet(id);
    if (wallet.userId !== user.id) {
      throw new Error('Wallet does not belong to user');
    }
    return WalletResponseDto.toDTO(wallet);
  }

  @Get(':id/transactions')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiResponse({ status: 200, description: 'Transaction history retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getWalletTransactions(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string): Promise<{ items: TransactionResponseDto[]; total: number; page: number; limit: number; totalPages: number }> {
    const wallet = await this.walletService.getWallet(id);
    if (wallet.userId !== user.id) {
      throw new Error('Wallet does not belong to user');
    }

    const result = await this.ledgerService.getTransactionHistory(id, {
      page,
      limit,
      filters: {
        type,
        status,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined
      }
    });

    return {
      ...result,
      items: result.items.map(transaction => TransactionResponseDto.toDTO(transaction))
    };
  }

  @Post('deposit')
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Initiate deposit' })
  @ApiResponse({ status: 201, description: 'Deposit initiated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async initiateDeposit(
    @Body() depositDto: DepositDto,
    @CurrentUser() user: { id: string }): Promise<{
    success: boolean;
    transactionId?: string;
    checkoutUrl?: string;
    reference?: string;
    estimatedProcessingTime?: number;
    error?: string;
  }> {
    try {
      const result = await this.depositService.initiateDeposit(
        user.id,
        depositDto.amount,
        depositDto.currency,
        depositDto.gateway
      );

      return {
        success: true,
        transactionId: result.transactionId,
        checkoutUrl: result.checkoutUrl,
        reference: result.reference,
        estimatedProcessingTime: result.estimatedProcessingTime
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Post('withdraw')
  @Throttle(10, 60) // 10 requests per minute
  @ApiOperation({ summary: 'Initiate withdrawal' })
  @ApiResponse({ status: 201, description: 'Withdrawal initiated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async initiateWithdrawal(
    @Body() withdrawalDto: WithdrawalDto,
    @CurrentUser() user: { id: string }): Promise<{
    success: boolean;
    transactionId?: string;
    estimatedProcessingTime?: number;
    requirements?: any;
    error?: string;
  }> {
    try {
      const result = await this.withdrawalService.initiateWithdrawal(
        user.id,
        withdrawalDto.walletId,
        withdrawalDto.amount,
        withdrawalDto.destination,
        withdrawalDto.twoFactorCode
      );

      return {
        success: true,
        transactionId: result.transactionId,
        estimatedProcessingTime: result.estimatedProcessingTime,
        requirements: result.requirements
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Post('transfer')
  @Throttle(30, 60) // 30 requests per minute
  @ApiOperation({ summary: 'Transfer funds between wallets' })
  @ApiResponse({ status: 201, description: 'Transfer initiated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async transferFunds(
    @Body() transferDto: TransferDto,
    @CurrentUser() user: { id: string }): Promise<{
    success: boolean;
    fromAmount?: number;
    toAmount?: number;
    exchangeRate?: number;
    fee?: number;
    transactionIds?: string[];
    error?: string;
  }> {
    try {
      // Verify wallets belong to user
      const [fromWallet, toWallet] = await Promise.all([
        this.walletService.getWallet(transferDto.fromWalletId),
        this.walletService.getWallet(transferDto.toWalletId),
      ]);

      if (fromWallet.userId !== user.id || toWallet.userId !== user.id) {
        throw new Error('One or both wallets do not belong to user');
      }

      const result = await this.walletService.convertAndTransfer(
        transferDto.fromWalletId,
        transferDto.toWalletId,
        transferDto.amount
      );

      return {
        success: true,
        fromAmount: result.fromAmount,
        toAmount: result.toAmount,
        exchangeRate: result.exchangeRate,
        fee: result.fee,
        transactionIds: result.transactions.map(tx => tx.id)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get('portfolio/value')
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Get portfolio value across all currencies' })
  @ApiResponse({ status: 200, description: 'Portfolio value retrieved successfully' })
  @ApiQuery({ name: 'targetCurrency', required: false, type: String, description: 'Target currency for valuation' })
  async getPortfolioValue(
    @CurrentUser() user: { id: string },
    @Query('targetCurrency') targetCurrency: string = 'ZAR'): Promise<{
    totalValueZAR: number;
    totalValueUSD: number;
    wallets: Array<{
      currency: string;
      balance: number;
      valueZAR: number;
      valueUSD: number;
    }>;
    lastUpdated: Date;
  }> {
    const portfolioValue = await this.walletService.getPortfolioValue(user.id, targetCurrency);
    return portfolioValue;
  }

  @Get(':id/balance')
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Get real-time wallet balance' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  async getBalance(
    @Param('id') id: string,
    @CurrentUser() user: { id: string }): Promise<{
    available: number;
    locked: number;
    total: number;
    currency: string;
  }> {
    const wallet = await this.walletService.getWallet(id);
    if (wallet.userId !== user.id) {
      throw new Error('Wallet does not belong to user');
    }

    const balance = await this.walletService.getBalance(id);
    return {
      ...balance,
      currency: wallet.currency
    };
  }

  @Get(':walletId/transactions/:transactionId')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully', type: TransactionResponseDto })
  @ApiResponse({ status: 404, description: 'Transaction not found or unauthorized' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getTransaction(
    @Param('walletId') walletId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: { id: string }): Promise<TransactionResponseDto> {
    try {
      // First verify wallet ownership
      const wallet = await this.walletService.getWallet(walletId);
      if (wallet.userId !== user.id) {
        throw new ForbiddenException('Access denied to this wallet');
      }

      // Get transaction with wallet to ensure ownership
      const transaction = await this.walletService.getTransaction(walletId, transactionId);

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      this.logger.log(`Retrieved transaction ${transactionId} for user ${user.id}`);

      return TransactionResponseDto.toDTO(transaction);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error(`Error retrieving transaction ${transactionId} for user ${user.id}:`, error);
      throw new Error('Failed to retrieve transaction');
    }
  }

  @Post('withdraw/:id/cancel')
  @Throttle(10, 60) // 10 requests per minute
  @ApiOperation({ summary: 'Cancel withdrawal' })
  @ApiResponse({ status: 200, description: 'Withdrawal cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel withdrawal' })
  async cancelWithdrawal(
    @Param('id') id: string,
    @CurrentUser() user: { id: string }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.withdrawalService.cancelWithdrawal(id, user.id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
