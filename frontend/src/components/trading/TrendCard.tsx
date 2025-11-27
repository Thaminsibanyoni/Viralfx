import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Line } from '@ant-design/plots';
import { Card, Statistic, Tag, Progress, Avatar, Tooltip, Button } from 'antd';
import {
  RiseOutlined, FallOutlined, FireOutlined, EyeOutlined, HeartOutlined, MessageOutlined, ShareAltOutlined, ThunderboltOutlined, ClockCircleOutlined, AlertOutlined, StarOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';

interface TrendCardProps {
  trend: {
    id: string;
    symbol: string;
    name: string;
    category: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    viralityScore: number;
    engagementRate: number;
    sentimentScore: number;
    riskScore: number;
    description: string;
    author: string;
    platform: string;
    hashtags: string[];
    mediaUrls: string[];
    isActive: boolean;
    expiresAt?: string;
  };
  onTrade?: (trendId: string) => void;
  onDetails?: (trendId: string) => void;
  compact?: boolean;
}

const TrendCard: React.FC<TrendCardProps> = ({
  trend,
  onTrade,
  onDetails,
  compact = false
}) => {
  const {user} = useAuth();
  const {subscribeToTrend, unsubscribeFromTrend, marketData} = useWebSocket();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [priceHistory, setPriceHistory] = useState<Array<{time: string, price: number}>>([]);

  useEffect(() => {
    // Subscribe to real-time updates for this trend
    subscribeToTrend(trend.id);
    setIsSubscribed(true);

    return () => {
      unsubscribeFromTrend(trend.id);
      setIsSubscribed(false);
    };
  }, [trend.id]);

  useEffect(() => {
    // Update price history when new market data arrives
    if (marketData[trend.id]) {
      setPriceHistory(prev => {
        const newData = [...prev, {
          time: new Date().toISOString(),
          price: marketData[trend.id].price
        }].slice(-50); // Keep last 50 data points
        return newData;
      });
    }
  }, [marketData, trend.id]);

  const getPriceColor = (change: number) => {
    return change >= 0 ? '#52c41a' : '#ff4d4f';
  };

  const getViralityColor = (score: number) => {
    if (score >= 80) return '#ff4d4f'; // High virality - red
    if (score >= 60) return '#faad14'; // Medium virality - orange
    if (score >= 40) return '#1890ff'; // Low virality - blue
    return '#52c41a'; // Very low virality - green
  };

  const getSentimentEmoji = (score: number) => {
    if (score >= 0.6) return '😊';
    if (score >= 0.2) return '🙂';
    if (score >= -0.2) return '😐';
    if (score >= -0.6) return '😟';
    return '😢';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return { level: 'CRITICAL', color: '#ff4d4f' };
    if (score >= 60) return { level: 'HIGH', color: '#fa8c16' };
    if (score >= 40) return { level: 'MEDIUM', color: '#faad14' };
    return { level: 'LOW', color: '#52c41a' };
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const getTimeRemaining = () => {
    if (!trend.expiresAt) return null;
    const now = new Date();
    const expires = new Date(trend.expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const sparklineConfig = {
    data: priceHistory.length > 0 ? priceHistory.map(p => p.price) : [trend.currentPrice],
    width: compact ? 80 : 120,
    height: compact ? 30 : 50,
    autoFit: false,
    smooth: true,
    color: getPriceColor(trend.priceChange24h),
    areaStyle: {
      fill: 'gradient',
      fillOpacity: 0.2,
    },
    lineStyle: {
      lineWidth: 2,
    },
    point: {
      size: 0,
    },
  };

  const riskLevel = getRiskLevel(trend.riskScore);

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        hoverable
        className={`trend-card ${compact ? 'compact' : ''}`}
        size={compact ? 'small' : 'default'}
        actions={
          !compact && [
            <Button
              key="trade"
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => onTrade?.(trend.id)}
              disabled={!trend.isActive}
            >
              Trade
            </Button>,
            <Button
              key="details"
              onClick={() => onDetails?.(trend.id)}
            >
              Details
            </Button>
          ]
        }
      >
        {/* Header */}
        <div className="trend-header">
          <div className="trend-basic-info">
            <div className="trend-symbol-category">
              <span className="trend-symbol">{trend.symbol}</span>
              <Tag color="blue" size="small">{trend.category}</Tag>
              {trend.isActive && <Tag color="green" size="small">ACTIVE</Tag>}
            </div>
            <h3 className="trend-name">{trend.name}</h3>
          </div>

          {!compact && (
            <div className="trend-virality-indicator">
              <Tooltip title={`Virality Score: ${trend.viralityScore.toFixed(1)}`}>
                <div className="virality-score" style={{ color: getViralityColor(trend.viralityScore) }}>
                  <FireOutlined /> {trend.viralityScore.toFixed(0)}
                </div>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Price and Performance */}
        <div className="trend-price-section">
          <div className="price-info">
            <Statistic
              title="Current Price"
              value={formatPrice(trend.currentPrice)}
              precision={6}
              valueStyle={{
                color: getPriceColor(trend.priceChange24h),
                fontSize: compact ? '16px' : '20px',
                fontWeight: 'bold'
              }}
              prefix={trend.priceChange24h >= 0 ? <RiseOutlined /> : <FallOutlined />}
            />
          </div>

          {priceHistory.length > 1 && (
            <div className="price-sparkline">
              <Line {...sparklineConfig} />
            </div>
          )}

          <div className="price-change">
            <span style={{ color: getPriceColor(trend.priceChange24h) }}>
              {trend.priceChange24h >= 0 ? '+' : ''}{trend.priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Metrics */}
        {!compact && (
          <div className="trend-metrics">
            <div className="metric-row">
              <Statistic
                title="Volume 24h"
                value={formatVolume(trend.volume24h)}
                valueStyle={{ fontSize: '14px' }}
              />
              <Statistic
                title="Engagement"
                value={trend.engagementRate}
                suffix="%"
                valueStyle={{ fontSize: '14px' }}
              />
              <Statistic
                title={`Sentiment Score: ${(trend.sentimentScore * 100).toFixed(0)}`}
                value={getSentimentEmoji(trend.sentimentScore)}
                valueStyle={{ fontSize: '18px' }}
              />
            </div>

            <div className="metric-row">
              <div className="progress-metric">
                <span className="metric-label">Virality</span>
                <Progress
                  percent={trend.viralityScore}
                  size="small"
                  strokeColor={getViralityColor(trend.viralityScore)}
                  showInfo={false}
                />
              </div>
              <div className="progress-metric">
                <span className="metric-label">Risk</span>
                <Progress
                  percent={trend.riskScore}
                  size="small"
                  strokeColor={riskLevel.color}
                  showInfo={false}
                />
                <Tag color={riskLevel.color} size="small">{riskLevel.level}</Tag>
              </div>
            </div>
          </div>
        )}

        {/* Social Info */}
        <div className="trend-social-info">
          <div className="social-stats">
            <Tooltip title="Total Mentions">
              <span><EyeOutlined /> {formatVolume(trend.volume24h)}</span>
            </Tooltip>
            <Tooltip title="Social Engagement">
              <span><HeartOutlined /> {trend.engagementRate.toFixed(1)}%</span>
            </Tooltip>
            <Tooltip title="Platform">
              <span>{trend.platform.toUpperCase()}</span>
            </Tooltip>
          </div>

          {trend.expiresAt && (
            <div className="time-remaining">
              <ClockCircleOutlined /> {getTimeRemaining()}
            </div>
          )}
        </div>

        {/* Content Preview */}
        {trend.description && !compact && (
          <div className="trend-description">
            <p>{trend.description.length > 100
              ? `${trend.description.substring(0, 100)}...`
              : trend.description}</p>
          </div>
        )}

        {/* Hashtags */}
        {trend.hashtags.length > 0 && !compact && (
          <div className="trend-hashtags">
            {trend.hashtags.slice(0, 3).map((tag, index) => (
              <Tag key={index} size="small">#{tag}</Tag>
            ))}
            {trend.hashtags.length > 3 && (
              <Tag size="small">+{trend.hashtags.length - 3}</Tag>
            )}
          </div>
        )}

        {/* Author Info */}
        {trend.author && !compact && (
          <div className="trend-author">
            <Avatar size="small" icon={<StarOutlined />} />
            <span className="author-name">{trend.author}</span>
          </div>
        )}

        {/* Risk Alert */}
        {trend.riskScore > 70 && (
          <div className="risk-alert">
            <AlertOutlined style={{ color: '#ff4d4f' }} />
            <span>High Risk Trend</span>
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default TrendCard;