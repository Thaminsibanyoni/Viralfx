/**
 * Ticket Status Enum
 * Defines the different states of support tickets
 */
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_ON_CUSTOMER = 'WAITING_ON_CUSTOMER',
  WAITING_ON_THIRD_PARTY = 'WAITING_ON_THIRD_PARTY',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}

/**
 * Ticket Priority Enum
 * Defines the priority levels for support tickets
 */
export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  URGENT = 'URGENT'
}

/**
 * Ticket Category Enum
 * Defines the different categories of support tickets
 */
export enum TicketCategory {
  GENERAL = 'GENERAL',
  TECHNICAL = 'TECHNICAL',
  BILLING = 'BILLING',
  ACCOUNT = 'ACCOUNT',
  BROKER = 'BROKER',
  BETTING = 'BETTING',
  API = 'API',
  FEATURE_REQUEST = 'FEATURE_REQUEST',
  BUG_REPORT = 'BUG_REPORT',
  SECURITY = 'SECURITY',
  OTHER = 'OTHER'
}

/**
 * Article Status Enum
 * Defines the different states of knowledge base articles
 */
export enum ArticleStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
  DEPRECATED = 'DEPRECATED'
}

/**
 * Article Category Enum
 * Defines the different categories of knowledge base articles
 */
export enum ArticleCategory {
  GETTING_STARTED = 'GETTING_STARTED',
  USER_GUIDE = 'USER_GUIDE',
  BROKER_GUIDE = 'BROKER_GUIDE',
  API_DOCS = 'API_DOCS',
  TROUBLESHOOTING = 'TROUBLESHOOTING',
  FAQ = 'FAQ',
  VIDEO_TUTORIAL = 'VIDEO_TUTORIAL',
  RELEASE_NOTES = 'RELEASE_NOTES',
  POLICY = 'POLICY',
  OTHER = 'OTHER'
}

/**
 * SLA Status Enum
 * Defines the SLA compliance status
 */
export enum SLAStatus {
  ON_TRACK = 'ON_TRACK',
  AT_RISK = 'AT_RISK',
  BREACHED = 'BREACHED',
  PAUSED = 'PAUSED'
}

/**
 * Ticket Source Enum
 * Defines where tickets originate from
 */
export enum TicketSource {
  WEB = 'WEB',
  EMAIL = 'EMAIL',
  API = 'API',
  CHAT = 'CHAT',
  PHONE = 'PHONE',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  OTHER = 'OTHER'
}

/**
 * Ticket Satisfaction Enum
 * Defines customer satisfaction ratings
 */
export enum TicketSatisfaction {
  VERY_SATISFIED = 'VERY_SATISFIED',
  SATISFIED = 'SATISFIED',
  NEUTRAL = 'NEUTRAL',
  DISSATISFIED = 'DISSATISFIED',
  VERY_DISSATISFIED = 'VERY_DISSATISFIED'
}
