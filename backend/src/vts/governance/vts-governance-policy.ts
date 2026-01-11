/**
 * VTS Governance Policy Framework
 * Rules and policies for VTS symbol creation, verification, and trading eligibility
 * © 2025 ViralFX - Global Governance System
 */

import { CategoryCode, VerificationLevel, RiskLevel, RegionCode } from "../../types/vts";

export interface VTSGovernancePolicy {
  symbolCreationRules: SymbolCreationRules;
  tradingEligibilityRules: TradingEligibilityRules;
  regionalPolicies: RegionalPolicy[];
  categoryPolicies: CategoryPolicy[];
  riskPolicies: RiskPolicy[];
  compliancePolicies: CompliancePolicy[];
}

export interface SymbolCreationRules {
  minimumVerificationLevel: VerificationLevel;
  requiredContentChecks: ContentCheck[];
  prohibitedContent: ProhibitedContent[];
  requiredConfidenceThreshold: number;
  uniquenessValidation: UniquenessValidation;
  namingConventions: NamingConvention[];
}

export interface TradingEligibilityRules {
  categoryEligibility: CategoryEligibilityRule[];
  verificationRequirements: VerificationRequirement[];
  riskAssessmentRules: RiskAssessmentRule[];
  regionalApprovalRequirements: RegionalApprovalRequirement[];
  monitoringRequirements: MonitoringRequirement[];
}

export interface RegionalPolicy {
  region: RegionCode;
  contentRestrictions: ContentRestriction[];
  riskSensitivity: RiskSensitivity;
  requiredLocalApprovals: string[];
  prohibitedCategories: CategoryCode[];
  specialConditions: SpecialCondition[];
}

export interface CategoryPolicy {
  category: CategoryCode;
  tradingEligibility: boolean;
  requiredVerificationLevel: VerificationLevel;
  riskLevel: RiskLevel;
  contentGuidelines: ContentGuideline[];
  monitoringLevel: MonitoringLevel;
  regionalRestrictions: RegionalRestriction[];
}

export interface RiskPolicy {
  riskLevel: RiskLevel;
  thresholdCriteria: ThresholdCriteria[];
  requiredMitigations: RequiredMitigation[];
  monitoringFrequency: MonitoringFrequency;
  escalationProcedures: EscalationProcedure[];
  reportingRequirements: ReportingRequirement[];
}

export interface CompliancePolicy {
  complianceArea: ComplianceArea;
  requirements: ComplianceRequirement[];
  auditFrequency: AuditFrequency;
  reportingObligations: ReportingObligation[];
  penalties: CompliancePenalty[];
  exemptions: ComplianceExemption[];
}

// Enums and supporting types
export enum ContentCheck {
  FACTUAL_ACCURACY = 'FACTUAL_ACCURACY',
  SOURCE_VERIFICATION = 'SOURCE_VERIFICATION',
  HARMFUL_CONTENT_SCAN = 'HARMFUL_CONTENT_SCAN',
  MISINFORMATION_CHECK = 'MISINFORMATION_CHECK',
  DUPLICATE_DETECTION = 'DUPLICATE_DETECTION',
  CLASSIFICATION_ACCURACY = 'CLASSIFICATION_ACCURACY'
}

export enum ProhibitedContent {
  HATE_SPEECH = 'HATE_SPEECH',
  VIOLENCE_INCITEMENT = 'VIOLENCE_INCITEMENT',
  CHILD_EXPLOITATION = 'CHILD_EXPLOITATION',
  TERRORIST_CONTENT = 'TERRORIST_CONTENT',
  FRAUD_SCHEMES = 'FRAUD_SCHEMES',
  ILLEGAL_ACTIVITIES = 'ILLEGAL_ACTIVITIES',
  MEDICAL_MISINFORMATION = 'MEDICAL_MISINFORMATION',
  ELECTION_DISINFORMATION = 'ELECTION_DISINFORMATION'
}

export enum MonitoringLevel {
  LOW = 'LOW',           // Automated monitoring only
  MEDIUM = 'MEDIUM',     // Automated + periodic human review
  HIGH = 'HIGH',         // Continuous human oversight
  CRITICAL = 'CRITICAL'   // Real-time monitoring + immediate intervention
}

