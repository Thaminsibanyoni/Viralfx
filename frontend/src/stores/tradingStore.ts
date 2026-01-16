import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
  CandlestickData,
  MarketData,
  Order,
  Position,
  ViralTrend,
  ViralTrendMarket,
  VTSSymbol,
  VPMXData,
  SupportResistanceLevel,
  TechnicalIndicators,
  TrendReversal,
  ChartIndicator,
  MarketDepth,
  TradingViewLayout,
  FibonacciLevels,
  DrawingTool,
  OrderSide,
  OrderType,
  OrderStatus,
} from '../types/trading.types';

interface TradingState {
  // Market Data
  currentSymbol: string;
  currentVTSSymbol?: VTSSymbol;
  marketData: Record<string, MarketData>;
  candlestickData: Record<string, CandlestickData[]>;
  currentTimeframe: string;

  // Orders & Positions
  orders: Order[];
  positions: Position[];
  balance: number;
  equity: number;
  marginUsed: number;
  marginLevel: number;
  freeMargin: number;

  // Enhanced Viral Trends with VPMX
  viralTrends: ViralTrend[];
  viralTrendMarkets: ViralTrendMarket[];
  vpmxData: Record<string, VPMXData>;

  // Technical Analysis
  supportResistanceLevels: SupportResistanceLevel[];
  technicalIndicators: Record<string, TechnicalIndicators>;
  trendReversals: TrendReversal[];
  fibonacciLevels: Record<string, FibonacciLevels>;
  marketDepth: MarketDepth | null;

  // Chart Settings
  chartIndicators: ChartIndicator[];
  drawingTools: DrawingTool[];
  chartLayout: TradingViewLayout;

  // UI State
  selectedOrderSide: OrderSide;
  selectedOrderType: OrderType;

  // Actions
  setCurrentSymbol: (symbol: string) => void;
  setCurrentVTSSymbol: (vtsSymbol: VTSSymbol) => void;
  setCurrentTimeframe: (timeframe: string) => void;
  setMarketData: (symbol: string, data: MarketData) => void;
  setCandlestickData: (symbol: string, data: CandlestickData[]) => void;
  setViralTrends: (trends: ViralTrend[]) => void;
  setViralTrendMarkets: (trends: ViralTrendMarket[]) => void;
  setVPMXData: (symbol: string, data: VPMXData) => void;
  setSupportResistanceLevels: (levels: SupportResistanceLevel[]) => void;
  setTechnicalIndicators: (symbol: string, indicators: TechnicalIndicators) => void;
  setTrendReversals: (reversals: TrendReversal[]) => void;
  setFibonacciLevels: (symbol: string, levels: FibonacciLevels) => void;
  setMarketDepth: (depth: MarketDepth) => void;
  setChartIndicators: (indicators: ChartIndicator[]) => void;
  addDrawingTool: (tool: DrawingTool) => void;
  removeDrawingTool: (toolId: string) => void;
  setChartLayout: (layout: Partial<TradingViewLayout>) => void;

  placeOrder: (order: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'timestamp'>) => Promise<void>;
  cancelOrder: (orderId: string) => Promise<void>;
  closePosition: (positionId: string) => Promise<void>;

  setSelectedOrderSide: (side: OrderSide) => void;
  setSelectedOrderType: (type: OrderType) => void;

  // Utility
  calculatePnL: (position: Position, currentPrice: number) => { pnl: number; pnlPercent: number };
  parseVTSSymbol: (vtsString: string) => VTSSymbol | null;
  formatVTSSymbol: (vts: VTSSymbol) => string;
}

