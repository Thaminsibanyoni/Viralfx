import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

import { Order } from '../../market-aggregation/entities/order.entity';
import { WalletService } from '../../wallet/services/wallet.service';
import { MarketDataService } from '../../market-aggregation/services/market-data.service';
import { ValidationResult } from '../interfaces/order-matching.interface';

@Injectable()
export class OrderValidationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly walletService: WalletService,
    private readonly marketDataService: MarketDataService,
    private readonly configService: ConfigService,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async validateOrder(order: Order, userId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check user wallet balance
      const wallet = await this.walletService.getOrCreateWallet(userId, 'ZAR');
      if (!wallet) {
        errors.push('User wallet not found');
        return { isValid: false, errors, warnings };
      }

      const requiredBalance = order.side === 'BUY'
        ? order.quantity * (order.price || 0)
        : order.quantity;

      if (wallet.available_balance < requiredBalance) {
        errors.push(`Insufficient balance. Required: ${requiredBalance}, Available: ${wallet.available_balance}`);
      }

      // Check market status
      const market = await this.marketDataService.getMarketBySymbol(order.symbol);
      if (!market) {
        errors.push(`Market ${order.symbol} not found`);
        return { isValid: false, errors, warnings };
      }

      if (market.status !== 'OPEN') {
        errors.push(`Market ${order.symbol} is not open for trading`);
      }

      // Check order quantity requirements
      const minQuantity = this.configService.get<number>('MIN_ORDER_QUANTITY', 0.00000001);
      if (order.quantity < minQuantity) {
        errors.push(`Order quantity ${order.quantity} is below minimum ${minQuantity}`);
      }

      // Check price limits (circuit breaker)
      if (order.price) {
        const lastPrice = await this.marketDataService.getLastPrice(order.symbol);
        const circuitBreakerPercentage = this.configService.get<number>('CIRCUIT_BREAKER_PERCENTAGE', 10);
        const maxDeviation = (lastPrice * circuitBreakerPercentage) / 100;
        const minPrice = lastPrice - maxDeviation;
        const maxPrice = lastPrice + maxDeviation;

        if (order.price < minPrice || order.price > maxPrice) {
          errors.push(`Order price ${order.price} is outside circuit breaker limits (${minPrice} - ${maxPrice})`);
        }
      }

      // Check rate limits
      const rateLimitKey = `rate-limit:orders:${userId}`;
      const currentOrders = await this.redis.incr(rateLimitKey);
      if (currentOrders === 1) {
        await this.redis.expire(rateLimitKey, 60); // 1 minute
      }

      const maxOrdersPerMinute = this.configService.get<number>('MAX_ORDERS_PER_MINUTE', 100);
      if (currentOrders > maxOrdersPerMinute) {
        errors.push(`Rate limit exceeded. Max ${maxOrdersPerMinute} orders per minute`);
      }

      // Warnings for large orders
      const largeOrderThreshold = this.configService.get<number>('LARGE_ORDER_THRESHOLD', 100000);
      if (order.quantity * (order.price || 0) > largeOrderThreshold) {
        warnings.push('Large order detected. Market impact may be significant.');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { isValid: false, errors, warnings };
    }
  }

  async validateStopOrder(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!order.stop_price) {
      errors.push('Stop price is required for stop orders');
      return { isValid: false, errors, warnings };
    }

    const currentPrice = await this.marketDataService.getLastPrice(order.symbol);

    if (order.side === 'BUY' && order.stop_price <= currentPrice) {
      errors.push(`Stop price ${order.stop_price} must be greater than current price ${currentPrice} for BUY stop orders`);
    }

    if (order.side === 'SELL' && order.stop_price >= currentPrice) {
      errors.push(`Stop price ${order.stop_price} must be less than current price ${currentPrice} for SELL stop orders`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateStopLossOrder(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!order.stop_price) {
      errors.push('Stop price is required for STOP_LOSS orders');
      return { isValid: false, errors, warnings };
    }

    const currentPrice = await this.marketDataService.getLastPrice(order.symbol);

    // STOP_LOSS is typically used to limit losses, so we validate accordingly
    if (order.side === 'BUY') {
      // Buy STOP_LOSS: price above current market (stop entry to limit losses on short position)
      if (order.stop_price <= currentPrice) {
        errors.push(`STOP_LOSS buy stop price ${order.stop_price} must be greater than current price ${currentPrice}`);
      }
    } else {
      // Sell STOP_LOSS: price below current market (stop loss on long position)
      if (order.stop_price >= currentPrice) {
        errors.push(`STOP_LOSS sell stop price ${order.stop_price} must be less than current price ${currentPrice}`);
      }
    }

    warnings.push('STOP_LOSS order will trigger as MARKET order when stop price is reached');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateTakeProfitOrder(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!order.stop_price) {
      errors.push('Take profit price is required for TAKE_PROFIT orders');
      return { isValid: false, errors, warnings };
    }

    const currentPrice = await this.marketDataService.getLastPrice(order.symbol);

    // TAKE_PROFIT is used to lock in profits
    if (order.side === 'BUY') {
      // Buy TAKE_PROFIT: price below current market (profit target on short position)
      if (order.stop_price >= currentPrice) {
        errors.push(`TAKE_PROFIT buy stop price ${order.stop_price} must be less than current price ${currentPrice}`);
      }
    } else {
      // Sell TAKE_PROFIT: price above current market (profit target on long position)
      if (order.stop_price <= currentPrice) {
        errors.push(`TAKE_PROFIT sell stop price ${order.stop_price} must be greater than current price ${currentPrice}`);
      }
    }

    // Validate limit price if provided for STOP_LIMIT
    if (order.price && order.stop_price) {
      if (order.side === 'SELL' && order.price > order.stop_price) {
        errors.push(`TAKE_PROFIT limit price ${order.price} must be less than or equal to stop price ${order.stop_price} for SELL orders`);
      }
      if (order.side === 'BUY' && order.price < order.stop_price) {
        errors.push(`TAKE_PROFIT limit price ${order.price} must be greater than or equal to stop price ${order.stop_price} for BUY orders`);
      }
    }

    warnings.push('TAKE_PROFIT order will trigger as LIMIT order when take profit price is reached');

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateMarketOrder(order: Order): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check sufficient liquidity in order book
    const orderBook = await this.marketDataService.getOrderBook(order.symbol);
    const availableQuantity = order.side === 'BUY'
      ? orderBook.asks.reduce((sum, ask) => sum + ask.quantity, 0)
      : orderBook.bids.reduce((sum, bid) => sum + bid.quantity, 0);

    if (availableQuantity < order.quantity) {
      errors.push(`Insufficient liquidity. Available: ${availableQuantity}, Requested: ${order.quantity}`);
    }

    // Warning for large market orders
    const liquidityPercentage = (order.quantity / availableQuantity) * 100;
    if (liquidityPercentage > 20) {
      warnings.push(`Large market order (${liquidityPercentage.toFixed(2)}% of available liquidity). Significant slippage expected.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateUpdateOrder(orderId: string, userId: string, updates: Partial<Order>): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });

    if (!order) {
      errors.push('Order not found');
      return { isValid: false, errors, warnings };
    }

    if (order.status !== 'OPEN') {
      errors.push('Only OPEN orders can be updated');
    }

    if (order.order_type !== 'LIMIT') {
      errors.push('Only LIMIT orders can be updated');
    }

    if (updates.quantity && updates.quantity < order.filled_quantity) {
      errors.push('Cannot reduce quantity below filled amount');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}