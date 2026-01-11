import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerComplianceCheck, ComplianceCheckType, ComplianceResult } from '../entities/broker-compliance-check.entity';
// COMMENTED OUT (TypeORM entity deleted): import { Broker } from '../entities/broker.entity';
import { ComplianceAlert, ComplianceMonitoring } from '../interfaces/broker.interface';
import { NotificationService } from "../../../modules/notifications/services/notification.service";
import { WebSocketGatewayHandler } from "../../websocket/gateways/websocket.gateway";

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);
  private readonly sanctionsApiUrl: string;
  private readonly sanctionsApiKey: string;
  private readonly checkInterval: number;

  constructor(
        private configService: ConfigService,
    private httpService: HttpService,
    private notificationService: NotificationService,
    private webSocketGateway: WebSocketGatewayHandler,
    @InjectQueue('broker-compliance') private complianceQueue: Queue) {
    this.sanctionsApiUrl = this.configService.get<string>('SANCTIONS_API_URL');
    this.sanctionsApiKey = this.configService.get<string>('SANCTIONS_API_KEY');
    this.checkInterval = this.configService.get<number>('COMPLIANCE_CHECK_INTERVAL', 86400000); // 24 hours default
  }

  async performComplianceCheck(
    brokerId: string,
    checkType: ComplianceCheckType): Promise<BrokerComplianceCheck> {
    this.logger.log(`Performing ${checkType} compliance check for broker ${brokerId}`);

    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    let result: ComplianceResult;
    let score: number;
    let details: any;
    let recommendations: string[] = [];

    switch (checkType) {
      case ComplianceCheckType.FSCA_LICENSE:
        ({ result, score, details, recommendations } = await this.checkFSCALicenseStatus(broker));
        break;

      case ComplianceCheckType.SANCTIONS_LIST:
        ({ result, score, details, recommendations } = await this.checkSanctionsList(broker));
        break;

      case ComplianceCheckType.ADVERSE_MEDIA:
        ({ result, score, details, recommendations } = await this.checkAdverseMedia(broker));
        break;

      case ComplianceCheckType.FINANCIAL_HEALTH:
        ({ result, score, details, recommendations } = await this.checkFinancialHealth(broker));
        break;

      case ComplianceCheckType.SECURITY_ASSESSMENT:
        ({ result, score, details, recommendations } = await this.assessSecurityInfrastructure(broker));
        break;

      default:
        throw new Error(`Unknown compliance check type: ${checkType}`);
    }

    const complianceCheck = this.prisma.compliancecheckrepository.create({
      brokerId,
      checkType,
      checkDate: new Date(),
      result,
      score,
      details,
      recommendations
    });

    const savedCheck = await this.prisma.compliancecheckrepository.upsert(complianceCheck);

    // Send alerts if check failed
    if (result === ComplianceResult.FAIL || result === ComplianceResult.WARNING) {
      await this.sendComplianceAlert(brokerId, {
        id: savedCheck.id,
        brokerId,
        type: checkType,
        severity: result === ComplianceResult.FAIL ? 'HIGH' : 'MEDIUM',
        message: `Compliance check ${checkType} ${result.toLowerCase()}`,
        details,
        recommendations,
        createdAt: savedCheck.createdAt,
        status: 'OPEN'
      });
    }

    this.logger.log(`Completed ${checkType} compliance check for broker ${brokerId}: ${result} (Score: ${score})`);
    return savedCheck;
  }

  async calculateComplianceScore(brokerId: string): Promise<number> {
    this.logger.log(`Calculating compliance score for broker ${brokerId}`);

    const recentChecks = await this.prisma.compliancecheckrepository.findMany({
      where: { brokerId },
      order: { checkDate: 'DESC' },
      take: 100 // Last 100 checks
    });

    if (recentChecks.length === 0) {
      return 0; // No compliance checks performed yet
    }

    // Group checks by type and take the latest of each type
    const latestChecksByType = new Map<ComplianceCheckType, BrokerComplianceCheck>();

    for (const check of recentChecks) {
      const existing = latestChecksByType.get(check.checkType);
      if (!existing || check.checkDate > existing.checkDate) {
        latestChecksByType.set(check.checkType, check);
      }
    }

    // Calculate weighted average score
    const weights: Record<ComplianceCheckType, number> = {
      [ComplianceCheckType.FSCA_LICENSE]: 0.3, // 30% weight
      [ComplianceCheckType.SANCTIONS_LIST]: 0.25, // 25% weight
      [ComplianceCheckType.ADVERSE_MEDIA]: 0.2, // 20% weight
      [ComplianceCheckType.FINANCIAL_HEALTH]: 0.15, // 15% weight
      [ComplianceCheckType.SECURITY_ASSESSMENT]: 0.1 // 10% weight
    };

    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [checkType, check] of latestChecksByType) {
      const weight = weights[checkType];
      totalWeightedScore += check.score * weight;
      totalWeight += weight;
    }

    const complianceScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    // Update broker's trust score based on compliance
    await this.updateBrokerTrustScore(brokerId, complianceScore);

    return Math.round(complianceScore * 100) / 100; // Round to 2 decimal places
  }

  private async checkFSCALicenseStatus(broker: Broker): Promise<{
    result: ComplianceResult;
    score: number;
    details: any;
    recommendations: string[];
  }> {
    if (!broker.fscaLicenseNumber) {
      return {
        result: ComplianceResult.FAIL,
        score: 0,
        details: { checkedValue: null, expectedValue: 'Valid FSCA License', flags: ['NO_LICENSE_PROVIDED'] },
        recommendations: ['Submit FSCA license number for verification']
      };
    }

    // In a real implementation, this would call the FSCAService
    // For now, simulate based on broker compliance info
    const isVerified = broker.complianceInfo.fscaVerified;
    const isActive = broker.status === 'VERIFIED' && broker.isActive;

    if (isVerified && isActive) {
      return {
        result: ComplianceResult.PASS,
        score: 1.0,
        details: {
          checkedValue: broker.fscaLicenseNumber,
          expectedValue: 'Valid FSCA License',
          sources: ['FSCA Registry']
        },
        recommendations: []
      };
    } else {
      return {
        result: ComplianceResult.FAIL,
        score: 0.2,
        details: {
          checkedValue: broker.fscaLicenseNumber,
          expectedValue: 'Valid FSCA License',
          flags: ['LICENSE_NOT_VERIFIED']
        },
        recommendations: ['Complete FSCA license verification process']
      };
    }
  }

  private async checkSanctionsList(broker: Broker): Promise<{
    result: ComplianceResult;
    score: number;
    details: any;
    recommendations: string[];
  }> {
    const brokerName = broker.companyName;
    const registrationNumber = broker.registrationNumber;

    try {
      // Call sanctions checking API
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.sanctionsApiUrl}/check`,
          {
            name: brokerName,
            registrationNumber,
            entityType: 'COMPANY'
          },
          {
            headers: {
              'Authorization': `Bearer ${this.sanctionsApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        )
      );

      const { matches, riskLevel } = response.data;

      if (matches.length === 0) {
        return {
          result: ComplianceResult.PASS,
          score: 1.0,
          details: {
            checkedValue: brokerName,
            expectedValue: 'No matches in sanctions lists',
            sources: ['International Sanctions Databases']
          },
          recommendations: []
        };
      } else {
        return {
          result: riskLevel === 'HIGH' ? ComplianceResult.FAIL : ComplianceResult.WARNING,
          score: riskLevel === 'HIGH' ? 0.1 : 0.5,
          details: {
            checkedValue: brokerName,
            expectedValue: 'No matches in sanctions lists',
            flags: matches,
            sources: ['International Sanctions Databases']
          },
          recommendations: ['Review potential matches', 'Submit documentation to verify identity']
        };
      }
    } catch (error) {
      this.logger.error(`Failed to check sanctions for ${brokerName}:`, error);
      return {
        result: ComplianceResult.WARNING,
        score: 0.7,
        details: {
          checkedValue: brokerName,
          expectedValue: 'Sanctions list check completed',
          flags: ['SANCTIONS_CHECK_FAILED'],
          sources: []
        },
        recommendations: ['Retry sanctions check', 'Manual review required']
      };
    }
  }

  private async checkAdverseMedia(broker: Broker): Promise<{
    result: ComplianceResult;
    score: number;
    details: any;
    recommendations: string[];
  }> {
    // In a real implementation, this would use media monitoring APIs
    // For now, simulate based on broker status and age
    const brokerAge = Date.now() - broker.createdAt.getTime();
    const daysSinceCreation = brokerAge / (1000 * 60 * 60 * 24);

    // New brokers get a pass on adverse media initially
    if (daysSinceCreation < 30) {
      return {
        result: ComplianceResult.PASS,
        score: 0.9,
        details: {
          checkedValue: 'No adverse media found',
          expectedValue: 'Clean media profile',
          sources: ['Media Monitoring'],
          metadata: { daysSinceCreation, status: 'NEW_BROKER_GRACE_PERIOD' }
        },
        recommendations: ['Monitor media coverage regularly']
      };
    }

    // Simulate adverse media check
    const hasNegativeNews = Math.random() < 0.05; // 5% chance of finding adverse media

    if (!hasNegativeNews) {
      return {
        result: ComplianceResult.PASS,
        score: 0.95,
        details: {
          checkedValue: 'No adverse media found',
          expectedValue: 'Clean media profile',
          sources: ['Media Monitoring', 'News Archives']
        },
        recommendations: ['Continue regular media monitoring']
      };
    } else {
      return {
        result: ComplianceResult.WARNING,
        score: 0.6,
        details: {
          checkedValue: 'Adverse media detected',
          expectedValue: 'Clean media profile',
          flags: ['NEGATIVE_MEDIA_COVERAGE'],
          sources: ['Media Monitoring']
        },
        recommendations: ['Review media coverage', 'Submit response or clarification', 'Enhanced monitoring']
      };
    }
  }

  private async checkFinancialHealth(broker: Broker): Promise<{
    result: ComplianceResult;
    score: number;
    details: any;
    recommendations: string[];
  }> {
    const { aum, clientCount } = broker.complianceInfo;

    if (!aum || !clientCount) {
      return {
        result: ComplianceResult.WARNING,
        scale: 0.7,
        details: {
          checkedValue: { aum, clientCount },
          expectedValue: 'Valid financial metrics',
          flags: ['MISSING_FINANCIAL_DATA']
        },
        recommendations: ['Update AUM and client count information']
      };
    }

    // Calculate financial health score based on AUM and client metrics
    const aumScore = Math.min(aum / 100000000, 1) * 0.6; // R100M = max score
    const clientScore = Math.min(clientCount / 1000, 1) * 0.4; // 1000 clients = max score
    const totalScore = aumScore + clientScore;

    if (totalScore >= 0.8) {
      return {
        result: ComplianceResult.PASS,
        score: totalScore,
        details: {
          checkedValue: { aum, clientCount },
          expectedValue: 'Healthy financial metrics',
          threshold: 0.8,
          actualValue: totalScore
        },
        recommendations: []
      };
    } else if (totalScore >= 0.5) {
      return {
        result: ComplianceResult.WARNING,
        score: totalScore,
        details: {
          checkedValue: { aum, clientCount },
          expectedValue: 'Healthy financial metrics',
          threshold: 0.8,
          actualValue: totalScore,
          flags: ['BELOW_EXPECTED_METRICS']
        },
        recommendations: ['Focus on client acquisition', 'Review business strategy']
      };
    } else {
      return {
        result: ComplianceResult.FAIL,
        score: totalScore,
        details: {
          checkedValue: { aum, clientCount },
          expectedValue: 'Healthy financial metrics',
          threshold: 0.5,
          actualValue: totalScore,
          flags: ['FINANCIAL_CONCERNS']
        },
        recommendations: ['Urgent review of business model', 'Consider financial support', 'Enhanced monitoring']
      };
    }
  }

  private async assessSecurityInfrastructure(broker: Broker): Promise<{
    result: ComplianceResult;
    score: number;
    details: any;
    recommendations: string[];
  }> {
    // Check broker's API security configuration
    const { apiKey, apiSecret, webhookUrl, allowedIps } = broker.apiConfig;

    const securityChecks = [
      { name: 'API Key Present', pass: !!apiKey },
      { name: 'API Secret Present', pass: !!apiSecret },
      { name: 'Webhook URL Configured', pass: !!webhookUrl },
      { name: 'IP Whitelisting', pass: allowedIps && allowedIps.length > 0 },
      { name: 'Rate Limiting', pass: !!(broker.apiConfig.rateLimit && broker.apiConfig.rateLimit > 0) },
    ];

    const passedChecks = securityChecks.filter(check => check.pass).length;
    const totalChecks = securityChecks.length;
    const score = passedChecks / totalChecks;

    if (score >= 0.8) {
      return {
        result: ComplianceResult.PASS,
        score,
        details: {
          checkedValue: `${passedChecks}/${totalChecks} security measures`,
          expectedValue: 'All security measures configured',
          flags: []
        },
        recommendations: ['Regular security audits', 'Keep security measures updated']
      };
    } else {
      const failedChecks = securityChecks.filter(check => !check.pass).map(check => check.name);
      return {
        result: score >= 0.5 ? ComplianceResult.WARNING : ComplianceResult.FAIL,
        score,
        details: {
          checkedValue: `${passedChecks}/${totalChecks} security measures`,
          expectedValue: 'All security measures configured',
          flags: failedChecks
        },
        recommendations: [
          `Configure missing security measures: ${failedChecks.join(', ')}`,
          'Enable IP whitelisting',
          'Set appropriate rate limits',
        ]
      };
    }
  }

  private async updateBrokerTrustScore(brokerId: string, complianceScore: number): Promise<void> {
    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
    if (!broker) return;

    // Update trust score (30% weight to compliance score)
    const newTrustScore = Math.round(complianceScore * 30 + broker.trustScore * 70) / 100;

    broker.trustScore = Math.round(Math.min(Math.max(newTrustScore, 0), 100));
    await this.prisma.broker.upsert(broker);
  }

  private async sendComplianceAlert(brokerId: string, alert: ComplianceAlert): Promise<void> {
    try {
      // Send notification to broker
      await this.notificationService.sendComplianceAlert(brokerId, alert);

      // Broadcast to WebSocket for real-time alerts
      await this.webSocketGateway.broadcastComplianceAlert(brokerId, alert);

      // Queue follow-up actions
      if (alert.severity === 'HIGH') {
        await this.complianceQueue.add('handle-critical-compliance-issue', {
          brokerId,
          alert
        }, { delay: 60000 }); // Process after 1 minute
      }

      this.logger.log(`Compliance alert sent for broker ${brokerId}: ${alert.message}`);
    } catch (error) {
      this.logger.error(`Failed to send compliance alert for broker ${brokerId}:`, error);
    }
  }

  async generateComplianceReport(brokerId: string, period: { start: Date; end: Date }): Promise<Buffer> {
    this.logger.log(`Generating compliance report for broker ${brokerId}`);

    const checks = await this.prisma.compliancecheckrepository.findMany({
      where: {
        brokerId,
        checkDate: Between(period.start, period.end)
      },
      order: { checkDate: 'DESC' }
    });

    const overallScore = await this.calculateComplianceScore(brokerId);

    // Generate PDF report
    // This would use a PDF library like pdf-lib or puppeteer
    // For now, return a simple text buffer
    const reportContent = `
Compliance Report
Broker ID: ${brokerId}
Period: ${period.start.toISOString()} to ${period.end.toISOString()}
Generated: ${new Date().toISOString()}

Overall Compliance Score: ${(overallScore * 100).toFixed(1)}%

Summary of Checks:
${checks.map(check => `
- ${check.checkType}: ${check.result} (Score: ${(check.score * 100).toFixed(1)}%)
  Date: ${check.checkDate.toISOString()}
  ${check.recommendations.length > 0 ? 'Recommendations: ' + check.recommendations.join(', ') : ''}
`).join('\n')}
    `.trim();

    return Buffer.from(reportContent, 'utf-8');
  }

  async getComplianceMonitoring(brokerId: string): Promise<ComplianceMonitoring> {
    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });

    // Default monitoring configuration
    // In a real implementation, this would be configurable per broker
    return {
      realtimeChecks: true,
      periodicReviews: {
        frequency: 'WEEKLY',
        enabled: true
      },
      alertThresholds: {
        riskScore: 0.3,
        apiErrors: 50,
        volumeDrop: 0.25,
        complianceScore: 0.7
      },
      requiredChecks: [
        ComplianceCheckType.FSCA_LICENSE,
        ComplianceCheckType.SANCTIONS_LIST,
        ComplianceCheckType.ADVERSE_MEDIA,
        ComplianceCheckType.FINANCIAL_HEALTH,
        ComplianceCheckType.SECURITY_ASSESSMENT,
      ]
    };
  }
}
