// Interface definitions to break circular dependencies

export interface IAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  auditLogs?: IAdminAuditLog[];
  sessions?: IAdminSession[];
  permissions?: IAdminPermission[];
}

export interface IAdminAuditLog {
  id: string;
  admin?: IAdminUser;
  adminId?: string;
  action: string;
  severity: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, any>;
}

export interface IAdminSession {
  id: string;
  admin: IAdminUser;
  adminId: string;
  token: string;
  refreshToken: string;
  isActive: boolean;
  expiresAt: Date;
}

export interface IAdminPermission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
  admins?: IAdminUser[];
}