export enum ComplianceArea {
  FINANCIAL_REGULATIONS = 'FINANCIAL_REGULATIONS',
  DATA_PROTECTION = 'DATA_PROTECTION',
  CONTENT_MODERATION = 'CONTENT_MODERATION',
  MARKET_INTEGRITY = 'MARKET_INTEGRITY',
  ANTI_MONEY_LAUNDERING = 'ANTI_MONEY_LAUNDERING',
  CONSUMER_PROTECTION = 'CONSUMER_PROTECTION'
}

// Supporting interfaces
export interface ContentCheck {
  type: ContentCheck;
  required: boolean;
  threshold?: number;
  automatedCheck: boolean;
  manualReviewRequired: boolean;
}

export interface UniquenessValidation {
  hashCollisionCheck: boolean;
  semanticSimilarityCheck: boolean;
  regionalVariationCheck: boolean;
  temporalProximityCheck: boolean;
}

export interface NamingConvention {
  pattern: string;
  description: string;
  examples: string[];
  restrictions: string[];
}

export interface CategoryEligibilityRule {
  category: CategoryCode;
  eligible: boolean;
  conditions: EligibilityCondition[];
  restrictions: EligibilityRestriction[];
  additionalRequirements: string[];
}

export interface EligibilityCondition {
  type: 'VERIFICATION_LEVEL' | 'RISK_ASSESSMENT' | 'CONTENT_TYPE' | 'REGIONAL_APPROVAL';
  requirement: string;
  threshold?: number;
  mandatory: boolean;
}

export interface VerificationRequirement {
  level: VerificationLevel;
  requiredFor: CategoryCode[];
  checks: string[];
  documentation: string[];
  expiryPeriod?: number; // days
}

export interface RegionalApprovalRequirement {
  regions: RegionCode[];
  approvalType: 'UNANIMOUS' | 'MAJORITY' | 'SINGLE';
  conditions: string[];
  fallbackProvisions: string[];
}

export interface ContentRestriction {
  type: ProhibitedContent;
  severity: 'BLOCK' | 'REVIEW' | 'WARN';
  automatedDetection: boolean;
  manualReviewRequired: boolean;
  regionalVariations: Record<string, boolean>;
}

export interface RiskSensitivity {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  factors: string[];
  thresholds: Record<string, number>;
  responseProcedures: string[];
}

export interface SpecialCondition {
  type: string;
  requirement: string;
  applicability: string[];
  exceptions: string[];
  reviewPeriod: number;
}

export interface ContentGuideline {
  aspect: string;
  requirement: string;
  examples: string[];
  violations: string[];
  penalties: string[];
}

export interface RegionalRestriction {
  regions: RegionCode[];
  restriction: string;
  reason: string;
  alternative: string;
  reviewDate?: Date;
}

export interface ThresholdCriteria {
  metric: string;
  operator: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ';
  value: number;
  timeWindow: number; // hours
  weight: number;
}

export interface RequiredMitigation {
  type: string;
  description: string;
  implementation: string;
  verification: string;
  deadline: number; // hours
}

export interface MonitoringFrequency {
  automated: number; // minutes
  manual: number; // hours
  escalation: number; // hours
}

export interface EscalationProcedure {
  trigger: string;
  steps: EscalationStep[];
  timeframes: number[];
  responsible: string[];
}

export interface EscalationStep {
  action: string;
  responsible: string;
  timeframe: number;
  criteria: string;
}

export interface MonitoringRequirement {
  type: string;
  frequency: number;
  methodology: string;
  alertThresholds: Record<string, number>;
  reporting: string[];
}

export interface ComplianceRequirement {
  requirement: string;
  description: string;
  implementation: string;
  verification: string;
  frequency: number;
  documentation: string[];
}

export interface AuditFrequency {
  automated: number; // daily
  manual: number; // weekly/monthly
  external: number; // quarterly/annually
}

