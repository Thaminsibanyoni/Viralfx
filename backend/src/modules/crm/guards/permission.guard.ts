import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get required permission from metadata
    const requiredPermission = this.reflector.get<string>(
      'permission',
      context.getHandler());

    // If no specific permission required, allow access (fallback to @Roles)
    if (!requiredPermission) {
      return true;
    }

    // Check if user has the required permission
    const hasPermission = this.checkUserPermission(user, requiredPermission);

    if (!hasPermission) {
      // Log access denial for audit
      await this.auditService.logAuditEvent({
        adminId: user.id,
        entity: 'ACCESS_DENIED',
        action: 'PERMISSION_CHECK_FAILED',
        entityId: user.id,
        changeDiff: JSON.stringify({
          endpoint: request.url,
          method: request.method,
          requiredPermission,
          userPermissions: user.permissions || []
        }),
        timestamp: new Date(),
        hmac: this.generateAuditHmac({
          endpoint: request.url,
          permission: requiredPermission,
          userId: user.id
        })
      });

      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermission}`);
    }

    return true;
  }

  private checkUserPermission(user: any, requiredPermission: string): boolean {
    if (!user.permissions || !Array.isArray(user.permissions)) {
      return false;
    }

    // Check for exact permission match
    if (user.permissions.includes(requiredPermission)) {
      return true;
    }

    // Check for wildcard permissions (e.g., crm.*)
    const permissionParts = requiredPermission.split('.');
    if (permissionParts.length >= 2) {
      const wildcardPermission = `${permissionParts[0]}.*`;
      if (user.permissions.includes(wildcardPermission)) {
        return true;
      }
    }

    // Check for admin role with all crm permissions
    if (user.role === 'SUPER_ADMIN' && requiredPermission.startsWith('crm.')) {
      return true;
    }

    return false;
  }

  private generateAuditHmac(data: any): string {
    const crypto = require('crypto');
    const secret = process.env.AUDIT_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }
}
