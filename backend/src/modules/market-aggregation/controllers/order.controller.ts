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
  Req,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { Order } from '../entities/order.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlaceOrderDto } from '../../websocket/dto/place-order.dto';
import { WebSocketGateway } from '../../websocket/websocket.gateway';

// Custom decorator to get current user (simplified for this example)
const CurrentUser = () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const req = args.find(arg => arg && arg.user);
    return originalMethod.apply(this, [req?.user, ...args]);
  };
};

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(
    @InjectQueue('order-processing')
    private readonly orderQueue: Queue,
    private readonly webSocketGateway: WebSocketGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Place a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(
    @Body() orderDto: PlaceOrderDto,
    @CurrentUser() user: any,
  ): Promise<any> {
    try {
      // Validate order data
      if (!orderDto.symbol || !orderDto.side || !orderDto.type || !orderDto.quantity) {
        throw new BadRequestException('Missing required order fields');
      }

      // Additional validation for limit orders
      if (orderDto.type === 'LIMIT' && !orderDto.price) {
        throw new BadRequestException('Limit orders must specify a price');
      }

      // Validate quantity is positive
      if (orderDto.quantity <= 0) {
        throw new BadRequestException('Quantity must be positive');
      }

      // Create order entity (simplified - would normally use repository)
      const order: Partial<Order> = {
        userId: user.id,
        symbol: orderDto.symbol,
        side: orderDto.side,
        type: orderDto.type,
        quantity: orderDto.quantity,
        price: orderDto.price,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // In a real implementation, you would save to database here
      // const savedOrder = await this.orderRepository.save(order);

      // For now, we'll simulate an order ID
      const savedOrder = { ...order, id: 'temp-order-id' };

      // Queue order processing job
      await this.orderQueue.add('process-order', {
        orderId: savedOrder.id,
      }, {
        priority: orderDto.type === 'MARKET' ? 10 : 5, // Market orders get higher priority
        attempts: 3,
        backoff: 'exponential',
      });

      // Broadcast order creation to user
      await this.webSocketGateway.broadcastToUser(user.id, {
        event: 'order-created',
        data: {
          orderId: savedOrder.id,
          symbol: savedOrder.symbol,
          side: savedOrder.side,
          type: savedOrder.type,
          quantity: savedOrder.quantity,
          price: savedOrder.price,
          status: savedOrder.status,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        data: {
          orderId: savedOrder.id,
          symbol: savedOrder.symbol,
          side: savedOrder.side,
          type: savedOrder.type,
          quantity: savedOrder.quantity,
          price: savedOrder.price,
          status: savedOrder.status,
          createdAt: savedOrder.createdAt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to place order');
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiQuery({ name: 'status', enum: ['PENDING', 'OPEN', 'FILLED', 'CANCELLED'], required: false })
  @ApiQuery({ name: 'symbol', type: String, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'offset', type: Number, required: false })
  async getUserOrders(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('symbol') symbol?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ): Promise<any> {
    try {
      // Validate query parameters
      if (limit <= 0 || limit > 100) {
        throw new BadRequestException('Limit must be between 1 and 100');
      }
      if (offset < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }

      // In a real implementation, you would query the database
      // For now, we'll return a mock response

      const query: any = {
        userId: user.id,
      };

      if (status) {
        query.status = status;
      }

      if (symbol) {
        query.symbol = symbol;
      }

      // Mock orders - replace with actual database query
      const orders = [
        {
          id: 'order-1',
          symbol: 'VIRAL/SA_DJ_ZINHLE_001',
          side: 'BUY',
          type: 'MARKET',
          quantity: 100,
          price: 105.50,
          filledQuantity: 100,
          status: 'FILLED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'order-2',
          symbol: 'VIRAL/SA_TREVOR_NOAH_001',
          side: 'SELL',
          type: 'LIMIT',
          quantity: 50,
          price: 200.00,
          filledQuantity: 0,
          status: 'OPEN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      return {
        success: true,
        data: orders,
        pagination: {
          limit,
          offset,
          total: orders.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve user orders');
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
    @CurrentUser() user: any,
  ): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      // In a real implementation, you would query the database
      // For now, we'll return a mock response

      const order = {
        id: orderId,
        userId: user.id,
        symbol: 'VIRAL/SA_DJ_ZINHLE_001',
        side: 'BUY',
        type: 'MARKET',
        quantity: 100,
        price: 105.50,
        filledQuantity: 100,
        status: 'FILLED',
        fills: [
          {
            quantity: 100,
            price: 105.50,
            timestamp: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Verify order belongs to user (mock check)
      if (order.userId !== user.id) {
        throw new ForbiddenException('Order not found or unauthorized');
      }

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve order details');
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
    @CurrentUser() user: any,
  ): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      // In a real implementation, you would:
      // 1. Query order from database
      // 2. Verify order belongs to user
      // 3. Check if order can be cancelled (PENDING or OPEN)
      // 4. Update status to CANCELLED
      // 5. Remove from order book

      // Mock cancellation
      const order = {
        id: orderId,
        userId: user.id,
        symbol: 'VIRAL/SA_DJ_ZINHLE_001',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 100,
        price: 105.00,
        status: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
      };

      // Verify order belongs to user (mock check)
      if (order.userId !== user.id) {
        throw new ForbiddenException('Order not found or unauthorized');
      }

      // In a real implementation, you would check if order can be cancelled
      // if (order.status === 'FILLED') {
      //   throw new BadRequestException('Cannot cancel filled orders');
      // }

      // Broadcast cancellation to user
      await this.webSocketGateway.broadcastToUser(user.id, {
        event: 'order-cancelled',
        data: {
          orderId: order.id,
          status: order.status,
          timestamp: order.cancelledAt,
        },
      });

      return {
        success: true,
        data: order,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to cancel order');
    }
  }

  @Get(':orderId/fills')
  @ApiOperation({ summary: 'Get order fill history' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Fill history retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderFills(
    @Param('orderId') orderId: string,
    @CurrentUser() user: any,
  ): Promise<any> {
    try {
      if (!orderId || orderId.trim() === '') {
        throw new BadRequestException('Order ID is required');
      }

      // In a real implementation, you would:
      // 1. Query order from database
      // 2. Verify order belongs to user
      // 3. Return fills array

      // Mock order ownership verification
      const mockOrder = { userId: user.id };
      if (mockOrder.userId !== user.id) {
        throw new ForbiddenException('Order not found or unauthorized');
      }

      // Mock fills
      const fills = [
        {
          fillId: 'fill-1',
          quantity: 50,
          price: 105.45,
          timestamp: new Date().toISOString(),
          tradeId: 'trade-1',
        },
        {
          fillId: 'fill-2',
          quantity: 50,
          price: 105.50,
          timestamp: new Date().toISOString(),
          tradeId: 'trade-2',
        },
      ];

      return {
        success: true,
        data: {
          orderId,
          fills,
          totalFilledQuantity: fills.reduce((sum, fill) => sum + fill.quantity, 0),
          averagePrice: fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0) / fills.reduce((sum, fill) => sum + fill.quantity, 0),
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException || error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve order fills');
    }
  }
}