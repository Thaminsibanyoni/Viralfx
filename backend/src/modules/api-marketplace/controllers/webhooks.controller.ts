import { 
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WebhookService } from '../services/webhook.service';
import { CreateWebhookDto } from '../dto/create-webhook.dto';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";

@ApiTags('API Marketplace - Webhooks')
@Controller('api/v1/api-marketplace/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(
    private readonly webhookService: WebhookService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @ApiOperation({ summary: 'List user webhooks' })
  @ApiResponse({ status: 200, description: 'Webhooks retrieved successfully' })
  async listWebhooks(@Req() req: any): Promise<any[]> {
    const userId = req.user?.id;
    return this.webhookService.listWebhooks(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Create a new webhook' })
  @ApiResponse({ status: 201, description: 'Webhook created successfully' })
  async createWebhook(
    @Body(ValidationPipe) dto: CreateWebhookDto,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.createWebhook(userId, dto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @ApiOperation({ summary: 'Get webhook details' })
  @ApiResponse({ status: 200, description: 'Webhook details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async getWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.getWebhook(id, userId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Update webhook settings' })
  @ApiResponse({ status: 200, description: 'Webhook updated successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async updateWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: Partial<CreateWebhookDto>,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.updateWebhook(id, userId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60)
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook deleted successfully' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async deleteWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<{ message: string }> {
    const userId = req.user?.id;
    await this.webhookService.deleteWebhook(id, userId);
    return { message: 'Webhook deleted successfully' };
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @Throttle(5, 60)
  @ApiOperation({ summary: 'Test a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook test completed' })
  @ApiResponse({ status: 404, description: 'Webhook not found' })
  async testWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Body('event') event?: string): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.testWebhook(id, userId, event);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Enable a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook enabled successfully' })
  async enableWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.toggleWebhook(id, userId, true);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Disable a webhook' })
  @ApiResponse({ status: 200, description: 'Webhook disabled successfully' })
  async disableWebhook(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.toggleWebhook(id, userId, false);
  }

  @Get(':id/logs')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Get webhook delivery logs' })
  @ApiResponse({ status: 200, description: 'Webhook logs retrieved successfully' })
  async getWebhookLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
    @Query('status') status?: 'SUCCESS' | 'FAILED' | 'PENDING'): Promise<any> {
    const userId = req.user?.id;
    return this.webhookService.getWebhookLogs(id, userId, limit, offset, status);
  }

  @Get(':id/stats')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Get webhook statistics' })
  @ApiResponse({ status: 200, description: 'Webhook statistics retrieved successfully' })
  async getWebhookStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const userId = req.user?.id;
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }
    return this.webhookService.getWebhookStats(id, userId, dateRange);
  }

  @Get('events/available')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60)
  @ApiOperation({ summary: 'Get available webhook events' })
  @ApiResponse({ status: 200, description: 'Available events retrieved successfully' })
  async getAvailableEvents(): Promise<any> {
    return this.webhookService.getAvailableEvents();
  }

  @Post('rotate-secret/:id')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60)
  @ApiOperation({ summary: 'Rotate webhook secret' })
  @ApiResponse({ status: 200, description: 'Webhook secret rotated successfully' })
  async rotateWebhookSecret(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<{ secret: string }> {
    const userId = req.user?.id;
    const secret = await this.webhookService.rotateWebhookSecret(id, userId);
    return { secret };
  }

  @Get('delivery/overview')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60)
  @ApiOperation({ summary: 'Get webhook delivery overview' })
  @ApiResponse({ status: 200, description: 'Delivery overview retrieved successfully' })
  async getDeliveryOverview(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string): Promise<any> {
    const userId = req.user?.id;
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }
    return this.webhookService.getDeliveryOverview(userId, dateRange);
  }
}
