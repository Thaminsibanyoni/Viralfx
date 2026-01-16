import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketControlService } from '../services/market-control.service';
import {
  CreateMarketDto,
  UpdateMarketRegionsDto,
  ToggleTradingDto,
  FreezeMarketDto,
} from '../dto/market-control.dto';

@ApiTags('Admin - Market Control')
@Controller('admin/markets')
// @UseGuards(AdminGuard) // Temporarily disabled for testing
@ApiBearerAuth()
export class MarketControlController {
  constructor(private readonly marketControlService: MarketControlService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new VPMX market' })
  async createMarket(@Body() createMarketDto: CreateMarketDto) {
    return this.marketControlService.createMarket(createMarketDto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause a market (halts trading but keeps data flowing)' })
  @HttpCode(HttpStatus.OK)
  async pauseMarket(@Param('id') id: string) {
    return this.marketControlService.pauseMarket(id);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused market' })
  @HttpCode(HttpStatus.OK)
  async resumeMarket(@Param('id') id: string) {
    return this.marketControlService.resumeMarket(id);
  }

  @Post(':id/freeze')
  @ApiOperation({ summary: 'Freeze a market immediately (panic button - stops everything)' })
  @HttpCode(HttpStatus.OK)
  async freezeMarket(
    @Param('id') id: string,
    @Body() freezeMarketDto: FreezeMarketDto,
  ) {
    return this.marketControlService.freezeMarket(id, freezeMarketDto.reason);
  }

  @Post(':id/thaw')
  @ApiOperation({ summary: 'Thaw a frozen market (requires review)' })
  @HttpCode(HttpStatus.OK)
  async thawMarket(@Param('id') id: string) {
    return this.marketControlService.thawMarket(id);
  }

  @Put(':id/regions')
  @ApiOperation({ summary: 'Update regional access for a market' })
  async updateRegions(
    @Param('id') id: string,
    @Body() updateRegionsDto: UpdateMarketRegionsDto,
  ) {
    return this.marketControlService.updateRegions(id, updateRegionsDto.regions);
  }

  @Put(':id/trading')
  @ApiOperation({ summary: 'Enable or disable trading for a market' })
  async toggleTrading(
    @Param('id') id: string,
    @Body() toggleTradingDto: ToggleTradingDto,
  ) {
    return this.marketControlService.toggleTrading(id, toggleTradingDto.enabled);
  }

  @Get()
  @ApiOperation({ summary: 'Get all markets with their status' })
  async getAllMarkets() {
    return this.marketControlService.getAllMarkets();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get market details' })
  async getMarket(@Param('id') id: string) {
    return this.marketControlService.getMarket(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a market (soft delete)' })
  @HttpCode(HttpStatus.OK)
  async deleteMarket(@Param('id') id: string) {
    return this.marketControlService.deleteMarket(id);
  }
}
