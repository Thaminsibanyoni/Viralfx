/**
 * Admin Role Enum
 * Defines the different administrative roles in the system
 */
export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  USER_OPS = 'USER_OPS',
  BROKER_OPS = 'BROKER_OPS',
  TREND_OPS = 'TREND_OPS',
  RISK_OPS = 'RISK_OPS',
  FINANCE_OPS = 'FINANCE_OPS',
  TECH_OPS = 'TECH_OPS',
  VIEWER = 'VIEWER'
}

/**
 * Admin Status Enum
 * Defines the possible states of an admin account
 */
export enum AdminStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  LOCKED = 'LOCKED'
}

/**
 * Permission Category Enum
 * Categorizes different types of permissions
 */
export enum PermissionCategory {
  PLATFORM_MANAGEMENT = 'PLATFORM_MANAGEMENT',
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  BROKER_MANAGEMENT = 'BROKER_MANAGEMENT',
  TREND_MANAGEMENT = 'TREND_MANAGEMENT',
  RISK_MANAGEMENT = 'RISK_MANAGEMENT',
  FINANCIAL_MANAGEMENT = 'FINANCIAL_MANAGEMENT',
  TECH_MANAGEMENT = 'TECH_MANAGEMENT',
  COMPLIANCE = 'COMPLIANCE',
  REPORTING = 'REPORTING'
}
