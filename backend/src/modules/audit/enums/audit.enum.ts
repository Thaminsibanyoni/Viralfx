/**
 * Audit Action Enums
 * Defines all possible audit actions for the system
 */
export enum AuditAction {
  // User Actions
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',

  // Admin Actions
  ADMIN_LOGIN = 'ADMIN_LOGIN',
  ADMIN_LOGOUT = 'ADMIN_LOGOUT',
  ADMIN_CREATE = 'ADMIN_CREATE',
  ADMIN_UPDATE = 'ADMIN_UPDATE',
  ADMIN_DELETE = 'ADMIN_DELETE',

  // Trend/VTS Actions
  TREND_CREATE = 'TREND_CREATE',
  TREND_UPDATE = 'TREND_UPDATE',
  TREND_DELETE = 'TREND_DELETE',
  TREND_OVERRIDE = 'TREND_OVERRIDE',
  TREND_PAUSE = 'TREND_PAUSE',
  TREND_RESUME = 'TREND_RESUME',

  // Market Actions
  MARKET_CREATE = 'MARKET_CREATE',
  MARKET_UPDATE = 'MARKET_UPDATE',
  MARKET_DELETE = 'MARKET_DELETE',
  MARKET_SETTLE = 'MARKET_SETTLE',

  // Order Actions
  ORDER_CREATE = 'ORDER_CREATE',
  ORDER_UPDATE = 'ORDER_UPDATE',
  ORDER_CANCEL = 'ORDER_CANCEL',
  ORDER_EXECUTE = 'ORDER_EXECUTE',

  // Wallet Actions
  WALLET_DEPOSIT = 'WALLET_DEPOSIT',
  WALLET_WITHDRAW = 'WALLET_WITHDRAW',
  WALLET_TRANSFER = 'WALLET_TRANSFER',

  // System Actions
  SYSTEM_STARTUP = 'SYSTEM_STARTUP',
  SYSTEM_SHUTDOWN = 'SYSTEM_SHUTDOWN',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_CONFIG_UPDATE = 'SYSTEM_CONFIG_UPDATE',

  // Notification Actions
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  NOTIFICATION_FAILED = 'NOTIFICATION_FAILED',

  // Broker Actions
  BROKER_VERIFY = 'BROKER_VERIFY',
  BROKER_APPROVE = 'BROKER_APPROVE',
  BROKER_REJECT = 'BROKER_REJECT',
  BROKER_SUSPEND = 'BROKER_SUSPEND',
}

/**
 * Audit Severity Enums
 * Defines the severity levels for audit logs
 */
export enum AuditSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit Resource Types
 * Defines the types of resources that can be audited
 */
export enum AuditResourceType {
  USER = 'User',
  ADMIN = 'Admin',
  TREND = 'Trend',
  VTSSymbol = 'VTSSymbol',
  VTSAlias = 'VTSAlias',
  VTSDispute = 'VTSDispute',
  MARKET = 'Market',
  ORDER = 'Order',
  WALLET = 'Wallet',
  BROKER = 'Broker',
  NOTIFICATION = 'Notification',
  SYSTEM = 'System',
}
