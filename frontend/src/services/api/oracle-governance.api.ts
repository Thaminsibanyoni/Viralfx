/**
 * Oracle Governance API
 * API service for managing oracle signal governance features
 */

import { handleApiError } from './auth.api';

// Types
export type OracleSourceStatus = 'active' | 'degraded' | 'offline';
export type OracleMode = 'LIVE' | 'SIMULATED' | 'SEED';
export type SignalStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface OracleSource {
  id: string;
  source: string;
  name: string;
  status: OracleSourceStatus;
  mode: OracleMode;
  confidenceScore: number;
  deceptionRisk: number;
  signalCount: number;
  lastSignalAt?: string;
  lastHealthCheck?: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface OracleSignal {
  id: string;
  source: string;
  trendName: string;
  trendId?: string;
  hashtags: string[];
  vpmxScore: number;
  confidenceScore: number;
  deceptionRisk: number;
  mentions?: number;
  shares?: number;
  likes?: number;
  comments?: number;
  status: SignalStatus;
  approvedAt?: string;
  approvedBy?: string;
  approvalNotes?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  flaggedAt?: string;
  flaggedBy?: string;
  flagReason?: string;
  requiresReview: boolean;
  adjustedAt?: string;
  adjustedBy?: string;
  adjustmentReason?: string;
  detectedAt: string;
  metadata?: any;
}

// DTOs
export interface ApproveSignalDto {
  signalId: string;
  notes?: string;
}

export interface RejectSignalDto {
  signalId: string;
  reason: string;
}

export interface FlagSignalDto {
  signalId: string;
  reason: string;
  requiresReview?: boolean;
}

export interface UpdateSignalConfidenceDto {
  signalId: string;
  confidenceScore: number;
  reason?: string;
}

export interface UpdateOracleHealthDto {
  source: string;
  status: OracleSourceStatus;
  confidenceScore?: number;
  deceptionRisk?: number;
  notes?: string;
}

export interface SetOracleModeDto {
  source: string;
  mode: OracleMode;
}

// API Class
class OracleGovernanceAPI {
  private baseUrl = '/api/admin/oracle-governance';

  /**
   * Approve a pending signal
   */
  async approveSignal(dto: ApproveSignalDto): Promise<OracleSignal> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/approve`, {
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
      console.error('Failed to approve signal:', error);
      throw error;
    }
  }

  /**
   * Reject a signal
   */
  async rejectSignal(dto: RejectSignalDto): Promise<OracleSignal> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/reject`, {
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
      console.error('Failed to reject signal:', error);
      throw error;
    }
  }

  /**
   * Flag a signal for review
   */
  async flagSignal(dto: FlagSignalDto): Promise<OracleSignal> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/flag`, {
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
      console.error('Failed to flag signal:', error);
      throw error;
    }
  }

  /**
   * Update signal confidence score
   */
  async updateSignalConfidence(dto: UpdateSignalConfidenceDto): Promise<OracleSignal> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/confidence`, {
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
      console.error('Failed to update signal confidence:', error);
      throw error;
    }
  }

  /**
   * Update oracle source health status
   */
  async updateOracleHealth(dto: UpdateOracleHealthDto): Promise<OracleSource> {
    try {
      const response = await fetch(`${this.baseUrl}/oracle-health`, {
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
      console.error('Failed to update oracle health:', error);
      throw error;
    }
  }

  /**
   * Set oracle mode (LIVE, SIMULATED, SEED)
   */
  async setOracleMode(dto: SetOracleModeDto): Promise<OracleSource> {
    try {
      const response = await fetch(`${this.baseUrl}/oracle-mode`, {
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
      console.error('Failed to set oracle mode:', error);
      throw error;
    }
  }

  /**
   * Get all pending signals
   */
  async getPendingSignals(): Promise<OracleSignal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/pending`, {
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
      console.error('Failed to get pending signals:', error);
      throw error;
    }
  }

  /**
   * Get all flagged signals
   */
  async getFlaggedSignals(): Promise<OracleSignal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/flagged`, {
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
      console.error('Failed to get flagged signals:', error);
      throw error;
    }
  }

  /**
   * Get low confidence signals
   */
  async getLowConfidenceSignals(threshold: number = 50): Promise<OracleSignal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/low-confidence/${threshold}`, {
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
      console.error('Failed to get low confidence signals:', error);
      throw error;
    }
  }

  /**
   * Get high deception risk signals
   */
  async getHighDeceptionRiskSignals(threshold: number = 70): Promise<OracleSignal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/high-deception/${threshold}`, {
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
      console.error('Failed to get high deception risk signals:', error);
      throw error;
    }
  }

  /**
   * Get signals by source
   */
  async getSignalsBySource(source: string): Promise<OracleSignal[]> {
    try {
      const response = await fetch(`${this.baseUrl}/signals/source/${source}`, {
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
      console.error('Failed to get signals by source:', error);
      throw error;
    }
  }

  /**
   * Get all oracle sources
   */
  async getOracleSources(): Promise<OracleSource[]> {
    try {
      const response = await fetch(`${this.baseUrl}/sources`, {
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
      console.error('Failed to get oracle sources:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const oracleGovernanceApi = new OracleGovernanceAPI();
