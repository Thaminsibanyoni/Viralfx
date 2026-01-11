import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminRole, PermissionCategory } from '../enums/admin.enum';

@Injectable()
export class AdminSeeder {
  private readonly logger = new Logger(AdminSeeder.name);

  constructor(
        ) {}

  async seed() {
    this.logger.log('Starting admin system seeding...');

    await this.seedPermissions();
    await this.seedSuperAdmin();

    this.logger.log('Admin system seeding completed!');
  }

  private async seedPermissions() {
    this.logger.log('Seeding permissions...');

    const permissions = [
      // Dashboard Permissions
      { name: 'dashboard:read', description: 'Access dashboard overview', category: PermissionCategory.PLATFORM_MANAGEMENT, resource: 'dashboard', action: 'read', isSystemPermission: true },
      { name: 'dashboard:write', description: 'Modify dashboard settings', category: PermissionCategory.PLATFORM_MANAGEMENT, resource: 'dashboard', action: 'write', isSystemPermission: true },

      // UserOps Permissions
      { name: 'users:read', description: 'View user information', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'read', isSystemPermission: false },
      { name: 'users:create', description: 'Create new users', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'create', isSystemPermission: false },
      { name: 'users:update', description: 'Update user information', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'update', isSystemPermission: false },
      { name: 'users:suspend', description: 'Suspend user accounts', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'suspend', isSystemPermission: false },
      { name: 'users:unsuspend', description: 'Unsuspend user accounts', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'unsuspend', isSystemPermission: false },
      { name: 'users:ban', description: 'Ban user accounts', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'ban', isSystemPermission: false },
      { name: 'users:unban', description: 'Unban user accounts', category: PermissionCategory.USER_MANAGEMENT, resource: 'users', action: 'unban', isSystemPermission: false },

      // KYC Permissions
      { name: 'kyc:read', description: 'View KYC information', category: PermissionCategory.USER_MANAGEMENT, resource: 'kyc', action: 'read', isSystemPermission: false },
      { name: 'kyc:update', description: 'Update KYC status', category: PermissionCategory.USER_MANAGEMENT, resource: 'kyc', action: 'update', isSystemPermission: false },
      { name: 'kyc:approve', description: 'Approve KYC applications', category: PermissionCategory.USER_MANAGEMENT, resource: 'kyc', action: 'approve', isSystemPermission: false },
      { name: 'kyc:reject', description: 'Reject KYC applications', category: PermissionCategory.USER_MANAGEMENT, resource: 'kyc', action: 'reject', isSystemPermission: false },

      // BrokerOps Permissions
      { name: 'brokers:read', description: 'View broker information', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'read', isSystemPermission: false },
      { name: 'brokers:create', description: 'Create new brokers', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'create', isSystemPermission: false },
      { name: 'brokers:update', description: 'Update broker information', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'update', isSystemPermission: false },
      { name: 'brokers:approve', description: 'Approve broker applications', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'approve', isSystemPermission: false },
      { name: 'brokers:suspend', description: 'Suspend broker accounts', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'suspend', isSystemPermission: false },
      { name: 'brokers:verify', description: 'Verify broker compliance', category: PermissionCategory.BROKER_MANAGEMENT, resource: 'brokers', action: 'verify', isSystemPermission: false },

      // TrendOps Permissions
      { name: 'trends:read', description: 'View trend information', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'read', isSystemPermission: false },
      { name: 'trends:create', description: 'Create new trends', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'create', isSystemPermission: false },
      { name: 'trends:update', description: 'Update trend information', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'update', isSystemPermission: false },
      { name: 'trends:override', description: 'Override trend classifications', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'override', isSystemPermission: false },
      { name: 'trends:approve', description: 'Approve trend content', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'approve', isSystemPermission: false },
      { name: 'trends:reject', description: 'Reject trend content', category: PermissionCategory.TREND_MANAGEMENT, resource: 'trends', action: 'reject', isSystemPermission: false },

      // RiskOps Permissions
      { name: 'risk:read', description: 'View risk information', category: PermissionCategory.RISK_MANAGEMENT, resource: 'risk', action: 'read', isSystemPermission: false },
      { name: 'risk:update', description: 'Update risk settings', category: PermissionCategory.RISK_MANAGEMENT, resource: 'risk', action: 'update', isSystemPermission: false },
      { name: 'risk:block', description: 'Block risky content', category: PermissionCategory.RISK_MANAGEMENT, resource: 'risk', action: 'block', isSystemPermission: false },
      { name: 'risk:approve', description: 'Approve content as safe', category: PermissionCategory.RISK_MANAGEMENT, resource: 'risk', action: 'approve', isSystemPermission: false },
      { name: 'risk:reject', description: 'Mark content as risky', category: PermissionCategory.RISK_MANAGEMENT, resource: 'risk', action: 'reject', isSystemPermission: false },
      { name: 'content:moderate', description: 'Moderate user content', category: PermissionCategory.RISK_MANAGEMENT, resource: 'content', action: 'moderate', isSystemPermission: false },

      // FinanceOps Permissions
      { name: 'finance:read', description: 'View financial information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'finance', action: 'read', isSystemPermission: false },
      { name: 'finance:update', description: 'Update financial settings', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'finance', action: 'update', isSystemPermission: false },
      { name: 'payments:read', description: 'View payment information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payments', action: 'read', isSystemPermission: false },
      { name: 'payments:create', description: 'Create payment transactions', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payments', action: 'create', isSystemPermission: false },
      { name: 'payments:update', description: 'Update payment transactions', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payments', action: 'update', isSystemPermission: false },
      { name: 'invoices:read', description: 'View invoice information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'invoices', action: 'read', isSystemPermission: false },
      { name: 'invoices:create', description: 'Create new invoices', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'invoices', action: 'create', isSystemPermission: false },
      { name: 'invoices:update', description: 'Update invoice information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'invoices', action: 'update', isSystemPermission: false },
      { name: 'payouts:read', description: 'View payout information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payouts', action: 'read', isSystemPermission: false },
      { name: 'payouts:create', description: 'Create new payouts', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payouts', action: 'create', isSystemPermission: false },
      { name: 'payouts:update', description: 'Update payout information', category: PermissionCategory.FINANCE_MANAGEMENT, resource: 'payouts', action: 'update', isSystemPermission: false },

      // System Management Permissions
      { name: 'system:read', description: 'View system information', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'system', action: 'read', isSystemPermission: false },
      { name: 'system:update', description: 'Update system settings', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'system', action: 'update', isSystemPermission: false },
      { name: 'oracle:read', description: 'View oracle information', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'oracle', action: 'read', isSystemPermission: false },
      { name: 'oracle:update', description: 'Update oracle settings', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'oracle', action: 'update', isSystemPermission: false },
      { name: 'nodes:manage', description: 'Manage system nodes', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'nodes', action: 'manage', isSystemPermission: false },
      { name: 'logs:read', description: 'View system logs', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'logs', action: 'read', isSystemPermission: false },
      { name: 'monitoring:read', description: 'View monitoring data', category: PermissionCategory.SYSTEM_MANAGEMENT, resource: 'monitoring', action: 'read', isSystemPermission: false },

      // VTS Management Permissions
      { name: 'vts:read', description: 'View VTS information', category: PermissionCategory.VTS_MANAGEMENT, resource: 'vts', action: 'read', isSystemPermission: false },
      { name: 'vts:create', description: 'Create VTS symbols', category: PermissionCategory.VTS_MANAGEMENT, resource: 'vts', action: 'create', isSystemPermission: false },
      { name: 'vts:update', description: 'Update VTS symbols', category: PermissionCategory.VTS_MANAGEMENT, resource: 'vts', action: 'update', isSystemPermission: false },
      { name: 'vts:delete', description: 'Delete VTS symbols', category: PermissionCategory.VTS_MANAGEMENT, resource: 'vts', action: 'delete', isSystemPermission: false },

      // Admin Management Permissions
      { name: 'admins:read', description: 'View admin information', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'admins', action: 'read', isSystemPermission: false },
      { name: 'admins:create', description: 'Create new admins', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'admins', action: 'create', isSystemPermission: false },
      { name: 'admins:update', description: 'Update admin information', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'admins', action: 'update', isSystemPermission: false },
      { name: 'admins:delete', description: 'Delete admin accounts', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'admins', action: 'delete', isSystemPermission: false },
      { name: 'permissions:read', description: 'View permission information', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'permissions', action: 'read', isSystemPermission: false },
      { name: 'permissions:create', description: 'Create new permissions', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'permissions', action: 'create', isSystemPermission: false },
      { name: 'permissions:update', description: 'Update permissions', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'permissions', action: 'update', isSystemPermission: false },
      { name: 'permissions:grant', description: 'Grant permissions to admins', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'permissions', action: 'grant', isSystemPermission: false },
      { name: 'permissions:revoke', description: 'Revoke permissions from admins', category: PermissionCategory.ADMIN_MANAGEMENT, resource: 'permissions', action: 'revoke', isSystemPermission: false },

      // Audit and Monitoring
      { name: 'audit:read', description: 'View audit logs', category: PermissionCategory.AUDIT_VIEW, resource: 'audit', action: 'read', isSystemPermission: false },
      { name: 'notifications:send', description: 'Send notifications', category: PermissionCategory.NOTIFICATION_MANAGEMENT, resource: 'notifications', action: 'send', isSystemPermission: false },
      { name: 'alerts:read', description: 'View system alerts', category: PermissionCategory.PLATFORM_MANAGEMENT, resource: 'alerts', action: 'read', isSystemPermission: false },

      // Predictive Analytics
      { name: 'predictive:read', description: 'View predictive insights', category: PermissionCategory.PREDICTIVE_ANALYTICS, resource: 'predictive', action: 'read', isSystemPermission: false },
      { name: 'predictive:update', description: 'Update predictive models', category: PermissionCategory.PREDICTIVE_ANALYTICS, resource: 'predictive', action: 'update', isSystemPermission: false },

      // CRM Management Permissions
      { name: 'crm.brokers.create', description: 'Create new broker records', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'create', isSystemPermission: false },
      { name: 'crm.brokers.read', description: 'View broker information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'read', isSystemPermission: false },
      { name: 'crm.brokers.update', description: 'Update broker information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'update', isSystemPermission: false },
      { name: 'crm.brokers.approve', description: 'Approve broker applications', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'approve', isSystemPermission: false },
      { name: 'crm.brokers.suspend', description: 'Suspend broker accounts', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'suspend', isSystemPermission: false },
      { name: 'crm.brokers.verify', description: 'Verify broker documents', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.brokers', action: 'verify', isSystemPermission: false },

      { name: 'crm.clients.read', description: 'View client information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.clients', action: 'read', isSystemPermission: false },
      { name: 'crm.clients.create', description: 'Create new client records', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.clients', action: 'create', isSystemPermission: false },
      { name: 'crm.clients.update', description: 'Update client information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.clients', action: 'update', isSystemPermission: false },
      { name: 'crm.clients.delete', description: 'Delete client records', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.clients', action: 'delete', isSystemPermission: false },
      { name: 'crm.clients.manage', description: 'Full client management access', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.clients', action: 'manage', isSystemPermission: false },

      { name: 'crm.invoices.read', description: 'View invoice information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'read', isSystemPermission: false },
      { name: 'crm.invoices.create', description: 'Create new invoices', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'create', isSystemPermission: false },
      { name: 'crm.invoices.update', description: 'Update invoice information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'update', isSystemPermission: false },
      { name: 'crm.invoices.manage', description: 'Full invoice management access', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'manage', isSystemPermission: false },
      { name: 'crm.invoices.send', description: 'Send invoices to clients', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'send', isSystemPermission: false },
      { name: 'crm.invoices.void', description: 'Void invoices', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.invoices', action: 'void', isSystemPermission: false },

      { name: 'crm.payments.read', description: 'View payment information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'read', isSystemPermission: false },
      { name: 'crm.payments.create', description: 'Create payment records', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'create', isSystemPermission: false },
      { name: 'crm.payments.update', description: 'Update payment information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'update', isSystemPermission: false },
      { name: 'crm.payments.manage', description: 'Full payment management access', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'manage', isSystemPermission: false },
      { name: 'crm.payments.refund', description: 'Process refunds', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'refund', isSystemPermission: false },
      { name: 'crm.payments.reconcile', description: 'Reconcile payments', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.payments', action: 'reconcile', isSystemPermission: false },

      { name: 'crm.tickets.read', description: 'View support tickets', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'read', isSystemPermission: false },
      { name: 'crm.tickets.create', description: 'Create support tickets', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'create', isSystemPermission: false },
      { name: 'crm.tickets.update', description: 'Update support tickets', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'update', isSystemPermission: false },
      { name: 'crm.tickets.manage', description: 'Full ticket management access', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'manage', isSystemPermission: false },
      { name: 'crm.tickets.assign', description: 'Assign tickets to staff', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'assign', isSystemPermission: false },
      { name: 'crm.tickets.close', description: 'Close support tickets', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'close', isSystemPermission: false },
      { name: 'crm.tickets.escalate', description: 'Escalate tickets', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.tickets', action: 'escalate', isSystemPermission: false },

      { name: 'crm.deals.read', description: 'View deal pipeline', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.deals', action: 'read', isSystemPermission: false },
      { name: 'crm.deals.create', description: 'Create new deals', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.deals', action: 'create', isSystemPermission: false },
      { name: 'crm.deals.update', description: 'Update deal information', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.deals', action: 'update', isSystemPermission: false },
      { name: 'crm.deals.manage', description: 'Full deal management access', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.deals', action: 'manage', isSystemPermission: false },
      { name: 'crm.deals.close', description: 'Close deals', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.deals', action: 'close', isSystemPermission: false },

      { name: 'crm.reports.read', description: 'View CRM reports', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.reports', action: 'read', isSystemPermission: false },
      { name: 'crm.reports.export', description: 'Export CRM data', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.reports', action: 'export', isSystemPermission: false },
      { name: 'crm.analytics.read', description: 'View CRM analytics', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.analytics', action: 'read', isSystemPermission: false },

      { name: 'crm.settings.read', description: 'View CRM settings', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.settings', action: 'read', isSystemPermission: false },
      { name: 'crm.settings.update', description: 'Update CRM settings', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.settings', action: 'update', isSystemPermission: false },
      { name: 'crm.automation.manage', description: 'Manage CRM automation rules', category: PermissionCategory.CRM_MANAGEMENT, resource: 'crm.automation', action: 'manage', isSystemPermission: false },
    ];

    for (const permissionData of permissions) {
      const existingPermission = await this.prisma.permissionrepository.findFirst({
        where: { name: permissionData.name }
      });

      if (!existingPermission) {
        const permission = this.prisma.permissionrepository.create(permissionData);
        await this.prisma.permissionrepository.upsert(permission);
        this.logger.log(`Created permission: ${permission.name}`);
      }
    }
  }

  private async seedSuperAdmin() {
    this.logger.log('Seeding SuperAdmin...');

    const superAdminEmail = 'superadmin@viralfx.com';
    const defaultPassword = 'admin123'; // Change this in production!

    const existingSuperAdmin = await this.prisma.adminrepository.findFirst({
      where: { email: superAdminEmail },
      relations: ['permissions']
    });

    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);

      const superAdmin = this.prisma.adminrepository.create({
        email: superAdminEmail,
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Admin',
        role: AdminRole.SUPER_ADMIN,
        status: 'ACTIVE' as any,
        isSuperAdmin: true,
        twoFactorEnabled: false,
        ipWhitelist: [], // Empty whitelist means any IP allowed in development
        jurisdictionClearance: ['*'], // All jurisdictions
        department: 'Executive'
      });

      const savedSuperAdmin = await this.prisma.adminrepository.upsert(superAdmin);

      // Grant all permissions to SuperAdmin
      const allPermissions = await this.prisma.permissionrepository.findMany();
      savedSuperAdmin.permissions = allPermissions;
      await this.prisma.adminrepository.upsert(savedSuperAdmin);

      this.logger.log(`Created SuperAdmin: ${superAdminEmail} with password: ${defaultPassword}`);
      this.logger.log('IMPORTANT: Change the default SuperAdmin password in production!');
    } else {
      this.logger.log(`SuperAdmin already exists: ${superAdminEmail}`);
    }
  }
}
