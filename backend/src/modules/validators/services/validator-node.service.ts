import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ValidatorNode, ValidatorStatus } from '../../oracle/entities/validator-node.entity';
import * as crypto from 'crypto';

@Injectable()
export class ValidatorNodeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ValidatorNodeService.name);
  private readonly validatorId: string;
  private readonly validatorKey: string;
  private readonly port: number;
  private httpServer: any;
  private isHealthy = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ValidatorNode)
    private readonly validatorNodeRepository: Repository<ValidatorNode>,
  ) {
    this.validatorId = this.configService.get<string>('VALIDATOR_ID', 'unknown-validator');
    this.validatorKey = this.configService.get<string>('VALIDATOR_KEY', 'default-key');
    this.port = parseInt(this.configService.get<string>('VALIDATOR_PORT', '3000'));
  }

  async onModuleInit() {
    this.logger.log(`🚀 Starting validator node: ${this.validatorId} on port ${this.port}`);

    // Register this validator in the database
    await this.registerValidator();

    // Start HTTP server for health checks and API
    await this.startHttpServer();

    this.logger.log(`✅ Validator node ${this.validatorId} is ready`);
    this.isHealthy = true;
  }

  async onModuleDestroy() {
    this.logger.log(`🛑 Shutting down validator node: ${this.validatorId}`);
    this.isHealthy = false;

    if (this.httpServer) {
      this.httpServer.close();
    }

    // Update validator status to offline
    await this.updateValidatorStatus(ValidatorStatus.OFFLINE);
  }

  @Interval(30000) // Every 30 seconds
  async heartbeatCheck() {
    if (!this.isHealthy) return;

    try {
      await this.updateValidatorStatus(ValidatorStatus.ONLINE);
      this.logger.debug(`💓 Heartbeat sent from validator: ${this.validatorId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to send heartbeat:`, error.message);
    }
  }

  async processOracleRequest(request: any): Promise<any> {
    const startTime = Date.now();
    this.logger.log(`📨 Processing oracle request for trend: ${request.trendId}`);

    try {
      // Simulate processing time
      const processingTime = 200 + Math.random() * 800; // 200-1000ms
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Generate realistic virality score based on trend ID (for consistency)
      const seed = this.hashString(request.trendId + this.validatorId);
      const baseScore = 0.6 + (seed % 40) / 100; // 0.6-1.0 range
      const variance = (Math.random() - 0.5) * 0.1; // ±0.05 variance
      const viralityScore = Math.max(0, Math.min(1, baseScore + variance));

      // Generate confidence based on processing time and score stability
      const baseConfidence = 0.8 + (seed % 15) / 100; // 0.8-0.95 range
      const confidenceFactor = Math.min(1, 1000 / processingTime); // Faster processing = higher confidence
      const confidence = Math.max(0.5, Math.min(1, baseConfidence * confidenceFactor));

      const response = {
        validatorId: this.validatorId,
        request,
        data: {
          viralityScore: this.roundToPrecision(viralityScore, 4),
          confidence: this.roundToPrecision(confidence, 4),
          timestamp: Date.now(),
          processingTime: Date.now() - startTime,
          validatorMetadata: {
            version: '1.0.0',
            model: 'sentiment-v2',
            dataSources: ['twitter', 'tiktok', 'instagram'],
            nodeId: this.validatorId,
          },
        },
        signature: '',
        processingTime: Date.now() - startTime,
      };

      // Generate signature
      response.signature = this.generateSignature(response);

      // Update validator statistics
      await this.updateValidatorStats(response.processingTime, true);

      this.logger.log(`✅ Request processed: score=${response.data.viralityScore.toFixed(4)}, time=${response.processingTime}ms`);
      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      await this.updateValidatorStats(processingTime, false);

      this.logger.error(`❌ Failed to process request for trend: ${request.trendId}`, error.message);
      throw error;
    }
  }

  private async registerValidator(): Promise<void> {
    try {
      const existingValidator = await this.validatorNodeRepository.findOne({
        where: { nodeId: this.validatorId }
      });

      const validatorData = {
        nodeId: this.validatorId,
        endpoint: `http://localhost:${this.port}`,
        publicKey: this.generatePublicKey(),
        version: '1.0.0',
        status: ValidatorStatus.ONLINE,
        lastSeen: new Date(),
      };

      if (existingValidator) {
        await this.validatorNodeRepository.update(
          { id: existingValidator.id },
          validatorData
        );
        this.logger.log(`📝 Updated existing validator: ${this.validatorId}`);
      } else {
        await this.validatorNodeRepository.save({
          ...validatorData,
          reputationScore: 1.0,
          totalRequests: 0,
          successfulRequests: 0,
        });
        this.logger.log(`🆕 Registered new validator: ${this.validatorId}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to register validator:`, error.message);
      throw error;
    }
  }

  private async updateValidatorStatus(status: ValidatorStatus): Promise<void> {
    try {
      await this.validatorNodeRepository.update(
        { nodeId: this.validatorId },
        {
          status,
          lastSeen: new Date(),
        }
      );
    } catch (error) {
      this.logger.error(`❌ Failed to update validator status:`, error.message);
    }
  }

  private async updateValidatorStats(processingTime: number, success: boolean): Promise<void> {
    try {
      const validator = await this.validatorNodeRepository.findOne({
        where: { nodeId: this.validatorId }
      });

      if (validator) {
        const totalRequests = validator.totalRequests + 1;
        const successfulRequests = validator.successfulRequests + (success ? 1 : 0);
        const successRate = successfulRequests / totalRequests;

        // Update average response time
        const currentAvgTime = validator.averageResponseTime || 0;
        const newAvgTime = (currentAvgTime * validator.totalRequests + processingTime) / totalRequests;

        // Update reputation based on success rate and response time
        const reputationScore = this.calculateReputation(successRate, newAvgTime);

        await this.validatorNodeRepository.update(
          { id: validator.id },
          {
            totalRequests,
            successfulRequests,
            averageResponseTime: newAvgTime,
            reputationScore,
            responseTime: processingTime,
          }
        );
      }
    } catch (error) {
      this.logger.error(`❌ Failed to update validator stats:`, error.message);
    }
  }

  private calculateReputation(successRate: number, avgResponseTime: number): number {
    // Reputation based on success rate (70%) and response time (30%)
    const successScore = successRate;
    const timeScore = Math.max(0, 1 - (avgResponseTime - 200) / 1000); // Penalize slow responses

    return Math.round((successScore * 0.7 + timeScore * 0.3) * 100) / 100;
  }

  private async startHttpServer(): Promise<void> {
    const express = require('express');
    const app = express();

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        validatorId: this.validatorId,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Validator info endpoint
    app.get('/info', (req, res) => {
      res.json({
        validatorId: this.validatorId,
        version: '1.0.0',
        status: 'online',
        capabilities: ['virality', 'sentiment', 'consensus'],
      });
    });

    // Process oracle request endpoint
    app.post('/process', express.json(), async (req, res) => {
      try {
        const result = await this.processOracleRequest(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: error.message,
          validatorId: this.validatorId,
        });
      }
    });

    return new Promise((resolve, reject) => {
      this.httpServer = app.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          this.logger.log(`🌐 HTTP server listening on port ${this.port}`);
          resolve(null);
        }
      });
    });
  }

  private generateSignature(response: any): string {
    const dataToSign = JSON.stringify({
      validatorId: response.validatorId,
      viralityScore: response.data.viralityScore,
      confidence: response.data.confidence,
      timestamp: response.data.timestamp,
    });

    return crypto.createHash('sha256')
      .update(dataToSign + this.validatorKey)
      .digest('hex');
  }

  private generatePublicKey(): string {
    return crypto.createHash('sha256')
      .update(this.validatorId + this.validatorKey)
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

  async getValidatorMetrics(): Promise<any> {
    const validator = await this.validatorNodeRepository.findOne({
      where: { nodeId: this.validatorId }
    });

    return {
      validatorId: this.validatorId,
      isHealthy: this.isHealthy,
      uptime: process.uptime(),
      metrics: validator ? {
        totalRequests: validator.totalRequests,
        successfulRequests: validator.successfulRequests,
        successRate: validator.totalRequests > 0 ? validator.successfulRequests / validator.totalRequests : 0,
        averageResponseTime: validator.averageResponseTime,
        reputationScore: validator.reputationScore,
        lastSeen: validator.lastSeen,
      } : null,
    };
  }
}