import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminUser, AdminRole } from '../entities/admin-user.entity';
import { AdminPermission } from '../entities/admin-permission.entity';

@Injectable()
export class AdminRbacService {
  constructor(
    @InjectRepository(AdminUser)
    private adminRepository: Repository<AdminUser>,
    @InjectRepository(AdminPermission)
    private permissionRepository: Repository<AdminPermission>,
  ) {}

  // Predefined permissions for different roles and departments
  private readonly ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
    [AdminRole.SUPER_ADMIN]: [
      // SuperAdmin has access to everything
      'users:*', 'brokers:*', 'trends:*', 'risk:*', 'finance:*',
      'platform:*', 'system:*', 'audit:*', 'vts:*', 'oracle:*',
      'notifications:*', 'admins:*', 'predictive:*'
    ],
    [AdminRole.USER_OPS]: [
      'users:read', 'users:update', 'users:suspend', 'users:unsuspend',
      'users:ban', 'users:unban', 'kyc:read', 'kyc:update', 'audit:read'
    ],
    [AdminRole.BROKER_OPS]: [
      'brokers:read', 'brokers:update', 'brokers:approve', 'brokers:suspend',
      'brokers:verify', 'finance:read', 'audit:read'
    ],
    [AdminRole.TREND_OPS]: [
      'trends:read', 'trends:update', 'trends:override', 'trends:approve',
      'trends:reject', 'vts:read', 'audit:read'
    ],
    [AdminRole.RISK_OPS]: [
      'risk:read', 'risk:update', 'risk:block', 'risk:approve', 'risk:reject',
      'content:moderate', 'users:read', 'audit:read'
    ],
    [AdminRole.FINANCE_OPS]: [
      'finance:read', 'finance:update', 'payments:*', 'invoices:*',
      'brokers:read', 'audit:read'
    ],
    [AdminRole.SUPPORT_OPS]: [
      'users:read', 'brokers:read', 'tickets:*', 'notifications:send',
      'audit:read'
    ],
    [AdminRole.TECH_OPS]: [
      'system:read', 'system:update', 'oracle:read', 'oracle:update',
      'nodes:manage', 'logs:read', 'monitoring:read'
    ],
    [AdminRole.CONTENT_OPS]: [
      'content:update', 'aliases:update', 'vts:update', 'trends:read',
      'audit:read'
    ],
    [AdminRole.DEPARTMENT_HEAD]: [
      // Department heads have access to their department's resources
      'users:read', 'brokers:read', 'reports:read', 'analytics:read',
      'team:manage', 'audit:read', 'notifications:send'
    ]
  };

  async checkPermission(
    adminId: string,
    resource: string,
    action: string,
    conditions?: Record<string, any>,
  ): Promise<boolean> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['permissions'],
    });

    if (!admin) {
      return false;
    }

    // SuperAdmin has all permissions
    if (admin.isSuperAdmin) {
      return true;
    }

    // Check role-based permissions
    const rolePermissions = this.ROLE_PERMISSIONS[admin.role] || [];
    const hasRolePermission = this.hasPermission(
      rolePermissions,
      resource,
      action,
      conditions,
    );

    if (hasRolePermission) {
      return true;
    }

    // Check explicit permissions
    const explicitPermissions = admin.permissions.map((p) => `${p.resource}:${p.action}`);
    return this.hasPermission(explicitPermissions, resource, action, conditions);
  }

  async grantPermission(
    adminId: string,
    permissionId: string,
    grantedBy: string,
  ): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['permissions'],
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const permission = await this.permissionRepository.findOne({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new Error('Permission not found');
    }

    // Check if permission already exists
    const hasPermission = admin.permissions.some((p) => p.id === permissionId);
    if (hasPermission) {
      throw new Error('Admin already has this permission');
    }

    admin.permissions.push(permission);
    await this.adminRepository.save(admin);
  }

  async revokePermission(
    adminId: string,
    permissionId: string,
    revokedBy: string,
  ): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['permissions'],
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    admin.permissions = admin.permissions.filter((p) => p.id !== permissionId);
    await this.adminRepository.save(admin);
  }

  async getAdminPermissions(adminId: string): Promise<AdminPermission[]> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['permissions'],
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    return admin.permissions;
  }

  async createPermission(
    name: string,
    description: string,
    resource: string,
    action: string,
    category: string,
    conditions?: Record<string, any>[],
  ): Promise<AdminPermission> {
    const permission = this.permissionRepository.create({
      name,
      description,
      resource,
      action,
      category,
      conditions: conditions || [],
    });

    return await this.permissionRepository.save(permission);
  }

  async getAllPermissions(): Promise<AdminPermission[]> {
    return await this.permissionRepository.find({
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async getPermissionsByCategory(category: string): Promise<AdminPermission[]> {
    return await this.permissionRepository.find({
      where: { category },
      order: { name: 'ASC' },
    });
  }

  private hasPermission(
    permissions: string[],
    resource: string,
    action: string,
    conditions?: Record<string, any>,
  ): boolean {
    // Check for exact match
    const exactPermission = `${resource}:${action}`;
    if (permissions.includes(exactPermission)) {
      return true;
    }

    // Check for wildcard action
    const wildcardAction = `${resource}:*`;
    if (permissions.includes(wildcardAction)) {
      return true;
    }

    // Check for global wildcard (SuperAdmin)
    if (permissions.includes('*:*')) {
      return true;
    }

    // Check for resource-specific conditions
    const resourcePermissions = permissions.filter((p) =>
      p.startsWith(`${resource}:`),
    );

    for (const permission of resourcePermissions) {
      if (this.evaluateConditions(permission, conditions)) {
        return true;
      }
    }

    return false;
  }

  private evaluateConditions(
    permission: string,
    conditions?: Record<string, any>,
  ): boolean {
    // This would evaluate complex permission conditions
    // For now, return false as conditions are not implemented
    return false;
  }

  // Get all permissions for a role
  getRolePermissions(role: AdminRole): string[] {
    return this.ROLE_PERMISSIONS[role] || [];
  }

  // Get all available roles
  getAllRoles(): AdminRole[] {
    return Object.values(AdminRole);
  }

  // Check if a role has permission
  roleHasPermission(role: AdminRole, resource: string, action: string): boolean {
    const rolePermissions = this.ROLE_PERMISSIONS[role] || [];
    return this.hasPermission(rolePermissions, resource, action);
  }

  // Validate department access
  async validateDepartmentAccess(
    adminId: string,
    department: string,
  ): Promise<boolean> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      return false;
    }

    // SuperAdmin has access to all departments
    if (admin.isSuperAdmin) {
      return true;
    }

    // Check if admin belongs to the department
    if (admin.department === department) {
      return true;
    }

    // Department heads have access to all departments
    if (admin.role === AdminRole.DEPARTMENT_HEAD) {
      return true;
    }

    // Define cross-department access rules
    const crossDepartmentAccess: Record<AdminRole, string[]> = {
      [AdminRole.SUPER_ADMIN]: ['*'],
      [AdminRole.FINANCE_OPS]: ['Finance', 'Brokers'],
      [AdminRole.RISK_OPS]: ['Risk', 'Users', 'Content'],
      [AdminRole.SUPPORT_OPS]: ['Users', 'Brokers'],
      [AdminRole.TECH_OPS]: ['*'], // TechOps has access to all departments for maintenance
      [AdminRole.USER_OPS]: ['Users'],
      [AdminRole.BROKER_OPS]: ['Brokers'],
      [AdminRole.TREND_OPS]: ['Trends', 'VTS'],
      [AdminRole.CONTENT_OPS]: ['Content', 'VTS'],
      [AdminRole.DEPARTMENT_HEAD]: ['*'],
    };

    const allowedDepartments = crossDepartmentAccess[admin.role] || [];
    return allowedDepartments.includes('*') || allowedDepartments.includes(department);
  }
}