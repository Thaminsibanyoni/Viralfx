import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

interface AdvancedDeceptionAnalysis {
  linguisticPatterns: {
    sensationalism: number;
    emotionalLanguage: number;
    clickbaitIndicators: number;
    propagandaTechniques: number;
  };
  sourceAnalysis: {
    credibilityScore: number;
    factualityScore: number;
    biasScore: number;
    sourceReliability: number;
  };
  contentAnalysis: {
    factualAccuracy: number;
    logicalFallacies: string[];
    unverifiedClaims: string[];
    manipulationTactics: string[];
  };
  riskAssessment: {
    overallRisk: number;
    riskFactors: string[];
    recommendedActions: string[];
  };
}

@Injectable()
export class DeceptionAnalysisService {
  private readonly logger = new Logger(DeceptionAnalysisService.name);

  constructor(private readonly httpService: HttpService) {}

  async performAdvancedAnalysis(content: string, source?: string): Promise<AdvancedDeceptionAnalysis> {
    try {
      this.logger.log('Performing advanced deception analysis');

      // In a real implementation, this would call external APIs or ML models
      // For now, we'll implement sophisticated rule-based analysis

      const linguisticPatterns = this.analyzeLinguisticPatterns(content);
      const sourceAnalysis = await this.analyzeSource(source);
      const contentAnalysis = this.analyzeContent(content);
      const riskAssessment = this.assessRisk(linguisticPatterns, sourceAnalysis, contentAnalysis);

      return {
        linguisticPatterns,
        sourceAnalysis,
        contentAnalysis,
        riskAssessment,
      };
    } catch (error) {
      this.logger.error('Advanced deception analysis failed:', error);
      throw error;
    }
  }

  async crossReferenceSources(claim: string): Promise<{
    verifiedSources: Array<{ url: string; title: string; credibility: number }>;
    conflictingSources: Array<{ url: string; title: string; credibility: number }>;
    consensusScore: number;
  }> {
    // This would integrate with fact-checking APIs
    // For now, return mock data

    return {
      verifiedSources: [],
      conflictingSources: [],
      consensusScore: 0.5,
    };
  }

  async analyzeSocialMediaAmplification(content: string): Promise<{
    botActivityScore: number;
    coordinatedInauthenticBehavior: number;
    echoChamberEffect: number;
    viralPotential: number;
  }> {
    // Analyze for bot activity and coordinated behavior
    // This would integrate with social media analysis APIs

    return {
      botActivityScore: Math.random() * 0.3,
      coordinatedInauthenticBehavior: Math.random() * 0.2,
      echoChamberEffect: Math.random() * 0.4,
      viralPotential: Math.random() * 0.6,
    };
  }

  async detectDeepfakes(mediaUrl?: string): Promise<{
    isManipulated: boolean;
    confidence: number;
    manipulationType: string[];
    originalSource?: string;
  }> {
    if (!mediaUrl) {
      return {
        isManipulated: false,
        confidence: 0,
        manipulationType: [],
      };
    }

    // This would integrate with deepfake detection APIs
    // For now, return mock analysis

    return {
      isManipulated: Math.random() > 0.8,
      confidence: Math.random() * 0.7,
      manipulationType: [],
    };
  }

  private analyzeLinguisticPatterns(content: string) {
    const sensationalistWords = [
      'shocking', 'unbelievable', 'mind-blowing', 'explosive', 'bombshell',
      'outrageous', 'scandalous', 'controversial', 'exclusive', 'secret',
    ];

    const emotionalWords = [
      'horrifying', 'terrifying', 'amazing', 'incredible', 'heartbreaking',
      'disgusting', 'enraging', 'inspiring', 'devastating', 'miraculous',
    ];

    const clickbaitPhrases = [
      'you won\'t believe', 'what happened next', 'the reason why',
      'number one', 'top ten', 'this one trick', 'doctors hate',
    ];

    const propagandaTechniques = [
      'us vs them', 'fear mongering', 'whataboutism', 'false dichotomy',
      'appeal to emotion', 'bandwagon', 'testimonial', 'plain folks',
    ];

    const contentLower = content.toLowerCase();
    const words = contentLower.split(/\s+/);

    // Calculate scores based on word frequency
    const sensationalismScore = this.calculatePhraseScore(contentLower, sensationalistWords) / words.length;
    const emotionalLanguageScore = this.calculatePhraseScore(contentLower, emotionalWords) / words.length;
    const clickbaitScore = this.calculatePhraseScore(contentLower, clickbaitPhrases) / words.length;
    const propagandaScore = this.calculatePhraseScore(contentLower, propagandaTechniques) / words.length;

    return {
      sensationalism: Math.min(sensationalismScore * 10, 1.0),
      emotionalLanguage: Math.min(emotionalLanguageScore * 8, 1.0),
      clickbaitIndicators: Math.min(clickbaitScore * 15, 1.0),
      propagandaTechniques: Math.min(propagandaScore * 12, 1.0),
    };
  }

  private async analyzeSource(source?: string) {
    // In a real implementation, this would check source reputation, history, etc.
    // For now, return mock analysis

    const credibilityScore = source ? this.assessSourceCredibility(source) : 0.5;
    const factualityScore = source ? Math.random() * 0.5 + 0.3 : 0.5;
    const biasScore = source ? Math.random() * 0.6 + 0.2 : 0.5;
    const sourceReliability = (credibilityScore + factualityScore + (1 - biasScore)) / 3;

    return {
      credibilityScore,
      factualityScore,
      biasScore,
      sourceReliability,
    };
  }

