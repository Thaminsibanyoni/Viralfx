import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditAction, AuditSeverity } from '../../audit/enums/audit.enum';

@Injectable()
export class AuditHelper {
  constructor(private prisma: PrismaService) {}

  async logAdminAction(
    adminId: string,
    action: AuditAction,
    severity: AuditSeverity,
    entity: string,
    entityId: string,
    ipAddress?: string,
    userAgent?: string,
    description?: string
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: adminId,
          action,
          entity,
          entityId,
          severity,
          metadata: {
            description,
            adminAction: true,
            timestamp: new Date().toISOString()
          },
          ipAddress,
          userAgent
        }
      });
    } catch (error) {
      // Silently fail to avoid breaking authentication flow
      console.error('Failed to log admin action:', error);
    }
  }
}