export interface ReportingObligation {
  reportType: string;
  frequency: string;
  recipients: string[];
  content: string[];
  format: string;
  retention: number; // years
}

export interface CompliancePenalty {
  violation: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  penalty: string;
  duration: number; // days
  appealProcess: string;
}

export interface ComplianceExemption {
  requirement: string;
  condition: string;
  duration: number; // days
  justification: string;
  approval: string;
  reviewRequired: boolean;
}

export class VTSGovernancePolicyEngine {
  private policy: VTSGovernancePolicy;

  constructor() {
    this.policy = this.initializePolicy();
  }

  /**
   * Check if symbol creation request meets governance requirements
   */
  validateSymbolCreation(request: SymbolCreationRequest): GovernanceValidationResult {
    const result: GovernanceValidationResult = {
      approved: true,
      violations: [],
      warnings: [],
      requirements: []
    };

    // Check minimum verification level
    if (request.verificationLevel < this.policy.symbolCreationRules.minimumVerificationLevel) {
      result.approved = false;
      result.violations.push({
        type: 'VERIFICATION_LEVEL',
        message: `Verification level ${request.verificationLevel} below minimum ${this.policy.symbolCreationRules.minimumVerificationLevel}`,
        severity: 'CRITICAL'
      });
    }

    // Check confidence threshold
    if (request.confidenceScore < this.policy.symbolCreationRules.requiredConfidenceThreshold) {
      result.approved = false;
      result.violations.push({
        type: 'CONFIDENCE_THRESHOLD',
        message: `Confidence score ${request.confidenceScore} below threshold ${this.policy.symbolCreationRules.requiredConfidenceThreshold}`,
        severity: 'CRITICAL'
      });
    }

    // Check category-specific rules
    const categoryPolicy = this.policy.categoryPolicies.find(p => p.category === request.category);
    if (categoryPolicy) {
      if (categoryPolicy.requiredVerificationLevel > request.verificationLevel) {
        result.approved = false;
        result.violations.push({
          type: 'CATEGORY_VERIFICATION',
          message: `Category ${request.category} requires verification level ${categoryPolicy.requiredVerificationLevel}`,
          severity: 'CRITICAL'
        });
      }
    }

    // Check regional policies
    const regionalPolicy = this.policy.regionalPolicies.find(p => p.region === request.region);
    if (regionalPolicy) {
      if (regionalPolicy.prohibitedCategories.includes(request.category)) {
        result.approved = false;
        result.violations.push({
          type: 'REGIONAL_RESTRICTION',
          message: `Category ${request.category} is prohibited in region ${request.region}`,
          severity: 'CRITICAL'
        });
      }
    }

    return result;
  }

  /**
   * Check if symbol is eligible for trading
   */
  validateTradingEligibility(request: TradingEligibilityRequest): TradingEligibilityResult {
    const result: TradingEligibilityResult = {
      eligible: true,
      restrictions: [],
      conditions: [],
      monitoringLevel: MonitoringLevel.LOW,
      riskLevel: RiskLevel.LOW
    };

    // Check category eligibility
    const categoryRule = this.policy.tradingEligibilityRules.categoryEligibility.find(
      rule => rule.category === request.category
    );

    if (categoryRule && !categoryRule.eligible) {
      result.eligible = false;
      result.restrictions.push({
        type: 'CATEGORY_RESTRICTION',
        message: `Category ${request.category} is not eligible for trading`,
        severity: 'CRITICAL'
      });
    }

    // Check verification requirements
    const verificationRule = this.policy.tradingEligibilityRules.verificationRequirements.find(
      rule => rule.level === request.verificationLevel
    );

    if (verificationRule && !verificationRule.checks.every(check => request.completedChecks.includes(check))) {
      result.eligible = false;
      result.restrictions.push({
        type: 'INCOMPLETE_VERIFICATION',
        message: 'Required verification checks not completed',
        severity: 'HIGH'
      });
    }

    // Determine monitoring level based on category and risk
    const categoryPolicy = this.policy.categoryPolicies.find(p => p.category === request.category);
    if (categoryPolicy) {
      result.monitoringLevel = categoryPolicy.monitoringLevel;
      result.riskLevel = categoryPolicy.riskLevel;
    }

    // Add regional requirements
    const regionalPolicy = this.policy.regionalPolicies.find(p => p.region === request.region);
    if (regionalPolicy) {
      result.conditions.push(...regionalPolicy.requiredLocalApprovals);
    }

    return result;
  }

