import { useState, useEffect, useCallback, useRef } from 'react';
import useSocket from './useSocket';

// Types for WebSocket data
interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

interface WalletData {
  userId: string;
  balance: number;
  currency: string;
  availableBalance: number;
  totalBalance: number;
  lastUpdate: number;
}

interface OrderData {
  id: string;
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: number;
}

interface PriceAlert {
  symbol: string;
  price: number;
  condition: 'above' | 'below';
  triggered: boolean;
}

interface TrendData {
  id: string;
  price: number;
  volume: number;
  timestamp: number;
}

interface OrderBookData {
  bids: Array<{ price: number; amount: number; total: number }>;
  asks: Array<{ price: number; amount: number; total: number }>;
  spread: number;
  spreadPercentage: number;
  totalVolume: number;
  lastUpdate: number;
}

interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  lastMessage: any;
  error: string | null;

  // Market data
  marketData: MarketData[];
  subscribeToMarkets: (symbols: string[]) => void;
  unsubscribeFromMarkets: (symbols: string[]) => void;

  // Wallet data
  walletData: WalletData | null;
  subscribeToWallets: () => void;
  unsubscribeFromWallets: () => void;

  // Order data
  orderData: OrderData[];
  subscribeToOrders: () => void;
  unsubscribeFromOrders: () => void;

  // Price alerts
  priceAlerts: PriceAlert[];
  setPriceAlert: (alert: PriceAlert) => void;
  removePriceAlert: (symbol: string) => void;

  // Trend data
  priceHistory: Record<string, TrendData[]>;
  subscribeToTrend: (trendId: string) => void;
  unsubscribeFromTrend: (trendId: string) => void;

  // Order book data
  orderBookData: OrderBookData;

  // Connection methods
  disconnect: () => void;
  reconnect: () => void;

  // Custom message sending
  sendMessage: (message: any) => boolean;
}

