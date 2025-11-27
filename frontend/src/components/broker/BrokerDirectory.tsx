import React, { useState, useEffect } from 'react';
import { ViralCategory } from '../../types/trends';
import { Broker } from '../../types/broker';
import { BrokerFilters } from '../../types/broker';

interface BrokerDirectoryProps {
  onBrokerSelect?: (broker: Broker) => void;
  onFiltersChange?: (filters: BrokerFilters) => void;
}

export const BrokerDirectory: React.FC<BrokerDirectoryProps> = ({
  onBrokerSelect,
  onFiltersChange
}) => {
  const [filters, setFilters] = useState<BrokerFilters>({
    categories: {
      CelebEx: false,
      BrandPulse: false,
      EduWave: false,
      Politix: false,
      Entertain360: false,
      TrendBase: false
    },
    platforms: {
      twitter: false,
      tiktok: false,
      instagram: false,
      youtube: false,
      facebook: false
    },
    regions: {
      southAfrica: true,
      sadc: false,
      global: false
    },
    verification: {
      all: true,
      fscVerified: false,
      pending: false
    },
    popularity: {
      topViral: true,
      fastestGrowing: false,
      mostEngaged: false,
      emergingTrends: false
    }
  });

  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getCategoryLabel = (category: string): string => {
    const labels = {
      CelebEx: 'Celebrity',
      BrandPulse: 'Brand',
      EduWave: 'Education',
      Politix: 'Politics',
      Entertain360: 'Entertainment',
      TrendBase: 'Emerging'
    };
    return labels[category] || category;
  };

  const getPlatformIcon = (platform: string): string => {
    const icons = {
      twitter: '🐦',
      tiktok: '🎵',
      instagram: '📷',
      youtube: '📺',
      facebook: '📘'
    };
    return icons[platform] || '🌐';
  };

  const updateFilter = (category: string, key: string, value: boolean) => {
    const newFilters = {
      ...filters,
      [category]: {
        ...filters[category],
        [key]: value
      }
    };
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const setVerificationFilter = (key: string) => {
    const newFilters = {
      ...filters,
      verification: {
        all: key === 'all',
        fscVerified: key === 'fscVerified',
        pending: key === 'pending'
      }
    };
    setFilters(newFilters);
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };

  const clearFilters = () => {
    const defaultFilters: BrokerFilters = {
      categories: {
        CelebEx: false,
        BrandPulse: false,
        EduWave: false,
        Politix: false,
        Entertain360: false,
        TrendBase: false
      },
      platforms: {
        twitter: false,
        tiktok: false,
        instagram: false,
        youtube: false,
        facebook: false
      },
      regions: {
        southAfrica: true,
        sadc: false,
        global: false
      },
      verification: {
        all: true,
        fscVerified: false,
        pending: false
      },
      popularity: {
        topViral: true,
        fastestGrowing: false,
        mostEngaged: false,
        emergingTrends: false
      }
    };
    setFilters(defaultFilters);
    setSearchQuery('');
    if (onFiltersChange) {
      onFiltersChange(defaultFilters);
    }
  };

  const loadBrokers = async () => {
    setLoading(true);
    try {
      // API call would go here
      // For now, simulate with mock data
      const mockBrokers: Broker[] = [
        {
          id: '1',
          name: 'SA Trading Partners',
          logo: '/logos/broker1.png',
          description: 'Leading South African brokerage specializing in social momentum trading',
          category: 'verified',
          rating: 4.8,
          reviewCount: 1247,
          fscVerified: true,
          specializedCategories: [ViralCategory.EDUWAVE, ViralCategory.BRANDPULSE],
          commissionRate: 0.15,
          minDeposit: 1000,
          website: 'https://satrading.co.za',
          sponsoredTrends: [],
          featuredAssets: []
        },
        {
          id: '2',
          name: 'Momentum Capital',
          logo: '/logos/broker2.png',
          description: 'Premium trading platform with advanced viral asset analytics',
          category: 'premium',
          rating: 4.6,
          reviewCount: 892,
          fscVerified: true,
          specializedCategories: [ViralCategory.CELEBEX, ViralCategory.ENTERTAIN360],
          commissionRate: 0.12,
          minDeposit: 5000,
          website: 'https://momentumcapital.co.za',
          sponsoredTrends: [],
          featuredAssets: []
        }
      ];

      // Apply filters
      const filteredBrokers = mockBrokers.filter(broker => {
        // Verification filter
        if (filters.verification.fscVerified && !broker.fscVerified) {
          return false;
        }
        if (filters.verification.pending && broker.fscVerified) {
          return false;
        }

        // Category filter
        const hasSelectedCategory = Object.entries(filters.categories).some(([category, selected]) => {
          if (!selected) return false;
          return broker.specializedCategories.includes(category as ViralCategory);
        });

        if (hasSelectedCategory) {
          return true;
        }

        // If no categories selected, show all brokers based on verification filter
        return true;
      });

      setBrokers(filteredBrokers);
    } catch (error) {
      console.error('Failed to load brokers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBrokers();
  }, [filters, searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Find Your Trading Partner
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Connect with FSCA-verified brokers who understand social momentum trading
            and can help you capitalize on viral trends in the South African market.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-viralfx-purple hover:text-purple-700"
                >
                  Clear All
                </button>
              </div>

              {/* Search */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Brokers
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Broker name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-viralfx-purple focus:border-viralfx-purple"
                />
              </div>

              {/* Category Filters */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Trend Categories</h4>
                <div className="space-y-2">
                  {Object.entries(filters.categories).map(([category, enabled]) => (
                    <label key={category} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => updateFilter('categories', category, e.target.checked)}
                        className="rounded border-gray-300 text-viralfx-purple focus:ring-viralfx-purple"
                      />
                      <span className="text-sm text-gray-700">{getCategoryLabel(category)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Platform Filters */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Platform Origin</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(filters.platforms).map(([platform, enabled]) => (
                    <button
                      key={platform}
                      onClick={() => updateFilter('platforms', platform, !enabled)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        enabled
                          ? 'bg-viralfx-purple text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      <span className="mr-1">{getPlatformIcon(platform)}</span>
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verification Filters */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Verification Status</h4>
                <div className="space-y-2">
                  {[
                    { key: 'all', label: 'All Brokers' },
                    { key: 'fscVerified', label: 'FSCA Verified Only' },
                    { key: 'pending', label: 'Pending Verification' }
                  ].map(option => (
                    <label key={option.key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="verification"
                        checked={filters.verification[option.key]}
                        onChange={() => setVerificationFilter(option.key)}
                        className="text-viralfx-purple focus:ring-viralfx-purple"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Popularity Filters */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">Trend Focus</h4>
                <div className="space-y-2">
                  {Object.entries(filters.popularity).map(([key, enabled]) => {
                    const labels = {
                      topViral: 'Top Viral Trends',
                      fastestGrowing: 'Fastest Growing',
                      mostEngaged: 'Most Engaged',
                      emergingTrends: 'Emerging Trends'
                    };
                    return (
                      <label key={key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => updateFilter('popularity', key, e.target.checked)}
                          className="rounded border-gray-300 text-viralfx-purple focus:ring-viralfx-purple"
                        />
                        <span className="text-sm text-gray-700">{labels[key]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Region Filters */}
              <div>
                <h4 className="font-medium mb-3">Geographic Focus</h4>
                <div className="space-y-2">
                  {Object.entries(filters.regions).map(([region, enabled]) => {
                    const labels = {
                      southAfrica: 'South Africa',
                      sadc: 'SADC Region',
                      global: 'Global'
                    };
                    return (
                      <label key={region} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={(e) => updateFilter('regions', region, e.target.checked)}
                          className="rounded border-gray-300 text-viralfx-purple focus:ring-viralfx-purple"
                        />
                        <span className="text-sm text-gray-700">{labels[region]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Broker Listings */}
          <div className="lg:col-span-3">
            {/* Results Header */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {brokers.length} Brokers Found
                  </h2>
                  {searchQuery && (
                    <p className="text-sm text-gray-600">
                      Searching for "{searchQuery}"
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-4">
                  <select className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-viralfx-purple focus:border-viralfx-purple">
                    <option>Most Relevant</option>
                    <option>Highest Rated</option>
                    <option>Lowest Commission</option>
                    <option>Most Popular</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Broker Cards */}
            {loading ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1">
                        <div className="h-6 bg-gray-200 rounded mb-2 w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : brokers.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-12 text-center">
                <div className="text-gray-400 text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No brokers found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your filters or search criteria to find more brokers.
                </p>
                <button
                  onClick={clearFilters}
                  className="bg-viralfx-purple text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {brokers.map(broker => (
                  <div
                    key={broker.id}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer"
                    onClick={() => onBrokerSelect?.(broker)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        {/* Broker Logo */}
                        <div className="flex-shrink-0">
                          <img
                            src={broker.logo || '/logos/default-broker.png'}
                            alt={broker.name}
                            className="w-16 h-16 rounded-lg object-cover bg-gray-100"
                            onError={(e) => {
                              e.currentTarget.src = '/logos/default-broker.png';
                            }}
                          />
                        </div>

                        {/* Broker Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {broker.name}
                            </h3>
                            {broker.fscVerified && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                ✓ FSCA Verified
                              </span>
                            )}
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              broker.category === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                              broker.category === 'premium' ? 'bg-blue-100 text-blue-800' :
                              broker.category === 'verified' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {broker.category.charAt(0).toUpperCase() + broker.category.slice(1)}
                            </span>
                          </div>

                          <p className="text-gray-600 mb-3 line-clamp-2">
                            {broker.description}
                          </p>

                          {/* Specialized Categories */}
                          {broker.specializedCategories && broker.specializedCategories.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {broker.specializedCategories.map(category => (
                                <span
                                  key={category}
                                  className="bg-viralfx-purple bg-opacity-10 text-viralfx-purple px-2 py-1 rounded text-xs font-medium"
                                >
                                  {getCategoryLabel(category)}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Key Metrics */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-gray-500">Commission</div>
                              <div className="font-semibold">{(broker.commissionRate * 100).toFixed(2)}%</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Min Deposit</div>
                              <div className="font-semibold">R{broker.minDeposit.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Rating</div>
                              <div className="font-semibold flex items-center">
                                ⭐ {broker.rating}
                                <span className="text-gray-400 ml-1">({broker.reviewCount})</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-500">Website</div>
                              <a
                                href={broker.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-viralfx-purple hover:underline font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Visit Site →
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onBrokerSelect?.(broker);
                          }}
                          className="bg-viralfx-purple text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Connect
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Load More */}
            <div className="text-center mt-8">
              <button className="bg-viralfx-purple text-white px-8 py-3 rounded-lg hover:bg-purple-700 transition-colors">
                Load More Brokers
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrokerDirectory;