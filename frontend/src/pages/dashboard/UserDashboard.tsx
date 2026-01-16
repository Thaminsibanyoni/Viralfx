import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RiseOutlined,
  FallOutlined,
  WalletOutlined,
  ReloadOutlined,
  EyeOutlined,
  DollarCircleOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FireOutlined,
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  BellOutlined,
  DownOutlined,
  CloseOutlined,
  MenuOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { walletApi } from '../../services/api/wallet.api';
import { marketsApi } from '../../services/api/markets.api';
import { topicsApi } from '../../services/api/topics.api';

// ============================================
// TYPES & INTERFACES
// ============================================
interface Position {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  status: 'FILLED' | 'PENDING';
}

interface Topic {
  id: string;
  name?: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  symbol?: string;
  viralityScore: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  region?: string;
  status?: string;
  isVerified?: boolean;
  engagementMetrics: {
    likes: number;
    shares: number;
    comments: number;
  };
  totalVolume?: number;
  totalBets?: number;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface TickerItem {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

// ============================================
// MOCK DATA
// ============================================
const mockBalance = {
  total: 1000,
  available: 1000,
  locked: 0,
  currency: 'ZAR'
};

const mockTickers: TickerItem[] = [
  { symbol: '$BBMZA', price: 125.50, change: 5.20, changePercent: 4.32 },
  { symbol: '$VENZ', price: 89.30, change: -2.15, changePercent: -2.35 },
  { symbol: '$SAFTY', price: 210.75, change: 8.45, changePercent: 4.18 },
  { symbol: '$CRYPTO', price: 45.20, change: 1.80, changePercent: 4.14 },
  { symbol: '$TECH', price: 178.90, change: -3.20, changePercent: -1.76 },
  { symbol: '$SPORT', price: 95.60, change: 4.15, changePercent: 4.54 },
];

const mockTrendingTopics: Topic[] = [
  {
    id: '1',
    name: '#BBMzansiS6',
    title: '#BBMzansiS6',
    slug: 'bbmzansi-s6',
    category: 'Entertainment',
    description: 'Big Brother Mzansi Season 6 trending',
    symbol: '$BBMZA',
    viralityScore: 95,
    sentiment: 'POSITIVE',
    region: 'ZA',
    status: 'ACTIVE',
    isVerified: true,
    engagementMetrics: { likes: 50000, shares: 25000, comments: 10000 },
    totalVolume: 100000,
    totalBets: 500,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    name: '#Venezuelacrisis',
    title: '#Venezuelacrisis',
    slug: 'venezuela-crisis',
    category: 'Politics',
    description: 'Political situation updates',
    symbol: '$VENZ',
    viralityScore: 78,
    sentiment: 'NEGATIVE',
    region: 'GLOBAL',
    status: 'ACTIVE',
    isVerified: true,
    engagementMetrics: { likes: 30000, shares: 15000, comments: 8000 },
    totalVolume: 75000,
    totalBets: 300,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '3',
    name: '#LoadShedding',
    title: '#LoadShedding',
    slug: 'load-shedding',
    category: 'News',
    description: 'Power utility updates',
    symbol: '$ESKOM',
    viralityScore: 88,
    sentiment: 'NEGATIVE',
    region: 'ZA',
    status: 'ACTIVE',
    isVerified: true,
    engagementMetrics: { likes: 45000, shares: 30000, comments: 15000 },
    totalVolume: 120000,
    totalBets: 650,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
];

// ============================================
// ANIMATED COUNTER COMPONENT
// ============================================
const AnimatedCounter: React.FC<{
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}> = ({ value, duration = 1.5, prefix = '', suffix = '', decimals = 2, className = '' }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / (duration * 1000), 1);

      setCount(value * progress);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}
      {count.toLocaleString('en-ZA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

// ============================================
// SPARKLINE CHART COMPONENT
// ============================================
const SparklineChart: React.FC<{
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}> = ({ data, color = '#FFB300', width = 100, height = 40, className = '' }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#gradient-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ============================================
// STAT CARD COMPONENT
// ============================================
const StatCard: React.FC<{
  title: string;
  value: number | string;
  change?: number;
  changePercent?: number;
  icon: React.ReactNode;
  gradient?: string;
  trend?: 'up' | 'down' | 'neutral';
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delay?: number;
}> = ({
  title,
  value,
  change,
  changePercent,
  icon,
  gradient = 'from-purple-900/50 to-dark-900/50',
  trend = 'neutral',
  prefix = 'R',
  suffix = '',
  decimals = 2,
  delay = 0
}) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative group"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-300`} />
      <div className="relative bg-gradient-to-br from-dark-800/80 to-dark-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-gold-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-gold-500/10">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl shadow-lg shadow-primary-500/20">
            {icon}
          </div>
          {change !== undefined && (
            <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${
              trend === 'up'
                ? 'bg-success-500/10 text-success-400'
                : trend === 'down'
                ? 'bg-danger-500/10 text-danger-400'
                : 'bg-gray-500/10 text-gray-400'
            }`}>
              <span className="flex items-center">
                {trend === 'up' ? <RiseOutlined style={{ fontSize: '16px' }} /> : trend === 'down' ? <FallOutlined style={{ fontSize: '16px' }} /> : null}
              </span>
              <span>{changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white">
            <AnimatedCounter
              value={numericValue}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
              className="text-gold-400"
            />
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================
// TOPIC CARD COMPONENT
// ============================================
const TopicCard: React.FC<{
  topic: Topic;
  index: number;
  onTrade: (topicId: string) => void;
}> = ({ topic, index, onTrade }) => {
  const sparklineData = [50, 65, 55, 70, 60, 75, 80, 72, 85, 90];
  const sparklineColor = topic.sentiment === 'POSITIVE' ? '#22c55e' : topic.sentiment === 'NEGATIVE' ? '#ef4444' : '#FFB300';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600/20 to-gold-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative bg-gradient-to-br from-dark-800/60 to-dark-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-gold-500/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-gold-500/10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-gold-400 font-bold text-lg">{topic.name || topic.title}</h3>
              {topic.isVerified && (
                <span className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-xs rounded-full border border-primary-500/30">
                  Verified
                </span>
              )}
            </div>
            <p className="text-gray-400 text-sm mb-2">{topic.description}</p>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-white/5 text-gray-300 text-xs rounded-lg">{topic.category}</span>
              <span className={`px-2 py-1 text-xs rounded-lg ${
                topic.sentiment === 'POSITIVE'
                  ? 'bg-success-500/10 text-success-400'
                  : topic.sentiment === 'NEGATIVE'
                  ? 'bg-danger-500/10 text-danger-400'
                  : 'bg-warning-500/10 text-warning-400'
              }`}>
                {topic.sentiment}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">Virality</p>
              <div className="flex items-center gap-1">
                <span className="flex items-center">
                  <FireOutlined style={{ fontSize: '16px', color: '#fb923c' }} />
                </span>
                <span className="text-white font-bold">{topic.viralityScore}</span>
              </div>
            </div>
            <SparklineChart
              data={sparklineData}
              color={sparklineColor}
              width={80}
              height={40}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Likes</p>
            <p className="text-white font-semibold text-sm">
              {(topic.engagementMetrics.likes / 1000).toFixed(1)}K
            </p>
          </div>
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Shares</p>
            <p className="text-white font-semibold text-sm">
              {(topic.engagementMetrics.shares / 1000).toFixed(1)}K
            </p>
          </div>
          <div className="text-center p-2 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Comments</p>
            <p className="text-white font-semibold text-sm">
              {(topic.engagementMetrics.comments / 1000).toFixed(1)}K
            </p>
          </div>
        </div>

        <button
          onClick={() => onTrade(topic.id)}
          className="w-full py-2.5 px-4 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30 flex items-center justify-center gap-2"
        >
          <span className="flex items-center">
            <ThunderboltOutlined style={{ fontSize: '16px' }} />
          </span>
          Trade Now
        </button>
      </div>
    </motion.div>
  );
};

// ============================================
// GRADIENT BUTTON COMPONENT
// ============================================
const GradientButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'gold' | 'success' | 'danger';
  icon?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}> = ({ children, onClick, variant = 'primary', icon, className = '', fullWidth = false }) => {
  const gradients = {
    primary: 'from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800',
    gold: 'from-gold-600 to-gold-500 hover:from-gold-700 hover:to-gold-600',
    success: 'from-success-600 to-success-500 hover:from-success-700 hover:to-success-600',
    danger: 'from-danger-600 to-danger-500 hover:from-danger-700 hover:to-danger-600',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`px-6 py-3 bg-gradient-to-r ${gradients[variant]} text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </motion.button>
  );
};

// ============================================
// TICKER BAR COMPONENT - Uses CSS animation instead of JS interval
// ============================================
const TickerBar: React.FC<{ tickers: TickerItem[] }> = ({ tickers }) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-dark-950 via-dark-900 to-dark-950 border-b border-white/5 backdrop-blur-xl">
      <div className="overflow-hidden py-3 px-4">
        <div className="flex items-center gap-8 animate-ticker">
          {[...tickers, ...tickers, ...tickers].map((ticker, index) => (
            <div
              key={`${ticker.symbol}-${index}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
            >
              <span className="text-gold-400 font-semibold text-sm">{ticker.symbol}</span>
              <span className="text-white font-medium">R{ticker.price.toFixed(2)}</span>
              <div className={`flex items-center gap-1 text-xs font-semibold ${
                ticker.change >= 0 ? 'text-success-400' : 'text-danger-400'
              }`}>
                <span className="flex items-center">
                  {ticker.change >= 0 ? <ArrowUpOutlined style={{ fontSize: '12px' }} /> : <ArrowDownOutlined style={{ fontSize: '12px' }} />}
                </span>
                <span>{ticker.changePercent >= 0 ? '+' : ''}{ticker.changePercent.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================
const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('ZAR');
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use mock data directly (APIs disabled due to backend issues)
  const walletBalance = mockBalance;
  const trendingTopics = mockTrendingTopics;
  const tickers = mockTickers;

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0
    ? (totalPnL / (positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0))) * 100
    : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const handleTrade = (topicId: string) => {
    navigate(`/markets/trade?topic=${topicId}`);
  };

  const menuItems = [
    {
      icon: <span className="flex items-center"><UserOutlined style={{ fontSize: '20px' }} /></span>,
      label: 'Profile',
      onClick: () => navigate('/profile')
    },
    {
      icon: <span className="flex items-center"><WalletOutlined style={{ fontSize: '20px' }} /></span>,
      label: 'Wallet',
      onClick: () => navigate('/wallet')
    },
    {
      icon: <span className="flex items-center"><SettingOutlined style={{ fontSize: '20px' }} /></span>,
      label: 'Settings',
      onClick: () => navigate('/settings')
    },
    {
      icon: <span className="flex items-center"><QuestionCircleOutlined style={{ fontSize: '20px' }} /></span>,
      label: 'Help',
      onClick: () => navigate('/help')
    },
    {
      icon: <span className="flex items-center"><LogoutOutlined style={{ fontSize: '20px' }} /></span>,
      label: 'Logout',
      onClick: () => navigate('/logout')
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950">
      {/* Add CSS animation for ticker */}
      <style>{`
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
          display: flex;
          width: max-content;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Ticker Bar - Now uses CSS animation instead of JS interval */}
      <TickerBar tickers={tickers} />

      {/* Main Content */}
      <div className="pt-16 px-4 sm:px-6 lg:px-8 pb-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-between mb-8 mt-4"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gold-400 via-gold-500 to-gold-600 bg-clip-text text-transparent mb-2">
              Trading Dashboard
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Welcome back! Here's your trading overview
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency Selector */}
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="appearance-none bg-dark-800/80 backdrop-blur-xl border border-white/10 text-gold-400 font-semibold px-4 py-2.5 pr-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-gold-500/50 hover:border-gold-500/30 transition-all cursor-pointer"
              >
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center text-gold-400 pointer-events-none">
                <DollarCircleOutlined style={{ fontSize: '16px' }} />
              </span>
            </div>

            {/* Refresh Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              className="p-2.5 bg-dark-800/80 backdrop-blur-xl border border-white/10 rounded-xl hover:border-gold-500/30 transition-all"
              disabled={isRefreshing}
            >
              <span className="flex items-center">
                <ReloadOutlined
                  style={{ fontSize: '20px', color: '#FFB300' }}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
              </span>
            </motion.button>

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2.5 bg-dark-800/80 backdrop-blur-xl border border-white/10 rounded-xl hover:border-gold-500/30 transition-all relative"
            >
              <span className="flex items-center">
                <BellOutlined style={{ fontSize: '20px', color: '#FFB300' }} />
              </span>
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-danger-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                3
              </span>
            </motion.button>

            {/* Menu */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 bg-dark-800/80 backdrop-blur-xl border border-white/10 rounded-xl hover:border-gold-500/30 transition-all"
              >
                <span className="flex items-center">
                  <MenuOutlined style={{ fontSize: '20px', color: '#FFB300' }} />
                </span>
              </motion.button>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-56 bg-dark-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    {menuItems.map((item, index) => (
                      <motion.button
                        key={item.label}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        onClick={() => {
                          item.onClick();
                          setIsMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 transition-all"
                      >
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <StatCard
            title="Total Balance"
            value={walletBalance?.total || 0}
            icon={<span className="flex items-center"><WalletOutlined style={{ fontSize: '24px', color: '#ffffff' }} /></span>}
            gradient="from-gold-600/20 to-primary-600/20"
            trend="up"
            changePercent={5.25}
            delay={0}
          />
          <StatCard
            title="Total P&L"
            value={totalPnL}
            icon={<span className="flex items-center"><BarChartOutlined style={{ fontSize: '24px', color: '#ffffff' }} /></span>}
            gradient={totalPnL >= 0 ? 'from-success-600/20 to-success-500/20' : 'from-danger-600/20 to-danger-500/20'}
            trend={totalPnL >= 0 ? 'up' : 'down'}
            changePercent={totalPnLPercent}
            delay={0.1}
          />
          <StatCard
            title="Active Positions"
            value={positions.length}
            icon={<span className="flex items-center"><EyeOutlined style={{ fontSize: '24px', color: '#ffffff' }} /></span>}
            gradient="from-primary-600/20 to-purple-600/20"
            delay={0.2}
            decimals={0}
            suffix=""
          />
          <StatCard
            title="24h Change"
            value={totalPnLPercent}
            icon={<span className="flex items-center"><RiseOutlined style={{ fontSize: '24px', color: '#ffffff' }} /></span>}
            gradient={totalPnLPercent >= 0 ? 'from-success-600/20 to-success-500/20' : 'from-danger-600/20 to-danger-500/20'}
            trend={totalPnLPercent >= 0 ? 'up' : 'down'}
            delay={0.3}
            decimals={2}
            suffix="%"
            prefix=""
          />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-gradient-to-br from-dark-800/60 to-dark-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8 hover:border-gold-500/20 transition-all duration-300"
        >
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="flex items-center">
              <StarOutlined style={{ fontSize: '20px', color: '#FFB300' }} />
            </span>
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <GradientButton
              variant="primary"
              icon={<span className="flex items-center"><PlusOutlined style={{ fontSize: '16px' }} /></span>}
              onClick={() => navigate('/wallet/funding')}
            >
              Deposit Funds
            </GradientButton>
            <GradientButton
              variant="gold"
              icon={<span className="flex items-center"><WalletOutlined style={{ fontSize: '16px' }} /></span>}
              onClick={() => navigate('/wallet')}
            >
              View Wallet
            </GradientButton>
            <GradientButton
              variant="success"
              icon={<span className="flex items-center"><FireOutlined style={{ fontSize: '16px' }} /></span>}
              onClick={() => navigate('/markets')}
            >
              View Markets
            </GradientButton>
            <GradientButton
              variant="primary"
              icon={<span className="flex items-center"><SearchOutlined style={{ fontSize: '16px' }} /></span>}
              onClick={() => navigate('/topics')}
            >
              Explore Topics
            </GradientButton>
          </div>
        </motion.div>

        {/* Trending Topics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="flex items-center">
                <FireOutlined style={{ fontSize: '20px', color: '#fb923c' }} />
              </span>
              Trending Topics
            </h2>
            <button
              onClick={() => navigate('/topics')}
              className="text-gold-400 hover:text-gold-300 font-medium text-sm flex items-center gap-1 transition-colors"
            >
              View All
              <span className="flex items-center">
                <ArrowUpOutlined style={{ fontSize: '16px' }} />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trendingTopics.map((topic, index) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                index={index}
                onTrade={handleTrade}
              />
            ))}
          </div>
        </motion.div>

        {/* Market Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="bg-gradient-to-br from-dark-800/60 to-dark-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-gold-500/20 transition-all duration-300"
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="flex items-center">
              <BarChartOutlined style={{ fontSize: '20px', color: '#FFB300' }} />
            </span>
            Market Statistics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <p className="text-gray-400 text-sm mb-2">24h Volume</p>
              <p className="text-2xl font-bold text-gold-400">R2.8B</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-success-400 text-sm">
                <span className="flex items-center">
                  <ArrowUpOutlined style={{ fontSize: '16px' }} />
                </span>
                <span>+12.5%</span>
              </div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <p className="text-gray-400 text-sm mb-2">Active Markets</p>
              <p className="text-2xl font-bold text-gold-400">1,247</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-success-400 text-sm">
                <span className="flex items-center">
                  <ArrowUpOutlined style={{ fontSize: '16px' }} />
                </span>
                <span>+5.3%</span>
              </div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <p className="text-gray-400 text-sm mb-2">Trending Symbols</p>
              <p className="text-2xl font-bold text-gold-400">89</p>
              <div className="flex items-center justify-center gap-1 mt-2 text-success-400 text-sm">
                <span className="flex items-center">
                  <ArrowUpOutlined style={{ fontSize: '16px' }} />
                </span>
                <span>+8.7%</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default UserDashboard;
