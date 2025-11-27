import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract, ContractStatus, ContractType } from '../entities/contract.entity';
import { Opportunity } from '../entities/opportunity.entity';
import { StorageService } from '../../storage/services/storage.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { CreateContractDto } from '../dto/create-contract.dto';
import { UpdateContractDto } from '../dto/update-contract.dto';

@Injectable()
export class ContractService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService,
  ) {}

  async createContract(opportunityId: string, createContractDto: CreateContractDto) {
    // Generate unique contract number
    const contractNumber = await this.generateContractNumber();

    const contract = this.contractRepository.create({
      opportunityId,
      brokerId: createContractDto.brokerId,
      contractNumber,
      ...createContractDto,
    });

    const savedContract = await this.contractRepository.save(contract);

    // Send notification for contract creation
    await this.notificationService.sendNotification({
      userId: createContractDto.brokerId,
      type: 'contract_created',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        category: 'crm',
        contractType: createContractDto.type,
        contractValue: createContractDto.value,
      },
      priority: 'HIGH',
    });

    return savedContract;
  }

  async updateContract(id: string, updateContractDto: UpdateContractDto) {
    const contract = await this.getContractById(id);

    if (contract.status === ContractStatus.SIGNED || contract.status === ContractStatus.ACTIVE) {
      throw new BadRequestException('Cannot update a signed or active contract');
    }

    await this.contractRepository.update(id, updateContractDto);
    return await this.getContractById(id);
  }

  async signContract(id: string, signatureData: {
    name: string;
    email: string;
    ipAddress: string;
  }) {
    const contract = await this.getContractById(id);

    if (contract.status !== ContractStatus.PENDING_SIGNATURE) {
      throw new BadRequestException('Contract is not pending signature');
    }

    const signedData = {
      ...signatureData,
      signedAt: new Date(),
    };

    await this.contractRepository.update(id, {
      status: ContractStatus.SIGNED,
      signedBy: signedData,
    });

    // Send notification for contract signing
    await this.notificationService.sendNotification({
      userId: contract.brokerId,
      type: 'contract_signed',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        category: 'crm',
        contractId: contract.id,
        contractType: contract.type,
      },
      priority: 'HIGH',
    });

    return await this.getContractById(id);
  }

  async uploadDocument(id: string, file: Express.Multer.File) {
    const contract = await this.getContractById(id);

    // Upload file to storage
    const documentUrl = await this.storageService.uploadFile(
      file.buffer,
      `contracts/${contract.contractNumber}/${file.originalname}`,
      {
        contentType: file.mimetype,
      }
    );

    await this.contractRepository.update(id, {
      documentUrl,
    });

    return { documentUrl };
  }

  async generateFromTemplate(templateId: string, data: {
    opportunityId: string;
    brokerId: string;
    contractData: any;
  }) {
    // This would integrate with a template service (e.g., DocuSign, HelloSign)
    // For now, create a basic contract
    const contract = await this.createContract(data.opportunityId, {
      brokerId: data.brokerId,
      type: ContractType.CUSTOM,
      value: data.contractData.value || 0,
      startDate: new Date(data.contractData.startDate),
      endDate: new Date(data.contractData.endDate),
      terms: data.contractData.terms || '',
      templateId,
    });

    return contract;
  }

  async renewContract(id: string, renewalData: {
    newEndDate: Date;
    newValue?: number;
    newTerms?: string;
  }) {
    const contract = await this.getContractById(id);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Only active contracts can be renewed');
    }

    const renewalDate = new Date();
    const newContract = this.contractRepository.create({
      opportunityId: contract.opportunityId,
      brokerId: contract.brokerId,
      contractNumber: await this.generateContractNumber('RENEWAL'),
      type: contract.type,
      status: ContractStatus.DRAFT,
      value: renewalData.newValue || contract.value,
      currency: contract.currency,
      startDate: contract.endDate,
      endDate: renewalData.newEndDate,
      renewalDate,
      autoRenew: contract.autoRenew,
      terms: renewalData.newTerms || contract.terms,
      templateId: contract.templateId,
    });

    await this.contractRepository.save(newContract);

    // Update original contract
    await this.contractRepository.update(id, {
      renewalDate,
    });

    return newContract;
  }

  async terminateContract(id: string, reason: string) {
    const contract = await this.getContractById(id);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException('Only active contracts can be terminated');
    }

    await this.contractRepository.update(id, {
      status: ContractStatus.TERMINATED,
      metadata: {
        ...contract.metadata,
        terminationReason: reason,
        terminatedAt: new Date(),
      },
    });

    // Send notification for contract termination
    await this.notificationService.sendNotification({
      userId: contract.brokerId,
      type: 'contract_terminated',
      channels: ['EMAIL', 'IN_APP', 'SMS'],
      data: {
        category: 'crm',
        contractId: contract.id,
        terminationReason: reason,
      },
      priority: 'CRITICAL',
    });

    return await this.getContractById(id);
  }

  async getContracts(filters: {
    page?: number;
    limit?: number;
    status?: ContractStatus;
    type?: ContractType;
    brokerId?: string;
    dateRange?: { start: Date; end: Date };
  }) {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      brokerId,
      dateRange,
    } = filters;

    const queryBuilder = this.contractRepository
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.broker', 'broker')
      .leftJoinAndSelect('contract.opportunity', 'opportunity');

    if (status) {
      queryBuilder.andWhere('contract.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('contract.type = :type', { type });
    }

    if (brokerId) {
      queryBuilder.andWhere('contract.brokerId = :brokerId', { brokerId });
    }

    if (dateRange) {
      queryBuilder.andWhere(
        'contract.createdAt BETWEEN :start AND :end',
        dateRange
      );
    }

    queryBuilder.orderBy('contract.createdAt', 'DESC');

    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [contracts, total] = await queryBuilder.getManyAndCount();

    return {
      contracts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getContractById(id: string) {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['broker', 'opportunity'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async getExpiringContracts(days: number) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.contractRepository.find({
      where: {
        status: ContractStatus.ACTIVE,
        endDate: futureDate,
      },
      relations: ['broker'],
    });
  }

  async sendForSignature(id: string) {
    const contract = await this.getContractById(id);

    // This would integrate with e-signature service (DocuSign, HelloSign, etc.)
    // Generate a mock signature URL for now
    const signatureUrl = `${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/contracts/${contract.id}/sign`;

    // Update status to pending signature
    await this.contractRepository.update(id, {
      status: ContractStatus.PENDING_SIGNATURE,
    });

    // Send notification to broker
    await this.notificationService.sendNotification({
      userId: contract.brokerId,
      type: 'contract_signature_required',
      channels: ['EMAIL', 'IN_APP'],
      data: {
        category: 'crm',
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        signatureUrl: signatureUrl,
      },
      priority: 'HIGH',
    });

    return { success: true, signatureUrl };
  }

  private async generateContractNumber(type: string = 'NEW'): Promise<string> {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = type === 'RENEWAL' ? 'VFX-R' : 'VFX';

    // Find the highest sequence number for today
    const today = new Date().toISOString().split('T')[0];
    const lastContract = await this.contractRepository
      .createQueryBuilder('contract')
      .where('contract.contractNumber LIKE :prefix', { prefix: `${prefix}-${dateStr}-%` })
      .orderBy('contract.contractNumber', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastContract) {
      const lastSequence = parseInt(lastContract.contractNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }

    return `${prefix}-${dateStr}-${sequence.toString().padStart(5, '0')}`;
  }
}