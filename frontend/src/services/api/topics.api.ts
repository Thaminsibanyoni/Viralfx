import { apiClient } from './client';
import type {
  Topic, TopicFilters, TopicSentiment, SocialPost, RelatedTopic, TopicStats, TopicCategory, Sentiment, Region, } from '../../types/topic';

interface TopicReport {
  id: string;
  topicId: string;
  reason: string;
  description?: string;
  createdAt: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED';
}

interface TopicAnalytics {
  growthRate: number;
  peakVirality: number;
  sustainabilityScore: number;
  marketImpact: number;
  riskScore: number;
  trendDirection: 'RISING' | 'FALLING' | 'STABLE';
}

class TopicsAPI {
  // Topic data endpoints
  async getTopics(
    filters?: TopicFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: Topic[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'search') {
            params.append('q', String(value));
          } else if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get(`/topics?${params.toString()}`);
    return response.data;
  }

  async getTopic(topicId: string): Promise<Topic> {
    const response = await apiClient.get(`/topics/${topicId}`);
    return response.data;
  }

  async getTrendingTopics(limit: number = 10): Promise<Topic[]> {
    const response = await apiClient.get(`/topics/trending?limit=${limit}`);
    return response.data;
  }

  async getTopicCategories(): Promise<TopicCategory[]> {
    const response = await apiClient.get('/topics/categories');
    return response.data;
  }

