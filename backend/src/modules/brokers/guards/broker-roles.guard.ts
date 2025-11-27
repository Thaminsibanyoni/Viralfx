import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Broker } from '../entities/broker.entity';
import { BrokerTier } from '../entities/broker.entity';
import { UserRole } from '@prisma/client';

export interface BrokerRequest extends Request {
  user?: {
    id: string;
    roles: UserRole[];
    brokerId?: string;
  };
  broker?: Broker;
  brokerId?: string;
}

export const BROKER_ROLES_KEY = 'brokerRoles';

export const BrokerRoles = (...roles: string[]) => ({
  [BROKER_ROLES_KEY]: roles,
});

@Injectable()
export class BrokerRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(BROKER_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest<BrokerRequest>();
    const { user, broker } = request;

    // Check if user has the required roles
    if (user && this.hasUserRoles(user.roles, requiredRoles)) {
      // Check if user is associated with the broker (if broker-specific access)
      if (broker && !this.canUserAccessBroker(user, broker)) {
        throw new ForbiddenException('User does not have access to this broker');
      }
      return true;
    }

    // Check broker-based roles if no user authentication
    if (broker && this.hasBrokerRoles(broker, requiredRoles)) {
      return true;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private hasUserRoles(userRoles: UserRole[], requiredRoles: string[]): boolean {
    const roleMapping: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['admin', 'super_admin'],
      [UserRole.SUPPORT]: ['support', 'admin'],
      [UserRole.USER]: ['user'],
      [UserRole.BROKER]: ['broker', 'user'],
    };

    const availableRoles = userRoles.reduce((roles, role) => {
      return [...roles, ...(roleMapping[role] || [role.toString()])];
    }, [] as string[]);

    return requiredRoles.every(role => availableRoles.includes(role));
  }

  private canUserAccessBroker(user: any, broker: Broker): boolean {
    // Admin can access any broker
    if (user.roles.includes(UserRole.ADMIN) || user.roles.includes(UserRole.SUPPORT)) {
      return true;
    }

    // Check if user is associated with the broker
    if (user.brokerId && user.brokerId === broker.id) {
      return true;
    }

    // For broker users, check if they belong to the broker
    if (user.roles.includes(UserRole.BROKER) && this.isUserAssociatedWithBroker(user, broker)) {
      return true;
    }

    return false;
  }

  private hasBrokerRoles(broker: Broker, requiredRoles: string[]): boolean {
    const brokerTierRoles: Record<BrokerTier, string[]> = {
      [BrokerTier.STARTER]: ['basic_read', 'self_write'],
      [BrokerTier.VERIFIED]: ['basic_read', 'self_write', 'analytics_read'],
      [BrokerTier.PREMIUM]: ['basic_read', 'self_write', 'analytics_read', 'advanced_write', 'custom_reports'],
      [BrokerTier.ENTERPRISE]: [
        'basic_read',
        'self_write',
        'analytics_read',
        'advanced_write',
        'custom_reports',
        'api_management',
        'white_label',
      ],
    };

    const availableRoles = brokerTierRoles[broker.tier] || [];

    // Add status-based roles
    if (broker.status === 'VERIFIED' && broker.isActive) {
      availableRoles.push('verified_broker');
    }

    if (broker.complianceInfo?.fscaVerified) {
      availableRoles.push('fsca_verified');
    }

    return requiredRoles.every(role => availableRoles.includes(role));
  }

  private isUserAssociatedWithBroker(user: any, broker: Broker): boolean {
    // In a real implementation, this would check the database
    // For now, return a placeholder implementation
    return user.brokerId === broker.id || user.associatedBrokers?.includes(broker.id);
  }
}

// Decorator for requiring specific broker permissions
export const RequireBrokerPermissions = (...permissions: string[]) =>
  BrokerRoles(...permissions);

// Common broker role definitions
export const BROKER_PERMISSIONS = {
  // Basic permissions
  READ_OWN_DATA: 'basic_read',
  WRITE_OWN_DATA: 'self_write',

  // Analytics permissions
  READ_ANALYTICS: 'analytics_read',
  GENERATE_REPORTS: 'custom_reports',

  // Advanced permissions
  ADVANCED_FEATURES: 'advanced_write',
  API_MANAGEMENT: 'api_management',
  WHITE_LABEL: 'white_label',

  // Status-based permissions
  VERIFIED_ONLY: 'verified_broker',
  FSCA_VERIFIED_ONLY: 'fsca_verified',

  // Admin permissions
  ADMIN_ACCESS: 'admin',
  SUPER_ADMIN: 'super_admin',
  SUPPORT_ACCESS: 'support',
};

// Common role combinations
export const BROKER_ROLES = {
  // Basic broker access
  BASIC: [BROKER_PERMISSIONS.READ_OWN_DATA],

  // Full broker access
  FULL: [
    BROKER_PERMISSIONS.READ_OWN_DATA,
    BROKER_PERMISSIONS.WRITE_OWN_DATA,
    BROKER_PERMISSIONS.READ_ANALYTICS,
  ],

  // Premium broker access
  PREMIUM: [
    BROKER_PERMISSIONS.READ_OWN_DATA,
    BROKER_PERMISSIONS.WRITE_OWN_DATA,
    BROKER_PERMISSIONS.READ_ANALYTICS,
    BROKER_PERMISSIONS.GENERATE_REPORTS,
    BROKER_PERMISSIONS.ADVANCED_FEATURES,
  ],

  // Enterprise broker access
  ENTERPRISE: [
    BROKER_PERMISSIONS.READ_OWN_DATA,
    BROKER_PERMISSIONS.WRITE_OWN_DATA,
    BROKER_PERMISSIONS.READ_ANALYTICS,
    BROKER_PERMISSIONS.GENERATE_REPORTS,
    BROKER_PERMISSIONS.ADVANCED_FEATURES,
    BROKER_PERMISSIONS.API_MANAGEMENT,
    BROKER_PERMISSIONS.WHITE_LABEL,
  ],

  // Admin access
  ADMIN: [BROKER_PERMISSIONS.ADMIN_ACCESS],

  // Support access
  SUPPORT: [BROKER_PERMISSIONS.SUPPORT_ACCESS],
};