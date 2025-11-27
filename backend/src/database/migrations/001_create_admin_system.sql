-- ========================================
-- SUPERADMIN SYSTEM MIGRATION
-- Created: 2025-11-14
-- Description: Complete SuperAdmin system with RBAC, audit logging, and department management
-- ========================================

-- Admin Permissions Table
CREATE TYPE permission_category_enum AS ENUM (
  'USER_MANAGEMENT',
  'BROKER_MANAGEMENT',
  'TREND_MANAGEMENT',
  'RISK_MANAGEMENT',
  'FINANCE_MANAGEMENT',
  'PLATFORM_MANAGEMENT',
  'SYSTEM_MANAGEMENT',
  'AUDIT_VIEW',
  'PREDICTIVE_ANALYTICS',
  'VTS_MANAGEMENT',
  'ORACLE_MANAGEMENT',
  'NOTIFICATION_MANAGEMENT',
  'ADMIN_MANAGEMENT'
);

CREATE TABLE "AdminPermissions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" character varying NOT NULL,
  "description" character varying NOT NULL,
  "category" permission_category_enum NOT NULL,
  "resource" character varying NOT NULL,
  "action" character varying NOT NULL,
  "conditions" jsonb NOT NULL DEFAULT '[]',
  "isSystemPermission" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AdminPermissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminPermissions_name_unique" UNIQUE ("name")
);

-- Admin Roles Enum
CREATE TYPE admin_role_enum AS ENUM (
  'SuperAdmin',
  'UserOps',
  'BrokerOps',
  'TrendOps',
  'RiskOps',
  'FinanceOps',
  'SupportOps',
  'TechOps',
  'ContentOps',
  'DepartmentHead'
);

-- Admin Status Enum
CREATE TYPE admin_status_enum AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'PENDING',
  'LOCKED'
);

-- Admin Users Table
CREATE TABLE "AdminUsers" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" character varying NOT NULL,
  "password" character varying NOT NULL,
  "firstName" character varying NOT NULL,
  "lastName" character varying NOT NULL,
  "avatar" character varying,
  "role" admin_role_enum NOT NULL DEFAULT 'UserOps',
  "status" admin_status_enum NOT NULL DEFAULT 'ACTIVE',
  "department" character varying,
  "twoFactorEnabled" boolean NOT NULL DEFAULT false,
  "twoFactorSecret" character varying,
  "ipWhitelist" jsonb NOT NULL DEFAULT '[]',
  "riskScore" numeric(5,2) NOT NULL DEFAULT 0.0,
  "behaviorPattern" jsonb,
  "predictiveFlags" jsonb NOT NULL DEFAULT '[]',
  "lastLoginAt" timestamp,
  "lastLoginIp" character varying,
  "deviceFingerprint" character varying,
  "isSuperAdmin" boolean NOT NULL DEFAULT false,
  "jurisdictionClearance" jsonb NOT NULL DEFAULT '[]',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AdminUsers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminUsers_email_unique" UNIQUE ("email")
);

-- Admin Sessions Table
CREATE TABLE "AdminSessions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "adminId" uuid NOT NULL,
  "token" character varying NOT NULL,
  "refreshToken" character varying NOT NULL,
  "deviceFingerprint" character varying,
  "ipAddress" character varying,
  "userAgent" character varying,
  "isActive" boolean NOT NULL DEFAULT true,
  "expiresAt" timestamp NOT NULL,
  "lastActivityAt" timestamp,
  "sessionData" jsonb NOT NULL DEFAULT '{}',
  "isMFAVerified" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AdminSessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSessions_token_unique" UNIQUE ("token"),
  CONSTRAINT "AdminSessions_refreshToken_unique" UNIQUE ("refreshToken")
);

-- Admin Audit Actions Enum
CREATE TYPE audit_action_enum AS ENUM (
  'LOGIN',
  'LOGOUT',
  'USER_SUSPEND',
  'USER_UNSUSPEND',
  'USER_BAN',
  'USER_UNBAN',
  'BROKER_APPROVE',
  'BROKER_SUSPEND',
  'PLATFORM_SETTING_CHANGE',
  'VTS_SYMBOL_UPDATE',
  'TREND_OVERRIDE',
  'RISK_ACTION',
  'FINANCE_TRANSACTION',
  'SYSTEM_ACTION',
  'NOTIFICATION_SEND',
  'ADMIN_CREATE',
  'ADMIN_UPDATE',
  'ADMIN_DELETE',
  'PERMISSION_GRANT',
  'PERMISSION_REVOKE'
);

-- Audit Severity Enum
CREATE TYPE audit_severity_enum AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
);

