import { 
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
  ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { Permissions } from '../decorators/permissions.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { OracleManagementService } from '../services/oracle-management.service';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Oracle Management')
@Controller('admin/oracle')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class OracleManagementController {
  private readonly logger = new Logger(OracleManagementController.name);

  constructor(
    private readonly oracleManagementService: OracleManagementService,
        private prisma: PrismaService) {}

  @Get('nodes')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'List all validator nodes' })
  @ApiResponse({ status: 200, description: 'Oracle nodes retrieved successfully' })
  async getOracleNodes(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('region') region?: string,
    @Query('search') search?: string) {
    return await this.oracleManagementService.getNodes({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      region,
      search
    });
  }

  @Get('nodes/:id')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get oracle node details' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Oracle node details retrieved successfully' })
  async getOracleNodeById(
    @Param('id', ParseUUIDPipe) id: string) {
    return await this.oracleManagementService.getNodeById(id);
  }

  @Post('nodes')
  @Permissions('oracle:*')
  @ApiOperation({ summary: 'Add new validator node' })
  @ApiResponse({ status: 201, description: 'Validator node added successfully' })
  async addOracleNode(
    @Body() nodeData: any,
    @Req() req: any) {
    const result = await this.oracleManagementService.addNode(
      nodeData,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'OracleNode',
      targetId: result.id,
      metadata: nodeData,
      description: `Added oracle node: ${result.nodeId}`
    });

    this.logger.log(`Oracle node added by admin ${req.admin.id}: ${result.nodeId}`);
    return result;
  }

  @Delete('nodes/:id')
  @Permissions('oracle:*')
  @ApiOperation({ summary: 'Remove validator node' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Validator node removed successfully' })
  async removeOracleNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.removeNode(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.CRITICAL,
      targetType: 'OracleNode',
      targetId: id,
      description: `Removed oracle node: ${id}`
    });

    this.logger.log(`Oracle node removed by admin ${req.admin.id}: ${id}`);
    return result;
  }

  @Post('nodes/:id/restart')
  @Permissions('oracle:update')
  @ApiOperation({ summary: 'Restart validator node' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Validator node restarted successfully' })
  async restartOracleNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.restartNode(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'OracleNode',
      targetId: id,
      description: `Restarted oracle node: ${id}`
    });

    this.logger.log(`Oracle node restarted by admin ${req.admin.id}: ${id}`);
    return result;
  }

  @Post('nodes/:id/disable')
  @Permissions('oracle:update')
  @ApiOperation({ summary: 'Disable validator node' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Validator node disabled successfully' })
  async disableOracleNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.disableNode(
      id,
      reason,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.HIGH,
      targetType: 'OracleNode',
      targetId: id,
      metadata: { reason },
      description: `Disabled oracle node: ${id} - ${reason}`
    });

    this.logger.log(`Oracle node disabled by admin ${req.admin.id}: ${id} - ${reason}`);
    return result;
  }

  @Post('nodes/:id/enable')
  @Permissions('oracle:update')
  @ApiOperation({ summary: 'Enable validator node' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Validator node enabled successfully' })
  async enableOracleNode(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.enableNode(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'OracleNode',
      targetId: id,
      description: `Enabled oracle node: ${id}`
    });

    this.logger.log(`Oracle node enabled by admin ${req.admin.id}: ${id}`);
    return result;
  }

  @Post('nodes/:id/rotate-keys')
  @Permissions('oracle:*')
  @ApiOperation({ summary: 'Rotate node cryptographic keys' })
  @ApiParam({ name: 'id', description: 'Oracle Node ID' })
  @ApiResponse({ status: 200, description: 'Node keys rotated successfully' })
  async rotateNodeKeys(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.rotateNodeKeys(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.CRITICAL,
      targetType: 'OracleNode',
      targetId: id,
      description: `Rotated cryptographic keys for oracle node: ${id}`
    });

    this.logger.log(`Oracle node keys rotated by admin ${req.admin.id}: ${id}`);
    return result;
  }

  @Get('requests')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'List oracle requests' })
  @ApiResponse({ status: 200, description: 'Oracle requests retrieved successfully' })
  async getOracleRequests(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('dataType') dataType?: string,
    @Query('trendId') trendId?: string) {
    return await this.oracleManagementService.getRequests({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      dataType,
      trendId
    });
  }

  @Get('requests/:id')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get oracle request details' })
  @ApiParam({ name: 'id', description: 'Oracle Request ID' })
  @ApiResponse({ status: 200, description: 'Oracle request details retrieved successfully' })
  async getOracleRequestById(
    @Param('id', ParseUUIDPipe) id: string) {
    return await this.oracleManagementService.getRequestById(id);
  }

  @Get('consensus')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get consensus health metrics' })
  @ApiResponse({ status: 200, description: 'Consensus metrics retrieved successfully' })
  async getConsensusHealth() {
    return await this.oracleManagementService.getConsensusHealth();
  }

  @Get('consensus/history')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get consensus history' })
  @ApiResponse({ status: 200, description: 'Consensus history retrieved successfully' })
  async getConsensusHistory(
    @Query('timeframe') timeframe: string = '24h',
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '100') {
    return await this.oracleManagementService.getConsensusHistory(
      timeframe,
      parseInt(page),
      parseInt(limit));
  }

  @Get('logs')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Query oracle system logs' })
  @ApiResponse({ status: 200, description: 'Oracle logs retrieved successfully' })
  async getOracleLogs(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '100',
    @Query('level') level?: string,
    @Query('nodeId') nodeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string) {
    return await this.oracleManagementService.getOracleLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      level,
      nodeId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
  }

  @Get('performance')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get oracle performance metrics' })
  @ApiResponse({ status: 200, description: 'Oracle performance metrics retrieved successfully' })
  async getOraclePerformance(
    @Query('timeframe') timeframe: string = '24h') {
    return await this.oracleManagementService.getPerformanceMetrics(timeframe);
  }

  @Get('health')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get oracle system health' })
  @ApiResponse({ status: 200, description: 'Oracle system health retrieved successfully' })
  async getOracleSystemHealth() {
    return await this.oracleManagementService.getSystemHealth();
  }

  @Post('consensus/threshold')
  @Permissions('oracle:*')
  @ApiOperation({ summary: 'Update consensus threshold' })
  @ApiResponse({ status: 200, description: 'Consensus threshold updated successfully' })
  async updateConsensusThreshold(
    @Body('threshold') threshold: number,
    @Req() req: any) {
    const result = await this.oracleManagementService.updateConsensusThreshold(
      threshold,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.CRITICAL,
      targetType: 'OracleConfig',
      targetId: 'consensus_threshold',
      metadata: { threshold },
      description: `Updated oracle consensus threshold to ${threshold}`
    });

    this.logger.log(`Oracle consensus threshold updated by admin ${req.admin.id}: ${threshold}`);
    return result;
  }

  @Post('requests/:id/retry')
  @Permissions('oracle:update')
  @ApiOperation({ summary: 'Retry failed oracle request' })
  @ApiParam({ name: 'id', description: 'Oracle Request ID' })
  @ApiResponse({ status: 200, description: 'Oracle request retry initiated successfully' })
  async retryOracleRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.retryRequest(
      id,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'OracleRequest',
      targetId: id,
      description: `Retried oracle request: ${id}`
    });

    this.logger.log(`Oracle request retried by admin ${req.admin.id}: ${id}`);
    return result;
  }

  @Post('maintenance')
  @Permissions('oracle:*')
  @ApiOperation({ summary: 'Put oracle network in maintenance mode' })
  @ApiResponse({ status: 200, description: 'Oracle maintenance mode enabled successfully' })
  async enableOracleMaintenance(
    @Body('enabled') enabled: boolean,
    @Body('message') message?: string,
    @Req() req: any) {
    const result = await this.oracleManagementService.setMaintenanceMode(
      enabled,
      message,
      req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: enabled ? AuditSeverity.CRITICAL : AuditSeverity.HIGH,
      targetType: 'OracleSystem',
      targetId: 'maintenance',
      metadata: { enabled, message },
      description: `${enabled ? 'Enabled' : 'Disabled'} oracle maintenance mode`
    });

    this.logger.log(`Oracle maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin ${req.admin.id}`);
    return result;
  }

  @Get('network-status')
  @Permissions('oracle:read')
  @ApiOperation({ summary: 'Get oracle network status' })
  @ApiResponse({ status: 200, description: 'Oracle network status retrieved successfully' })
  async getOracleNetworkStatus() {
    return await this.oracleManagementService.getNetworkStatus();
  }

  @Post('sync')
  @Permissions('oracle:update')
  @ApiOperation({ summary: 'Force sync oracle network' })
  @ApiResponse({ status: 200, description: 'Oracle network sync initiated successfully' })
  async syncOracleNetwork(@Req() req: any) {
    const result = await this.oracleManagementService.syncNetwork(req.admin.id);

    // Create audit log
    await this.prisma.adminAuditLog.upsert({
      adminId: req.admin.id,
      action: AuditAction.SYSTEM_ACTION,
      severity: AuditSeverity.MEDIUM,
      targetType: 'OracleSystem',
      targetId: 'network_sync',
      description: 'Forced oracle network synchronization'
    });

    this.logger.log(`Oracle network sync initiated by admin ${req.admin.id}`);
    return result;
  }
}
