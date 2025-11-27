import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

import { ViralAsset, ContentSafetyLevel, ModerationStatus } from '../../assets/entities/viral-asset.entity';
import { SocialContent } from '../../assets/interfaces/social-content.interface';
import { SafetyCheck, ComplianceResult, ContentRisk } from '../interfaces/safety.interface';
import { NLPService } from '../../nlp/services/nlp.service';
import { VisionService } from '../../vision/services/vision.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { AuditService } from '../services/audit.service';

@Injectable()
export class ContentSafetyService {
  private readonly logger = new Logger(ContentSafetyService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(ViralAsset)
    private assetRepository: Repository<ViralAsset>,
    private nlpService: NLPService,
    private visionService: VisionService,
    private notificationService: NotificationService,
    private auditService: AuditService,
    @InjectQueue('content-moderation')
    private moderationQueue: Queue,
    @InjectQueue('compliance-alerts')
    private complianceQueue: Queue
  ) {}

  /**
   * Perform comprehensive content safety analysis
   */
  async analyzeContentSafety(content: SocialContent): Promise<SafetyCheck> {
    try {
      this.logger.log(`Starting safety analysis for content: ${content.id}`);

      // 1. Text-based safety analysis
      const textSafety = await this.analyzeTextSafety(content.text);

      // 2. Visual content analysis (if media present)
      const visualSafety = content.mediaUrls?.length > 0
        ? await this.analyzeVisualSafety(content.mediaUrls)
        : null;

      // 3. Behavioral analysis
      const behavioralSafety = await this.analyzeBehavioralSafety(content);

      // 4. Contextual safety assessment
      const contextualSafety = await this.analyzeContextualSafety(content);

      // 5. Aggregate safety scores
      const overallSafety = this.aggregateSafetyScores({
        text: textSafety,
        visual: visualSafety,
        behavioral: behavioralSafety,
        contextual: contextualSafety
      });

      // 6. Apply business rules and regulatory requirements
      const safetyDecision = this.makeSafetyDecision(overallSafety);

      // 7. Create audit trail
      await this.auditService.logContentSafetyAnalysis({
        contentId: content.id,
        analysis: overallSafety,
        decision: safetyDecision,
        timestamp: new Date()
      });

      this.logger.log(`Safety analysis completed: ${safetyDecision.safetyLevel}`);

      return safetyDecision;

    } catch (error) {
      this.logger.error('Content safety analysis failed:', error);
      throw new BadRequestException('Content safety analysis failed');
    }
  }

  /**
   * Analyze text-based content safety
   */
  private async analyzeTextSafety(text: string): Promise<ContentRisk> {
    const [toxicityAnalysis, sentimentAnalysis, classificationAnalysis] = await Promise.all([
      this.nlpService.analyzeToxicity(text),
      this.nlpService.analyzeSentiment(text),
      this.nlpService.classifyContent(text)
    ]);

    return {
      category: 'TEXT',
      riskScore: this.calculateTextRiskScore(toxicityAnalysis, sentimentAnalysis, classificationAnalysis),
      violations: this.identifyTextViolations(toxicityAnalysis, classificationAnalysis),
      confidence: this.calculateConfidence(toxicityAnalysis, classificationAnalysis),
      details: {
        toxicity: toxicityAnalysis,
        sentiment: sentimentAnalysis,
        classification: classificationAnalysis
      }
    };
  }

  /**
   * Analyze visual content safety
   */
  private async analyzeVisualSafety(mediaUrls: string[]): Promise<ContentRisk> {
    const visualAnalyses = await Promise.all(
      mediaUrls.map(url => this.visionService.analyzeSafety(url))
    );

    const aggregatedRisk = this.aggregateVisualRisk(visualAnalyses);

    return {
      category: 'VISUAL',
      riskScore: aggregatedRisk.overallRisk,
      violations: aggregatedRisk.violations,
      confidence: aggregatedRisk.averageConfidence,
      details: {
        individualAnalyses: visualAnalyses,
        aggregatedRisk
      }
    };
  }

