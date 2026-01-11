export interface SentimentScore {
  score: number;
  polarity: 'positive' | 'negative' | 'neutral';
  confidence: number;
  impactScore: number;
  viralPotential: number;
}

export interface ViralIndicators {
  urgency: number;
  controversy: number;
  timeliness: number;
  socialProof: number;
  authority: number;
  engagement: number;
}

export class SentimentScorer {
  private static readonly positiveWords = new Set([
    // English positive words
    'amazing', 'awesome', 'excellent', 'fantastic', 'great', 'good', 'love', 'perfect', 'wonderful',
    'best', 'brilliant', 'incredible', 'outstanding', 'superb', 'thrilled', 'excited', 'happy',
    'joy', 'success', 'win', 'victory', 'breakthrough', 'achievement', 'milestone', 'record',

    // South African specific positive words
    'lekker', 'baie', 'groot', 'treffer', 'top', 'supersport', 'bokke', 'flyers', 'ama-zulu',

    // Financial/business positive words
    'profit', 'growth', 'bull', 'surge', 'rally', 'boom', 'soar', 'skyrocket', 'bullish', 'uptrend',
    'breakout', 'momentum', 'strength', 'gainer', 'winner', 'success', 'opportunity', 'bullrun',
  ]);

  private static readonly negativeWords = new Set([
    // English negative words
    'awful', 'bad', 'terrible', 'horrible', 'worst', 'hate', 'disgusting', 'disappointing', 'failed',
    'crash', 'disaster', 'catastrophe', 'emergency', 'crisis', 'scandal', 'fraud', 'corruption',
    'collapse', 'bankruptcy', 'loss', 'decline', 'fall', 'drop', 'plunge', 'bearish', 'downtrend',

    // South African specific negative words
    'skaam', 'swak', 'sleg', 'ramas', 'katastrofe', 'skandaal', 'korrupsie', 'krisis',

    // Financial/business negative words
    'bear', 'crash', 'correction', 'downturn', 'recession', 'inflation', 'debt', 'loss', 'sell-off',
    'fraud', 'scam', 'investigation', 'lawsuit', 'bankruptcy', 'default', 'delisting', 'suspended',
  ]);

  private static readonly urgencyWords = new Set([
    'urgent', 'breaking', 'alert', 'immediate', 'emergency', 'critical', 'now', 'today',
    'just in', 'developing', 'unfolding', 'exclusive', 'first', 'latest', 'happening now',
  ]);

  private static readonly controversyWords = new Set([
    'controversy', 'debate', 'dispute', 'conflict', 'scandal', 'investigation', 'allegations',
    'accusations', 'lawsuit', 'legal', 'court', 'arrest', 'charges', 'probe', 'audit',
    'corruption', 'fraud', 'misconduct', 'resignation', 'fired', 'suspended', 'banned',
  ]);

  private static readonly authorityWords = new Set([
    'official', 'government', 'regulator', 'sec', 'fsc', 'jse', 'nyse', 'nasdaq', 'fed',
    'reserve bank', 'minister', 'president', 'ceo', 'executive', 'director', 'founder',
    'expert', 'analyst', 'economist', 'research', 'report', 'study', 'announcement',
  ]);

  /**
   * Analyze sentiment of text content and return comprehensive scoring
   */
  static analyzeSentiment(text: string, metadata?: any): SentimentScore {
    const cleanText = text.toLowerCase();
    const words = cleanText.split(/\s+/);

    // Count sentiment-bearing words
    const positiveCount = words.filter(word => this.positiveWords.has(word)).length;
    const negativeCount = words.filter(word => this.negativeWords.has(word)).length;

    // Calculate polarity score (-1 to 1)
    const totalSentimentWords = positiveCount + negativeCount;
    const polarity = totalSentimentWords > 0
      ? (positiveCount - negativeCount) / totalSentimentWords
      : 0;

    // Determine polarity label
    let polarityLabel: 'positive' | 'negative' | 'neutral';
    if (polarity > 0.1) {
      polarityLabel = 'positive';
    } else if (polarity < -0.1) {
      polarityLabel = 'negative';
    } else {
      polarityLabel = 'neutral';
    }

    // Calculate confidence based on sentiment word density
    const confidence = Math.min(totalSentimentWords / words.length * 10, 1);

    // Calculate impact score based on multiple factors
    const impactScore = this.calculateImpactScore(cleanText, metadata);

    // Calculate viral potential
    const viralPotential = this.calculateViralPotential(cleanText, impactScore);

    return {
      score: polarity,
      polarity: polarityLabel,
      confidence,
      impactScore,
      viralPotential
    };
  }

