import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { VPMXCoreService } from "./vpmx-core.service";

@Injectable()
export class VPMXPredictionService {
  private readonly logger = new Logger(VPMXPredictionService.name);
  private readonly MODEL_CACHE_TTL = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly vpmxCoreService: VPMXCoreService) {}

  /**
   * Generate VPMX prediction using specified model
   */
  async generatePrediction(
    vtsSymbol: string,
    horizon: string,
    modelType: string,
    parameters?: any): Promise<any> {
    try {
      this.logger.log(`Generating ${horizon} prediction for ${vtsSymbol} using ${modelType}`);

      // Get historical data for prediction
      const historicalData = await this.vpmxCoreService.getVPMXHistory(
        vtsSymbol,
        '15m',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
        new Date(),
        500
      );

      if (historicalData.length < 50) {
        throw new Error('Insufficient historical data for prediction');
      }

      // Generate prediction based on model type
      let prediction;
      switch (modelType.toUpperCase()) {
        case 'LSTM':
          prediction = await this.predictWithLSTM(vtsSymbol, historicalData, horizon, parameters);
          break;
        case 'CNN':
          prediction = await this.predictWithCNN(vtsSymbol, historicalData, horizon, parameters);
          break;
        case 'TRANSFORMER':
          prediction = await this.predictWithTransformer(vtsSymbol, historicalData, horizon, parameters);
          break;
        case 'ENSEMBLE':
          prediction = await this.predictWithEnsemble(vtsSymbol, historicalData, horizon, parameters);
          break;
        default:
          prediction = await this.predictWithLinearRegression(vtsSymbol, historicalData, horizon);
      }

      // Calculate confidence bounds
      const confidence = this.calculatePredictionConfidence(historicalData, prediction);
      const bounds = this.calculateConfidenceBounds(prediction.predictedValue, confidence);

      // Save prediction to database
      const savedPrediction = await this.savePrediction({
        vtsSymbol,
        modelType,
        horizon,
        predictedValue: prediction.predictedValue,
        confidence,
        upperBound: bounds.upper,
        lowerBound: bounds.lower,
        features: prediction.features
      });

      return {
        id: savedPrediction.id,
        vtsSymbol,
        modelType,
        horizon,
        prediction: prediction.predictedValue,
        confidence,
        bounds,
        features: prediction.features,
        timestamp: savedPrediction.timestamp
      };
    } catch (error) {
      this.logger.error(`Failed to generate prediction for ${vtsSymbol}`, error);
      throw error;
    }
  }

  /**
   * Get predictions for a symbol
   */
  async getPredictions(
    vtsSymbol: string,
    horizon?: string,
    modelType?: string,
    limit = 50): Promise<any[]> {
    const where: any = { vtsSymbol };
    if (horizon) where.horizon = horizon;
    if (modelType) where.modelType = modelType;

    return await this.prisma.vpmxPrediction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  /**
   * Evaluate prediction accuracy
   */
  async evaluatePredictionAccuracy(
    vtsSymbol: string,
    modelType?: string,
    daysBack = 30): Promise<any> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const predictions = await this.prisma.vpmxPrediction.findMany({
      where: {
        vtsSymbol,
        ...(modelType && { modelType }),
        timestamp: { gte: cutoffDate },
        actualValue: { not: null }
      }
    });

    if (predictions.length === 0) {
      return {
        totalPredictions: 0,
        accuracy: 0,
        mae: 0,
        rmse: 0
      };
    }

    const accuracies = predictions.map(p => p.accuracy || 0);
    const errors = predictions.map(p => p.error || 0);

    const averageAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    const mae = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const rmse = Math.sqrt(errors.reduce((sum, err) => sum + err * err, 0) / errors.length);

    return {
      totalPredictions: predictions.length,
      accuracy: averageAccuracy,
      mae,
      rmse,
      modelType,
      daysBack
    };
  }

  // Private prediction methods

  private async predictWithLSTM(
    vtsSymbol: string,
    historicalData: any[],
    horizon: string,
    parameters?: any): Promise<any> {
    // LSTM implementation - sequence-based prediction
    const sequenceLength = parameters?.sequenceLength || 24;
    const values = historicalData.map(d => d.value).reverse();

    if (values.length < sequenceLength) {
      throw new Error('Insufficient data for LSTM sequence');
    }

    // Simulate LSTM prediction (in production, this would use TensorFlow/PyTorch)
    const recentSequence = values.slice(-sequenceLength);
    const trend = this.calculateTrend(recentSequence);
    const volatility = this.calculateVolatility(recentSequence);

    // Time horizon multiplier (hours)
    const horizonMultiplier = this.getHorizonMultiplier(horizon);

    const prediction = recentSequence[recentSequence.length - 1] +
      (trend * horizonMultiplier) +
      (Math.random() - 0.5) * volatility * 0.2;

    const features = {
      trend: Math.abs(trend),
      volatility,
      momentum: this.calculateMomentum(recentSequence),
      recentMean: recentSequence.reduce((sum, val) => sum + val, 0) / recentSequence.length
    };

    return {
      predictedValue: Math.max(0, Math.min(1000, prediction)),
      features: {
        ...features,
        sequenceLength,
        trendDirection: trend > 0 ? 'BULLISH' : 'BEARISH'
      }
    };
  }

  private async predictWithCNN(
    vtsSymbol: string,
    historicalData: any[],
    horizon: string,
    parameters?: any): Promise<any> {
    // CNN implementation - pattern recognition
    const windowSize = parameters?.windowSize || 12;
    const values = historicalData.map(d => d.value);

    // Extract local patterns
    const patterns = this.extractPatterns(values, windowSize);
    const dominantPattern = this.findDominantPattern(patterns);

    const prediction = this.extrapolatePattern(dominantPattern, horizon);

    return {
      predictedValue: Math.max(0, Math.min(1000, prediction)),
      features: {
        patternType: dominantPattern.type,
        patternStrength: dominantPattern.strength,
        windowSize
      }
    };
  }

  private async predictWithTransformer(
    vtsSymbol: string,
    historicalData: any[],
    horizon: string,
    parameters?: any): Promise<any> {
    // Transformer implementation - attention-based prediction
    const contextLength = parameters?.contextLength || 48;
    const values = historicalData.map(d => d.value).slice(-contextLength);

    // Simulate attention weights
    const attentionWeights = this.calculateAttentionWeights(values);
    const contextInfluence = this.applyAttention(values, attentionWeights);

    const prediction = this.transformerPredict(contextInfluence, horizon);

    return {
      predictedValue: Math.max(0, Math.min(1000, prediction)),
      features: {
        attentionWeights,
        contextInfluence,
        contextLength
      }
    };
  }

  private async predictWithEnsemble(
    vtsSymbol: string,
    historicalData: any[],
    horizon: string,
    parameters?: any): Promise<any> {
    // Ensemble of multiple models
    const models = ['LSTM', 'CNN', 'LINEAR'];
    const weights = parameters?.weights || [0.4, 0.3, 0.3];

    const predictions = [];

    for (let i = 0; i < models.length; i++) {
      try {
        const modelPrediction = await this.generatePrediction(
          vtsSymbol,
          horizon,
          models[i],
          parameters?.modelParams?.[models[i]]
        );
        predictions.push({
          value: modelPrediction.prediction,
          weight: weights[i],
          confidence: modelPrediction.confidence
        });
      } catch (error) {
        this.logger.warn(`Ensemble model ${models[i]} failed`, error);
        continue;
      }
    }

    if (predictions.length === 0) {
      throw new Error('All ensemble models failed');
    }

    // Weighted average with confidence adjustment
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight * p.confidence, 0);
    const weightedPrediction = predictions.reduce(
      (sum, p) => sum + p.value * p.weight * p.confidence,
      0
    ) / totalWeight;

    const averageConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    return {
      predictedValue: weightedPrediction,
      features: {
        ensembleModels: predictions.map(p => p.model),
        weights,
        modelAgreement: this.calculateModelAgreement(predictions)
      }
    };
  }

  private async predictWithLinearRegression(
    vtsSymbol: string,
    historicalData: any[],
    horizon: string): Promise<any> {
    // Simple linear regression as baseline
    const values = historicalData.map(d => d.value);
    const n = values.length;

    // Calculate linear regression coefficients
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * values[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const horizonSteps = this.getHorizonMultiplier(horizon);
    const prediction = slope * (n + horizonSteps) + intercept;

    return {
      predictedValue: Math.max(0, Math.min(1000, prediction)),
      features: {
        slope,
        intercept,
        rSquared: this.calculateRSquared(values, slope, intercept)
      }
    };
  }

  // Helper methods

  private calculateTrend(sequence: number[]): number {
    const n = sequence.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = sequence.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * sequence[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  }

  private calculateVolatility(sequence: number[]): number {
    const mean = sequence.reduce((sum, val) => sum + val, 0) / sequence.length;
    const variance = sequence.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sequence.length;
    return Math.sqrt(variance);
  }

  private calculateMomentum(sequence: number[]): number {
    if (sequence.length < 2) return 0;
    const recent = sequence.slice(-5);
    const older = sequence.slice(-10, -5);

    if (older.length === 0) return 0;

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    return (recentAvg - olderAvg) / olderAvg;
  }

  private getHorizonMultiplier(horizon: string): number {
    const multipliers: Record<string, number> = {
      '1h': 4,
      '6h': 24,
      '24h': 96,
      '7d': 672,
      '30d': 2880
    };
    return multipliers[horizon] || 24;
  }

  private extractPatterns(values: number[], windowSize: number): any[] {
    const patterns = [];
    for (let i = 0; i <= values.length - windowSize; i++) {
      const window = values.slice(i, i + windowSize);
      const pattern = this.analyzePattern(window);
      patterns.push(pattern);
    }
    return patterns;
  }

  private analyzePattern(window: number[]): any {
    const first = window[0];
    const last = window[window.length - 1];
    const change = (last - first) / first;

    let type = 'SIDEWAYS';
    if (change > 0.05) type = 'UPTREND';
    else if (change < -0.05) type = 'DOWNTREND';

    return { type, strength: Math.abs(change) };
  }

  private findDominantPattern(patterns: any[]): any {
    // Simple frequency-based pattern selection
    const frequency: Record<string, { count: number; totalStrength: number }> = {};

    patterns.forEach(pattern => {
      if (!frequency[pattern.type]) {
        frequency[pattern.type] = { count: 0, totalStrength: 0 };
      }
      frequency[pattern.type].count++;
      frequency[pattern.type].totalStrength += pattern.strength;
    });

    let dominantType = 'SIDEWAYS';
    let maxScore = 0;

    Object.entries(frequency).forEach(([type, data]) => {
      const score = data.count * (data.totalStrength / data.count);
      if (score > maxScore) {
        maxScore = score;
        dominantType = type;
      }
    });

    return {
      type: dominantType,
      strength: frequency[dominantType].totalStrength / frequency[dominantType].count
    };
  }

  private extrapolatePattern(pattern: any, horizon: string): number {
    const horizonMultiplier = this.getHorizonMultiplier(horizon);
    const baseChange = pattern.strength * 100 * (pattern.type === 'UPTREND' ? 1 : -1);
    return 500 + baseChange * horizonMultiplier / 24; // 500 as baseline
  }

  private calculateAttentionWeights(values: number[]): number[] {
    const n = values.length;
    const weights = [];

    for (let i = 0; i < n; i++) {
      // More recent values get higher attention
      const recencyWeight = (i + 1) / n;
      // Volatility-based attention
      const localVolatility = i > 0 ? Math.abs(values[i] - values[i-1]) : 0;
      const volatilityWeight = 1 + localVolatility / 10;

      weights.push(recencyWeight * volatilityWeight);
    }

    // Normalize
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum);
  }

  private applyAttention(values: number[], weights: number[]): number {
    return values.reduce((sum, val, i) => sum + val * weights[i], 0);
  }

  private transformerPredict(contextInfluence: number, horizon: string): number {
    const horizonMultiplier = this.getHorizonMultiplier(horizon);
    return contextInfluence + (Math.random() - 0.5) * 50 * Math.sqrt(horizonMultiplier);
  }

  private calculateModelAgreement(predictions: any[]): number {
    if (predictions.length < 2) return 1;

    const values = predictions.map(p => p.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    // Lower variance = higher agreement
    return Math.max(0, 1 - variance / 10000); // Normalize to 0-1
  }

  private calculateRSquared(values: number[], slope: number, intercept: number): number {
    const n = values.length;
    const predictions = values.map((_, i) => slope * i + intercept);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

    const totalSS = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
    const residualSS = values.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);

    return 1 - (residualSS / totalSS);
  }

  private calculatePredictionConfidence(historicalData: any[], prediction: any): number {
    const volatility = this.calculateVolatility(historicalData.map(d => d.value));
    const dataQuality = Math.min(1, historicalData.length / 500);

    // Lower volatility and more data = higher confidence
    return Math.max(0.1, Math.min(0.95, (1 - volatility / 1000) * dataQuality));
  }

  private calculateConfidenceBounds(prediction: number, confidence: number): { upper: number; lower: number } {
    const margin = (1 - confidence) * 200; // 200 as max margin
    return {
      upper: Math.min(1000, prediction + margin),
      lower: Math.max(0, prediction - margin)
    };
  }

  private async savePrediction(predictionData: any): Promise<any> {
    return await this.prisma.vpmxPrediction.create({
      data: predictionData
    });
  }
}
