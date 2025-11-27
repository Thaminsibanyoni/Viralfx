import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { ViralAsset, ViralCategory } from '../../types/trends';
import { RiseOutlined, FallOutlined, Users, MapPin, Eye, Heart, MessageCircle, Share2, Clock, Zap, Shield, AlertTriangle, Activity, DollarSign, BarChart3, PieChartIcon, Target } from 'lucide-react';

interface AssetAnalyticsProps {
  asset: ViralAsset;
  timeRange: '1h' | '24h' | '7d' | '30d';
}

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, icon, color, trend = 'neutral' }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative bg-white rounded-xl border border-gray-200 p-6 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer ${
        isHovered ? 'border-' + color + '-300' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg bg-${color}-50`}>
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center text-sm font-medium ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'
          }`}>
            {trend === 'up' ? <RiseOutlined className="w-4 h-4 mr-1" /> : trend === 'down' ? <FallOutlined className="w-4 h-4 mr-1" /> : null}
            {change > 0 ? '+' : ''}{change}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{title}</div>
      </div>
      {isHovered && (
        <div className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r from-${color}-400 to-${color}-600 rounded-b-xl transition-all duration-300`}
             style={{ width: '100%' }} />
      )}
    </div>
  );
};

export const AssetAnalyticsDashboard: React.FC<AssetAnalyticsProps> = ({ asset, timeRange }) => {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('performance');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const categoryColors = {
    CelebEx: '#F59E0B',    // Gold
    BrandPulse: '#6366F1', // Indigo
    EduWave: '#10B981',    // Emerald
    Politix: '#B91C1C',    // Burgundy
    Entertain360: '#F97316', // Coral
    TrendBase: '#9CA3AF'   // Silver
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [asset.id, timeRange]);

  const _loadAnalyticsData = async () => {
    setLoading(true);
    try {
      // API call to get analytics data
      const mockData = {
        performance: {
          priceHistory: generateMockPriceData(timeRange),
          volumeHistory: generateMockVolumeData(timeRange),
          momentumHistory: generateMockMomentumData(timeRange),
          sentimentHistory: generateMockSentimentData(timeRange)
        },
        engagement: {
          demographics: {
            ageGroups: [
              { name: '18-24', value: 25, color: '#6366F1' },
              { name: '25-34', value: 45, color: '#8B5CF6' },
              { name: '35-44', value: 20, color: '#A78BFA' },
              { name: '45-54', value: 7, color: '#C4B5FD' },
              { name: '55+', value: 3, color: '#DDD6FE' }
            ],
            locations: [
              { name: 'Gauteng', value: 35, color: '#10B981' },
              { name: 'Western Cape', value: 25, color: '#34D399' },
              { name: 'KwaZulu-Natal', value: 20, color: '#6EE7B7' },
              { name: 'Eastern Cape', value: 10, color: '#A7F3D0' },
              { name: 'Other', value: 10, color: '#D1FAE5' }
            ],
            platforms: [
              { name: 'Twitter/X', value: 30, color: '#1DA1F2' },
              { name: 'TikTok', value: 40, color: '#000000' },
              { name: 'Instagram', value: 20, color: '#E4405F' },
              { name: 'YouTube', value: 7, color: '#FF0000' },
              { name: 'Facebook', value: 3, color: '#1877F2' }
            ]
          },
          metrics: {
            totalEngagement: 2450000,
            engagementRate: 4.8,
            averageSessionDuration: 245,
            shareRate: 2.3,
            commentRate: 1.1,
            likeRate: 8.9
          }
        },
        market: {
          tradingVolume: 1250000,
          marketCap: 8500000,
          priceChange: 12.5,
          volumeChange: 28.3,
          volatility: 18.2,
          liquidityScore: 7.8,
          marketDepth: 625000
        },
        predictions: {
          shortTerm: {
            direction: 'bullish',
            confidence: 0.78,
            targetPrice: asset.current_price * 1.15,
            timeHorizon: '24 hours'
          },
          longTerm: {
            direction: 'bullish',
            confidence: 0.65,
            targetPrice: asset.current_price * 1.35,
            timeHorizon: '7 days'
          },
            riskFactors: [
              { factor: 'Market volatility', probability: 0.3 },
              { factor: 'Sentiment shift', probability: 0.2 },
              { factor: 'Content fatigue', probability: 0.15 },
              { factor: 'Platform algorithm change', probability: 0.1 }
            ]
        }
      };

      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const _generateMockPriceData = (range: string) => {
    const points = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    const basePrice = asset.current_price;
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      price: basePrice * (1 + (Math.random() - 0.5) * 0.1),
      timestamp: new Date(Date.now() - (points - i) * (range === '1h' ? 300000 : range === '24h' ? 3600000 : 86400000))
    }));
  };

  const _generateMockVolumeData = (range: string) => {
    const points = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      volume: Math.floor(Math.random() * 100000) + 20000,
      timestamp: new Date(Date.now() - (points - i) * (range === '1h' ? 300000 : range === '24h' ? 3600000 : 86400000))
    }));
  };

  const _generateMockMomentumData = (range: string) => {
    const points = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      momentum: asset.momentum_score * (1 + (Math.random() - 0.5) * 0.2),
      timestamp: new Date(Date.now() - (points - i) * (range === '1h' ? 300000 : range === '24h' ? 3600000 : 86400000))
    }));
  };

  const _generateMockSentimentData = (range: string) => {
    const points = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
    return Array.from({ length: points }, (_, i) => ({
      time: i,
      sentiment: asset.sentiment_index * (1 + (Math.random() - 0.5) * 0.3),
      timestamp: new Date(Date.now() - (points - i) * (range === '1h' ? 300000 : range === '24h' ? 3600000 : 86400000))
    }));
  };

  const performanceMetrics = useMemo(() => [
    {
      title: 'Total Engagement',
      value: analyticsData ? (analyticsData.engagement.metrics.totalEngagement / 1000000).toFixed(1) + 'M' : '0',
      icon: <Eye className="w-6 h-6 text-purple-600" />,
      color: 'purple',
      change: analyticsData ? 12.5 : 0,
      trend: 'up' as const
    },
    {
      title: 'Engagement Rate',
      value: analyticsData ? analyticsData.engagement.metrics.engagementRate + '%' : '0%',
      icon: <Heart className="w-6 h-6 text-pink-600" />,
      color: 'pink',
      change: analyticsData ? 2.3 : 0,
      trend: 'up' as const
    },
    {
      title: 'Market Cap',
      value: analyticsData ? 'R' + (analyticsData.market.marketCap / 1000000).toFixed(1) + 'M' : 'R0',
      icon: <DollarSign className="w-6 h-6 text-green-600" />,
      color: 'green',
      change: analyticsData ? analyticsData.market.priceChange : 0,
      trend: (analyticsData?.market.priceChange > 0 ? 'up' : 'down') as const
    },
    {
      title: 'Volatility',
      value: analyticsData ? analyticsData.market.volatility.toFixed(1) + '%' : '0%',
      icon: <Activity className="w-6 h-6 text-orange-600" />,
      color: 'orange',
      change: analyticsData ? -3.2 : 0,
      trend: 'down' as const
    }
  ], [analyticsData]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="space-y-8">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-xl mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="h-80 bg-gray-200 rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12">
        <div className="text-center text-gray-500">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-6 flex items-center justify-center">
            <BarChart3 className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Analytics Data Unavailable</h3>
          <p className="text-gray-500">Unable to load analytics data at this time. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Enhanced Header */}
      <div className="relative bg-gradient-to-br from-viralfx-purple via-purple-600 to-indigo-700 text-white p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="flex items-center mb-3">
                <div className="w-4 h-4 rounded-full bg-white mr-3 animate-pulse"></div>
                <h2 className="text-3xl font-bold">{asset.name}</h2>
              </div>
              <p className="text-purple-100 text-lg mb-4">Advanced Analytics & Performance Insights</p>
              <div className="flex items-center space-x-6">
                <div className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  <span className="text-sm">{asset.category}</span>
                </div>
                <div className="flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  <span className="text-sm">Momentum: {asset.momentum_score.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="text-center lg:text-right">
              <div className="text-4xl font-bold mb-2">R{asset.current_price.toFixed(2)}</div>
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                analyticsData.market.priceChange > 0
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {analyticsData.market.priceChange > 0 ? <RiseOutlined className="w-4 h-4 mr-1" /> : <FallOutlined className="w-4 h-4 mr-1" />}
                {analyticsData.market.priceChange > 0 ? '+' : ''}{analyticsData.market.priceChange.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics Overview */}
      <div className="p-8 bg-gray-50 border-b">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {performanceMetrics.map((metric, index) => (
            <MetricCard key={index} {...metric} />
          ))}
        </div>
      </div>

      {/* Enhanced Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <nav className="flex space-x-1 px-8" aria-label="Tabs">
          {[
            { key: 'performance', label: 'Performance', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'engagement', label: 'Engagement', icon: <Users className="w-4 h-4" /> },
            { key: 'market', label: 'Market', icon: <DollarSign className="w-4 h-4" /> },
            { key: 'predictions', label: 'AI Predictions', icon: <Target className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center space-x-2 py-4 px-4 border-b-2 font-medium text-sm transition-all duration-200 ${
                activeTab === tab.key
                  ? 'border-viralfx-purple text-viralfx-purple bg-purple-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Enhanced Content */}
      <div className="p-8 bg-gray-50">
        {activeTab === 'performance' && (
          <div className="space-y-8">
            {/* Enhanced Price Chart */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">Price Performance</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                    Positive
                  </div>
                  <div className="flex items-center text-sm text-gray-500">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                    Negative
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={analyticsData.performance.priceHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={categoryColors[asset.category]} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={categoryColors[asset.category]} stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: any) => [`R${value.toFixed(2)}`, 'Price']}
                    labelFormatter={(label) => `Time Period: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={categoryColors[asset.category]}
                    strokeWidth={3}
                    fill="url(#priceGradient)"
                    fillOpacity={0.3}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke={categoryColors[asset.category]}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 8 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Enhanced Volume & Momentum */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <BarChart3 className="w-6 h-6 text-purple-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">Trading Volume</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.performance.volumeHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: any) => [`R${(value / 1000).toFixed(1)}K`, 'Volume']}
                    />
                    <Bar
                      dataKey="volume"
                      fill={categoryColors[asset.category]}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <Zap className="w-6 h-6 text-yellow-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">Momentum Score</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analyticsData.performance.momentumHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <radialGradient id="momentumGradient" cx="0" cy="0" r="1">
                        <stop offset="5%" stopColor={categoryColors[asset.category]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={categoryColors[asset.category]} stopOpacity={0.1}/>
                      </radialGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" stroke="#6b7280" />
                    <YAxis domain={[0, 100]} stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: any) => [`${value.toFixed(1)}`, 'Momentum Score']}
                    />
                    <Area
                      type="monotone"
                      dataKey="momentum"
                      stroke={categoryColors[asset.category]}
                      strokeWidth={3}
                      fill="url(#momentumGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'engagement' && (
          <div className="space-y-8">
            {/* Enhanced Engagement Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-purple-500">
                <div className="flex items-center mb-4">
                  <Eye className="w-8 h-8 text-purple-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-500">Total Engagement</div>
                    <div className="text-2xl font-bold">{(analyticsData.engagement.metrics.totalEngagement / 1000000).toFixed(1)}M</div>
                  </div>
                </div>
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-pink-500">
                <div className="flex items-center mb-4">
                  <Heart className="w-8 h-8 text-pink-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-500">Engagement Rate</div>
                    <div className="text-2xl font-bold">{analyticsData.engagement.metrics.engagementRate}%</div>
                  </div>
                </div>
                <div className="w-full bg-pink-200 rounded-full h-2">
                  <div className="bg-pink-600 h-2 rounded-full" style={{ width: `${Math.min(analyticsData.engagement.metrics.engagementRate * 10, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-blue-500">
                <div className="flex items-center mb-4">
                  <Clock className="w-8 h-8 text-blue-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-500">Avg Session</div>
                    <div className="text-2xl font-bold">{Math.floor(analyticsData.engagement.metrics.averageSessionDuration / 60)}m</div>
                  </div>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(analyticsData.engagement.metrics.averageSessionDuration / 3, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg border-l-4 border-green-500">
                <div className="flex items-center mb-4">
                  <Share2 className="w-8 h-8 text-green-600 mr-3" />
                  <div>
                    <div className="text-sm text-gray-500">Share Rate</div>
                    <div className="text-2xl font-bold">{analyticsData.engagement.metrics.shareRate}%</div>
                  </div>
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${Math.min(analyticsData.engagement.metrics.shareRate * 20, 100)}%` }}></div>
                </div>
              </div>
            </div>

            {/* Enhanced Demographics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <Users className="w-6 h-6 text-indigo-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">Age Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={analyticsData.engagement.demographics.ageGroups}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {analyticsData.engagement.demographics.ageGroups.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: any) => [`${value}%`, 'Percentage']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analyticsData.engagement.demographics.ageGroups.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-700">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <MapPin className="w-6 h-6 text-green-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">Geographic Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analyticsData.engagement.demographics.locations} layout="horizontal" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" stroke="#6b7280" />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: any) => [`${value}%`, 'Audience Share']}
                    />
                    <Bar
                      dataKey="value"
                      fill={categoryColors[asset.category]}
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-6">
                  <MessageCircle className="w-6 h-6 text-blue-600 mr-3" />
                  <h3 className="text-xl font-bold text-gray-900">Platform Distribution</h3>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={analyticsData.engagement.demographics.platforms}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {analyticsData.engagement.demographics.platforms.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: any) => [`${value}%`, 'Platform Share']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {analyticsData.engagement.demographics.platforms.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: item.color }}></div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-700">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="space-y-8">
            {/* Enhanced Market Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    analyticsData.market.priceChange > 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {analyticsData.market.priceChange > 0 ? '+' : ''}{analyticsData.market.priceChange.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">R{(analyticsData.market.marketCap / 1000000).toFixed(1)}M</div>
                  <div className="text-sm text-gray-500">Market Capitalization</div>
                </div>
                <div className="mt-4 flex items-center text-green-600">
                  <Activity className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">High Volume</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <BarChart3 className="w-8 h-8 text-blue-600" />
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {analyticsData.market.volumeChange > 0 ? '+' : ''}{analyticsData.market.volumeChange.toFixed(1)}%
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">R{(analyticsData.market.tradingVolume / 1000000).toFixed(1)}M</div>
                  <div className="text-sm text-gray-500">24h Trading Volume</div>
                </div>
                <div className="mt-4 flex items-center text-blue-600">
                  <RiseOutlined className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Rising</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <Activity className="w-8 h-8 text-orange-600" />
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {analyticsData.market.volatility > 20 ? 'High' : analyticsData.market.volatility > 10 ? 'Medium' : 'Low'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">{analyticsData.market.volatility.toFixed(1)}%</div>
                  <div className="text-sm text-gray-500">Volatility Index</div>
                </div>
                <div className="mt-4 flex items-center text-orange-600">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Moderate Risk</span>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <Shield className="w-8 h-8 text-purple-600" />
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Score {analyticsData.market.liquidityScore}/10
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">{analyticsData.market.liquidityScore}/10</div>
                  <div className="text-sm text-gray-500">Liquidity Score</div>
                </div>
                <div className="mt-4 flex items-center text-purple-600">
                  <Zap className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Stable</span>
                </div>
              </div>
            </div>

            {/* Enhanced Market Depth */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <BarChart3 className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">Market Depth Analysis</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-semibold text-gray-900">Total Market Depth</div>
                        <div className="text-sm text-gray-500">Available liquidity</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">R{(analyticsData.market.marketDepth / 1000).toFixed(0)}K</div>
                        <div className="text-sm text-gray-500">Current</div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-4 rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-1000 ease-out"
                        style={{ width: `${Math.min(analyticsData.market.liquidityScore * 10, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-xs text-gray-500">0%</span>
                      <span className="text-xs text-gray-500">Liquidity: {analyticsData.market.liquidityScore * 10}%</span>
                      <span className="text-xs text-gray-500">100%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-sm text-green-600 mb-1">Buy Orders</div>
                      <div className="text-xl font-bold text-green-800">R{((analyticsData.market.marketDepth * 0.6) / 1000).toFixed(0)}K</div>
                      <div className="text-xs text-green-600">60% of depth</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="text-sm text-red-600 mb-1">Sell Orders</div>
                      <div className="text-xl font-bold text-red-800">R{((analyticsData.market.marketDepth * 0.4) / 1000).toFixed(0)}K</div>
                      <div className="text-xs text-red-600">40% of depth</div>
                    </div>
                  </div>
                </div>

                <div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={[
                      { range: '0-10', buy: 120, sell: 80 },
                      { range: '10-20', buy: 200, sell: 150 },
                      { range: '20-30', buy: 180, sell: 120 },
                      { range: '30-40', buy: 150, sell: 180 },
                      { range: '40-50', buy: 100, sell: 140 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="range" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        formatter={(value: any, name: string) => [`R${value}K`, name === 'buy' ? 'Buy Orders' : 'Sell Orders']}
                      />
                      <Legend />
                      <Bar dataKey="buy" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="sell" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="space-y-8">
            {/* Enhanced AI Predictions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-green-50 via-green-50 to-emerald-50 rounded-xl p-6 shadow-lg border border-green-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-green-500 rounded-lg mr-4">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-green-800">Short-Term Prediction</h3>
                    <p className="text-green-600 text-sm">Next 24 hours</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Direction</span>
                      <span className={`font-bold text-lg capitalize flex items-center ${
                        analyticsData.predictions.shortTerm.direction === 'bullish' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {analyticsData.predictions.shortTerm.direction === 'bullish' ? <RiseOutlined className="w-5 h-5 mr-2" /> : <FallOutlined className="w-5 h-5 mr-2" />}
                        {analyticsData.predictions.shortTerm.direction}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-100 rounded-lg">
                      <span className="text-green-700 font-medium">Confidence</span>
                      <span className="font-bold text-green-900">{(analyticsData.predictions.shortTerm.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg">
                      <span className="text-blue-700 font-medium">Target Price</span>
                      <span className="font-bold text-blue-900">R{analyticsData.predictions.shortTerm.targetPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 via-blue-50 to-indigo-50 rounded-xl p-6 shadow-lg border border-blue-200 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center mb-6">
                  <div className="p-3 bg-blue-500 rounded-lg mr-4">
                    <Activity className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-blue-800">Long-Term Prediction</h3>
                    <p className="text-blue-600 text-sm">Next 7 days</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Direction</span>
                      <span className={`font-bold text-lg capitalize flex items-center ${
                        analyticsData.predictions.longTerm.direction === 'bullish' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {analyticsData.predictions.longTerm.direction === 'bullish' ? <RiseOutlined className="w-5 h-5 mr-2" /> : <FallOutlined className="w-5 h-5 mr-2" />}
                        {analyticsData.predictions.longTerm.direction}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg">
                      <span className="text-blue-700 font-medium">Confidence</span>
                      <span className="font-bold text-blue-900">{(analyticsData.predictions.longTerm.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-100 rounded-lg">
                      <span className="text-purple-700 font-medium">Target Price</span>
                      <span className="font-bold text-purple-900">R{analyticsData.predictions.longTerm.targetPrice.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Risk Factors */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center mb-6">
                <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                <h3 className="text-xl font-bold text-gray-900">Risk Analysis</h3>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {analyticsData.predictions.riskFactors.map((risk, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded-full ${
                            risk.probability > 0.25 ? 'bg-red-500' :
                            risk.probability > 0.15 ? 'bg-yellow-500' : 'bg-green-500'
                          } animate-pulse`}></div>
                          <div>
                            <span className="font-medium text-gray-900">{risk.factor}</span>
                            <div className="text-sm text-gray-500">Risk Level: {
                              risk.probability > 0.25 ? 'High' :
                              risk.probability > 0.15 ? 'Medium' : 'Low'
                            }</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg">{(risk.probability * 100).toFixed(0)}%</div>
                          <div className="text-sm text-gray-500">Probability</div>
                        </div>
                      </div>
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-1000 ${
                            risk.probability > 0.25 ? 'bg-red-500' :
                            risk.probability > 0.15 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${risk.probability * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={analyticsData.predictions.riskFactors.map(risk => ({
                      factor: risk.factor.split(' ')[0],
                      probability: risk.probability * 100,
                      fullMark: 100
                    }))}>
                      <PolarGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="factor" stroke="#6b7280" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#6b7280" />
                      <Radar
                        name="Risk Probability"
                        dataKey="probability"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        formatter={(value: any) => [`${value.toFixed(0)}%`, 'Risk Probability']}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetAnalyticsDashboard;