import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ClientAttributionService } from '../services/client-attribution.service';
import { AttributeClientDto, UpdateClientStatusDto, GetBrokerClientsDto, ReferralCodeDto, ClientRevenuePeriodDto } from '../dto/client-attribution.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BrokerGuard } from '../guards/broker.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { User } from '../../users/entities/user.entity';

@ApiTags('Client Attribution')
@Controller('brokers/client-attribution')
@UseGuards(JwtAuthGuard, BrokerGuard, RolesGuard)
@ApiBearerAuth()
export class ClientAttributionController {
  constructor(private readonly clientAttributionService: ClientAttributionService) {}

  @Post('attribute')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Attribute a client to a broker' })
  @ApiResponse({ status: 200, description: 'Client attributed successfully' })
  async attributeClient(
    @Body(ValidationPipe) attributeClientDto: AttributeClientDto,
    @GetUser() user: User
  ) {
    const result = await this.clientAttributionService.attributeClientToBroker(
      attributeClientDto.clientId,
      attributeClientDto.brokerId,
      attributeClientDto.attributionType,
      attributeClientDto.metadata
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Client attributed successfully',
      data: result,
    };
  }

  @Get('broker/:brokerId/clients')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get all clients for a broker' })
  @ApiResponse({ status: 200, description: 'Broker clients retrieved successfully' })
  async getBrokerClients(
    @Param('brokerId') brokerId: string,
    @Query(ValidationPipe) query: GetBrokerClientsDto,
    @GetUser() user: User
  ) {
    // Brokers can only view their own clients
    if (user.role === 'BROKER' && user.brokerId !== brokerId) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You can only view your own clients',
      };
    }

    const clients = await this.clientAttributionService.getBrokerClients(brokerId, {
      status: query.status,
      attributionType: query.attributionType,
      startDate: query.startDate,
      endDate: query.endDate,
    });

    // Apply search filter if provided
    let filteredClients = clients;
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredClients = clients.filter(client =>
        client.client?.firstName?.toLowerCase().includes(searchLower) ||
        client.client?.lastName?.toLowerCase().includes(searchLower) ||
        client.client?.email?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    filteredClients.sort((a, b) => {
      let aValue, bValue;

      switch (query.sortBy) {
        case 'totalCommission':
          aValue = a.totalCommission;
          bValue = b.totalCommission;
          break;
        case 'totalTrades':
          aValue = a.totalTrades;
          bValue = b.totalTrades;
          break;
        case 'lastTradeDate':
          aValue = a.lastTradeDate ? new Date(a.lastTradeDate).getTime() : 0;
          bValue = b.lastTradeDate ? new Date(b.lastTradeDate).getTime() : 0;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (query.sortOrder === 'ASC') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (query.page - 1) * query.limit;
    const paginatedClients = filteredClients.slice(startIndex, startIndex + query.limit);

    return {
      statusCode: HttpStatus.OK,
      message: 'Broker clients retrieved successfully',
      data: {
        clients: paginatedClients,
        pagination: {
          page: query.page,
          limit: query.limit,
          total: filteredClients.length,
          totalPages: Math.ceil(filteredClients.length / query.limit),
        },
      },
    };
  }

  @Get('broker/:brokerId/stats')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get broker client statistics' })
  @ApiResponse({ status: 200, description: 'Broker client statistics retrieved successfully' })
  async getBrokerClientStats(
    @Param('brokerId') brokerId: string,
    @GetUser() user: User
  ) {
    // Brokers can only view their own stats
    if (user.role === 'BROKER' && user.brokerId !== brokerId) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You can only view your own statistics',
      };
    }

    const stats = await this.clientAttributionService.getBrokerClientStats(brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Broker client statistics retrieved successfully',
      data: stats,
    };
  }

  @Get('client/:clientId/history')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client attribution history' })
  @ApiResponse({ status: 200, description: 'Client attribution history retrieved successfully' })
  async getClientAttributionHistory(
    @Param('clientId') clientId: string,
    @GetUser() user: User
  ) {
    const history = await this.clientAttributionService.getClientAttributionHistory(clientId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Client attribution history retrieved successfully',
      data: history,
    };
  }

  @Put('broker/:brokerId/client/:clientId/status')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Update client status' })
  @ApiResponse({ status: 200, description: 'Client status updated successfully' })
  async updateClientStatus(
    @Param('brokerId') brokerId: string,
    @Param('clientId') clientId: string,
    @Body(ValidationPipe) updateStatusDto: UpdateClientStatusDto,
    @GetUser() user: User
  ) {
    // Brokers can only update their own clients
    if (user.role === 'BROKER' && user.brokerId !== brokerId) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You can only update your own clients',
      };
    }

    const result = await this.clientAttributionService.updateClientStatus(
      brokerId,
      clientId,
      updateStatusDto.status,
      updateStatusDto.notes
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Client status updated successfully',
      data: result,
    };
  }

  @Post('broker/:brokerId/referral-code')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Generate referral code for broker' })
  @ApiResponse({ status: 200, description: 'Referral code generated successfully' })
  async generateReferralCode(
    @Param('brokerId') brokerId: string,
    @GetUser() user: User
  ) {
    // Brokers can only generate their own referral codes
    if (user.role === 'BROKER' && user.brokerId !== brokerId) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You can only generate your own referral codes',
      };
    }

    const referralCode = await this.clientAttributionService.generateReferralCode(brokerId);

    return {
      statusCode: HttpStatus.OK,
      message: 'Referral code generated successfully',
      data: { referralCode },
    };
  }

  @Post('validate-referral-code')
  @ApiOperation({ summary: 'Validate referral code' })
  @ApiResponse({ status: 200, description: 'Referral code validated successfully' })
  async validateReferralCode(
    @Body(ValidationPipe) referralCodeDto: ReferralCodeDto
  ) {
    const broker = await this.clientAttributionService.validateReferralCode(referralCodeDto.referralCode);

    return {
      statusCode: HttpStatus.OK,
      message: 'Referral code validated successfully',
      data: {
        isValid: !!broker,
        broker: broker ? {
          id: broker.id,
          companyName: broker.companyName,
          tier: broker.tier,
          trustScore: broker.trustScore,
        } : null,
      },
    };
  }

  @Get('broker/:brokerId/revenue')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get client revenue by period' })
  @ApiResponse({ status: 200, description: 'Client revenue data retrieved successfully' })
  async getClientRevenueByPeriod(
    @Param('brokerId') brokerId: string,
    @Query(ValidationPipe) periodDto: ClientRevenuePeriodDto,
    @GetUser() user: User
  ) {
    // Brokers can only view their own revenue
    if (user.role === 'BROKER' && user.brokerId !== brokerId) {
      return {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'You can only view your own revenue data',
      };
    }

    const revenue = await this.clientAttributionService.getClientRevenueByPeriod(
      brokerId,
      periodDto.startDate,
      periodDto.endDate
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Client revenue data retrieved successfully',
      data: revenue,
    };
  }

  @Get('my-clients')
  @Roles('BROKER')
  @ApiOperation({ summary: 'Get current broker\'s clients' })
  @ApiResponse({ status: 200, description: 'Broker\'s clients retrieved successfully' })
  async getMyClients(
    @GetUser() user: User,
    @Query(ValidationPipe) query: GetBrokerClientsDto
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker',
      };
    }

    return this.getBrokerClients(user.brokerId, query, user);
  }

  @Get('my-stats')
  @Roles('BROKER')
  @ApiOperation({ summary: 'Get current broker\'s client statistics' })
  @ApiResponse({ status: 200, description: 'Broker\'s client statistics retrieved successfully' })
  async getMyStats(
    @GetUser() user: User
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker',
      };
    }

    return this.getBrokerClientStats(user.brokerId, user);
  }

  @Get('my-revenue')
  @Roles('BROKER')
  @ApiOperation({ summary: 'Get current broker\'s revenue data' })
  @ApiResponse({ status: 200, description: 'Broker\'s revenue data retrieved successfully' })
  async getMyRevenue(
    @GetUser() user: User,
    @Query(ValidationPipe) periodDto: ClientRevenuePeriodDto
  ) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker',
      };
    }

    return this.getClientRevenueByPeriod(user.brokerId, periodDto, user);
  }
}