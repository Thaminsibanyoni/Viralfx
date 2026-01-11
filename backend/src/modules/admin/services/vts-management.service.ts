import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { AdminWebSocketService } from "./admin-websocket.service";

@Injectable()
export class VTSManagementService {
  private readonly logger = new Logger(VTSManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminWebSocketService: AdminWebSocketService) {}

  async getSymbols(filters: {
    page: number;
    limit: number;
    category?: string;
    region?: string;
    status?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.region) {
      where.region = filters.region;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { symbol: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
        { alias: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [symbols, total] = await this.prisma.$transaction([
      this.prisma.topic.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          viralIndexSnapshots: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: {
              viralIndex: true,
              sentimentScore: true,
              timestamp: true
            }
          },
          _count: {
            select: {
              bets: true,
              watchlists: true,
              marketOrders: true
            }
          }
        }
      }),
      this.prisma.topic.count({ where }),
    ]);

    return {
      symbols: symbols.map(symbol => ({
        id: symbol.id,
        symbol: symbol.symbol,
        title: symbol.title,
        alias: symbol.alias,
        category: symbol.category,
        region: symbol.region,
        status: symbol.status,
        viralityScore: symbol.viralIndexSnapshots[0]?.viralIndex || 0,
        sentimentScore: symbol.viralIndexSnapshots[0]?.sentimentScore || 0,
        lastUpdated: symbol.viralIndexSnapshots[0]?.timestamp || symbol.updatedAt,
        usage: {
          bets: symbol._count.bets,
          watchlists: symbol._count.watchlists,
          marketOrders: symbol._count.marketOrders
        },
        createdAt: symbol.createdAt,
        updatedAt: symbol.updatedAt
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit)
    };
  }

  async getSymbolById(id: string) {
    const symbol = await this.prisma.topic.findUnique({
      where: { id },
      include: {
        viralIndexSnapshots: {
          orderBy: { timestamp: 'desc' },
          take: 100 // Get recent history
        },
        bets: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, email: true, username: true }
            }
          }
        },
        watchlists: {
          take: 10,
          include: {
            user: {
              select: { id: true, email: true, username: true }
            }
          }
        },
        _count: {
          select: {
            bets: true,
            watchlists: true,
            marketOrders: true,
            ingestEvents: true
          }
        }
      }
    });

    if (!symbol) {
      throw new NotFoundException('VTS symbol not found');
    }

    // Get version history if available
    const versionHistory = await this.getSymbolVersionHistory(id);

    return {
      id: symbol.id,
      symbol: symbol.symbol,
      title: symbol.title,
      alias: symbol.alias,
      category: symbol.category,
      region: symbol.region,
      status: symbol.status,
      description: symbol.description,
      metadata: symbol.metadata,
      versionHistory,
      viralityHistory: symbol.viralIndexSnapshots.map(snapshot => ({
        timestamp: snapshot.timestamp,
        viralityScore: snapshot.viralIndex,
        sentimentScore: snapshot.sentimentScore
      })),
      recentActivity: {
        bets: symbol.bets.map(bet => ({
          id: bet.id,
          type: bet.type,
          amount: bet.amount,
          result: bet.result,
          user: bet.user,
          createdAt: bet.createdAt
        })),
        watchlists: symbol.watchlists.map(watchlist => ({
          id: watchlist.id,
          user: watchlist.user,
          createdAt: watchlist.createdAt
        }))
      },
      usage: {
        totalBets: symbol._count.bets,
        totalWatchlists: symbol._count.watchlists,
        totalMarketOrders: symbol._count.marketOrders,
        totalEvents: symbol._count.ingestEvents
      },
      createdAt: symbol.createdAt,
      updatedAt: symbol.updatedAt
    };
  }

  async getAliases(filters: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { symbol: { contains: filters.search, mode: 'insensitive' } },
        { alias: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [aliases, total] = await this.prisma.$transaction([
      this.prisma.vtsAlias.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          topic: {
            select: {
              id: true,
              symbol: true,
              title: true,
              status: true
            }
          }
        }
      }),
      this.prisma.vtsAlias.count({ where }),
    ]);

    return {
      aliases: aliases.map(alias => ({
        id: alias.id,
        symbol: alias.symbol,
        alias: alias.alias,
        isActive: alias.isActive,
        topic: alias.topic,
        createdAt: alias.createdAt,
        updatedAt: alias.updatedAt
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit)
    };
  }

  async updateAlias(id: string, alias: string, adminId: string) {
    // Check if alias already exists for another symbol
    const existingAlias = await this.prisma.vtsAlias.findFirst({
      where: {
        alias: alias.toLowerCase(),
        isActive: true,
        NOT: { id }
      }
    });

    if (existingAlias) {
      throw new BadRequestException('Alias already exists for another symbol');
    }

    const updatedAlias = await this.prisma.vtsAlias.update({
      where: { id },
      data: {
        alias: alias.toLowerCase(),
        updatedBy: adminId,
        updatedAt: new Date()
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:alias:updated', {
      id,
      alias,
      updatedBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedAlias;
  }

  async mergeSymbols(sourceId: string, targetId: string, adminId: string) {
    // Validate both symbols exist
    const [sourceSymbol, targetSymbol] = await Promise.all([
      this.prisma.topic.findUnique({ where: { id: sourceId } }),
      this.prisma.topic.findUnique({ where: { id: targetId } }),
    ]);

    if (!sourceSymbol || !targetSymbol) {
      throw new NotFoundException('One or both symbols not found');
    }

    if (sourceSymbol.id === targetSymbol.id) {
      throw new BadRequestException('Cannot merge symbol with itself');
    }

    // Perform the merge in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Update all references from source to target
      await tx.bet.updateMany({
        where: { topicId: sourceId },
        data: { topicId: targetId }
      });

      await tx.watchlist.updateMany({
        where: { topicId: sourceId },
        data: { topicId: targetId }
      });

      await tx.marketOrder.updateMany({
        where: { topicId: sourceId },
        data: { topicId: targetId }
      });

      await tx.ingestEvent.updateMany({
        where: { topicId: sourceId },
        data: { topicId: targetId }
      });

      // Update aliases
      await tx.vtsAlias.updateMany({
        where: { symbol: sourceSymbol.symbol },
        data: { symbol: targetSymbol.symbol }
      });

      // Archive the source symbol
      await tx.topic.update({
        where: { id: sourceId },
        data: {
          status: 'MERGED',
          metadata: {
            ...sourceSymbol.metadata,
            mergedInto: targetId,
            mergedAt: new Date().toISOString(),
            mergedBy: adminId
          }
        }
      });

      return {
        sourceId,
        targetId,
        sourceSymbol: sourceSymbol.symbol,
        targetSymbol: targetSymbol.symbol
      };
    });

    // Create audit entry for merge
    await this.prisma.vtsMergeHistory.create({
      data: {
        sourceId,
        targetId,
        mergedBy: adminId,
        metadata: {
          sourceSymbol: sourceSymbol.symbol,
          targetSymbol: targetSymbol.symbol
        }
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:merged', {
      ...result,
      mergedBy: adminId,
      timestamp: new Date().toISOString()
    });

    this.logger.log(`VTS symbols merged: ${sourceSymbol.symbol} -> ${targetSymbol.symbol} by admin ${adminId}`);

    return result;
  }

  async splitSymbol(id: string, newSymbols: any[], adminId: string) {
    const symbol = await this.prisma.topic.findUnique({
      where: { id }
    });

    if (!symbol) {
      throw new NotFoundException('VTS symbol not found');
    }

    if (!symbol.metadata?.splitAllowed) {
      throw new BadRequestException('Symbol cannot be split');
    }

    // Perform split in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Archive original symbol
      await tx.topic.update({
        where: { id },
        data: {
          status: 'SPLIT',
          metadata: {
            ...symbol.metadata,
            splitInto: newSymbols.map(s => s.id),
            splitAt: new Date().toISOString(),
            splitBy: adminId
          }
        }
      });

      // Create new symbols
      const createdSymbols = await Promise.all(
        newSymbols.map(async (newSymbol) => {
          return await tx.topic.create({
            data: {
              symbol: newSymbol.symbol,
              title: newSymbol.title,
              alias: newSymbol.alias,
              category: newSymbol.category || symbol.category,
              region: newSymbol.region || symbol.region,
              status: 'ACTIVE',
              description: newSymbol.description || symbol.description,
              metadata: {
                ...newSymbol.metadata,
                splitFrom: id,
                createdAt: new Date().toISOString()
              }
            }
          });
        })
      );

      return createdSymbols;
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:split', {
      originalId: id,
      newSymbols: result,
      splitBy: adminId,
      timestamp: new Date().toISOString()
    });

    this.logger.log(`VTS symbol ${id} split into ${result.length} symbols by admin ${adminId}`);

    return result;
  }

  async updateCategory(id: string, category: string, adminId: string) {
    // Validate category
    const validCategories = await this.getCategories();
    if (!validCategories.includes(category)) {
      throw new BadRequestException(`Invalid category: ${category}`);
    }

    const updatedSymbol = await this.prisma.topic.update({
      where: { id },
      data: {
        category,
        metadata: {
          categoryUpdatedBy: adminId,
          categoryUpdatedAt: new Date().toISOString()
        }
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:updated', {
      id,
      category,
      updatedBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedSymbol;
  }

  async freezeSymbol(id: string, reason: string, adminId: string) {
    const updatedSymbol = await this.prisma.topic.update({
      where: { id },
      data: {
        status: 'FROZEN',
        metadata: {
          frozenBy: adminId,
          frozenAt: new Date().toISOString(),
          freezeReason: reason
        }
      }
    });

    // Cancel any active orders for this symbol
    await this.prisma.marketOrder.updateMany({
      where: {
        topicId: id,
        status: 'ACTIVE'
      },
      data: {
        status: 'CANCELLED',
        metadata: {
          cancelledBy: 'system',
          reason: 'Symbol frozen',
          cancelledAt: new Date().toISOString()
        }
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:frozen', {
      id,
      reason,
      frozenBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedSymbol;
  }

  async unfreezeSymbol(id: string, adminId: string) {
    const updatedSymbol = await this.prisma.topic.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        metadata: {
          unfrozenBy: adminId,
          unfrozenAt: new Date().toISOString()
        }
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:unfrozen', {
      id,
      unfrozenBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedSymbol;
  }

  async rollbackSymbol(id: string, version: number, adminId: string) {
    const versionHistory = await this.getSymbolVersionHistory(id);
    const targetVersion = versionHistory.find(v => v.version === version);

    if (!targetVersion) {
      throw new NotFoundException('Version not found');
    }

    // Create backup of current state
    const currentSymbol = await this.prisma.topic.findUnique({
      where: { id }
    });

    await this.prisma.vtsVersionHistory.create({
      data: {
        topicId: id,
        version: versionHistory.length + 1,
        data: currentSymbol,
        createdBy: adminId
      }
    });

    // Restore to target version
    const updatedSymbol = await this.prisma.topic.update({
      where: { id },
      data: {
        ...targetVersion.data,
        metadata: {
          ...targetVersion.data.metadata,
          rolledBackFrom: currentSymbol.version,
          rolledBackBy: adminId,
          rolledBackAt: new Date().toISOString()
        }
      }
    });

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:symbol:rollback', {
      id,
      version,
      rolledBackBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedSymbol;
  }

  async getDisputes(filters: {
    page: number;
    limit: number;
    status?: string;
    type?: string;
  }) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const [disputes, total] = await this.prisma.$transaction([
      this.prisma.vtsDispute.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          topic: {
            select: {
              id: true,
              symbol: true,
              title: true,
              category: true
            }
          },
          reportedBy: {
            select: {
              id: true,
              email: true,
              username: true
            }
          }
        }
      }),
      this.prisma.vtsDispute.count({ where }),
    ]);

    return {
      disputes: disputes.map(dispute => ({
        id: dispute.id,
        type: dispute.type,
        status: dispute.status,
        description: dispute.description,
        evidence: dispute.evidence,
        topic: dispute.topic,
        reportedBy: dispute.reportedBy,
        resolution: dispute.resolution,
        resolvedBy: dispute.resolvedBy,
        resolvedAt: dispute.resolvedAt,
        createdAt: dispute.createdAt,
        updatedAt: dispute.updatedAt
      })),
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit)
    };
  }

  async resolveDispute(id: string, resolution: any, adminId: string) {
    const dispute = await this.prisma.vtsDispute.findUnique({
      where: { id },
      include: {
        topic: true
      }
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const updatedDispute = await this.prisma.vtsDispute.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolution,
        resolvedBy: adminId,
        resolvedAt: new Date()
      }
    });

    // Apply resolution actions
    if (resolution.action) {
      switch (resolution.action) {
        case 'merge':
          if (resolution.targetSymbolId) {
            await this.mergeSymbols(dispute.topicId, resolution.targetSymbolId, adminId);
          }
          break;
        case 'freeze':
          await this.freezeSymbol(dispute.topicId, resolution.reason || 'Dispute resolution', adminId);
          break;
        case 'update_category':
          if (resolution.category) {
            await this.updateCategory(dispute.topicId, resolution.category, adminId);
          }
          break;
      }
    }

    // Emit WebSocket event
    await this.adminWebSocketService.broadcastToAdmins('vts:dispute:resolved', {
      id,
      resolution,
      resolvedBy: adminId,
      timestamp: new Date().toISOString()
    });

    return updatedDispute;
  }

  async getStatistics(timeframe: string = '30d') {
    const startDate = new Date();
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = timeframes[timeframe] || 30;
    startDate.setDate(startDate.getDate() - days);

    const [
      totalSymbols,
      activeSymbols,
      frozenSymbols,
      totalAliases,
      activeAliases,
      totalDisputes,
      resolvedDisputes,
      recentSymbols,
      symbolCategories,
      symbolRegions,
    ] = await Promise.all([
      this.prisma.topic.count(),
      this.prisma.topic.count({ where: { status: 'ACTIVE' } }),
      this.prisma.topic.count({ where: { status: 'FROZEN' } }),
      this.prisma.vtsAlias.count(),
      this.prisma.vtsAlias.count({ where: { isActive: true } }),
      this.prisma.vtsDispute.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.vtsDispute.count({
        where: {
          status: 'RESOLVED',
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.topic.count({ where: { createdAt: { gte: startDate } } }),
      this.prisma.topic.groupBy({
        by: ['category'],
        _count: true
      }),
      this.prisma.topic.groupBy({
        by: ['region'],
        _count: true
      }),
    ]);

    return {
      overview: {
        totalSymbols,
        activeSymbols,
        frozenSymbols,
        totalAliases,
        activeAliases
      },
      disputes: {
        totalDisputes,
        resolvedDisputes,
        resolutionRate: totalDisputes > 0 ? (resolvedDisputes / totalDisputes) * 100 : 0
      },
      activity: {
        recentSymbols,
        timeframe
      },
      distribution: {
        categories: symbolCategories.map(cat => ({
          category: cat.category,
          count: cat._count
        })),
        regions: symbolRegions.map(region => ({
          region: region.region,
          count: region._count
        }))
      }
    };
  }

  async getCategories() {
    const categories = await this.prisma.topic.groupBy({
      by: ['category'],
      where: {
        category: { not: null }
      },
      _count: true
    });

    return categories.map(cat => cat.category);
  }

  async getRegions() {
    const regions = await this.prisma.topic.groupBy({
      by: ['region'],
      where: {
        region: { not: null }
      },
      _count: true
    });

    return regions.map(region => region.region);
  }

  async validateSymbolFormat(symbol: string) {
    // VTS format: VIRAL/SA_CATEGORY_ID (e.g., VIRAL/SA_TECH_001)
    const vtsPattern = /^VIRAL\/[A-Z]{2}_[A-Z]+_\d{3}$/;
    const isValid = vtsPattern.test(symbol);

    if (!isValid) {
      return {
        valid: false,
        errors: [
          'Symbol must follow format: VIRAL/CC_CATEGORY_XXX',
          'CC: 2-letter country code',
          'CATEGORY: Category name in uppercase',
          'XXX: 3-digit numeric ID',
        ]
      };
    }

    // Check if symbol already exists
    const existingSymbol = await this.prisma.topic.findUnique({
      where: { symbol }
    });

    return {
      valid: true,
      exists: !!existingSymbol,
      message: existingSymbol ? 'Symbol already exists' : 'Symbol format is valid and available'
    };
  }

  async getSymbolUsage(id: string, timeframe: string = '30d') {
    const startDate = new Date();
    const timeframes = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    const days = timeframes[timeframe] || 30;
    startDate.setDate(startDate.getDate() - days);

    const [
      totalBets,
      totalVolume,
      uniqueUsers,
      watchlistAdds,
      marketOrders,
      dailyUsage,
    ] = await Promise.all([
      this.prisma.bet.count({
        where: {
          topicId: id,
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.bet.aggregate({
        where: {
          topicId: id,
          createdAt: { gte: startDate }
        },
        _sum: { amount: true }
      }),
      this.prisma.bet.groupBy({
        by: ['userId'],
        where: {
          topicId: id,
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.watchlist.count({
        where: {
          topicId: id,
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.marketOrder.count({
        where: {
          topicId: id,
          createdAt: { gte: startDate }
        }
      }),
      // Daily usage aggregation
      this.prisma.$queryRaw`
        SELECT
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as bets,
          COALESCE(SUM(amount), 0) as volume
        FROM bets
        WHERE topic_id = ${id}
          AND created_at >= ${startDate}
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `,
    ]);

    return {
      summary: {
        totalBets,
        totalVolume: totalVolume._sum.amount || 0,
        uniqueUsers: uniqueUsers.length,
        watchlistAdds,
        marketOrders
      },
      dailyUsage,
      timeframe
    };
  }

  async getSystemHealth() {
    const [
      totalSymbols,
      activeNodes,
      pendingDisputes,
      frozenSymbols,
      systemErrors,
      lastSync,
    ] = await Promise.all([
      this.prisma.topic.count(),
      this.prisma.validatorNode.count({
        where: { status: 'ONLINE' }
      }),
      this.prisma.vtsDispute.count({
        where: { status: 'PENDING' }
      }),
      this.prisma.topic.count({
        where: { status: 'FROZEN' }
      }),
      this.prisma.systemError.count({
        where: {
          component: 'VTS',
          resolved: false
        }
      }),
      this.prisma.vtsSyncHistory.findFirst({
        orderBy: { createdAt: 'desc' }
      }),
    ]);

    const healthScore = Math.max(0, Math.min(100, (
      (activeNodes / 7) * 30 + // 30% weight for node health
      ((totalSymbols - frozenSymbols) / Math.max(1, totalSymbols)) * 30 + // 30% weight for symbol availability
      (Math.max(0, 10 - pendingDisputes) / 10) * 20 + // 20% weight for dispute resolution
      (Math.max(0, 5 - systemErrors) / 5) * 20 // 20% weight for system errors
    )));

    return {
      healthScore,
      status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 60 ? 'WARNING' : 'CRITICAL',
      metrics: {
        totalSymbols,
        activeNodes,
        pendingDisputes,
        frozenSymbols,
        systemErrors,
        lastSync: lastSync?.createdAt || null
      }
    };
  }

  private async getSymbolVersionHistory(id: string) {
    return await this.prisma.vtsVersionHistory.findMany({
      where: { topicId: id },
      orderBy: { version: 'desc' },
      take: 10
    });
  }
}
