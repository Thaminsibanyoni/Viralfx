import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
// In-memory order storage for development
const orders = new Map<string, any>();
let orderIdCounter = 1;

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { PlaceOrderDto } from "../../websocket/dto/place-order.dto";

interface OrderFill {
  id: string;
  quantity: number;
  price: number;
  commission: number;
  fee: number;
  timestamp: Date;
  tradeId?: string;
}

interface OrderResponse {
  id: string;
  userId: string;
  symbol: string;
  trendId?: string;
  side: string;
  type: string;
  quantity: number;
  price?: number;
  stopPrice?: number;
  filledQuantity: number;
  remainingQuantity: number;
  status: string;
  avgFillPrice?: number;
  commission: number;
  fee: number;
  timeInForce?: string;
  fills?: OrderFill[];
  createdAt: Date;
  updatedAt: Date;
  filledAt?: Date;
  cancelledAt?: Date;
}

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    @InjectQueue('order-processing')
    private readonly orderQueue: Queue) {}

  @Post()
  @ApiOperation({ summary: 'Place a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(
    @Body() orderDto: PlaceOrderDto,
    @CurrentUser() user: any): Promise<any> {
    const startTime = Date.now();
    try {
      this.logger.log(`Placing order for user ${user.id}: ${JSON.stringify(orderDto)}`);

      // Validate order data
      if (!orderDto.trendId) {
        throw new BadRequestException('trendId is required');
      }

      if (!orderDto.orderSide || !['BUY', 'SELL'].includes(orderDto.orderSide)) {
        throw new BadRequestException('Invalid order side. Must be BUY or SELL');
      }

      if (!orderDto.orderType || !['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'].includes(orderDto.orderType)) {
        throw new BadRequestException('Invalid order type. Must be MARKET, LIMIT, STOP, or STOP_LIMIT');
      }

      if (!orderDto.quantity || orderDto.quantity <= 0) {
        throw new BadRequestException('Quantity must be a positive number');
      }

      // Additional validation for limit orders
      if ((orderDto.orderType === 'LIMIT' || orderDto.orderType === 'STOP_LIMIT') && !orderDto.price) {
        throw new BadRequestException('Price is required for LIMIT and STOP_LIMIT orders');
      }

      // Additional validation for stop orders
      if ((orderDto.orderType === 'STOP' || orderDto.orderType === 'STOP_LIMIT') && !orderDto.stopPrice) {
        throw new BadRequestException('Stop price is required for STOP and STOP_LIMIT orders');
      }

      // Validate price is positive for limit orders
      if (orderDto.price && orderDto.price <= 0) {
        throw new BadRequestException('Price must be a positive number');
      }

      // Determine symbol
      const symbol = `VIRAL/${orderDto.trendId}`;

      // Generate order ID
      const orderId = `ORDER_${Date.now()}_${orderIdCounter++}`;

      // Create order in memory
      const order = {
        id: orderId,
        userId: user.id,
        symbol: symbol,
        trendId: orderDto.trendId,
        side: orderDto.orderSide,
        order_type: orderDto.orderType,
        quantity: orderDto.quantity,
        price: orderDto.price || null,
        stop_price: orderDto.stopPrice || null,
        status: 'PENDING',
        filled_quantity: 0,
        remaining_quantity: orderDto.quantity,
        commission: 0,
        fee: 0,
        time_in_force: orderDto.timeInForce || 'GTC',
        is_active: true,
        fills: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        filled_at: null,
        cancelled_at: null,
        avg_fill_price: null
      };

      // Store order in memory
      orders.set(orderId, order);

      this.logger.debug(`Created order ${orderId} for user ${user.id}`);

      // Queue order processing job
      await this.orderQueue.add('process-order', {
        orderId: order.id
      }, {
        priority: orderDto.orderType === 'MARKET' ? 10 : 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      });

      // Broadcast order creation to user
      try {
        this.webSocketGateway.broadcastToUser(user.id, 'order-created', {
          orderId: order.id,
          symbol: order.symbol,
          trendId: order.trendId,
          side: order.side,
          orderType: order.order_type,
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stop_price,
          status: order.status,
          timestamp: order.createdAt.toISOString()
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast order creation: ${wsError.message}`);
      }

      const processingTime = Date.now() - startTime;
      this.logger.log(`Order ${order.id} created in ${processingTime}ms`);

      return {
        success: true,
        data: {
          orderId: order.id,
          symbol: order.symbol,
          trendId: order.trendId,
          side: order.side,
          orderType: order.order_type,
          quantity: order.quantity,
          price: order.price,
          stopPrice: order.stop_price,
          status: order.status,
          timeInForce: order.time_in_force,
          createdAt: order.createdAt
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to place order for user ${user.id}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Failed to place order'
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'OPEN', 'FILLED', 'PARTIAL_FILLED', 'CANCELLED', 'REJECTED'], required: false })
  @ApiQuery({ name: 'symbol', type: String, required: false })
  @ApiQuery({ name: 'side', enum: ['BUY', 'SELL'], required: false })
  @ApiQuery({ name: 'type', enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'], required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async getUserOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
    @Query('side') side?: string,
    @Query('type') type?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0): Promise<any> {
    try {
      // Validate and sanitize query parameters
      limit = Math.min(Math.max(1, limit || 50), 100);
      offset = Math.max(0, offset || 0);

      this.logger.debug(`Fetching orders for user ${user.id} with filters:`, {
        status,
        symbol,
        side,
        type,
        limit,
        offset
      });

      // Build filters
      const filters: any = {
        userId: user.id
      };

      if (status) {
        filters.status = status;
      }

      if (symbol) {
        filters.symbol = symbol;
      }

      if (side) {
        filters.side = side;
      }

      if (type) {
        filters.order_type = type;
      }

      // Get orders from memory
      let orderArray = Array.from(orders.values()).filter(order => {
        // Apply filters
        for (const [key, value] of Object.entries(filters)) {
          if (order[key] !== value) {
            return false;
          }
        }
        return true;
      });

      // Sort by createdAt descending
      orderArray.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination
      const total = orderArray.length;
      const startIndex = offset;
      const endIndex = startIndex + limit;
      const paginatedOrders = orderArray.slice(startIndex, endIndex);

      // Transform orders to response format
      const transformedOrders = paginatedOrders.map(order => this.transformOrder(order));

      return {
        success: true,
        data: transformedOrders,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + paginatedOrders.length < total
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve user orders for user ${user.id}:`, error);
      throw new InternalServerErrorException(
        error.message || 'Failed to retrieve user orders'
      );
    }
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Get order details' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Unauthorized access to order' })
  async getOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      this.logger.debug(`Fetching order ${orderId} for user ${user.id}`);

      const order = orders.get(orderId);

      // Check if order exists and belongs to user
      if (!order || order.userId !== user.id) {
        throw new NotFoundException('Order not found or unauthorized');
      }

      return {
        success: true,
        data: this.transformOrder(order),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve order ${orderId} for user ${user.id}:`, error);

      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Failed to retrieve order details'
      );
    }
  }

  @Delete(':orderId')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Unauthorized access to order' })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  async cancelOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      this.logger.log(`Cancelling order ${orderId} for user ${user.id}`);

      // Get order first to check if it can be cancelled
      const order = orders.get(orderId);

      if (!order || order.userId !== user.id) {
        throw new NotFoundException('Order not found or unauthorized');
      }

      // Check if order can be cancelled
      if (!['PENDING', 'OPEN', 'PARTIAL_FILLED'].includes(order.status)) {
        throw new BadRequestException(
          `Order cannot be cancelled. Current status: ${order.status}`
        );
      }

      // Update order status to CANCELLED
      const updatedOrder = {
        ...order,
        status: 'CANCELLED',
        cancelled_at: new Date(),
        is_active: false,
        updatedAt: new Date()
      };

      // Update in memory
      orders.set(orderId, updatedOrder);

      this.logger.log(`Order ${orderId} cancelled successfully`);

      // Broadcast cancellation to user
      try {
        this.webSocketGateway.broadcastToUser(user.id, 'order-cancelled', {
          orderId: updatedOrder.id,
          status: updatedOrder.status,
          cancelledAt: updatedOrder.cancelled_at?.toISOString()
        });
      } catch (wsError) {
        this.logger.warn(`Failed to broadcast order cancellation: ${wsError.message}`);
      }

      return {
        success: true,
        data: this.transformOrder(updatedOrder),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to cancel order ${orderId} for user ${user.id}:`, error);

      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Failed to cancel order'
      );
    }
  }

  @Get(':orderId/fills')
  @ApiOperation({ summary: 'Get order fill history' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Fill history retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderFills(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      this.logger.debug(`Fetching fills for order ${orderId} for user ${user.id}`);

      // Verify order exists and belongs to user
      const order = orders.get(orderId);

      if (!order || order.userId !== user.id) {
        throw new NotFoundException('Order not found or unauthorized');
      }

      // Get fills from order
      let fills: OrderFill[] = [];
      if (Array.isArray(order.fills)) {
        fills = order.fills;
      }

      // Calculate fill statistics
      const totalFilledQuantity = fills.reduce((sum, fill) => sum + (fill.quantity || 0), 0);
      const averagePrice = totalFilledQuantity > 0
        ? fills.reduce((sum, fill) => sum + ((fill.price || 0) * (fill.quantity || 0)), 0) / totalFilledQuantity
        : 0;

      return {
        success: true,
        data: {
          orderId,
          fills,
          totalFilledQuantity,
          averagePrice,
          fillCount: fills.length
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve fills for order ${orderId} for user ${user.id}:`, error);

      if (error instanceof BadRequestException ||
          error instanceof NotFoundException ||
          error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error.message || 'Failed to retrieve order fills'
      );
    }
  }

  /**
   * Transform order entity to response format
   */
  private transformOrder(order: any): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      trendId: order.trendId || undefined,
      side: order.side,
      type: order.order_type,
      quantity: order.quantity,
      price: order.price || undefined,
      stopPrice: order.stop_price || undefined,
      filledQuantity: order.filled_quantity || 0,
      remainingQuantity: order.remaining_quantity || order.quantity,
      status: order.status,
      avgFillPrice: order.avg_fill_price || undefined,
      commission: order.commission || 0,
      fee: order.fee || 0,
      timeInForce: order.time_in_force || undefined,
      fills: order.fills || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      filledAt: order.filled_at || undefined,
      cancelledAt: order.cancelled_at || undefined
    };
  }
}
