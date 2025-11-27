import { Injectable, Logger } from '@nestjs/common';
import { OracleRequestDto } from '../dto/oracle-request.dto';
import { ConsensusResult, ValidatorResponse } from '../interfaces/consensus-result.interface';

@Injectable()
export class ConsensusService {
  private readonly logger = new Logger(ConsensusService.name);
  private readonly validators = ['validator-node-1', 'validator-node-2', 'validator-node-3'];
  private readonly requiredAgreement = 0.67; // 2/3 consensus required
  private readonly maxVariance = 0.02; // Maximum 2% variance allowed
  private readonly processingTimeout = 5000; // 5 seconds timeout

  async distributeToValidators(request: OracleRequestDto): Promise<ValidatorResponse[]> {
    this.logger.log(`Distributing request to ${this.validators.length} validators for trend: ${request.trendId}`);

    const promises = this.validators.map(validatorId =>
      this.callValidatorWithTimeout(validatorId, request)
    );

    const results = await Promise.allSettled(promises);
    const responses: ValidatorResponse[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
        this.logger.log(`Received response from ${this.validators[index]}`);
      } else {
        this.logger.error(`Failed to get response from ${this.validators[index]}:`, result.reason);
      }
    });

    if (responses.length < 2) {
      throw new Error(`Insufficient validator responses: ${responses.length}/${this.validators.length}`);
    }

    return responses;
  }

  async achieveConsensus(responses: ValidatorResponse[]): Promise<ConsensusResult> {
    this.logger.log(`Achieving consensus from ${responses.length} responses`);

    if (responses.length < 2) {
      throw new Error(`Insufficient responses for consensus: ${responses.length}`);
    }

    // Extract scores and calculate statistics
    const scores = responses.map(r => r.data.viralityScore);
    const confidences = responses.map(r => r.data.confidence);

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Calculate variance and standard deviation
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgScore;

    // Filter responses within acceptable range
    const acceptableRange = avgScore * this.maxVariance;
    const agreedResponses = responses.filter(r =>
      Math.abs(r.data.viralityScore - avgScore) <= acceptableRange
    );

    const agreementRatio = agreedResponses.length / responses.length;

    this.logger.log(`Consensus analysis: avg=${avgScore.toFixed(4)}, std=${stdDev.toFixed(4)}, agreement=${agreementRatio.toFixed(2)}`);

    if (agreementRatio < this.requiredAgreement) {
      throw new Error(
        `Insufficient consensus: ${agreementRatio.toFixed(2)} < ${this.requiredAgreement}. ` +
        `Scores: [${scores.map(s => s.toFixed(4)).join(', ')}]`
      );
    }

    // Calculate weighted average based on validator confidence
    const weightedScore = agreedResponses.reduce((acc, response) =>
      acc + (response.data.viralityScore * response.data.confidence), 0
    ) / agreedResponses.reduce((acc, response) => acc + response.data.confidence, 0);

    // Calculate consensus strength (higher when lower variance)
    const consensusStrength = Math.max(0, 1 - coefficientOfVariation);

    const consensusResult: ConsensusResult = {
      trendId: responses[0].request.trendId,
      score: this.roundToPrecision(weightedScore, 4),
      confidence: this.roundToPrecision(avgConfidence, 4),
      timestamp: Date.now(),
      agreement: this.roundToPrecision(agreementRatio, 2),
      consensusStrength: this.roundToPrecision(consensusStrength, 4),
      validatorResponses: agreedResponses,
    };

    this.logger.log(`Consensus achieved: score=${consensusResult.score}, strength=${consensusResult.consensusStrength}`);
    return consensusResult;
  }

  private async callValidatorWithTimeout(validatorId: string, request: OracleRequestDto): Promise<ValidatorResponse> {
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        this.callValidator(validatorId, request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Validator timeout')), this.processingTimeout)
        )
      ]);

      response.processingTime = Date.now() - startTime;
      return response;
    } catch (error) {
      throw new Error(`Validator ${validatorId} failed: ${error.message}`);
    }
  }

  private async callValidator(validatorId: string, request: OracleRequestDto): Promise<ValidatorResponse> {
    // Simulate network latency and processing time
    const processingTime = 200 + Math.random() * 800; // 200-1000ms
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Generate realistic virality score based on trend ID (for consistency)
    const seed = this.hashString(request.trendId + validatorId);
    const baseScore = 0.6 + (seed % 40) / 100; // 0.6-1.0 range
    const variance = (Math.random() - 0.5) * 0.1; // ±0.05 variance
    const viralityScore = Math.max(0, Math.min(1, baseScore + variance));

    // Generate confidence based on processing time and score stability
    const baseConfidence = 0.8 + (seed % 15) / 100; // 0.8-0.95 range
    const confidenceFactor = Math.min(1, 1000 / processingTime); // Faster processing = higher confidence
    const confidence = Math.max(0.5, Math.min(1, baseConfidence * confidenceFactor));

    const response: ValidatorResponse = {
      validatorId,
      request,
      data: {
        viralityScore: this.roundToPrecision(viralityScore, 4),
        confidence: this.roundToPrecision(confidence, 4),
        timestamp: Date.now(),
        processingTime,
        validatorMetadata: {
          version: '1.0.0',
          model: 'sentiment-v2',
          dataSources: ['twitter', 'tiktok', 'instagram'],
        },
      },
      signature: '',
      processingTime,
    };

    // Generate signature
    response.signature = this.generateSignature(response);

    return response;
  }

  private generateSignature(response: ValidatorResponse): string {
    const crypto = require('crypto');
    const dataToSign = JSON.stringify({
      validatorId: response.validatorId,
      viralityScore: response.data.viralityScore,
      confidence: response.data.confidence,
      timestamp: response.data.timestamp,
    });

    return crypto.createHash('sha256')
      .update(dataToSign + response.validatorId)
      .digest('hex');
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private roundToPrecision(num: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }

  async getValidatorHealth(): Promise<any> {
    const healthChecks = await Promise.allSettled(
      this.validators.map(validatorId => this.checkValidatorHealth(validatorId))
    );

    const results = this.validators.map((validatorId, index) => ({
      validatorId,
      healthy: healthChecks[index].status === 'fulfilled',
      responseTime: healthChecks[index].status === 'fulfilled' ? healthChecks[index].value : null,
      lastSeen: Date.now(),
    }));

    return {
      totalValidators: this.validators.length,
      healthyValidators: results.filter(r => r.healthy).length,
      validators: results,
      consensusRequired: this.requiredAgreement,
      maxVariance: this.maxVariance,
    };
  }

  private async checkValidatorHealth(validatorId: string): Promise<number> {
    // Simulate health check
    const responseTime = 50 + Math.random() * 200;
    await new Promise(resolve => setTimeout(resolve, responseTime));
    return responseTime;
  }
}