export interface ModerationAction {
  id: string;
  contentId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'flag' | 'escalate' | 'remove' | 'shadow_ban';
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  categories: string[];
  metadata: {
    flaggedBy?: string;
    escalatedTo?: string;
    appeals?: string[];
    resolvedAt?: Date;
    createdAt: Date;
    expiresAt?: Date;
    isActive: boolean;
    notes?: string;
    evidence: ModerationEvidence[];
  };
}

export interface ModerationEvidence {
  id: string;
  type: 'screenshot' | 'log' | 'user_report' | 'automated_detection';
  content: string;
  url?: string;
  timestamp: Date;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ModerationQueue {
  id: string;
  name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  moderators: string[];
  autoEscalationMinutes: number;
  maxActiveCases: number;
  workingHours: {
    start: string;
    end: string;
    timezone: string;
  };
}

export interface ModerationCase {
  id: string;
  queueId: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'profile' | 'message';
  reporterId?: string;
  reportedUserId?: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'escalated' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedModeratorId?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolutionType?: 'approved' | 'rejected' | 'escalated';
  resolutionReason?: string;
  tags: string[];
  evidence: ModerationEvidence[];
  actions: ModerationAction[];
}

export interface ModerationStats {
  totalCases: number;
  pendingCases: number;
  resolvedCases: number;
  escalatedCases: number;
  averageResolutionTime: number;
  moderatorPerformance: {
    moderatorId: string;
    casesHandled: number;
    averageTime: number;
    accuracy: number;
  }[];
  queuePerformance: {
    queueId: string;
    averageWaitTime: number;
    backlog: number;
  }[];
}

export interface ModerationConfig {
  autoModerationEnabled: boolean;
  aiDetectionThreshold: number;
  escalationRules: {
    severity: string;
    timeMinutes: number;
    escalateTo: string;
  }[];
  restrictedKeywords: string[];
  contentFilters: {
    type: 'keyword' | 'pattern' | 'ml_model';
    config: Record<string, any>;
    action: 'flag' | 'auto_reject' | 'escalate';
  }[];
}

export interface ModerationWorkflow {
  id: string;
  name: string;
  steps: ModerationWorkflowStep[];
  triggers: {
    eventType: string;
    conditions: Record<string, any>;
  }[];
  isActive: boolean;
}

export interface ModerationWorkflowStep {
  id: string;
  name: string;
  type: 'manual_review' | 'automated_action' | 'escalation' | 'notification';
  config: Record<string, any>;
  conditions?: Record<string, any>;
  order: number;
  timeoutMinutes?: number;
}

export interface ModerationRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
    value: any;
  }[];
  actions: {
    type: 'flag' | 'auto_reject' | 'escalate' | 'assign';
    config: Record<string, any>;
  }[];
  priority: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}