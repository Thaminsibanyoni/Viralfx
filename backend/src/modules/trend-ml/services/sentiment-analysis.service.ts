import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { SocialMediaService } from "./social-media.service";

export interface SentimentAnalysis {
  overallScore: number; // -1 (very negative) to +1 (very positive)
  confidence: number; // 0 to 1
  breakdown: {
    positive: number; // 0 to 1
    negative: number; // 0 to 1
    neutral: number; // 0 to 1
  };
  emotionalIntensity: number; // 0 to 1
  keyEmotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
    disgust: number;
  };
  contentQuality: number; // 0 to 1
  topics: Array<{
    topic: string;
    sentiment: number;
    confidence: number;
  }>;
  language: string;
  spamScore: number; // 0 to 1
}

export interface SentimentTrend {
  timestamp: string;
  score: number;
  volume: number;
  positiveRatio: number;
  negativeRatio: number;
}

@Injectable()
export class SentimentAnalysisService {
  private readonly logger = new Logger(SentimentAnalysisService.name);

  // Emotion keywords for analysis
  private readonly emotionKeywords = {
    joy: ['happy', 'excited', 'amazing', 'love', 'wonderful', 'fantastic', 'great', 'awesome'],
    anger: ['angry', 'mad', 'furious', 'outraged', 'annoyed', 'frustrated', 'irritated'],
    fear: ['scared', 'afraid', 'terrified', 'worried', 'anxious', 'nervous', 'concerned'],
    sadness: ['sad', 'depressed', 'disappointed', 'heartbroken', 'devastated', 'miserable'],
    surprise: ['surprised', 'shocked', 'amazed', 'astonished', 'stunned', 'wow'],
    disgust: ['disgusting', 'gross', 'awful', 'terrible', 'horrible', 'nasty']
  };

  // Positive and negative word lists
  private readonly positiveWords = [
    'good', 'great', 'excellent', 'amazing', 'fantastic', 'wonderful', 'awesome', 'love',
    'best', 'perfect', 'beautiful', 'brilliant', 'outstanding', 'incredible', 'superb',
    'marvelous', 'delightful', 'pleased', 'satisfied', 'thrilled', 'excited', 'happy'
  ];

