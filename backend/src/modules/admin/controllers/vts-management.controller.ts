import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
  ParseUUIDPipe,
  Req,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { Permissions } from '../decorators/permissions.decorator';
import { VTSManagementService } from '../services/vts-management.service';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditSeverity, AuditResourceType } from '../../audit/enums/audit.enum';

@ApiTags('VTS Management')
@Controller('admin/vts')
@UseGuards(AdminAuthGuard)
@ApiBearerAuth()
export class VTSManagementController {
  private readonly logger = new Logger(VTSManagementController.name);

  constructor(
    private readonly vtsManagementService: VTSManagementService,
    private readonly auditService: AuditService,
  ) {}

  @Get('symbols')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'List all VTS symbols' })
  @ApiResponse({ status: 200, description: 'VTS symbols retrieved successfully' })
  async getVTSSymbols(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('category') category?: string,
    @Query('region') region?: string,
    @Query('status') status?: string,
    @Query('search') search?: string) {
    return await this.vtsManagementService.getSymbols({
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      region,
      status,
      search
    });
  }

  @Get('symbols/:id')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS symbol details' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol details retrieved successfully' })
  async getVTSSymbolById(
    @Param('id', ParseUUIDPipe) id: string) {
    return await this.vtsManagementService.getSymbolById(id);
  }

  @Put('symbols/:id/category')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Update VTS symbol category' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol category updated successfully' })
  async updateSymbolCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('category') category: string,
    @Req() req: any) {
    const result = await this.vtsManagementService.updateCategory(
      id,
      category,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.MEDIUM,
      targetType: 'VTSSymbol',
      targetId: id,
      metadata: { category },
      description: `Updated VTS symbol ${id} category to ${category}`
    });

    this.logger.log(`VTS symbol ${id} category updated to ${category} by admin ${req.admin.id}`);
    return result;
  }

  @Put('symbols/:id/freeze')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Freeze VTS symbol' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol frozen successfully' })
  async freezeSymbol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: any) {
    const result = await this.vtsManagementService.freezeSymbol(
      id,
      reason,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_PAUSE,
      severity: AuditSeverity.HIGH,
      targetType: 'VTSSymbol',
      targetId: id,
      metadata: { reason },
      description: `Froze VTS symbol ${id}: ${reason}`
    });

    this.logger.log(`VTS symbol ${id} frozen by admin ${req.admin.id}: ${reason}`);
    return result;
  }

  @Put('symbols/:id/unfreeze')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Unfreeze VTS symbol' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol unfrozen successfully' })
  async unfreezeSymbol(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any) {
    const result = await this.vtsManagementService.unfreezeSymbol(
      id,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_RESUME,
      severity: AuditSeverity.MEDIUM,
      targetType: 'VTSSymbol',
      targetId: id,
      description: `Unfroze VTS symbol ${id}`
    });

    this.logger.log(`VTS symbol ${id} unfrozen by admin ${req.admin.id}`);
    return result;
  }

  @Post('symbols/:id/merge')
  @Permissions('vts:*')
  @ApiOperation({ summary: 'Merge duplicate VTS symbols' })
  @ApiParam({ name: 'id', description: 'Source VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbols merged successfully' })
  async mergeSymbols(
    @Param('id', ParseUUIDPipe) sourceId: string,
    @Body('targetId') targetId: string,
    @Req() req: any) {
    const result = await this.vtsManagementService.mergeSymbols(
      sourceId,
      targetId,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.HIGH,
      targetType: 'VTSSymbol',
      targetId: sourceId,
      metadata: { sourceId, targetId },
      description: `Merged VTS symbol ${sourceId} into ${targetId}`
    });

    this.logger.log(`VTS symbols merged by admin ${req.admin.id}: ${sourceId} -> ${targetId}`);
    return result;
  }

  @Post('symbols/:id/split')
  @Permissions('vts:*')
  @ApiOperation({ summary: 'Split VTS symbol into multiple symbols' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID to split' })
  @ApiResponse({ status: 200, description: 'VTS symbol split successfully' })
  async splitSymbol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('newSymbols') newSymbols: any[],
    @Req() req: any) {
    const result = await this.vtsManagementService.splitSymbol(
      id,
      newSymbols,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.CRITICAL,
      targetType: 'VTSSymbol',
      targetId: id,
      metadata: { newSymbols },
      description: `Split VTS symbol ${id} into ${newSymbols.length} symbols`
    });

    this.logger.log(`VTS symbol ${id} split by admin ${req.admin.id}`);
    return result;
  }

  @Post('symbols/:id/rollback')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Rollback VTS symbol to previous version' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol rolled back successfully' })
  async rollbackSymbol(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('version') version: number,
    @Req() req: any) {
    const result = await this.vtsManagementService.rollbackSymbol(
      id,
      version,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.HIGH,
      targetType: 'VTSSymbol',
      targetId: id,
      metadata: { version },
      description: `Rolled back VTS symbol ${id} to version ${version}`
    });

    this.logger.log(`VTS symbol ${id} rolled back to version ${version} by admin ${req.admin.id}`);
    return result;
  }

  @Get('aliases')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'List all VTS symbol aliases' })
  @ApiResponse({ status: 200, description: 'VTS aliases retrieved successfully' })
  async getVTSAliases(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('search') search?: string) {
    return await this.vtsManagementService.getAliases({
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });
  }

  @Put('aliases/:id')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Update VTS symbol alias' })
  @ApiParam({ name: 'id', description: 'VTS Alias ID' })
  @ApiResponse({ status: 200, description: 'VTS alias updated successfully' })
  async updateAlias(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('alias') alias: string,
    @Req() req: any) {
    const result = await this.vtsManagementService.updateAlias(
      id,
      alias,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.LOW,
      targetType: 'VTSAlias',
      targetId: id,
      metadata: { alias },
      description: `Updated VTS alias ${id} to ${alias}`
    });

    this.logger.log(`VTS alias ${id} updated to ${alias} by admin ${req.admin.id}`);
    return result;
  }

  @Get('disputes')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'List VTS symbol disputes' })
  @ApiResponse({ status: 200, description: 'VTS disputes retrieved successfully' })
  async getVTSDisputes(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
    @Query('status') status?: string,
    @Query('type') type?: string) {
    return await this.vtsManagementService.getDisputes({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      type
    });
  }

  @Post('disputes/:id/resolve')
  @Permissions('vts:update')
  @ApiOperation({ summary: 'Resolve VTS symbol dispute' })
  @ApiParam({ name: 'id', description: 'VTS Dispute ID' })
  @ApiResponse({ status: 200, description: 'VTS dispute resolved successfully' })
  async resolveDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('resolution') resolution: any,
    @Req() req: any) {
    const result = await this.vtsManagementService.resolveDispute(
      id,
      resolution,
      req.admin.id);

    // Create audit log
    await this.auditService.logAdminAction({
      adminId: req.admin.id,
      action: AuditAction.TREND_OVERRIDE,
      severity: AuditSeverity.HIGH,
      targetType: 'VTSDispute',
      targetId: id,
      metadata: { resolution },
      description: `Resolved VTS dispute ${id}`
    });

    this.logger.log(`VTS dispute ${id} resolved by admin ${req.admin.id}`);
    return result;
  }

  @Get('statistics')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS statistics' })
  @ApiResponse({ status: 200, description: 'VTS statistics retrieved successfully' })
  async getVTSStatistics(
    @Query('timeframe') timeframe: string = '30d') {
    return await this.vtsManagementService.getStatistics(timeframe);
  }

  @Get('categories')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS categories' })
  @ApiResponse({ status: 200, description: 'VTS categories retrieved successfully' })
  async getVTSCategories() {
    return await this.vtsManagementService.getCategories();
  }

  @Get('regions')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS regions' })
  @ApiResponse({ status: 200, description: 'VTS regions retrieved successfully' })
  async getVTSRegions() {
    return await this.vtsManagementService.getRegions();
  }

  @Post('validate-symbol')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Validate VTS symbol format' })
  @ApiResponse({ status: 200, description: 'VTS symbol validation result' })
  async validateVTSSymbol(
    @Body('symbol') symbol: string) {
    return await this.vtsManagementService.validateSymbolFormat(symbol);
  }

  @Get('usage/:id')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS symbol usage statistics' })
  @ApiParam({ name: 'id', description: 'VTS Symbol ID' })
  @ApiResponse({ status: 200, description: 'VTS symbol usage retrieved successfully' })
  async getVTSymbolUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('timeframe') timeframe: string = '30d') {
    return await this.vtsManagementService.getSymbolUsage(id, timeframe);
  }

  @Get('health')
  @Permissions('vts:read')
  @ApiOperation({ summary: 'Get VTS system health' })
  @ApiResponse({ status: 200, description: 'VTS system health retrieved successfully' })
  async getVTSHealth() {
    return await this.vtsManagementService.getSystemHealth();
  }
}
