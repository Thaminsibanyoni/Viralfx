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
  Request,
  HttpCode,
  HttpStatus, Req } from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { AdminDashboardService } from '../services/admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AdminAuthGuard)
export class AdminDashboardController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get('overview')
  @Permissions('dashboard:read')
  async getOverview(
    @Query('timeframe') timeframe: '1h' | '24h' | '7d' | '30d' = '24h') {
    return await this.dashboardService.getDashboardMetrics(timeframe);
  }

  @Get('overview/predictive')
  @Permissions('predictive:read')
  async getPredictiveOverview() {
    return await this.dashboardService.getPredictiveInsights();
  }

  @Get('system/health')
  @Permissions('system:read')
  async getSystemHealth() {
    return await this.dashboardService.getSystemHealth();
  }

  @Get('alerts')
  @Permissions('alerts:read')
  async getAlerts(
    @Query('severity') severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    @Query('resolved') resolved?: boolean,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50') {
    return await this.dashboardService.getAlerts({
      severity,
      resolved: resolved === undefined ? undefined : resolved === 'true',
      page: parseInt(page),
      limit: parseInt(limit)
    });
  }
}

@Controller('admin/users')
@UseGuards(AdminAuthGuard)
export class UserOpsController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get()
  @Permissions('users:read')
  async getUsers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('kycStatus') kycStatus?: string,
    @Query('search') search?: string) {
    return await this.dashboardService.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      kycStatus,
      search
    });
  }

  @Get(':id')
  @Permissions('users:read')
  async getUser(@Param('id') id: string) {
    return await this.dashboardService.getUserById(id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:suspend')
  async suspendUser(
    @Param('id') userId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.suspendUser(userId, reason, req.admin.id);
    return { message: 'User suspended successfully' };
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:unsuspend')
  async unsuspendUser(
    @Param('id') userId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.unsuspendUser(userId, req.admin.id);
    return { message: 'User unsuspended successfully' };
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:ban')
  async banUser(
    @Param('id') userId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.banUser(userId, reason, req.admin.id);
    return { message: 'User banned successfully' };
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @Permissions('users:unban')
  async unbanUser(
    @Param('id') userId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.unbanUser(userId, req.admin.id);
    return { message: 'User unbanned successfully' };
  }

  @Get(':id/audit')
  @Permissions('audit:read')
  async getUserAuditTrail(@Param('id') userId: string) {
    return await this.dashboardService.getUserAuditTrail(userId);
  }

  @Post(':id/kyc/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('kyc:update')
  async approveKYC(
    @Param('id') userId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.approveKYC(userId, req.admin.id);
    return { message: 'KYC approved successfully' };
  }

  @Post(':id/kyc/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('kyc:update')
  async rejectKYC(
    @Param('id') userId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.rejectKYC(userId, reason, req.admin.id);
    return { message: 'KYC rejected successfully' };
  }
}

@Controller('admin/brokers')
@UseGuards(AdminAuthGuard)
export class BrokerOpsController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get()
  @Permissions('brokers:read')
  async getBrokers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string) {
    return await this.dashboardService.getBrokers({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      tier,
      search
    });
  }

  @Get(':id')
  @Permissions('brokers:read')
  async getBroker(@Param('id') id: string) {
    return await this.dashboardService.getBrokerById(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('brokers:approve')
  async approveBroker(
    @Param('id') brokerId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.approveBroker(brokerId, req.admin.id);
    return { message: 'Broker approved successfully' };
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('brokers:suspend')
  async suspendBroker(
    @Param('id') brokerId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.suspendBroker(brokerId, reason, req.admin.id);
    return { message: 'Broker suspended successfully' };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @Permissions('brokers:verify')
  async verifyBroker(
    @Param('id') brokerId: string,
    @Body('verificationData') verificationData: any,
    @Req() req: { admin: any }) {
    await this.dashboardService.verifyBroker(brokerId, verificationData, req.admin.id);
    return { message: 'Broker verification completed successfully' };
  }
}

@Controller('admin/finance')
@UseGuards(AdminAuthGuard)
export class FinanceOpsController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get('overview')
  @Permissions('finance:read')
  async getFinanceOverview(
    @Query('timeframe') timeframe: '24h' | '7d' | '30d' = '30d') {
    return await this.dashboardService.getFinanceOverview(timeframe);
  }

  @Get('transactions')
  @Permissions('finance:read')
  async getTransactions(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('currency') currency?: string) {
    return await this.dashboardService.getTransactions({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type,
      currency
    });
  }

  @Get('invoices')
  @Permissions('invoices:read')
  async getInvoices(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('brokerId') brokerId?: string) {
    return await this.dashboardService.getInvoices({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      brokerId
    });
  }

  @Post('invoices')
  @Permissions('invoices:create')
  async createInvoice(@Body() invoiceData: any) {
    return await this.dashboardService.createInvoice(invoiceData);
  }

  @Post('payouts')
  @Permissions('payouts:create')
  async createPayout(@Body() payoutData: any) {
    return await this.dashboardService.createPayout(payoutData);
  }
}

@Controller('admin/trends')
@UseGuards(AdminAuthGuard)
export class TrendOpsController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get()
  @Permissions('trends:read')
  async getTrends(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('region') region?: string) {
    return await this.dashboardService.getTrends({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      category,
      region
    });
  }

  @Get(':id')
  @Permissions('trends:read')
  async getTrend(@Param('id') id: string) {
    return await this.dashboardService.getTrendById(id);
  }

  @Post(':id/override')
  @HttpCode(HttpStatus.OK)
  @Permissions('trends:override')
  async overrideTrend(
    @Param('id') trendId: string,
    @Body('overrideData') overrideData: any,
    @Req() req: { admin: any }) {
    await this.dashboardService.overrideTrend(trendId, overrideData, req.admin.id);
    return { message: 'Trend overridden successfully' };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('trends:approve')
  async approveTrend(
    @Param('id') trendId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.approveTrend(trendId, req.admin.id);
    return { message: 'Trend approved successfully' };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Permissions('trends:reject')
  async rejectTrend(
    @Param('id') trendId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.rejectTrend(trendId, reason, req.admin.id);
    return { message: 'Trend rejected successfully' };
  }
}

@Controller('admin/risk')
@UseGuards(AdminAuthGuard)
export class RiskOpsController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get('alerts')
  @Permissions('risk:read')
  async getRiskAlerts(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('severity') severity?: string,
    @Query('status') status?: string) {
    return await this.dashboardService.getRiskAlerts({
      page: parseInt(page),
      limit: parseInt(limit),
      severity,
      status
    });
  }

  @Get('content')
  @Permissions('risk:read')
  async getHarmfulContent(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('type') type?: string,
    @Query('status') status?: string) {
    return await this.dashboardService.getHarmfulContent({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      status
    });
  }

  @Post('content/:id/block')
  @HttpCode(HttpStatus.OK)
  @Permissions('risk:block')
  async blockContent(
    @Param('id') contentId: string,
    @Body('reason') reason: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.blockContent(contentId, reason, req.admin.id);
    return { message: 'Content blocked successfully' };
  }

  @Post('content/:id/approve')
  @HttpCode(HttpStatus.OK)
  @Permissions('risk:approve')
  async approveContent(
    @Param('id') contentId: string,
    @Req() req: { admin: any }) {
    await this.dashboardService.approveContent(contentId, req.admin.id);
    return { message: 'Content approved successfully' };
  }
}

@Controller('admin/audit')
@UseGuards(AdminAuthGuard)
export class AuditController {
  constructor(
    private dashboardService: AdminDashboardService) {}

  @Get()
  @Permissions('audit:read')
  async getAuditLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('action') action?: string,
    @Query('adminId') adminId?: string,
    @Query('targetType') targetType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    return await this.dashboardService.getAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      action,
      adminId,
      targetType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Get('statistics')
  @Permissions('audit:read')
  async getAuditStatistics() {
    return await this.dashboardService.getAuditStatistics();
  }
}
