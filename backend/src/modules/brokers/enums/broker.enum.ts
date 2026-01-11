/**
 * Broker Type Enum
 * Defines the different types of brokers in the system
 */
export enum BrokerType {
  RETAIL = 'RETAIL',
  INSTITUTIONAL = 'INSTITUTIONAL',
  WHITE_LABEL = 'WHITE_LABEL',
  MARKET_MAKER = 'MARKET_MAKER',
  ECN = 'ECN',
  STP = 'STP'
}

/**
 * Broker Status Enum
 * Defines the possible states of a broker account
 */
export enum BrokerStatus {
  PENDING = 'PENDING',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DELETED = 'DELETED'
}

/**
 * Integration Type Enum
 * Defines the different types of broker integrations
 */
export enum IntegrationType {
  REST_API = 'REST_API',
  WEBSOCKET = 'WEBSOCKET',
  WEBHOOK = 'WEBHOOK',
  SDK = 'SDK'
}

/**
 * Payment Method Enum
 * Defines the different payment methods for broker billing
 */
export enum PaymentMethod {
  EFT = 'EFT',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CRYPTO = 'CRYPTO',
  PAYFAST = 'PAYFAST',
  OZOW = 'OZOW',
  PAYSTACK = 'PAYSTACK'
}

/**
 * Attribution Type Enum
 * Defines how clients are attributed to brokers
 */
export enum AttributionType {
  DIRECT = 'DIRECT',
  REFERRAL_LINK = 'REFERRAL_LINK',
  REFERRAL_CODE = 'REFERRAL_CODE',
  MARKETING_CAMPAIGN = 'MARKETING_CAMPAIGN',
  PARTNER = 'PARTNER',
  ORGANIC = 'ORGANIC'
}

/**
 * Broker Client Status Enum
 * Defines the status of a client associated with a broker
 */
export enum BrokerClientStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
  CLOSED = 'CLOSED'
}

/**
 * Broker Tier Enum
 * Defines the different tiers of brokers based on performance
 */
export enum BrokerTier {
  STANDARD = 'STANDARD',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND'
}

/**
 * Broker Compliance Status Enum
 * Defines the compliance status of brokers
 */
export enum BrokerComplianceStatus {
  COMPLIANT = 'COMPLIANT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  NON_COMPLIANT = 'NON_COMPLIANT',
  EXEMPT = 'EXEMPT'
}
