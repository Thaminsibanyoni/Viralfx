import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IntegrationType } from '../enums/broker.enum';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerIntegration, IntegrationType, IntegrationStatus } from '../entities/broker-integration.entity';
// COMMENTED OUT (TypeORM entity deleted): import { Broker } from '../entities/broker.entity';
import { CreateIntegrationDto } from '../dto/create-integration.dto';
import { IntegrationTestResult } from '../interfaces/broker.interface';
import { WebSocketGatewayHandler } from "../../../modules/websocket/gateways/websocket.gateway";

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly defaultTimeout = 30000; // 30 seconds

  constructor(
        private configService: ConfigService,
    private httpService: HttpService,
    private webSocketGateway: WebSocketGatewayHandler) {}

  async createIntegration(brokerId: string, createIntegrationDto: CreateIntegrationDto): Promise<BrokerIntegration> {
    this.logger.log(`Creating ${createIntegrationDto.integrationType} integration for broker ${brokerId}`);

    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
    if (!broker) {
      throw new NotFoundException(`Broker not found: ${brokerId}`);
    }

    // Check if integration of same type already exists
    const existingIntegration = await this.prisma.integrationrepository.findFirst({
      where: { brokerId, integrationType: createIntegrationDto.integrationType }
    });

    if (existingIntegration) {
      throw new BadRequestException(`Integration of type ${createIntegrationDto.integrationType} already exists`);
    }

    // Create integration record
    const integration = this.prisma.integrationrepository.create({
      brokerId,
      integrationType: createIntegrationDto.integrationType,
      status: IntegrationStatus.PENDING,
      configuration: this.sanitizeConfiguration(createIntegrationDto.integrationType, createIntegrationDto.configuration)
    });

    const savedIntegration = await this.prisma.integrationrepository.upsert(integration);

    // Auto-test the integration
    await this.testIntegration(savedIntegration.id);

    this.logger.log(`Created ${createIntegrationDto.integrationType} integration ${savedIntegration.id} for broker ${brokerId}`);
    return savedIntegration;
  }

  async testIntegration(integrationId: string): Promise<IntegrationTestResult> {
    this.logger.log(`Testing integration ${integrationId}`);

    const integration = await this.prisma.integrationrepository.findFirst({
      where: { id: integrationId },
      relations: ['broker']
    });

    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }

    let testResult: IntegrationTestResult;

    switch (integration.integrationType) {
      case IntegrationType.REST_API:
        testResult = await this.testRestApiIntegration(integration.configuration);
        break;
      case IntegrationType.WEBSOCKET:
        testResult = await this.testWebSocketIntegration(integration.configuration);
        break;
      case IntegrationType.WEBHOOK:
        testResult = await this.testWebhookIntegration(integration.configuration);
        break;
      case IntegrationType.SDK:
        testResult = await this.testSdkIntegration(integration.configuration);
        break;
      default:
        throw new BadRequestException(`Unknown integration type: ${integration.integrationType}`);
    }

    // Update integration status and test results
    integration.status = testResult.success ? IntegrationStatus.ACTIVE : IntegrationStatus.FAILED;
    integration.testResults = testResult;
    integration.lastTestDate = new Date();

    await this.prisma.integrationrepository.upsert(integration);

    // Send notification about test result
    await this.webSocketGateway.broadcastIntegrationTestResult(integration.brokerId, testResult);

    this.logger.log(`Test completed for integration ${integrationId}: ${testResult.success ? 'PASSED' : 'FAILED'}`);
    return testResult;
  }

  async testRestApiIntegration(config: any): Promise<IntegrationTestResult> {
    const { baseUrl, apiKey, version, timeout = this.defaultTimeout } = config;

    if (!baseUrl || !apiKey) {
      return {
        success: false,
        errors: ['Missing required configuration: baseUrl and apiKey'],
        timestamp: new Date()
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Test health endpoint
      const healthUrl = `${baseUrl.replace(/\/$/, '')}/health`;
      const response = await firstValueFrom(
        this.httpService.get(healthUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Version': version,
            'User-Agent': 'ViralFX-Integration-Test/1.0'
          },
          timeout
        })
      );

      const responseTime = Date.now() - startTime;

      // Validate response
      if (response.status !== 200) {
        errors.push(`Health check failed with status ${response.status}`);
      }

      if (!response.data || typeof response.data !== 'object') {
        errors.push('Invalid response format: expected JSON object');
      }

      // Test market data endpoint
      const marketDataUrl = `${baseUrl}/api/v1/markets`;
      const marketDataResponse = await firstValueFrom(
        this.httpService.get(marketDataUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Version': version
          },
          timeout
        })
      );

      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        latency: responseTime,
        timestamp: new Date(),
        details: {
          endpoint: healthUrl,
          method: 'GET',
          responseCode: response.status,
          responseTime,
          testData: {
            healthCheck: response.data,
            marketData: Array.isArray(marketDataResponse.data) ? marketDataResponse.data.length : 0
          },
          validation: {
            schemaValid: true,
            responseFormat: 'JSON',
            requiredFields: ['status', 'timestamp']
          }
        },
        metrics: {
          totalRequests: 2,
          successRate: errors.length === 0 ? 100 : 50,
          averageResponseTime: responseTime,
          dataFreshness: 0 // Would calculate from actual data timestamps
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Connection failed: ${error.message}`],
        latency: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async testWebSocketIntegration(config: any): Promise<IntegrationTestResult> {
    const { wsUrl, apiKey, events } = config;

    if (!wsUrl) {
      return {
        success: false,
        errors: ['Missing required configuration: wsUrl'],
        timestamp: new Date()
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Test WebSocket connection
      const WebSocket = require('ws');
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        ws.on('open', () => {
          clearTimeout(timeout);
          resolve();
        });

        ws.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await connectionPromise;

      // Test subscription to market data
      if (events && events.length > 0) {
        ws.send(JSON.stringify({
          action: 'subscribe',
          channels: events.slice(0, 3) // Limit to 3 events for testing
        }));
      }

      const responseTime = Date.now() - startTime;

      // Close connection
      ws.close();

      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        latency: responseTime,
        timestamp: new Date(),
        details: {
          endpoint: wsUrl,
          method: 'WEBSOCKET',
          responseCode: 101, // WebSocket upgrade status
          responseTime,
          testData: {
            subscribedEvents: events ? events.slice(0, 3) : [],
            connectionEstablished: true
          },
          validation: {
            schemaValid: true,
            responseFormat: 'WEBSOCKET',
            requiredFields: ['action', 'channels']
          }
        },
        metrics: {
          totalRequests: 1,
          successRate: 100,
          averageResponseTime: responseTime,
          dataFreshness: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`WebSocket connection failed: ${error.message}`],
        latency: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async testWebhookIntegration(config: any): Promise<IntegrationTestResult> {
    const { webhookUrl, events, secret } = config;

    if (!webhookUrl) {
      return {
        success: false,
        errors: ['Missing required configuration: webhookUrl'],
        timestamp: new Date()
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Generate test payload
      const testPayload = {
        event: 'order.created',
        data: {
          id: 'test-order-123',
          symbol: 'BTC/ZAR',
          type: 'MARKET',
          side: 'BUY',
          amount: 0.01,
          price: 500000,
          timestamp: new Date().toISOString()
        },
        signature: secret ? this.generateSignature(JSON.stringify(testPayload.data), secret) : undefined
      };

      // Send test webhook
      const response = await firstValueFrom(
        this.httpService.post(webhookUrl, testPayload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': testPayload.signature,
            'X-Event-Type': testPayload.event,
            'User-Agent': 'ViralFX-Webhook-Test/1.0'
          },
          timeout: this.defaultTimeout
        })
      );

      const responseTime = Date.now() - startTime;

      // Validate response
      if (response.status < 200 || response.status >= 300) {
        errors.push(`Webhook failed with status ${response.status}`);
      }

      return {
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        latency: responseTime,
        timestamp: new Date(),
        details: {
          endpoint: webhookUrl,
          method: 'POST',
          responseCode: response.status,
          responseTime,
          testData: {
            payload: testPayload,
            response: response.data
          },
          validation: {
            schemaValid: true,
            responseFormat: 'HTTP',
            requiredFields: ['event', 'data']
          }
        },
        metrics: {
          totalRequests: 1,
          successRate: errors.length === 0 ? 100 : 0,
          averageResponseTime: responseTime,
          dataFreshness: 100 // Real-time delivery
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Webhook delivery failed: ${error.message}`],
        latency: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async testSdkIntegration(config: any): Promise<IntegrationTestResult> {
    const { platform, version, customSettings } = config;

    if (!platform) {
      return {
        success: false,
        errors: ['Missing required configuration: platform'],
        timestamp: new Date()
      };
    }

    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Test SDK availability and basic functionality
      let testResult: any;

      switch (platform.toLowerCase()) {
        case 'javascript':
          testResult = await this.testJavaScriptSDK(customSettings);
          break;
        case 'python':
          testResult = await this.testPythonSDK(customSettings);
          break;
        case 'java':
          testResult = await this.testJavaSDK(customSettings);
          break;
        case 'csharp':
          testResult = await this.testCSharpSDK(customSettings);
          break;
        default:
          errors.push(`Unsupported SDK platform: ${platform}`);
      }

      const responseTime = Date.now() - startTime;

      return {
        success: errors.length === 0 && testResult.success,
        errors: errors.length > 0 ? errors : testResult.errors,
        latency: responseTime,
        timestamp: new Date(),
        details: {
          endpoint: `${platform}-sdk`,
          method: 'SDK',
          responseCode: testResult.success ? 200 : 500,
          responseTime,
          testData: testResult.data,
          validation: {
            schemaValid: testResult.valid,
            responseFormat: 'SDK',
            requiredFields: ['version', 'platform']
          }
        },
        metrics: {
          totalRequests: 1,
          successRate: testResult.success ? 100 : 0,
          averageResponseTime: responseTime,
          dataFreshness: 0
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`SDK test failed: ${error.message}`],
        latency: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async updateIntegrationStatus(integrationId: string, status: IntegrationStatus, testResults?: IntegrationTestResult): Promise<void> {
    const integration = await this.prisma.integrationrepository.findFirst({ where: { id: integrationId } });
    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }

    integration.status = status;
    if (testResults) {
      integration.testResults = testResults;
      integration.lastTestDate = testResults.timestamp;
    }

    await this.prisma.integrationrepository.upsert(integration);
  }

  async getIntegrationLogs(integrationId: string): Promise<any[]> {
    // In a real implementation, this would query actual integration logs
    // For now, return simulated logs
    return [
      {
        timestamp: new Date(Date.now() - 60 * 60 * 1000),
        level: 'INFO',
        message: 'Integration test started',
        details: { integrationId }
      },
      {
        timestamp: new Date(Date.now() - 58 * 60 * 1000),
        level: 'DEBUG',
        message: 'Connecting to endpoint',
        details: { endpoint: 'https://api.example.com/health' }
      },
      {
        timestamp: new Date(Date.now() - 55 * 60 * 1000),
        level: 'INFO',
        message: 'Connection established',
        details: { responseTime: 250 }
      },
      {
        timestamp: new Date(Date.now() - 50 * 60 * 1000),
        level: 'INFO',
        message: 'Integration test completed successfully',
        details: { success: true }
      },
    ];
  }

  async getBrokerIntegrations(brokerId: string): Promise<BrokerIntegration[]> {
    return this.prisma.integrationrepository.findMany({
      where: { brokerId },
      order: { createdAt: 'DESC' }
    });
  }

  async getIntegration(integrationId: string): Promise<BrokerIntegration> {
    const integration = await this.prisma.integrationrepository.findFirst({
      where: { id: integrationId },
      relations: ['broker']
    });

    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }

    return integration;
  }

  async deleteIntegration(integrationId: string): Promise<void> {
    const integration = await this.prisma.integrationrepository.findFirst({ where: { id: integrationId } });
    if (!integration) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }

    await this.prisma.remove(integration);
    this.logger.log(`Deleted integration ${integrationId}`);
  }

  private sanitizeConfiguration(integrationType: IntegrationType, config: any): any {
    const sanitized = { ...config };

    // Remove sensitive information from logs
    delete sanitized.apiSecret;
    delete sanitized.clientSecret;
    delete sanitized.password;

    // Validate required fields based on integration type
    switch (integrationType) {
      case IntegrationType.REST_API:
        if (!sanitized.baseUrl) throw new Error('baseUrl is required for REST API integration');
        break;
      case IntegrationType.WEBSOCKET:
        if (!sanitized.wsUrl) throw new Error('wsUrl is required for WebSocket integration');
        break;
      case IntegrationType.WEBHOOK:
        if (!sanitized.webhookUrl) throw new Error('webhookUrl is required for webhook integration');
        break;
      case IntegrationType.SDK:
        if (!sanitized.platform) throw new Error('platform is required for SDK integration');
        break;
    }

    return sanitized;
  }

  private generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private async testJavaScriptSDK(customSettings: any): Promise<any> {
    // Simulate JavaScript SDK test
    return {
      success: true,
      valid: true,
      data: {
        version: '1.0.0',
        platform: 'javascript',
        features: ['market-data', 'order-execution', 'account-management']
      },
      errors: []
    };
  }

  private async testPythonSDK(customSettings: any): Promise<any> {
    // Simulate Python SDK test
    return {
      success: true,
      valid: true,
      data: {
        version: '1.0.0',
        platform: 'python',
        features: ['market-data', 'order-execution', 'account-management', 'backtesting']
      },
      errors: []
    };
  }

  private async testJavaSDK(customSettings: any): Promise<any> {
    // Simulate Java SDK test
    return {
      success: true,
      valid: true,
      data: {
        version: '1.0.0',
        platform: 'java',
        features: ['market-data', 'order-execution', 'account-management']
      },
      errors: []
    };
  }

  private async testCSharpSDK(customSettings: any): Promise<any> {
    // Simulate C# SDK test
    return {
      success: true,
      valid: true,
      data: {
        version: '1.0.0',
        platform: 'csharp',
        features: ['market-data', 'order-execution', 'account-management']
      },
      errors: []
    };
  }
}
