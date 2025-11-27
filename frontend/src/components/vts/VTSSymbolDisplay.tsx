/**
 * ViralFX VTS Symbol Display Component
 * Renders VTS symbols with proper formatting, colors, and metadata
 * © 2025 ViralFX - Global Symbol Standard
 */

import React from 'react';
import { Tooltip, Badge, Avatar, Chip } from '@mui/material';
import { RiseOutlined, FallOutlined, Remove, Public, LocationOn, Category } from '@mui/icons-material';
import { VTSSymbol, RegionCode, CategoryCode } from '../../../types/vts';

interface VTSSymbolDisplayProps {
  vtsSymbol: VTSSymbol;
  size?: 'small' | 'medium' | 'large';
  showMetadata?: boolean;
  showPrice?: boolean;
  showChange?: boolean;
  className?: string;
  onClick?: () => void;
}

interface VTSTickerProps {
  symbols: VTSSymbol[];
  maxVisible?: number;
  autoScroll?: boolean;
  className?: string;
}

export const VTSSymbolDisplay: React.FC<VTSSymbolDisplayProps> = ({
  vtsSymbol,
  size = 'medium',
  showMetadata = true,
  showPrice = true,
  showChange = true,
  className = '',
  onClick
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'text-sm px-2 py-1';
      case 'large':
        return 'text-lg px-4 py-2';
      default:
        return 'text-base px-3 py-1.5';
    }
  };

  const getCategoryColor = (category: CategoryCode): string => {
    const colors = {
      [CategoryCode.POLITICS]: 'bg-red-500',
      [CategoryCode.ENTERTAINMENT]: 'bg-purple-500',
      [CategoryCode.SPORTS]: 'bg-green-500',
      [CategoryCode.TECHNOLOGY]: 'bg-blue-500',
      [CategoryCode.CULTURE]: 'bg-orange-500',
      [CategoryCode.FINANCE]: 'bg-emerald-500',
      [CategoryCode.SAFETY]: 'bg-red-600',
      [CategoryCode.EDUCATION]: 'bg-amber-700',
      [CategoryCode.MISC]: 'bg-gray-500',
      [CategoryCode.HEALTH]: 'bg-pink-600',
      [CategoryCode.SCIENCE]: 'bg-blue-700',
      [CategoryCode.BUSINESS]: 'bg-green-600',
      [CategoryCode.LIFESTYLE]: 'bg-orange-600',
      [CategoryCode.TRAVEL]: 'bg-cyan-500',
      [CategoryCode.FOOD]: 'bg-red-600',
      [CategoryCode.ENVIRONMENT]: 'bg-green-600',
      [CategoryCode.CRIME]: 'bg-red-900',
    };
    return colors[category] || 'bg-gray-500';
  };

  const getRegionIcon = (region: RegionCode) => {
    switch (region) {
      case RegionCode.GLOBAL:
        return <Public className="w-4 h-4" />;
      default:
        return <LocationOn className="w-4 h-4" />;
    }
  };

  const getVerificationBadge = (level: string) => {
    const variants = {
      LOW: { color: 'default', label: 'Unverified' },
      MEDIUM: { color: 'primary', label: 'Verified' },
      HIGH: { color: 'secondary', label: 'High Trust' },
      VERIFIED: { color: 'success', label: 'Official' },
      SUSPICIOUS: { color: 'warning', label: 'Caution' },
      REJECTED: { color: 'error', label: 'Rejected' }
    };
    return variants[level as keyof typeof variants] || variants.LOW;
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <RiseOutlined className="text-green-500" />;
    if (change < 0) return <FallOutlined className="text-red-500" />;
    return <Remove className="text-gray-500" />;
  };

  const verificationBadge = getVerificationBadge(vtsSymbol.metadata.verificationLevel);

  return (
    <div
      className={`inline-flex items-center gap-2 bg-gray-900 rounded-lg border border-gray-700 ${getSizeClasses()} ${className}`}
      onClick={onClick}
    >
      {/* Symbol Code */}
      <div className="flex items-center gap-1">
        <span className="text-viral-gold font-mono font-bold">
          {vtsSymbol.symbol}
        </span>
      </div>

      {/* Category Badge */}
      <Tooltip title={`Category: ${vtsSymbol.category}`}>
        <div className={`w-2 h-2 rounded-full ${getCategoryColor(vtsSymbol.category)}`} />
      </Tooltip>

      {/* Region Icon */}
      <Tooltip title={`Region: ${vtsSymbol.region}`}>
        <span className="text-gray-400">
          {getRegionIcon(vtsSymbol.region)}
        </span>
      </Tooltip>

      {/* Price */}
      {showPrice && (
        <span className="text-white font-semibold">
          {vtsSymbol.metadata.currentPrice.toFixed(2)}
        </span>
      )}

      {/* Change */}
      {showChange && vtsSymbol.metadata.change24h !== undefined && (
        <div className="flex items-center gap-1">
          {getChangeIcon(vtsSymbol.metadata.change24h)}
          <span className={`text-sm ${
            vtsSymbol.metadata.change24h > 0 ? 'text-green-500' :
            vtsSymbol.metadata.change24h < 0 ? 'text-red-500' : 'text-gray-500'
          }`}>
            {Math.abs(vtsSymbol.metadata.change24h).toFixed(2)}%
          </span>
        </div>
      )}

      {/* Verification Badge */}
      {showMetadata && (
        <Chip
          size="small"
          label={verificationBadge.label}
          color={verificationBadge.color as any}
          variant="outlined"
          className="text-xs"
        />
      )}

      {/* Virality Indicator */}
      {showMetadata && vtsSymbol.metadata.viralityScore > 0.7 && (
        <Tooltip title="High Virality">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        </Tooltip>
      )}
    </div>
  );
};