-- Admin Audit Logs Table
CREATE TABLE "AdminAuditLogs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "adminId" uuid,
  "action" audit_action_enum NOT NULL,
  "severity" audit_severity_enum NOT NULL DEFAULT 'LOW',
  "targetType" character varying NOT NULL,
  "targetId" character varying NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "ipAddress" character varying,
  "userAgent" character varying,
  "sessionId" character varying,
  "requiresReview" boolean NOT NULL DEFAULT false,
  "reviewedBy" uuid,
  "reviewedAt" timestamp,
  "reviewNotes" text,
  "isAutomatedAction" boolean NOT NULL DEFAULT false,
  "description" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "AdminAuditLogs_pkey" PRIMARY KEY ("id")
);

-- Junction Table for Admin-User Permissions
CREATE TABLE "AdminUserPermissions" (
  "adminId" uuid NOT NULL,
  "permissionId" uuid NOT NULL,
  "grantedAt" timestamp NOT NULL DEFAULT now(),
  "grantedBy" uuid,
  CONSTRAINT "AdminUserPermissions_pkey" PRIMARY KEY ("adminId", "permissionId"),
  CONSTRAINT "AdminUserPermissions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUsers"("id") ON DELETE CASCADE,
  CONSTRAINT "AdminUserPermissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermissions"("id") ON DELETE CASCADE
);

-- Foreign Key Constraints
ALTER TABLE "AdminUsers" ADD CONSTRAINT "AdminUsers_createdBy_fkey" FOREIGN KEY ("id") REFERENCES "AdminUsers"("id") ON DELETE SET NULL;

ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "AdminAuditLogs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUsers"("id") ON DELETE SET NULL;
ALTER TABLE "AdminAuditLogs" ADD CONSTRAINT "AdminAuditLogs_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "AdminUsers"("id") ON DELETE SET NULL;

ALTER TABLE "AdminSessions" ADD CONSTRAINT "AdminSessions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUsers"("id") ON DELETE CASCADE;

ALTER TABLE "AdminUserPermissions" ADD CONSTRAINT "AdminUserPermissions_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "AdminUsers"("id") ON DELETE SET NULL;

-- Indexes for Performance
CREATE INDEX "idx_admin_users_email" ON "AdminUsers"("email");
CREATE INDEX "idx_admin_users_role" ON "AdminUsers"("role");
CREATE INDEX "idx_admin_users_status" ON "AdminUsers"("status");
CREATE INDEX "idx_admin_users_department" ON "AdminUsers"("department");
CREATE INDEX "idx_admin_users_isSuperAdmin" ON "AdminUsers"("isSuperAdmin");
CREATE INDEX "idx_admin_users_createdAt" ON "AdminUsers"("createdAt");

CREATE INDEX "idx_admin_permissions_category" ON "AdminPermissions"("category");
CREATE INDEX "idx_admin_permissions_resource" ON "AdminPermissions"("resource");
CREATE INDEX "idx_admin_permissions_action" ON "AdminPermissions"("action");

CREATE INDEX "idx_admin_sessions_adminId" ON "AdminSessions"("adminId");
CREATE INDEX "idx_admin_sessions_token" ON "AdminSessions"("token");
CREATE INDEX "idx_admin_sessions_isActive" ON "AdminSessions"("isActive");
CREATE INDEX "idx_admin_sessions_expiresAt" ON "AdminSessions"("expiresAt");

CREATE INDEX "idx_admin_audit_logs_adminId" ON "AdminAuditLogs"("adminId");
CREATE INDEX "idx_admin_audit_logs_action" ON "AdminAuditLogs"("action");
CREATE INDEX "idx_admin_audit_logs_severity" ON "AdminAuditLogs"("severity");
CREATE INDEX "idx_admin_audit_logs_targetType" ON "AdminAuditLogs"("targetType");
CREATE INDEX "idx_admin_audit_logs_targetId" ON "AdminAuditLogs"("targetId");
CREATE INDEX "idx_admin_audit_logs_createdAt" ON "AdminAuditLogs"("createdAt");
CREATE INDEX "idx_admin_audit_logs_requiresReview" ON "AdminAuditLogs"("requiresReview");

-- Insert Default Permissions
INSERT INTO "AdminPermissions" ("name", "description", "category", "resource", "action", "isSystemPermission") VALUES
-- SuperAdmin Permissions
('dashboard:read', 'Access dashboard overview', 'PLATFORM_MANAGEMENT', 'dashboard', 'read', true),
('dashboard:write', 'Modify dashboard settings', 'PLATFORM_MANAGEMENT', 'dashboard', 'write', true),

-- UserOps Permissions
('users:read', 'View user information', 'USER_MANAGEMENT', 'users', 'read', false),
('users:create', 'Create new users', 'USER_MANAGEMENT', 'users', 'create', false),
('users:update', 'Update user information', 'USER_MANAGEMENT', 'users', 'update', false),
('users:suspend', 'Suspend user accounts', 'USER_MANAGEMENT', 'users', 'suspend', false),
('users:unsuspend', 'Unsuspend user accounts', 'USER_MANAGEMENT', 'users', 'unsuspend', false),
('users:ban', 'Ban user accounts', 'USER_MANAGEMENT', 'users', 'ban', false),
('users:unban', 'Unban user accounts', 'USER_MANAGEMENT', 'users', 'unban', false),
('kyc:read', 'View KYC information', 'USER_MANAGEMENT', 'kyc', 'read', false),
('kyc:update', 'Update KYC status', 'USER_MANAGEMENT', 'kyc', 'update', false),
('kyc:approve', 'Approve KYC applications', 'USER_MANAGEMENT', 'kyc', 'approve', false),
('kyc:reject', 'Reject KYC applications', 'USER_MANAGEMENT', 'kyc', 'reject', false),

-- BrokerOps Permissions
('brokers:read', 'View broker information', 'BROKER_MANAGEMENT', 'brokers', 'read', false),
('brokers:create', 'Create new brokers', 'BROKER_MANAGEMENT', 'brokers', 'create', false),
('brokers:update', 'Update broker information', 'BROKER_MANAGEMENT', 'brokers', 'update', false),
('brokers:approve', 'Approve broker applications', 'BROKER_MANAGEMENT', 'brokers', 'approve', false),
('brokers:suspend', 'Suspend broker accounts', 'BROKER_MANAGEMENT', 'brokers', 'suspend', false),
('brokers:verify', 'Verify broker compliance', 'BROKER_MANAGEMENT', 'brokers', 'verify', false),

-- TrendOps Permissions
('trends:read', 'View trend information', 'TREND_MANAGEMENT', 'trends', 'read', false),
('trends:create', 'Create new trends', 'TREND_MANAGEMENT', 'trends', 'create', false),
('trends:update', 'Update trend information', 'TREND_MANAGEMENT', 'trends', 'update', false),
('trends:override', 'Override trend classifications', 'TREND_MANAGEMENT', 'trends', 'override', false),
('trends:approve', 'Approve trend content', 'TREND_MANAGEMENT', 'trends', 'approve', false),
('trends:reject', 'Reject trend content', 'TREND_MANAGEMENT', 'trends', 'reject', false),

-- RiskOps Permissions
('risk:read', 'View risk information', 'RISK_MANAGEMENT', 'risk', 'read', false),
('risk:update', 'Update risk settings', 'RISK_MANAGEMENT', 'risk', 'update', false),
('risk:block', 'Block risky content', 'RISK_MANAGEMENT', 'risk', 'block', false),
('risk:approve', 'Approve content as safe', 'RISK_MANAGEMENT', 'risk', 'approve', false),
('risk:reject', 'Mark content as risky', 'RISK_MANAGEMENT', 'risk', 'reject', false),
('content:moderate', 'Moderate user content', 'RISK_MANAGEMENT', 'content', 'moderate', false),

-- FinanceOps Permissions
('finance:read', 'View financial information', 'FINANCE_MANAGEMENT', 'finance', 'read', false),
('finance:update', 'Update financial settings', 'FINANCE_MANAGEMENT', 'finance', 'update', false),
('payments:read', 'View payment information', 'FINANCE_MANAGEMENT', 'payments', 'read', false),
('payments:create', 'Create payment transactions', 'FINANCE_MANAGEMENT', 'payments', 'create', false),
('payments:update', 'Update payment transactions', 'FINANCE_MANAGEMENT', 'payments', 'update', false),
('invoices:read', 'View invoice information', 'FINANCE_MANAGEMENT', 'invoices', 'read', false),
('invoices:create', 'Create new invoices', 'FINANCE_MANAGEMENT', 'invoices', 'create', false),
('invoices:update', 'Update invoice information', 'FINANCE_MANAGEMENT', 'invoices', 'update', false),
('payouts:read', 'View payout information', 'FINANCE_MANAGEMENT', 'payouts', 'read', false),
('payouts:create', 'Create new payouts', 'FINANCE_MANAGEMENT', 'payouts', 'create', false),
('payouts:update', 'Update payout information', 'FINANCE_MANAGEMENT', 'payouts', 'update', false),

-- System Management Permissions
('system:read', 'View system information', 'SYSTEM_MANAGEMENT', 'system', 'read', false),
('system:update', 'Update system settings', 'SYSTEM_MANAGEMENT', 'system', 'update', false),
('oracle:read', 'View oracle information', 'SYSTEM_MANAGEMENT', 'oracle', 'read', false),
('oracle:update', 'Update oracle settings', 'SYSTEM_MANAGEMENT', 'oracle', 'update', false),
('nodes:manage', 'Manage system nodes', 'SYSTEM_MANAGEMENT', 'nodes', 'manage', false),
('logs:read', 'View system logs', 'SYSTEM_MANAGEMENT', 'logs', 'read', false),
('monitoring:read', 'View monitoring data', 'SYSTEM_MANAGEMENT', 'monitoring', 'read', false),

