import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Types
interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

interface PaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// New CRM Entity Types (matching Prisma schema)

export interface BrokerAccount {
  id: string;
  brokerId: string;
  accountType: string;
  businessNumber?: string;
  taxNumber?: string;
  vatRegistered: boolean;
  vatNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountType?: string;
  bankBranchCode?: string;
  swiftCode?: string;
  fscaVerified: boolean;
  fscaVerificationDate?: string;
  riskRating: string;
  complianceStatus: string;
  status: string;
  creditLimit: number;
  paymentTerms: number;
  createdAt: string;
  updatedAt: string;
  broker?: {
    id: string;
    companyName: string;
    email: string;
    phone: string;
    tier: string;
  };
  invoices?: BrokerInvoice[];
  payments?: BrokerPayment[];
  subscriptions?: BrokerSubscription[];
  notes?: BrokerNote[];
  documents?: BrokerDocument[];
}

export interface BrokerInvoice {
  id: string;
  brokerId: string;
  brokerAccountId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  subscriptionFee: number;
  apiUsageFee: number;
  transactionFee: number;
  overageFee: number;
  penaltyFee: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  status: string;
  paymentStatus: string;
  currency: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  broker?: BrokerAccount;
  payments?: BrokerPayment[];
  items?: BrokerInvoiceItem[];
}

export interface BrokerInvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType: string;
  referenceId?: string;
  referenceType?: string;
  createdAt: string;
}

export interface BrokerPayment {
  id: string;
  brokerId: string;
  invoiceId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
  reference?: string;
  status: string;
  currency: string;
  fees: number;
  netAmount: number;
  provider?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  broker?: BrokerAccount;
  invoice?: BrokerInvoice;
}

export interface BrokerSubscription {
  id: string;
  brokerId: string;
  brokerAccountId: string;
  tier: string;
  planType: string;
  price: number;
  currency: string;
  apiCallsLimit?: number;
  apiCallsUsed: number;
  clientLimit?: number;
  clientCount: number;
  features?: any;
  billingCycle: string;
  nextBillingDate: string;
  trialEndsAt?: string;
  status: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  broker?: BrokerAccount;
}