  /**
   * Analyze behavioral patterns and metadata
   */
  private async analyzeBehavioralSafety(content: SocialContent): Promise<ContentRisk> {
    const risks = [];

    // Check posting frequency patterns
    const postingFrequencyRisk = this.analyzePostingFrequency(content);
    if (postingFrequencyRisk > 0.5) {
      risks.push({ type: 'HIGH_FREQUENCY_POSTING', score: postingFrequencyRisk });
    }

    // Check engagement patterns
    const engagementRisk = this.analyzeEngagementPatterns(content);
    if (engagementRisk > 0.5) {
      risks.push({ type: 'UNUSUAL_ENGAGEMENT', score: engagementRisk });
    }

    // Check account behavior
    const accountRisk = await this.analyzeAccountBehavior(content);
    if (accountRisk > 0.5) {
      risks.push({ type: 'SUSPICIOUS_ACCOUNT', score: accountRisk });
    }

    const overallRisk = Math.max(...risks.map(r => r.score), 0);

    return {
      category: 'BEHAVIORAL',
      riskScore: overallRisk,
      violations: risks.filter(r => r.score > 0.7).map(r => r.type),
      confidence: 0.8, // Behavioral analysis typically has high confidence
      details: {
        risks,
        patterns: this.identifyBehavioralPatterns(content)
      }
    };
  }

  /**
   * Analyze contextual safety (regional, temporal, social context)
   */
  private async analyzeContextualSafety(content: SocialContent): Promise<ContentRisk> {
    // Regional context analysis
    const regionalRisk = this.analyzeRegionalContext(content);

    // Temporal context analysis
    const temporalRisk = this.analyzeTemporalContext(content);

    // Social context analysis
    const socialRisk = await this.analyzeSocialContext(content);

    const overallRisk = Math.max(regionalRisk, temporalRisk, socialRisk);

    return {
      category: 'CONTEXTUAL',
      riskScore: overallRisk,
      violations: [],
      confidence: 0.75,
      details: {
        regional: { risk: regionalRisk, context: 'South African compliance focus' },
        temporal: { risk: temporalRisk, context: 'Current social climate' },
        social: { risk: socialRisk, context: 'Community impact assessment' }
      }
    };
  }

  /**
   * Aggregate safety scores from all analysis categories
   */
  private aggregateSafetyScores(analysis: {
    text: ContentRisk;
    visual: ContentRisk | null;
    behavioral: ContentRisk;
    contextual: ContentRisk;
  }): ContentRisk {
    const scores = [analysis.text, analysis.behavioral, analysis.contextual];
    if (analysis.visual) {
      scores.push(analysis.visual);
    }

    // Weight the different categories
    const weights = {
      TEXT: 0.3,
      VISUAL: 0.35,
      BEHAVIORAL: 0.2,
      CONTEXTUAL: 0.15
    };

    const weightedScore = scores.reduce((sum, score) => {
      return sum + (score.riskScore * weights[score.category]);
    }, 0);

    const allViolations = scores.flatMap(score => score.violations);

    return {
      category: 'OVERALL',
      riskScore: weightedScore,
      violations: [...new Set(allViolations)], // Remove duplicates
      confidence: scores.reduce((sum, score) => sum + score.confidence, 0) / scores.length,
      details: {
        breakdown: scores,
        weightedScore,
        riskLevel: this.determineRiskLevel(weightedScore)
      }
    };
  }

  /**
   * Make final safety decision based on aggregated analysis
   */
  private makeSafetyDecision(safetyAnalysis: ContentRisk): SafetyCheck {
    const riskScore = safetyAnalysis.riskScore;
    const violations = safetyAnalysis.violations;

    // Define safety thresholds
    const BLOCK_THRESHOLD = 0.8;
    const FLAG_THRESHOLD = 0.5;
    const SAFE_THRESHOLD = 0.3;

    let safetyLevel: ContentSafetyLevel;
    let moderationAction: string;
    let requiresHumanReview: boolean;

    if (riskScore >= BLOCK_THRESHOLD || this.hasCriticalViolations(violations)) {
      safetyLevel = ContentSafetyLevel.BLOCKED;
      moderationAction = 'BLOCK';
      requiresHumanReview = false;
    } else if (riskScore >= FLAG_THRESHOLD || violations.length > 0) {
      safetyLevel = ContentSafetyLevel.FLAGGED;
      moderationAction = 'REVIEW';
      requiresHumanReview = true;
    } else {
      safetyLevel = ContentSafetyLevel.SAFE;
      moderationAction = 'APPROVE';
      requiresHumanReview = false;
    }

    // Queue appropriate actions
    if (requiresHumanReview) {
      this.moderationQueue.add('human-review', {
        safetyAnalysis,
        timestamp: new Date(),
        priority: riskScore > 0.7 ? 'high' : 'normal'
      });
    }

    if (riskScore > 0.6) {
      this.complianceQueue.add('compliance-alert', {
        safetyLevel,
        violations,
        riskScore,
        timestamp: new Date()
      });
    }

    return {
      contentId: safetyAnalysis.details?.breakdown?.[0]?.details?.toxicity?.contentId,
      safetyLevel,
      riskScore,
      violations,
      requiresHumanReview,
      moderationAction,
      confidence: safetyAnalysis.confidence,
      analysisTimestamp: new Date(),
      reviewDeadline: requiresHumanReview ? this.calculateReviewDeadline(riskScore) : null,
      automatedActions: this.determineAutomatedActions(safetyLevel, violations),
      recommendation: this.generateRecommendation(safetyLevel, violations, riskScore)
    };
  }

