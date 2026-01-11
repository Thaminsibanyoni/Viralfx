import { SetMetadata } from "@nestjs/common";

export const AUDIT_LOG_KEY = "audit_log";

export interface AuditLogOptions {
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export function AuditLog(options: AuditLogOptions): MethodDecorator {
  return SetMetadata(AUDIT_LOG_KEY, options);
}

export function AuditAction(action: string, resource?: string): MethodDecorator {
  return AuditLog({
    action,
    resource,
  });
}