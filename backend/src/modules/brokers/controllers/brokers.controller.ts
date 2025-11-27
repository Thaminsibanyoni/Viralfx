import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  Throttle,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateBrokerDto } from '../dto/create-broker.dto';
import { UpdateBrokerDto } from '../dto/update-broker.dto';
import { BrokerResponseDto } from '../dto/broker-response.dto';
import { FSCAVerificationDto } from '../dto/fsca-verification.dto';
import { CreateIntegrationDto } from '../dto/create-integration.dto';
import { BrokerStats, BrokerFilterOptions } from '../interfaces/broker.interface';
import { BrokersService } from '../services/brokers.service';
import { FSCAService } from '../services/fsca.service';
import { IntegrationService } from '../services/integration.service';
import { IntegrationTestResult } from '../interfaces/broker.interface';
import { UserRole } from '@prisma/client';

@ApiTags('brokers')
@Controller('brokers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BrokersController {
  constructor(
    private readonly brokersService: BrokersService,
    private readonly fscaService: FSCAService,
    private readonly integrationService: IntegrationService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new broker' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Broker created successfully', type: BrokerResponseDto })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Broker with this registration number already exists' })
  @HttpCode(HttpStatus.CREATED)
  async createBroker(@Body() createBrokerDto: CreateBrokerDto): Promise<any> {
    const broker = await this.brokersService.createBroker(createBrokerDto);
    return {
      success: true,
      message: 'Broker created successfully',
      data: broker,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOperation({ summary: 'Get all brokers with filters and pagination' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (comma-separated)' })
  @ApiQuery({ name: 'tier', required: false, description: 'Filter by tier (comma-separated)' })
  @ApiQuery({ name: 'verified', required: false, description: 'Filter by verification status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, registration, or email' })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'createdAt', 'volume', 'complianceScore'], description: 'Sort field' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'], description: 'Sort order' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Brokers retrieved successfully' })
  async getBrokers(@Query() filters: BrokerFilterOptions): Promise<any> {
    const result = await this.brokersService.getBrokers(filters);
    return {
      success: true,
      data: result.brokers,
      pagination: result.pagination,
    };
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get platform-wide broker statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved successfully', type: BrokerStats })
  async getPlatformStats(): Promise<any> {
    const stats = await this.brokersService.getPlatformStats();
    return {
      success: true,
      data: stats,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get broker by ID' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Broker retrieved successfully', type: BrokerResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Broker not found' })
  async getBroker(@Param('id') id: string): Promise<any> {
    const broker = await this.brokersService.getBrokerById(id);
    return {
      success: true,
      data: broker,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update broker information' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Broker updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Broker not found' })
  async updateBroker(
    @Param('id') id: string,
    @Body() updateBrokerDto: UpdateBrokerDto,
  ): Promise<any> {
    const broker = await this.brokersService.updateBroker(id, updateBrokerDto);
    return {
      success: true,
      message: 'Broker updated successfully',
      data: broker,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete broker (soft delete)' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Broker deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Broker not found' })
  async deleteBroker(@Param('id') id: string): Promise<any> {
    await this.brokersService.deleteBroker(id);
    return {
      success: true,
      message: 'Broker deleted successfully',
    };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get broker statistics' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Broker not found' })
  async getBrokerStats(@Param('id') id: string): Promise<any> {
    const stats = await this.brokersService.getBrokerStats(id);
    return {
      success: true,
      data: stats,
    };
  }

  @Post(':id/verify-fsca')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Initiate FSCA license verification' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification initiated successfully' })
  async verifyFSCA(
    @Param('id') id: string,
    @Body() verificationDto: FSCAVerificationDto,
  ): Promise<any> {
    const result = await this.fscaService.verifyFSCALicense({
      ...verificationDto,
      brokerId: id,
    });

    return {
      success: true,
      message: 'FSCA verification completed',
      data: result,
    };
  }

  @Get(':id/verifications')
  @ApiOperation({ summary: 'Get broker verification history' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verifications retrieved successfully' })
  async getVerifications(@Param('id') id: string): Promise<any> {
    const broker = await this.brokersService.getBrokerById(id);
    return {
      success: true,
      data: broker.verifications || [],
    };
  }

  @Post(':id/integrations')
  @ApiOperation({ summary: 'Create broker integration' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Integration created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createIntegration(
    @Param('id') id: string,
    @Body() createIntegrationDto: CreateIntegrationDto,
  ): Promise<any> {
    const integration = await this.integrationService.createIntegration(id, createIntegrationDto);
    return {
      success: true,
      message: 'Integration created successfully',
      data: integration,
    };
  }

  @Get(':id/integrations')
  @ApiOperation({ summary: 'Get broker integrations' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integrations retrieved successfully' })
  async getIntegrations(@Param('id') id: string): Promise<any> {
    const integrations = await this.integrationService.getBrokerIntegrations(id);
    return {
      success: true,
      data: integrations,
    };
  }

  @Post(':id/integrations/:integrationId/test')
  @ApiOperation({ summary: 'Test broker integration' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiParam({ name: 'integrationId', description: 'Integration ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integration test completed', type: IntegrationTestResult })
  async testIntegration(@Param('integrationId') integrationId: string): Promise<any> {
    const testResult = await this.integrationService.testIntegration(integrationId);
    return {
      success: true,
      message: 'Integration test completed',
      data: testResult,
    };
  }

  @Post(':id/api-credentials/rotate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rotate broker API credentials' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API credentials rotated successfully' })
  @Throttle(1, 60) // Limit to once per minute per broker
  async rotateCredentials(@Param('id') id: string): Promise<any> {
    const credentials = await this.brokersService.rotateApiCredentials(id);
    return {
      success: true,
      message: 'API credentials rotated successfully',
      data: credentials,
    };
  }

  @Post(':id/api-credentials/regenerate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate new API credentials for broker' })
  @ApiParam({ name: 'id', description: 'Broker ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API credentials generated successfully' })
  async generateCredentials(@Param('id') id: string): Promise<any> {
    const credentials = await this.brokersService.generateApiCredentials(id);
    return {
      success: true,
      message: 'API credentials generated successfully',
      data: credentials,
    };
  }

  // Broker self-service endpoints
  @Get('me/profile')
  @ApiOperation({ summary: 'Get current broker profile (for authenticated broker)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile retrieved successfully' })
  async getMyProfile(@Request() req): Promise<any> {
    // This would be implemented when broker authentication is added
    // For now, return a placeholder
    return {
      success: true,
      message: 'Profile endpoint - requires broker authentication',
    };
  }

  @Put('me/profile')
  @ApiOperation({ summary: 'Update current broker profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  async updateMyProfile(
    @Request() req,
    @Body() updateDto: UpdateBrokerDto,
  ): Promise<any> {
    // This would be implemented when broker authentication is added
    return {
      success: true,
      message: 'Profile update endpoint - requires broker authentication',
    };
  }

  @Get('me/integrations')
  @ApiOperation({ summary: 'Get current broker integrations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Integrations retrieved successfully' })
  async getMyIntegrations(@Request() req): Promise<any> {
    // This would be implemented when broker authentication is added
    return {
      success: true,
      message: 'Integrations endpoint - requires broker authentication',
    };
  }

  @Get('me/analytics')
  @ApiOperation({ summary: 'Get current broker analytics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Analytics retrieved successfully' })
  async getMyAnalytics(@Request() req): Promise<any> {
    // This would be implemented when broker authentication is added
    return {
      success: true,
      message: 'Analytics endpoint - requires broker authentication',
    };
  }
}