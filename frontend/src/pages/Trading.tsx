import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, RefreshCw, Activity, History } from 'lucide-react';
import { useTradingStore, useCurrentSymbol, useMarketData, useAccountInfo } from '../stores/tradingStore';
import { CandlestickData } from '../types/trading.types';
import TradingChart from '../components/trading/TradingChart';
import OrderEntryPanel from '../components/trading/OrderEntryPanel';
import PositionsPanel from '../components/trading/PositionsPanel';
import ViralTrendsPanel from '../components/trading/ViralTrendsPanel';
import MarketSelector from '../components/trading/MarketSelector';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import { toast } from 'react-hot-toast';

const Trading: React.FC = () => {
  const currentSymbol = useCurrentSymbol();
  const marketData = useMarketData();
  const accountInfo = useAccountInfo();
  const { setCandlestickData, setMarketData } = useTradingStore();

  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [mobileView, setMobileView] = useState<'chart' | 'order' | 'positions'>('chart');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  // Detect screen size
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Generate mock candlestick data
  useEffect(() => {
    const generateCandlestickData = (): CandlestickData[] => {
      const data: CandlestickData[] = [];
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      let price = marketData?.price || 43250;

      for (let i = 100; i >= 0; i--) {
        const time = now - i * day;
        const volatility = 0.02; // 2% volatility
        const open = price;
        const change = (Math.random() - 0.5) * 2 * volatility * price;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
        const volume = Math.floor(Math.random() * 1000000) + 500000;

        data.push({
          time: Math.floor(time / 1000),
          open,
          high,
          low,
          close,
          volume,
        });

        price = close;
      }

      return data;
    };

    // Initialize market data if not set
    if (!marketData) {
      setMarketData(currentSymbol, {
        symbol: currentSymbol,
        price: 43250,
        change24h: 1250.50,
        changePercent24h: 2.98,
        volume24h: 28500000000,
        high24h: 44100,
        low24h: 42800,
      });
    }

    // Set candlestick data
    setCandlestickData(currentSymbol, generateCandlestickData());
  }, [currentSymbol, marketData]);

  const renderMobileNavigation = () => (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-xl border-t border-primary-700/20 safe-area-inset-bottom">
      <div className="grid grid-cols-3 gap-1 p-1">
        {[
          { key: 'chart', label: 'Chart', icon: <Activity className="w-5 h-5" /> },
          { key: 'order', label: 'Trade', icon: <RefreshCw className="w-5 h-5" /> },
          { key: 'positions', label: 'Positions', icon: <History className="w-5 h-5" /> },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setMobileView(item.key as typeof mobileView)}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-all ${
              mobileView === item.key
                ? 'bg-primary-700/30 text-primary-700'
                : 'text-gray-400'
            }`}
          >
            {item.icon}
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMobileHeader = () => (
    <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-dark-900/80 backdrop-blur-xl border-b border-primary-700/20">
      <h1 className="text-lg font-bold bg-gradient-viral bg-clip-text text-transparent">
        Trading
      </h1>
      <MarketSelector />
    </div>
  );

  const renderDesktopHeader = () => (
    <div className="hidden lg:flex items-center justify-between mb-6">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-viral bg-clip-text text-transparent mb-2">
          Trading Terminal
        </h1>
        <p className="text-gray-400">Trade viral momentum in real-time</p>
      </div>
      <div className="flex items-center gap-4">
        <MarketSelector />
      </div>
    </div>
  );

  const renderAccountStats = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
      <GlassCard className="!p-4">
        <div className="text-xs text-gray-400 mb-1">Balance</div>
        <div className="text-lg md:text-xl font-bold text-white">
          ${accountInfo.balance.toLocaleString()}
        </div>
      </GlassCard>
      <GlassCard className="!p-4">
        <div className="text-xs text-gray-400 mb-1">Equity</div>
        <div className="text-lg md:text-xl font-bold text-white">
          ${accountInfo.equity.toLocaleString()}
        </div>
      </GlassCard>
      <GlassCard className="!p-4">
        <div className="text-xs text-gray-400 mb-1">Used Margin</div>
        <div className="text-lg md:text-xl font-bold text-primary-700">
          ${accountInfo.marginUsed.toLocaleString()}
        </div>
      </GlassCard>
      <GlassCard className="!p-4">
        <div className="text-xs text-gray-400 mb-1">Free Margin</div>
        <div className="text-lg md:text-xl font-bold text-success-500">
          ${accountInfo.freeMargin.toLocaleString()}
        </div>
      </GlassCard>
    </div>
  );

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="bg-dark-950">
        {renderMobileHeader()}
        <div className="hidden lg:block px-6 lg:px-8 pt-6">
          {renderDesktopHeader()}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:hidden px-4 pb-24 pt-4">
        {/* Mobile View */}
        {mobileView === 'chart' && (
          <div className="space-y-4">
            {renderAccountStats()}
            <TradingChart height={300} />
            <ViralTrendsPanel />
          </div>
        )}

        {mobileView === 'order' && (
          <div className="space-y-4">
            {renderAccountStats()}
            <OrderEntryPanel />
          </div>
        )}

        {mobileView === 'positions' && (
          <div className="space-y-4">
            {renderAccountStats()}
            <PositionsPanel />
          </div>
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden lg:px-6 lg:px-8 lg:pb-8">
        {renderAccountStats()}

        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Chart (8 cols) */}
          <div className="col-span-8 space-y-6">
            <TradingChart height={500} />
          </div>

          {/* Right Column - Order Panel (4 cols) */}
          <div className="col-span-4">
            <OrderEntryPanel />
          </div>
        </div>

        {/* Bottom Section - Viral Trends & Positions */}
        <div className="grid grid-cols-12 gap-6 mt-6">
          <div className="col-span-4">
            <ViralTrendsPanel />
          </div>
          <div className="col-span-8">
            <PositionsPanel />
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {renderMobileNavigation()}
    </div>
  );
};

export default Trading;
