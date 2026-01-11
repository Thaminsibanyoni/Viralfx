import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// COMMENTED OUT (TypeORM entity deleted): import { ClientRecord } from '../entities/client-record.entity';
// COMMENTED OUT (TypeORM entity deleted): import { ClientInteraction } from '../entities/client-interaction.entity';
import { User } from "../../../common/enums/user-role.enum";
// COMMENTED OUT (cross-module entity import): import { Broker } from "../../brokers/entities/broker.entity";
import { CreateClientRecordDto, ClientSegment, ClientStatus, ClientSource } from '../dto/create-client-record.dto';
import { UpdateClientRecordDto } from '../dto/update-client-record.dto';
import { CreateClientInteractionDto, InteractionType, InteractionDirection, InteractionPriority } from '../dto/create-client-interaction.dto';
import { UpdateClientInteractionDto } from '../dto/update-client-interaction.dto';
import { NotificationService } from "../../notifications/services/notification.service";

@Injectable()
export class ClientsService {
  constructor(
        private notificationsService: NotificationService) {}

  // Client Record CRUD Operations
  async createClientRecord(createDto: CreateClientRecordDto): Promise<ClientRecord> {
    // Validate user exists if provided
    if (createDto.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: createDto.userId }
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }
    }

    // Validate broker if provided
    if (createDto.brokerId) {
      const broker = await this.prisma.broker.findFirst({
        where: { id: createDto.brokerId }
      });

      if (!broker) {
        throw new NotFoundException('Broker not found');
      }
    }

    const clientRecord = this.prisma.clientRecord.create({
      ...createDto,
      segment: createDto.segment || ClientSegment.RETAIL,
      status: createDto.status || ClientStatus.ACTIVE,
      lastActivityAt: new Date(),
      createdAt: new Date()
    });

    return await this.prisma.clientRecord.upsert(clientRecord);
  }

  async getClientRecord(id: string): Promise<ClientRecord> {
    const clientRecord = await this.prisma.clientRecord.findFirst({
      where: { id },
      relations: [
        'user',
        'broker',
        'interactions',
        'interactions.staff',
      ]
    });

    if (!clientRecord) {
      throw new NotFoundException('Client record not found');
    }

    return clientRecord;
  }

  async getClientRecordByUserId(userId: string): Promise<ClientRecord> {
    const clientRecord = await this.prisma.clientRecord.findFirst({
      where: { userId },
      relations: [
        'user',
        'broker',
        'interactions',
        'interactions.staff',
      ]
    });

    if (!clientRecord) {
      throw new NotFoundException('Client record not found for this user');
    }

    return clientRecord;
  }

  async getClientRecords(filters: {
    page?: number;
    limit?: number;
    brokerId?: string;
    segment?: ClientSegment;
    status?: ClientStatus;
    source?: ClientSource;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    tags?: string[];
    minRiskScore?: number;
    maxRiskScore?: number;
  }): Promise<{ clientRecords: ClientRecord[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      brokerId,
      segment,
      status,
      source,
      search,
      startDate,
      endDate,
      tags,
      minRiskScore,
      maxRiskScore
    } = filters;

    const where: any = {};

    if (brokerId) where.brokerId = brokerId;
    if (segment) where.segment = segment;
    if (status) where.status = status;
    if (source) where.source = source;

    if (tags && tags.length > 0) {
      where.tags = In(tags);
    }

    if (minRiskScore !== undefined || maxRiskScore !== undefined) {
      if (minRiskScore !== undefined && maxRiskScore !== undefined) {
        where.riskScore = Between(minRiskScore, maxRiskScore);
      } else if (minRiskScore !== undefined) {
        where.riskScore = MoreThan(minRiskScore);
      } else if (maxRiskScore !== undefined) {
        where.riskScore = LessThan(maxRiskScore);
      }
    }

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThan(startDate);
    } else if (endDate) {
      where.createdAt = LessThan(endDate);
    }

    const [clientRecords, total] = await this.prisma.findAndCount({
      where,
      relations: ['user', 'broker'],
      order: { lastActivityAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });

    // Apply search filter if provided (search by name, email, phone)
    let filteredClientRecords = clientRecords;
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredClientRecords = clientRecords.filter(client =>
        client.name?.toLowerCase().includes(searchTerm) ||
        client.email?.toLowerCase().includes(searchTerm) ||
        client.phone?.toLowerCase().includes(searchTerm) ||
        client.user?.firstName?.toLowerCase().includes(searchTerm) ||
        client.user?.lastName?.toLowerCase().includes(searchTerm) ||
        client.user?.email?.toLowerCase().includes(searchTerm) ||
        client.notes?.toLowerCase().includes(searchTerm)
      );
    }

    return {
      clientRecords: filteredClientRecords,
      total: search ? filteredClientRecords.length : total,
      page,
      limit
    };
  }

  async updateClientRecord(id: string, updateDto: UpdateClientRecordDto): Promise<ClientRecord> {
    const clientRecord = await this.getClientRecord(id);

    // Update last activity when status changes
    if (updateDto.status && updateDto.status !== clientRecord.status) {
      updateDto['lastActivityAt'] = new Date();
    }

    // Check for high risk score notification
    if (updateDto.riskScore !== undefined && updateDto.riskScore > 80) {
      await this.notificationsService.sendNotification({
        userId: clientRecord.userId,
        type: 'high_risk_client',
        channels: ['email', 'push'],
        data: {
          clientId: clientRecord.id,
          riskScore: updateDto.riskScore,
          previousRiskScore: clientRecord.riskScore
        }
      });
    }

    Object.assign(clientRecord, updateDto);

    return await this.prisma.clientRecord.upsert(clientRecord);
  }

  async deleteClientRecord(id: string): Promise<void> {
    const clientRecord = await this.getClientRecord(id);

    // Soft delete by marking as CHURNED
    clientRecord.status = ClientStatus.CHURNED;
    await this.prisma.clientRecord.upsert(clientRecord);
  }

  // Client Interaction CRUD Operations
  async createClientInteraction(createDto: CreateClientInteractionDto, staffId: string): Promise<ClientInteraction> {
    // Validate client record exists
    const clientRecord = await this.prisma.clientRecord.findFirst({
      where: { id: createDto.clientId }
    });

    if (!clientRecord) {
      throw new NotFoundException('Client record not found');
    }

    const interaction = this.prisma.clientInteraction.create({
      ...createDto,
      staffId
    });

    const savedInteraction = await this.prisma.clientInteraction.upsert(interaction);

    // Update client's last activity timestamp
    clientRecord.lastActivityAt = new Date();
    await this.prisma.clientRecord.upsert(clientRecord);

    // Send notification for call interactions
    if (createDto.type === InteractionType.CALL) {
      await this.notificationsService.sendNotification({
        userId: clientRecord.userId,
        type: 'client_interaction',
        channels: ['email', 'push'],
        data: {
          type: createDto.type,
          clientId: clientRecord.id,
          interactionId: savedInteraction.id,
          subject: createDto.subject
        }
      });
    }

    return savedInteraction;
  }

  async getClientInteraction(id: string): Promise<ClientInteraction> {
    const interaction = await this.prisma.clientInteraction.findFirst({
      where: { id },
      relations: ['clientRecord', 'clientRecord.user', 'staff']
    });

    if (!interaction) {
      throw new NotFoundException('Client interaction not found');
    }

    return interaction;
  }

  async getClientInteractions(clientId: string, filters: {
    page?: number;
    limit?: number;
    type?: InteractionType;
    direction?: InteractionDirection;
    priority?: InteractionPriority;
    startDate?: Date;
    endDate?: Date;
    staffId?: string;
  }): Promise<{ interactions: ClientInteraction[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 20,
      type,
      direction,
      priority,
      startDate,
      endDate,
      staffId
    } = filters;

    const where: any = { clientId };

    if (type) where.type = type;
    if (direction) where.direction = direction;
    if (priority) where.priority = priority;
    if (staffId) where.staffId = staffId;

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      where.createdAt = MoreThan(startDate);
    } else if (endDate) {
      where.createdAt = LessThan(endDate);
    }

    const [interactions, total] = await this.prisma.findAndCount({
      where,
      relations: ['clientRecord', 'staff'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit
    });

    return {
      interactions,
      total,
      page,
      limit
    };
  }

  async updateClientInteraction(id: string, updateDto: UpdateClientInteractionDto): Promise<ClientInteraction> {
    const interaction = await this.getClientInteraction(id);

    Object.assign(interaction, updateDto);

    return await this.prisma.clientInteraction.upsert(interaction);
  }

  async deleteClientInteraction(id: string): Promise<void> {
    const interaction = await this.getClientInteraction(id);

    await this.prisma.remove(interaction);
  }

  // Analytics and Reporting Methods
  async getClientAnalytics(filters: {
    brokerId?: string;
    segment?: ClientSegment;
    status?: ClientStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    const { brokerId, segment, status, startDate, endDate } = filters;

    const where: any = {};
    if (brokerId) where.brokerId = brokerId;
    if (segment) where.segment = segment;
    if (status) where.status = status;

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    const [
      totalClients,
      activeClients,
      newClientsThisMonth,
      highRiskClients,
      totalInteractions,
    ] = await Promise.all([
      this.prisma.count({ where }),
      this.prisma.count({
        where: { ...where, status: ClientStatus.ACTIVE }
      }),
      this.prisma.count({
        where: {
          ...where,
          createdAt: MoreThan(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
        }
      }),
      this.prisma.count({
        where: {
          ...where,
          riskScore: MoreThan(0.7)
        }
      }),
      this.prisma.count({
        where: {
          clientId: undefined // Will be filtered by client relationships
        }
      }),
    ]);

    return {
      totalClients,
      activeClients,
      newClientsThisMonth,
      highRiskClients,
      totalInteractions,
      clientSegments: await this.getClientSegmentDistribution(where),
      interactionTrends: await this.getInteractionTrends(startDate, endDate)
    };
  }

  async getClientSegmentDistribution(where: any): Promise<any> {
    const distribution = await this.clientRecordRepository
      .createQueryBuilder('client')
      .select('client.segment', 'segment')
      .addSelect('COUNT(*)', 'count')
      .where(where)
      .groupBy('client.segment')
      .getRawMany();

    return distribution.map(item => ({
      segment: item.segment,
      count: parseInt(item.count)
    }));
  }

  async getInteractionTrends(startDate?: Date, endDate?: Date): Promise<any> {
    const queryBuilder = this.clientInteractionRepository
      .createQueryBuilder('interaction')
      .select('DATE(interaction.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .groupBy('DATE(interaction.createdAt)')
      .orderBy('DATE(interaction.createdAt)', 'DESC')
      .limit(30);

    if (startDate && endDate) {
      queryBuilder.where('interaction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
    }

    const trends = await queryBuilder.getRawMany();

    return trends.map(item => ({
      date: item.date,
      count: parseInt(item.count)
    }));
  }

  // Bulk Operations
  async bulkUpdateClientStatus(clientIds: string[], status: ClientStatus, reason?: string): Promise<ClientRecord[]> {
    const clientRecords = await this.prisma.findByIds(clientIds);

    const updatedRecords = clientRecords.map(client => ({
      ...client,
      status,
      notes: reason ? `${client.notes}\n\n${reason}`.trim() : client.notes,
      lastActivityAt: new Date()
    }));

    return await this.prisma.clientRecord.upsert(updatedRecords);
  }

  async bulkAssignClientsToBroker(clientIds: string[], brokerId: string): Promise<ClientRecord[]> {
    // Validate broker exists
    const broker = await this.prisma.broker.findFirst({
      where: { id: brokerId }
    });

    if (!broker) {
      throw new NotFoundException('Broker not found');
    }

    const clientRecords = await this.prisma.findByIds(clientIds);

    const updatedRecords = clientRecords.map(client => ({
      ...client,
      brokerId,
      lastActivityAt: new Date()
    }));

    return await this.prisma.clientRecord.upsert(updatedRecords);
  }
}
