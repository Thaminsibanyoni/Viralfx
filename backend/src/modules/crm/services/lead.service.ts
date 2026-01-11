import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
// COMMENTED OUT (TypeORM entity deleted): import { Lead, LeadStatus } from '../entities/lead.entity';
import { ActivityService } from "./activity.service";
import { NotificationService } from "../../notifications/services/notification.service";
import { CreateLeadDto } from '../dto/create-lead.dto';
import { UpdateLeadDto } from '../dto/update-lead.dto';

@Injectable()
export class LeadService {
  constructor(
        private prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService) {}

  async createLead(createLeadDto: CreateLeadDto) {
    // Check if email already exists
    const existingLead = await this.prisma.lead.findFirst({
      where: { email: createLeadDto.email }
    });

    if (existingLead) {
      throw new BadRequestException('Lead with this email already exists');
    }

    const lead = this.prisma.lead.create(createLeadDto);
    const savedLead = await this.prisma.lead.upsert(lead);

    // Log creation activity
    await this.activityService.logActivity('LEAD', savedLead.id, {
      type: 'CREATION',
      subject: 'New lead created',
      description: `Lead created: ${savedLead.firstName} ${savedLead.lastName} from ${savedLead.source}`,
      assignedTo: savedLead.assignedTo
    });

    // Send notification if assigned to manager
    if (savedLead.assignedTo) {
      await this.notificationService.sendNotification({
        userId: savedLead.assignedTo,
        type: 'lead_assigned',
        channels: ['EMAIL', 'IN_APP'],
        data: {
          category: 'crm',
          leadId: savedLead.id,
          leadName: `${savedLead.firstName} ${savedLead.lastName}`,
          leadCompany: savedLead.company,
          leadSource: savedLead.source
        },
        priority: 'MEDIUM'
      });
    }

    return savedLead;
  }

  async updateLead(id: string, updateLeadDto: UpdateLeadDto) {
    const lead = await this.getLeadById(id);

    if (lead.email !== updateLeadDto.email) {
      // Check if new email already exists
      const existingLead = await this.prisma.lead.findFirst({
        where: { email: updateLeadDto.email }
      });

      if (existingLead) {
        throw new BadRequestException('Lead with this email already exists');
      }
    }

    await this.prisma.lead.update(id, updateLeadDto);
    const updatedLead = await this.getLeadById(id);

    // Log update activity
    await this.activityService.logActivity('LEAD', id, {
      type: 'UPDATE',
      subject: 'Lead updated',
      description: `Lead information updated`,
      assignedTo: updatedLead.assignedTo
    });

    return updatedLead;
  }

  async deleteLead(id: string) {
    const lead = await this.getLeadById(id);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot delete a converted lead');
    }

    await this.prisma.softDelete(id);

    // Log deletion activity
    await this.activityService.logActivity('LEAD', id, {
      type: 'DELETION',
      subject: 'Lead deleted',
      description: `Lead deleted: ${lead.firstName} ${lead.lastName}`
    });

    return { success: true };
  }

  async getLeads(filters: {
    page?: number;
    limit?: number;
    status?: LeadStatus;
    source?: string;
    assignedTo?: string;
    brokerId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) {
    const {
      page = 1,
      limit = 20,
      status,
      source,
      assignedTo,
      brokerId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = filters;

    const queryBuilder = this.leadRepository
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.relationshipManager', 'relationshipManager')
      .leftJoinAndSelect('lead.broker', 'broker');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('lead.status = :status', { status });
    }

    if (source) {
      queryBuilder.andWhere('lead.source = :source', { source });
    }

    if (assignedTo) {
      queryBuilder.andWhere('lead.assignedTo = :assignedTo', { assignedTo });
    }

    if (brokerId) {
      queryBuilder.andWhere('lead.brokerId = :brokerId', { brokerId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(lead.firstName ILIKE :search OR lead.lastName ILIKE :search OR lead.email ILIKE :search OR lead.company ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`lead.${sortBy}`, sortOrder);

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [leads, total] = await queryBuilder.getManyAndCount();

    return {
      leads,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async getLeadById(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id },
      relations: ['relationshipManager', 'broker', 'activities']
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
  }

  async qualifyLead(id: string) {
    const lead = await this.getLeadById(id);

    if (lead.status !== LeadStatus.NEW && lead.status !== LeadStatus.CONTACTED) {
      throw new BadRequestException('Only new or contacted leads can be qualified');
    }

    await this.prisma.lead.update(id, {
      status: LeadStatus.QUALIFIED,
      leadScore: Math.max(lead.leadScore, 60) // Minimum score for qualified leads
    });

    // Log qualification activity
    await this.activityService.logActivity('LEAD', id, {
      type: 'QUALIFICATION',
      subject: 'Lead qualified',
      description: `Lead qualified and ready for opportunity creation`,
      assignedTo: lead.assignedTo
    });

    return await this.getLeadById(id);
  }

  async disqualifyLead(id: string, reason: string) {
    const lead = await this.getLeadById(id);

    if (lead.status === LeadStatus.CONVERTED) {
      throw new BadRequestException('Cannot disqualify a converted lead');
    }

    await this.prisma.lead.update(id, {
      status: LeadStatus.UNQUALIFIED,
      metadata: {
        ...lead.metadata,
        disqualificationReason: reason,
        disqualifiedAt: new Date()
      }
    });

    // Log disqualification activity
    await this.activityService.logActivity('LEAD', id, {
      type: 'DISQUALIFICATION',
      subject: 'Lead disqualified',
      description: `Lead disqualified: ${reason}`,
      assignedTo: lead.assignedTo
    });

    return await this.getLeadById(id);
  }

  async bulkImport(csvData: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    company?: string;
    position?: string;
    country?: string;
    region?: string;
    source?: string;
    estimatedRevenue?: number;
    brokerId?: string;
  }>) {
    const results = {
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const [index, row] of csvData.entries()) {
      try {
        const leadData = {
          ...row,
          source: row.source || 'WEBSITE'
        };

        await this.createLead(leadData);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: index + 1,
          email: row.email,
          error: error.message
        });
      }
    }

    return results;
  }

  async exportLeads(filters: {
    status?: LeadStatus;
    source?: string;
    assignedTo?: string;
    brokerId?: string;
    dateRange?: { start: Date; end: Date };
  }) {
    const leads = await this.prisma.lead.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
        ...(filters.source && { source: filters.source }),
        ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
        ...(filters.brokerId && { brokerId: filters.brokerId }),
        ...(filters.dateRange && {
          createdAt: Between(filters.dateRange.start, filters.dateRange.end)
        })
      },
      relations: ['relationshipManager', 'broker']
    });

    // Convert to CSV format
    const headers = [
      'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Company',
      'Position', 'Country', 'Region', 'Source', 'Status', 'Lead Score',
      'Estimated Revenue', 'Assigned To', 'Created Date'
    ];

    const csvRows = leads.map(lead => [
      lead.id,
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone || '',
      lead.company || '',
      lead.position || '',
      lead.country || '',
      lead.region || '',
      lead.source,
      lead.status,
      lead.leadScore,
      lead.estimatedRevenue || 0,
      lead.relationshipManager?.name || '',
      lead.createdAt.toISOString(),
    ]);

    return [headers, ...csvRows];
  }
}