  /**
   * Get regional policy for a region
   */
  getRegionalPolicy(region: RegionCode): RegionalPolicy | null {
    return this.policy.regionalPolicies.find(p => p.region === region) || null;
  }

  /**
   * Get category policy
   */
  getCategoryPolicy(category: CategoryCode): CategoryPolicy | null {
    return this.policy.categoryPolicies.find(p => p.category === category) || null;
  }

  /**
   * Update policy (admin function)
   */
  updatePolicy(updates: Partial<VTSGovernancePolicy>): void {
    this.policy = { ...this.policy, ...updates };
  }

  /**
   * Get complete policy
   */
  getPolicy(): VTSGovernancePolicy {
    return this.policy;
  }

  private initializePolicy(): VTSGovernancePolicy {
    return {
      symbolCreationRules: {
        minimumVerificationLevel: VerificationLevel.MEDIUM,
        requiredContentChecks: [
          {
            type: ContentCheck.FACTUAL_ACCURACY,
            required: true,
            automatedCheck: true,
            manualReviewRequired: false
          },
          {
            type: ContentCheck.SOURCE_VERIFICATION,
            required: true,
            automatedCheck: true,
            manualReviewRequired: false
          },
          {
            type: ContentCheck.HARMFUL_CONTENT_SCAN,
            required: true,
            automatedCheck: true,
            manualReviewRequired: true
          },
          {
            type: ContentCheck.DUPLICATE_DETECTION,
            required: true,
            automatedCheck: true,
            manualReviewRequired: false
          }
        ],
        prohibitedContent: [
          ProhibitedContent.HATE_SPEECH,
          ProhibitedContent.VIOLENCE_INCITEMENT,
          ProhibitedContent.CHILD_EXPLOITATION,
          ProhibitedContent.TERRORIST_CONTENT,
          ProhibitedContent.FRAUD_SCHEMES,
          ProhibitedContent.ILLEGAL_ACTIVITIES
        ],
        requiredConfidenceThreshold: 0.7,
        uniquenessValidation: {
          hashCollisionCheck: true,
          semanticSimilarityCheck: true,
          regionalVariationCheck: true,
          temporalProximityCheck: false
        },
        namingConventions: [
          {
            pattern: 'V:REGION:CAT:TOPIC_ID',
            description: 'Standard VTS symbol format',
            examples: ['V:ZA:ENT:ZINHLEXD', 'V:US:POL:TRMPTXF'],
            restrictions: ['No special characters', 'Standard codes only']
          }
        ]
      },
      tradingEligibilityRules: {
        categoryEligibility: [
          {
            category: CategoryCode.ENTERTAINMENT,
            eligible: true,
            conditions: [
              {
                type: 'VERIFICATION_LEVEL',
                requirement: 'Medium verification required',
                mandatory: true
              },
              {
                type: 'CONTENT_TYPE',
                requirement: 'Must be factual, non-harmful',
                mandatory: true
              }
            ],
            restrictions: [
              {
                type: 'RISK_ASSESSMENT',
                requirement: 'No celebrity defamation',
                mandatory: true
              }
            ],
            additionalRequirements: ['Source verification', 'No harmful content']
          },
          {
            category: CategoryCode.POLITICS,
            eligible: true,
            conditions: [
              {
                type: 'VERIFICATION_LEVEL',
                requirement: 'High verification required',
                mandatory: true
              },
              {
                type: 'CONTENT_TYPE',
                requirement: 'No election disinformation',
                mandatory: true
              },
              {
                type: 'REGIONAL_APPROVAL',
                requirement: 'Local regulatory approval',
                mandatory: true
              }
            ],
            restrictions: [
              {
                type: 'RISK_ASSESSMENT',
                requirement: 'Fact-checking required',
                mandatory: true
              }
            ],
            additionalRequirements: ['Multiple source verification', 'Fact-checking']
          },
          {
            category: CategoryCode.SAFETY,
            eligible: false,
            conditions: [],
            restrictions: [
              {
                type: 'RISK_ASSESSMENT',
                requirement: 'Very limited trading allowed',
                mandatory: true
              }
            ],
            additionalRequirements: ['Official sources only', 'No sensational content']
          },
          {
            category: CategoryCode.CULTURE,
            eligible: true,
            conditions: [
              {
                type: 'VERIFICATION_LEVEL',
                requirement: 'Low verification acceptable',
                mandatory: false
              }
            ],
            restrictions: [],
            additionalRequirements: ['Cultural sensitivity review']
          },
          {
            category: CategoryCode.FINANCE,
            eligible: true,
            conditions: [
              {
                type: 'VERIFICATION_LEVEL',
                requirement: 'High verification required',
                mandatory: true
              },
              {
                type: 'CONTENT_TYPE',
                requirement: 'Must not misrepresent companies',
                mandatory: true
              }
            ],
            restrictions: [
              {
                type: 'RISK_ASSESSMENT',
                requirement: 'Financial accuracy verification',
                mandatory: true
              }
            ],
            additionalRequirements: ['Financial source verification', 'No stock manipulation']
          },
          {
            category: CategoryCode.MISC,
            eligible: true,
            conditions: [
              {
                type: 'VERIFICATION_LEVEL',
                requirement: 'Screening required',
                mandatory: true
              }
            ],
            restrictions: [
              {
                type: 'RISK_ASSESSMENT',
                requirement: 'Content classification review',
                mandatory: true
              }
            ],
            additionalRequirements: ['Manual review for viral content']
          }
        ],
        verificationRequirements: [],
        riskAssessmentRules: [],
        regionalApprovalRequirements: [],
        monitoringRequirements: []
      },
      regionalPolicies: this.initializeRegionalPolicies(),
      categoryPolicies: this.initializeCategoryPolicies(),
      riskPolicies: [],
      compliancePolicies: []
    };
  }

