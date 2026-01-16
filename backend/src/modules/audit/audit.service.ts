import { PrismaService } from '../../prisma/prisma.service';
import { Injectable, Logger } from "@nestjs/common";
import { AuditAction, AuditSeverity } from './enums/audit.enum';

export interface AuditEventInput {
  adminId: string;
  entity: string;
  action: string;
  entityId: string;
  changeDiff: string;
  timestamp: Date;
  hmac: string;
}

export interface AuditFilters {
  adminId?: string;
  entity?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async logAuditEvent(event: AuditEventInput): Promise<AuditLog> {
    try {
      return await this.prisma.auditLog.create({
        data: event,
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      throw error;
    }
  }

  async getAuditLogs(filters: AuditFilters = {}): Promise<AuditLog[]> {
    try {
      const { dateFrom, dateTo, limit = 100, offset = 0, ...otherFilters } = filters;

      const where: any = {
        ...otherFilters,
      };

      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }

      return await this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      });
    } catch (error) {
      this.logger.error('Failed to fetch audit logs', error);
      throw error;
    }
  }

  async getAuditLogCount(filters: AuditFilters = {}): Promise<number> {
    try {
      const { dateFrom, dateTo, ...otherFilters } = filters;

      const where: any = {
        ...otherFilters,
      };

      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }

      return await this.prisma.auditLog.count({ where });
    } catch (error) {
      this.logger.error('Failed to count audit logs', error);
      throw error;
    }
  }

  /**
   * Log an admin action with simplified interface
   */
  async logAdminAction(params: {
    adminId: string;
    action: AuditAction;
    severity: AuditSeverity;
    targetType: string;
    targetId: string;
    metadata?: Record<string, any>;
    description: string;
  }): Promise<any> {
    return await this.logAuditEvent({
      adminId: params.adminId,
      entity: params.targetType,
      action: params.action,
      entityId: params.targetId,
      changeDiff: JSON.stringify({
        severity: params.severity,
        metadata: params.metadata,
        description: params.description,
      }),
      timestamp: new Date(),
      hmac: '', // HMAC will be generated if needed
    });
  }

  /**
   * Log a market control action with simplified interface
   * For use by services that may not have admin context
   */
  async log(params: {
    action: string;
    entityType: string;
    entityId: string;
    details: Record<string, any>;
    severity: string;
  }): Promise<any> {
    // Map severity strings to enum values
    const severityMap: Record<string, AuditSeverity> = {
      'info': AuditSeverity.INFO,
      'warning': AuditSeverity.WARNING,
      'critical': AuditSeverity.CRITICAL,
      'low': AuditSeverity.LOW,
      'medium': AuditSeverity.MEDIUM,
      'high': AuditSeverity.HIGH,
    };

    const severity = severityMap[params.severity.toLowerCase()] || AuditSeverity.INFO;

    return await this.logAuditEvent({
      adminId: params.details.adminId || params.details.frozenBy || params.details.reviewedBy || 'system',
      entity: params.entityType,
      action: params.action as AuditAction,
      entityId: params.entityId,
      changeDiff: JSON.stringify({
        severity,
        metadata: params.details,
        description: `${params.action} on ${params.entityType}`,
      }),
      timestamp: new Date(),
      hmac: '',
    });
  }
}