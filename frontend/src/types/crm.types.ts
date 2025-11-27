// CRM Types
export interface Lead {
  id: string;
  brokerId: string | null;
  source: LeadSource;
  status: LeadStatus;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  country: string | null;
  region: string | null;
  estimatedRevenue: number | null;
  leadScore: number;
  assignedTo: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  convertedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  broker?: any;
  relationshipManager?: RelationshipManager | null;
  activities?: Activity[];
}

export interface Opportunity {
  id: string;
  leadId: string | null;
  brokerId: string;
  name: string;
  stage: OpportunityStage;
  value: number;
  probability: number;
  expectedCloseDate: Date | null;
  actualCloseDate: Date | null;
  lostReason: string | null;
  assignedTo: string | null;
  products: string[] | null;
  competitors: string[] | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lead?: Lead | null;
  broker: any;
  contract?: Contract | null;
  activities?: Activity[];
}

export interface Contract {
  id: string;
  opportunityId: string;
  brokerId: string;
  contractNumber: string;
  type: ContractType;
  status: ContractStatus;
  value: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  renewalDate: Date | null;
  autoRenew: boolean;
  terms: string | null;
  templateId: string | null;
  signedBy: {
    name: string;
    email: string;
    signedAt: Date;
    ipAddress: string;
  } | null;
  documentUrl: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  opportunity: Opportunity;
  broker: any;
}

export interface Activity {
  id: string;
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  subject: string;
  description: string;
  status: ActivityStatus;
  scheduledAt: Date | null;
  completedAt: Date | null;
  duration: number | null;
  outcome: string | null;
  assignedTo: string | null;
  participants: Array<{
    name: string;
    email: string;
    type: 'INTERNAL' | 'EXTERNAL';
  }> | null;
  attachments: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }> | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelationshipManager {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  department: Department;
  isActive: boolean;
  maxLeads: number;
  currentLeads: number;
  performance: {
    conversionRate: number;
    responseTime: number;
    dealsWon: number;
    revenueGenerated: number;
  } | null;
  territories: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// Enums
export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  COLD_CALL = 'COLD_CALL',
  EVENT = 'EVENT',
  PARTNER = 'PARTNER',
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
}

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export enum ContractType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  ONE_TIME = 'ONE_TIME',
  CUSTOM = 'CUSTOM',
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  TASK = 'TASK',
  DOCUMENT = 'DOCUMENT',
}

export enum ActivityStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityEntityType {
  LEAD = 'LEAD',
  OPPORTUNITY = 'OPPORTUNITY',
  CONTRACT = 'CONTRACT',
  BROKER = 'BROKER',
}

export enum Department {
  SALES = 'SALES',
  SUPPORT = 'SUPPORT',
  COMPLIANCE = 'COMPLIANCE',
  FINANCE = 'FINANCE',
}