export interface BrokerNote {
  id: string;
  brokerId: string;
  brokerAccountId: string;
  authorId: string;
  title: string;
  content: string;
  category: string;
  priority: string;
  isInternal: boolean;
  isPinned: boolean;
  reminderDate?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  broker?: BrokerAccount;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface BrokerDocument {
  id: string;
  brokerId: string;
  brokerAccountId: string;
  documentType: string;
  title: string;
  description?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  expiryDate?: string;
  reminderSent: boolean;
  uploadedBy: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  broker?: BrokerAccount;
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  verifier?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface ClientRecord {
  id: string;
  userId: string;
  brokerId?: string;
  segment: string;
  source?: string;
  campaign?: string;
  totalTrades: number;
  totalVolume: number;
  totalPnl: number;
  avgTradeSize: number;
  lastActivityAt?: string;
  riskScore?: number;
  riskFactors?: any;
  preferredContact: string;
  marketingConsent: boolean;
  newsletterConsent: boolean;
  status: string;
  tags?: string[];
  customFields?: any;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    country?: string;
  };
  interactions?: ClientInteraction[];
}

export interface ClientInteraction {
  id: string;
  clientId: string;
  type: string;
  direction: string;
  subject?: string;
  content: string;
  channel: string;
  metadata?: any;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  client?: ClientRecord;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  brokerId?: string;
  clientId?: string;
  userId?: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo?: string;
  resolvedBy?: string;
  resolution?: string;
  satisfactionRating?: number;
  satisfactionFeedback?: string;
  escalationLevel: number;
  slaDeadline?: string;
  slaBreachNotified: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  broker?: BrokerAccount;
  client?: ClientRecord;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  messages?: TicketMessage[];
  attachments?: TicketAttachment[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  content: string;
  isInternal: boolean;
  metadata?: any;
  createdAt: string;
  ticket?: SupportTicket;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  ticketId: string;
  messageId?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  metadata?: any;
  createdAt: string;
  ticket?: SupportTicket;
  uploader?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface BrokerDeal {
  id: string;
  brokerId: string;
  title: string;
  description?: string;
  value: number;
  currency: string;
  stageId: string;
  probability: number;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  assignedTo?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  tags?: string[];
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  broker?: BrokerAccount;
  stage?: {
    id: string;
    name: string;
    description?: string;
    probability: number;
    position: number;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  activities?: DealActivity[];
}

export interface DealActivity {
  id: string;
  dealId: string;
  type: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  completedAt?: string;
  createdBy: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  deal?: BrokerDeal;
  creator?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface DealStage {
  id: string;
  name: string;
  description?: string;
  probability: number;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueAnalytics {
  period: string;
  totalRevenue: number;
  revenueByTier: Record<string, number>;
  revenueByType: Record<string, number>;
  growth: number;
  forecast: number;
}

export interface BillingSummary {
  brokerId: string;
  totalInvoices: number;
  totalAmount: number;
  amountPaid: number;
  amountOutstanding: number;
  overdueAmount: number;
  averagePaymentTime: number;
  subscriptionTier: string;
  nextBillingDate?: string;
}

export interface ComplianceStatus {
  brokerId: string;
  overallStatus: string;
  documentsStatus: Record<string, number>;
  expiryAlerts: number;
  lastVerifiedAt?: string;
  riskRating: string;
  requiresAction: boolean;
}

// CRM Types
export interface Lead {
  id: string;
  ticketNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  position?: string;
  country?: string;
  region?: string;
  estimatedRevenue?: number;
  leadScore: number;
  assignedTo?: string;
  status: string;
  source: string;
  notes?: string;
  metadata?: Record<string, any>;
  convertedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  leadId?: string;
  brokerId: string;
  name: string;
  stage: string;
  value: number;
  probability: number;
  expectedCloseDate?: string;
  actualCloseDate?: string;
  lostReason?: string;
  assignedTo?: string;
  products?: string[];
  competitors?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  opportunityId?: string;
  brokerId: string;
  contractNumber: string;
  title: string;
  description?: string;
  value: number;
  currency: string;
  startDate: string;
  endDate: string;
  status: string;
  terms?: string;
  signedAt?: string;
  signedBy?: string;
  terminationReason?: string;
  terminationDate?: string;
  renewalTerms?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  entityType: string;
  entityId: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  scheduledAt?: string;
  completedAt?: string;
  duration?: number;
  outcome?: string;
  assignedTo?: string;
  participants?: Array<{
    name: string;
    email: string;
    type: 'INTERNAL' | 'EXTERNAL';
  }>;
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }>;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMDashboard {
  leads: {
    byStatus: Array<{ status: string; count: string }>;
    total: number;
    qualified: number;
  };
  opportunities: {
    byStage: Array<{ stage: string; count: string; totalValue: string }>;
    totalValue: number;
    pipelineValue: number;
  };
  conversion: {
    leadToOpportunity: number;
    opportunityToWin: number;
    overallConversion: number;
  };
  forecast: {
    period: string;
    opportunities: Array<{
      id: string;
      name: string;
      brokerName: string;
      expectedCloseDate: string;
      value: number;
      probability: number;
      weightedValue: number;
      stage: string;
    }>;
    totalValue: number;
    averageProbability: number;
  };
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  status?: string;
  assignedTo?: string;
  brokerId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface OpportunityFilters {
  page?: number;
  limit?: number;
  stage?: string;
  assignedTo?: string;
  brokerId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface ContractFilters {
  page?: number;
  limit?: number;
  status?: string;
  assignedTo?: string;
  brokerId?: string;
  dateRange?: { start: Date; end: Date };
}

// New CRM Filter Types
export interface BrokerFilters {
  page?: number;
  limit?: number;
  status?: string;
  tier?: string;
  search?: string;
  complianceStatus?: string;
  riskRating?: string;
  fscaVerified?: boolean;
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  brokerId?: string;
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  overdue?: boolean;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  brokerId?: string;
  invoiceId?: string;
  status?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  brokerId?: string;
  clientId?: string;
  status?: string;
  priority?: string;
  category?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  escalationLevel?: number;
}

export interface DealFilters {
  page?: number;
  limit?: number;
  brokerId?: string;
  stageId?: string;
  assignedTo?: string;
  valueMin?: number;
  valueMax?: number;
  expectedCloseStart?: string;
  expectedCloseEnd?: string;
  tags?: string[];
}

export interface ClientFilters {
  page?: number;
  limit?: number;
  brokerId?: string;
  segment?: string;
  source?: string;
  status?: string;
  lastActivityAfter?: string;
  riskScoreMin?: number;
  riskScoreMax?: number;
  tags?: string[];
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  brokerId?: string;
  tier?: string;
  groupBy?: string;
}

export interface PaymentInitiationData {
  invoiceId: string;
  provider: 'PAYSTACK' | 'PAYFAST' | 'WALLET';
  returnUrl?: string;
  metadata?: any;
}

export interface FileUploadData {
  file: File;
  documentType: string;
  description?: string;
  metadata?: any;
}

export interface DocumentVerificationData {
  status: 'APPROVED' | 'REJECTED';
  notes?: string;
  expiryDate?: string;
}

// CRM API Client
class CRMClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Dashboard
  async getDashboard(filters: {
    startDate?: string;
    endDate?: string;
    assignedTo?: string;
    brokerId?: string;
  }): Promise<ApiResponse<CRMDashboard>> {
    const response = await this.client.get('/crm/dashboard', { params: filters });
    return response.data;
  }

  // Leads
  async getLeads(filters: LeadFilters = {}): Promise<ApiResponse<PaginatedResponse<Lead>>> {
    const response = await this.client.get('/leads', { params: filters });
    return response.data;
  }

  async getLeadById(id: string): Promise<ApiResponse<Lead>> {
    const response = await this.client.get(`/leads/${id}`);
    return response.data;
  }

  async createLead(leadData: Partial<Lead>): Promise<ApiResponse<Lead>> {
    const response = await this.client.post('/leads', leadData);
    return response.data;
  }

  async updateLead(id: string, leadData: Partial<Lead>): Promise<ApiResponse<Lead>> {
    const response = await this.client.put(`/leads/${id}`, leadData);
    return response.data;
  }

  async deleteLead(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/leads/${id}`);
    return response.data;
  }

  async updateLeadStatus(id: string, status: string, notes?: string): Promise<ApiResponse<Lead>> {
    const response = await this.client.put(`/leads/${id}/status`, { status, notes });
    return response.data;
  }

  async assignLead(id: string, managerId: string): Promise<ApiResponse<Lead>> {
    const response = await this.client.post(`/leads/${id}/assign`, { managerId });
    return response.data;
  }

  async convertLeadToOpportunity(id: string, opportunityData: Partial<Opportunity>): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.post(`/leads/${id}/convert`, opportunityData);
    return response.data;
  }

  async scoreLead(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.post(`/leads/${id}/score`);
    return response.data;
  }

  async exportLeads(filters: LeadFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/leads/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  async getLeadStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/leads/stats/overview', { params: { period } });
    return response.data;
  }

  // Opportunities
  async getOpportunities(filters: OpportunityFilters = {}): Promise<ApiResponse<PaginatedResponse<Opportunity>>> {
    const response = await this.client.get('/opportunities', { params: filters });
    return response.data;
  }

  async getOpportunityById(id: string): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.get(`/opportunities/${id}`);
    return response.data;
  }

  async createOpportunity(opportunityData: Partial<Opportunity>): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.post('/opportunities', opportunityData);
    return response.data;
  }

  async updateOpportunity(id: string, opportunityData: Partial<Opportunity>): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.put(`/opportunities/${id}`, opportunityData);
    return response.data;
  }

  async deleteOpportunity(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/opportunities/${id}`);
    return response.data;
  }

  async updateOpportunityStage(id: string, stage: string, notes?: string): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.put(`/opportunities/${id}/stage`, { stage, notes });
    return response.data;
  }

  async closeWonOpportunity(id: string, actualValue?: number, notes?: string): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.post(`/opportunities/${id}/won`, { actualValue, notes });
    return response.data;
  }

  async closeLostOpportunity(id: string, lostReason: string, notes?: string): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.post(`/opportunities/${id}/lost`, { lostReason, notes });
    return response.data;
  }

  async assignOpportunity(id: string, managerId: string): Promise<ApiResponse<Opportunity>> {
    const response = await this.client.post(`/opportunities/${id}/assign`, { managerId });
    return response.data;
  }

  async exportOpportunities(filters: OpportunityFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/opportunities/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  async getOpportunityStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/opportunities/stats/overview', { params: { period } });
    return response.data;
  }

  async getPipelineValue(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/opportunities/pipeline/value');
    return response.data;
  }

  // Contracts
  async getContracts(filters: ContractFilters = {}): Promise<ApiResponse<PaginatedResponse<Contract>>> {
    const response = await this.client.get('/contracts', { params: filters });
    return response.data;
  }

  async getContractById(id: string): Promise<ApiResponse<Contract>> {
    const response = await this.client.get(`/contracts/${id}`);
    return response.data;
  }

  async createContract(contractData: Partial<Contract>): Promise<ApiResponse<Contract>> {
    const response = await this.client.post('/contracts', contractData);
    return response.data;
  }

  async updateContract(id: string, contractData: Partial<Contract>): Promise<ApiResponse<Contract>> {
    const response = await this.client.put(`/contracts/${id}`, contractData);
    return response.data;
  }

  async deleteContract(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/contracts/${id}`);
    return response.data;
  }

  async updateContractStatus(id: string, status: string, notes?: string): Promise<ApiResponse<Contract>> {
    const response = await this.client.put(`/contracts/${id}/status`, { status, notes });
    return response.data;
  }

  async signContract(id: string, signedAt?: string, signedBy?: string, notes?: string): Promise<ApiResponse<Contract>> {
    const response = await this.client.post(`/contracts/${id}/sign`, { signedAt, signedBy, notes });
    return response.data;
  }

  async terminateContract(id: string, terminationReason: string, terminationDate?: string, notes?: string): Promise<ApiResponse<Contract>> {
    const response = await this.client.post(`/contracts/${id}/terminate`, { terminationReason, terminationDate, notes });
    return response.data;
  }

  async renewContract(id: string, newEndDate: string, renewalTerms?: string, notes?: string): Promise<ApiResponse<Contract>> {
    const response = await this.client.post(`/contracts/${id}/renew`, { newEndDate, renewalTerms, notes });
    return response.data;
  }

  async getContractDocuments(id: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/contracts/${id}/documents`);
    return response.data;
  }

  async uploadContractDocument(id: string, documentData: { name: string; url: string; type: string; size?: number }): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/contracts/${id}/documents`, documentData);
    return response.data;
  }

  async deleteContractDocument(id: string, documentId: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/contracts/${id}/documents/${documentId}`);
    return response.data;
  }