export const _VTSSymbolCard: React.FC<{ vtsSymbol: VTSSymbol }> = ({ vtsSymbol }) => {
  const getCategoryName = (category: CategoryCode): string => {
    const names = {
      [CategoryCode.POLITICS]: 'Politics',
      [CategoryCode.ENTERTAINMENT]: 'Entertainment',
      [CategoryCode.SPORTS]: 'Sports',
      [CategoryCode.TECHNOLOGY]: 'Technology',
      [CategoryCode.CULTURE]: 'Culture',
      [CategoryCode.FINANCE]: 'Finance',
      [CategoryCode.SAFETY]: 'Safety',
      [CategoryCode.EDUCATION]: 'Education',
      [CategoryCode.MISC]: 'Miscellaneous',
      [CategoryCode.HEALTH]: 'Health',
      [CategoryCode.SCIENCE]: 'Science',
      [CategoryCode.BUSINESS]: 'Business',
      [CategoryCode.LIFESTYLE]: 'Lifestyle',
      [CategoryCode.TRAVEL]: 'Travel',
      [CategoryCode.FOOD]: 'Food',
      [CategoryCode.ENVIRONMENT]: 'Environment',
      [CategoryCode.CRIME]: 'Crime',
    };
    return names[category] || 'Unknown';
  };

  const getRegionName = (region: RegionCode): string => {
    const names = {
      [RegionCode.GLOBAL]: 'Global',
      [RegionCode.SOUTH_AFRICA]: 'South Africa',
      [RegionCode.NIGERIA]: 'Nigeria',
      [RegionCode.USA]: 'United States',
      [RegionCode.UK]: 'United Kingdom',
      [RegionCode.AUSTRALIA]: 'Australia',
      [RegionCode.CANADA]: 'Canada',
      [RegionCode.GERMANY]: 'Germany',
      [RegionCode.FRANCE]: 'France',
      [RegionCode.JAPAN]: 'Japan',
      [RegionCode.CHINA]: 'China',
      [RegionCode.INDIA]: 'India',
      [RegionCode.BRAZIL]: 'Brazil',
      [RegionCode.MEXICO]: 'Mexico',
      [RegionCode.SPAIN]: 'Spain',
      [RegionCode.ITALY]: 'Italy',
      [RegionCode.SOUTH_KOREA]: 'South Korea',
      [RegionCode.NETHERLANDS]: 'Netherlands',
      [RegionCode.SINGAPORE]: 'Singapore',
    };
    return names[region] || 'Unknown';
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-viral-gold transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <VTSSymbolDisplay vtsSymbol={vtsSymbol} showMetadata={false} />
        <div className="flex items-center gap-2">
          <Badge
            badgeContent={vtsSymbol.metadata.viralityScore > 0.8 ? '🔥' : ''}
            color="secondary"
          >
            <Avatar className="w-10 h-10 bg-viral-gold text-black font-bold">
              {vtsSymbol.topicId.substring(0, 2)}
            </Avatar>
          </Badge>
        </div>
      </div>

      {/* Title and Description */}
      <div className="mb-3">
        <h3 className="text-white font-semibold text-lg mb-1">
          {vtsSymbol.displayName}
        </h3>
        <p className="text-gray-400 text-sm">
          {vtsSymbol.description}
        </p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Category:</span>
          <span className="text-white ml-2">{getCategoryName(vtsSymbol.category)}</span>
        </div>
        <div>
          <span className="text-gray-500">Region:</span>
          <span className="text-white ml-2">{getRegionName(vtsSymbol.region)}</span>
        </div>
        <div>
          <span className="text-gray-500">Sentiment:</span>
          <span className={`ml-2 ${
            vtsSymbol.metadata.sentimentScore > 0.2 ? 'text-green-500' :
            vtsSymbol.metadata.sentimentScore < -0.2 ? 'text-red-500' : 'text-gray-400'
          }`}>
            {(vtsSymbol.metadata.sentimentScore * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span className="text-gray-500">Consensus:</span>
          <span className="text-white ml-2">
            {(vtsSymbol.metadata.consensusScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Platforms */}
      {vtsSymbol.metadata.platforms.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="text-gray-500 text-sm">Platforms:</span>
          <div className="flex gap-1 mt-1">
            {vtsSymbol.metadata.platforms.map((platform, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-800 text-gray-300 rounded text-xs"
              >
                {platform}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
        <span className="text-gray-500 text-xs">
          Created: {new Date(vtsSymbol.metadata.createdAt).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-xs">
            Engagement: {vtsSymbol.metadata.totalEngagement?.toLocaleString() || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const VTSTicker: React.FC<VTSTickerProps> = ({
  symbols,
  maxVisible = 10,
  autoScroll = true,
  className = ''
}) => {
  const displaySymbols = symbols.slice(0, maxVisible);

  return (
    <div className={`bg-gray-900 rounded-lg p-3 border border-gray-700 ${className}`}>
      <div className="flex items-center gap-1 overflow-x-auto">
        {displaySymbols.map((symbol, index) => (
          <div key={symbol.symbol} className="flex items-center gap-1 whitespace-nowrap">
            {index > 0 && <span className="text-gray-600">|</span>}
            <VTSSymbolDisplay
              vtsSymbol={symbol}
              size="small"
              showMetadata={false}
              showChange={true}
            />
          </div>
        ))}
        {symbols.length > maxVisible && (
          <span className="text-gray-500 text-sm ml-2">
            +{symbols.length - maxVisible} more
          </span>
        )}
      </div>
    </div>
  );
};

export const _VTSSymbolSearch: React.FC<{
  symbols: VTSSymbol[];
  onSymbolSelect: (symbol: VTSSymbol) => void;
  className?: string;
}> = ({ symbols, onSymbolSelect, className = '' }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filteredSymbols, setFilteredSymbols] = React.useState<VTSSymbol[]>(symbols);

  React.useEffect(() => {
    if (!searchQuery) {
      setFilteredSymbols(symbols);
      return;
    }

    const filtered = symbols.filter(symbol =>
      symbol.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      symbol.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      symbol.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      symbol.metadata.originalTopic.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setFilteredSymbols(filtered);
  }, [searchQuery, symbols]);

  return (
    <div className={`bg-gray-900 rounded-lg border border-gray-700 ${className}`}>
      {/* Search Input */}
      <div className="p-3 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search symbols..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-viral-gold focus:outline-none"
        />
      </div>

      {/* Results */}
      <div className="max-h-96 overflow-y-auto">
        {filteredSymbols.map(symbol => (
          <div
            key={symbol.symbol}
            onClick={() => onSymbolSelect(symbol)}
            className="p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between">
              <VTSSymbolDisplay
                vtsSymbol={symbol}
                size="small"
                showMetadata={false}
              />
              <div className="text-right">
                <div className="text-white font-semibold">
                  {symbol.metadata.currentPrice.toFixed(2)}
                </div>
                <div className={`text-sm ${
                  symbol.metadata.change24h > 0 ? 'text-green-500' :
                  symbol.metadata.change24h < 0 ? 'text-red-500' : 'text-gray-500'
                }`}>
                  {symbol.metadata.change24h > 0 ? '+' : ''}
                  {symbol.metadata.change24h?.toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="text-gray-400 text-sm mt-1">
              {symbol.displayName}
            </div>
          </div>
        ))}

        {filteredSymbols.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            No symbols found matching "{searchQuery}"
          </div>
        )}
      </div>
    </div>
  );
};