import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { BrokerClient, ClientStatus, AttributionType } from '../entities/broker-client.entity';
import { Broker } from '../entities/broker.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../trading/entities/order.entity';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClientAttributionService {
  private readonly logger = new Logger(ClientAttributionService.name);
  private readonly commissionSplit: { platform: number; broker: number };

  constructor(
    @InjectRepository(BrokerClient)
    private brokerClientRepository: Repository<BrokerClient>,
    @InjectRepository(Broker)
    private brokerRepository: Repository<Broker>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private prismaService: PrismaService,
    private configService: ConfigService,
  ) {
    // Default commission split: 70% platform, 30% broker
    this.commissionSplit = {
      platform: this.configService.get<number>('PLATFORM_COMMISSION_RATE', 0.7),
      broker: this.configService.get<number>('BROKER_COMMISSION_RATE', 0.3),
    };
  }

  async attributeClientToBroker(
    clientId: string,
    brokerId: string,
    attributionType: AttributionType,
    metadata?: Record<string, any>
  ): Promise<BrokerClient> {
    this.logger.log(`Attributing client ${clientId} to broker ${brokerId} via ${attributionType}`);

    // Verify broker exists and is active
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId, isActive: true } });
    if (!broker) {
      throw new Error(`Active broker not found: ${brokerId}`);
    }

    // Verify client exists
    const client = await this.userRepository.findOne({ where: { id: clientId } });
    if (!client) {
      throw new Error(`Client not found: ${clientId}`);
    }

    // Check if client is already attributed to this broker
    const existingAttribution = await this.brokerClientRepository.findOne({
      where: { brokerId, clientId },
    });

    if (existingAttribution) {
      this.logger.warn(`Client ${clientId} already attributed to broker ${brokerId}`);
      return existingAttribution;
    }

    // Check if client is attributed to another broker
    const otherAttribution = await this.brokerClientRepository.findOne({
      where: { clientId, status: ClientStatus.ACTIVE },
      relations: ['broker'],
    });

    if (otherAttribution) {
      throw new Error(`Client ${clientId} is already attributed to broker ${otherAttribution.broker.companyName}`);
    }

    // Create attribution record
    const brokerClient = this.brokerClientRepository.create({
      brokerId,
      clientId,
      status: ClientStatus.ACTIVE,
      attributionType,
      attributionDate: new Date(),
      metadata: metadata || {},
    });

    const savedAttribution = await this.brokerClientRepository.save(brokerClient);

    // Update client's brokerId in User model
    await this.userRepository.update(clientId, { brokerId });

    this.logger.log(`Successfully attributed client ${clientId} to broker ${brokerId}`);
    return savedAttribution;
  }

  async processCommissionAttribution(order: Order): Promise<void> {
    if (!order.brokerId || order.feeAmount <= 0) {
      return; // No broker attribution or no commission
    }

    this.logger.log(`Processing commission attribution for order ${order.id}, broker ${order.brokerId}`);

    try {
      // Calculate commission split
      const brokerCommission = Math.round(order.feeAmount * this.commissionSplit.broker * 100) / 100;
      const platformCommission = Math.round(order.feeAmount * this.commissionSplit.platform * 100) / 100;

      // Update order with commission details
      order.brokerCommission = brokerCommission;
      order.platformCommission = platformCommission;
      await this.prismaService.order.update({
        where: { id: order.id },
        data: {
          brokerCommission,
          platformCommission,
        },
      });

      // Update broker client statistics
      await this.updateBrokerClientStats(order.brokerId, order.userId, order.feeAmount, brokerCommission);

      this.logger.log(`Commission processed - Broker: R${brokerCommission}, Platform: R${platformCommission}`);
    } catch (error) {
      this.logger.error(`Failed to process commission attribution for order ${order.id}:`, error);
      throw error;
    }
  }

  private async updateBrokerClientStats(
    brokerId: string,
    clientId: string,
    totalCommission: number,
    brokerCommission: number
  ): Promise<void> {
    const brokerClient = await this.brokerClientRepository.findOne({
      where: { brokerId, clientId },
    });

    if (!brokerClient) {
      this.logger.warn(`Broker client relationship not found for broker ${brokerId}, client ${clientId}`);
      return;
    }

    // Update statistics
    brokerClient.totalTrades += 1;
    brokerClient.totalCommission += totalCommission;
    brokerClient.totalBrokerCommission += brokerCommission;
    brokerClient.totalPlatformCommission += totalCommission - brokerCommission;
    brokerClient.lastTradeDate = new Date();

    // Set first trade date if this is the first trade
    if (!brokerClient.firstTradeDate) {
      brokerClient.firstTradeDate = new Date();
    }

    await this.brokerClientRepository.save(brokerClient);
  }

  async getBrokerClients(
    brokerId: string,
    filters?: {
      status?: ClientStatus;
      attributionType?: AttributionType;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<BrokerClient[]> {
    const query = this.brokerClientRepository.createQueryBuilder('brokerClient')
      .leftJoinAndSelect('brokerClient.client', 'client')
      .leftJoinAndSelect('brokerClient.broker', 'broker')
      .where('brokerClient.brokerId = :brokerId', { brokerId });

    if (filters?.status) {
      query.andWhere('brokerClient.status = :status', { status: filters.status });
    }

    if (filters?.attributionType) {
      query.andWhere('brokerClient.attributionType = :attributionType', { attributionType: filters.attributionType });
    }

    if (filters?.startDate || filters?.endDate) {
      query.andWhere('brokerClient.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters?.startDate || new Date(0),
        endDate: filters?.endDate || new Date(),
      });
    }

    query.orderBy('brokerClient.createdAt', 'DESC');

    return query.getMany();
  }

  async getBrokerClientStats(brokerId: string): Promise<{
    totalClients: number;
    activeClients: number;
    totalTrades: number;
    totalVolume: number;
    totalCommission: number;
    totalBrokerCommission: number;
    averageCommissionPerClient: number;
    churnRate: number;
  }> {
    const stats = await this.brokerClientRepository
      .createQueryBuilder('brokerClient')
      .select('COUNT(*)', 'totalClients')
      .addSelect('SUM(CASE WHEN brokerClient.status = :activeStatus THEN 1 ELSE 0 END)', 'activeClients')
      .addSelect('SUM(brokerClient.totalTrades)', 'totalTrades')
      .addSelect('SUM(brokerClient.totalVolume)', 'totalVolume')
      .addSelect('SUM(brokerClient.totalCommission)', 'totalCommission')
      .addSelect('SUM(brokerClient.totalBrokerCommission)', 'totalBrokerCommission')
      .addSelect('AVG(brokerClient.totalCommission)', 'averageCommissionPerClient')
      .addSelect('SUM(CASE WHEN brokerClient.status = :churnedStatus THEN 1 ELSE 0 END)', 'churnedClients')
      .where('brokerClient.brokerId = :brokerId', {
        brokerId,
        activeStatus: ClientStatus.ACTIVE,
        churnedStatus: ClientStatus.CHURNED
      })
      .getRawOne();

    const totalClients = parseInt(stats.totalClients) || 0;
    const churnedClients = parseInt(stats.churnedClients) || 0;

    return {
      totalClients,
      activeClients: parseInt(stats.activeClients) || 0,
      totalTrades: parseInt(stats.totalTrades) || 0,
      totalVolume: parseFloat(stats.totalVolume) || 0,
      totalCommission: parseFloat(stats.totalCommission) || 0,
      totalBrokerCommission: parseFloat(stats.totalBrokerCommission) || 0,
      averageCommissionPerClient: parseFloat(stats.averageCommissionPerClient) || 0,
      churnRate: totalClients > 0 ? churnedClients / totalClients : 0,
    };
  }

  async getClientAttributionHistory(clientId: string): Promise<BrokerClient[]> {
    return this.brokerClientRepository.find({
      where: { clientId },
      relations: ['broker'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateClientStatus(
    brokerId: string,
    clientId: string,
    status: ClientStatus,
    notes?: string
  ): Promise<BrokerClient> {
    const brokerClient = await this.brokerClientRepository.findOne({
      where: { brokerId, clientId },
    });

    if (!brokerClient) {
      throw new Error(`Broker client relationship not found for broker ${brokerId}, client ${clientId}`);
    }

    brokerClient.status = status;
    if (notes) {
      brokerClient.notes = notes;
    }

    return this.brokerClientRepository.save(brokerClient);
  }

  async generateReferralCode(brokerId: string): Promise<string> {
    const broker = await this.brokerRepository.findOne({ where: { id: brokerId } });
    if (!broker) {
      throw new Error(`Broker not found: ${brokerId}`);
    }

    // Generate unique referral code
    const prefix = broker.companyName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 3);
    const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const referralCode = `${prefix}${suffix}`;

    // Check if code already exists
    const existing = await this.brokerClientRepository.findOne({
      where: { referralCode },
    });

    if (existing) {
      // Regenerate if collision
      return this.generateReferralCode(brokerId);
    }

    return referralCode;
  }

  async validateReferralCode(referralCode: string): Promise<Broker | null> {
    const brokerClient = await this.brokerClientRepository.findOne({
      where: { referralCode },
      relations: ['broker'],
    });

    return brokerClient?.broker || null;
  }

  async getClientRevenueByPeriod(
    brokerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: Date; end: Date };
    totalRevenue: number;
    brokerRevenue: number;
    platformRevenue: number;
    clientBreakdown: Array<{
      clientId: string;
      clientName: string;
      totalCommission: number;
      brokerCommission: number;
      tradeCount: number;
    }>;
  }> {
    // Get client breakdown
    const clients = await this.brokerClientRepository
      .createQueryBuilder('brokerClient')
      .leftJoinAndSelect('brokerClient.client', 'client')
      .where('brokerClient.brokerId = :brokerId', { brokerId })
      .andWhere('brokerClient.lastTradeDate BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const clientBreakdown = clients.map(client => ({
      clientId: client.clientId,
      clientName: `${client.client.firstName} ${client.client.lastName}`,
      totalCommission: client.totalCommission,
      brokerCommission: client.totalBrokerCommission,
      tradeCount: client.totalTrades,
    }));

    const totalRevenue = clientBreakdown.reduce((sum, client) => sum + client.totalCommission, 0);
    const brokerRevenue = clientBreakdown.reduce((sum, client) => sum + client.brokerCommission, 0);
    const platformRevenue = totalRevenue - brokerRevenue;

    return {
      period: { start: startDate, end: endDate },
      totalRevenue,
      brokerRevenue,
      platformRevenue,
      clientBreakdown,
    };
  }
}