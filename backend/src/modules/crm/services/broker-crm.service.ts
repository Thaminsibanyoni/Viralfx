import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from "../../../prisma/prisma.service";
import { FilesService } from "../../files/services/files.service";
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationService } from "../../notifications/services/notification.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class BrokerCrmService {
  private readonly logger = new Logger(BrokerCrmService.name);

  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
    private notificationsService: NotificationService,
    private redisService: RedisService,
    @InjectQueue('crm-docs')
    private crmDocsQueue: Queue,
    @InjectQueue('crm-onboarding')
    private crmOnboardingQueue: Queue) {}

  async createBrokerAccount(createDto: any) {
    const broker = await this.prisma.broker.findFirst({
      where: { id: createDto.brokerId }
    });

    if (!broker) {
      throw new NotFoundException('Broker not found');
    }

    // Check if account already exists
    const existingAccount = await this.prisma.brokerAccount.findFirst({
      where: { brokerId: createDto.brokerId }
    });

    if (existingAccount) {
      throw new BadRequestException('Broker account already exists');
    }

    const account = await this.prisma.brokerAccount.create({
      data: createDto
    });
    return account;
  }

  async getBrokerAccount(brokerId: string) {
    const account = await this.prisma.brokerAccount.findFirst({
      where: { brokerId },
      include: {
        broker: true,
        invoices: {
          include: {
            payments: true,
            items: true
          }
        },
        subscriptions: {
          include: {
            usageRecords: true
          }
        },
        notes: true,
        documents: true
      }
    });

    if (!account) {
      throw new NotFoundException('Broker account not found');
    }

    return account;
  }

  async updateBrokerAccount(brokerId: string, updateDto: any) {
    const account = await this.getBrokerAccount(brokerId);

    return await this.prisma.brokerAccount.update({
      where: { id: account.id },
      data: updateDto
    });
  }

  async getBrokerInvoices(brokerId: string, page = 1, limit = 20) {
    const [invoices, total] = await this.prisma.$transaction([
      this.prisma.brokerInvoice.findMany({
        where: { brokerId },
        include: {
          brokerAccount: true,
          payments: true,
          items: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.brokerInvoice.count({ where: { brokerId } })
    ]);

    return { invoices, total };
  }

  async createBrokerInvoice(createDto: any) {
    // Generate unique invoice number
    const invoiceNumber = await this.generateInvoiceNumber();

    const invoice = await this.prisma.brokerInvoice.create({
      data: {
        ...createDto,
        invoiceNumber
      }
    });

    return invoice;
  }

  async getBrokerPayments(brokerId: string) {
    return await this.prisma.brokerPayment.findMany({
      where: { brokerId },
      include: {
        invoice: true,
        broker: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBrokerSubscriptions(brokerId: string) {
    return await this.prisma.brokerSubscription.findMany({
      where: { brokerId },
      include: {
        brokerAccount: true,
        usageRecords: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createBrokerNote(createDto: any, authorId: string) {
    const note = await this.prisma.brokerNote.create({
      data: {
        ...createDto,
        authorId
      }
    });

    return note;
  }

  async getAllBrokerAccounts(filters: {
    page?: number;
    limit?: number;
    status?: string;
    tier?: string;
    search?: string;
  }) {
    const {
      page = 1,
      limit = 10,
      status,
      tier,
      search
    } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (tier) where.tier = tier;

    const include: any = {
      broker: true,
      subscriptions: true,
      invoices: true
    };

    if (search) {
      include.broker = {
        ...include.broker,
        where: {
          OR: [
            { companyName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }
      };
    }

    const [brokers, total] = await this.prisma.$transaction([
      this.prisma.brokerAccount.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.brokerAccount.count({ where })
    ]);

    return {
      brokers,
      page,
      limit,
      total
    };
  }

  async uploadDocument(
    brokerId: string,
    documentData: {
      file: Express.Multer.File;
      documentType: string;
      description: string;
      tags?: string[];
      expiryDate?: Date;
    },
    uploadedBy?: string) {
    this.logger.log(`Uploading document for broker ${brokerId}: ${documentData.file.originalname}`);

    const brokerAccount = await this.getBrokerAccount(brokerId);

    // Validate document type and required fields for FSCA compliance
    await this.validateDocumentType(documentData.documentType, documentData.file);

    // Upload file using FilesService with secure storage
    try {
      const uploadResult = await this.filesService.uploadFiles(
        [{
          buffer: documentData.file.buffer,
          originalname: documentData.file.originalname,
          mimetype: documentData.file.mimetype,
          size: documentData.file.size
        }],
        {
          category: `broker-documents/${documentData.documentType.toLowerCase()}`,
          visibility: 'PRIVATE',
          tags: documentData.tags || [],
          fileName: `${brokerId}_${documentData.documentType}_${Date.now()}${documentData.file.originalname.substring(documentData.file.originalname.lastIndexOf('.'))}`,
          allowDuplicate: false,
          expiresAt: documentData.expiryDate
        },
        uploadedBy || 'system'
      );

      if (uploadResult.failed.length > 0) {
        throw new BadRequestException(`File upload failed: ${uploadResult.failed[0].error}`);
      }

      const uploadedFile = uploadResult.successful[0];

      // Create broker document record
      const document = await this.prisma.brokerDocument.create({
        data: {
          brokerId,
          brokerAccountId: brokerAccount.id,
          uploadedBy: uploadedBy || 'system',
          documentType: documentData.documentType,
          title: `${documentData.documentType} - ${documentData.file.originalname}`,
          description: documentData.description,
          fileName: documentData.file.originalname,
          fileUrl: uploadedFile.downloadUrl,
          fileId: uploadedFile.id,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.mimeType,
          fileHash: uploadedFile.hash,
          status: 'PENDING_VERIFICATION',
          uploadedAt: new Date(),
          tags: documentData.tags || [],
          metadata: {
            uploadSource: 'crm-portal',
            originalUploadDate: new Date().toISOString(),
            fileCategory: uploadedFile.fileType,
            virusScanStatus: 'PENDING',
            fscaCompliance: await this.checkFSCARequirements(documentData.documentType, uploadedFile)
          }
        }
      });

      // Queue virus scan and document processing
      await this.queueDocumentProcessing(document.id, uploadedFile.id);

      this.logger.log(`Document uploaded successfully: ${document.id} for broker ${brokerId}`);
      return document;

    } catch (error) {
      this.logger.error(`Document upload failed for broker ${brokerId}:`, error);
      throw new BadRequestException(`Document upload failed: ${error.message}`);
    }
  }

  async verifyDocument(
    brokerId: string,
    documentId: string,
    status: string,
    notes?: string) {
    const document = await this.prisma.brokerDocument.findFirst({
      where: { id: documentId, brokerId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return await this.prisma.brokerDocument.update({
      where: { id: documentId },
      data: {
        status: status as 'APPROVED' | 'REJECTED' | 'PENDING',
        verifiedBy: 'current_user',
        verifiedAt: new Date(),
        ...(status === 'REJECTED' && notes && { rejectionReason: notes })
      }
    });
  }

  async addNote(
    brokerId: string,
    noteData: { content: string; category: string },
    authorId?: string) {
    const brokerAccount = await this.getBrokerAccount(brokerId);

    const note = await this.prisma.brokerNote.create({
      data: {
        brokerId,
        brokerAccountId: brokerAccount.id,
        content: noteData.content,
        category: noteData.category,
        authorId: authorId || 'system'
      }
    });

    return note;
  }

  async getBrokerNotes(brokerId: string) {
    return await this.prisma.brokerNote.findMany({
      where: { brokerId },
      include: {
        author: true,
        brokerAccount: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async uploadBrokerDocument(
    brokerId: string,
    documentData: {
      documentType: string;
      title: string;
      description?: string;
      fileName: string;
      fileUrl: string;
      fileSize: number;
      mimeType: string;
      expiryDate?: Date;
    },
    uploadedBy: string) {
    const brokerAccount = await this.getBrokerAccount(brokerId);

    const document = await this.prisma.brokerDocument.create({
      data: {
        brokerId,
        brokerAccountId: brokerAccount.id,
        uploadedBy,
        ...documentData
      }
    });

    return document;
  }

  async verifyBrokerDocument(
    documentId: string,
    verifiedBy: string,
    status: 'APPROVED' | 'REJECTED',
    rejectionReason?: string) {
    const document = await this.prisma.brokerDocument.findFirst({
      where: { id: documentId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return await this.prisma.brokerDocument.update({
      where: { id: documentId },
      data: {
        status,
        verifiedBy,
        verifiedAt: new Date(),
        ...(status === 'REJECTED' && rejectionReason && { rejectionReason })
      }
    });
  }

  async getBrokerDocuments(brokerId: string) {
    return await this.prisma.brokerDocument.findMany({
      where: { brokerId },
      include: {
        uploader: true,
        verifier: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getBrokerMetrics(brokerId: string) {
    const account = await this.getBrokerAccount(brokerId);

    // Get metrics from various tables
    const [
      _totalInvoices,
      _totalPaid,
      _totalOutstanding,
      pendingDocuments
    ] = await Promise.all([
      this.prisma.brokerInvoice.aggregate({
        where: { brokerId },
        _count: true,
        _sum: { totalAmount: true }
      }),
      this.prisma.brokerPayment.aggregate({
        where: { brokerId, status: 'COMPLETED' },
        _sum: { amount: true }
      }),
      this.prisma.brokerInvoice.aggregate({
        where: { brokerId, status: 'SENT' },
        _sum: { totalAmount: true }
      }),
      this.prisma.brokerDocument.count({
        where: { brokerId, status: 'PENDING' }
      })
    ]);

    const totalInvoices = _totalInvoices._count || 0;
    const totalPaid = _totalPaid._sum.amount || 0;
    const totalOutstanding = _totalOutstanding._sum.amount || 0;

    return {
      accountStatus: account.status,
      complianceStatus: account.complianceStatus,
      riskRating: account.rating,
      totalInvoices,
      totalPaid,
      totalOutstanding,
      pendingDocuments
    };
  }

  private async generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count for this month
    const count = await this.prisma.brokerInvoice.count({
      where: {
        createdAt: {
          gte: new Date(year, date.getMonth(), 1),
          lt: new Date(year, date.getMonth() + 1, 1)
        }
      }
    });

    return `${prefix}${year}${month}${String(count + 1).padStart(4, '0')}`;
  }

  private async validateDocumentType(documentType: string, file: Express.Multer.File): Promise<void> {
    // FSCA document type validation
    const allowedDocumentTypes = [
      'FSP_LICENSE',
      'PROOF_OF_ADDRESS',
      'BANK_STATEMENT',
      'ID_DOCUMENT',
      'PASSPORT',
      'COMPANY_REGISTRATION',
      'TAX_CLEARANCE',
      'FINANCIAL_STATEMENTS',
      'FITNESS_PROPERITY_REPORT',
      'BOARD_RESOLUTION',
      'SHAREHOLDER_REGISTER',
      'COMPLIANCE_MANUAL',
      'RISK_MANAGEMENT_POLICY',
      'INTERNAL_AUDIT_REPORT',
      'EXTERNAL_AUDIT_REPORT',
      'PROOF_OF_INSURANCE',
      'DIRECTOR_CONSENT',
    ];

    if (!allowedDocumentTypes.includes(documentType)) {
      throw new BadRequestException(`Invalid document type: ${documentType}. Allowed types: ${allowedDocumentTypes.join(', ')}`);
    }

    // File type validation based on document type
    const documentTypeFileRules: Record<string, string[]> = {
      'FSP_LICENSE': ['application/pdf', 'image/jpeg', 'image/png'],
      'PROOF_OF_ADDRESS': ['application/pdf', 'image/jpeg', 'image/png'],
      'BANK_STATEMENT': ['application/pdf', 'image/jpeg', 'image/png'],
      'ID_DOCUMENT': ['application/pdf', 'image/jpeg', 'image/png'],
      'PASSPORT': ['application/pdf', 'image/jpeg', 'image/png'],
      'COMPANY_REGISTRATION': ['application/pdf', 'image/jpeg', 'image/png'],
      'TAX_CLEARANCE': ['application/pdf', 'image/jpeg', 'image/png'],
      'FINANCIAL_STATEMENTS': ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    };

    const allowedMimeTypes = documentTypeFileRules[documentType] || ['application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type for ${documentType}. Allowed types: ${allowedMimeTypes.join(', ')}`);
    }

    // File size validation based on document type
    const maxFileSize = documentType.includes('FINANCIAL_STATEMENTS') ? 10 * 1024 * 1024 : 5 * 1024 * 1024; // 10MB for financial statements, 5MB for others
    if (file.size > maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size for ${documentType}: ${maxFileSize / 1024 / 1024}MB`);
    }
  }

  private async checkFSCARequirements(documentType: string, uploadedFile: any): Promise<any> {
    const fscaRequirements = {
      isRequiredDocument: true,
      complianceChecklist: {
        isReadable: true,
        hasValidFormat: true,
        notExpired: true,
        containsRequiredFields: false,
        digitallySigned: false,
        watermarked: false
      },
      documentCategory: this.getFSCACategory(documentType),
      expiryDate: this.getDocumentExpiryDate(documentType),
      verificationLevel: this.getVerificationLevel(documentType)
    };

    return fscaRequirements;
  }

  private getFSCACategory(documentType: string): string {
    const categories: Record<string, string> = {
      'FSP_LICENSE': 'REGULATORY',
      'FITNESS_PROPERITY_REPORT': 'COMPLIANCE',
      'FINANCIAL_STATEMENTS': 'FINANCIAL',
      'PROOF_OF_ADDRESS': 'IDENTITY',
      'ID_DOCUMENT': 'IDENTITY',
      'PASSPORT': 'IDENTITY',
      'COMPANY_REGISTRATION': 'BUSINESS',
      'TAX_CLEARANCE': 'TAX',
      'BOARD_RESOLUTION': 'GOVERNANCE',
      'SHAREHOLDER_REGISTER': 'GOVERNANCE'
    };

    return categories[documentType] || 'GENERAL';
  }

  private getDocumentExpiryDate(documentType: string): Date | null {
    const expiryPeriods: Record<string, number> = {
      'FSP_LICENSE': 365 * 3,
      'FITNESS_PROPERITY_REPORT': 365,
      'PROOF_OF_ADDRESS': 90,
      'BANK_STATEMENT': 90,
      'TAX_CLEARANCE': 365
    };

    const days = expiryPeriods[documentType];
    return days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  }

  private getVerificationLevel(documentType: string): string {
    const levels: Record<string, string> = {
      'FSP_LICENSE': 'CRITICAL',
      'FITNESS_PROPERITY_REPORT': 'CRITICAL',
      'FINANCIAL_STATEMENTS': 'HIGH',
      'TAX_CLEARANCE': 'HIGH',
      'COMPANY_REGISTRATION': 'HIGH',
      'PROOF_OF_ADDRESS': 'MEDIUM',
      'ID_DOCUMENT': 'HIGH',
      'PASSPORT': 'HIGH'
    };

    return levels[documentType] || 'LOW';
  }

  private async queueDocumentProcessing(documentId: string, fileId: string): Promise<void> {
    // Queue document processing tasks
    await this.crmDocsQueue.add('scan-document', {
      documentId,
      fileId
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  async deleteDocumentSecurely(brokerId: string, documentId: string, userId: string): Promise<void> {
    const document = await this.prisma.brokerDocument.findFirst({
      where: { id: documentId, brokerId }
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check permissions
    const userRole = await this.getUserRole(userId);
    if (!this.hasDocumentAccess(document, userRole, userId)) {
      throw new BadRequestException('Insufficient permissions to delete this document');
    }

    // Delete from FilesModule if fileId exists
    if (document.fileId) {
      try {
        await this.filesService.deleteFile(document.fileId, userId);
      } catch (error) {
        this.logger.warn(`Failed to delete file from FilesModule: ${error.message}`);
      }
    }

    // Delete broker document record
    await this.prisma.brokerDocument.delete({
      where: { id: documentId }
    });

    this.logger.log(`Document ${documentId} deleted securely for broker ${brokerId}`);
  }

  private async getUserRole(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { role: true }
    });

    return user?.role || 'USER';
  }

  private hasDocumentAccess(document: any, userRole: string, userId: string): boolean {
    // Admin and compliance roles can access all documents
    if (['ADMIN', 'COMPLIANCE', 'SALES'].includes(userRole)) {
      return true;
    }

    // Users can only access their own documents
    return document.uploadedBy === userId;
  }

  async updateComplianceStatus(
    brokerId: string,
    status: string,
    reason: string,
    verifiedBy?: string) {
    const account = await this.getBrokerAccount(brokerId);

    return await this.prisma.brokerAccount.update({
      where: { id: account.id },
      data: {
        complianceStatus: status,
        complianceNotes: reason,
        fscaVerified: status === 'APPROVED',
        fscaVerificationDate: new Date(),
        verifiedBy: verifiedBy || 'system'
      }
    });
  }
}