  private initializeRegionalPolicies(): RegionalPolicy[] {
    return [
      {
        region: RegionCode.SOUTH_AFRICA,
        contentRestrictions: [
          {
            type: ProhibitedContent.HATE_SPEECH,
            severity: 'BLOCK',
            automatedDetection: true,
            manualReviewRequired: true,
            regionalVariations: {
              [RegionCode.SOUTH_AFRICA]: true,
              [RegionCode.USA]: false,
              [RegionCode.UK]: true
            }
          }
        ],
        riskSensitivity: {
          level: 'MEDIUM',
          factors: ['Political sensitivity', 'Cultural context', 'Language diversity'],
          thresholds: { 'political_sentiment': 0.7, 'cultural_sensitivity': 0.6 },
          responseProcedures: ['Regional review', 'Cultural expert consultation']
        },
        requiredLocalApprovals: ['FSCA compliance', 'Content moderation'],
        prohibitedCategories: [],
        specialConditions: [
          {
            type: 'MULTILINGUAL_CONTENT',
            requirement: 'Must handle all 11 official languages',
            applicability: ['content_processing', 'sentiment_analysis'],
            exceptions: ['automated_detection'],
            reviewPeriod: 90
          }
        ]
      },
      {
        region: RegionCode.USA,
        contentRestrictions: [
          {
            type: ProhibitedContent.ELECTION_DISINFORMATION,
            severity: 'BLOCK',
            automatedDetection: true,
            manualReviewRequired: true,
            regionalVariations: {
              [RegionCode.USA]: true,
              [RegionCode.SOUTH_AFRICA]: false
            }
          }
        ],
        riskSensitivity: {
          level: 'HIGH',
          factors: ['Election sensitivity', 'Financial regulations', 'Consumer protection'],
          thresholds: { 'election_disinformation': 0.8, 'financial_accuracy': 0.9 },
          responseProcedures: ['Legal review', 'Regulatory reporting']
        },
        requiredLocalApprovals: ['SEC compliance', 'FTC guidelines'],
        prohibitedCategories: [],
        specialConditions: [
          {
            type: 'FINANCIAL_DISCLOSURE',
            requirement: 'Must meet financial advertising standards',
            applicability: ['finance_category', 'investment_content'],
            exceptions: ['news_reporting'],
            reviewPeriod: 30
          }
        ]
      }
    ];
  }

