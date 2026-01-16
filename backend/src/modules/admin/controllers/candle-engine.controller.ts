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
import { CandleEngineService } from '../services/candle-engine.service';
import {
  ConfigureTimeframesDto,
  RebuildCandlesDto,
  UpdateAggregationRulesDto,
  UpdateVolumeWeightingDto,
  EnableTimeframeDto,
} from '../dto/candle-engine.dto';

@ApiTags('Admin - Candle Engine Control')
@Controller('admin/candle-engine')
// @UseGuards(AdminGuard) // Temporarily disabled for testing
@ApiBearerAuth()
export class CandleEngineController {
  constructor(private readonly candleEngineService: CandleEngineService) {}

  @Post('timeframes/configure')
  @ApiOperation({ summary: 'Configure available timeframes for a market' })
  async configureTimeframes(@Body() dto: ConfigureTimeframesDto) {
    return this.candleEngineService.configureTimeframes(dto.marketId, dto.timeframes);
  }

  @Post('rebuild')
  @ApiOperation({ summary: 'Rebuild historical candles (computationally expensive)' })
  async rebuildCandles(@Body() dto: RebuildCandlesDto) {
    return this.candleEngineService.rebuildCandles(
      dto.marketId,
      dto.timeframe,
      dto.startDate,
      dto.endDate,
      dto.force,
    );
  }

  @Put('aggregation-rules')
  @ApiOperation({ summary: 'Update candle aggregation rules' })
  async updateAggregationRules(@Body() dto: UpdateAggregationRulesDto) {
    return this.candleEngineService.updateAggregationRules(dto.marketId, {
      volumeWeight: dto.volumeWeight,
      vpmxWeight: dto.vpmxWeight,
      engagementWeight: dto.engagementWeight,
      enableSmoothing: dto.enableSmoothing,
      smoothingPeriod: dto.smoothingPeriod,
    });
  }

  @Put('volume-weighting')
  @ApiOperation({ summary: 'Update volume weighting rules' })
  async updateVolumeWeighting(@Body() dto: UpdateVolumeWeightingDto) {
    return this.candleEngineService.updateVolumeWeighting(dto.marketId, {
      mentionsWeight: dto.mentionsWeight,
      sharesWeight: dto.sharesWeight,
      likesWeight: dto.likesWeight,
      commentsWeight: dto.commentsWeight,
    });
  }

  @Post('timeframes/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable a specific timeframe' })
  async enableTimeframe(@Body() dto: EnableTimeframeDto) {
    return this.candleEngineService.enableTimeframe(dto.marketId, dto.timeframe, dto.enabled);
  }

  @Get('rebuild-jobs/:marketId')
  @ApiOperation({ summary: 'Get rebuild jobs for a market' })
  async getRebuildJobs(@Param('marketId') marketId: string) {
    return this.candleEngineService.getRebuildJobs(marketId);
  }

  @Get('aggregation-rules/:marketId')
  @ApiOperation({ summary: 'Get aggregation rules for a market' })
  async getAggregationRules(@Param('marketId') marketId: string) {
    return this.candleEngineService.getAggregationRules(marketId);
  }

  @Get('volume-weighting/:marketId')
  @ApiOperation({ summary: 'Get volume weighting rules for a market' })
  async getVolumeWeighting(@Param('marketId') marketId: string) {
    return this.candleEngineService.getVolumeWeighting(marketId);
  }
}
