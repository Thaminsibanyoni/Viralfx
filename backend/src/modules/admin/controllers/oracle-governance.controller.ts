import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OracleGovernanceService } from '../services/oracle-governance.service';
import {
  ApproveSignalDto,
  RejectSignalDto,
  UpdateOracleHealthDto,
  SetOracleModeDto,
  UpdateSignalConfidenceDto,
  FlagSignalDto,
} from '../dto/oracle-governance.dto';

@ApiTags('Admin - Oracle Signal Governance')
@Controller('admin/oracle-governance')
// @UseGuards(AdminGuard) // Temporarily disabled for testing
@ApiBearerAuth()
export class OracleGovernanceController {
  constructor(private readonly oracleGovernanceService: OracleGovernanceService) {}

  @Post('signals/approve')
  @ApiOperation({ summary: 'Approve a pending signal' })
  async approveSignal(@Body() dto: ApproveSignalDto) {
    return this.oracleGovernanceService.approveSignal(dto.signalId, dto.notes);
  }

  @Post('signals/reject')
  @ApiOperation({ summary: 'Reject a signal' })
  async rejectSignal(@Body() dto: RejectSignalDto) {
    return this.oracleGovernanceService.rejectSignal(dto.signalId, dto.reason);
  }

  @Post('signals/flag')
  @ApiOperation({ summary: 'Flag a signal for review' })
  async flagSignal(@Body() dto: FlagSignalDto) {
    return this.oracleGovernanceService.flagSignal(
      dto.signalId,
      dto.reason,
      dto.requiresReview,
    );
  }

  @Put('signals/confidence')
  @ApiOperation({ summary: 'Update signal confidence score' })
  async updateSignalConfidence(@Body() dto: UpdateSignalConfidenceDto) {
    return this.oracleGovernanceService.updateSignalConfidence(
      dto.signalId,
      dto.confidenceScore,
      dto.reason,
    );
  }

  @Put('oracle-health')
  @ApiOperation({ summary: 'Update oracle source health status' })
  async updateOracleHealth(@Body() dto: UpdateOracleHealthDto) {
    return this.oracleGovernanceService.updateOracleHealth(
      dto.source,
      dto.status,
      dto.confidenceScore,
      dto.deceptionRisk,
      dto.notes,
    );
  }

  @Post('oracle-mode')
  @ApiOperation({ summary: 'Set oracle mode (LIVE, SIMULATED, SEED)' })
  async setOracleMode(@Body() dto: SetOracleModeDto) {
    return this.oracleGovernanceService.setOracleMode(dto.source, dto.mode);
  }

  @Get('signals/pending')
  @ApiOperation({ summary: 'Get all pending signals' })
  async getPendingSignals() {
    return this.oracleGovernanceService.getPendingSignals();
  }

  @Get('signals/flagged')
  @ApiOperation({ summary: 'Get all flagged signals' })
  async getFlaggedSignals() {
    return this.oracleGovernanceService.getFlaggedSignals();
  }

  @Get('signals/low-confidence/:threshold?')
  @ApiOperation({ summary: 'Get low confidence signals' })
  async getLowConfidenceSignals(
    @Param('threshold') threshold?: string,
  ) {
    return this.oracleGovernanceService.getLowConfidenceSignals(
      threshold ? parseInt(threshold) : 50,
    );
  }

  @Get('signals/high-deception/:threshold?')
  @ApiOperation({ summary: 'Get high deception risk signals' })
  async getHighDeceptionRiskSignals(
    @Param('threshold') threshold?: string,
  ) {
    return this.oracleGovernanceService.getHighDeceptionRiskSignals(
      threshold ? parseInt(threshold) : 70,
    );
  }

  @Get('signals/source/:source')
  @ApiOperation({ summary: 'Get signals by source' })
  async getSignalsBySource(
    @Param('source') source: string,
  ) {
    return this.oracleGovernanceService.getSignalsBySource(source);
  }

  @Get('sources')
  @ApiOperation({ summary: 'Get all oracle sources' })
  async getOracleSources() {
    return this.oracleGovernanceService.getOracleSources();
  }
}