  private analyzeContent(content: string) {
    const logicalFallacies = this.detectLogicalFallacies(content);
    const unverifiedClaims = this.detectUnverifiedClaims(content);
    const manipulationTactics = this.detectManipulationTactics(content);

    // Calculate factual accuracy (inverted from manipulation indicators)
    const manipulationScore = (manipulationTactics.length / content.split(/\s+/).length) * 100;
    const factualAccuracy = Math.max(0, 1 - manipulationScore);

    return {
      factualAccuracy,
      logicalFallacies,
      unverifiedClaims,
      manipulationTactics,
    };
  }

  private assessRisk(
    linguisticPatterns: any,
    sourceAnalysis: any,
    contentAnalysis: any,
  ) {
    // Calculate overall risk from multiple factors
    const linguisticRisk = (
      linguisticPatterns.sensationalism +
      linguisticPatterns.emotionalLanguage +
      linguisticPatterns.clickbaitIndicators +
      linguisticPatterns.propagandaTechniques
    ) / 4;

    const sourceRisk = 1 - sourceAnalysis.sourceReliability;
    const contentRisk = 1 - contentAnalysis.factualAccuracy;

    const overallRisk = (linguisticRisk * 0.4 + sourceRisk * 0.3 + contentRisk * 0.3);

    const riskFactors = [];
    if (linguisticPatterns.sensationalism > 0.6) riskFactors.push('High sensationalism');
    if (linguisticPatterns.propagandaTechniques > 0.5) riskFactors.push('Propaganda techniques detected');
    if (sourceAnalysis.credibilityScore < 0.4) riskFactors.push('Low source credibility');
    if (contentAnalysis.logicalFallacies.length > 2) riskFactors.push('Multiple logical fallacies');
    if (contentAnalysis.manipulationTactics.length > 3) riskFactors.push('Manipulation tactics detected');

    const recommendedActions = [];
    if (overallRisk > 0.7) {
      recommendedActions.push('Immediate review required');
      recommendedActions.push('Consider fact-checking');
    }
    if (overallRisk > 0.5) {
      recommendedActions.push('Verify with multiple sources');
    }
    if (linguisticPatterns.clickbaitIndicators > 0.6) {
      recommendedActions.push('Review for clickbait compliance');
    }

    return {
      overallRisk,
      riskFactors,
      recommendedActions,
    };
  }

  private calculatePhraseScore(content: string, phrases: string[]): number {
    return phrases.reduce((score, phrase) => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const matches = content.match(regex);
      return score + (matches ? matches.length : 0);
    }, 0);
  }

  private assessSourceCredibility(source: string): number {
    // Simplified source credibility assessment
    const credibleDomains = [
      'reuters.com', 'ap.org', 'bbc.com', 'npr.org', 'wsj.com',
      'nytimes.com', 'washingtonpost.com', 'economist.com',
    ];

    const lowCredibilityDomains = [
      'theonion.com', 'nationalreport.net', 'worldnewsdailyreport.com',
    ];

    try {
      const domain = new URL(source).hostname.toLowerCase();

      if (credibleDomains.some(cred => domain.includes(cred))) {
        return 0.9;
      } else if (lowCredibilityDomains.some(low => domain.includes(low))) {
        return 0.1;
      } else {
        return 0.5; // Neutral score for unknown sources
      }
    } catch {
      return 0.5; // Neutral score for invalid URLs
    }
  }

  private detectLogicalFallacies(content: string): string[] {
    const fallacies = {
      'Ad hominem': ['attack the person', 'you\'re just saying', 'personal attack'],
      'Straw man': ['misrepresenting your argument', 'putting words in your mouth'],
      'False dichotomy': ['either or', 'only two options', 'no other choice'],
      'Slippery slope': ['will lead to', 'eventually', 'next thing you know'],
      'Appeal to authority': ['experts agree', 'studies show', 'research proves'],
      'Bandwagon': ['everyone believes', 'most people think', 'popular opinion'],
    };

    const detected: string[] = [];
    const contentLower = content.toLowerCase();

    for (const [fallacy, indicators] of Object.entries(fallacies)) {
      for (const indicator of indicators) {
        if (contentLower.includes(indicator)) {
          detected.push(fallacy);
          break;
        }
      }
    }

    return detected;
  }

  private detectUnverifiedClaims(content: string): string[] {
    const unverifiablePhrases = [
      'sources say', 'rumors suggest', 'people are saying',
      'it is said that', 'apparently', 'supposedly',
      'it has been reported', 'according to sources',
    ];

    const claims: string[] = [];
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase().trim();
      if (unverifiablePhrases.some(phrase => sentenceLower.includes(phrase))) {
        claims.push(sentence.trim());
      }
    }

    return claims;
  }

  private detectManipulationTactics(content: string): string[] {
    const tactics = {
      'Urgency creation': ['act now', 'limited time', 'don\'t wait', 'running out'],
      'Fear appeal': ['dangerous', 'threat', 'risk', 'be careful', 'warning'],
      'Social proof': ['everyone', 'most people', 'popular', 'trending'],
      'Scarcity': ['limited', 'exclusive', 'rare', 'only few'],
      'Emotional manipulation': ['heartbreaking', 'shocking', 'outrageous', 'unbelievable'],
      'Authority appeal': ['experts', 'doctors', 'scientists', 'official'],
    };

    const detected: string[] = [];
    const contentLower = content.toLowerCase();

    for (const [tactic, keywords] of Object.entries(tactics)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          detected.push(tactic);
          break;
        }
      }
    }

    return detected;
  }
}