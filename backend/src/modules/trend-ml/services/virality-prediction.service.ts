import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import * as tf from '@tensorflow/tfjs-node';
import { SocialMediaService } from './social-media.service';

export interface ViralityPrediction {
  score: number; // 0-100
  confidence: number; // 0-1
  predictedLifespan: number; // hours
  growthRate: number; // percentage per hour
  peakTime: Date;
  decayRate: number;
 影响因素: {
    socialEngagement: number;
    contentQuality: number;
    influencerImpact: number;
    timingScore: number;
    platformSynergy: number;
  };
}

export interface TrainingData {
  features: number[][];
  labels: number[];
  metadata: any;
}

@Injectable()
export class ViralityPredictionService {
  private readonly logger = new Logger(ViralityPredictionService.name);
  private model: tf.LayersModel | null = null;
  private isModelTrained = false;
  private readonly FEATURE_COUNT = 20;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly socialMediaService: SocialMediaService,
  ) {
    this.initializeModel();
  }

  /**
   * Predict virality score for a trend
   */
  async predictVirality(
    trend: any,
    socialMetrics: any[],
    sentimentAnalysis: any
  ): Promise<ViralityPrediction> {
    try {
      if (!this.isModelTrained) {
        await this.loadOrCreateModel();
      }

      // Extract features from trend data
      const features = await this.extractFeatures(trend, socialMetrics, sentimentAnalysis);

      // Make prediction using the trained model
      const prediction = await this.makePrediction(features);

      // Calculate additional metrics
      const predictedLifespan = this.predictLifespan(features, prediction);
      const growthRate = this.calculateGrowthRate(features, prediction);
      const peakTime = this.predictPeakTime(features, prediction);
      const decayRate = this.calculateDecayRate(features, prediction);

      // Analyze influencing factors
      const 影响因素 = this.analyzeInfluencingFactors(features, trend, socialMetrics);

      const result: ViralityPrediction = {
        score: prediction.score,
        confidence: prediction.confidence,
        predictedLifespan,
        growthRate,
        peakTime,
        decayRate,
        影响因素,
      };

      // Cache prediction for future reference
      await this.cachePrediction(trend.id, result);

      return result;

    } catch (error) {
      this.logger.error('Error predicting virality:', error);
      // Return fallback prediction
      return this.getFallbackPrediction(trend, socialMetrics);
    }
  }

  /**
   * Train the virality prediction model
   */
  async trainModel(trainingData?: TrainingData): Promise<void> {
    try {
      this.logger.log('Starting virality model training...');

      // Get training data if not provided
      if (!trainingData) {
        trainingData = await this.getTrainingData();
      }

      if (!trainingData || trainingData.features.length === 0) {
        this.logger.warn('No training data available, using default model');
        return;
      }

      // Create and train the model
      this.model = await this.createModel();

      // Prepare data for training
      const { xTrain, yTrain } = this.prepareTrainingData(trainingData);

      // Train the model
      await this.trainNeuralNetwork(this.model, xTrain, yTrain);

      // Evaluate model performance
      const evaluation = await this.evaluateModel(this.model, trainingData);

      this.logger.log(`Model training completed. Loss: ${evaluation.loss}, Accuracy: ${evaluation.accuracy}`);

      this.isModelTrained = true;

      // Save the trained model
      await this.saveModel();

    } catch (error) {
      this.logger.error('Error training virality prediction model:', error);
      throw error;
    }
  }

  /**
   * Get real-time virality updates for a trend
   */
  async getViralityUpdates(trendId: string, timeWindow: number = 3600): Promise<{
    currentScore: number;
    trendDirection: 'UP' | 'DOWN' | 'STABLE';
    velocity: number;
    acceleration: number;
    momentum: number;
    timeSeries: Array<{
      timestamp: string;
      score: number;
      volume: number;
      engagement: number;
    }>;
  }> {
    try {
      const now = Date.now();
      const startTime = now - (timeWindow * 1000); // Convert to milliseconds

      // Get historical virality scores from cache or database
      const timeSeries = await this.getViralityTimeSeries(trendId, startTime, now);

      if (timeSeries.length < 2) {
        return {
          currentScore: 0,
          trendDirection: 'STABLE',
          velocity: 0,
          acceleration: 0,
          momentum: 0,
          timeSeries,
        };
      }

      // Calculate trend metrics
      const currentScore = timeSeries[timeSeries.length - 1].score;
      const previousScore = timeSeries[timeSeries.length - 2].score;

      const velocity = currentScore - previousScore;
      const trendDirection = this.determineTrendDirection(velocity);

      const acceleration = this.calculateAcceleration(timeSeries);
      const momentum = this.calculateMomentum(timeSeries);

      return {
        currentScore,
        trendDirection,
        velocity,
        acceleration,
        momentum,
        timeSeries,
      };

    } catch (error) {
      this.logger.error(`Error getting virality updates for trend ${trendId}:`, error);
      throw error;
    }
  }

  /**
   * Batch predict virality for multiple trends
   */
  async batchPredictVirality(trends: any[]): Promise<Map<string, ViralityPrediction>> {
    try {
      this.logger.debug(`Batch predicting virality for ${trends.length} trends`);

      const results = new Map<string, ViralityPrediction>();

      // Process trends in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < trends.length; i += batchSize) {
        const batch = trends.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (trend) => {
            const socialMetrics = await this.socialMediaService.getSocialMetrics(
              trend.symbol,
              'all',
              trend.hashtags,
              trend.keywords
            );

            const prediction = await this.predictVirality(trend, socialMetrics, {});
            results.set(trend.id, prediction);
          })
        );

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log(`Batch virality prediction completed for ${results.size} trends`);
      return results;

    } catch (error) {
      this.logger.error('Error in batch virality prediction:', error);
      throw error;
    }
  }

  // Private helper methods

  private async initializeModel(): Promise<void> {
    try {
      await this.loadOrCreateModel();
    } catch (error) {
      this.logger.error('Error initializing virality prediction model:', error);
      // Create a simple fallback model
      this.model = this.createFallbackModel();
    }
  }

  private async loadOrCreateModel(): Promise<void> {
    try {
      // Try to load existing model from storage
      const modelData = await this.redis.get('virality-prediction:model');

      if (modelData) {
        this.model = await tf.loadLayersModel(tf.io.fromMemory(JSON.parse(modelData)));
        this.isModelTrained = true;
        this.logger.log('Loaded existing virality prediction model');
      } else {
        // Create new model if none exists
        await this.trainModel();
      }
    } catch (error) {
      this.logger.error('Error loading model, creating new one:', error);
      await this.trainModel();
    }
  }

  private async createModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Input layer
        tf.layers.dense({
          inputShape: [this.FEATURE_COUNT],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),

        // Hidden layers
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: 'relu',
          kernelInitializer: 'heNormal',
        }),

        // Output layer
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid', // Output between 0 and 1 for virality score
        }),
      ],
    });

    // Compile the model
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy'],
    });

    return model;
  }

  private createFallbackModel(): tf.LayersModel {
    // Simple linear model as fallback
    return tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.FEATURE_COUNT],
          units: 1,
          activation: 'sigmoid',
        }),
      ],
    });
  }

  private async extractFeatures(trend: any, socialMetrics: any[], sentimentAnalysis: any): Promise<number[]> {
    const features: number[] = [];

    // Trend-related features
    features.push(trend.currentPrice || 0); // Current price
    features.push(trend.volume24h || 0); // 24h volume
    features.push(trend.price24hChange || 0); // Price change
    features.push(trend.marketCap || 0); // Market cap
    features.push(this.normalizeTimestamp(trend.createdAt)); // Age of trend

    // Social media metrics
    const aggregatedSocial = this.aggregateSocialMetrics(socialMetrics);
    features.push(aggregatedSocial.mentions || 0); // Total mentions
    features.push(aggregatedSocial.likes || 0); // Total likes
    features.push(aggregatedSocial.shares || 0); // Total shares
    features.push(aggregatedSocial.comments || 0); // Total comments
    features.push(aggregatedSocial.reach || 0); // Total reach
    features.push(aggregatedSocial.engagement || 0); // Engagement rate
    features.push(aggregatedSocial.growthRate || 0); // Growth rate

    // Sentiment features
    features.push(sentimentAnalysis.overallScore || 0); // Overall sentiment
    features.push(sentimentAnalysis.positiveScore || 0); // Positive sentiment
    features.push(sentimentAnalysis.negativeScore || 0); // Negative sentiment
    features.push(sentimentAnalysis.neutralScore || 0); // Neutral sentiment
    features.push(sentimentAnalysis.emotionalIntensity || 0); // Emotional intensity

    // Content features
    features.push(this.calculateContentQuality(trend.content)); // Content quality
    features.push(trend.hashtags ? trend.hashtags.length : 0); // Number of hashtags
    features.push(trend.keywords ? trend.keywords.length : 0); // Number of keywords

    // Normalize features to [0, 1] range
    return this.normalizeFeatures(features);
  }

  private aggregateSocialMetrics(socialMetrics: any[]): any {
    if (!socialMetrics || socialMetrics.length === 0) {
      return {
        mentions: 0,
        likes: 0,
        shares: 0,
        comments: 0,
        reach: 0,
        engagement: 0,
        growthRate: 0,
      };
    }

    const aggregated = socialMetrics.reduce((acc, metric) => ({
      mentions: acc.mentions + (metric.mentions || 0),
      likes: acc.likes + (metric.likes || 0),
      shares: acc.shares + (metric.shares || 0),
      comments: acc.comments + (metric.comments || 0),
      reach: acc.reach + (metric.reach || 0),
      engagement: acc.engagement + (metric.engagement || 0),
      growthRate: acc.growthRate + (metric.growthRate || 0),
    }), {
      mentions: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      reach: 0,
      engagement: 0,
      growthRate: 0,
    });

    const count = socialMetrics.length;
    return {
      ...aggregated,
      engagement: aggregated.engagement / count,
      growthRate: aggregated.growthRate / count,
    };
  }

  private normalizeFeatures(features: number[]): number[] {
    // Normalize each feature to [0, 1] range
    const maxValues = [
      1000, // price
      1000000, // volume
      100, // price change
      10000000, // market cap
      30, // days since creation
      1000000, // mentions
      10000000, // likes
      1000000, // shares
      100000, // comments
      10000000, // reach
      100, // engagement rate
      100, // growth rate
      1, // sentiment
      1, // positive sentiment
      1, // negative sentiment
      1, // neutral sentiment
      1, // emotional intensity
      1, // content quality
      20, // hashtags
      20, // keywords
    ];

    return features.map((value, index) => {
      const max = maxValues[index] || 1;
      return Math.min(Math.max(value / max, 0), 1);
    });
  }

  private async makePrediction(features: number[]): Promise<{ score: number; confidence: number }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const inputTensor = tf.tensor2d([features]);
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const score = await prediction.data();

    // Calculate confidence based on prediction certainty
    const confidence = this.calculateConfidence(score[0]);

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    return {
      score: score[0] * 100, // Convert to 0-100 scale
      confidence,
    };
  }

  private calculateConfidence(score: number): number {
    // Simple confidence calculation based on how extreme the score is
    // Higher confidence for scores close to 0 or 1, lower for middle values
    const distanceFromCenter = Math.abs(score - 0.5) * 2;
    return 0.5 + (distanceFromCenter * 0.5);
  }

  private predictLifespan(features: number[], prediction: { score: number }): number {
    // Base lifespan calculation
    const baseHours = 24; // 1 day base

    // Adjust based on virality score
    const viralityMultiplier = 1 + (prediction.score / 100) * 4; // Up to 5x longer

    // Social engagement factor
    const socialEngagementFactor = features[8] * 2; // engagement rate index

    // Content quality factor
    const contentQualityFactor = features[18]; // content quality

    return baseHours * viralityMultiplier * (1 + socialEngagementFactor) * (1 + contentQualityFactor);
  }

  private calculateGrowthRate(features: number[], prediction: { score: number }): number {
    // Growth rate based on virality score and social metrics
    const baseGrowthRate = prediction.score / 100; // Convert to 0-1

    // Social growth rate influence
    const socialGrowthRate = features[10]; // growth rate index

    // Volume influence
    const volumeInfluence = Math.min(features[1] / 100000, 1); // volume index

    return (baseGrowthRate * 0.5) + (socialGrowthRate * 0.3) + (volumeInfluence * 0.2);
  }

  private predictPeakTime(features: number[], prediction: { score: number }): Date {
    // Predict when the trend will peak based on current metrics
    const baseTime = new Date();
    const hoursToPeak = (prediction.score / 100) * 48; // Peak within 0-48 hours

    // Adjust based on growth rate
    const growthRateAdjustment = features[10] * 12; // growth rate can add up to 12 hours

    baseTime.setHours(baseTime.getHours() + hoursToPeak + growthRateAdjustment);
    return baseTime;
  }

  private calculateDecayRate(features: number[], prediction: { score: number }): number {
    // Decay rate after peak (negative percentage)
    const baseDecayRate = -0.1; // 10% base decay per hour

    // Higher virality scores decay slower initially
    const viralityFactor = (prediction.score / 100) * 0.05;

    return baseDecayRate - viralityFactor;
  }

  private analyzeInfluencingFactors(features: number[], trend: any, socialMetrics: any[]): any {
    return {
      socialEngagement: features[8] * 100, // engagement rate as percentage
      contentQuality: features[18] * 100, // content quality as percentage
      influencerImpact: this.calculateInfluencerImpact(socialMetrics) * 100,
      timingScore: this.calculateTimingScore(trend) * 100,
      platformSynergy: this.calculatePlatformSynergy(socialMetrics) * 100,
    };
  }

  private calculateInfluencerImpact(socialMetrics: any[]): number {
    if (!socialMetrics || socialMetrics.length === 0) return 0;

    const totalInfluencers = socialMetrics.reduce((sum, metric) => {
      return sum + (metric.influencers ? metric.influencers.length : 0);
    }, 0);

    // Normalize to 0-1 range (consider 100 influencers as max)
    return Math.min(totalInfluencers / 100, 1);
  }

  private calculateTimingScore(trend: any): number {
    const now = new Date();
    const creationTime = new Date(trend.createdAt);
    const hoursSinceCreation = (now.getTime() - creationTime.getTime()) / (1000 * 60 * 60);

    // Optimal timing is 1-24 hours after creation
    if (hoursSinceCreation <= 1) {
      return 0.5; // Too early
    } else if (hoursSinceCreation <= 24) {
      return 1.0; // Optimal
    } else if (hoursSinceCreation <= 72) {
      return 0.7; // Still good
    } else {
      return 0.3; // Too late
    }
  }

  private calculatePlatformSynergy(socialMetrics: any[]): number {
    if (!socialMetrics || socialMetrics.length === 0) return 0;

    // Calculate how well the trend is performing across different platforms
    const platformScores = socialMetrics.map(metric => {
      return metric.engagement || 0;
    });

    const averageScore = platformScores.reduce((sum, score) => sum + score, 0) / platformScores.length;
    const variance = platformScores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / platformScores.length;

    // Lower variance = higher synergy
    const synergy = 1 - (variance / Math.pow(averageScore + 0.01, 2));
    return Math.max(0, Math.min(synergy, 1));
  }

  private calculateContentQuality(content: string): number {
    if (!content) return 0.5;

    // Simple content quality assessment
    const length = content.length;
    const wordCount = content.split(' ').length;
    const sentences = content.split(/[.!?]+/).length;

    // Quality factors
    const lengthScore = Math.min(length / 500, 1); // Prefer 500+ characters
    const wordCountScore = Math.min(wordCount / 100, 1); // Prefer 100+ words
    const sentenceScore = Math.min(sentences / 10, 1); // Prefer 10+ sentences

    return (lengthScore + wordCountScore + sentenceScore) / 3;
  }

  private normalizeTimestamp(timestamp: string): number {
    const now = new Date();
    const created = new Date(timestamp);
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    // Normalize to 0-1 range (consider 30 days as max)
    return Math.min(hoursSinceCreation / (30 * 24), 1);
  }

  private async getTrainingData(): Promise<TrainingData> {
    // Get training data from database or cache
    // This would typically pull historical trend data with known outcomes
    const cachedData = await this.redis.get('virality-prediction:training-data');

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // Return empty if no training data available
    return {
      features: [],
      labels: [],
      metadata: {},
    };
  }

  private prepareTrainingData(trainingData: TrainingData): { xTrain: tf.Tensor; yTrain: tf.Tensor } {
    const xTrain = tf.tensor2d(trainingData.features);
    const yTrain = tf.tensor2d(trainingData.labels.map(label => [label / 100])); // Normalize to 0-1

    return { xTrain, yTrain };
  }

  private async trainNeuralNetwork(model: tf.LayersModel, xTrain: tf.Tensor, yTrain: tf.Tensor): Promise<void> {
    await model.fit(xTrain, yTrain, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            this.logger.debug(`Epoch ${epoch}: loss = ${logs.loss}, accuracy = ${logs.accuracy}`);
          }
        },
      },
    });
  }

  private async evaluateModel(model: tf.LayersModel, trainingData: TrainingData): Promise<{ loss: number; accuracy: number }> {
    const { xTrain, yTrain } = this.prepareTrainingData(trainingData);
    const evaluation = model.evaluate(xTrain, yTrain) as tf.Scalar[];

    const loss = await evaluation[0].data();
    const accuracy = await evaluation[1].data();

    return {
      loss: loss[0],
      accuracy: accuracy[0],
    };
  }

  private async saveModel(): Promise<void> {
    if (!this.model) return;

    try {
      const modelData = await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
        return JSON.stringify(artifacts);
      }));

      await this.redis.set('virality-prediction:model', JSON.stringify(modelData));
      this.logger.log('Virality prediction model saved');
    } catch (error) {
      this.logger.error('Error saving model:', error);
    }
  }

  private async cachePrediction(trendId: string, prediction: ViralityPrediction): Promise<void> {
    await this.redis.setex(
      `virality-prediction:${trendId}`,
      300, // Cache for 5 minutes
      JSON.stringify(prediction)
    );
  }

  private getFallbackPrediction(trend: any, socialMetrics: any[]): ViralityPrediction {
    // Simple rule-based fallback prediction
    const mentions = socialMetrics.reduce((sum, metric) => sum + (metric.mentions || 0), 0);
    const engagement = socialMetrics.reduce((sum, metric) => sum + (metric.engagement || 0), 0) / (socialMetrics.length || 1);

    const score = Math.min((mentions / 10000) * 50 + engagement * 30, 100);

    return {
      score,
      confidence: 0.5,
      predictedLifespan: 24 + (score / 100) * 48,
      growthRate: score / 100 * 0.1,
      peakTime: new Date(Date.now() + (score / 100) * 24 * 60 * 60 * 1000),
      decayRate: -0.1,
      影响因素: {
        socialEngagement: engagement * 100,
        contentQuality: 50,
        influencerImpact: 30,
        timingScore: 60,
        platformSynergy: 40,
      },
    };
  }

  private async getViralityTimeSeries(trendId: string, startTime: number, endTime: number): Promise<Array<any>> {
    const key = `virality-time-series:${trendId}`;
    const timeSeries = await this.redis.zrangebyscore(
      key,
      startTime,
      endTime,
      'WITHSCORES'
    );

    const result = [];
    for (let i = 0; i < timeSeries.length; i += 2) {
      result.push({
        timestamp: new Date(parseInt(timeSeries[i + 1], 10)).toISOString(),
        score: parseFloat(timeSeries[i]),
        volume: 0, // Would need to fetch from market data
        engagement: 0, // Would need to fetch from social metrics
      });
    }

    return result;
  }

  private determineTrendDirection(velocity: number): 'UP' | 'DOWN' | 'STABLE' {
    const threshold = 1; // 1 point threshold
    if (velocity > threshold) return 'UP';
    if (velocity < -threshold) return 'DOWN';
    return 'STABLE';
  }

  private calculateAcceleration(timeSeries: any[]): number {
    if (timeSeries.length < 3) return 0;

    const recent = timeSeries.slice(-3);
    const velocity1 = recent[1].score - recent[0].score;
    const velocity2 = recent[2].score - recent[1].score;

    return velocity2 - velocity1;
  }

  private calculateMomentum(timeSeries: any[]): number {
    if (timeSeries.length < 2) return 0;

    const weights = timeSeries.map((_, index) => (index + 1) / timeSeries.length);
    const scores = timeSeries.map(item => item.score);

    const weightedSum = weights.reduce((sum, weight, index) => sum + weight * scores[index], 0);
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

    return weightedSum / weightSum;
  }
}