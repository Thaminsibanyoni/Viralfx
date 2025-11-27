import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Progress, List, Typography, Space, Tag, Tooltip } from 'antd';
import {
  TrophyOutlined, FireOutlined, RiseOutlined, FallOutlined, DollarOutlined, BarChartOutlined, ThunderboltOutlined, ClockCircleOutlined, GlobalOutlined, EyeOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';

const {Text, Title} = Typography;

interface MarketStatsProps {
  currency?: string;
  showDetailed?: boolean;
}

interface MarketTrend {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  category: string;
  viralityScore: number;
}

interface MarketMetric {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
  color?: string;
}

const MarketStats: React.FC<MarketStatsProps> = ({
  currency = 'ZAR',
  showDetailed = false
}) => {
  const {marketData} = useWebSocket();
  const [marketMetrics, setMarketMetrics] = useState<MarketMetric[]>([]);
  const [topTrends, setTopTrends] = useState<MarketTrend[]>([]);
  const [marketOverview, setMarketOverview] = useState({
    totalVolume: 0,
    activeTrends: 0,
    totalMarketCap: 0,
    avgVirality: 0
  });

  useEffect(() => {
    generateMarketStats();
  }, [marketData, currency]);

  const _generateMarketStats = () => {
    // Mock market data
    const mockTrends: MarketTrend[] = [
      {
        id: '1',
        symbol: 'VIRAL/SA_MUSIC_001',
        name: 'Amapiano Vibes',
        price: 156.78,
        change: 18.45,
        changePercent: 12.5,
        volume: 1250000,
        category: 'Music',
        viralityScore: 8.7
      },
      {
        id: '2',
        symbol: 'VIRAL/SA_SPORT_001',
        name: 'Springbok Champions',
        price: 234.56,
        change: 17.89,
        changePercent: 8.3,
        volume: 980000,
        category: 'Sports',
        viralityScore: 9.2
      },
      {
        id: '3',
        symbol: 'VIRAL/SA_FASHION_001',
        name: 'Shweshwe Chic',
        price: 178.90,
        change: 24.25,
        changePercent: 15.7,
        volume: 670000,
        category: 'Fashion',
        viralityScore: 7.9
      },
      {
        id: '4',
        symbol: 'VIRAL/SA_TECH_001',
        name: 'SA Tech Innovations',
        price: 298.34,
        change: 54.21,
        changePercent: 22.1,
        volume: 890000,
        category: 'Technology',
        viralityScore: 8.4
      },
      {
        id: '5',
        symbol: 'VIRAL/SA_COMEDY_001',
        name: 'Comedy Gold',
        price: 67.23,
        change: -4.15,
        changePercent: -5.8,
        volume: 1230000,
        category: 'Entertainment',
        viralityScore: 7.2
      }
    ];

    const sortedTrends = mockTrends.sort((a, b) => b.changePercent - a.changePercent);
    setTopTrends(sortedTrends.slice(0, 5));

    // Calculate market overview
    const totalVolume = mockTrends.reduce((sum, trend) => sum + trend.volume, 0);
    const totalMarketCap = mockTrends.reduce((sum, trend) => sum + (trend.price * trend.volume / 1000), 0);
    const avgVirality = mockTrends.reduce((sum, trend) => sum + trend.viralityScore, 0) / mockTrends.length;

    setMarketOverview({
      totalVolume,
      activeTrends: mockTrends.length,
      totalMarketCap,
      avgVirality
    });

    // Generate market metrics
    const metrics: MarketMetric[] = [
      {
        label: 'Market Volume (24h)',
        value: formatCurrency(totalVolume),
        change: 12.5,
        icon: <BarChartOutlined />,
        color: '#9333ea'
      },
      {
        label: 'Active Trends',
        value: mockTrends.length,
        change: 2,
        icon: <ThunderboltOutlined />,
        color: '#f59e0b'
      },
      {
        label: 'Market Cap',
        value: formatCurrency(totalMarketCap),
        change: 8.7,
        icon: <DollarOutlined />,
        color: '#10b981'
      },
      {
        label: 'Avg. Virality Score',
        value: avgVirality.toFixed(1),
        change: 0.3,
        icon: <FireOutlined />,
        color: '#ef4444'
      }
    ];

    setMarketMetrics(metrics);
  };

  const formatCurrency = (amount: number) => {
    const symbols = {
      'ZAR': 'R',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'BTC': '₿',
      'ETH': 'Ξ'
    };
    const symbol = symbols[currency as keyof typeof symbols] || currency;

    if (amount >= 1000000) {
      return `${symbol}${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(1)}K`;
    }
    return `${symbol}${amount.toFixed(0)}`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return '#10b981';
    if (change < 0) return '#ef4444';
    return '#6b7280';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <RiseOutlined />;
    if (change < 0) return <FallOutlined />;
    return <ClockCircleOutlined />;
  };

  const getViralityColor = (score: number) => {
    if (score >= 8) return '#ef4444';
    if (score >= 6) return '#f59e0b';
    if (score >= 4) return '#10b981';
    return '#6b7280';
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'Music': '🎵',
      'Sports': '⚽',
      'Fashion': '👗',
      'Technology': '💻',
      'Entertainment': '🎬',
      'Food': '🍽️'
    };
    return icons[category] || '📊';
  };

  return (
    <div className="market-stats">
      {/* Market Overview */}
      <Card
        title={
          <Space>
            <GlobalOutlined />
            <span>Market Overview</span>
          </Space>
        }
        size="small"
        style={{
          background: '#1a1f2e',
          border: '1px solid #2d3748',
          marginBottom: '16px'
        }}
        bodyStyle={{ padding: '12px' }}
      >
        <Row gutter={[8, 8]}>
          {marketMetrics.map((metric, index) => (
            <Col span={12} key={index}>
              <div style={{ padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ color: metric.color, marginRight: '6px' }}>
                    {metric.icon}
                  </span>
                  <Text style={{ color: '#9ca3af', fontSize: '12px' }}>
                    {metric.label}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Text strong style={{ color: '#fff', fontSize: '14px' }}>
                    {metric.value}
                  </Text>
                  {metric.change !== undefined && (
                    <span style={{ color: getChangeColor(metric.change), fontSize: '12px' }}>
                      {getChangeIcon(metric.change)}
                      {metric.change > 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Top Performing Trends */}
      <Card
        title={
          <Space>
            <TrophyOutlined />
            <span>Top Trends</span>
          </Space>
        }
        size="small"
        style={{
          background: '#1a1f2e',
          border: '1px solid #2d3748',
          marginBottom: '16px'
        }}
        bodyStyle={{ padding: '8px' }}
      >
        <List
          size="small"
          dataSource={topTrends}
          renderItem={(trend, index) => (
            <List.Item style={{ padding: '6px 0', borderBottom: 'none' }}>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '6px', fontSize: '14px' }}>
                      {getCategoryIcon(trend.category)}
                    </span>
                    <div>
                      <Text style={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>
                        {trend.symbol}
                      </Text>
                      <br />
                      <Text style={{ color: '#6b7280', fontSize: '11px' }}>
                        {trend.name}
                      </Text>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#fff', fontSize: '12px' }}>
                      {formatCurrency(trend.price)}
                    </div>
                    <div style={{
                      color: getChangeColor(trend.changePercent),
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end'
                    }}>
                      {getChangeIcon(trend.changePercent)}
                      {trend.changePercent > 0 ? '+' : ''}{trend.changePercent.toFixed(1)}%
                    </div>
                  </div>
                </div>
                {showDetailed && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Progress
                      percent={trend.viralityScore * 10}
                      size="small"
                      strokeColor={getViralityColor(trend.viralityScore)}
                      showInfo={false}
                      style={{ flex: 1, marginRight: '8px' }}
                    />
                    <Tag
                      color={getViralityColor(trend.viralityScore)}
                      style={{ fontSize: '10px', margin: 0 }}
                    >
                      Virality: {trend.viralityScore.toFixed(1)}
                    </Tag>
                  </div>
                )}
              </div>
            </List.Item>
          )}
        />
      </Card>

      {/* Market Sentiment */}
      {showDetailed && (
        <Card
          title={
            <Space>
              <EyeOutlined />
              <span>Market Sentiment</span>
            </Space>
          }
          size="small"
          style={{
            background: '#1a1f2e',
            border: '1px solid #2d3748'
          }}
          bodyStyle={{ padding: '12px' }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <Text style={{ color: '#9ca3af', fontSize: '12px' }}>Overall Sentiment</Text>
              <Text style={{ color: '#10b981', fontSize: '12px' }}>Bullish</Text>
            </div>
            <Progress
              percent={68}
              strokeColor={{
                '0%': '#ef4444',
                '50%': '#f59e0b',
                '100%': '#10b981'
              }}
              size="small"
              showInfo={false}
            />
          </div>

          <Row gutter={8}>
            <Col span={12}>
              <div style={{ textAlign: 'center', padding: '8px', background: '#0a0e1a', borderRadius: '4px' }}>
                <div style={{ color: '#10b981', fontSize: '16px', fontWeight: 'bold' }}>65%</div>
                <div style={{ color: '#9ca3af', fontSize: '11px' }}>Trending Up</div>
              </div>
            </Col>
            <Col span={12}>
              <div style={{ textAlign: 'center', padding: '8px', background: '#0a0e1a', borderRadius: '4px' }}>
                <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 'bold' }}>35%</div>
                <div style={{ color: '#9ca3af', fontSize: '11px' }}>Trending Down</div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default MarketStats;