  private initializeCategoryPolicies(): CategoryPolicy[] {
    return [
      {
        category: CategoryCode.POLITICS,
        tradingEligibility: true,
        requiredVerificationLevel: VerificationLevel.HIGH,
        riskLevel: RiskLevel.HIGH,
        contentGuidelines: [
          {
            aspect: 'Factuality',
            requirement: 'All political claims must be verifiable',
            examples: ['Election results', 'Policy announcements', 'Official statements'],
            violations: ['Unverified rumors', 'Misleading statistics', 'False attributions'],
            penalties: ['Symbol suspension', 'Verification downgrade']
          }
        ],
        monitoringLevel: MonitoringLevel.HIGH,
        regionalRestrictions: [
          {
            regions: [RegionCode.USA, RegionCode.UK, RegionCode.GERMANY],
            restriction: 'Election period restrictions apply',
            reason: 'Election integrity protection',
            alternative: 'Enhanced verification only',
            reviewDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          }
        ]
      },
      {
        category: CategoryCode.ENTERTAINMENT,
        tradingEligibility: true,
        requiredVerificationLevel: VerificationLevel.MEDIUM,
        riskLevel: RiskLevel.LOW,
        contentGuidelines: [
          {
            aspect: 'Privacy',
            requirement: 'Respect celebrity privacy rights',
            examples: ['Public appearances', 'Official statements', 'Published works'],
            violations: ['Private moments', 'Unconfirmed relationships', 'Medical information'],
            penalties: ['Content removal', 'Account suspension']
          }
        ],
        monitoringLevel: MonitoringLevel.MEDIUM,
        regionalRestrictions: []
      },
      {
        category: CategoryCode.CRIME,
        tradingEligibility: false,
        requiredVerificationLevel: VerificationLevel.VERIFIED,
        riskLevel: RiskLevel.CRITICAL,
        contentGuidelines: [
          {
            aspect: 'Source Verification',
            requirement: 'Only official law enforcement sources',
            examples: ['Police press releases', 'Court documents', 'Official statements'],
            violations: ['Witness speculation', 'Unconfirmed reports', 'Social media rumors'],
            penalties: ['Immediate symbol removal', 'Legal reporting']
          }
        ],
        monitoringLevel: MonitoringLevel.CRITICAL,
        regionalRestrictions: [
          {
            regions: Object.values(RegionCode),
            restriction: 'No trading allowed',
            reason: 'Public safety and ethical concerns',
            alternative: 'Information-only access'
          }
        ]
      }
    ];
  }
}

// Supporting interfaces
export interface SymbolCreationRequest {
  symbol: string;
  category: CategoryCode;
  region: RegionCode;
  verificationLevel: VerificationLevel;
  confidenceScore: number;
  content: any;
}

export interface GovernanceValidationResult {
  approved: boolean;
  violations: GovernanceViolation[];
  warnings: GovernanceWarning[];
  requirements: GovernanceRequirement[];
}

export interface GovernanceViolation {
  type: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface GovernanceWarning {
  type: string;
  message: string;
  recommendation?: string;
}

export interface GovernanceRequirement {
  type: string;
  description: string;
  deadline?: Date;
}

export interface TradingEligibilityRequest {
  symbol: string;
  category: CategoryCode;
  region: RegionCode;
  verificationLevel: VerificationLevel;
  completedChecks: string[];
  additionalData: any;
}

export interface TradingEligibilityResult {
  eligible: boolean;
  restrictions: TradingRestriction[];
  conditions: string[];
  monitoringLevel: MonitoringLevel;
  riskLevel: RiskLevel;
}

export interface TradingRestriction {
  type: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
