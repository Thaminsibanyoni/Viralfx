import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RevenueSharingService } from '../services/revenue-sharing.service';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { BrokerAuthGuard } from '../guards/broker-auth.guard';
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { User } from "../../../common/enums/user-role.enum";
import { IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class MonthlyPayoutDto {
  @IsInt()
  @Min(2020)
  @Max(2030)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

class RevenueReportDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

class ProcessPayoutsDto extends MonthlyPayoutDto {
  @IsOptional()
  @Type(() => Boolean)
  dryRun?: boolean = false;
}

@ApiTags('Revenue Sharing')
@Controller('brokers/revenue-sharing')
@UseGuards(JwtAuthGuard, BrokerAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RevenueSharingController {
  constructor(private readonly revenueSharingService: RevenueSharingService) {}

  @Get('commission-structure')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get commission structure' })
  @ApiResponse({ status: 200, description: 'Commission structure retrieved successfully' })
  async getCommissionStructure() {
    const structure = await this.revenueSharingService.getCommissionStructure();

    return {
      statusCode: HttpStatus.OK,
      message: 'Commission structure retrieved successfully',
      data: structure
    };
  }

  @Post('calculate-payout')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Calculate monthly payout for a broker' })
  @ApiResponse({ status: 200, description: 'Payout calculated successfully' })
  async calculatePayout(
    @Body(ValidationPipe) payoutDto: MonthlyPayoutDto,
    @CurrentUser() user: User
  ) {
    // Brokers can only calculate their own payouts
    const brokerId = user.role === 'BROKER' ? user.brokerId : null;

    if (!brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Broker ID is required for calculation'
      };
    }

    const payout = await this.revenueSharingService.calculateMonthlyPayout(
      brokerId,
      payoutDto.year,
      payoutDto.month
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Payout calculated successfully',
      data: payout
    };
  }

  @Get('payout-history')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Get broker payout history' })
  @ApiResponse({ status: 200, description: 'Payout history retrieved successfully' })
  async getPayoutHistory(
    @CurrentUser() user: User,
    @Query('limit') limit?: number
  ) {
    const brokerId = user.role === 'BROKER' ? user.brokerId : null;

    if (!brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Broker ID is required'
      };
    }

    const history = await this.revenueSharingService.getBrokerPayoutHistory(
      brokerId,
      limit || 12
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Payout history retrieved successfully',
      data: history
    };
  }

  @Get('revenue-report')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Generate platform revenue report' })
  @ApiResponse({ status: 200, description: 'Revenue report generated successfully' })
  async generateRevenueReport(
    @Query(ValidationPipe) query: RevenueReportDto
  ) {
    const report = await this.revenueSharingService.generateRevenueReport(
      new Date(query.startDate),
      new Date(query.endDate)
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Revenue report generated successfully',
      data: report
    };
  }

  @Post('process-monthly-payouts')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Process monthly payouts for all brokers' })
  @ApiResponse({ status: 200, description: 'Monthly payouts processed successfully' })
  async processMonthlyPayouts(
    @Body(ValidationPipe) processDto: ProcessPayoutsDto
  ) {
    if (processDto.dryRun) {
      // In dry run mode, just calculate without processing
      const report = await this.revenueSharingService.generateRevenueReport(
        new Date(processDto.year, processDto.month - 1, 1),
        new Date(processDto.year, processDto.month, 0)
      );

      return {
        statusCode: HttpStatus.OK,
        message: 'Dry run completed - no payouts processed',
        data: {
          dryRun: true,
          ...report
        }
      };
    }

    await this.revenueSharingService.processMonthlyPayouts(
      processDto.year,
      processDto.month
    );

    return {
      statusCode: HttpStatus.OK,
      message: `Monthly payouts for ${processDto.year}-${processDto.month} have been queued for processing`
    };
  }

  @Post('validate-payout')
  @Roles('ADMIN', 'BROKER')
  @ApiOperation({ summary: 'Validate payout calculation' })
  @ApiResponse({ status: 200, description: 'Payout validation completed' })
  async validatePayout(
    @Body(ValidationPipe) payoutDto: MonthlyPayoutDto,
    @CurrentUser() user: User
  ) {
    const brokerId = user.role === 'BROKER' ? user.brokerId : null;

    if (!brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Broker ID is required for validation'
      };
    }

    const payout = await this.revenueSharingService.calculateMonthlyPayout(
      brokerId,
      payoutDto.year,
      payoutDto.month
    );

    const validation = await this.revenueSharingService.validatePayoutCalculation(payout);

    return {
      statusCode: HttpStatus.OK,
      message: 'Payout validation completed',
      data: {
        payout,
        validation
      }
    };
  }

  @Get('broker/:brokerId/payout')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Calculate payout for specific broker' })
  @ApiResponse({ status: 200, description: 'Payout calculated successfully' })
  async getBrokerPayout(
    @Param('brokerId') brokerId: string,
    @Query(ValidationPipe) payoutDto: MonthlyPayoutDto
  ) {
    const payout = await this.revenueSharingService.calculateMonthlyPayout(
      brokerId,
      payoutDto.year,
      payoutDto.month
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Broker payout calculated successfully',
      data: payout
    };
  }

  @Get('broker/:brokerId/history')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get payout history for specific broker' })
  @ApiResponse({ status: 200, description: 'Payout history retrieved successfully' })
  async getBrokerPayoutHistory(
    @Param('brokerId') brokerId: string,
    @Query('limit') limit?: number
  ) {
    const history = await this.revenueSharingService.getBrokerPayoutHistory(
      brokerId,
      limit || 12
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Broker payout history retrieved successfully',
      data: history
    };
  }

  @Get('my-commission-structure')
  @Roles('BROKER')
  @ApiOperation({ summary: 'Get current broker\'s commission details' })
  @ApiResponse({ status: 200, description: 'Commission details retrieved successfully' })
  async getMyCommissionDetails(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const structure = await this.revenueSharingService.getCommissionStructure();

    // In a real implementation, you would get the broker's specific tier and calculate personalized rates
    const brokerDetails = {
      brokerId: user.brokerId,
      currentTier: 'PROFESSIONAL', // Would fetch from database
      commissionRate: structure.defaultSplit.broker,
      volumeDiscounts: structure.volumeDiscounts,
      performanceBonuses: structure.performanceBonuses,
      tierMultiplier: structure.tierMultipliers['PROFESSIONAL']
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Commission details retrieved successfully',
      data: brokerDetails
    };
  }

  @Get('my-payout-estimate')
  @Roles('BROKER')
  @ApiOperation({ summary: 'Get current month payout estimate' })
  @ApiResponse({ status: 200, description: 'Payout estimate retrieved successfully' })
  async getMyPayoutEstimate(@CurrentUser() user: User) {
    if (!user.brokerId) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'User is not associated with a broker'
      };
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const payout = await this.revenueSharingService.calculateMonthlyPayout(
      user.brokerId,
      currentYear,
      currentMonth
    );

    // Add estimate-specific information
    const estimate = {
      ...payout,
      isEstimate: true,
      periodProgress: Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100),
      projectedMonthly: {
        projectedRevenue: payout.totalRevenue / (now.getDate() / 30), // Project to end of month
        projectedPayout: payout.netPayout / (now.getDate() / 30)
      }
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Payout estimate retrieved successfully',
      data: estimate
    };
  }

  @Get('dashboard/revenue-metrics')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get revenue dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Revenue metrics retrieved successfully' })
  async getRevenueDashboardMetrics() {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const currentMonthReport = await this.revenueSharingService.generateRevenueReport(
      currentMonthStart,
      now
    );

    const lastMonthReport = await this.revenueSharingService.generateRevenueReport(
      lastMonthStart,
      lastMonthEnd
    );

    const metrics = {
      currentMonth: {
        totalRevenue: currentMonthReport.totalPlatformRevenue,
        totalPayouts: currentMonthReport.totalBrokerPayouts,
        netRevenue: currentMonthReport.netPlatformRevenue,
        brokerCount: currentMonthReport.brokerBreakdown.length
      },
      lastMonth: {
        totalRevenue: lastMonthReport.totalPlatformRevenue,
        totalPayouts: lastMonthReport.totalBrokerPayouts,
        netRevenue: lastMonthReport.netPlatformRevenue,
        brokerCount: lastMonthReport.brokerBreakdown.length
      },
      growth: {
        revenue: currentMonthReport.totalPlatformRevenue - lastMonthReport.totalPlatformRevenue,
        payout: currentMonthReport.totalBrokerPayouts - lastMonthReport.totalBrokerPayouts,
        netRevenue: currentMonthReport.netPlatformRevenue - lastMonthReport.netPlatformRevenue
      },
      trends: currentMonthReport.trends
    };

    return {
      statusCode: HttpStatus.OK,
      message: 'Revenue dashboard metrics retrieved successfully',
      data: metrics
    };
  }
}