  /**
   * Monitor existing assets for safety compliance
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async monitorAssetSafety(): Promise<void> {
    try {
      this.logger.log('Starting asset safety monitoring');

      // Get active assets that need monitoring
      const assetsToMonitor = await this.assetRepository
        .createQueryBuilder('asset')
        .where('asset.status = :status', { status: 'ACTIVE' })
        .andWhere('asset.last_safety_check < :threshold', {
          threshold: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
        })
        .getMany();

      for (const asset of assetsToMonitor) {
        await this.checkAssetSafety(asset);
      }

      this.logger.log(`Safety monitoring completed for ${assetsToMonitor.length} assets`);
    } catch (error) {
      this.logger.error('Asset safety monitoring failed:', error);
    }
  }

  /**
   * Check safety of a specific asset
   */
  private async checkAssetSafety(asset: ViralAsset): Promise<void> {
    try {
      // Re-analyze safety based on current data
      const safetyCheck = await this.performAssetSafetyCheck(asset);

      // Update asset safety status
      await this.assetRepository.update(asset.id, {
        content_safety: safetyCheck.safetyLevel,
        content_risk_score: safetyCheck.riskScore,
        last_safety_check: new Date(),
        updated_at: new Date()
      });

      // Take appropriate action based on safety level
      if (safetyCheck.safetyLevel === ContentSafetyLevel.BLOCKED) {
        await this.handleBlockedAsset(asset, safetyCheck);
      } else if (safetyCheck.safetyLevel === ContentSafetyLevel.FLAGGED) {
        await this.handleFlaggedAsset(asset, safetyCheck);
      }

      // Log the safety check
      await this.auditService.logAssetSafetyCheck({
        assetId: asset.id,
        safetyCheck,
        previousSafetyLevel: asset.content_safety,
        timestamp: new Date()
      });

    } catch (error) {
      this.logger.error(`Safety check failed for asset ${asset.id}:`, error);
    }
  }

  /**
   * Perform safety check on an existing asset
   */
  private async performAssetSafetyCheck(asset: ViralAsset): Promise<SafetyCheck> {
    // Analyze current sentiment trends
    const sentimentAnalysis = await this.analyzeSentimentTrends(asset);

    // Check for content drift
    const contentDrift = await this.analyzeContentDrift(asset);

    // Monitor community reports
    const communityReports = await this.getCommunityReports(asset);

    // Check for compliance violations
    const complianceCheck = await this.checkComplianceStatus(asset);

    const riskFactors = [sentimentAnalysis, contentDrift, communityReports, complianceCheck];
    const maxRisk = Math.max(...riskFactors);

    const violations = [];
    if (sentimentAnalysis > 0.7) violations.push('NEGATIVE_SENTIMENT_SPIKE');
    if (contentDrift > 0.6) violations.push('CONTENT_DRIFT');
    if (communityReports > 0.5) violations.push('COMMUNITY_REPORTS');
    if (complianceCheck > 0.8) violations.push('COMPLIANCE_VIOLATION');

    return this.makeSafetyDecision({
      category: 'OVERALL',
      riskScore: maxRisk,
      violations,
      confidence: 0.85,
      details: {
        sentimentAnalysis,
        contentDrift,
        communityReports,
        complianceCheck
      }
    });
  }

