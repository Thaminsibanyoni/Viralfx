import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BrokerStatus, BrokerTier } from '../enums/broker.enum';
// COMMENTED OUT (TypeORM entity deleted): import { Broker, BrokerStatus, BrokerTier } from '../entities/broker.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerVerification, VerificationType, VerificationStatus } from '../entities/broker-verification.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerBill, BillStatus } from '../entities/broker-bill.entity';
// COMMENTED OUT (TypeORM entity deleted): import { BrokerApiUsage, ApiMethod } from '../entities/broker-api-usage.entity';
import { CreateBrokerDto } from '../dto/create-broker.dto';
import { UpdateBrokerDto } from '../dto/update-broker.dto';
import { FSCAVerificationDto } from '../dto/fsca-verification.dto';
import { BrokerFilterOptions, BrokerStats } from '../interfaces/broker.interface';
import { AnalyticsService } from "./analytics.service";
import { IntegrationService } from "./integration.service";
import { crypto } from "../../../common/utils/crypto";

// Type alias for compatibility
type Broker = any;

@Injectable()
export class BrokersService {
  private readonly logger = new Logger(BrokersService.name);

  constructor(
        private prismaService: PrismaService,
    private configService: ConfigService,
    private analyticsService: AnalyticsService,
    private integrationService: IntegrationService,
    @InjectQueue('broker-verification') private verificationQueue: Queue) {}

