/**
 * Candle Engine Control API
 * API service for managing candle engine governance features
 */

import { handleApiError } from './auth.api';

// Types
export interface CandleRebuildJob {
  id: string;
  marketId: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  error?: string;
  force: boolean;
  requestedBy: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface CandleAggregationRule {
  id: string;
  marketId: string;
  volumeWeight: number;
  vpmxWeight: number;
  engagementWeight: number;
  enableSmoothing: boolean;
  smoothingPeriod: number;
  normalized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VolumeWeightingRule {
  id: string;
  marketId: string;
  mentionsWeight: number;
  sharesWeight: number;
  likesWeight: number;
  commentsWeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface CandleAuditLog {
  id: string;
  marketId: string;
  action: string;
  timeframe?: string;
  previousValue?: any;
  newValue?: any;
  reason?: string;
  performedBy: string;
  createdAt: string;
}

// DTOs
export interface ConfigureTimeframesDto {
  marketId: string;
  timeframes: string[];
}

export interface RebuildCandlesDto {
  marketId: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  force?: boolean;
}

export interface UpdateAggregationRulesDto {
  marketId: string;
  volumeWeight?: number;
  vpmxWeight?: number;
  engagementWeight?: number;
  enableSmoothing?: boolean;
  smoothingPeriod?: number;
}

export interface UpdateVolumeWeightingDto {
  marketId: string;
  mentionsWeight?: number;
  sharesWeight?: number;
  likesWeight?: number;
  commentsWeight?: number;
}

export interface EnableTimeframeDto {
  marketId: string;
  timeframe: string;
  enabled: boolean;
}

// API Class
class CandleEngineAPI {
  private baseUrl = '/api/admin/candle-engine';

  /**
   * Configure available timeframes for a market
   */
  async configureTimeframes(dto: ConfigureTimeframesDto): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/timeframes/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to configure timeframes:', error);
      throw error;
    }
  }

  /**
   * Rebuild historical candles (computationally expensive)
   */
  async rebuildCandles(dto: RebuildCandlesDto): Promise<CandleRebuildJob> {
    try {
      const response = await fetch(`${this.baseUrl}/rebuild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to rebuild candles:', error);
      throw error;
    }
  }

  /**
   * Update candle aggregation rules
   */
  async updateAggregationRules(dto: UpdateAggregationRulesDto): Promise<CandleAggregationRule> {
    try {
      const response = await fetch(`${this.baseUrl}/aggregation-rules`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to update aggregation rules:', error);
      throw error;
    }
  }

  /**
   * Update volume weighting rules
   */
  async updateVolumeWeighting(dto: UpdateVolumeWeightingDto): Promise<VolumeWeightingRule> {
    try {
      const response = await fetch(`${this.baseUrl}/volume-weighting`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to update volume weighting:', error);
      throw error;
    }
  }

  /**
   * Enable or disable a specific timeframe
   */
  async enableTimeframe(dto: EnableTimeframeDto): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/timeframes/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(dto),
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to toggle timeframe:', error);
      throw error;
    }
  }

  /**
   * Get rebuild jobs for a market
   */
  async getRebuildJobs(marketId: string): Promise<CandleRebuildJob[]> {
    try {
      const response = await fetch(`${this.baseUrl}/rebuild-jobs/${marketId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to get rebuild jobs:', error);
      throw error;
    }
  }

  /**
   * Get aggregation rules for a market
   */
  async getAggregationRules(marketId: string): Promise<CandleAggregationRule | null> {
    try {
      const response = await fetch(`${this.baseUrl}/aggregation-rules/${marketId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to get aggregation rules:', error);
      throw error;
    }
  }

  /**
   * Get volume weighting rules for a market
   */
  async getVolumeWeighting(marketId: string): Promise<VolumeWeightingRule | null> {
    try {
      const response = await fetch(`${this.baseUrl}/volume-weighting/${marketId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw await handleApiError(response);
      }

      return response.json();
    } catch (error) {
      console.error('Failed to get volume weighting:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const candleEngineApi = new CandleEngineAPI();