  async searchTopics(query: string, filters?: TopicFilters): Promise<{
    topics: Topic[];
    suggestions: string[];
    total: number;
  }> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && key !== 'search') {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get(`/topics/search?${params.toString()}`);
    return response.data;
  }

  // Topic sentiment and analysis
  async getTopicSentiment(topicId: string): Promise<TopicSentiment> {
    const response = await apiClient.get(`/topics/${topicId}/sentiment`);
    return response.data;
  }

  async getTopicPosts(topicId: string, platform?: string, limit: number = 50): Promise<SocialPost[]> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    params.append('limit', String(limit));

    const response = await apiClient.get(`/topics/${topicId}/posts?${params.toString()}`);
    return response.data.posts;
  }

  async getRelatedTopics(topicId: string, limit: number = 10): Promise<RelatedTopic[]> {
    const response = await apiClient.get(`/topics/${topicId}/related?limit=${limit}`);
    return response.data.relatedTopics;
  }

  async getTopicStats(topicId: string): Promise<TopicStats> {
    const response = await apiClient.get(`/topics/${topicId}/stats`);
    return response.data;
  }

  async getTopicStatsOverview(): Promise<{
    totalTopics: number;
    positivePercentage: number;
    totalMentions: number;
    averageVirality: number;
    trendingTopics: number;
  }> {
    const response = await apiClient.get('/topics/stats/overview');
    return response.data;
  }

  // Topic analytics and insights
  async getTopicAnalytics(topicId: string, timeframe: string = '24H'): Promise<TopicAnalytics> {
    const response = await apiClient.get(`/topics/${topicId}/analytics?timeframe=${timeframe}`);
    return response.data;
  }

  async getTopicViralityTimeline(topicId: string, timeframe: string = '7D'): Promise<{
    timestamp: number;
    viralityScore: number;
    sentiment: Sentiment;
    volume: number;
    mentions: number;
  }[]> {
    const response = await apiClient.get(
      `/topics/${topicId}/timeline?timeframe=${timeframe}`
    );
    return response.data.timeline;
  }

  async getTopicPredictions(topicId: string): Promise<{
    predictedVirality: number;
    confidence: number;
    timeframe: string;
    factors: string[];
    risks: string[];
    opportunities: string[];
  }> {
    const response = await apiClient.get(`/topics/${topicId}/predictions`);
    return response.data;
  }

  // Social media analysis
  async getSocialMediaAnalysis(topicId: string): Promise<{
    platforms: Record<string, {
      mentions: number;
      sentiment: Record<Sentiment, number>;
      engagement: {
        likes: number;
        shares: number;
        comments: number;
      };
      reach: number;
      growth: number;
    }>;
    demographics: {
      age: Record<string, number>;
      gender: Record<string, number>;
      location: Record<string, number>;
    };
    influencers: any[];
  }> {
    const response = await apiClient.get(`/topics/${topicId}/social-analysis`);
    return response.data;
  }

  async getTopicInfluencers(topicId: string, limit: number = 20): Promise<any[]> {
    const response = await apiClient.get(`/topics/${topicId}/influencers?limit=${limit}`);
    return response.data.influencers;
  }

  async getTopicHashtags(topicId: string, platform?: string): Promise<{
    hashtags: Array<{
      tag: string;
      count: number;
      growth: number;
      sentiment: Record<Sentiment, number>;
    }>;
    trending: string[];
  }> {
    const params = platform ? `?platform=${platform}` : '';
    const response = await apiClient.get(`/topics/${topicId}/hashtags${params}`);
    return response.data;
  }

  // Topic management
  async createTopic(topicData: Omit<Topic, 'id' | 'createdAt' | 'updatedAt'>): Promise<Topic> {
    const response = await apiClient.post('/topics', topicData);
    return response.data.topic;
  }

  async updateTopic(topicId: string, topicData: Partial<Topic>): Promise<Topic> {
    const response = await apiClient.put(`/topics/${topicId}`, topicData);
    return response.data.topic;
  }

  async deleteTopic(topicId: string): Promise<void> {
    await apiClient.delete(`/topics/${topicId}`);
  }

  async reportTopic(topicId: string, reason: string): Promise<void> {
    await apiClient.post(`/topics/${topicId}/report`, { reason });
  }

  async getTopicReports(topicId?: string): Promise<TopicReport[]> {
    const url = topicId ? `/topics/${topicId}/reports` : '/topics/reports';
    const response = await apiClient.get(url);
    return response.data.reports;
  }

  // Topic recommendations and insights
  async getRecommendedTopics(limit: number = 20): Promise<{
    topics: Topic[];
    reasons: Record<string, string[]>;
  }> {
    const response = await apiClient.get(`/topics/recommendations?limit=${limit}`);
    return response.data;
  }

  async getTopicInsights(topicId: string): Promise<{
    summary: string;
    keyPoints: string[];
    risks: string[];
    opportunities: string[];
    marketImpact: string;
    sustainability: string;
  }> {
    const response = await apiClient.get(`/topics/${topicId}/insights`);
    return response.data;
  }

  // Topic comparison and correlation
  async compareTopics(topicIds: string[]): Promise<{
    comparison: any[];
    correlations: Record<string, number>;
    similarities: Record<string, number>;
  }> {
    const response = await apiClient.post('/topics/compare', { topicIds });
    return response.data;
  }

  async getTopicCorrelations(topicId: string): Promise<Record<string, number>> {
    const response = await apiClient.get(`/topics/${topicId}/correlations`);
    return response.data.correlations;
  }

  // Topic trends and patterns
  async getTopicTrends(category?: TopicCategory, timeframe: string = '7D'): Promise<{
    trends: Array<{
      topic: Topic;
      trend: 'RISING' | 'FALLING' | 'STABLE';
      change: number;
      confidence: number;
    }>;
    patterns: any[];
  }> {
    const params = category ? `?category=${category}&timeframe=${timeframe}` : `?timeframe=${timeframe}`;
    const response = await apiClient.get(`/topics/trends${params}`);
    return response.data;
  }

  async getTopicSeasonality(topicId: string): Promise<{
    seasonal: Array<{
      period: string;
      virality: number;
      confidence: number;
    }>;
    patterns: string[];
  }> {
    const response = await apiClient.get(`/topics/${topicId}/seasonality`);
    return response.data;
  }

  // Topic content analysis
  async getTopicContentAnalysis(topicId: string): Promise<{
    wordCloud: Array<{ word: string; frequency: number; sentiment: number }>;
    themes: string[];
    keywords: string[];
    entities: any[];
    summary: string;
  }> {
    const response = await apiClient.get(`/topics/${topicId}/content-analysis`);
    return response.data;
  }

  async getTopicLanguageDistribution(topicId: string): Promise<{
    languages: Record<string, number>;
    primary: string;
    diversity: number;
  }> {
    const response = await apiClient.get(`/topics/${topicId}/language-distribution`);
    return response.data;
  }

  // Topic lifecycle management
  async getTopicLifecycle(topicId: string): Promise<{
    stage: 'EMERGING' | 'GROWING' | 'PEAK' | 'DECLINING' | 'STABLE';
    duration: number;
    peakVirality: number;
    currentPhase: string;
    nextPhase: string;
    riskFactors: string[];
  }> {
    const response = await apiClient.get(`/topics/${topicId}/lifecycle`);
    return response.data;
  }

  async getTopicHistory(topicId: string): Promise<{
    events: Array<{
      timestamp: number;
      event: string;
      impact: number;
      description: string;
    }>;
    milestones: any[];
  }> {
    const response = await apiClient.get(`/topics/${topicId}/history`);
    return response.data;
  }

  // Topic export and reporting
  async exportTopicData(topicId: string, format: 'csv' | 'json' | 'pdf', timeframe?: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (timeframe) params.append('timeframe', timeframe);

    const response = await apiClient.get(
      `/topics/${topicId}/export?${params.toString()}`
    );
    return response.data.downloadUrl;
  }

  async generateTopicReport(topicId: string, reportType: 'summary' | 'detailed' | 'custom'): Promise<string> {
    const response = await apiClient.post(`/topics/${topicId}/report`, { reportType });
    return response.data.reportUrl;
  }

  // Topic subscriptions and notifications
  async subscribeToTopic(topicId: string, notificationTypes: string[]): Promise<void> {
    await apiClient.post(`/topics/${topicId}/subscribe`, { notificationTypes });
  }

  async unsubscribeFromTopic(topicId: string): Promise<void> {
    await apiClient.delete(`/topics/${topicId}/subscribe`);
  }

  async getSubscriptions(): Promise<{
    topics: Array<{
      topicId: string;
      topicTitle: string;
      notificationTypes: string[];
      createdAt: string;
    }>;
  }> {
    const response = await apiClient.get('/topics/subscriptions');
    return response.data;
  }

  // Topic monitoring and alerts
  async createTopicAlert(topicId: string, alertData: {
    type: 'VIRALITY' | 'SENTIMENT' | 'ENGAGEMENT';
    threshold: number;
    condition: 'ABOVE' | 'BELOW';
    notification: boolean;
  }): Promise<any> {
    const response = await apiClient.post(`/topics/${topicId}/alerts`, alertData);
    return response.data.alert;
  }

  async getTopicAlerts(topicId?: string): Promise<any[]> {
    const url = topicId ? `/topics/${topicId}/alerts` : '/topics/alerts';
    const response = await apiClient.get(url);
    return response.data.alerts;
  }

  async updateTopicAlert(alertId: string, alertData: Partial<any>): Promise<any> {
    const response = await apiClient.put(`/topics/alerts/${alertId}`, alertData);
    return response.data.alert;
  }

  async deleteTopicAlert(alertId: string): Promise<void> {
    await apiClient.delete(`/topics/alerts/${alertId}`);
  }

  // Admin and management functions
  async getAdminTopicStats(): Promise<{
    totalTopics: number;
    activeTopics: number;
    trendingTopics: number;
    averageVirality: number;
    totalMentions: number;
    categoryDistribution: Record<TopicCategory, number>;
    regionDistribution: Record<Region, number>;
    sentimentDistribution: Record<Sentiment, number>;
  }> {
    const response = await apiClient.get('/admin/topics/stats');
    return response.data;
  }

  async getTopicModerationQueue(): Promise<{
    pending: Topic[];
    flagged: Topic[];
    reported: Array<{
      topic: Topic;
      reports: TopicReport[];
    }>;
  }> {
    const response = await apiClient.get('/admin/topics/moderation');
    return response.data;
  }

  async moderateTopic(topicId: string, action: 'APPROVE' | 'REJECT' | 'FLAG', reason?: string): Promise<void> {
    await apiClient.post(`/admin/topics/${topicId}/moderate`, { action, reason });
  }

  // Topic research and insights
  async getTopicResearch(topicId: string): Promise<{
    background: string;
    context: string;
    implications: string[];
    sources: any[];
    methodology: string;
  }> {
    const response = await apiClient.get(`/topics/${topicId}/research`);
    return response.data;
  }

  async getTopicMarketImpact(topicId: string): Promise<{
    affectedMarkets: Array<{
      market: string;
      correlation: number;
      impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
      confidence: number;
    }>;
    tradingOpportunities: string[];
    riskAssessment: string;
  }> {
    const response = await apiClient.get(`/topics/${topicId}/market-impact`);
    return response.data;
  }

  // Advanced filtering and search
  async advancedTopicSearch(filters: {
    keywords?: string[];
    categories?: TopicCategory[];
    regions?: Region[];
    sentiments?: Sentiment[];
    platforms?: string[];
    viralityRange?: [number, number];
    timeRange?: string;
    sortBy?: 'virality' | 'engagement' | 'growth' | 'mentions';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{
    topics: Topic[];
    total: number;
    facets: any;
    suggestions: string[];
  }> {
    const response = await apiClient.post('/topics/search/advanced', filters);
    return response.data;
  }

  // Bulk operations
  async bulkGetTopics(topicIds: string[]): Promise<Topic[]> {
    const response = await apiClient.post('/topics/bulk', { topicIds });
    return response.data.topics;
  }

  async bulkUpdateTopics(updates: Array<{ topicId: string; data: Partial<Topic> }>): Promise<Topic[]> {
    const response = await apiClient.post('/topics/bulk/update', { updates });
    return response.data.topics;
  }
}

// Create and export singleton instance
export const topicsApi = new TopicsAPI();

// Export default for convenience
export default topicsApi;