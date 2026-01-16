import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, TrendingUp, Bitcoin, DollarSign } from 'lucide-react';
import { useCurrentSymbol, useTradingStore } from '../../stores/tradingStore';
import { useNavigate } from 'react-router-dom';

interface Market {
  symbol: string;
  name: string;
  category: 'crypto' | 'forex' | 'commodities' | 'indices' | 'stocks';
  price: number;
  change24h: number;
  volume24h: number;
  icon?: React.ReactNode;
}

const MARKETS: Market[] = [
  // Crypto
  {
    symbol: 'BTC/USD',
    name: 'Bitcoin',
    category: 'crypto',
    price: 43250.00,
    change24h: 2.5,
    volume24h: 28500000000,
    icon: <Bitcoin className="w-4 h-4" />,
  },
  {
    symbol: 'ETH/USD',
    name: 'Ethereum',
    category: 'crypto',
    price: 2280.50,
    change24h: 3.2,
    volume24h: 12500000000,
    icon: <Bitcoin className="w-4 h-4" />,
  },
  {
    symbol: 'SOL/USD',
    name: 'Solana',
    category: 'crypto',
    price: 98.45,
    change24h: -1.8,
    volume24h: 2100000000,
  },
  // Forex
  {
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    category: 'forex',
    price: 1.0925,
    change24h: 0.15,
    volume24h: 850000000,
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    symbol: 'GBP/USD',
    name: 'British Pound / US Dollar',
    category: 'forex',
    price: 1.2635,
    change24h: -0.25,
    volume24h: 650000000,
  },
  {
    symbol: 'USD/ZAR',
    name: 'US Dollar / South African Rand',
    category: 'forex',
    price: 18.85,
    change24h: 0.85,
    volume24h: 120000000,
  },
  // Commodities
  {
    symbol: 'XAU/USD',
    name: 'Gold',
    category: 'commodities',
    price: 2035.50,
    change24h: 1.2,
    volume24h: 450000000,
  },
  {
    symbol: 'XAG/USD',
    name: 'Silver',
    category: 'commodities',
    price: 23.15,
    change24h: -0.5,
    volume24h: 85000000,
  },
  // Viral/Trending Stocks (from Topics system)
  {
    symbol: 'TSLA/USD',
    name: 'Tesla Inc',
    category: 'stocks',
    price: 248.50,
    change24h: 5.8,
    volume24h: 112000000,
  },
  {
    symbol: 'AAPL/USD',
    name: 'Apple Inc',
    category: 'stocks',
    price: 192.35,
    change24h: 1.9,
    volume24h: 89000000,
  },
];

const CATEGORIES = [
  { id: 'all', name: 'All Markets' },
  { id: 'crypto', name: 'Crypto' },
  { id: 'forex', name: 'Forex' },
  { id: 'commodities', name: 'Commodities' },
  { id: 'stocks', name: 'Viral Stocks' },
];

const MarketSelector: React.FC = () => {
  const currentSymbol = useCurrentSymbol();
  const { setCurrentSymbol } = useTradingStore();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMarkets = MARKETS.filter((market) => {
    const matchesCategory = selectedCategory === 'all' || market.category === selectedCategory;
    const matchesSearch = market.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          market.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentMarket = MARKETS.find((m) => m.symbol === currentSymbol) || MARKETS[0];

  const handleSelectMarket = (market: Market) => {
    setCurrentSymbol(market.symbol);
    setIsOpen(false);

    // Update market data in store
    useTradingStore.getState().setMarketData(market.symbol, {
      symbol: market.symbol,
      price: market.price,
      change24h: market.change24h,
      changePercent24h: market.change24h,
      volume24h: market.volume24h,
      high24h: market.price * 1.02,
      low24h: market.price * 0.98,
    });

    // Navigate to trade page
    navigate('/trade');
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 hover:border-primary-700/50 transition-all min-w-[280px]"
      >
        {currentMarket.icon}
        <div className="flex-1 text-left">
          <div className="text-sm font-bold text-white">{currentMarket.symbol}</div>
          <div className="text-xs text-gray-400">{currentMarket.name}</div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold ${currentMarket.change24h >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
            {currentMarket.change24h >= 0 ? '+' : ''}{currentMarket.change24h.toFixed(2)}%
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown Content */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-0 right-0 mt-2 z-20 rounded-xl backdrop-blur-xl bg-dark-800/95 border border-primary-700/30 shadow-2xl max-h-[400px] flex flex-col"
            >
              {/* Search */}
              <div className="p-3 border-b border-primary-700/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search markets..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-dark-900/50 border border-primary-700/30 text-white text-sm focus:outline-none focus:border-primary-700"
                  />
                </div>
              </div>

              {/* Categories */}
              <div className="flex gap-2 p-3 border-b border-primary-700/20 overflow-x-auto">
                {CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategory === category.id
                        ? 'bg-primary-700 text-white'
                        : 'bg-dark-900/50 text-gray-400 hover:bg-primary-700/20'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {/* Market List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredMarkets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Search className="w-10 h-10 text-gray-600 mb-2" />
                    <p className="text-gray-400 text-sm">No markets found</p>
                  </div>
                ) : (
                  filteredMarkets.map((market) => (
                    <button
                      key={market.symbol}
                      onClick={() => handleSelectMarket(market)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        currentSymbol === market.symbol
                          ? 'bg-primary-700/30 border border-primary-700/50'
                          : 'hover:bg-primary-700/10 border border-transparent'
                      }`}
                    >
                      {market.icon || <TrendingUp className="w-4 h-4 text-gray-500" />}
                      <div className="flex-1 text-left">
                        <div className={`text-sm font-semibold ${currentSymbol === market.symbol ? 'text-white' : 'text-gray-300'}`}>
                          {market.symbol}
                        </div>
                        <div className="text-xs text-gray-500">{market.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">${market.price.toLocaleString()}</div>
                        <div className={`text-xs font-medium ${market.change24h >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                          {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* View All Markets Link */}
              <div className="p-3 border-t border-primary-700/20">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/markets');
                  }}
                  className="w-full py-2 rounded-lg bg-primary-700/20 text-primary-700 text-sm font-medium hover:bg-primary-700/30 transition-all flex items-center justify-center gap-2"
                >
                  View All Markets
                  <TrendingUp className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketSelector;