-- VTS Management Permissions
('vts:read', 'View VTS information', 'VTS_MANAGEMENT', 'vts', 'read', false),
('vts:create', 'Create VTS symbols', 'VTS_MANAGEMENT', 'vts', 'create', false),
('vts:update', 'Update VTS symbols', 'VTS_MANAGEMENT', 'vts', 'update', false),
('vts:delete', 'Delete VTS symbols', 'VTS_MANAGEMENT', 'vts', 'delete', false),

-- Admin Management Permissions
('admins:read', 'View admin information', 'ADMIN_MANAGEMENT', 'admins', 'read', false),
('admins:create', 'Create new admins', 'ADMIN_MANAGEMENT', 'admins', 'create', false),
('admins:update', 'Update admin information', 'ADMIN_MANAGEMENT', 'admins', 'update', false),
('admins:delete', 'Delete admin accounts', 'ADMIN_MANAGEMENT', 'admins', 'delete', false),
('permissions:read', 'View permission information', 'ADMIN_MANAGEMENT', 'permissions', 'read', false),
('permissions:create', 'Create new permissions', 'ADMIN_MANAGEMENT', 'permissions', 'create', false),
('permissions:update', 'Update permissions', 'ADMIN_MANAGEMENT', 'permissions', 'update', false),
('permissions:grant', 'Grant permissions to admins', 'ADMIN_MANAGEMENT', 'permissions', 'grant', false),
('permissions:revoke', 'Revoke permissions from admins', 'ADMIN_MANAGEMENT', 'permissions', 'revoke', false),

-- Audit and Monitoring
('audit:read', 'View audit logs', 'AUDIT_VIEW', 'audit', 'read', false),
('notifications:send', 'Send notifications', 'NOTIFICATION_MANAGEMENT', 'notifications', 'send', false),
('alerts:read', 'View system alerts', 'PLATFORM_MANAGEMENT', 'alerts', 'read', false),

-- Predictive Analytics
('predictive:read', 'View predictive insights', 'PREDICTIVE_ANALYTICS', 'predictive', 'read', false),
('predictive:update', 'Update predictive models', 'PREDICTIVE_ANALYTICS', 'predictive', 'update', false);

-- Create Default SuperAdmin (password: admin123)
-- Note: Change this password in production!
INSERT INTO "AdminUsers" (
  "email",
  "password",
  "firstName",
  "lastName",
  "role",
  "status",
  "isSuperAdmin",
  "twoFactorEnabled"
) VALUES (
  'superadmin@viralfx.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9L55O', -- bcrypt hash of 'admin123'
  'Super',
  'Admin',
  'SuperAdmin',
  'ACTIVE',
  true,
  false
);

-- Grant all permissions to SuperAdmin
INSERT INTO "AdminUserPermissions" ("adminId", "permissionId", "grantedBy")
SELECT
  (SELECT id FROM "AdminUsers" WHERE email = 'superadmin@viralfx.com'),
  id,
  (SELECT id FROM "AdminUsers" WHERE email = 'superadmin@viralfx.com')
FROM "AdminPermissions";

-- Create Comments
COMMENT ON TABLE "AdminUsers" IS 'SuperAdmin system user accounts with role-based access control';
COMMENT ON TABLE "AdminPermissions" IS 'Granular permissions for role-based access control';
COMMENT ON TABLE "AdminSessions" IS 'Admin session management with secure token storage';
COMMENT ON TABLE "AdminAuditLogs" IS 'Comprehensive audit logging for all admin actions';
COMMENT ON TABLE "AdminUserPermissions" IS 'Junction table for many-to-many admin-permission relationships';

-- Add RLS (Row Level Security) policies (PostgreSQL feature)
ALTER TABLE "AdminAuditLogs" ENABLE ROW LEVEL SECURITY;

-- Only admins can see audit logs, and only their own or if they have audit:read permission
CREATE POLICY "Admin audit log access" ON "AdminAuditLogs"
  FOR ALL
  TO authenticated_users
  USING (
    -- Admin can see their own logs
    adminId = current_setting('app.current_admin_id')::uuid
    -- Or users with audit:read permission can see all logs
    OR EXISTS (
      SELECT 1 FROM "AdminUserPermissions" aup
      JOIN "AdminPermissions" ap ON aup."permissionId" = ap.id
      WHERE aup."adminId" = current_setting('app.current_admin_id')::uuid
      AND ap.resource = 'audit' AND ap.action = 'read'
    )
  );