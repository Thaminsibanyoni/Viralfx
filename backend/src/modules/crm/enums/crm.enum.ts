/**
 * Opportunity Stage Enum
 * Defines the different stages in the opportunity/sales pipeline
 */
export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST'
}

/**
 * Lead Source Enum
 * Defines the different sources where leads come from
 */
export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  TRADE_SHOW = 'TRADE_SHOW',
  COLD_CALL = 'COLD_CALL',
  PARTNER = 'PARTNER',
  ADVERTISEMENT = 'ADVERTISEMENT',
  EMAIL_CAMPAIGN = 'EMAIL_CAMPAIGN',
  ORGANIC = 'ORGANIC',
  OTHER = 'OTHER'
}

/**
 * Contract Type Enum
 * Defines the different types of contracts
 */
export enum ContractType {
  SERVICE_AGREEMENT = 'SERVICE_AGREEMENT',
  PARTNERSHIP = 'PARTNERSHIP',
  LICENSE = 'LICENSE',
  MAINTENANCE = 'MAINTENANCE',
  SUPPORT = 'SUPPORT',
  CONSULTING = 'CONSULTING',
  WHITE_LABEL = 'WHITE_LABEL',
  API_ACCESS = 'API_ACCESS',
  DATA_FEED = 'DATA_FEED',
  CUSTOM = 'CUSTOM'
}

/**
 * Deal Priority Enum
 * Defines the priority levels for deals/opportunities
 */
export enum DealPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

/**
 * Lead Status Enum
 * Defines the different statuses of leads
 */
export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  UNQUALIFIED = 'UNQUALIFIED',
  LOST = 'LOST'
}

/**
 * Lead Rating Enum
 * Defines the rating system for leads
 */
export enum LeadRating {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
  NONE = 'NONE'
}

/**
 * Contract Status Enum
 * Defines the different statuses of contracts
 */
export enum ContractStatus {
  DRAFT = 'DRAFT',
  REVIEW = 'REVIEW',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  RENEWED = 'RENEWED'
}

/**
 * Task Status Enum
 * Defines the different statuses of tasks in CRM
 */
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD'
}

/**
 * Task Priority Enum
 * Defines the priority levels for tasks
 */
export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}