  /**
   * Handle assets that have been blocked
   */
  private async handleBlockedAsset(asset: ViralAsset, safetyCheck: SafetyCheck): Promise<void> {
    // Immediately suspend trading
    await this.assetRepository.update(asset.id, {
      status: 'SUSPENDED',
      moderation_status: ModerationStatus.REJECTED,
      updated_at: new Date()
    });

    // Notify compliance team
    await this.notificationService.sendAlert({
      type: 'ASSET_BLOCKED',
      severity: 'HIGH',
      message: `Asset ${asset.symbol} has been blocked due to safety violations`,
      data: {
        assetId: asset.id,
        symbol: asset.symbol,
        violations: safetyCheck.violations,
        riskScore: safetyCheck.riskScore
      }
    });

    // Cancel all open orders
    await this.cancelOpenOrders(asset.id);

    // Process refunds if necessary
    await this.processRefunds(asset.id);
  }

  /**
   * Handle assets that have been flagged for review
   */
  private async handleFlaggedAsset(asset: ViralAsset, safetyCheck: SafetyCheck): Promise<void> {
    // Update moderation status
    await this.assetRepository.update(asset.id, {
      moderation_status: ModerationStatus.PENDING,
      updated_at: new Date()
    });

    // Queue for human review
    await this.moderationQueue.add('human-review', {
      assetId: asset.id,
      safetyCheck,
      priority: safetyCheck.riskScore > 0.7 ? 'high' : 'normal'
    });

    // Notify moderation team
    await this.notificationService.sendAlert({
      type: 'ASSET_FLAGGED',
      severity: 'MEDIUM',
      message: `Asset ${asset.symbol} has been flagged for review`,
      data: {
        assetId: asset.id,
        symbol: asset.symbol,
        violations: safetyCheck.violations,
        riskScore: safetyCheck.riskScore,
        reviewDeadline: safetyCheck.reviewDeadline
      }
    });
  }

  /**
   * Helper methods
   */
  private calculateTextRiskScore(
    toxicity: any,
    sentiment: any,
    classification: any
  ): number {
    let riskScore = 0;

    // Toxicity contribution
    riskScore += toxicity.severe_toxicity * 0.3;
    riskScore += toxicity.obscene * 0.2;
    riskScore += toxicity.threat * 0.4;
    riskScore += toxicity.insult * 0.15;

    // Sentiment contribution (extreme negative sentiment increases risk)
    if (sentiment.sentiment < -0.7) {
      riskScore += 0.3;
    }

    // Classification contribution
    if (classification.categories?.includes('HATE_SPEECH')) riskScore += 0.8;
    if (classification.categories?.includes('VIOLENCE')) riskScore += 0.9;
    if (classification.categories?.includes('SELF_HARM')) riskScore += 0.7;
    if (classification.categories?.includes('SEXUAL_CONTENT')) riskScore += 0.6;

    return Math.min(riskScore, 1.0);
  }

  private identifyTextViolations(toxicity: any, classification: any): string[] {
    const violations = [];

    if (toxicity.severe_toxicity > 0.5) violations.push('SEVERE_TOXICITY');
    if (toxicity.obscene > 0.6) violations.push('OBSCENE_CONTENT');
    if (toxicity.threat > 0.4) violations.push('THREATENING_CONTENT');
    if (toxicity.insult > 0.5) violations.push('INSULTING_LANGUAGE');

    if (classification.categories) {
      if (classification.categories.includes('HATE_SPEECH')) violations.push('HATE_SPEECH');
      if (classification.categories.includes('VIOLENCE')) violations.push('VIOLENCE');
      if (classification.categories.includes('SELF_HARM')) violations.push('SELF_HARM');
      if (classification.categories.includes('SEXUAL_CONTENT')) violations.push('SEXUAL_CONTENT');
    }

    return violations;
  }

  private calculateConfidence(toxicity: any, classification: any): number {
    const toxicityConfidence = Object.values(toxicity).reduce((sum: number, val: any) => sum + val.confidence, 0) / Object.keys(toxicity).length;
    const classificationConfidence = classification.confidence || 0.8;

    return (toxicityConfidence + classificationConfidence) / 2;
  }

  private hasCriticalViolations(violations: string[]): boolean {
    const criticalViolations = [
      'VIOLENCE',
      'SEVERE_TOXICITY',
      'CHILD_SAFETY',
      'SELF_HARM',
      'EXTREMISM'
    ];

    return violations.some(violation => criticalViolations.includes(violation));
  }