  async exportContracts(filters: ContractFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/contracts/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  async getContractStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/contracts/stats/overview', { params: { period } });
    return response.data;
  }

  async getExpiringContracts(days: number = 30): Promise<ApiResponse<Contract[]>> {
    const response = await this.client.get('/contracts/expiring', { params: { days } });
    return response.data;
  }

  // Activities
  async getActivityTimeline(entityType: string, entityId: string): Promise<ApiResponse<Activity[]>> {
    const response = await this.client.get(`/crm/activities/${entityType}/${entityId}`);
    return response.data;
  }

  async getSalesForecast(periodDays: number = 30): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/forecast', { params: { periodDays } });
    return response.data;
  }

  // ========== NEW CRM MODULE METHODS ==========

  // Brokers Management
  async createBrokerAccount(brokerData: Partial<BrokerAccount>): Promise<ApiResponse<BrokerAccount>> {
    const response = await this.client.post('/crm/brokers', brokerData);
    return response.data;
  }

  async getAllBrokerAccounts(filters: BrokerFilters = {}): Promise<ApiResponse<PaginatedResponse<BrokerAccount>>> {
    const response = await this.client.get('/crm/brokers', { params: filters });
    return response.data;
  }

  async getBrokerAccount(id: string): Promise<ApiResponse<BrokerAccount>> {
    const response = await this.client.get(`/api/v1/crm/brokers/${id}`);
    return response.data;
  }

  async updateBrokerAccount(id: string, data: Partial<BrokerAccount>): Promise<ApiResponse<BrokerAccount>> {
    const response = await this.client.patch(`/api/v1/crm/brokers/${id}`, data);
    return response.data;
  }

  async uploadBrokerDocument(id: string, uploadData: FileUploadData): Promise<ApiResponse<BrokerDocument>> {
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('documentType', uploadData.documentType);
    if (uploadData.description) {
      formData.append('description', uploadData.description);
    }
    if (uploadData.metadata) {
      formData.append('metadata', JSON.stringify(uploadData.metadata));
    }

    const response = await this.client.post(`/api/v1/crm/brokers/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async verifyBrokerDocument(id: string, docId: string, verificationData: DocumentVerificationData): Promise<ApiResponse<BrokerDocument>> {
    const response = await this.client.patch(`/api/v1/crm/brokers/${id}/documents/${docId}/verify`, verificationData);
    return response.data;
  }

  async addBrokerNote(id: string, noteData: { title: string; content: string; category: string; priority?: string }): Promise<ApiResponse<BrokerNote>> {
    const response = await this.client.post(`/api/v1/crm/brokers/${id}/notes`, noteData);
    return response.data;
  }

  async getBrokerComplianceStatus(id: string): Promise<ApiResponse<ComplianceStatus>> {
    const response = await this.client.get(`/api/v1/crm/brokers/${id}/compliance`);
    return response.data;
  }

  async updateBrokerComplianceStatus(id: string, status: string, reason?: string): Promise<ApiResponse<BrokerAccount>> {
    const response = await this.client.patch(`/api/v1/crm/brokers/${id}/compliance`, { status, reason });
    return response.data;
  }

  // Billing Management
  async generateInvoice(invoiceData: Partial<BrokerInvoice>): Promise<ApiResponse<BrokerInvoice>> {
    const response = await this.client.post('/crm/billing/invoices', invoiceData);
    return response.data;
  }

  async getInvoices(filters: InvoiceFilters = {}): Promise<ApiResponse<PaginatedResponse<BrokerInvoice>>> {
    const response = await this.client.get('/crm/billing/invoices', { params: filters });
    return response.data;
  }

  async getInvoiceById(id: string): Promise<ApiResponse<BrokerInvoice>> {
    const response = await this.client.get(`/api/v1/crm/billing/invoices/${id}`);
    return response.data;
  }

  async sendInvoice(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.post(`/api/v1/crm/billing/invoices/${id}/send`);
    return response.data;
  }

  async recordPayment(paymentData: Partial<BrokerPayment>): Promise<ApiResponse<BrokerPayment>> {
    const response = await this.client.post('/crm/billing/payments', paymentData);
    return response.data;
  }

  async getPayments(filters: PaymentFilters = {}): Promise<ApiResponse<PaginatedResponse<BrokerPayment>>> {
    const response = await this.client.get('/crm/billing/payments', { params: filters });
    return response.data;
  }

  async getBrokerBillingSummary(brokerId: string): Promise<ApiResponse<BillingSummary>> {
    const response = await this.client.get(`/api/v1/crm/billing/summary/${brokerId}`);
    return response.data;
  }

  async getRevenueAnalytics(filters: AnalyticsFilters = {}): Promise<ApiResponse<RevenueAnalytics>> {
    const response = await this.client.get('/crm/billing/analytics', { params: filters });
    return response.data;
  }

  async getOverdueInvoices(filters: InvoiceFilters = {}): Promise<ApiResponse<PaginatedResponse<BrokerInvoice>>> {
    const response = await this.client.get('/crm/billing/invoices/overdue', { params: { ...filters, overdue: true } });
    return response.data;
  }

  async initiatePayment(paymentData: PaymentInitiationData): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/billing/payments/initiate', paymentData);
    return response.data;
  }

  async generateInvoicePDF(invoiceId: string): Promise<ApiResponse<{ url: string }>> {
    const response = await this.client.get(`/api/v1/crm/billing/invoices/${invoiceId}/pdf`);
    return response.data;
  }

  // Support Management
  async createTicket(ticketData: Partial<SupportTicket>): Promise<ApiResponse<SupportTicket>> {
    const response = await this.client.post('/crm/support/tickets', ticketData);
    return response.data;
  }

  async getTickets(filters: TicketFilters = {}): Promise<ApiResponse<PaginatedResponse<SupportTicket>>> {
    const response = await this.client.get('/crm/support/tickets', { params: filters });
    return response.data;
  }

  async getTicketById(id: string): Promise<ApiResponse<SupportTicket>> {
    const response = await this.client.get(`/api/v1/crm/support/tickets/${id}`);
    return response.data;
  }

  async updateTicket(id: string, data: Partial<SupportTicket>): Promise<ApiResponse<SupportTicket>> {
    const response = await this.client.patch(`/api/v1/crm/support/tickets/${id}`, data);
    return response.data;
  }

  async addTicketMessage(id: string, content: string, isInternal: boolean = false, attachment?: File): Promise<ApiResponse<TicketMessage>> {
    const formData = new FormData();
    formData.append('content', content);
    formData.append('isInternal', isInternal.toString());
    if (attachment) {
      formData.append('attachment', attachment);
    }

    const response = await this.client.post(`/api/v1/crm/support/tickets/${id}/messages`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async assignTicket(id: string, assigneeId: string, notes?: string): Promise<ApiResponse<SupportTicket>> {
    const response = await this.client.patch(`/api/v1/crm/support/tickets/${id}/assign`, { assigneeId, notes });
    return response.data;
  }

  async closeTicket(id: string, notes?: string, rating?: number, feedback?: string): Promise<ApiResponse<SupportTicket>> {
    const response = await this.client.patch(`/api/v1/crm/support/tickets/${id}/close`, { notes, rating, feedback });
    return response.data;
  }

  async getTicketSLAStatus(id: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/support/tickets/${id}/sla`);
    return response.data;
  }

  // Pipeline Management
  async createDeal(dealData: Partial<BrokerDeal>): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.post('/crm/pipeline/deals', dealData);
    return response.data;
  }

  async getDeals(filters: DealFilters = {}): Promise<ApiResponse<PaginatedResponse<BrokerDeal>>> {
    const response = await this.client.get('/crm/pipeline/deals', { params: filters });
    return response.data;
  }

  async getDealById(id: string): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.get(`/api/v1/crm/pipeline/deals/${id}`);
    return response.data;
  }

  async updateDeal(id: string, data: Partial<BrokerDeal>): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.patch(`/api/v1/crm/pipeline/deals/${id}`, data);
    return response.data;
  }

  async moveDeal(id: string, stageId: string, notes?: string): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.patch(`/api/v1/crm/pipeline/deals/${id}/move`, { stageId, notes });
    return response.data;
  }

  async addDealActivity(id: string, activityData: Partial<DealActivity>): Promise<ApiResponse<DealActivity>> {
    const response = await this.client.post(`/api/v1/crm/pipeline/deals/${id}/activities`, activityData);
    return response.data;
  }

  async closeDealWon(id: string, value?: number, notes?: string): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.patch(`/api/v1/crm/pipeline/deals/${id}/close-won`, { value, notes });
    return response.data;
  }

  async closeDealLost(id: string, reason: string, notes?: string): Promise<ApiResponse<BrokerDeal>> {
    const response = await this.client.patch(`/api/v1/crm/pipeline/deals/${id}/close-lost`, { reason, notes });
    return response.data;
  }

  async getForecast(filters: AnalyticsFilters = {}): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/pipeline/forecast', { params: filters });
    return response.data;
  }

  async getKanbanView(filters: DealFilters = {}): Promise<ApiResponse<{ stages: DealStage[]; deals: BrokerDeal[] }>> {
    const response = await this.client.get('/crm/pipeline/kanban', { params: filters });
    return response.data;
  }

  async getDealStages(): Promise<ApiResponse<DealStage[]>> {
    const response = await this.client.get('/crm/pipeline/stages');
    return response.data;
  }

  // Client Management
  async createClient(clientData: Partial<ClientRecord>): Promise<ApiResponse<ClientRecord>> {
    const response = await this.client.post('/crm/clients', clientData);
    return response.data;
  }

  async getClients(filters: ClientFilters = {}): Promise<ApiResponse<PaginatedResponse<ClientRecord>>> {
    const response = await this.client.get('/crm/clients', { params: filters });
    return response.data;
  }

  async getClientById(id: string): Promise<ApiResponse<ClientRecord>> {
    const response = await this.client.get(`/api/v1/crm/clients/${id}`);
    return response.data;
  }

  async updateClient(id: string, data: Partial<ClientRecord>): Promise<ApiResponse<ClientRecord>> {
    const response = await this.client.patch(`/api/v1/crm/clients/${id}`, data);
    return response.data;
  }

  async addClientInteraction(id: string, interactionData: Partial<ClientInteraction>): Promise<ApiResponse<ClientInteraction>> {
    const response = await this.client.post(`/api/v1/crm/clients/${id}/interactions`, interactionData);
    return response.data;
  }

  async getClientInteractions(id: string): Promise<ApiResponse<ClientInteraction[]>> {
    const response = await this.client.get(`/api/v1/crm/clients/${id}/interactions`);
    return response.data;
  }

  // Utilities and Analytics
  async getAnalyticsRevenue(filters: AnalyticsFilters = {}): Promise<ApiResponse<RevenueAnalytics>> {
    const response = await this.client.get('/crm/analytics/revenue', { params: filters });
    return response.data;
  }

  async runInvoiceJob(): Promise<ApiResponse<void>> {
    const response = await this.client.post('/crm/admin/invoice-job');
    return response.data;
  }

  async exportBrokerInvoices(filters: InvoiceFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/crm/billing/invoices/export', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  async exportBrokerPayments(filters: PaymentFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/crm/billing/payments/export', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  async getSystemAnalytics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/system');
    return response.data;
  }

  // Additional methods for complete CRM functionality

  // Bulk Operations
  async bulkUpdateBrokersStatus(ids: string[], status: string, reason?: string): Promise<ApiResponse<any>> {
    const response = await this.client.patch('/crm/brokers/bulk-status', {
      ids,
      status,
      reason
    });
    return response.data;
  }

  async bulkSendInvoices(invoiceIds: string[]): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/billing/invoices/bulk-send', {
      invoiceIds
    });
    return response.data;
  }

  async bulkAssignTickets(ticketIds: string[], assigneeId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/support/tickets/bulk-assign', {
      ticketIds,
      assigneeId
    });
    return response.data;
  }

  // Advanced Analytics
  async getConversionAnalytics(filters: AnalyticsFilters = {}): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/conversions', { params: filters });
    return response.data;
  }

  async getPerformanceAnalytics(filters: AnalyticsFilters = {}): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/performance', { params: filters });
    return response.data;
  }

  async getComplianceReport(filters: any = {}): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/compliance', { params: filters });
    return response.data;
  }

  // Workflow Automation
  async triggerWorkflow(workflowType: string, entityId: string, options?: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/workflows/trigger', {
      workflowType,
      entityId,
      options
    });
    return response.data;
  }

  async getWorkflowHistory(entityId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/workflows/history/${entityId}`);
    return response.data;
  }

  // File management with progress tracking
  async uploadFileWithProgress(file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const config = {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      };

      this.client.post('/crm/upload', formData, config)
        .then((response) => {
          resolve(response.data);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  // Search and filtering
  async searchGlobal(query: string, filters?: any): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/search', {
      params: { q: query, ...filters }
    });
    return response.data;
  }

  // Integration with other modules
  async getWalletBalance(brokerId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/brokers/${brokerId}/wallet-balance`);
    return response.data;
  }

  async creditWallet(brokerId: string, amount: number, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/brokers/${brokerId}/credit-wallet`, {
      amount,
      reason
    });
    return response.data;
  }

  async sendNotification(notificationData: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/notifications/send', notificationData);
    return response.data;
  }

  // Template management
  async getEmailTemplates(type?: string): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/templates/email', {
      params: { type }
    });
    return response.data;
  }

  async updateEmailTemplate(templateId: string, templateData: any): Promise<ApiResponse<any>> {
    const response = await this.client.patch(`/api/v1/crm/templates/email/${templateId}`, templateData);
    return response.data;
  }

  // Import/Export
  async importClients(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/crm/clients/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getClientsImportTemplate(): Promise<ApiResponse<string>> {
    const response = await this.client.get('/crm/clients/import-template', {
      responseType: 'blob'
    });
    return response.data;
  }

  // Audit and Logging
  async getAuditLog(filters: any = {}): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/audit-log', { params: filters });
    return response.data;
  }

  async getActivityLog(entityType: string, entityId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/activity/${entityType}/${entityId}`);
    return response.data;
  }

  // Health checks
  async getCRMHealth(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/health');
    return response.data;
  }

  async getAPIUsageStats(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/stats/usage');
    return response.data;
  }

  // CRM Settings
  async getSettings(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/settings');
    return response.data;
  }

  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    const response = await this.client.put('/crm/settings', settings);
    return response.data;
  }

  async testEmailSettings(email: string): Promise<ApiResponse<void>> {
    const response = await this.client.post('/crm/settings/test-email', { email });
    return response.data;
  }

  async resetSettingsToDefault(): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/settings/reset');
    return response.data;
  }

  // Invoice Management
  async getInvoice(invoiceId: string): Promise<ApiResponse<BrokerInvoice>> {
    const response = await this.client.get(`/api/v1/crm/invoices/${invoiceId}`);
    return response.data;
  }

  async downloadInvoice(invoiceId: string, format: 'pdf' | 'excel'): Promise<ApiResponse<Blob>> {
    const response = await this.client.get(`/api/v1/crm/invoices/${invoiceId}/download`, {
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  async updateInvoiceStatus(invoiceId: string, data: { status: string; notes?: string }): Promise<ApiResponse<BrokerInvoice>> {
    const response = await this.client.put(`/api/v1/crm/invoices/${invoiceId}/status`, data);
    return response.data;
  }

  async getPaymentHistory(invoiceId: string): Promise<ApiResponse<any[]>> {
    const response = await this.client.get(`/api/v1/crm/invoices/${invoiceId}/payments`);
    return response.data;
  }

  async generateCreditNote(invoiceId: string, data: { reason: string; amount?: number }): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/invoices/${invoiceId}/credit-note`, data);
    return response.data;
  }

  async writeOffInvoice(invoiceId: string, data: { reason: string; amount: number }): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/invoices/${invoiceId}/write-off`, data);
    return response.data;
  }

  async voidInvoice(invoiceId: string, reason: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/invoices/${invoiceId}/void`, { reason });
    return response.data;
  }

  // Invoice Templates
  async getInvoiceTemplates(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/crm/invoices/templates');
    return response.data;
  }

  async createInvoiceTemplate(template: any): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/invoices/templates', template);
    return response.data;
  }

  async updateInvoiceTemplate(templateId: string, template: any): Promise<ApiResponse<any>> {
    const response = await this.client.put(`/api/v1/crm/invoices/templates/${templateId}`, template);
    return response.data;
  }

  async deleteInvoiceTemplate(templateId: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/api/v1/crm/invoices/templates/${templateId}`);
    return response.data;
  }

  
  async getClientAnalytics(clientId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/analytics/clients/${clientId}`);
    return response.data;
  }

  async getBrokerAnalytics(brokerId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/analytics/brokers/${brokerId}`);
    return response.data;
  }

  async getTicketMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/tickets/metrics', { params: { period } });
    return response.data;
  }

  async getBillingMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/billing/metrics', { params: { period } });
    return response.data;
  }

  async getSalesMetrics(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/analytics/sales/metrics', { params: { period } });
    return response.data;
  }

  // Data Import/Export
  async importBrokers(file: File, options: { skipDuplicates?: boolean; updateExisting?: boolean }): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (options.skipDuplicates) formData.append('skipDuplicates', 'true');
    if (options.updateExisting) formData.append('updateExisting', 'true');

    const response = await this.client.post('/crm/import/brokers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  
  async getImportHistory(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/crm/import/history');
    return response.data;
  }

  async getImportDetails(importId: string): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/api/v1/crm/import/${importId}`);
    return response.data;
  }

  async retryImport(importId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/import/${importId}/retry`);
    return response.data;
  }

  async cancelImport(importId: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/api/v1/crm/import/${importId}`);
    return response.data;
  }

  // System Configuration
  async getSystemInfo(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/system/info');
    return response.data;
  }

  async getSystemLogs(filters: { level?: string; startDate?: string; endDate?: string; limit?: number } = {}): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/crm/system/logs', { params: filters });
    return response.data;
  }

  async getSystemMetrics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/crm/system/metrics');
    return response.data;
  }

  async performSystemMaintenance(action: string, options: any = {}): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/system/maintenance', { action, options });
    return response.data;
  }

  async getBackupHistory(): Promise<ApiResponse<any[]>> {
    const response = await this.client.get('/crm/system/backups');
    return response.data;
  }

  async createBackup(options: { includeFiles?: boolean; compress?: boolean } = {}): Promise<ApiResponse<any>> {
    const response = await this.client.post('/crm/system/backups', options);
    return response.data;
  }

  async restoreBackup(backupId: string): Promise<ApiResponse<any>> {
    const response = await this.client.post(`/api/v1/crm/system/backups/${backupId}/restore`);
    return response.data;
  }
}

// Export singleton instance
export const crmApi = new CRMClient();
export default crmApi;