  /**
   * Calculate viral indicators for content prioritization
   */
  static analyzeViralIndicators(text: string, metrics?: any, metadata?: any): ViralIndicators {
    const cleanText = text.toLowerCase();

    // Urgency indicators
    const urgency = this.countWordSet(cleanText, this.urgencyWords) / 100;

    // Controversy indicators
    const controversy = this.countWordSet(cleanText, this.controversyWords) / 50;

    // Timeliness (recent content gets higher score)
    const hoursSincePublished = metadata?.timestamp
      ? (Date.now() - new Date(metadata.timestamp).getTime()) / (1000 * 60 * 60)
      : 24;
    const timeliness = Math.max(0, 1 - hoursSincePublished / 24);

    // Social proof (based on existing metrics)
    const socialProof = this.calculateSocialProof(metrics);

    // Authority indicators
    const authority = this.countWordSet(cleanText, this.authorityWords) / 50;

    // Engagement rate
    const engagement = this.calculateEngagementRate(metrics);

    return {
      urgency,
      controversy,
      timeliness,
      socialProof,
      authority,
      engagement
    };
  }

  /**
   * Calculate priority score for queue processing (1-10, where 10 is highest priority)
   */
  static calculatePriorityScore(sentiment: SentimentScore, indicators: ViralIndicators): number {
    // Weight different factors for priority calculation
    const weights = {
      viralPotential: 0.3,
      urgency: 0.2,
      controversy: 0.15,
      timeliness: 0.15,
      socialProof: 0.1,
      authority: 0.1
    };

    // Calculate weighted score (0-1)
    const weightedScore =
      sentiment.viralPotential * weights.viralPotential +
      indicators.urgency * weights.urgency +
      indicators.controversy * weights.controversy +
      indicators.timeliness * weights.timeliness +
      indicators.socialProof * weights.socialProof +
      indicators.authority * weights.authority;

    // Convert to priority score (1-10)
    return Math.max(1, Math.min(10, Math.ceil(weightedScore * 10)));
  }

  private static calculateImpactScore(text: string, metadata?: any): number {
    let score = 0;

    // Length factor (longer content often has more impact)
    if (text.length > 200) score += 0.1;
    if (text.length > 500) score += 0.1;

    // Question marks indicate engagement-seeking content
    const questionMarks = (text.match(/\?/g) || []).length;
    score += Math.min(questionMarks * 0.05, 0.2);

    // Exclamation marks indicate urgency/emotion
    const exclamationMarks = (text.match(/!/g) || []).length;
    score += Math.min(exclamationMarks * 0.05, 0.2);

    // Numbers and percentages suggest factual content
    const numbers = (text.match(/\d+/g) || []).length;
    score += Math.min(numbers * 0.02, 0.2);

    // Hashtags indicate topical relevance
    const hashtags = (text.match(/#\w+/g) || []).length;
    score += Math.min(hashtags * 0.03, 0.2);

    return Math.min(score, 1);
  }

  private static calculateViralPotential(text: string, impactScore: number): number {
    let potential = impactScore;

    // High emotion words
    const highEmotionWords = ['shocking', 'unbelievable', 'mind-blowing', 'game-changer', 'revolutionary'];
    const emotionCount = highEmotionWords.filter(word => text.toLowerCase().includes(word)).length;
    potential += emotionCount * 0.1;

    // Call-to-action words
    const ctaWords = ['share', 'retweet', 'comment', 'like', 'follow', 'join', 'support'];
    const ctaCount = ctaWords.filter(word => text.toLowerCase().includes(word)).length;
    potential += ctaCount * 0.05;

    // List formatting (people love lists)
    if (/\d+\.|top \d+|\d+ ways?|\d+ reasons?/i.test(text)) {
      potential += 0.1;
    }

    return Math.min(potential, 1);
  }

  private static countWordSet(text: string, wordSet: Set<string>): number {
    return text.split(/\s+/).filter(word => wordSet.has(word)).length;
  }

  private static calculateSocialProof(metrics?: any): number {
    if (!metrics) return 0;

    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const views = metrics.views || 0;

    // Normalize to 0-1 scale (using logarithmic scaling)
    const logLikes = Math.log10(Math.max(likes, 1));
    const logShares = Math.log10(Math.max(shares, 1));
    const logComments = Math.log10(Math.max(comments, 1));
    const logViews = Math.log10(Math.max(views, 1));

    // Weight different engagement types
    const weightedScore =
      (logLikes * 0.3) +
      (logShares * 0.4) +
      (logComments * 0.2) +
      (logViews * 0.1);

    return Math.min(weightedScore / 10, 1); // Normalize to 0-1
  }

  private static calculateEngagementRate(metrics?: any): number {
    if (!metrics) return 0;

    const likes = metrics.likes || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;
    const views = metrics.views || 1;

    const totalEngagement = likes + shares + comments;
    const engagementRate = totalEngagement / views;

    return Math.min(engagementRate * 100, 1); // Normalize to 0-1
  }
}
