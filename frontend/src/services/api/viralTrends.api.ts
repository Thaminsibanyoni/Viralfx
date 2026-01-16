import React from 'react';
import api from './auth.api'; // Import base API config
import { ViralTrend, ViralTrendMarket, VTSSymbol, VPMXData, TrendReversal } from '../../types/trading.types';

// Base URL for viral trends endpoints
const VIRAL_TRENDS_BASE = '/api/viral-trends';
const VPMX_BASE = '/api/vpmx';
const VTS_BASE = '/api/vts';

/**
 * Viral Trends API Service
 * Handles all viral trend, VPMX, and VTS related API calls
 */

// Get all viral trends
export const getViralTrends = async (): Promise<ViralTrend[]> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/trends`);
  return response.data;
};

// Get viral trends for a specific symbol
export const getViralTrendsBySymbol = async (symbol: string): Promise<ViralTrend[]> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/trends/symbol/${symbol}`);
  return response.data;
};

// Get enhanced viral trend markets with VPMX data
export const getViralTrendMarkets = async (): Promise<ViralTrendMarket[]> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/markets`);
  return response.data;
};

// Get specific viral trend market by VTS symbol
export const getViralTrendMarketByVTS = async (vtsSymbol: string): Promise<ViralTrendMarket> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/markets/vts/${vtsSymbol}`);
  return response.data;
};

// Get VPMX data for a symbol
export const getVPMXData = async (symbol: string): Promise<VPMXData> => {
  const response = await api.get(`${VPMX_BASE}/score/${symbol}`);
  return response.data;
};

// Get VPMX rankings (top trending)
export const getVPMXRankings = async (limit: number = 50): Promise<Array<{ symbol: string; score: number; rank: number }>> => {
  const response = await api.get(`${VPMX_BASE}/rankings?limit=${limit}`);
  return response.data;
};

// Get VPMX history for a symbol
export const getVPMXHistory = async (
  symbol: string,
  timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<Array<{ timestamp: number; score: number }>> => {
  const response = await api.get(`${VPMX_BASE}/history/${symbol}?timeframe=${timeframe}`);
  return response.data;
};

// Parse and validate VTS symbol
export const parseVTSSymbol = async (vtsString: string): Promise<VTSSymbol | null> => {
  try {
    const response = await api.post(`${VTS_BASE}/parse`, { vtsSymbol: vtsString });
    return response.data;
  } catch (error) {
    console.error('Invalid VTS symbol:', vtsString);
    return null;
  }
};

// Get available VTS symbols by country
export const getVTSSymbolsByCountry = async (countryCode: string): Promise<VTSSymbol[]> => {
  const response = await api.get(`${VTS_BASE}/symbols/country/${countryCode}`);
  return response.data;
};

// Get available VTS symbols by sector
export const getVTSSymbolsBySector = async (sectorCode: string): Promise<VTSSymbol[]> => {
  const response = await api.get(`${VTS_BASE}/symbols/sector/${sectorCode}`);
  return response.data;
};

// Search VTS symbols
export const searchVTSSymbols = async (query: string): Promise<VTSSymbol[]> => {
  const response = await api.get(`${VTS_BASE}/search?q=${encodeURIComponent(query)}`);
  return response.data;
};

// Get trend reversals
export const getTrendReversals = async (symbol?: string): Promise<TrendReversal[]> => {
  const url = symbol
    ? `${VIRAL_TRENDS_BASE}/reversals?symbol=${symbol}`
    : `${VIRAL_TRENDS_BASE}/reversals`;
  const response = await api.get(url);
  return response.data;
};

// Get viral sentiment for a symbol
export const getViralSentiment = async (symbol: string): Promise<{
  overall: 'bullish' | 'bearish' | 'neutral';
  score: number;
  platforms: Array<{
    platform: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    mentions: number;
  }>;
}> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/sentiment/${symbol}`);
  return response.data;
};

// Get viral influencers for a trend
export const getViralInfluencers = async (symbol: string): Promise<Array<{
  username: string;
  followers: number;
  engagement: number;
  recentMentions: number;
}>> => {
  const response = await api.get(`${VIRAL_TRENDS_BASE}/influencers/${symbol}`);
  return response.data;
};

// WebSocket connection for real-time VPMX updates
export class VPMXWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private subscriptions: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(url: string = 'ws://localhost:3001/ws/vpmx') {
    this.url = url;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('VPMX WebSocket connected');
        this.reconnectAttempts = 0;
        // Resubscribe to symbols
        this.subscriptions.forEach(symbol => {
          this.subscribe(symbol);
        });
      };

      this.ws.onclose = () => {
        console.log('VPMX WebSocket disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('VPMX WebSocket error:', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connect(), delay);
    }
  }

  subscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'subscribe',
        symbol,
      }));
      this.subscriptions.add(symbol);
    } else {
      // Queue subscription for when connection is established
      this.subscriptions.add(symbol);
    }
  }

  unsubscribe(symbol: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: 'unsubscribe',
        symbol,
      }));
    }
    this.subscriptions.delete(symbol);
  }

  private handleMessage(data: any): void {
    // Dispatch custom event for components to listen to
    const event = new CustomEvent('vpmx-update', { detail: data });
    window.dispatchEvent(event);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const vpmxWebSocket = new VPMXWebSocket();

// Hook to use VPMX updates in React components
export const useVPMXUpdates = (callback: (data: any) => void) => {
  React.useEffect(() => {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };

    window.addEventListener('vpmx-update', handler as EventListener);

    return () => {
      window.removeEventListener('vpmx-update', handler as EventListener);
    };
  }, [callback]);
};
