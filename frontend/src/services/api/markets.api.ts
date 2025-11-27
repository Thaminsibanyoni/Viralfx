import { apiClient } from './client';
import type {
  Market, MarketFilters, OrderBookEntry, OrderBook, Trade, MarketStats, MarketSentiment, PriceAlert, MarketCategory, RiskLevel, Platform, } from '../../types/market';

interface OrderRequest {
  type: 'MARKET' | 'LIMIT' | 'STOP';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
}

interface OrderResponse {
  id: string;
  status: 'FILLED' | 'PENDING' | 'CANCELLED' | 'REJECTED';
  executedQuantity: number;
  executedPrice?: number;
  remainingQuantity: number;
  timestamp: string;
}

interface WatchlistItem {
  id: string;
  marketId: string;
  priceAlert?: PriceAlert;
  createdAt: string;
}

class MarketsAPI {
  // Market data endpoints
  async getMarkets(filters?: MarketFilters): Promise<{
    data: Market[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, String(value));
          }
        }
      });
    }

    const response = await apiClient.get(`/markets?${params.toString()}`);
    return response.data;
  }

  async getMarket(symbol: string): Promise<Market> {
    const response = await apiClient.get(`/markets/${symbol}`);
    return response.data;
  }

  async getTrendingMarkets(limit: number = 10): Promise<Market[]> {
    const response = await apiClient.get(`/markets/trending?limit=${limit}`);
    return response.data;
  }

  async getMarketCategories(): Promise<MarketCategory[]> {
    const response = await apiClient.get('/markets/categories');
    return response.data;
  }

  async searchMarkets(query: string): Promise<Market[]> {
    const response = await apiClient.get(`/markets/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  // Order book data
  async getMarketOrderBook(symbol: string, depth: number = 20): Promise<OrderBook> {
    const response = await apiClient.get(`/markets/${symbol}/orderbook?depth=${depth}`);
    return response.data;
  }

  async getMarketTrades(symbol: string, limit: number = 100): Promise<Trade[]> {
    const response = await apiClient.get(`/markets/${symbol}/trades?limit=${limit}`);
    return response.data;
  }

  // Market statistics and sentiment
  async getMarketStats(symbol: string): Promise<MarketStats> {
    const response = await apiClient.get(`/markets/${symbol}/stats`);
    return response.data;
  }

  async getMarketSentiment(symbol: string): Promise<MarketSentiment> {
    const response = await apiClient.get(`/markets/${symbol}/sentiment`);
    return response.data;
  }

  async getMarketHistory(symbol: string, timeframe: string, limit: number = 100): Promise<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[]> {
    const response = await apiClient.get(
      `/markets/${symbol}/history?timeframe=${timeframe}&limit=${limit}`
    );
    return response.data;
  }

  // Trading operations
  async createOrder(symbol: string, orderData: OrderRequest): Promise<OrderResponse> {
    const response = await apiClient.post(`/markets/${symbol}/orders`, orderData);
    return response.data;
  }

  async cancelOrder(orderId: string): Promise<void> {
    await apiClient.delete(`/orders/${orderId}`);
  }

  async cancelAllOrders(symbol?: string): Promise<void> {
    const url = symbol ? `/markets/${symbol}/orders` : '/orders';
    await apiClient.delete(url);
  }

  async getOpenOrders(symbol?: string): Promise<any[]> {
    const url = symbol ? `/markets/${symbol}/orders/open` : '/orders/open';
    const response = await apiClient.get(url);
    return response.data.orders;
  }

  async getOrderHistory(symbol?: string, limit?: number): Promise<any[]> {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    if (limit) params.append('limit', String(limit));

    const response = await apiClient.get(`/orders/history?${params.toString()}`);
    return response.data.orders;
  }

  async getOrder(orderId: string): Promise<any> {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data;
  }

  // Position management
  async getPositions(): Promise<any[]> {
    const response = await apiClient.get('/positions');
    return response.data.positions;
  }

  async getPosition(symbol: string): Promise<any> {
    const response = await apiClient.get(`/positions/${symbol}`);
    return response.data;
  }

  async closePosition(symbol: string): Promise<any> {
    const response = await apiClient.post(`/positions/${symbol}/close`);
    return response.data;
  }

  async closeAllPositions(): Promise<any> {
    const response = await apiClient.post('/positions/close-all');
    return response.data;
  }

  // Watchlist management
  async getWatchlist(): Promise<WatchlistItem[]> {
    const response = await apiClient.get('/watchlist');
    return response.data.watchlist;
  }

  async addToWatchlist(symbol: string): Promise<WatchlistItem> {
    const response = await apiClient.post('/watchlist', { symbol });
    return response.data.item;
  }

  async removeFromWatchlist(symbol: string): Promise<void> {
    await apiClient.delete(`/watchlist/${symbol}`);
  }

  async updateWatchlistAlert(symbol: string, alert: PriceAlert): Promise<WatchlistItem> {
    const response = await apiClient.put(`/watchlist/${symbol}`, { alert });
    return response.data.item;
  }

  // Price alerts
  async getPriceAlerts(): Promise<PriceAlert[]> {
    const response = await apiClient.get('/alerts');
    return response.data.alerts;
  }

  async createPriceAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): Promise<PriceAlert> {
    const response = await apiClient.post('/alerts', alert);
    return response.data.alert;
  }

  async updatePriceAlert(alertId: string, alert: Partial<PriceAlert>): Promise<PriceAlert> {
    const response = await apiClient.put(`/alerts/${alertId}`, alert);
    return response.data.alert;
  }

  async deletePriceAlert(alertId: string): Promise<void> {
    await apiClient.delete(`/alerts/${alertId}`);
  }

  // Market analysis and insights
  async getMarketAnalysis(symbol: string): Promise<{
    technical: any;
    fundamental: any;
    sentiment: any;
    recommendations: any[];
  }> {
    const response = await apiClient.get(`/markets/${symbol}/analysis`);
    return response.data;
  }

  async getViralSignals(limit: number = 20): Promise<{
    signals: any[];
    timestamp: string;
  }> {
    const response = await apiClient.get(`/signals/viral?limit=${limit}`);
    return response.data;
  }

  async getMarketPrediction(symbol: string): Promise<{
    prediction: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    timeframe: string;
    reasoning: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> {
    const response = await apiClient.get(`/markets/${symbol}/prediction`);
    return response.data;
  }

  // Social media integration
  async getSocialMediaSentiment(symbol: string): Promise<{
    twitter: { positive: number; negative: number; neutral: number };
    instagram: { positive: number; negative: number; neutral: number };
    tiktok: { positive: number; negative: number; neutral: number };
    overall: { positive: number; negative: number; neutral: number };
  }> {
    const response = await apiClient.get(`/markets/${symbol}/social-sentiment`);
    return response.data;
  }

  async getSocialMediaPosts(symbol: string, platform?: string, limit: number = 50): Promise<any[]> {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    params.append('limit', String(limit));

    const response = await apiClient.get(
      `/markets/${symbol}/social-posts?${params.toString()}`
    );
    return response.data.posts;
  }

  // Market comparisons
  async compareMarkets(symbols: string[]): Promise<{
    comparison: any[];
    correlations: Record<string, number>;
  }> {
    const response = await apiClient.post('/markets/compare', { symbols });
    return response.data;
  }

  async getMarketCorrelations(symbol: string): Promise<Record<string, number>> {
    const response = await apiClient.get(`/markets/${symbol}/correlations`);
    return response.data.correlations;
  }

  // Portfolio metrics
  async getPortfolioMetrics(): Promise<{
    totalValue: number;
    totalPnL: number;
    totalReturn: number;
    riskScore: number;
    diversification: number;
    topHoldings: any[];
  }> {
    const response = await apiClient.get('/portfolio/metrics');
    return response.data;
  }

  // Market calendar and events
  async getMarketCalendar(): Promise<{
    events: any[];
    holidays: any[];
    earnings: any[];
  }> {
    const response = await apiClient.get('/markets/calendar');
    return response.data;
  }

  async getMarketNews(symbol?: string, limit: number = 20): Promise<any[]> {
    const params = new URLSearchParams();
    if (symbol) params.append('symbol', symbol);
    params.append('limit', String(limit));

    const response = await apiClient.get(`/markets/news?${params.toString()}`);
    return response.data.news;
  }

  // Market statistics for admin
  async getAdminMarketStats(): Promise<{
    totalMarkets: number;
    activeMarkets: number;
    totalVolume: number;
    totalTrades: number;
    averageTradeSize: number;
    topMarkets: Market[];
    riskDistribution: Record<RiskLevel, number>;
    categoryDistribution: Record<MarketCategory, number>;
  }> {
    const response = await apiClient.get('/admin/markets/stats');
    return response.data;
  }

  // WebSocket subscription management
  async subscribeToMarket(symbol: string): Promise<void> {
    await apiClient.post(`/ws/subscribe/${symbol}`);
  }

  async unsubscribeFromMarket(symbol: string): Promise<void> {
    await apiClient.delete(`/ws/subscribe/${symbol}`);
  }

  async getSubscriptions(): Promise<string[]> {
    const response = await apiClient.get('/ws/subscriptions');
    return response.data.subscriptions;
  }

  // Market data export
  async exportMarketData(symbol: string, format: 'csv' | 'json', timeframe?: string): Promise<string> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (timeframe) params.append('timeframe', timeframe);

    const response = await apiClient.get(`/markets/${symbol}/export?${params.toString()}`);
    return response.data.downloadUrl;
  }

  // Market research
  async getMarketResearch(symbol: string): Promise<{
    overview: string;
    technical: string;
    fundamental: string;
    social: string;
    outlook: string;
    risks: string[];
    opportunities: string[];
    lastUpdated: string;
  }> {
    const response = await apiClient.get(`/markets/${symbol}/research`);
    return response.data;
  }

  // Advanced filtering and search
  async advancedSearch(filters: {
    keywords?: string[];
    categories?: MarketCategory[];
    riskLevels?: RiskLevel[];
    platforms?: Platform[];
    priceRange?: [number, number];
    volumeRange?: [number, number];
    viralityRange?: [number, number];
    sortBy?: 'volume' | 'price' | 'change' | 'virality';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{
    markets: Market[];
    total: number;
    facets: any;
    suggestions: string[];
  }> {
    const response = await apiClient.post('/markets/search/advanced', filters);
    return response.data;
  }

  // Market analytics
  async getMarketAnalytics(symbol: string, period: string = '1D'): Promise<{
    priceChart: any[];
    volumeChart: any[];
    volatilityChart: any[];
    sentimentChart: any[];
    keyMetrics: any;
    trends: any[];
  }> {
    const response = await apiClient.get(`/markets/${symbol}/analytics?period=${period}`);
    return response.data;
  }

  // Bulk operations
  async bulkGetMarkets(symbols: string[]): Promise<Market[]> {
    const response = await apiClient.post('/markets/bulk', { symbols });
    return response.data.markets;
  }

  async bulkGetOrderBooks(symbols: string[]): Promise<Record<string, OrderBook>> {
    const response = await apiClient.post('/markets/bulk/orderbooks', { symbols });
    return response.data.orderBooks;
  }
}

// Create and export singleton instance
export const marketsApi = new MarketsAPI();

// Export default for convenience
export default marketsApi;