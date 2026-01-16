import { apiClient } from './client';

interface TrendingItem {
  platform: string;
  content: string;
  engagement: number;
  trendScore: number;
  timestamp: string;
}

interface OracleStatus {
  status: string;
  lastUpdate: string;
  activeModules: string[];
}

class OracleAPI {
  async getTrendingTikTokVideos(limit: number = 10): Promise<TrendingItem[]> {
    const response = await apiClient.get(`/oracle/social/tiktok?limit=${limit}`);
    return response.data;
  }

  async getTrendingTwitterTopics(limit: number = 10): Promise<TrendingItem[]> {
    const response = await apiClient.get(`/oracle/social/twitter?limit=${limit}`);
    return response.data;
  }

  async getTrendingInstagramPosts(limit: number = 10): Promise<TrendingItem[]> {
    const response = await apiClient.get(`/oracle/social/instagram?limit=${limit}`);
    return response.data;
  }

  async getTrendingYouTubeVideos(limit: number = 10): Promise<TrendingItem[]> {
    const response = await apiClient.get(`/oracle/social/youtube?limit=${limit}`);
    return response.data;
  }

  async getSouthAfricanTrends(): Promise<TrendingItem[]> {
    const response = await apiClient.get('/oracle/social/sa-trends');
    return response.data;
  }

  async getOracleStatus(): Promise<OracleStatus> {
    const response = await apiClient.get('/oracle/status');
    return response.data;
  }
}

export const oracleApi = new OracleAPI();
export default oracleApi;
