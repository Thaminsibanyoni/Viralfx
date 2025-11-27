import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ViralAsset } from '../../types/trends';

const MobileAssetDetailPage: React.FC = () => {
  const {id} = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<ViralAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'news'>('overview');
  const [showTradeModal, setShowTradeModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadAsset(id);
    }
  }, [id]);

  const _loadAsset = async (assetId: string) => {
    setLoading(true);
    try {
      // API call to get asset details
      const mockAsset: ViralAsset = {
        id: assetId,
        symbol: 'CELEB/SA_MUSIC_ALBUM',
        name: 'SA Artist drops surprise album',
        description: 'Major South African musician releases surprise album with collaborations featuring international artists',
        category: 'CelebEx',
        origin_platform: 'twitter',
        current_platforms: ['twitter', 'instagram', 'tiktok', 'youtube'],
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
        keywords: ['music', 'album', 'surprise', 'collaboration', 'artist'],
        is_trending: true,
        trending_rank: 1,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      };
      setAsset(mockAsset);
    } catch (error) {
      console.error('Failed to load asset:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors = {
      CelebEx: 'bg-amber-500',
      BrandPulse: 'bg-indigo-500',
      EduWave: 'bg-emerald-500',
      Politix: 'bg-rose-700',
      Entertain360: 'bg-orange-500',
      TrendBase: 'bg-gray-400'
    };
    return colors[category] || 'bg-gray-500';
  };

  const getPlatformIcon = (platform: string): string => {
    const icons = {
      twitter: '🐦',
      tiktok: '🎵',
      instagram: '📷',
      youtube: '📺',
      facebook: '📘',
      linkedin: '💼'
    };
    return icons[platform] || '🌐';
  };

  const handleTrade = (type: 'buy' | 'sell') => {
    setShowTradeModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-viralfx-purple border-t-transparent"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="text-gray-400 text-4xl mb-2">📉</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Asset Not Found</h2>
        <p className="text-gray-600 text-center mb-4">
          The viral asset you're looking for doesn't exist or has expired.
        </p>
        <button
          onClick={() => navigate('/trends')}
          className="bg-viralfx-purple text-white px-6 py-2 rounded-lg font-medium"
        >
          Back to Trends
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 truncate flex-1 text-center">
            {asset.symbol}
          </h1>
          <button className="p-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Asset Header */}
        <div className="bg-white p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(asset.category)}`}>
                {asset.category}
              </span>
              {asset.is_trending && (
                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  🔥 #{asset.trending_rank}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {asset.current_platforms.map(platform => (
                <span key={platform} className="text-gray-400 text-sm">
                  {getPlatformIcon(platform)}
                </span>
              ))}
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">{asset.name}</h2>
          <p className="text-gray-600 text-sm mb-4">{asset.description}</p>

          {/* Price Information */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Current Price</span>
              <span className="text-xs text-gray-400">
                Expires: {new Date(asset.expiry_time).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-bold text-viralfx-purple">
                R{asset.current_price.toFixed(2)}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-green-600">+12.5%</div>
                <div className="text-xs text-gray-500">
                  24h Volume: R{(asset.volume_24h / 1000000).toFixed(1)}M
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-white p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Key Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Momentum</div>
              <div className="text-lg font-bold text-green-600">{asset.momentum_score.toFixed(0)}</div>
              <div className="text-xs text-gray-400">/100</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Sentiment</div>
              <div className="text-lg font-bold text-green-600">
                {asset.sentiment_index > 0 ? '+' : ''}{(asset.sentiment_index * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">Positive</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Virality</div>
              <div className="text-lg font-bold">{asset.virality_rate.toFixed(0)}/h</div>
              <div className="text-xs text-gray-400">Posts per hour</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-1">Reach</div>
              <div className="text-lg font-bold">{(asset.reach_estimate / 1000000).toFixed(1)}M</div>
              <div className="text-xs text-gray-400">Unique users</div>
            </div>
          </div>
        </div>

        {/* Keywords */}
        {asset.keywords && asset.keywords.length > 0 && (
          <div className="bg-white p-4 border-b">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Related Keywords</h3>
            <div className="flex flex-wrap gap-2">
              {asset.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="bg-viralfx-purple bg-opacity-10 text-viralfx-purple px-3 py-1 rounded-full text-xs font-medium"
                >
                  #{keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border-b sticky top-0 z-30">
          <div className="flex">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'analytics', label: 'Analytics' },
              { key: 'news', label: 'Related Content' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-viralfx-purple text-viralfx-purple'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white">
          {activeTab === 'overview' && (
            <div className="p-4 space-y-4">
              {/* Performance Chart */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Price Performance</h3>
                <div className="bg-gray-50 rounded-lg p-4 h-48 flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">Price chart loading...</p>
                  </div>
                </div>
              </div>

              {/* Safety Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Safety</h3>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-green-800 font-medium text-sm">Safe Content</span>
                  </div>
                  <p className="text-green-700 text-xs mt-1">
                    This content has been verified and meets safety guidelines
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-4 space-y-4">
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v1a3 3 0 003 3h0a3 3 0 003-3v-1m-6 0h6M9 17v-4m6 4v-4m0 0h.01M9 13h.01M12 13h4m-4 0h-4" />
                </svg>
                <p className="text-sm">Advanced analytics coming soon</p>
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="p-4 space-y-4">
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <p className="text-sm">Related content loading...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Action Buttons */}
      <div className="bg-white border-t p-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleTrade('buy')}
            className="bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
          >
            Buy
          </button>
          <button
            onClick={() => handleTrade('sell')}
            className="bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Sell
          </button>
        </div>
      </div>

      {/* Trade Modal */}
      {showTradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Place Order</h3>
              <button
                onClick={() => setShowTradeModal(false)}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-viralfx-purple focus:border-viralfx-purple">
                  <option>Market Order</option>
                  <option>Limit Order</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-viralfx-purple focus:border-viralfx-purple"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Total</label>
                <div className="text-xl font-bold text-viralfx-purple">R0.00</div>
              </div>

              <button className="w-full bg-viralfx-purple text-white py-3 rounded-lg font-semibold hover:bg-purple-700">
                Place Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileAssetDetailPage;