import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Order } from '../../market-aggregation/entities/order.entity';
import { OrderBookService } from './order-book.service';
import { WalletService } from '../../wallet/services/wallet.service';
import { WebSocketGateway } from '../../websocket/gateways/websocket.gateway';
import { OrderValidationService } from './order-validation.service';
import {
  ExecutionResult,
  MatchResult,
  ValidationResult
} from '../interfaces/order-matching.interface';

@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderBookService: OrderBookService,
    private readonly walletService: WalletService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly orderValidationService: OrderValidationService,
    @InjectQueue('order-execution')
    private readonly orderExecutionQueue: Queue,
  ) {}

  async executeOrder(order: Order): Promise<ExecutionResult> {
    const errors: string[] = [];
    const matches: MatchResult[] = [];

    try {
      this.logger.log(`Executing order ${order.id} for ${order.symbol}`);

      // Validate order
      const validation = await this.validateOrderExecution(order);
      if (!validation.isValid) {
        errors.push(...validation.errors);
        order.status = 'REJECTED';
        order.reject_reason = validation.errors.join('; ');
        await this.orderRepository.save(order);

        return {
          success: false,
          order,
          matches,
          errors,
        };
      }

      // Lock funds for the order
      if (order.order_type === 'LIMIT' || order.order_type === 'STOP') {
        const lockResult = await this.walletService.lockFunds(
          order.userId,
          order.quantity * (order.price || 0),
          'ZAR',
          `Order ${order.id}`,
        );

        if (!lockResult.success) {
          errors.push('Failed to lock funds for order');
          order.status = 'REJECTED';
          order.reject_reason = 'Insufficient funds';
          await this.orderRepository.save(order);

          return {
            success: false,
            order,
            matches,
            errors,
          };
        }
      }

      // Set order status to OPEN for matching
      order.status = 'OPEN';
      order.remaining_quantity = order.quantity;
      order.total_value = order.quantity * (order.price || 0);
      await this.orderRepository.save(order);

      // Handle different order types
      switch (order.order_type) {
        case 'MARKET':
          return await this.executeMarketOrder(order);

        case 'LIMIT':
          return await this.executeLimitOrder(order);

        case 'STOP':
          // Stop orders are stored but not executed until triggered
          await this.orderBookService.addOrder(order);
          return {
            success: true,
            order,
            matches,
            errors,
          };

        case 'STOP_LIMIT':
          // Stop limit orders are stored but not executed until triggered
          await this.orderBookService.addOrder(order);
          return {
            success: true,
            order,
            matches,
            errors,
          };

        default:
          errors.push(`Unsupported order type: ${order.order_type}`);
          order.status = 'REJECTED';
          order.reject_reason = 'Unsupported order type';
          await this.orderRepository.save(order);

          return {
            success: false,
            order,
            matches,
            errors,
          };
      }
    } catch (error) {
      this.logger.error(`Failed to execute order ${order.id}:`, error);
      errors.push(`Execution error: ${error.message}`);

      // Unlock funds on failure
      if (order.order_type === 'LIMIT' || order.order_type === 'STOP') {
        await this.walletService.unlockFunds(
          order.userId,
          order.quantity * (order.price || 0),
          'ZAR',
          `Order ${order.id} execution failed`,
        );
      }

      order.status = 'REJECTED';
      order.reject_reason = error.message;
      await this.orderRepository.save(order);

      return {
        success: false,
        order,
        matches,
        errors,
      };
    }
  }

  async matchOrder(order: Order): Promise<MatchResult[]> {
    try {
      this.logger.log(`Matching order ${order.id} for ${order.symbol}`);

      // Add order to order book if it's a limit order
      if (order.order_type === 'LIMIT') {
        await this.orderBookService.addOrder(order);
      }

      // Execute matching
      const matches = await this.orderBookService.matchOrders(order.symbol);

      if (matches.length > 0) {
        this.logger.log(`Order ${order.id} matched ${matches.length} times`);

        // Broadcast matches
        for (const match of matches) {
          await this.webSocketGateway.server?.emit('order:matched', {
            match,
            timestamp: new Date(),
          });
        }
      }

      return matches;
    } catch (error) {
      this.logger.error(`Failed to match order ${order.id}:`, error);
      throw error;
    }
  }

  async validateOrderExecution(order: Order): Promise<ValidationResult> {
    try {
      // Basic order validation
      const baseValidation = await this.orderValidationService.validateOrder(order, order.userId);
      if (!baseValidation.isValid) {
        return baseValidation;
      }

      // Additional validations based on order type
      switch (order.order_type) {
        case 'MARKET':
          return await this.orderValidationService.validateMarketOrder(order);

        case 'STOP':
          return await this.orderValidationService.validateStopOrder(order);

        case 'STOP_LOSS':
          // Check if we have original API order type info in metadata
          if (order.metadata?.originalOrderType === 'STOP_LOSS') {
            return await this.orderValidationService.validateStopLossOrder(order);
          }
          return await this.orderValidationService.validateStopOrder(order);

        case 'TAKE_PROFIT':
          // Check if we have original API order type info in metadata
          if (order.metadata?.originalOrderType === 'TAKE_PROFIT') {
            return await this.orderValidationService.validateTakeProfitOrder(order);
          }
          return await this.orderValidationService.validateTakeProfitOrder(order);

        case 'LIMIT':
          // Limit orders are generally valid if they have price
          if (!order.price) {
            return {
              isValid: false,
              errors: ['Price is required for limit orders'],
              warnings: [],
            };
          }
          break;

        case 'STOP_LIMIT':
          if (!order.price || !order.stop_price) {
            return {
              isValid: false,
              errors: ['Both price and stop price are required for stop limit orders'],
              warnings: [],
            };
          }
          break;
      }

      return {
        isValid: true,
        errors: [],
        warnings: baseValidation.warnings,
      };
    } catch (error) {
      this.logger.error(`Failed to validate order execution:`, error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
      };
    }
  }

  private async executeMarketOrder(order: Order): Promise<ExecutionResult> {
    const errors: string[] = [];
    const matches: MatchResult[] = [];

    try {
      // Get current order book
      const orderBook = await this.orderBookService.getOrderBook(order.symbol, 50);

      if (!orderBook) {
        errors.push('Order book not available');
        order.status = 'REJECTED';
        order.reject_reason = 'Order book not available';
        await this.orderRepository.save(order);

        return {
          success: false,
          order,
          matches,
          errors,
        };
      }

      const oppositeSide = order.side === 'BUY' ? orderBook.asks : orderBook.bids;
      let remainingQuantity = order.quantity;
      let totalCost = 0;
      const executedOrders: string[] = [];

      // Execute market order immediately
      for (const bookEntry of oppositeSide) {
        if (remainingQuantity <= 0) break;

        const executeQuantity = Math.min(remainingQuantity, bookEntry.quantity);
        const executePrice = bookEntry.price;
        const cost = executeQuantity * executePrice;

        // Create match
        const match: MatchResult = {
          bidOrderId: order.side === 'BUY' ? order.id : bookEntry.orderId,
          askOrderId: order.side === 'SELL' ? order.id : bookEntry.orderId,
          quantity: executeQuantity,
          price: executePrice,
          bidUserId: order.side === 'BUY' ? order.userId : bookEntry.userId,
          askUserId: order.side === 'SELL' ? order.userId : bookEntry.userId,
          timestamp: new Date(),
          tradeId: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };

        matches.push(match);
        executedOrders.push(bookEntry.orderId);
        totalCost += cost;
        remainingQuantity -= executeQuantity;
      }

      // Check if order was fully filled
      if (remainingQuantity > 0) {
        errors.push(`Insufficient liquidity. ${remainingQuantity} quantity could not be filled`);

        if (order.time_in_force === 'IOC') {
          // Immediate or Cancel - partially filled orders are cancelled
          order.status = 'PARTIAL_FILLED';
        } else if (order.time_in_force === 'FOK') {
          // Fill or Kill - reject entire order if not fully filled
          order.status = 'REJECTED';
          order.reject_reason = 'Insufficient liquidity for Fill or Kill order';
          await this.orderRepository.save(order);

          return {
            success: false,
            order,
            matches,
            errors,
          };
        }
      } else {
        order.status = 'FILLED';
        order.filled_at = new Date();
      }

      // Update order details
      order.filled_quantity = order.quantity - remainingQuantity;
      order.remaining_quantity = remainingQuantity;
      order.avg_fill_price = matches.length > 0
        ? matches.reduce((sum, match) => sum + match.price * match.quantity, 0) / order.filled_quantity
        : 0;
      order.commission = totalCost * 0.001; // 0.1% commission
      order.fee = totalCost * 0.0001; // 0.01% fee

      // Create fills record
      order.fills = matches.map(match => ({
        id: `fill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: match.quantity,
        price: match.price,
        commission: match.quantity * match.price * 0.001,
        fee: match.quantity * match.price * 0.0001,
        timestamp: match.timestamp,
        tradeId: match.tradeId,
      }));

      await this.orderRepository.save(order);

      // Broadcast order filled
      await this.webSocketGateway.broadcastOrderFilled(order);

      return {
        success: true,
        order,
        matches,
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to execute market order ${order.id}:`, error);
      errors.push(`Market order execution error: ${error.message}`);

      return {
        success: false,
        order,
        matches,
        errors,
      };
    }
  }

  private async executeLimitOrder(order: Order): Promise<ExecutionResult> {
    const errors: string[] = [];
    const matches: MatchResult[] = [];

    try {
      // Add order to order book
      await this.orderBookService.addOrder(order);

      // Try to match immediately
      const immediateMatches = await this.orderBookService.matchOrders(order.symbol);
      matches.push(...immediateMatches);

      // Update order status based on matches
      if (order.remaining_quantity <= 0) {
        order.status = 'FILLED';
        order.filled_at = new Date();
        await this.webSocketGateway.broadcastOrderFilled(order);
      } else if (order.filled_quantity > 0) {
        order.status = 'PARTIAL_FILLED';
        await this.webSocketGateway.broadcastOrderFilled(order);
      }

      await this.orderRepository.save(order);

      return {
        success: true,
        order,
        matches,
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to execute limit order ${order.id}:`, error);
      errors.push(`Limit order execution error: ${error.message}`);

      return {
        success: false,
        order,
        matches,
        errors,
      };
    }
  }

  async cancelOrder(orderId: string, userId: string, reason?: string): Promise<ExecutionResult> {
    const errors: string[] = [];

    try {
      const order = await this.orderRepository.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        errors.push('Order not found');
        return {
          success: false,
          order: null,
          matches: [],
          errors,
        };
      }

      if (!order.is_active) {
        errors.push('Order cannot be cancelled');
        return {
          success: false,
          order,
          matches: [],
          errors,
        };
      }

      // Unlock funds for limit orders
      if (order.order_type === 'LIMIT' && order.status === 'OPEN') {
        const lockedAmount = order.remaining_quantity * order.price;
        await this.walletService.unlockFunds(
          userId,
          lockedAmount,
          'ZAR',
          `Cancelled order ${orderId}${reason ? ` - ${reason}` : ''}`,
        );
      }

      // Update order status
      order.status = 'CANCELLED';
      order.cancelled_at = new Date();
      order.reject_reason = reason || 'User cancelled';

      await this.orderRepository.save(order);
      await this.orderBookService.removeOrder(order);

      // Broadcast cancellation
      await this.webSocketGateway.server?.emit('order:cancelled', {
        orderId: order.id,
        userId: order.userId,
        timestamp: new Date(),
      });

      return {
        success: true,
        order,
        matches: [],
        errors,
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order ${orderId}:`, error);
      errors.push(`Cancellation error: ${error.message}`);

      return {
        success: false,
        order: null,
        matches: [],
        errors,
      };
    }
  }
}