  private determineRiskLevel(riskScore: number): string {
    if (riskScore >= 0.8) return 'CRITICAL';
    if (riskScore >= 0.6) return 'HIGH';
    if (riskScore >= 0.4) return 'MEDIUM';
    if (riskScore >= 0.2) return 'LOW';
    return 'MINIMAL';
  }

  private calculateReviewDeadline(riskScore: number): Date {
    const now = new Date();
    const hours = riskScore > 0.7 ? 2 : riskScore > 0.5 ? 4 : 8;
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  private determineAutomatedActions(safetyLevel: ContentSafetyLevel, violations: string[]): string[] {
    const actions = [];

    switch (safetyLevel) {
      case ContentSafetyLevel.BLOCKED:
        actions.push('SUSPEND_TRADING', 'NOTIFY_COMPLIANCE', 'CANCEL_ORDERS', 'PROCESS_REFUNDS');
        break;
      case ContentSafetyLevel.FLAGGED:
        actions.push('QUEUE_FOR_REVIEW', 'LIMIT_TRADING', 'NOTIFY_MODERATORS');
        break;
      case ContentSafetyLevel.SAFE:
        actions.push('CONTINUE_MONITORING', 'UPDATE_ANALYTICS');
        break;
    }

    // Add violation-specific actions
    if (violations.includes('HATE_SPEECH')) actions.push('REPORT_TO_AUTHORITIES');
    if (violations.includes('CHILD_SAFETY')) actions.push('IMMEDIATE_BLOCK', 'REPORT_TO_CYPBER_CRIME');

    return actions;
  }

  private generateRecommendation(safetyLevel: ContentSafetyLevel, violations: string[], riskScore: number): string {
    if (safetyLevel === ContentSafetyLevel.BLOCKED) {
      return 'Content violates safety policies and trading must be suspended immediately';
    }

    if (safetyLevel === ContentSafetyLevel.FLAGGED) {
      return `Content requires human review due to: ${violations.join(', ')}`;
    }

    if (riskScore > 0.2) {
      return 'Content passes safety checks but should be monitored closely';
    }

    return 'Content is safe and suitable for trading';
  }

  // Additional helper methods for behavioral and contextual analysis
  private analyzePostingFrequency(content: SocialContent): number {
    // Implementation for analyzing posting frequency patterns
    return 0.2; // Placeholder
  }

  private analyzeEngagementPatterns(content: SocialContent): number {
    // Implementation for analyzing engagement patterns
    return 0.1; // Placeholder
  }

  private async analyzeAccountBehavior(content: SocialContent): Promise<number> {
    // Implementation for account behavior analysis
    return 0.15; // Placeholder
  }

  private analyzeRegionalContext(content: SocialContent): number {
    // Implementation for regional context analysis
    return 0.1; // Placeholder
  }

  private analyzeTemporalContext(content: SocialContent): number {
    // Implementation for temporal context analysis
    return 0.05; // Placeholder
  }

  private async analyzeSocialContext(content: SocialContent): Promise<number> {
    // Implementation for social context analysis
    return 0.2; // Placeholder
  }

  private identifyBehavioralPatterns(content: SocialContent): any {
    // Implementation for identifying behavioral patterns
    return {}; // Placeholder
  }

  private aggregateVisualRisk(visualAnalyses: any[]): any {
    // Implementation for aggregating visual risk
    return { overallRisk: 0.2, violations: [], averageConfidence: 0.8 }; // Placeholder
  }

  private async analyzeSentimentTrends(asset: ViralAsset): Promise<number> {
    // Implementation for sentiment trend analysis
    return 0.1; // Placeholder
  }

  private async analyzeContentDrift(asset: ViralAsset): Promise<number> {
    // Implementation for content drift analysis
    return 0.05; // Placeholder
  }

  private async getCommunityReports(asset: ViralAsset): Promise<number> {
    // Implementation for community reports analysis
    return 0.02; // Placeholder
  }

  private async checkComplianceStatus(asset: ViralAsset): Promise<number> {
    // Implementation for compliance status check
    return 0.01; // Placeholder
  }

  private async cancelOpenOrders(assetId: string): Promise<void> {
    // Implementation for canceling open orders
  }

  private async processRefunds(assetId: string): Promise<void> {
    // Implementation for processing refunds
  }
}