  private readonly negativeWords = [
    'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'worst', 'hate', 'dislike',
    'poor', 'disappointing', 'frustrated', 'annoying', 'angry', 'mad', 'sad', 'depressed',
    'worried', 'scared', 'afraid', 'concerned', 'unhappy', 'miserable', 'devastated'
  ];

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly socialMediaService: SocialMediaService) {}

  /**
   * Analyze sentiment for a trend
   */
  async analyzeSentiment(trend: any, additionalContent?: string[]): Promise<SentimentAnalysis> {
    try {
      this.logger.debug(`Starting sentiment analysis for trend: ${trend.id}`);

      // Collect content to analyze
      const content = await this.collectContent(trend, additionalContent);

      if (content.length === 0) {
        return this.getNeutralSentiment();
      }

      // Perform sentiment analysis
      const analysis = await this.performSentimentAnalysis(content);

      // Analyze emotions
      const emotions = await this.analyzeEmotions(content);

      // Detect topics and their sentiment
      const topics = await this.detectTopics(content);

      // Calculate content quality
      const contentQuality = await this.assessContentQuality(content);

      // Detect language
      const language = this.detectLanguage(content);

      // Calculate spam score
      const spamScore = await this.calculateSpamScore(content, trend);

      const result: SentimentAnalysis = {
        overallScore: analysis.overallScore,
        confidence: analysis.confidence,
        breakdown: analysis.breakdown,
        emotionalIntensity: emotions.intensity,
        keyEmotions: emotions.emotions,
        contentQuality,
        topics,
        language,
        spamScore
      };

      // Cache the analysis
      await this.cacheSentimentAnalysis(trend.id, result);

      // Store time series data
      await this.storeSentimentTimeSeries(trend.id, result);

      return result;

    } catch (error) {
      this.logger.error(`Error analyzing sentiment for trend ${trend.id}:`, error);
      return this.getNeutralSentiment();
    }
  }

  /**
   * Get sentiment trends over time
   */
  async getSentimentTrends(trendId: string, timeWindow: number = 86400): Promise<SentimentTrend[]> {
    try {
      const now = Date.now();
      const startTime = now - (timeWindow * 1000);

      // Get time series data from Redis
      const timeSeries = await this.redis.zrangebyscore(
        `sentiment-trends:${trendId}`,
        startTime,
        now,
        'WITHSCORES'
      );

      const trends: SentimentTrend[] = [];

      for (let i = 0; i < timeSeries.length; i += 2) {
        const data = JSON.parse(timeSeries[i]);
        const timestamp = timeSeries[i + 1];

        trends.push({
          timestamp: new Date(parseInt(timestamp, 10)).toISOString(),
          score: data.overallScore,
          volume: data.volume,
          positiveRatio: data.breakdown.positive,
          negativeRatio: data.breakdown.negative
        });
      }

      return trends.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    } catch (error) {
      this.logger.error(`Error getting sentiment trends for trend ${trendId}:`, error);
      return [];
    }
  }

  /**
   * Batch analyze sentiment for multiple trends
   */
  async batchAnalyzeSentiment(trends: any[]): Promise<Map<string, SentimentAnalysis>> {
    try {
      this.logger.debug(`Batch analyzing sentiment for ${trends.length} trends`);

      const results = new Map<string, SentimentAnalysis>();

      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < trends.length; i += batchSize) {
        const batch = trends.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (trend) => {
            const analysis = await this.analyzeSentiment(trend);
            results.set(trend.id, analysis);
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return results;

    } catch (error) {
      this.logger.error('Error in batch sentiment analysis:', error);
      throw error;
    }
  }

  /**
   * Detect sentiment anomalies
   */
  async detectSentimentAnomalies(trendId: string): Promise<Array<{
    timestamp: string;
    type: 'SPIKE' | 'DROP' | 'REVERSAL';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    sentimentChange: number;
  }>> {
    try {
      const trends = await this.getSentimentTrends(trendId, 86400); // Last 24 hours

      if (trends.length < 5) {
        return []; // Not enough data for anomaly detection
      }

      const anomalies = [];

      // Calculate baseline sentiment
      const baselineSentiment = this.calculateBaselineSentiment(trends);

      for (let i = 2; i < trends.length; i++) {
        const current = trends[i];
        const previous = trends[i - 1];
        const beforePrevious = trends[i - 2];

        const sentimentChange = current.score - previous.score;
        const velocityChange = (current.score - previous.score) - (previous.score - beforePrevious.score);

        // Detect spikes
        if (sentimentChange > 0.3 && velocityChange > 0.1) {
          anomalies.push({
            timestamp: current.timestamp,
            type: 'SPIKE',
            severity: this.calculateAnomalySeverity(sentimentChange),
            description: `Significant positive sentiment spike detected`,
            sentimentChange
          });
        }

        // Detect drops
        if (sentimentChange < -0.3 && velocityChange < -0.1) {
          anomalies.push({
            timestamp: current.timestamp,
            type: 'DROP',
            severity: this.calculateAnomalySeverity(Math.abs(sentimentChange)),
            description: `Significant negative sentiment drop detected`,
            sentimentChange
          });
        }

        // Detect reversals
        if (
          (previous.score > baselineSentiment + 0.2 && current.score < baselineSentiment - 0.1) ||
          (previous.score < baselineSentiment - 0.2 && current.score > baselineSentiment + 0.1)
        ) {
          anomalies.push({
            timestamp: current.timestamp,
            type: 'REVERSAL',
            severity: 'MEDIUM',
            description: `Sentiment direction reversal detected`,
            sentimentChange
          });
        }
      }

      return anomalies;

    } catch (error) {
      this.logger.error(`Error detecting sentiment anomalies for trend ${trendId}:`, error);
      return [];
    }
  }

  // Private helper methods

  private async collectContent(trend: any, additionalContent?: string[]): Promise<string[]> {
    const content: string[] = [];

    // Add trend description and content
    if (trend.description) {
      content.push(trend.description);
    }

    if (trend.content) {
      content.push(trend.content);
    }

    // Add additional content if provided
    if (additionalContent) {
      content.push(...additionalContent);
    }

    // Get social media content
    try {
      const socialContent = await this.getSocialMediaContent(trend);
      content.push(...socialContent);
    } catch (error) {
      this.logger.warn('Error getting social media content for sentiment analysis:', error);
    }

    // Filter out empty content
    return content.filter(text => text && text.trim().length > 0);
  }

  private async getSocialMediaContent(trend: any): Promise<string[]> {
    const content: string[] = [];

    try {
      // Get recent posts from different platforms
      const platforms = ['twitter', 'instagram', 'tiktok'];

      for (const platform of platforms) {
        const posts = await this.socialMediaService.getRecentPosts(
          trend.symbol,
          platform,
          trend.hashtags,
          50 // Get up to 50 posts per platform
        );

        posts.forEach(post => {
          if (post.text && post.text.trim().length > 0) {
            content.push(post.text);
          }
        });
      }
    } catch (error) {
      this.logger.warn(`Error getting social media content for trend ${trend.id}:`, error);
    }

    return content;
  }

  private async performSentimentAnalysis(content: string[]): Promise<{
    overallScore: number;
    confidence: number;
    breakdown: {
      positive: number;
      negative: number;
      neutral: number;
    };
  }> {
    let totalScore = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    let totalConfidence = 0;

    for (const text of content) {
      const analysis = await this.analyzeTextSentiment(text);
      totalScore += analysis.score;
      totalConfidence += analysis.confidence;

      if (analysis.score > 0.1) {
        positiveCount++;
      } else if (analysis.score < -0.1) {
        negativeCount++;
      } else {
        neutralCount++;
      }
    }

    const total = content.length;
    const overallScore = totalScore / total;
    const confidence = totalConfidence / total;

    return {
      overallScore: Math.max(-1, Math.min(1, overallScore)),
      confidence,
      breakdown: {
        positive: positiveCount / total,
        negative: negativeCount / total,
        neutral: neutralCount / total
      }
    };
  }

  private async analyzeTextSentiment(text: string): Promise<{ score: number; confidence: number }> {
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    let wordCount = 0;

    for (const word of words) {
      // Check against positive words
      if (this.positiveWords.includes(word)) {
        score += 1;
        wordCount++;
      }
      // Check against negative words
      else if (this.negativeWords.includes(word)) {
        score -= 1;
        wordCount++;
      }
    }

    // Normalize score
    const normalizedScore = wordCount > 0 ? score / Math.sqrt(wordCount) : 0;

    // Calculate confidence based on word count and score strength
    const confidence = Math.min(1, wordCount / 10) * Math.abs(normalizedScore);

    return {
      score: Math.max(-1, Math.min(1, normalizedScore)),
      confidence
    };
  }

  private async analyzeEmotions(content: string[]): Promise<{
    intensity: number;
    emotions: {
      joy: number;
      anger: number;
      fear: number;
      sadness: number;
      surprise: number;
      disgust: number;
    };
  }> {
    const emotions = {
      joy: 0,
      anger: 0,
      fear: 0,
      sadness: 0,
      surprise: 0,
      disgust: 0
    };

    let totalIntensity = 0;
    let contentCount = content.length;

    for (const text of content) {
      const words = text.toLowerCase().split(/\s+/);
      let textIntensity = 0;

      for (const word of words) {
        for (const [emotion, keywords] of Object.entries(this.emotionKeywords)) {
          if (keywords.includes(word)) {
            emotions[emotion as keyof typeof emotions] += 1;
            textIntensity += 1;
          }
        }
      }

      totalIntensity += textIntensity / words.length;
    }

    // Normalize emotions
    const normalizedEmotions = {};
    for (const [emotion, count] of Object.entries(emotions)) {
      normalizedEmotions[emotion] = contentCount > 0 ? count / contentCount : 0;
    }

    return {
      intensity: contentCount > 0 ? totalIntensity / contentCount : 0,
      emotions: normalizedEmotions as any
    };
  }

  private async detectTopics(content: string[]): Promise<Array<{
    topic: string;
    sentiment: number;
    confidence: number;
  }>> {
    const topicCounts: Map<string, { scores: number[]; count: number }> = new Map();

    for (const text of content) {
      const sentiment = await this.analyzeTextSentiment(text);
      const topics = this.extractTopics(text);

      for (const topic of topics) {
        if (!topicCounts.has(topic)) {
          topicCounts.set(topic, { scores: [], count: 0 });
        }

        const topicData = topicCounts.get(topic)!;
        topicData.scores.push(sentiment.score);
        topicData.count += 1;
      }
    }

    const result = [];

    for (const [topic, data] of topicCounts.entries()) {
      const avgSentiment = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
      const confidence = Math.min(1, data.count / content.length);

      result.push({
        topic,
        sentiment: avgSentiment,
        confidence
      });
    }

    // Sort by confidence and return top topics
    return result.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  private extractTopics(text: string): string[] {
    // Simple topic extraction using common words and hashtags
    const words = text.toLowerCase().split(/\s+/);
    const topics: string[] = [];

    // Extract hashtags
    const hashtags = text.match(/#\w+/g);
    if (hashtags) {
      topics.push(...hashtags.map(tag => tag.substring(1)));
    }

    // Extract common nouns and proper nouns (simplified)
    for (const word of words) {
      if (word.length > 3 && !this.positiveWords.includes(word) && !this.negativeWords.includes(word)) {
        topics.push(word);
      }
    }

    // Remove duplicates and return unique topics
    return [...new Set(topics)];
  }

  private async assessContentQuality(content: string[]): Promise<number> {
    let totalQuality = 0;

    for (const text of content) {
      let quality = 0;

      // Length factor
      const length = text.length;
      if (length > 50 && length < 500) {
        quality += 0.3;
      } else if (length >= 500) {
        quality += 0.2;
      }

      // Vocabulary diversity
      const words = text.toLowerCase().split(/\s+/);
      const uniqueWords = new Set(words);
      const diversity = uniqueWords.size / words.length;
      quality += diversity * 0.3;

      // Grammar and structure (simplified)
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length > 1) {
        quality += 0.2;
      }

      // No spam indicators
      if (!this.hasSpamIndicators(text)) {
        quality += 0.2;
      }

      totalQuality += Math.min(quality, 1);
    }

    return content.length > 0 ? totalQuality / content.length : 0.5;
  }

  private hasSpamIndicators(text: string): boolean {
    const spamIndicators = [
      /click here/i,
      /free money/i,
      /guaranteed/i,
      /act now/i,
      /limited time/i,
      /!!!{3}/,
      /\${2}/,
      /http[s]?:\/\//g
    ];

    return spamIndicators.some(indicator => indicator.test(text));
  }

  private detectLanguage(content: string[]): string {
    // Simple language detection based on common words
    const text = content.join(' ').toLowerCase();

    // Check for English common words
    const englishWords = ['the', 'and', 'is', 'are', 'was', 'were', 'have', 'has', 'will', 'would'];
    const englishCount = englishWords.filter(word => text.includes(word)).length;

    // Check for Afrikaans common words
    const afrikaansWords = ['die', 'en', 'is', 'was', 'het', 'sal', 'kan', 'moet'];
    const afrikaansCount = afrikaansWords.filter(word => text.includes(word)).length;

    if (englishCount > afrikaansCount) {
      return 'en';
    } else if (afrikaansCount > 0) {
      return 'af';
    }

    return 'en'; // Default to English
  }

  private async calculateSpamScore(content: string[], trend: any): Promise<number> {
    let spamScore = 0;
    let contentCount = content.length;

    for (const text of content) {
      let textScore = 0;

      // Check for spam indicators
      if (this.hasSpamIndicators(text)) {
        textScore += 0.4;
      }

      // Check for excessive capitalization
      const upperCaseRatio = (text.match(/[A-Z]/g) || []).length / text.length;
      if (upperCaseRatio > 0.3) {
        textScore += 0.2;
      }

      // Check for excessive punctuation
      const punctuationRatio = (text.match(/[!?]/g) || []).length / text.length;
      if (punctuationRatio > 0.1) {
        textScore += 0.2;
      }

      // Check for duplicate content
      if (this.isDuplicateContent(text)) {
        textScore += 0.3;
      }

      spamScore += textScore;
    }

    return contentCount > 0 ? Math.min(spamScore / contentCount, 1) : 0;
  }

  private isDuplicateContent(text: string): boolean {
    // Simplified duplicate detection - in a real implementation
    // this would use more sophisticated algorithms
    const key = `content-hash:${this.hashText(text)}`;
    return false; // Would check against database/cache
  }

  private hashText(text: string): string {
    // Simple hash function for text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getNeutralSentiment(): SentimentAnalysis {
    return {
      overallScore: 0,
      confidence: 0.5,
      breakdown: {
        positive: 0.33,
        negative: 0.33,
        neutral: 0.34
      },
      emotionalIntensity: 0.5,
      keyEmotions: {
        joy: 0.1,
        anger: 0.1,
        fear: 0.1,
        sadness: 0.1,
        surprise: 0.1,
        disgust: 0.1
      },
      contentQuality: 0.5,
      topics: [],
      language: 'en',
      spamScore: 0
    };
  }

  private async cacheSentimentAnalysis(trendId: string, analysis: SentimentAnalysis): Promise<void> {
    await this.redis.setex(
      `sentiment-analysis:${trendId}`,
      300, // Cache for 5 minutes
      JSON.stringify(analysis)
    );
  }

  private async storeSentimentTimeSeries(trendId: string, analysis: SentimentAnalysis): Promise<void> {
    const timestamp = Date.now();
    const data = {
      overallScore: analysis.overallScore,
      breakdown: analysis.breakdown,
      volume: 1 // Would be calculated from actual content volume
    };

    await this.redis.zadd(
      `sentiment-trends:${trendId}`,
      timestamp,
      JSON.stringify(data)
    );

    // Keep only last 24 hours of data
    const cutoff = timestamp - (24 * 60 * 60 * 1000);
    await this.redis.zremrangebyscore(`sentiment-trends:${trendId}`, 0, cutoff);
  }

  private calculateBaselineSentiment(trends: SentimentTrend[]): number {
    if (trends.length === 0) return 0;

    const scores = trends.map(trend => trend.score);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private calculateAnomalySeverity(change: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (change < 0.3) return 'LOW';
    if (change < 0.5) return 'MEDIUM';
    if (change < 0.7) return 'HIGH';
    return 'CRITICAL';
  }
}
