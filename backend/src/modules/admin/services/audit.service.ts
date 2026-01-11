import { Injectable } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";

export interface AuditLogData {
  adminId?: string;
  userId?: string;
  entity: string;
  action: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async logAudit(data: AuditLogData) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          ...data,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Failed to log audit:', error);
      throw error;
    }
  }

  async getAuditLogs(filters: any = {}) {
    try {
      return await this.prisma.auditLog.findMany({
        where: filters,
        orderBy: { timestamp: 'desc' },
        take: 100,
      });
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }
}