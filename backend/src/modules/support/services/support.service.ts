import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TicketCategory } from '../entities/ticket-category.entity';
import { KnowledgeBaseArticle } from '../entities/knowledge-base-article.entity';
import { TicketSLA } from '../entities/ticket-sla.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly ticketMessageRepository: Repository<TicketMessage>,
    @InjectRepository(TicketCategory)
    private readonly ticketCategoryRepository: Repository<TicketCategory>,
    @InjectRepository(KnowledgeBaseArticle)
    private readonly knowledgeBaseArticleRepository: Repository<KnowledgeBaseArticle>,
    @InjectRepository(TicketSLA)
    private readonly ticketSLARepository: Repository<TicketSLA>,
    @InjectQueue('support-tickets')
    private readonly supportQueue: Queue,
  ) {}

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
      this.ticketRepository.count({
        where: { createdAt: Between(startDate, now) },
      }),
      this.ticketRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: TicketStatus.NEW,
        },
      }),
      this.ticketRepository.count({
        where: {
          createdAt: Between(startDate, now),
          status: TicketStatus.OPEN,
        },
      }),
      this.ticketRepository.count({
        where: {
          resolvedAt: Between(startDate, now),
        },
      }),
      this.ticketRepository.count({
        where: {
          closedAt: Between(startDate, now),
        },
      }),
      this.getOverdueTicketCount(),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .groupBy('ticket.status')
        .getRawMany(),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .groupBy('ticket.priority')
        .getRawMany(),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .leftJoin('ticket.category', 'category')
        .select('category.name', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
        .groupBy('category.name')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
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
        slaComplianceRate,
      },
      charts: {
        ticketsByStatus,
        ticketsByPriority,
        ticketsByCategory,
      },
      knowledgeBase: knowledgeBaseStats,
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
      this.ticketRepository.count({
        where: {
          assignedTo: agentId,
          createdAt: Between(startDate, now),
        },
      }),
      this.ticketRepository.count({
        where: {
          assignedTo: agentId,
          resolvedAt: Between(startDate, now),
        },
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
        slaComplianceRate,
      },
      charts: {
        ticketsByDay,
      },
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

    const resolvedTickets = await this.ticketRepository.count({
      where: {
        resolvedAt: Between(startDate, now),
      },
    });

    // Mock satisfaction scores - in real implementation, this would come from surveys
    const satisfactionScores = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('DATE(ticket.resolvedAt)', 'date')
      .addSelect('RANDOM() * 2 + 3', 'score') // Random score between 3-5
      .where('ticket.resolvedAt BETWEEN :start AND :end', { start: startDate, end: now })
      .groupBy('DATE(ticket.resolvedAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    const avgScore = satisfactionScores.length > 0
      ? satisfactionScores.reduce((sum, item) => sum + parseFloat(item.score), 0) / satisfactionScores.length
      : 0;

    return {
      period,
      totalResolved: resolvedTickets,
      averageScore: Math.round(avgScore * 100) / 100,
      scores: satisfactionScores,
    };
  }

  async getTicketTrends(period: 'week' | 'month' | 'quarter' | 'year' = 'month') {
    const now = new Date();
    let startDate: Date;
    let groupBy: string;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'DATE(ticket.createdAt)';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        groupBy = 'DATE(ticket.createdAt)';
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        groupBy = 'DATE_TRUNC(\'week\', ticket.createdAt)';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        groupBy = 'DATE_TRUNC(\'month\', ticket.createdAt)';
        break;
    }

    const ticketTrends = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select(groupBy, 'date')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COUNT(CASE WHEN ticket.status = :resolved THEN 1 END)', 'resolved')
      .addSelect('COUNT(CASE WHEN ticket.status = :closed THEN 1 END)', 'closed')
      .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: now })
      .groupBy(groupBy)
      .orderBy('date', 'ASC')
      .setParameters({
        resolved: TicketStatus.RESOLVED,
        closed: TicketStatus.CLOSED,
      })
      .getRawMany();

    return {
      period,
      trends: ticketTrends.map(item => ({
        date: item.date,
        created: parseInt(item.count),
        resolved: parseInt(item.resolved),
        closed: parseInt(item.closed),
      })),
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
      this.ticketRepository.count({
        where: {
          createdAt: Between(lastMonth, thisMonth),
        },
      }),
      this.ticketRepository.count({
        where: {
          createdAt: Between(thisMonth, now),
        },
      }),
      this.ticketCategoryRepository.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC' },
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
        activeAgents: agents.length,
      },
      categories,
      agents,
      knowledgeBaseUsage,
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
        endDate,
      },
      ticketMetrics,
      agentPerformance,
      categoryBreakdown,
      slaMetrics,
      customerSatisfaction,
      knowledgeBaseStats,
      generatedAt: new Date(),
    };

    if (format === 'csv') {
      return this.convertReportToCSV(report);
    }

    return report;
  }

  // Private helper methods
  private async getOverdueTicketCount(): Promise<number> {
    return await this.ticketSLARepository
      .createQueryBuilder('ticketSLA')
      .leftJoin('ticketSLA.ticket', 'ticket')
      .where('ticket.status NOT IN (:...closedStatuses)', {
        closedStatuses: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
      })
      .andWhere('(ticketSLA.responseDueAt < :now OR ticketSLA.resolutionDueAt < :now)', {
        now: new Date(),
      })
      .getCount();
  }

  private async getAverageResolutionTime(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticket.resolvedAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .andWhere('ticket.status = :status', { status: TicketStatus.RESOLVED })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }

  private async getSLAComplianceRate(startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.ticketSLARepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, endDate),
          responseMetAt: Between(startDate, endDate),
          resolutionMetAt: Between(startDate, endDate),
        },
      }),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }

  private async getKnowledgeBaseStats() {
    const [totalArticles, publishedArticles, totalViews] = await Promise.all([
      this.knowledgeBaseArticleRepository.count(),
      this.knowledgeBaseArticleRepository.count({
        where: { status: 'PUBLISHED' },
      }),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.views)', 'total')
        .getRawOne(),
    ]);

    return {
      totalArticles,
      publishedArticles,
      totalViews: parseInt(totalViews?.total || 0),
    };
  }

  private async getAgentAverageResolutionTime(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticket.resolvedAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticket.assignedTo = :agentId', { agentId })
      .andWhere('ticket.resolvedAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }

  private async getAgentAverageFirstResponseTime(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('AVG(EXTRACT(EPOCH FROM (ticket.firstResponseAt - ticket.createdAt)) / 60)', 'avgMinutes')
      .where('ticket.assignedTo = :agentId', { agentId })
      .andWhere('ticket.firstResponseAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .getRawOne();

    return Math.round(parseFloat(result?.avgMinutes || 0));
  }

  private async getAgentCustomerSatisfaction(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    // Mock implementation - would integrate with real satisfaction data
    return Math.random() * 2 + 3; // Random score between 3-5
  }

  private async getAgentSLAComplianceRate(agentId: string, startDate: Date, endDate: Date): Promise<number> {
    const [totalTickets, compliantTickets] = await Promise.all([
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),
      this.ticketSLARepository
        .createQueryBuilder('ticketSLA')
        .leftJoin('ticketSLA.ticket', 'ticket')
        .where('ticket.assignedTo = :agentId', { agentId })
        .andWhere('ticketSLA.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .andWhere('ticketSLA.responseMetAt IS NOT NULL AND ticketSLA.resolutionMetAt IS NOT NULL')
        .getCount(),
    ]);

    return totalTickets > 0 ? (compliantTickets / totalTickets) * 100 : 0;
  }

  private async getTicketsByDay(agentId: string, startDate: Date, endDate: Date) {
    return await this.ticketRepository
      .createQueryBuilder('ticket')
      .select('DATE(ticket.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('ticket.assignedTo = :agentId', { agentId })
      .andWhere('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('DATE(ticket.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();
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
    const [totalViews, topArticles] = await Promise.all([
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.views)', 'total')
        .getRawOne(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .leftJoinAndSelect('article.category', 'category')
        .where('article.status = :status', { status: 'PUBLISHED' })
        .orderBy('article.views', 'DESC')
        .limit(5)
        .getMany(),
    ]);

    return {
      totalViews: parseInt(totalViews?.total || 0),
      topArticles,
    };
  }

  private async getTicketMetricsForReport(startDate: Date, endDate: Date) {
    const [total, byStatus, byPriority, avgResolution] = await Promise.all([
      this.ticketRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('ticket.status')
        .getRawMany(),
      this.ticketRepository
        .createQueryBuilder('ticket')
        .select('ticket.priority', 'priority')
        .addSelect('COUNT(*)', 'count')
        .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .groupBy('ticket.priority')
        .getRawMany(),
      this.getAverageResolutionTime(startDate, endDate),
    ]);

    return { total, byStatus, byPriority, avgResolution };
  }

  private async getAgentPerformanceForReport(startDate: Date, endDate: Date) {
    // Implementation for agent performance report
    return [];
  }

  private async getCategoryBreakdownForReport(startDate: Date, endDate: Date) {
    return await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoin('ticket.category', 'category')
      .select('category.name', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('ticket.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
      .groupBy('category.name')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  private async getSLAMetricsForReport(startDate: Date, endDate: Date) {
    const [total, compliant, breached] = await Promise.all([
      this.ticketSLARepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, endDate),
          responseMetAt: Between(startDate, endDate),
          resolutionMetAt: Between(startDate, endDate),
        },
      }),
      this.ticketSLARepository.count({
        where: {
          createdAt: Between(startDate, endDate),
          responseBreachedAt: Between(startDate, endDate),
        },
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
        1: 3,
      },
    };
  }

  private async getKnowledgeBaseStatsForReport(startDate: Date, endDate: Date) {
    const [articles, views, helpful] = await Promise.all([
      this.knowledgeBaseArticleRepository.count({
        where: { createdAt: Between(startDate, endDate) },
      }),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.views)', 'total')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),
      this.knowledgeBaseArticleRepository
        .createQueryBuilder('article')
        .select('SUM(article.helpful)', 'total')
        .where('article.createdAt BETWEEN :start AND :end', { start: startDate, end: endDate })
        .getRawOne(),
    ]);

    return {
      articles,
      views: parseInt(views?.total || 0),
      helpful: parseInt(helpful?.total || 0),
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