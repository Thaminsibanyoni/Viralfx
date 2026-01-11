import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClientAttributionService } from '../services/client-attribution.service';
import { Order } from "../../trading/entities/order.entity";

@Injectable()
export class CommissionAttributionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CommissionAttributionMiddleware.name);

  constructor(private readonly clientAttributionService: ClientAttributionService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Check if this is an order creation request
    if (req.path === '/api/trading/orders' && req.method === 'POST') {
      // Store the original end method to intercept the response
      const originalEnd = res.end;
      const self = this;

      // Override the end method to process the order after it's created
      res.end = function(chunk?: any, encoding?: any) {
        // Call the original end method
        originalEnd.call(this, chunk, encoding);

        // Process commission attribution if the order was created successfully
        if (res.statusCode === 201 || res.statusCode === 200) {
          try {
            // Parse the response to get the order data
            let orderData: Order;
            if (chunk) {
              if (typeof chunk === 'string') {
                orderData = JSON.parse(chunk);
              } else {
                orderData = chunk;
              }

              // Process commission attribution
              if (orderData && orderData.id) {
                self.processCommissionAttribution(orderData).catch(error => {
                  self.logger.error(`Failed to process commission attribution for order ${orderData.id}:`, error);
                });
              }
            }
          } catch (error) {
            self.logger.error('Error parsing order response for commission attribution:', error);
          }
        }
      };
    }

    next();
  }

  private async processCommissionAttribution(order: Order): Promise<void> {
    try {
      await this.clientAttributionService.processCommissionAttribution(order);
      this.logger.log(`Commission attribution processed for order ${order.id}`);
    } catch (error) {
      this.logger.error(`Failed to process commission attribution for order ${order.id}:`, error);
      // Don't throw the error to avoid affecting the order creation process
    }
  }
}