  async createBroker(createBrokerDto: CreateBrokerDto): Promise<Broker> {
    this.logger.log(`Creating new broker: ${createBrokerDto.companyName}`);

    // Check if registration number already exists
    const existingBroker = await this.prisma.broker.findFirst({
      where: { registrationNumber: createBrokerDto.registrationNumber }
    });

    if (existingBroker) {
      throw new ConflictException('Broker with this registration number already exists');
    }

    // Generate API credentials
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();

    const broker = this.prisma.broker.create({
      ...createBrokerDto,
      status: BrokerStatus.PENDING,
      tier: BrokerTier.STARTER,
      apiConfig: {
        apiKey,
        apiSecret,
        rateLimit: 100, // Default rate limit for starter tier
        allowedIps: []
      },
      trustScore: 0,
      isActive: false,
      complianceInfo: {
        fscaVerified: false,
        aum: 0,
        clientCount: 0,
        insuranceCoverage: 0
      },
      paymentInfo: {
        billingEmail: createBrokerDto.contactEmail,
        paymentMethod: null,
        billingAddress: createBrokerDto.physicalAddress
      }
    });

    const savedBroker = await this.prisma.broker.upsert(broker);

    // Create initial FSCA verification record
    const verification = this.prisma.verificationrepository.create({
      brokerId: savedBroker.id,
      verificationType: VerificationType.FSCA_LICENSE,
      status: VerificationStatus.PENDING,
      documents: []
    });

    await this.prisma.verificationrepository.upsert(verification);

    // Queue FSCA verification if license number provided
    if (createBrokerDto.fscaLicenseNumber) {
      await this.verificationQueue.add('verify-fsca-license', {
        brokerId: savedBroker.id,
        fscaLicenseNumber: createBrokerDto.fscaLicenseNumber,
        registrationNumber: createBrokerDto.registrationNumber
      });
    }

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'CREATE_BROKER',
        entityType: 'BROKER',
        entityId: savedBroker.id,
        oldValues: null,
        newValues: JSON.stringify({
          companyName: savedBroker.companyName,
          registrationNumber: savedBroker.registrationNumber,
          status: savedBroker.status
        }),
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });

    this.logger.log(`Successfully created broker: ${savedBroker.companyName} (${savedBroker.id})`);
    return savedBroker;
  }

  async getBrokers(filters: BrokerFilterOptions = {}) {
    const { status, tier, verified, search, sortBy = 'createdAt', sortOrder = 'DESC', page = 1, limit = 10 } = filters;

    const queryBuilder = this.prisma.createQueryBuilder('broker');

    // Apply filters
    if (status && status.length > 0) {
      queryBuilder.andWhere('broker.status IN (:...status)', { status });
    }

    if (tier && tier.length > 0) {
      queryBuilder.andWhere('broker.tier IN (:...tier)', { tier });
    }

    if (verified !== undefined) {
      queryBuilder.andWhere('broker.complianceInfo->>\'fscaVerified\' = :verified', { verified: verified.toString() });
    }

    if (search) {
      queryBuilder.andWhere(
        '(broker.companyName ILIKE :search OR broker.registrationNumber ILIKE :search OR broker.contactEmail ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`broker.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [brokers, total] = await queryBuilder.getManyAndCount();

    return {
      brokers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getBrokerById(id: string): Promise<Broker> {
    const broker = await this.prisma.broker.findFirst({
      where: { id },
      relations: ['verifications', 'bills', 'integrations', 'reviews', 'apiUsage', 'complianceChecks', 'marketingAnalytics']
    });

    if (!broker) {
      throw new NotFoundException(`Broker with ID ${id} not found`);
    }

    return broker;
  }

  async updateBroker(id: string, updateBrokerDto: UpdateBrokerDto): Promise<Broker> {
    this.logger.log(`Updating broker: ${id}`);

    const broker = await this.getBrokerById(id);

    // Store old values for audit
    const oldValues = JSON.stringify({
      companyName: broker.companyName,
      status: broker.status,
      tier: broker.tier,
      contactEmail: broker.contactEmail
    });

    // Update broker
    Object.assign(broker, updateBrokerDto);
    broker.updatedAt = new Date();

    const updatedBroker = await this.prisma.broker.upsert(broker);

    // Store new values for audit
    const newValues = JSON.stringify({
      companyName: updatedBroker.companyName,
      status: updatedBroker.status,
      tier: updatedBroker.tier,
      contactEmail: updatedBroker.contactEmail
    });

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'UPDATE_BROKER',
        entityType: 'BROKER',
        entityId: id,
        oldValues,
        newValues,
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });

    this.logger.log(`Successfully updated broker: ${id}`);
    return updatedBroker;
  }

  async deleteBroker(id: string): Promise<void> {
    this.logger.log(`Deleting broker: ${id}`);

    const broker = await this.getBrokerById(id);

    // Soft delete by setting status to DELETED
    broker.status = BrokerStatus.DELETED;
    broker.isActive = false;
    broker.updatedAt = new Date();

    await this.prisma.broker.upsert(broker);

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'DELETE_BROKER',
        entityType: 'BROKER',
        entityId: id,
        oldValues: JSON.stringify({
          companyName: broker.companyName,
          status: 'ACTIVE'
        }),
        newValues: JSON.stringify({
          companyName: broker.companyName,
          status: BrokerStatus.DELETED
        }),
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });

    this.logger.log(`Successfully deleted broker: ${id}`);
  }

  async generateApiCredentials(brokerId: string): Promise<{ apiKey: string; apiSecret: string }> {
    const broker = await this.getBrokerById(brokerId);

    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();

    broker.apiConfig = {
      ...broker.apiConfig,
      apiKey,
      apiSecret
    };

    await this.prisma.broker.upsert(broker);

    return { apiKey, apiSecret };
  }

  async rotateApiCredentials(brokerId: string): Promise<{ apiKey: string; apiSecret: string }> {
    this.logger.log(`Rotating API credentials for broker: ${brokerId}`);

    const credentials = await this.generateApiCredentials(brokerId);

    // Log audit
    await this.prismaService.auditLog.create({
      data: {
        action: 'ROTATE_API_CREDENTIALS',
        entityType: 'BROKER',
        entityId: brokerId,
        oldValues: null,
        newValues: JSON.stringify({ action: 'API_CREDENTIALS_ROTATED' }),
        userId: null,
        ipAddress: null,
        userAgent: null
      }
    });

    this.logger.log(`Successfully rotated API credentials for broker: ${brokerId}`);
    return credentials;
  }

  async getBrokerStats(brokerId: string): Promise<any> {
    const broker = await this.getBrokerById(brokerId);

    // Get API usage stats
    const apiUsage = await this.prisma.apiusagerepository.findMany({
      where: { brokerId },
      order: { date: 'DESC' },
      take: 30
    });

    // Get recent bills
    const recentBills = await this.prisma.billrepository.findMany({
      where: { brokerId },
      order: { createdAt: 'DESC' },
      take: 6
    });

    // Get verification status
    const latestVerification = await this.prisma.verificationrepository.findFirst({
      where: { brokerId },
      order: { createdAt: 'DESC' }
    });

    return {
      broker: {
        id: broker.id,
        companyName: broker.companyName,
        status: broker.status,
        tier: broker.tier,
        trustScore: broker.trustScore
      },
      apiUsage: {
        totalRequestsLast30Days: apiUsage.reduce((sum, usage) => sum + usage.requestCount, 0),
        averageResponseTime: apiUsage.reduce((sum, usage) => sum + usage.responseTimeAvg, 0) / (apiUsage.length || 1),
        errorRate: apiUsage.reduce((sum, usage) => sum + usage.errorCount, 0) / (apiUsage.reduce((sum, usage) => sum + usage.requestCount, 0) || 1) * 100
      },
      billing: {
        totalPending: recentBills.filter(bill => bill.status === BillStatus.PENDING).reduce((sum, bill) => sum + bill.total, 0),
        totalPaid: recentBills.filter(bill => bill.status === BillStatus.PAID).reduce((sum, bill) => sum + bill.total, 0),
        overdueCount: recentBills.filter(bill => bill.status === BillStatus.OVERDUE).length
      },
      verification: {
        status: latestVerification?.status || VerificationStatus.PENDING,
        lastCheck: latestVerification?.createdAt,
        expiresAt: latestVerification?.expiresAt
      }
    };
  }

  async getPlatformStats(): Promise<BrokerStats> {
    const [
      totalBrokers,
      activeBrokers,
      verifiedBrokers,
      brokersByTier,
      brokersByStatus,
      newBrokersThisMonth,
    ] = await Promise.all([
      this.prisma.count(),
      this.prisma.count({ where: { isActive: true } }),
      this.brokerRepository
        .createQueryBuilder('broker')
        .where('broker.complianceInfo->>\'fscaVerified\' = :verified', { verified: 'true' })
        .getCount(),
      this.brokerRepository
        .createQueryBuilder('broker')
        .select('broker.tier', 'tier')
        .addSelect('COUNT(*)', 'count')
        .groupBy('broker.tier')
        .getRawMany(),
      this.brokerRepository
        .createQueryBuilder('broker')
        .select('broker.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('broker.status')
        .getRawMany(),
      this.prisma.count({
        where: {
          createdAt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      }),
    ]);

    return {
      totalBrokers,
      activeBrokers,
      verifiedBrokers,
      totalVolume: 0, // Would need to calculate from actual trading data
      totalRevenue: 0, // Would need to calculate from actual billing data
      averageComplianceScore: 0.85, // Would need to calculate from actual compliance data
      brokersByTier: brokersByTier.reduce((acc, item) => ({ ...acc, [item.tier]: parseInt(item.count) }), {}),
      brokersByStatus: brokersByStatus.reduce((acc, item) => ({ ...acc, [item.status]: parseInt(item.count) }), {}),
      newBrokersThisMonth,
      growthRate: 0.15 // Would calculate based on historical data
    };
  }

  private generateApiKey(): string {
    const length = this.configService.get<number>('BROKER_API_KEY_LENGTH', 32);
    return crypto.randomBytes(length).toString('hex');
  }

  private generateApiSecret(): string {
    const length = this.configService.get<number>('BROKER_API_SECRET_LENGTH', 64);
    return crypto.randomBytes(length).toString('hex');
  }

  // Broker Self-Service Methods
  async getMyProfile(brokerId: string): Promise<any> {
    const broker = await this.getBrokerById(brokerId);
    const stats = await this.getBrokerStats(brokerId);

    return {
      id: broker.id,
      companyName: broker.companyName,
      registrationNumber: broker.registrationNumber,
      status: broker.status,
      tier: broker.tier,
      contactEmail: broker.contactEmail,
      contactPhone: broker.contactPhone,
      physicalAddress: broker.physicalAddress,
      website: broker.website,
      logoUrl: broker.logoUrl,
      businessProfile: broker.businessProfile,
      complianceInfo: broker.complianceInfo,
      paymentInfo: broker.paymentInfo,
      trustScore: broker.trustScore,
      verificationStatus: broker.verificationStatus,
      totalTraders: broker.totalTraders,
      totalVolume: broker.totalVolume,
      averageRating: broker.averageRating,
      numberOfReviews: broker.numberOfReviews,
      acceptNewClients: broker.acceptNewClients,
      isPubliclyListed: broker.isPubliclyListed,
      operatingHours: broker.operatingHours,
      createdAt: broker.createdAt,
      updatedAt: broker.updatedAt,
      stats
    };
  }

  async updateMyProfile(brokerId: string, updateDto: UpdateBrokerDto): Promise<Broker> {
    const broker = await this.getBrokerById(brokerId);

    // Only allow certain fields to be updated by broker
    const allowedFields = [
      'contactEmail', 'contactPhone', 'physicalAddress', 'postalAddress',
      'website', 'logoUrl', 'bannerUrl', 'businessProfile', 'paymentInfo',
      'operatingHours', 'acceptNewClients', 'isPubliclyListed'
    ];

    allowedFields.forEach(field => {
      if (updateDto[field] !== undefined) {
        broker[field] = updateDto[field];
      }
    });

    return await this.prisma.broker.upsert(broker);
  }

  async getMyIntegrations(brokerId: string): Promise<any> {
    return await this.integrationService.getBrokerIntegrations(brokerId);
  }

  async getMyAnalytics(brokerId: string, dateRange?: { start: Date; end: Date }): Promise<any> {
    return await this.analyticsService.getBrokerAnalytics(brokerId, dateRange);
  }

  async updateMetrics(brokerId: string, metrics: {
    totalDealsWon?: number;
    totalDealsLost?: number;
    totalRevenue?: number;
  }) {
    const broker = await this.prisma.broker.findFirst({ where: { id: brokerId } });
    if (!broker) {
      throw new NotFoundException(`Broker with ID ${brokerId} not found`);
    }

    // Update broker metrics
    if (metrics.totalDealsWon) {
      broker.totalDealsWon = (broker.totalDealsWon || 0) + metrics.totalDealsWon;
    }
    if (metrics.totalDealsLost) {
      broker.totalDealsLost = (broker.totalDealsLost || 0) + metrics.totalDealsLost;
    }
    if (metrics.totalRevenue) {
      broker.totalRevenue = (broker.totalRevenue || 0) + metrics.totalRevenue;
    }

    // Update broker stats
    broker.totalDeals = (broker.totalDealsWon || 0) + (broker.totalDealsLost || 0);

    // Calculate win rate
    if (broker.totalDeals > 0) {
      broker.winRate = (broker.totalDealsWon / broker.totalDeals) * 100;
    }

    broker.updatedAt = new Date();

    await this.prisma.broker.upsert(broker);

    this.logger.log(`Updated metrics for broker ${brokerId}: deals won: ${metrics.totalDealsWon}, deals lost: ${metrics.totalDealsLost}, revenue: ${metrics.totalRevenue}`);
  }
}
