import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  InjectQueue,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Queue } from 'bull';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

import { MatchingEngineService } from '../services/matching-engine.service';
import { OrderBookService } from '../services/order-book.service';
import { OrderValidationService } from '../services/order-validation.service';
import { PlaceOrderDto } from '../dto/place-order.dto';
import { CancelOrderDto } from '../dto/cancel-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { OrderResponseDto } from '../dto/order-response.dto';
import { Order } from '../../market-aggregation/entities/order.entity';
import { ClientAttributionService } from '../../brokers/services/client-attribution.service';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly matchingEngineService: MatchingEngineService,
    private readonly orderBookService: OrderBookService,
    private readonly orderValidationService: OrderValidationService,
    private readonly clientAttributionService: ClientAttributionService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectQueue('order-execution')
    private readonly orderExecutionQueue: Queue,
    @InjectQueue('order-settlement')
    private readonly orderSettlementQueue: Queue,
  ) {}

  @Post()
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Place a new order' })
  @ApiResponse({ status: 201, description: 'Order placed successfully', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async placeOrder(
    @Body() placeOrderDto: PlaceOrderDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ success: boolean; order: OrderResponseDto; errors?: string[] }> {
    try {
      // Create order entity with mapping layer
      const order = new Order();
      order.userId = user.id;
      order.symbol = placeOrderDto.symbol;
      order.side = placeOrderDto.side;
      order.quantity = placeOrderDto.quantity;
      order.time_in_force = placeOrderDto.timeInForce || 'GTC';
      order.client_order_id = placeOrderDto.clientOrderId;
      order.status = 'PENDING';
      order.filled_quantity = 0;
      order.remaining_quantity = placeOrderDto.quantity;
      order.commission = 0;
      order.fee = 0;
      order.source = 'API';
      order.metadata = { originalOrderType: placeOrderDto.orderType };

      // Map external order types to internal order types
      switch (placeOrderDto.orderType) {
        case 'STOP_LOSS':
          order.order_type = 'STOP';
          order.stop_price = placeOrderDto.stopPrice;
          break;
        case 'TAKE_PROFIT':
          order.order_type = 'STOP_LIMIT';
          order.stop_price = placeOrderDto.takeProfitPrice;
          order.price = placeOrderDto.price; // Optional limit price for take profit
          break;
        case 'MARKET':
          order.order_type = 'MARKET';
          order.price = placeOrderDto.price;
          break;
        case 'LIMIT':
          order.order_type = 'LIMIT';
          order.price = placeOrderDto.price;
          break;
        default:
          order.order_type = placeOrderDto.orderType as any;
      }

      // Handle broker attribution
      if (placeOrderDto.brokerId) {
        order.broker_id = placeOrderDto.brokerId;
      } else {
        // Try to get broker from user relationship
        try {
          const userBrokerId = await this.clientAttributionService.getUserBrokerId(user.id);
          if (userBrokerId) {
            order.broker_id = userBrokerId;
          }
        } catch (error) {
          // Continue without broker if lookup fails
          this.logger.warn('Failed to lookup user broker:', error.message);
        }
      }

      // Save order to get valid ID
      const savedOrder = await this.orderRepository.save(order);

      // Enqueue order for execution
      await this.orderExecutionQueue.add(
        'execute-order',
        {
          orderId: savedOrder.id,
          userId: user.id,
          orderData: savedOrder
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        }
      );

      // Trigger commission attribution asynchronously
      if (savedOrder.broker_id) {
        this.clientAttributionService.processCommissionAttribution(savedOrder.id).catch(error => {
          this.logger.error('Failed to process commission attribution:', error.stack || error.message);
        });
      }

      return {
        success: true,
        order: OrderResponseDto.toDTO(savedOrder),
        errors: undefined,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'symbol', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'orderType', required: false, type: String })
  @ApiQuery({ name: 'side', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  async getOrders(
    @CurrentUser() user: { id: string },
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('symbol') symbol?: string,
    @Query('status') status?: string,
    @Query('orderType') orderType?: string,
    @Query('side') side?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<{ orders: OrderResponseDto[]; total: number; page: number; limit: number }> {
    try {
      const skip = (page - 1) * limit;

      // Build query
      const query = this.orderRepository.createQueryBuilder('order')
        .where('order.userId = :userId', { userId: user.id });

      // Apply filters
      if (symbol) {
        query.andWhere('order.symbol = :symbol', { symbol });
      }

      if (status) {
        query.andWhere('order.status = :status', { status });
      }

      if (orderType) {
        query.andWhere('order.order_type = :orderType', { orderType });
      }

      if (side) {
        query.andWhere('order.side = :side', { side });
      }

      if (dateFrom) {
        query.andWhere('order.created_at >= :dateFrom', {
          dateFrom: new Date(dateFrom)
        });
      }

      if (dateTo) {
        query.andWhere('order.created_at <= :dateTo', {
          dateTo: new Date(dateTo)
        });
      }

      // Get total count
      const total = await query.getCount();

      // Get orders with pagination
      const orders = await query
        .orderBy('order.created_at', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      // Convert to DTOs
      const orderDtos = orders.map(order => OrderResponseDto.toDTO(order));

      return {
        orders: orderDtos,
        total,
        page,
        limit,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<OrderResponseDto> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id, userId: user.id }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return OrderResponseDto.toDTO(order);
    } catch (error) {
      throw error;
    }
  }

  @Patch(':id')
  @Throttle(30, 60) // 30 requests per minute
  @ApiOperation({ summary: 'Update order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrder(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ success: boolean; order?: OrderResponseDto; errors?: string[] }> {
    try {
      // Validate update request
      const validation = await this.orderValidationService.validateUpdateOrder(
        id,
        user.id,
        updateOrderDto,
      );

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      // Get existing order
      const order = await this.orderRepository.findOne({
        where: { id, userId: user.id }
      });

      if (!order) {
        return {
          success: false,
          errors: ['Order not found'],
        };
      }

      // Apply allowed updates
      if (updateOrderDto.price !== undefined) {
        order.price = updateOrderDto.price;
      }

      if (updateOrderDto.quantity !== undefined) {
        if (updateOrderDto.quantity < order.filled_quantity) {
          return {
            success: false,
            errors: ['Cannot reduce quantity below filled amount'],
          };
        }
        order.quantity = updateOrderDto.quantity;
        order.remaining_quantity = order.quantity - order.filled_quantity;
      }

      // Save updated order
      const updatedOrder = await this.orderRepository.save(order);

      return {
        success: true,
        order: OrderResponseDto.toDTO(updatedOrder),
      };
    } catch (error) {
      throw error;
    }
  }

  @Delete(':id')
  @Throttle(30, 60) // 30 requests per minute
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  async cancelOrder(
    @Param('id') id: string,
    @Body() cancelOrderDto: CancelOrderDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ success: boolean; order?: OrderResponseDto; errors?: string[] }> {
    try {
      const result = await this.matchingEngineService.cancelOrder(
        id,
        user.id,
        cancelOrderDto.reason,
      );

      return {
        success: result.success,
        order: result.order ? OrderResponseDto.toDTO(result.order) : undefined,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get(':id/fills')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get order fill history' })
  @ApiResponse({ status: 200, description: 'Fill history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderFills(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ): Promise<{ fills: any[] }> {
    try {
      const order = await this.orderRepository.findOne({
        where: { id, userId: user.id }
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      return { fills: order.fills || [] };
    } catch (error) {
      throw error;
    }
  }

  @Get('orderbook/:symbol')
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Get order book for symbol' })
  @ApiResponse({ status: 200, description: 'Order book retrieved successfully' })
  @ApiQuery({ name: 'depth', required: false, type: Number, description: 'Order book depth' })
  async getOrderBook(
    @Param('symbol') symbol: string,
    @Query('depth') depth: number = 20,
  ): Promise<any> {
    const orderBook = await this.orderBookService.getOrderBook(symbol, depth);
    return orderBook;
  }

  @Get('depth/:symbol')
  @Throttle(100, 60) // 100 requests per minute
  @ApiOperation({ summary: 'Get market depth for symbol' })
  @ApiResponse({ status: 200, description: 'Market depth retrieved successfully' })
  @ApiQuery({ name: 'levels', required: false, type: Number, description: 'Number of depth levels' })
  async getMarketDepth(
    @Param('symbol') symbol: string,
    @Query('levels') levels: number = 10,
  ): Promise<any> {
    const depth = await this.orderBookService.getMarketDepth(symbol, levels);
    return depth;
  }

  @Get('stats/:symbol')
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get order book statistics for symbol' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getOrderBookStats(@Param('symbol') symbol: string): Promise<any> {
    const stats = await this.orderBookService.getOrderBookStats(symbol);
    return stats;
  }
}