export const useTradingStore = create<TradingState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial State
      currentSymbol: 'BTC/USD',
      currentVTSSymbol: undefined,
      currentTimeframe: '1h',
      marketData: {},
      candlestickData: {},
      orders: [],
      positions: [],
      balance: 100000,
      equity: 100000,
      marginUsed: 0,
      marginLevel: 0,
      freeMargin: 100000,
      viralTrends: [],
      viralTrendMarkets: [],
      vpmxData: {},
      supportResistanceLevels: [],
      technicalIndicators: {},
      trendReversals: [],
      fibonacciLevels: {},
      marketDepth: null,
      chartIndicators: [],
      drawingTools: [],
      chartLayout: {
        timeframe: '1h',
        chartType: 'candlestick',
        indicators: [],
        showVolume: true,
        showVPMX: true,
        showOrderBook: false,
        panelLayout: 'dual',
        locked: false,
      },
      selectedOrderSide: 'buy',
      selectedOrderType: 'market',

      // Actions
      setCurrentSymbol: (symbol) => set({ currentSymbol: symbol }),

      setCurrentTimeframe: (timeframe) => set({ currentTimeframe: timeframe }),

      setMarketData: (symbol, data) =>
        set((state) => ({
          marketData: { ...state.marketData, [symbol]: data },
        })),

      setCandlestickData: (symbol, data) =>
        set((state) => ({
          candlestickData: { ...state.candlestickData, [symbol]: data },
        })),

      setViralTrends: (trends) => set({ viralTrends: trends }),

      setSupportResistanceLevels: (levels) => set({ supportResistanceLevels: levels }),

      setTechnicalIndicators: (symbol, indicators) =>
        set((state) => ({
          technicalIndicators: { ...state.technicalIndicators, [symbol]: indicators },
        })),

      setSelectedOrderSide: (side) => set({ selectedOrderSide: side }),

      setSelectedOrderType: (type) => set({ selectedOrderType: type }),

      setCurrentVTSSymbol: (vtsSymbol) => set({ currentVTSSymbol: vtsSymbol }),

      setViralTrendMarkets: (trends) => set({ viralTrendMarkets: trends }),

      setVPMXData: (symbol, data) =>
        set((state) => ({
          vpmxData: { ...state.vpmxData, [symbol]: data },
        })),

      setTrendReversals: (reversals) => set({ trendReversals: reversals }),

      setFibonacciLevels: (symbol, levels) =>
        set((state) => ({
          fibonacciLevels: { ...state.fibonacciLevels, [symbol]: levels },
        })),

      setMarketDepth: (depth) => set({ marketDepth: depth }),

      setChartIndicators: (indicators) => set({ chartIndicators: indicators }),

      addDrawingTool: (tool) =>
        set((state) => ({
          drawingTools: [...state.drawingTools, tool],
        })),

      removeDrawingTool: (toolId) =>
        set((state) => ({
          drawingTools: state.drawingTools.filter((t) => t.id !== toolId),
        })),

      setChartLayout: (layout) =>
        set((state) => ({
          chartLayout: { ...state.chartLayout, ...layout },
        })),

      parseVTSSymbol: (vtsString: string) => {
        // Parse V:CC:SEC:TICKER format
        const parts = vtsString.split(':');
        if (parts.length !== 4 || parts[0] !== 'V') {
          return null;
        }

        return {
          fullSymbol: vtsString,
          country: parts[1],
          sector: parts[2],
          ticker: parts[3],
          displayName: `${parts[3]} (${parts[1]}/${parts[2]})`,
        };
      },

      formatVTSSymbol: (vts: VTSSymbol) => {
        return `V:${vts.country}:${vts.sector}:${vts.ticker}`;
      },

      placeOrder: async (orderData) => {
        const order: Order = {
          ...orderData,
          id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          status: (orderData.type === 'market' ? 'filled' : 'pending') as OrderStatus,
          filledQuantity: orderData.type === 'market' ? orderData.quantity : 0,
          timestamp: Date.now(),
        };

        // Update orders
        set((state) => ({
          orders: [order, ...state.orders],
        }));

        // If market order, create position
        if (orderData.type === 'market') {
          const position: Position = {
            id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            symbol: orderData.symbol,
            side: orderData.side === 'buy' ? 'long' : 'short',
            entryPrice: orderData.price,
            currentPrice: orderData.price,
            quantity: orderData.quantity,
            unrealizedPnl: 0,
            unrealizedPnlPercent: 0,
            leverage: 1,
            marginUsed: orderData.price * orderData.quantity,
            timestamp: Date.now(),
          };

          set((state) => {
            const newState = {
              positions: [...state.positions, position],
              marginUsed: state.marginUsed + position.marginUsed,
            };
            newState.freeMargin = state.balance - newState.marginUsed;
            newState.equity = state.balance + state.positions.reduce((acc, pos) => acc + pos.unrealizedPnl, 0);
            return newState;
          });
        }

        return Promise.resolve(order);
      },

      cancelOrder: async (orderId) => {
        set((state) => ({
          orders: state.orders.map((order) =>
            order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
          ),
        }));
        return Promise.resolve();
      },

      closePosition: async (positionId) => {
        set((state) => {
          const position = state.positions.find((p) => p.id === positionId);
          if (!position) return state;

          const realizedPnl = position.unrealizedPnl;
          const newState = {
            positions: state.positions.filter((p) => p.id !== positionId),
            balance: state.balance + realizedPnl,
            marginUsed: state.marginUsed - position.marginUsed,
          };
          newState.freeMargin = newState.balance - newState.marginUsed;
          newState.equity = newState.balance + newState.positions.reduce((acc, pos) => acc + pos.unrealizedPnl, 0);
          return newState;
        });
        return Promise.resolve();
      },

      calculatePnL: (position, currentPrice) => {
        const priceDiff = currentPrice - position.entryPrice;
        const pnl = position.side === 'long'
          ? priceDiff * position.quantity
          : -priceDiff * position.quantity;
        const pnlPercent = (pnl / position.marginUsed) * 100;
        return { pnl, pnlPercent };
      },
    }))
  )
);

// Selector hooks
export const useCurrentSymbol = () => useTradingStore((state) => state.currentSymbol);
export const useMarketData = (symbol?: string) => {
  const currentSymbol = useCurrentSymbol();
  return useTradingStore((state) => state.marketData[symbol || currentSymbol]);
};
export const useCandlestickData = (symbol?: string) => {
  const currentSymbol = useCurrentSymbol();
  return useTradingStore((state) => state.candlestickData[symbol || currentSymbol]);
};
export const useOrders = () => useTradingStore((state) => state.orders);
export const usePositions = () => useTradingStore((state) => state.positions);
export const useAccountInfo = () => useTradingStore((state) => ({
  balance: state.balance,
  equity: state.equity,
  marginUsed: state.marginUsed,
  freeMargin: state.freeMargin,
  marginLevel: state.marginLevel,
}));
