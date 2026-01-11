import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { Order } from "../../market-aggregation/interfaces/order.interface";
import { OrderBookService } from "./order-book.service";
import { WalletService } from "../../wallet/services/wallet.service";
import { OrderValidationService } from "./order-validation.service";
import {
  ExecutionResult,
  MatchResult,
  ValidationResult
} from '../interfaces/order-matching.interface';

@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderBookService: OrderBookService,
    private readonly walletService: WalletService,
    private readonly orderValidationService: OrderValidationService,
    @InjectQueue('order-execution')
    private readonly orderExecutionQueue: Queue) {}

  async executeOrder(order: Order): Promise<ExecutionResult> {
    const errors: string[] = [];
    const matches: MatchResult[] = [];

    try {
      this.logger.log(`Executing order ${order.id} for ${order.symbol}`);

      // Validate order
      const validation = await this.validateOrderExecution(order);
      if (!validation.isValid) {
        errors.push(...validation.errors);

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'REJECTED',
            reject_reason: validation.errors.join('; '),
            is_active: false
          }
        });

        return {
          success: false,
          order: null,
          matches,
          errors
        };
      }

      // Lock funds for the order
      if ((order.type === 'LIMIT' || order.type === 'STOP') && order.price) {
        const lockResult = await this.walletService.lockFunds(
          order.userId,
          order.quantity * order.price,
          'ZAR',
          `Order ${order.id}`
        );

        if (!lockResult.success) {
          errors.push('Failed to lock funds for order');

          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'REJECTED',
              reject_reason: 'Insufficient funds',
              is_active: false
            }
          });

          return {
            success: false,
            order: null,
            matches,
            errors
          };
        }
      }

      // Set order status to OPEN for matching
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'OPEN',
          remaining_quantity: order.quantity,
          total_value: order.quantity * (order.price || 0)
        }
      });

      // Handle different order types
      switch (order.type) {
        case 'MARKET':
          return await this.executeMarketOrder(order);

        case 'LIMIT':
          return await this.executeLimitOrder(order);

        case 'STOP':
          // Stop orders are stored but not executed until triggered
          await this.orderBookService.addOrder(order);
          return {
            success: true,
            order: await this.getOrder(order.id),
            matches,
            errors
          };

        case 'STOP_LIMIT':
          // Stop limit orders are stored but not executed until triggered
          await this.orderBookService.addOrder(order);
          return {
            success: true,
            order: await this.getOrder(order.id),
            matches,
            errors
          };

        default:
          errors.push(`Unsupported order type: ${order.type}`);

          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'REJECTED',
              reject_reason: 'Unsupported order type',
              is_active: false
            }
          });

          return {
            success: false,
            order: null,
            matches,
            errors
          };
      }
    } catch (error) {
      this.logger.error(`Failed to execute order ${order.id}:`, error);
      errors.push(`Execution error: ${error.message}`);

      // Unlock funds on failure
      if ((order.type === 'LIMIT' || order.type === 'STOP') && order.price) {
        try {
          await this.walletService.unlockFunds(
            order.userId,
            order.quantity * order.price,
            'ZAR',
            `Order ${order.id} execution failed`
          );
        } catch (unlockError) {
          this.logger.error(`Failed to unlock funds for order ${order.id}:`, unlockError);
        }
      }

      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'REJECTED',
          reject_reason: error.message,
          is_active: false
        }
      });

      return {
        success: false,
        order: null,
        matches,
        errors
      };
    }
  }

  async matchOrder(order: Order): Promise<MatchResult[]> {
    try {
      this.logger.log(`Matching order ${order.id} for ${order.symbol}`);

      // Add order to order book if it's a limit order
      if (order.type === 'LIMIT') {
        await this.orderBookService.addOrder(order);
      }

      // Execute matching
      const matches = await this.orderBookService.matchOrders(order.symbol);

      if (matches.length > 0) {
        this.logger.log(`Order ${order.id} matched ${matches.length} times`);

        // Broadcast matches
        for (const match of matches) {
          try {
            await this.webSocketGateway.server?.emit('order:matched', {
              match,
              timestamp: new Date()
            });
          } catch (wsError) {
            this.logger.warn(`Failed to broadcast order match: ${wsError.message}`);
          }
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
      switch (order.type) {
        case 'MARKET':
          return await this.orderValidationService.validateMarketOrder(order);

        case 'STOP':
          return await this.orderValidationService.validateStopOrder(order);

        case 'STOP_LOSS':
          // Check if we have original API order type info in metadata
          if ((order as any).metadata?.originalOrderType === 'STOP_LOSS') {
            return await this.orderValidationService.validateStopLossOrder(order);
          }
          return await this.orderValidationService.validateStopOrder(order);

        case 'TAKE_PROFIT':
          // Check if we have original API order type info in metadata
          if ((order as any).metadata?.originalOrderType === 'TAKE_PROFIT') {
            return await this.orderValidationService.validateTakeProfitOrder(order);
          }
          return await this.orderValidationService.validateTakeProfitOrder(order);

        case 'LIMIT':
          // Limit orders are generally valid if they have price
          if (!order.price) {
            return {
              isValid: false,
              errors: ['Price is required for limit orders'],
              warnings: []
            };
          }
          break;

        case 'STOP_LIMIT':
          if (!order.price || !order.stopPrice) {
            return {
              isValid: false,
              errors: ['Both price and stop price are required for stop limit orders'],
              warnings: []
            };
          }
          break;
      }

      return {
        isValid: true,
        errors: [],
        warnings: baseValidation.warnings
      };
    } catch (error) {
      this.logger.error(`Failed to validate order execution:`, error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
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

        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'REJECTED',
            reject_reason: 'Order book not available',
            is_active: false
          }
        });

        return {
          success: false,
          order: null,
          matches,
          errors
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
          tradeId: `trade_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
        };

        matches.push(match);
        executedOrders.push(bookEntry.orderId);
        totalCost += cost;
        remainingQuantity -= executeQuantity;
      }

      // Determine final order status
      let finalStatus = 'OPEN';
      const timeInForce = (order as any).timeInForce || 'GTC';

      if (remainingQuantity > 0) {
        errors.push(`Insufficient liquidity. ${remainingQuantity} quantity could not be filled`);

        if (timeInForce === 'IOC') {
          // Immediate or Cancel - partially filled orders are cancelled
          finalStatus = 'PARTIAL_FILLED';
        } else if (timeInForce === 'FOK') {
          // Fill or Kill - reject entire order if not fully filled
          await this.prisma.order.update({
            where: { id: order.id },
            data: {
              status: 'REJECTED',
              reject_reason: 'Insufficient liquidity for Fill or Kill order',
              is_active: false
            }
          });

          return {
            success: false,
            order: null,
            matches,
            errors
          };
        }
      } else {
        finalStatus = 'FILLED';
      }

      // Update order details
      const filledQuantity = order.quantity - remainingQuantity;
      const avgFillPrice = matches.length > 0
        ? matches.reduce((sum, match) => sum + match.price * match.quantity, 0) / filledQuantity
        : 0;
      const commission = totalCost * 0.001; // 0.1% commission
      const fee = totalCost * 0.0001; // 0.01% fee

      // Create fills record
      const fills = matches.map(match => ({
        id: `fill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        quantity: match.quantity,
        price: match.price,
        commission: match.quantity * match.price * 0.001,
        fee: match.quantity * match.price * 0.0001,
        timestamp: match.timestamp,
        tradeId: match.tradeId
      }));

      const updateData: any = {
        filled_quantity: filledQuantity,
        remaining_quantity: remainingQuantity,
        avg_fill_price: avgFillPrice,
        commission,
        fee,
        fills,
        status: finalStatus,
        is_active: finalStatus === 'OPEN'
      };

      if (finalStatus === 'FILLED') {
        updateData.filled_at = new Date();
        updateData.is_active = false;
      }

      const updatedOrder = await this.prisma.order.update({
        where: { id: order.id },
        data: updateData
      });

      // Broadcast order filled
      try {
        await this.webSocketGateway.broadcastOrderFilled({
          id: updatedOrder.id,
          userId: updatedOrder.userId,
          symbol: updatedOrder.symbol,
          side: updatedOrder.side as 'BUY' | 'SELL',
          type: updatedOrder.order_type,
          quantity: updatedOrder.quantity,
          price: updatedOrder.price || undefined,
          createdAt: updatedOrder.created_at
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast order filled: ${wsError.message}`);
      }

      return {
        success: finalStatus !== 'REJECTED',
        order: updatedOrder,
        matches,
        errors
      };
    } catch (error) {
      this.logger.error(`Failed to execute market order ${order.id}:`, error);
      errors.push(`Market order execution error: ${error.message}`);

      return {
        success: false,
        order: null,
        matches,
        errors
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

      // Get updated order to check status
      const updatedOrder = await this.getOrder(order.id);

      if (!updatedOrder) {
        errors.push('Order not found after matching');
        return {
          success: false,
          order: null,
          matches,
          errors
        };
      }

      // Broadcast order status
      try {
        if (updatedOrder.status === 'FILLED' || updatedOrder.status === 'PARTIAL_FILLED') {
          await this.webSocketGateway.broadcastOrderFilled({
            id: updatedOrder.id,
            userId: updatedOrder.userId,
            symbol: updatedOrder.symbol,
            side: updatedOrder.side as 'BUY' | 'SELL',
            type: updatedOrder.order_type,
            quantity: updatedOrder.quantity,
            price: updatedOrder.price || undefined,
            createdAt: updatedOrder.created_at
          });
        }
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast order filled: ${wsError.message}`);
      }

      return {
        success: true,
        order: updatedOrder,
        matches,
        errors
      };
    } catch (error) {
      this.logger.error(`Failed to execute limit order ${order.id}:`, error);
      errors.push(`Limit order execution error: ${error.message}`);

      return {
        success: false,
        order: null,
        matches,
        errors
      };
    }
  }

  async cancelOrder(orderId: string, userId: string, reason?: string): Promise<ExecutionResult> {
    const errors: string[] = [];

    try {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, userId }
      });

      if (!order) {
        errors.push('Order not found');
        return {
          success: false,
          order: null,
          matches: [],
          errors
        };
      }

      if (!order.is_active && order.status !== 'OPEN') {
        errors.push('Order cannot be cancelled');
        return {
          success: false,
          order,
          matches: [],
          errors
        };
      }

      // Unlock funds for limit orders
      if (order.order_type === 'LIMIT' && order.status === 'OPEN' && order.price) {
        const lockedAmount = (order.remaining_quantity || order.quantity) * order.price;
        try {
          await this.walletService.unlockFunds(
            userId,
            lockedAmount,
            'ZAR',
            `Cancelled order ${orderId}${reason ? ` - ${reason}` : ''}`
          );
        } catch (unlockError) {
          this.logger.error(`Failed to unlock funds for order ${orderId}:`, unlockError);
        }
      }

      // Update order status
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelled_at: new Date(),
          reject_reason: reason || 'User cancelled',
          is_active: false
        }
      });

      // Remove from order book
      try {
        await this.orderBookService.removeOrder({
          id: updatedOrder.id,
          userId: updatedOrder.userId,
          symbol: updatedOrder.symbol,
          side: updatedOrder.side as 'BUY' | 'SELL',
          quantity: updatedOrder.quantity,
          price: updatedOrder.price || undefined,
          createdAt: updatedOrder.created_at
        });
      } catch (removeError) {
        this.logger.warn(`Failed to remove order ${orderId} from order book:`, removeError);
      }

      // Broadcast cancellation
      try {
        await this.webSocketGateway.server?.emit('order:cancelled', {
          orderId: updatedOrder.id,
          userId: updatedOrder.userId,
          timestamp: new Date()
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast order cancellation: ${wsError.message}`);
      }

      return {
        success: true,
        order: updatedOrder,
        matches: [],
        errors
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order ${orderId}:`, error);
      errors.push(`Cancellation error: ${error.message}`);

      return {
        success: false,
        order: null,
        matches: [],
        errors
      };
    }
  }

  /**
   * Helper method to get order by ID
   */
  private async getOrder(orderId: string): Promise<any> {
    return await this.prisma.order.findFirst({
      where: { id: orderId }
    });
  }
}
