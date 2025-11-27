import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ViralAsset, ViralCategory } from '../../types/trends';
import TrendCard from '../../components/trends/TrendCard';
import { getPlatformIcon } from '../../utils/platformUtils';

const MobileTrendsPage: React.FC = () => {
  const navigate = useNavigate();
  const [trends, setTrends] = useState<ViralAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'trending' | 'watchlist'>('all');
  const [selectedCategory, setSelectedCategory] = useState<ViralCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const categories: { value: ViralCategory | 'all'; label: string; color: string }[] = [
    { value: 'all', label: 'All', color: 'bg-gray-500' },
    { value: 'CelebEx', label: 'Celebrity', color: 'bg-amber-500' },
    { value: 'BrandPulse', label: 'Brand', color: 'bg-indigo-500' },
    { value: 'EduWave', label: 'Education', color: 'bg-emerald-500' },
    { value: 'Politix', label: 'Politics', color: 'bg-rose-700' },
    { value: 'Entertain360', label: 'Entertainment', color: 'bg-orange-500' },
    { value: 'TrendBase', label: 'Emerging', color: 'bg-gray-400' }
  ];

  useEffect(() => {
    loadTrends();
  }, [activeFilter, selectedCategory, searchQuery]);

  const loadTrends = async () => {
    setLoading(true);
    try {
      // API call to get trends
      const mockTrends = generateMockTrends();

      // Apply filters
      let filteredTrends = mockTrends;

      if (selectedCategory !== 'all') {
        filteredTrends = filteredTrends.filter(trend => trend.category === selectedCategory);
      }

      if (activeFilter === 'trending') {
        filteredTrends = filteredTrends.filter(trend => trend.is_trending);
      }

      if (searchQuery) {
        filteredTrends = filteredTrends.filter(trend =>
          trend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trend.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          trend.keywords?.some(keyword => keyword.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      // Sort by momentum for mobile
      filteredTrends.sort((a, b) => b.momentum_score - a.momentum_score);

      setTrends(filteredTrends);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTrends();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePullToRefresh = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const element = e.currentTarget;
    const {scrollTop, scrollHeight, clientHeight} = element;

    if (scrollTop === 0 && touch.clientY > 100) {
      handleRefresh();
    }
  };

  const _generateMockTrends = (): ViralAsset[] => {
    return [
      {
        id: '1',
        symbol: 'CELEB/SA_MUSIC_ALBUM',
        name: 'SA Artist drops surprise album',
        description: 'Major South African musician releases surprise album with collaborations',
        category: 'CelebEx',
        origin_platform: 'twitter',
        current_platforms: ['twitter', 'instagram', 'tiktok'],
        momentum_score: 95,
        sentiment_index: 0.85,
        virality_rate: 45000,
        engagement_velocity: 12.5,
        reach_estimate: 2500000,
        current_price: 285.50,
        volume_24h: 1250000,
        market_cap: 8500000,
        content_safety: 'SAFE',
        content_risk_score: 0.1,
        moderation_status: 'APPROVED',
        first_seen: new Date(),
        expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
        keywords: ['music', 'album', 'surprise', 'collaboration'],
        is_trending: true,
        trending_rank: 1,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: '2',
        symbol: 'EDU/ZA_CODING_BOOTCAMP',
        name: 'Free coding bootcamp for youth',
        description: 'Major tech company launches free coding bootcamp for South African youth',
        category: 'EduWave',
        origin_platform: 'linkedin',
        current_platforms: ['linkedin', 'twitter', 'facebook'],
        momentum_score: 88,
        sentiment_index: 0.92,
        virality_rate: 32000,
        engagement_velocity: 8.7,
        reach_estimate: 1800000,
        current_price: 198.75,
        volume_24h: 980000,
        market_cap: 6200000,
        content_safety: 'SAFE',
        content_risk_score: 0.05,
        moderation_status: 'APPROVED',
        first_seen: new Date(),
        expiry_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
        keywords: ['coding', 'education', 'bootcamp', 'youth', 'tech'],
        is_trending: true,
        trending_rank: 2,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Trends</h1>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/search')}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-1 mb-3">
            {[
              { key: 'all', label: 'All' },
              { key: 'trending', label: '🔥 Trending' },
              { key: 'watchlist', label: '⭐ Watchlist' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key as any)}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-viralfx-purple text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex space-x-2 pb-2">
              {categories.map(category => (
                <button
                  key={category.value}
                  onClick={() => setSelectedCategory(category.value)}
                  className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === category.value
                      ? 'bg-viralfx-purple text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.value !== 'all' && (
                    <span className={`w-2 h-2 rounded-full ${category.color}`}></span>
                  )}
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="border-t bg-gray-50 px-4 py-3">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search Trends</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search trends..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-viralfx-purple focus:border-viralfx-purple text-sm"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Show only FSCA verified</span>
                <button
                  className="relative inline-flex h-6 w-11 items-center rounded-full bg-viralfx-purple transition-colors"
                >
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6"></span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto"
        onTouchMove={handlePullToRefresh}
      >
        {/* Refresh Indicator */}
        {refreshing && (
          <div className="sticky top-0 z-30 bg-white border-b px-4 py-2 flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-viralfx-purple border-t-transparent"></div>
            <span className="ml-2 text-sm text-gray-600">Refreshing...</span>
          </div>
        )}

        {/* Loading State */}
        {loading && !refreshing && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-viralfx-purple border-t-transparent"></div>
          </div>
        )}

        {/* Trends List */}
        {!loading && (
          <div className="px-4 py-4 space-y-4">
            {trends.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">📈</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">No trends found</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {searchQuery ? 'Try adjusting your search terms' : 'Check back later for new viral trends'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-viralfx-purple font-medium text-sm"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Featured Trend */}
                {trends[0] && trends[0].is_trending && (
                  <div className="bg-gradient-to-br from-viralfx-purple to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center justify-between mb-2">
                      <span className="bg-white bg-opacity-20 px-2 py-1 rounded-full text-xs font-medium">
                        🔥 #1 Trending
                      </span>
                      <span className="text-xs opacity-75">
                        {getPlatformIcon(trends[0].origin_platform)} {trends[0].origin_platform}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold mb-1">{trends[0].name}</h2>
                    <p className="text-sm opacity-90 mb-3 line-clamp-2">{trends[0].description}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">R{trends[0].current_price.toFixed(2)}</div>
                        <div className="text-xs opacity-75">
                          Momentum: {trends[0].momentum_score.toFixed(0)}/100
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/asset/${trends[0].id}`)}
                        className="bg-white text-viralfx-purple px-4 py-2 rounded-lg font-medium text-sm hover:bg-opacity-90"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                )}

                {/* Regular Trend Cards */}
                <div className="space-y-3">
                  {trends.map((trend, index) => (
                    <div key={trend.id} onClick={() => navigate(`/asset/${trend.id}`)}>
                      <TrendCard trend={trend} compact={true} />
                    </div>
                  ))}
                </div>

                {/* Load More */}
                <div className="text-center py-4">
                  <button className="bg-viralfx-purple text-white px-6 py-2 rounded-lg font-medium text-sm hover:bg-purple-700">
                    Load More Trends
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t sticky bottom-0 z-40">
        <div className="grid grid-cols-5 gap-1">
          {[
            { key: 'trends', icon: '📈', label: 'Trends', active: true },
            { key: 'portfolio', icon: '💼', label: 'Portfolio', active: false },
            { key: 'trade', icon: '⚡', label: 'Trade', active: false },
            { key: 'brokers', icon: '🤝', label: 'Brokers', active: false },
            { key: 'profile', icon: '👤', label: 'Profile', active: false }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => navigate(`/${item.key}`)}
              className={`flex flex-col items-center py-2 px-1 text-xs transition-colors ${
                item.active
                  ? 'text-viralfx-purple'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-lg mb-1">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Floating Action Button */}
      <button
        onClick={() => navigate('/scan')}
        className="fixed bottom-20 right-4 bg-viralfx-purple text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-purple-700 transition-colors z-30"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      </button>
    </div>
  );
};

export default MobileTrendsPage;