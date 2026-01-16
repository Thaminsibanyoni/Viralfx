import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { WebSocketGateway } from '@nestjs/websockets';
import { CreateMarketDto } from '../dto/market-control.dto';

@Injectable()
export class MarketControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Create a new VPMX market
   * This is the primary method for adding new tradable assets to the platform
   */
  async createMarket(createMarketDto: CreateMarketDto) {
    // Validate VTS symbol format
    if (!this.validateVTSSymbol(createMarketDto.symbol)) {
      throw new BadRequestException('Invalid VTS symbol format. Expected: V:CC:SEC:TICKER');
    }

    // Check if market already exists
    const existing = await this.prisma.vPMXTradingMarket.findFirst({
      where: { symbol: createMarketDto.symbol },
    });

    if (existing) {
      throw new BadRequestException(`Market ${createMarketDto.symbol} already exists`);
    }

    // Create market
    const market = await this.prisma.vPMXTradingMarket.create({
      data: {
        symbol: createMarketDto.symbol,
        name: createMarketDto.name,
        category: createMarketDto.category,
        status: 'active',
        maxExposure: createMarketDto.maxExposure,
        regions: createMarketDto.regions,
        timeframes: createMarketDto.timeframes,
        tradingEnabled: createMarketDto.tradingEnabled ?? true,
        currentExposure: 0,
        vpmxScore: 0,
        createdBy: 'system',
      },
    });

    // Log creation
    await this.auditService.log({
      action: 'MARKET_CREATED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        name: market.name,
        createdBy: 'system',
      },
      severity: 'info',
    });

    return market;
  }

  /**
   * Pause a market (halts trading but keeps data flowing)
   * Use this for temporary halts while investigating issues
   */
  async pauseMarket(id: string) {
    const market = await this.findMarket(id);

    if (market.status === 'paused') {
      throw new BadRequestException('Market is already paused');
    }

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: { status: 'paused' },
    });

    // Log pause action
    await this.auditService.log({
      action: 'MARKET_PAUSED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        previousStatus: market.status,
        newStatus: 'paused',
      },
      severity: 'warning',
    });

    return updated;
  }

  /**
   * Resume a paused market
   */
  async resumeMarket(id: string) {
    const market = await this.findMarket(id);

    if (market.status !== 'paused') {
      throw new BadRequestException('Can only resume paused markets');
    }

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: { status: 'active' },
    });

    // Log resume action
    await this.auditService.log({
      action: 'MARKET_RESUMED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        previousStatus: market.status,
        newStatus: 'active',
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Freeze a market immediately (PANIC BUTTON)
   * This stops everything - trading, data flow, all operations
   * Use for: politically sensitive content, manipulation, legal risks
   */
  async freezeMarket(id: string, reason: string) {
    const market = await this.findMarket(id);

    // Trigger circuit breaker if exists
    if (market.status === 'frozen') {
      throw new BadRequestException('Market is already frozen');
    }

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: {
        status: 'frozen',
        tradingEnabled: false,
        frozenAt: new Date(),
      },
    });

    // Log freeze with reason (CRITICAL)
    await this.auditService.log({
      action: 'MARKET_FROZEN',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        previousStatus: market.status,
        reason,
        frozenBy: 'admin',
        frozenAt: new Date().toISOString(),
      },
      severity: 'critical',
    });

    // Emit WebSocket event for real-time update
    // This would be handled by WebSocketGateway
    // this.webSocketGateway.emitMarketStatus(market.symbol, 'frozen');

    return updated;
  }

  /**
   * Thaw a frozen market (requires admin review)
   * Markets must be reviewed before being reactivated
   */
  async thawMarket(id: string) {
    const market = await this.findMarket(id);

    if (market.status !== 'frozen') {
      throw new BadRequestException('Can only thaw frozen markets');
    }

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: {
        status: 'active',
        tradingEnabled: true,
        thawedAt: new Date(),
      },
    });

    // Log thaw action
    await this.auditService.log({
      action: 'MARKET_THAWED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        previousStatus: market.status,
        newStatus: 'active',
        reviewedBy: 'admin',
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Update regional access for a market
   * Control which countries/regions can see and trade a market
   */
  async updateRegions(id: string, regions: string[]) {
    const market = await this.findMarket(id);

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: { regions },
    });

    // Log region change
    await this.auditService.log({
      action: 'MARKET_REGIONS_UPDATED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        previousRegions: market.regions,
        newRegions: regions,
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Enable or disable trading for a market
   * This is different from pause - it controls the trading flag specifically
   */
  async toggleTrading(id: string, enabled: boolean) {
    const market = await this.findMarket(id);

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: { tradingEnabled: enabled },
    });

    // Log trading toggle
    await this.auditService.log({
      action: enabled ? 'MARKET_TRADING_ENABLED' : 'MARKET_TRADING_DISABLED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        tradingEnabled: enabled,
      },
      severity: 'warning',
    });

    return updated;
  }

  /**
   * Get all markets with their status
   */
  async getAllMarkets() {
    return this.prisma.vPMXTradingMarket.findMany({
      where: {
        status: {
          not: 'archived',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get market details
   */
  async getMarket(id: string) {
    const market = await this.findMarket(id);
    return market;
  }

  /**
   * Delete a market (soft delete)
   * This archives the market rather than permanently deleting it
   */
  async deleteMarket(id: string) {
    const market = await this.findMarket(id);

    const updated = await this.prisma.vPMXTradingMarket.update({
      where: { id },
      data: {
        status: 'archived',
        tradingEnabled: false,
        archivedAt: new Date(),
      },
    });

    // Log deletion
    await this.auditService.log({
      action: 'MARKET_ARCHIVED',
      entityType: 'VPMXMarket',
      entityId: market.id,
      details: {
        symbol: market.symbol,
        name: market.name,
        status: market.status,
      },
      severity: 'info',
    });

    return updated;
  }

  /**
   * Helper: Find market or throw 404
   */
  private async findMarket(id: string) {
    const market = await this.prisma.vPMXTradingMarket.findUnique({
      where: { id },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    return market;
  }

  /**
   * Helper: Validate VTS symbol format
   * V:CC:SEC:TICKER
   */
  private validateVTSSymbol(symbol: string): boolean {
    const vtsPattern = /^V:[A-Z]{2}:[A-Z]{3,6}:[A-Z0-9]+$/;
    return vtsPattern.test(symbol);
  }
}
