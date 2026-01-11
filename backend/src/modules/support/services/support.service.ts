import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue) {}

  async getDashboardMetrics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [
      totalTickets,
      newTickets,
      openTickets,
      resolvedTickets,
      closedTickets,
      overdueTickets,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      avgResolutionTime,
      slaComplianceRate,
      knowledgeBaseStats,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: { createdAt: { gte: startDate, lte: now } }
      }),
      this.prisma.ticket.count({
        where: {
          createdAt: { gte: startDate, lte: now },
          status: 'NEW'
        }
      }),
      this.prisma.ticket.count({
        where: {
          createdAt: { gte: startDate, lte: now },
          status: 'OPEN'
        }
      }),
      this.prisma.ticket.count({
        where: {
          resolvedAt: { gte: startDate, lte: now }
        }
      }),
      this.prisma.ticket.count({
        where: {
          closedAt: { gte: startDate, lte: now }
        }
      }),
      this.getOverdueTicketCount(),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate, lte: now } },
        _count: true
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: { createdAt: { gte: startDate, lte: now } },
        _count: true
      }),
      this.prisma.ticket.groupBy({
        by: ['categoryId'],
        where: { createdAt: { gte: startDate, lte: now } },
        _count: true,
        orderBy: { _count: { categoryId: 'desc' } },
        take: 10
      }),
      this.getAverageResolutionTime(startDate, now),
      this.getSLAComplianceRate(startDate, now),
      this.getKnowledgeBaseStats(),
    ]);

    return {
      period,
      summary: {
        totalTickets,
        newTickets,
        openTickets,
        resolvedTickets,
        closedTickets,
        overdueTickets,
        avgResolutionTime,
        slaComplianceRate
      },
      charts: {
        ticketsByStatus,
        ticketsByPriority,
        ticketsByCategory
      },
      knowledgeBase: knowledgeBaseStats
    };
  }

  async getAgentPerformance(agentId: string, period: 'day' | 'week' | 'month' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const [
      assignedTickets,
      resolvedTickets,
      avgResolutionTime,
      avgFirstResponseTime,
      customerSatisfaction,
      slaComplianceRate,
      ticketsByDay,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          assignedTo: agentId,
          createdAt: { gte: startDate, lte: now }
        }
      }),
      this.prisma.ticket.count({
        where: {
          assignedTo: agentId,
          resolvedAt: { gte: startDate, lte: now }
        }
      }),
      this.getAgentAverageResolutionTime(agentId, startDate, now),
      this.getAgentAverageFirstResponseTime(agentId, startDate, now),
      this.getAgentCustomerSatisfaction(agentId, startDate, now),
      this.getAgentSLAComplianceRate(agentId, startDate, now),
      this.getTicketsByDay(agentId, startDate, now),
    ]);

    return {
      period,
      agentId,
      metrics: {
        assignedTickets,
        resolvedTickets,
        resolutionRate: assignedTickets > 0 ? (resolvedTickets / assignedTickets) * 100 : 0,
        avgResolutionTime,
        avgFirstResponseTime,
        customerSatisfaction,
        slaComplianceRate
      },
      charts: {
        ticketsByDay
      }
    };
  }

  async getCustomerSatisfaction(period: 'day' | 'week' | 'month' | 'year' = 'month') {
    // This would integrate with a customer satisfaction survey system
    // For now, return mock data based on ticket resolutions
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const resolvedTickets = await this.prisma.ticket.count({
      where: {
        resolvedAt: { gte: startDate, lte: now }
      }
    });

    // Mock satisfaction scores - in real implementation, this would come from surveys
    const satisfactionScores = await this.prisma.ticket.findMany({
      where: {
        resolvedAt: { gte: startDate, lte: now }
      },
      select: {
        resolvedAt: true
      }
    });

    // Group by date and generate random scores
    const scoresByDate = satisfactionScores.reduce((acc, ticket) => {
      const dateKey = ticket.resolvedAt.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, score: (Math.random() * 2 + 3).toFixed(2) };
      }
      return acc;
    }, {} as Record<string, { date: string; score: string }>);

    const scoresArray = Object.values(scoresByDate).sort((a, b) => a.date.localeCompare(b.date));

    const avgScore = scoresArray.length > 0
      ? scoresArray.reduce((sum, item) => sum + parseFloat(item.score), 0) / scoresArray.length
      : 0;

    return {
      period,
      totalResolved: resolvedTickets,
      averageScore: Math.round(avgScore * 100) / 100,
      scores: scoresArray
    };
  }

  async getTicketTrends(period: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const tickets = await this.prisma.ticket.findMany({
      where: {
        createdAt: { gte: startDate, lte: now }
      },
      select: {
        createdAt: true,
        status: true
      }
    });

    // Group by date
    const trendsMap = new Map<string, { created: number; resolved: number; closed: number }>();

    tickets.forEach(ticket => {
      const dateKey = ticket.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(dateKey)) {
        trendsMap.set(dateKey, { created: 0, resolved: 0, closed: 0 });
      }
      const stats = trendsMap.get(dateKey)!;
      stats.created++;
      if (ticket.status === 'RESOLVED') stats.resolved++;
      if (ticket.status === 'CLOSED') stats.closed++;
    });

    const ticketTrends = Array.from(trendsMap.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period,
      trends: ticketTrends
    };
  }

  async getSupportAnalytics() {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      lastMonthTickets,
      thisMonthTickets,
      categories,
      agents,
      knowledgeBaseUsage,
    ] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          createdAt: { gte: lastMonth, lte: thisMonth }
        }
      }),
      this.prisma.ticket.count({
        where: {
          createdAt: { gte: thisMonth, lte: now }
        }
      }),
      this.prisma.ticketCategory.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' }
      }),
      this.getActiveAgents(),
      this.getKnowledgeBaseUsage(),
    ]);

    const growthRate = lastMonthTickets > 0
      ? ((thisMonthTickets - lastMonthTickets) / lastMonthTickets) * 100
      : 0;

    return {
      overview: {
        lastMonthTickets,
        thisMonthTickets,
        growthRate: Math.round(growthRate * 100) / 100,
        activeCategories: categories.length,
        activeAgents: agents.length
      },
      categories,
      agents,
      knowledgeBaseUsage
    };
  }

  async generateSupportReport(filters: {
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv';
  }) {
    const { startDate, endDate, format = 'json' } = filters;

    const [
      ticketMetrics,
      agentPerformance,
      categoryBreakdown,
      slaMetrics,
      customerSatisfaction,
      knowledgeBaseStats,
    ] = await Promise.all([
      this.getTicketMetricsForReport(startDate, endDate),
      this.getAgentPerformanceForReport(startDate, endDate),
      this.getCategoryBreakdownForReport(startDate, endDate),
      this.getSLAMetricsForReport(startDate, endDate),
      this.getCustomerSatisfactionForReport(startDate, endDate),
      this.getKnowledgeBaseStatsForReport(startDate, endDate),
    ]);

    const report = {
      period: {
        startDate,
        endDate
      },
      ticketMetrics,
      agentPerformance,
      categoryBreakdown,
      slaMetrics,
      customerSatisfaction,
      knowledgeBaseStats,
      generatedAt: new Date()
    };

    if (format === 'csv') {
      return this.convertReportToCSV(report);
    }

    return report;
  }

  // Private helper methods
  private async getOverdueTicketCount(): Promise<number> {
    const overdueTickets = await this.prisma.ticketSLA.findMany({
      where: {
        OR: [
          { responseDueAt: { lt: new Date() } },
          { resolutionDueAt: { lt: new Date() } }
        ],
        ticket: {
          status: {
            notIn: ['RESOLVED', 'CLOSED']
          }
        }
      },
      select: {
        id: true
      }
    });

    return overdueTickets.length;
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        resolvedAt: { gte: startDate, lte: endDate },
        status: 'RESOLVED'
      },
      select: {
        createdAt: true,
        resolvedAt: true
      }
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, ticket) => {
      const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + (diff / (1000 * 60));
    }, 0);

    return Math.round(totalMinutes / tickets.length);
  }

  private async getSLAComplianceRate(startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.prisma.ticketSLA.count({
        where: {
          ticket: {
            createdAt: { gte: startDate, lte: endDate }
          },
          responseMetAt: { not: null },
          resolutionMetAt: { not: null }
        }
      }),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }

  private async getKnowledgeBaseStats() {
    const [totalArticles, publishedArticles, articles] = await Promise.all([
      this.prisma.knowledgeBaseArticle.count(),
      this.prisma.knowledgeBaseArticle.count({
        where: { status: 'PUBLISHED' }
      }),
      this.prisma.knowledgeBaseArticle.findMany({
        select: {
          views: true
        }
      }),
    ]);

    const totalViews = articles.reduce((sum, article) => sum + (article.views || 0), 0);

    return {
      totalArticles,
      publishedArticles,
      totalViews
    };
  }

  private async getAgentAverageResolutionTime(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        assignedTo: agentId,
        resolvedAt: { gte: startDate, lte: endDate }
      },
      select: {
        createdAt: true,
        resolvedAt: true
      }
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, ticket) => {
      const diff = ticket.resolvedAt.getTime() - ticket.createdAt.getTime();
      return sum + (diff / (1000 * 60));
    }, 0);

    return Math.round(totalMinutes / tickets.length);
  }

  private async getAgentAverageFirstResponseTime(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        assignedTo: agentId,
        firstResponseAt: { gte: startDate, lte: endDate }
      },
      select: {
        createdAt: true,
        firstResponseAt: true
      }
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, ticket) => {
      const diff = ticket.firstResponseAt.getTime() - ticket.createdAt.getTime();
      return sum + (diff / (1000 * 60));
    }, 0);

    return Math.round(totalMinutes / tickets.length);
  }

  private async getAgentCustomerSatisfaction(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    // Mock implementation - would integrate with real satisfaction data
    return Math.random() * 2 + 3; // Random score between 3-5
  }

  private async getAgentSLAComplianceRate(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      this.prisma.ticketSLA.count({
        where: {
          ticket: {
            assignedTo: agentId,
            createdAt: { gte: startDate, lte: endDate }
          },
          responseMetAt: { not: null },
          resolutionMetAt: { not: null }
        }
      }),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }

  private async getTicketsByDay(agentId: string, startDate: Date, endDate: Date) {
    const tickets = await this.prisma.ticket.findMany({
      where: {
        assignedTo: agentId,
        createdAt: { gte: startDate, lte: endDate }
      },
      select: {
        createdAt: true
      }
    });

    // Group by date
    const ticketsByDate = tickets.reduce((acc, ticket) => {
      const dateKey = ticket.createdAt.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, count: 0 };
      }
      acc[dateKey].count++;
      return acc;
    }, {} as Record<string, { date: string; count: number }>);

    return Object.values(ticketsByDate).sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getActiveAgents() {
    // This would query the users table for support agents
    // For now, return mock data
    return [
      { id: '1', name: 'Agent 1', activeTickets: 5 },
      { id: '2', name: 'Agent 2', activeTickets: 3 },
    ];
  }

  private async getKnowledgeBaseUsage() {
    const [articles, totalViews] = await Promise.all([
      this.prisma.knowledgeBaseArticle.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          category: true
        },
        orderBy: { views: 'desc' },
        take: 5
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        _sum: {
          views: true
        }
      })
    ]);

    return {
      totalViews: totalViews._sum.views || 0,
      topArticles: articles
    };
  }

  private async getTicketMetricsForReport(startDate: Date, endDate: Date) {
    const [total, byStatus, byPriority, avgResolution] = await Promise.all([
      this.prisma.ticket.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: true
      }),
      this.prisma.ticket.groupBy({
        by: ['priority'],
        where: { createdAt: { gte: startDate, lte: endDate } },
        _count: true
      }),
      this.getAverageResolutionTime(startDate, endDate),
    ]);

    return { total, byStatus, byPriority, avgResolution };
  }

  private async getAgentPerformanceForReport(startDate: Date, endDate: Date) {
    // Implementation for agent performance report
    return [];
  }

  private async getCategoryBreakdownForReport(startDate: Date, endDate: Date) {
    const ticketsByCategory = await this.prisma.ticket.groupBy({
      by: ['categoryId'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: true,
      orderBy: { _count: { categoryId: 'desc' } }
    });

    // Get category names
    const categoryIds = ticketsByCategory.map(t => t.categoryId).filter(Boolean);
    const categories = await this.prisma.ticketCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true }
    });

    const categoryMap = new Map(categories.map(c => [c.id, c.name]));

    return ticketsByCategory.map(item => ({
      category: item.categoryId ? categoryMap.get(item.categoryId) || 'Unknown' : 'Uncategorized',
      count: item._count
    }));
  }

  private async getSLAMetricsForReport(startDate: Date, endDate: Date) {
    const [total, compliant, breached] = await Promise.all([
      this.prisma.ticket.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.prisma.ticketSLA.count({
        where: {
          ticket: {
            createdAt: { gte: startDate, lte: endDate }
          },
          responseMetAt: { not: null },
          resolutionMetAt: { not: null }
        }
      }),
      this.prisma.ticketSLA.count({
        where: {
          ticket: {
            createdAt: { gte: startDate, lte: endDate }
          },
          responseBreachedAt: { gte: startDate, lte: endDate }
        }
      }),
    ]);

    const complianceRate = total > 0 ? (compliant / total) * 100 : 0;
    const breachRate = total > 0 ? (breached / total) * 100 : 0;

    return { total, compliant, breached, complianceRate, breachRate };
  }

  private async getCustomerSatisfactionForReport(startDate: Date, endDate: Date) {
    // Mock implementation
    return {
      averageScore: 4.2,
      totalResponses: 150,
      distribution: {
        5: 80,
        4: 40,
        3: 20,
        2: 7,
        1: 3
      }
    };
  }

  private async getKnowledgeBaseStatsForReport(startDate: Date, endDate: Date) {
    const [articles, views, helpful] = await Promise.all([
      this.prisma.knowledgeBaseArticle.count({
        where: { createdAt: { gte: startDate, lte: endDate } }
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: {
          views: true
        }
      }),
      this.prisma.knowledgeBaseArticle.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: {
          helpful: true
        }
      }),
    ]);

    return {
      articles,
      views: views._sum.views || 0,
      helpful: helpful._sum.helpful || 0
    };
  }

  private convertReportToCSV(report: any): string {
    // Convert report to CSV format
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Period', `${report.period.startDate} to ${report.period.endDate}`],
      ['Total Tickets', report.ticketMetrics.total],
      ['Average Resolution Time (minutes)', report.ticketMetrics.avgResolution],
      ['SLA Compliance Rate (%)', report.slaMetrics.complianceRate],
      ['Customer Satisfaction Score', report.customerSatisfaction.averageScore],
      ['Knowledge Base Articles', report.knowledgeBaseStats.articles],
      ['Knowledge Base Views', report.knowledgeBaseStats.views],
    ];

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}