export const useWebSocket = (url?: string): UseWebSocketReturn => {
  const {socket, isConnected, lastMessage, error, sendMessage: sendSocketMessage, disconnect, reconnect} = useSocket(url);

  // State for different data types
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [orderData, setOrderData] = useState<OrderData[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [priceHistory, setPriceHistory] = useState<Record<string, TrendData[]>>({});
  const [orderBookData, setOrderBookData] = useState<OrderBookData>({
    bids: [],
    asks: [],
    spread: 0,
    spreadPercentage: 0,
    totalVolume: 0,
    lastUpdate: Date.now(),
  });

  // Subscriptions tracking
  const marketSubscriptions = useRef<Set<string>>(new Set());
  const isSubscribedToWallets = useRef(false);
  const isSubscribedToOrders = useRef(false);
  const trendSubscriptions = useRef<Set<string>>(new Set());

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    const message = lastMessage;

    switch (message.type) {
      case 'market_update':
        if (message.data && Array.isArray(message.data)) {
          setMarketData(prev => {
            const newData = [...prev];
            message.data.forEach((update: MarketData) => {
              const index = newData.findIndex(item => item.symbol === update.symbol);
              if (index !== -1) {
                newData[index] = update;
              } else {
                newData.push(update);
              }
            });
            return newData;
          });
        }
        break;

      case 'wallet_update':
        if (message.data) {
          setWalletData(message.data);
        }
        break;

      case 'order_update':
        if (message.data) {
          if (Array.isArray(message.data)) {
            setOrderData(message.data);
          } else {
            setOrderData(prev => {
              const index = prev.findIndex(order => order.id === message.data.id);
              if (index !== -1) {
                const newOrders = [...prev];
                if (message.data.status === 'cancelled') {
                  newOrders.splice(index, 1);
                } else {
                  newOrders[index] = message.data;
                }
                return newOrders;
              } else if (message.data.status !== 'cancelled') {
                return [...prev, message.data];
              }
              return prev;
            });
          }
        }
        break;

      case 'price_alert':
        if (message.data) {
          setPriceAlerts(prev => {
            const existing = prev.find(alert => alert.symbol === message.data.symbol);
            if (existing) {
              return prev.map(alert =>
                alert.symbol === message.data.symbol ? { ...message.data } : alert
              );
            }
            return [...prev, message.data];
          });
        }
        break;

      case 'trend_update':
        if (message.data && message.data.trendId && message.data.priceHistory) {
          setPriceHistory(prev => ({
            ...prev,
            [message.data.trendId]: message.data.priceHistory
          }));
        }
        break;

      case 'orderbook_update':
        if (message.data) {
          setOrderBookData({
            bids: message.data.bids || [],
            asks: message.data.asks || [],
            spread: message.data.spread || 0,
            spreadPercentage: message.data.spreadPercentage || 0,
            totalVolume: message.data.totalVolume || 0,
            lastUpdate: message.data.lastUpdate || Date.now(),
          });
        }
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [lastMessage]);

  // Market subscription methods
  const subscribeToMarkets = useCallback((symbols: string[]) => {
    if (!isConnected) return;

    const newSubscriptions = symbols.filter(symbol => !marketSubscriptions.current.has(symbol));

    if (newSubscriptions.length > 0) {
      newSubscriptions.forEach(symbol => marketSubscriptions.current.add(symbol));

      sendSocketMessage({
        type: 'subscribe_markets',
        data: { symbols: newSubscriptions }
      });
    }
  }, [isConnected, sendSocketMessage]);

  const unsubscribeFromMarkets = useCallback((symbols: string[]) => {
    if (!isConnected) return;

    const existingSubscriptions = symbols.filter(symbol => marketSubscriptions.current.has(symbol));

    if (existingSubscriptions.length > 0) {
      existingSubscriptions.forEach(symbol => marketSubscriptions.current.delete(symbol));

      sendSocketMessage({
        type: 'unsubscribe_markets',
        data: { symbols: existingSubscriptions }
      });

      // Remove from local state
      setMarketData(prev => prev.filter(item => !existingSubscriptions.includes(item.symbol)));
    }
  }, [isConnected, sendSocketMessage]);

  // Wallet subscription methods
  const subscribeToWallets = useCallback(() => {
    if (!isConnected || isSubscribedToWallets.current) return;

    isSubscribedToWallets.current = true;

    sendSocketMessage({
      type: 'subscribe_wallets',
      data: {}
    });
  }, [isConnected, sendSocketMessage]);

  const unsubscribeFromWallets = useCallback(() => {
    if (!isConnected || !isSubscribedToWallets.current) return;

    isSubscribedToWallets.current = false;

    sendSocketMessage({
      type: 'unsubscribe_wallets',
      data: {}
    });

    setWalletData(null);
  }, [isConnected, sendSocketMessage]);

  // Order subscription methods
  const subscribeToOrders = useCallback(() => {
    if (!isConnected || isSubscribedToOrders.current) return;

    isSubscribedToOrders.current = true;

    sendSocketMessage({
      type: 'subscribe_orders',
      data: {}
    });
  }, [isConnected, sendSocketMessage]);

  const unsubscribeFromOrders = useCallback(() => {
    if (!isConnected || !isSubscribedToOrders.current) return;

    isSubscribedToOrders.current = false;

    sendSocketMessage({
      type: 'unsubscribe_orders',
      data: {}
    });

    setOrderData([]);
  }, [isConnected, sendSocketMessage]);

  // Price alert methods
  const setPriceAlert = useCallback((alert: PriceAlert) => {
    if (!isConnected) return;

    sendSocketMessage({
      type: 'set_price_alert',
      data: alert
    });

    setPriceAlerts(prev => {
      const existing = prev.find(a => a.symbol === alert.symbol);
      if (existing) {
        return prev.map(a => a.symbol === alert.symbol ? alert : a);
      }
      return [...prev, alert];
    });
  }, [isConnected, sendSocketMessage]);

  const removePriceAlert = useCallback((symbol: string) => {
    if (!isConnected) return;

    sendSocketMessage({
      type: 'remove_price_alert',
      data: { symbol }
    });

    setPriceAlerts(prev => prev.filter(alert => alert.symbol !== symbol));
  }, [isConnected, sendSocketMessage]);

  // Trend subscription methods
  const subscribeToTrend = useCallback((trendId: string) => {
    if (!isConnected || trendSubscriptions.current.has(trendId)) return;

    trendSubscriptions.current.add(trendId);

    sendSocketMessage({
      type: 'subscribe_trend',
      data: { trendId }
    });

    // Initialize with empty price history if not exists
    setPriceHistory(prev => ({
      ...prev,
      [trendId]: prev[trendId] || []
    }));
  }, [isConnected, sendSocketMessage]);

  const unsubscribeFromTrend = useCallback((trendId: string) => {
    if (!isConnected || !trendSubscriptions.current.has(trendId)) return;

    trendSubscriptions.current.delete(trendId);

    sendSocketMessage({
      type: 'unsubscribe_trend',
      data: { trendId }
    });

    // Remove from price history
    setPriceHistory(prev => {
      const newHistory = { ...prev };
      delete newHistory[trendId];
      return newHistory;
    });
  }, [isConnected, sendSocketMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all subscriptions when component unmounts
      if (isConnected) {
        if (marketSubscriptions.current.size > 0) {
          sendSocketMessage({
            type: 'unsubscribe_markets',
            data: { symbols: Array.from(marketSubscriptions.current) }
          });
        }

        if (isSubscribedToWallets.current) {
          sendSocketMessage({
            type: 'unsubscribe_wallets',
            data: {}
          });
        }

        if (isSubscribedToOrders.current) {
          sendSocketMessage({
            type: 'unsubscribe_orders',
            data: {}
          });
        }
      }
    };
  }, [isConnected, sendSocketMessage]);

  return {
    // Connection state
    isConnected,
    lastMessage,
    error,

    // Market data
    marketData,
    subscribeToMarkets,
    unsubscribeFromMarkets,

    // Wallet data
    walletData,
    subscribeToWallets,
    unsubscribeFromWallets,

    // Order data
    orderData,
    subscribeToOrders,
    unsubscribeFromOrders,

    // Price alerts
    priceAlerts,
    setPriceAlert,
    removePriceAlert,

    // Trend data
    priceHistory,
    subscribeToTrend,
    unsubscribeFromTrend,

    // Order book data
    orderBookData,

    // Connection methods
    disconnect,
    reconnect,

    // Custom message sending
    sendMessage: sendSocketMessage,
  };
};

export default useWebSocket;