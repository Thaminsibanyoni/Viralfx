import { 
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  Request, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { KeysService } from '../services/keys.service';
import { CreateKeyDto, UpdateKeyDto } from '../dto/create-key.dto';
import { ApiKeyWithDetails } from '../interfaces/api-marketplace.interface';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { UsageService } from '../services/usage.service';

@ApiTags('API Marketplace - Keys')
@Controller('api/v1/api-marketplace/keys')
@UseGuards(JwtAuthGuard)
export class KeysController {
  constructor(
    private readonly keysService: KeysService,
    private readonly usageService: UsageService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle(5, 60) // 5 key creations per minute
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  async createKey(
    @Body(ValidationPipe) dto: CreateKeyDto,
    @Req() req: any): Promise<{ key: string; apiKey: ApiKeyWithDetails }> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.keysService.generateKey(userId, brokerId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'List user API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  async listKeys(@Req() req: any): Promise<ApiKeyWithDetails[]> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.keysService.listKeys(userId, brokerId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(50, 60) // 50 requests per minute
  @ApiOperation({ summary: 'Get API key details' })
  @ApiResponse({ status: 200, description: 'API key details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<ApiKeyWithDetails | null> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;
    const keys = await this.keysService.listKeys(userId, brokerId);
    return keys.find(k => k.id === id) || null;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Update API key settings' })
  @ApiResponse({ status: 200, description: 'API key updated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async updateKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateKeyDto,
    @Req() req: any): Promise<ApiKeyWithDetails> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.keysService.updateKey(id, userId, brokerId, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Throttle(10, 60) // 10 requests per minute
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revokeKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<{ message: string }> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    await this.keysService.revokeKey(id, userId, brokerId);
    return { message: 'API key revoked successfully' };
  }

  @Post(':id/rotate')
  @HttpCode(HttpStatus.OK)
  @Throttle(5, 60) // 5 rotations per minute
  @ApiOperation({ summary: 'Rotate an API key' })
  @ApiResponse({ status: 200, description: 'API key rotated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async rotateKey(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any): Promise<{ key: string; apiKey: ApiKeyWithDetails }> {
    const userId = req.user?.id;
    const brokerId = req.user?.brokerId;

    return this.keysService.rotateKey(id, userId, brokerId);
  }

  @Get(':id/usage')
  @HttpCode(HttpStatus.OK)
  @Throttle(20, 60) // 20 requests per minute
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved successfully' })
  async getKeyUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('groupBy') groupBy: 'hour' | 'day' | 'month' = 'day'): Promise<any> {
    let dateRange;
    if (startDate || endDate) {
      dateRange = {
        start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: endDate ? new Date(endDate) : new Date()
      };
    }

    return this.usageService.getUsageStats(id, dateRange, groupBy);
  }
}
