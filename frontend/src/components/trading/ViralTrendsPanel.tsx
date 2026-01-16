import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  MessageSquare,
  Eye,
  ArrowUpRight,
  Zap,
  BarChart3,
  Users,
  Globe,
  Star,
  Clock,
} from 'lucide-react';
import { useTradingStore } from '../../stores/tradingStore';
import { ViralTrend, ViralTrendMarket } from '../../types/trading.types';
import GlassCard from '../ui/GlassCard';
import { useNavigate } from 'react-router-dom';

const ViralTrendsPanel: React.FC = () => {
  const { viralTrends, viralTrendMarkets, setCurrentSymbol } = useTradingStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'bullish' | 'bearish' | 'accelerating'>('all');
  const [hoveredTrend, setHoveredTrend] = useState<string | null>(null);

  // Enhanced mock data with VPMX - in production, fetch from API
  useEffect(() => {
    const mockMarkets: ViralTrendMarket[] = [
      {
        id: '1',
        symbol: 'V:ZA:ENT:ZINHLEXD',
        name: 'Zinhle XD - New Album Release',
        viralScore: 95,
        sentiment: 'bullish',
        socialMentions: 125000,
        priceImpact: 12.5,
        timestamp: Date.now() - 3600000,
        vtsSymbol: {
          fullSymbol: 'V:ZA:ENT:ZINHLEXD',
          country: 'ZA',
          sector: 'ENT',
          ticker: 'ZINHLEXD',
          displayName: 'Zinhle XD',
        },
        vpmx: {
          score: 95,
          rank: 1,
          change24h: 15,
          momentum: 'accelerating',
          peakScore: 98,
          peakTime: Date.now() - 7200000,
          averageScore: 87,
          prediction: {
            next24h: 92,
            confidence: 0.85,
            trend: 'up',
          },
        },
        marketCap: 50000000,
        tradingVolume: 2500000,
        relatedTopics: ['music', 'album', 'south africa', 'entertainment'],
        influencers: ['@zinhle_xd', '@music_sa', '@trendza'],
        platforms: [
          { platform: 'Twitter', mentions: 45000, sentiment: 'positive', growthRate: 25 },
          { platform: 'TikTok', mentions: 58000, sentiment: 'positive', growthRate: 35 },
          { platform: 'Instagram', mentions: 22000, sentiment: 'positive', growthRate: 18 },
        ],
        categories: ['Music', 'Entertainment', 'Celebrity'],
      },
      {
        id: '2',
        symbol: 'V:ZA:TECH:ELONMUSK',
        name: 'Elon Musk - Tech Vision',
        viralScore: 88,
        sentiment: 'bullish',
        socialMentions: 98000,
        priceImpact: 8.3,
        timestamp: Date.now() - 7200000,
        vtsSymbol: {
          fullSymbol: 'V:ZA:TECH:ELONMUSK',
          country: 'ZA',
          sector: 'TECH',
          ticker: 'ELONMUSK',
          displayName: 'Elon Musk',
        },
        vpmx: {
          score: 88,
          rank: 3,
          change24h: -5,
          momentum: 'stable',
          peakScore: 92,
          peakTime: Date.now() - 14400000,
          averageScore: 85,
          prediction: {
            next24h: 86,
            confidence: 0.72,
            trend: 'sideways',
          },
        },
        relatedTopics: ['tech', 'innovation', 'spacex', 'tesla'],
        influencers: ['@elonmusk', '@techcrunch', '@verge'],
        platforms: [
          { platform: 'Twitter', mentions: 78000, sentiment: 'positive', growthRate: 12 },
          { platform: 'Reddit', mentions: 15000, sentiment: 'neutral', growthRate: 8 },
          { platform: 'YouTube', mentions: 5000, sentiment: 'positive', growthRate: 15 },
        ],
        categories: ['Technology', 'Business', 'Innovation'],
      },
    ];

    // In production: useTradingStore.getState().setViralTrendMarkets(mockMarkets);
  }, []);

  // Use viralTrendMarkets if available, otherwise fall back to viralTrends
  const trends = viralTrendMarkets.length > 0 ? viralTrendMarkets : viralTrends;

  const filteredTrends = trends.length > 0
    ? trends.filter(trend => {
        if (filter === 'all') return true;
        if (filter === 'accelerating') {
          return 'vpmx' in trend && trend.vpmx.momentum === 'accelerating';
        }
        return trend.sentiment === filter;
      })
    : [];

  const handleTradeTrend = (symbol: string) => {
    setCurrentSymbol(symbol);
    // Navigate to trading view
    navigate('/trade');
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'text-success-500 bg-success-500/20 border-success-500/30';
      case 'bearish':
        return 'text-danger-500 bg-danger-500/20 border-danger-500/30';
      default:
        return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getViralScoreColor = (score: number) => {
    if (score >= 90) return 'text-gold-600';
    if (score >= 70) return 'text-primary-700';
    return 'text-gray-400';
  };

  const getMomentumColor = (momentum: string) => {
    switch (momentum) {
      case 'accelerating':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-glow-green';
      case 'stable':
        return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-glow-blue';
      case 'decelerating':
        return 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-glow-orange';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getVPMXGradient = (score: number) => {
    if (score >= 90) return 'bg-gradient-to-br from-gold-600/20 to-gold-400/10 border-gold-500/30';
    if (score >= 70) return 'bg-gradient-to-br from-purple-600/20 to-purple-400/10 border-purple-500/30';
    return 'bg-gradient-to-br from-gray-600/20 to-gray-400/10 border-gray-500/30';
  };

  const getVPMXRingColor = (score: number) => {
    if (score >= 90) return 'shadow-glow-gold';
    if (score >= 70) return 'shadow-glow';
    return '';
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <GlassCard title="Viral Trends" className="h-full">
      <div className="space-y-4">
        {/* Enhanced Filter Buttons with Gradient Effects */}
        <div className="grid grid-cols-2 gap-2">
          {(['all', 'bullish', 'bearish', 'accelerating'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                relative py-2 px-3 rounded-lg text-xs font-bold transition-all uppercase tracking-wider overflow-hidden
                ${filter === f
                  ? 'bg-gradient-viral text-white shadow-glow border border-primary-600/50 scale-105'
                  : 'bg-dark-800/30 text-gray-400 hover:bg-primary-700/10 border border-primary-700/20 hover:border-primary-700/40'
                }
              `}
            >
              {filter === f && (
                <motion.div
                  layoutId="activeFilter"
                  className="absolute inset-0 bg-gradient-viral opacity-20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                {f === 'accelerating' ? (
                  <Zap className="w-3 h-3" />
                ) : f === 'bullish' ? (
                  <TrendingUp className="w-3 h-3" />
                ) : f === 'bearish' ? (
                  <TrendingDown className="w-3 h-3" />
                ) : (
                  <Flame className="w-3 h-3" />
                )}
                {f}
              </span>
            </button>
          ))}
        </div>

        {/* Enhanced Trends List with VPMX */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {filteredTrends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Flame className="w-12 h-12 text-gray-600 mb-3" />
              </motion.div>
              <p className="text-gray-400 text-sm">No viral trends detected</p>
              <p className="text-gray-500 text-xs mt-1">Trending content will appear here</p>
            </div>
          ) : (
            filteredTrends.map((trend, index) => {
              const isViralTrendMarket = 'vpmx' in trend;
              const vpmxData = isViralTrendMarket ? trend.vpmx : null;

              return (
                <motion.div
                  key={trend.id}
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: index * 0.08,
                    type: "spring",
                    stiffness: 100,
                    damping: 15
                  }}
                  onMouseEnter={() => setHoveredTrend(trend.id)}
                  onMouseLeave={() => setHoveredTrend(null)}
                  className={`
                    relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer group
                    ${hoveredTrend === trend.id
                      ? 'border-gold-500/50 shadow-glow-gold scale-[1.02]'
                      : 'border-primary-700/30 hover:border-gold-500/30'
                    }
                    ${isViralTrendMarket && vpmxData && vpmxData.score >= 90
                      ? 'bg-gradient-to-br from-gold-900/20 via-gold-800/10 to-transparent'
                      : 'bg-gradient-to-br from-primary-900/20 via-primary-800/10 to-transparent'
                    }
                  `}
                  onClick={() => handleTradeTrend(trend.symbol)}
                >
                  {/* Animated Background Glow */}
                  {isViralTrendMarket && vpmxData && vpmxData.score >= 90 && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                      animate={{
                        backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                  )}

                  {/* Main Content */}
                  <div className="relative p-4 space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Symbol and VTS Badge */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {isViralTrendMarket && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-purple-700 text-white text-[10px] font-bold border border-purple-400/30">
                              <Star className="w-3 h-3 fill-current" />
                              VTS
                            </div>
                          )}
                          <h4 className="text-sm font-bold text-white truncate">{trend.symbol}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getSentimentColor(trend.sentiment)}`}
                          >
                            {trend.sentiment}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 font-medium line-clamp-2">{trend.name}</p>
                      </div>

                      {/* VPMX Score Circle */}
                      {isViralTrendMarket && vpmxData ? (
                        <div className={`
                          relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2
                          ${getVPMXGradient(vpmxData.score)}
                          ${getVPMXRingColor(vpmxData.score)}
                        `}>
                          <motion.div
                            className="text-xl font-black bg-gradient-viral bg-clip-text text-transparent"
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            {vpmxData.score}
                          </motion.div>
                          <div className="flex items-center gap-0.5 text-[8px] text-gray-400 font-semibold uppercase tracking-wider">
                            <Flame className="w-2.5 h-2.5" />
                            VPMX
                          </div>
                          {/* Rank Badge */}
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-gold-500 to-gold-600 rounded-full flex items-center justify-center border-2 border-dark-900">
                            <span className="text-[8px] font-black text-gold-900">{vpmxData.rank}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <div className={`text-2xl font-black ${getViralScoreColor(trend.viralScore)}`}>
                            {trend.viralScore}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
                            <Flame className="w-3 h-3" />
                            Score
                          </div>
                        </div>
                      )}
                    </div>

                    {/* VPMX Momentum Bar */}
                    {isViralTrendMarket && vpmxData && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 font-semibold uppercase tracking-wider">Momentum</span>
                          <span className={`font-bold uppercase ${vpmxData.change24h >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                            {vpmxData.change24h >= 0 ? '+' : ''}{vpmxData.change24h} 24h
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <div className={`
                            flex-1 h-2 rounded-full overflow-hidden relative
                            ${getMomentumColor(vpmxData.momentum)}
                          `}>
                            <motion.div
                              className="absolute inset-0 bg-white/30"
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 1, delay: index * 0.1 }}
                            />
                          </div>
                          <div className={`
                            px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider whitespace-nowrap
                            ${getMomentumColor(vpmxData.momentum)}
                          `}>
                            {vpmxData.momentum}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="flex flex-col items-center p-2 rounded-lg bg-dark-900/40 border border-primary-700/20">
                        <MessageSquare className="w-3.5 h-3.5 text-primary-700 mb-1" />
                        <span className="font-bold text-white">{(trend.socialMentions / 1000).toFixed(0)}K</span>
                        <span className="text-gray-500 font-medium">Mentions</span>
                      </div>
                      <div className={`flex flex-col items-center p-2 rounded-lg bg-dark-900/40 border ${trend.priceImpact >= 0 ? 'border-success-500/20' : 'border-danger-500/20'}`}>
                        {trend.priceImpact >= 0 ? (
                          <TrendingUp className="w-3.5 h-3.5 text-success-500 mb-1" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-danger-500 mb-1" />
                        )}
                        <span className={`font-bold ${trend.priceImpact >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                          {trend.priceImpact >= 0 ? '+' : ''}{trend.priceImpact}%
                        </span>
                        <span className="text-gray-500 font-medium">Impact</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-dark-900/40 border border-primary-700/20">
                        <Clock className="w-3.5 h-3.5 text-primary-700 mb-1" />
                        <span className="font-bold text-white">{formatTimeAgo(trend.timestamp)}</span>
                        <span className="text-gray-500 font-medium">Updated</span>
                      </div>
                    </div>

                    {/* Platform Data (if available) */}
                    {isViralTrendMarket && trend.platforms && trend.platforms.length > 0 && (
                      <div className="pt-2 border-t border-primary-700/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="w-3 h-3 text-gray-500" />
                          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Platforms</span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {trend.platforms.slice(0, 3).map((platform, idx) => (
                            <div
                              key={idx}
                              className="px-2 py-1 rounded-lg bg-dark-900/60 border border-primary-700/30 flex items-center gap-1.5"
                            >
                              <div className={`w-1.5 h-1.5 rounded-full ${
                                platform.growthRate > 20 ? 'bg-success-500 animate-pulse' :
                                platform.growthRate > 10 ? 'bg-gold-500' : 'bg-gray-500'
                              }`} />
                              <span className="text-[9px] text-gray-300 font-medium">{platform.platform}</span>
                              <span className="text-[9px] text-gray-500">({platform.growthRate}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Prediction Indicator */}
                    {isViralTrendMarket && vpmxData && vpmxData.prediction && (
                      <div className={`
                        flex items-center justify-between px-3 py-2 rounded-lg border
                        ${vpmxData.prediction.trend === 'up'
                          ? 'bg-success-500/10 border-success-500/30'
                          : vpmxData.prediction.trend === 'down'
                          ? 'bg-danger-500/10 border-danger-500/30'
                          : 'bg-gray-500/10 border-gray-500/30'
                        }
                      `}>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-[10px] text-gray-300 font-semibold uppercase tracking-wider">
                            24h Prediction
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-white">
                            {vpmxData.prediction.next24h}
                          </span>
                          {vpmxData.prediction.trend === 'up' ? (
                            <TrendingUp className="w-4 h-4 text-success-500" />
                          ) : vpmxData.prediction.trend === 'down' ? (
                            <TrendingDown className="w-4 h-4 text-danger-500" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gray-500" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trade Button */}
                    <motion.button
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary-700 to-purple-700 text-white text-xs font-bold uppercase tracking-wider border border-primary-600/50 shadow-lg group-hover:shadow-glow transition-all flex items-center justify-center gap-2"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <span>Trade {isViralTrendMarket ? trend.vtsSymbol.ticker : trend.symbol.split('/')[0]}</span>
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* View All Trends Link */}
        <button
          onClick={() => navigate('/topics')}
          className="w-full py-2.5 rounded-lg border border-primary-700/30 text-gray-400 hover:text-white hover:bg-primary-700/20 transition-all text-sm font-medium"
        >
          View All Viral Trends
        </button>
      </div>
    </GlassCard>
  );
};

export default ViralTrendsPanel;
