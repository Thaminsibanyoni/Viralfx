import api from './client';
import { handleApiError } from './client';

/**
 * Market Control API Service
 * Connects to backend market control endpoints for VPMX market governance
 */

export enum MarketStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  FROZEN = 'frozen',
  ARCHIVED = 'archived',
}

export interface VPMXTradingMarket {
  id: string;
  symbol: string; // V:CC:SEC:TICKER format
  name: string;
  category: string;
  status: MarketStatus;
  tradingEnabled: boolean;
  maxExposure: number;
  currentExposure: number;
  vpmxScore: number;
  vpmxRank?: number;
  vpmxChange24h?: number;
  regions: string[];
  timeframes: string[];
  longShortRatio?: number;
  liquidity: number;
  volatility?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  frozenAt?: string;
  thawedAt?: string;
  archivedAt?: string;
}

export interface CreateMarketDto {
  symbol: string; // V:CC:SEC:TICKER format
  name: string;
  category: string;
  maxExposure: number;
  regions: string[];
  timeframes: string[];
  tradingEnabled?: boolean;
}

export interface UpdateMarketRegionsDto {
  regions: string[];
}

export interface ToggleTradingDto {
  enabled: boolean;
}

export interface FreezeMarketDto {
  reason: string;
}

/**
 * Create a new VPMX trading market
 */
export async function createMarket(data: CreateMarketDto): Promise<VPMXTradingMarket> {
  try {
    const response = await api.post<VPMXTradingMarket>('/admin/markets/create', data);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Pause a market (halts trading but keeps data flowing)
 */
export async function pauseMarket(marketId: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.post<VPMXTradingMarket>(`/admin/markets/${marketId}/pause`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Resume a paused market
 */
export async function resumeMarket(marketId: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.post<VPMXTradingMarket>(`/admin/markets/${marketId}/resume`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Freeze a market immediately (panic button - stops everything)
 */
export async function freezeMarket(marketId: string, reason: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.post<VPMXTradingMarket>(`/admin/markets/${marketId}/freeze`, { reason });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Thaw a frozen market (requires review)
 */
export async function thawMarket(marketId: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.post<VPMXTradingMarket>(`/admin/markets/${marketId}/thaw`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Update regional access for a market
 */
export async function updateMarketRegions(
  marketId: string,
  regions: string[]
): Promise<VPMXTradingMarket> {
  try {
    const response = await api.put<VPMXTradingMarket>(`/admin/markets/${marketId}/regions`, { regions });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Enable or disable trading for a market
 */
export async function toggleTrading(
  marketId: string,
  enabled: boolean
): Promise<VPMXTradingMarket> {
  try {
    const response = await api.put<VPMXTradingMarket>(`/admin/markets/${marketId}/trading`, { enabled });
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Get all markets with their status
 */
export async function getAllMarkets(): Promise<VPMXTradingMarket[]> {
  try {
    const response = await api.get<VPMXTradingMarket[]>('/admin/markets');
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Get market details by ID
 */
export async function getMarket(marketId: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.get<VPMXTradingMarket>(`/admin/markets/${marketId}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Delete a market (soft delete - archives it)
 */
export async function deleteMarket(marketId: string): Promise<VPMXTradingMarket> {
  try {
    const response = await api.delete<VPMXTradingMarket>(`/admin/markets/${marketId}`);
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
}

/**
 * Market Control API object
 */
export const marketControlApi = {
  createMarket,
  pauseMarket,
  resumeMarket,
  freezeMarket,
  thawMarket,
  updateMarketRegions,
  toggleTrading,
  getAllMarkets,
  getMarket,
  deleteMarket,
};
