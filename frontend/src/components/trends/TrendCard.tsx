import React from 'react';
import { ViralAsset, ViralCategory } from '../../types/trends';

interface TrendCardProps {
  trend: ViralAsset;
  onSelect?: (trend: ViralAsset) => void;
  showSponsored?: boolean;
  compact?: boolean;
}

export const TrendCard: React.FC<TrendCardProps> = ({
  trend,
  onSelect,
  showSponsored = false,
  compact = false
}) => {
  const categoryColors = {
    CelebEx: 'bg-amber-500',      // Gold
    BrandPulse: 'bg-indigo-500',   // Indigo
    EduWave: 'bg-emerald-500',     // Emerald
    Politix: 'bg-rose-700',        // Burgundy
    Entertain360: 'bg-orange-500', // Coral
    TrendBase: 'bg-gray-400'       // Silver
  };

  const categoryLabels = {
    CelebEx: 'Celebrity',
    BrandPulse: 'Brand',
    EduWave: 'Education',
    Politix: 'Politics',
    Entertain360: 'Entertainment',
    TrendBase: 'Emerging'
  };

  const getPlatformIcon = (platform: string) => {
    const icons = {
      twitter: '🐦',
      tiktok: '🎵',
      instagram: '📷',
      youtube: '📺',
      facebook: '📘'
    };
    return icons[platform] || '🌐';
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 0.2) return 'text-green-600';
    if (sentiment < -0.2) return 'text-red-600';
    return 'text-gray-600';
  };

  const getMomentumColor = (momentum: number) => {
    if (momentum > 80) return 'text-green-600';
    if (momentum > 60) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(trend);
    }
  };

  if (compact) {
    return (
      <div
        className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white ${categoryColors[trend.category]}`}>
                {categoryLabels[trend.category]}
              </span>
              <span className={`text-sm font-medium ${getMomentumColor(trend.momentum_score)}`}>
                {trend.momentum_score.toFixed(0)}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{trend.name}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm font-bold text-viralfx-purple">R{trend.current_price.toFixed(2)}</span>
              <span className="text-xs text-gray-500">
                {(trend.volume_24h / 1000).toFixed(0)}K vol
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2">
            {trend.current_platforms.slice(0, 2).map(platform => (
              <span key={platform} className="text-gray-400 text-xs">
                {getPlatformIcon(platform)}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white ${categoryColors[trend.category]}`}
          >
            {categoryLabels[trend.category]}
          </span>
          {trend.is_trending && (
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
              🔥 Trending
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          {trend.current_platforms.map(platform => (
            <span
              key={platform}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title={platform}
            >
              {getPlatformIcon(platform)}
            </span>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{trend.name}</h3>
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{trend.description}</p>

        {/* Keywords */}
        {trend.keywords && trend.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {trend.keywords.slice(0, 3).map((keyword, index) => (
              <span
                key={index}
                className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs"
              >
                #{keyword}
              </span>
            ))}
            {trend.keywords.length > 3 && (
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                +{trend.keywords.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500 mb-1">Momentum</div>
            <div className={`font-semibold text-lg ${getMomentumColor(trend.momentum_score)}`}>
              {trend.momentum_score.toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">/100</div>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <div className="text-xs text-gray-500 mb-1">Sentiment</div>
            <div className={`font-semibold text-lg ${getSentimentColor(trend.sentiment_index)}`}>
              {trend.sentiment_index > 0 ? '+' : ''}{(trend.sentiment_index * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">
              {trend.sentiment_index > 0 ? 'Positive' : trend.sentiment_index < 0 ? 'Negative' : 'Neutral'}
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div>
            <div className="text-xs text-gray-500">Virality</div>
            <div className="text-sm font-medium">{trend.virality_rate.toFixed(0)}/h</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Reach</div>
            <div className="text-sm font-medium">{(trend.reach_estimate / 1000000).toFixed(1)}M</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Risk</div>
            <div className="text-sm font-medium">{(trend.content_risk_score * 100).toFixed(0)}%</div>
          </div>
        </div>

        {/* Price & Volume */}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Current Price</div>
              <div className="font-bold text-lg text-viralfx-purple">R{trend.current_price.toFixed(2)}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">24h Volume</div>
              <div className="font-medium">
                {trend.volume_24h >= 1000000
                  ? `R${(trend.volume_24h / 1000000).toFixed(1)}M`
                  : `R${(trend.volume_24h / 1000).toFixed(0)}K`
                }
              </div>
            </div>
          </div>
        </div>

        {/* Sponsored Banner */}
        {showSponsored && trend.sponsoring_brokers && trend.sponsoring_brokers.length > 0 && (
          <div className="bg-viralfx-purple bg-opacity-10 border border-viralfx-purple border-opacity-30 rounded-lg p-2 mt-3">
            <div className="text-xs text-viralfx-purple font-medium mb-1">Sponsored by</div>
            <div className="flex items-center space-x-2">
              {trend.sponsoring_brokers.slice(0, 2).map(broker => (
                <div key={broker.id} className="flex items-center space-x-1">
                  <img
                    src={broker.logo}
                    alt={broker.name}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-xs text-gray-700">{broker.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Indicators */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              trend.content_safety === 'SAFE' ? 'bg-green-500' :
              trend.content_safety === 'FLAGGED' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></span>
            <span className="text-gray-500">
              {trend.content_safety === 'SAFE' ? 'Safe Content' :
               trend.content_safety === 'FLAGGED' ? 'Under Review' : 'Blocked'}
            </span>
          </div>
          <div className="text-gray-400">
            Expires: {new Date(trend.expiry_time).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendCard;