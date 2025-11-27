import { useState, useEffect } from 'react';
import { SparklesIcon, RiseOutlinedIcon, FireIcon, ClockIcon, GlobeAltIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { useQuery } from '@tanstack/react-query';
import { trendsApi } from '../../services/api/trends.api';

interface Trend {
  id: string;
  title: string;
  summary: string;
  viralityScore: number;
  velocity: number;
  platforms: string[];
  region: string;
  categories: string[];
  sentiment: number;
  toxicity: number;
  createdAt: string;
}

interface TrendFeedProps {
  className?: string;
  limit?: number;
  region?: string;
}

export default function TrendFeed({ className, limit = 10, region }: TrendFeedProps) {
  const [selectedTrend, setSelectedTrend] = useState<string | null>(null);

  const {data: trends, isLoading, error} = useQuery({
    queryKey: ['trends', 'current', region, limit],
    queryFn: () => trendsApi.getCurrentTrends({ region, limit }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <div className={clsx('bg-surface-primary rounded-xl p-6 shadow-lg border border-gray-700', className)}>
        <div className="flex items-center gap-2 mb-6">
          <SparklesIcon className="h-6 w-6 text-accent-500 animate-pulse" />
          <h2 className="text-xl font-semibold text-white">Loading Trends...</h2>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-background-medium rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-background-medium rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx('bg-surface-primary rounded-xl p-6 shadow-lg border border-gray-700', className)}>
        <div className="text-center text-danger-500">
          <SparklesIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Failed to load trends. Please try again.</p>
        </div>
      </div>
    );
  }

  const trendsWithoutUnread = trends?.data?.trends || [];

  return (
    <div className={clsx('bg-surface-primary rounded-xl p-6 shadow-lg border border-gray-700', className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
          <SparklesIcon className="h-6 w-6 text-accent-500" />
          {region ? `Trending in ${region}` : 'Trending in South Africa'}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {trendsWithoutUnread.length} active trends
          </span>
          <div className="w-2 h-2 bg-success-500 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div className="space-y-4">
        {trendsWithoutUnread.slice(0, limit).map((trend, index) => (
          <div
            key={trend.id}
            className={clsx(
              'p-4 rounded-lg border transition-all duration-200 cursor-pointer',
              selectedTrend === trend.id ? 'border-accent-500/30 bg-surface-secondary/50 shadow-glow' : 'border-gray-700 hover:bg-surface-secondary',
              index === 0 && 'border-accent-500/30 bg-surface-secondary/50'
            )}
            onClick={() => setSelectedTrend(selectedTrend === trend.id ? null : trend.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                {/* Categories */}
                <div className="flex items-center gap-2 mb-2">
                  {trend.categories.map((category, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-accent-500/20 text-accent-500"
                    >
                      {category}
                    </span>
                  ))}
                  {index === 0 && (
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-success-500/20 text-success-500">
                      🔥 #1
                    </span>
                  )}
                </div>

                <h3 className="text-white font-medium text-lg mb-1 line-clamp-2">
                  {trend.title}
                </h3>
                <p className="text-gray-400 text-sm line-clamp-2 mb-2">
                  {trend.summary}
                </p>

                {/* Platforms */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                  <span className="flex items-center gap-1">
                    <GlobeAltIcon className="h-3 w-3" />
                    {trend.platforms.join(', ')}
                  </span>
                  <span>{trend.region}</span>
                </div>
              </div>

              <div className="ml-4 flex flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  {trend.viralityScore > 80 ? (
                    <FireIcon className="h-4 w-4 text-success-500" />
                  ) : (
                    <RiseOutlinedIcon className="h-4 w-4 text-accent-500" />
                  )}
                  <span
                    className={clsx(
                      'text-sm font-bold',
                      trend.viralityScore > 80 ? 'text-success-500' : 'text-accent-500'
                    )}
                  >
                    {trend.viralityScore.toFixed(1)}
                  </span>
                </div>

                {/* Sentiment indicator */}
                <div className="text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{
                      backgroundColor: trend.sentiment > 0.5 ? '#00C853' :
                                       trend.sentiment < -0.5 ? '#E53935' : '#FFB300'
                    }}></span>
                    {trend.sentiment > 0.5 ? 'Positive' :
                     trend.sentiment < -0.5 ? 'Negative' : 'Neutral'}
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  <ClockIcon className="h-3 w-3 inline mr-1" />
                  {new Date(trend.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {selectedTrend === trend.id && (
              <div className="mt-4 pt-4 border-t border-gray-700 animate-slide-up">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-gray-400">Velocity</div>
                    <div className="text-white font-bold">{trend.velocity.toFixed(1)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400">Sentiment</div>
                    <div className="text-white font-bold">{(trend.sentiment * 100).toFixed(0)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-400">Safety</div>
                    <div className="text-white font-bold">{((1 - trend.toxicity) * 100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {trendsWithoutUnread.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <SparklesIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No trending topics at the moment</p>
          <p className="text-sm mt-2">Check back later for the latest viral trends!</p>
        </div>
      )}

      {trendsWithoutUnread.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button className="w-full py-2 px-4 text-sm font-medium text-accent-500 hover:text-accent-400 transition-colors">
            View All Trends →
          </button>
        </div>
      )}
    </div>
  );
}