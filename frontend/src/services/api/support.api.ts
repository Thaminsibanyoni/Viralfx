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

// Support Types
export interface Ticket {
  id: string;
  ticketNumber: string;
  userId?: string;
  brokerId?: string;
  categoryId: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  assignedTo?: string;
  tags?: string[];
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }>;
  metadata?: Record<string, any>;
  firstResponseAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  content: string;
  isInternal: boolean;
  authorId: string;
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  icon?: string;
  color?: string;
  isActive: boolean;
  defaultPriority?: string;
  defaultAssignedTo?: string;
  slaId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SLA {
  id: string;
  name: string;
  description: string;
  responseTime: number;
  resolutionTime: number;
  businessHoursOnly: boolean;
  timezone: string;
  workingDays: number[];
  workingHours: {
    start: string;
    end: string;
  };
  escalationRules: Array<{
    delay: number;
    assignedTo: string;
    notify: boolean;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSLA {
  id: string;
  ticketId: string;
  slaId: string;
  responseDueAt: string;
  resolutionDueAt: string;
  responseMetAt?: string;
  resolutionMetAt?: string;
  responseBreachedAt?: string;
  resolutionBreachedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  categoryId?: string;
  tags?: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  views: number;
  helpful: number;
  notHelpful: number;
  authorId: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportDashboard {
  summary: {
    totalTickets: number;
    newTickets: number;
    openTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    overdueTickets: number;
    avgResolutionTime: number;
    slaComplianceRate: number;
  };
  charts: {
    ticketsByStatus: Array<{ status: string; count: number }>;
    ticketsByPriority: Array<{ priority: string; count: number }>;
    ticketsByCategory: Array<{ category: string; count: number }>;
  };
  knowledgeBase: {
    totalArticles: number;
    publishedArticles: number;
    totalViews: number;
  };
}

export interface TicketFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  assignedTo?: string;
  userId?: string;
  brokerId?: string;
  categoryId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface CreateTicketDto {
  subject: string;
  description: string;
  categoryId: string;
  priority?: string;
  userId?: string;
  brokerId?: string;
  tags?: string[];
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }>;
  metadata?: Record<string, any>;
}

export interface AddMessageDto {
  content: string;
  isInternal: boolean;
  attachments?: Array<{
    url: string;
    name: string;
    size: number;
    type: string;
  }>;
}

// Support API Client
class SupportClient {
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
  async getDashboard(period: string = 'month'): Promise<ApiResponse<SupportDashboard>> {
    const response = await this.client.get('/support/dashboard', { params: { period } });
    return response.data;
  }

  // Tickets
  async getTickets(filters: TicketFilters = {}): Promise<ApiResponse<PaginatedResponse<Ticket>>> {
    const response = await this.client.get('/support/tickets', { params: filters });
    return response.data;
  }

  async getTicketById(id: string): Promise<ApiResponse<Ticket>> {
    const response = await this.client.get(`/support/tickets/${id}`);
    return response.data;
  }

  async createTicket(ticketData: CreateTicketDto): Promise<ApiResponse<Ticket>> {
    const response = await this.client.post('/support/tickets', ticketData);
    return response.data;
  }

  async updateTicket(id: string, ticketData: Partial<Ticket>): Promise<ApiResponse<Ticket>> {
    const response = await this.client.put(`/support/tickets/${id}`, ticketData);
    return response.data;
  }

  async deleteTicket(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/support/tickets/${id}`);
    return response.data;
  }

  async updateTicketStatus(id: string, status: string, notes?: string): Promise<ApiResponse<Ticket>> {
    const response = await this.client.put(`/support/tickets/${id}/status`, { status, notes });
    return response.data;
  }

  async assignTicket(id: string, assignedTo: string): Promise<ApiResponse<Ticket>> {
    const response = await this.client.post(`/support/tickets/${id}/assign`, { assignedTo });
    return response.data;
  }

  async addTicketMessage(id: string, messageData: AddMessageDto): Promise<ApiResponse<TicketMessage>> {
    const response = await this.client.post(`/support/tickets/${id}/messages`, messageData);
    return response.data;
  }

  async getTicketMessages(id: string, includeInternal: boolean = false): Promise<ApiResponse<TicketMessage[]>> {
    const response = await this.client.get(`/support/tickets/${id}/messages`, {
      params: { includeInternal }
    });
    return response.data;
  }

  async getTicketStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/tickets/stats/overview', { params: { period } });
    return response.data;
  }

  async exportTickets(filters: TicketFilters = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/support/tickets/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  // Categories
  async getCategories(): Promise<ApiResponse<TicketCategory[]>> {
    const response = await this.client.get('/support/categories');
    return response.data;
  }

  async getCategoryById(id: string): Promise<ApiResponse<TicketCategory>> {
    const response = await this.client.get(`/support/categories/${id}`);
    return response.data;
  }

  async createCategory(categoryData: Partial<TicketCategory>): Promise<ApiResponse<TicketCategory>> {
    const response = await this.client.post('/support/categories', categoryData);
    return response.data;
  }

  async updateCategory(id: string, categoryData: Partial<TicketCategory>): Promise<ApiResponse<TicketCategory>> {
    const response = await this.client.put(`/support/categories/${id}`, categoryData);
    return response.data;
  }

  async deleteCategory(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/support/categories/${id}`);
    return response.data;
  }

  // SLA Management
  async getSLAs(): Promise<ApiResponse<SLA[]>> {
    const response = await this.client.get('/support/sla');
    return response.data;
  }

  async getSLAById(id: string): Promise<ApiResponse<SLA>> {
    const response = await this.client.get(`/support/sla/${id}`);
    return response.data;
  }

  async createSLA(slaData: Partial<SLA>): Promise<ApiResponse<SLA>> {
    const response = await this.client.post('/support/sla', slaData);
    return response.data;
  }

  async updateSLA(id: string, slaData: Partial<SLA>): Promise<ApiResponse<SLA>> {
    const response = await this.client.put(`/support/sla/${id}`, slaData);
    return response.data;
  }

  async deleteSLA(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/support/sla/${id}`);
    return response.data;
  }

  async getTicketSLAs(filters: {
    page?: number;
    limit?: number;
    status?: string;
    risk?: string;
  } = {}): Promise<ApiResponse<PaginatedResponse<TicketSLA>>> {
    const response = await this.client.get('/support/sla/tickets', { params: filters });
    return response.data;
  }

  async getSLAStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/sla/stats', { params: { period } });
    return response.data;
  }

  // Knowledge Base
  async getArticles(filters: {
    page?: number;
    limit?: number;
    status?: string;
    categoryId?: string;
    tags?: string[];
    search?: string;
    authorId?: string;
    dateRange?: { start: Date; end: Date };
  } = {}): Promise<ApiResponse<PaginatedResponse<KnowledgeBaseArticle>>> {
    const response = await this.client.get('/support/knowledge-base', { params: filters });
    return response.data;
  }

  async getArticleById(id: string): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.get(`/support/knowledge-base/${id}`);
    return response.data;
  }

  async getArticleBySlug(slug: string): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.get(`/support/knowledge-base/slug/${slug}`);
    return response.data;
  }

  async createArticle(articleData: Partial<KnowledgeBaseArticle>): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.post('/support/knowledge-base', articleData);
    return response.data;
  }

  async updateArticle(id: string, articleData: Partial<KnowledgeBaseArticle>): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.put(`/support/knowledge-base/${id}`, articleData);
    return response.data;
  }

  async deleteArticle(id: string): Promise<ApiResponse<void>> {
    const response = await this.client.delete(`/support/knowledge-base/${id}`);
    return response.data;
  }

  async publishArticle(id: string): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.post(`/support/knowledge-base/${id}/publish`);
    return response.data;
  }

  async archiveArticle(id: string): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.post(`/support/knowledge-base/${id}/archive`);
    return response.data;
  }

  async incrementViews(id: string): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.post(`/support/knowledge-base/${id}/views`);
    return response.data;
  }

  async markHelpful(id: string, helpful: boolean): Promise<ApiResponse<KnowledgeBaseArticle>> {
    const response = await this.client.post(`/support/knowledge-base/${id}/helpful`, { helpful });
    return response.data;
  }

  async searchArticles(query: string, filters: {
    categoryId?: string;
    tags?: string[];
    limit?: number;
  } = {}): Promise<ApiResponse<KnowledgeBaseArticle[]>> {
    const response = await this.client.get('/support/knowledge-base/search', {
      params: { q: query, ...filters }
    });
    return response.data;
  }

  async getRelatedArticles(articleId: string, limit: number = 5): Promise<ApiResponse<KnowledgeBaseArticle[]>> {
    const response = await this.client.get(`/support/knowledge-base/${articleId}/related`, {
      params: { limit }
    });
    return response.data;
  }

  async getPopularArticles(limit: number = 10, period: string = 'month'): Promise<ApiResponse<KnowledgeBaseArticle[]>> {
    const response = await this.client.get('/support/knowledge-base/popular', {
      params: { limit, period }
    });
    return response.data;
  }

  async getArticleStats(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/knowledge-base/stats', { params: { period } });
    return response.data;
  }

  async exportArticles(filters: any = {}): Promise<ApiResponse<string>> {
    const response = await this.client.get('/support/knowledge-base/export/csv', {
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  }

  // Support Analytics
  async getSupportAnalytics(): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/analytics');
    return response.data;
  }

  async getAgentPerformance(agentId: string, period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get(`/support/analytics/agents/${agentId}`, {
      params: { period }
    });
    return response.data;
  }

  async getCustomerSatisfaction(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/analytics/satisfaction', {
      params: { period }
    });
    return response.data;
  }

  async getTicketTrends(period: string = 'month'): Promise<ApiResponse<any>> {
    const response = await this.client.get('/support/analytics/trends', {
      params: { period }
    });
    return response.data;
  }

  async generateSupportReport(filters: {
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv';
  }): Promise<ApiResponse<any>> {
    const response = await this.client.post('/support/analytics/report', filters);
    return response.data;
  }
}

// Export singleton instance
export const supportApi = new SupportClient();
export default supportApi;