export interface SocialContent {
  id: string;
  text?: string;
  images?: string[];
  videos?: string[];
  userId: string;
  metadata?: Record<string, unknown>;
  postedAt: Date;
  platform?: string;
  hashtags?: string[];
}

export interface SafetyCheck {
  contentId: string;
  userId: string;
  overallRisk: ContentRisk;
  safetyLevel: ContentSafetyLevel;
  requiresReview: boolean;
  automatedAction?: ModerationAction;
  recommendations: string[];
  timestamp: Date;
  details: SafetyScoreBreakdown;
}

export interface ComplianceResult {
  compliant: boolean;
  violations: string[];
  riskScore: number;
  recommendedActions: string[];
  regulatoryReferences: string[];
}

export interface ContentRisk {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: RiskCategory;
  violations: string[];
  confidence: number;
  requiresModeration: boolean;
  automatedAction?: ModerationAction;
}

export interface SafetyScoreBreakdown {
  text: ContentRisk;
  visual: ContentRisk;
  behavioral: ContentRisk;
  contextual: ContentRisk;
  overall: ContentRisk;
}

export interface ToxicityAnalysis {
  toxicity: number;
  severeToxicity: number;
  obscene: number;
  threat: number;
  insult: number;
  identityAttack: number;
  profanity: number;
  sexuallyExplicit: number;
}

export interface SentimentAnalysis {
  score: number;
  magnitude: number;
  label: "positive" | "negative" | "neutral";
  confidence: number;
}

export interface ClassificationAnalysis {
  categories: Array<{
    name: string;
    confidence: number;
  }>;
  primaryCategory: string;
  confidence: number;
}

export interface VisualSafetyAnalysis {
  contentType: string;
  riskScore: number;
  detectedObjects: string[];
  adultContent: number;
  violence: number;
  medicalContent: number;
  spoofing: number;
  confidence: number;
}

export interface AggregatedVisualRisk {
  overallScore: number;
  averageConfidence: number;
  maxRiskScore: number;
  riskFactors: string[];
  recommendations: string[];
  requiresManualReview: boolean;
}

export interface BehavioralRisk {
  postingFrequency: number;
  engagementPatternScore: number;
  accountBehaviorScore: number;
  spamLikelihood: number;
  botLikelihood: number;
  overallScore: number;
}

export interface ContextualRisk {
  regionalCompliance: number;
  temporalRelevance: number;
  socialContextScore: number;
  communityGuidelinesScore: number;
  platformPoliciesScore: number;
  overallScore: number;
}

export interface AssetSafetyCheck {
  assetId: string;
  safetyCheck: SafetyCheck;
  automatedActions: string[];
  notifiedParties: string[];
  blockedUsers: string[];
  escalatedForReview: boolean;
  complianceStatus: ComplianceResult;
  timestamp: Date;
}

export interface NotificationAlert {
  id: string;
  type: AlertSeverity;
  contentId: string;
  userId: string;
  message: string;
  recipients: string[];
  timestamp: Date;
  acknowledged: boolean;
  actionRequired: boolean;
}

export interface BehavioralPatterns {
  postingFrequency: number;
  engagementPatterns: number;
  accountBehavior: number;
  socialConnections: number;
  contentVariation: number;
  overallScore: number;
  riskIndicators: string[];
}

export enum ContentSafetyLevel {
  SAFE = "SAFE",
  FLAGGED = "FLAGGED",
  BLOCKED = "BLOCKED",
}

export enum ModerationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ESCALATED = "ESCALATED",
}

export enum RiskCategory {
  TEXT = "TEXT",
  VISUAL = "VISUAL",
  BEHAVIORAL = "BEHAVIORAL",
  CONTEXTUAL = "CONTEXTUAL",
  OVERALL = "OVERALL",
}

export enum ModerationAction {
  APPROVE = "APPROVE",
  REVIEW = "REVIEW",
  BLOCK = "BLOCK",
}

export enum AlertSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}