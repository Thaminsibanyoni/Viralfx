import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Spin, Alert } from 'antd';
import { TikTokOutlined, TwitterOutlined, InstagramOutlined, YoutubeOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import oracleApi from '../../services/api/oracle.api';

const { Text, Title } = Typography;

interface TrendData {
  platform: string;
  content: string;
  engagement: number;
  trendScore: number;
  timestamp: string;
}

const LiveTrendingMarkets: React.FC = () => {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrends = async () => {
    try {
      setError(null);
      const data = await oracleApi.getSouthAfricanTrends();
      setTrends(data.slice(0, 5));
    } catch (err) {
      setError('Failed to fetch trending markets');
      console.error('Error fetching trends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'tiktok':
        return <TikTokOutlined style={{ fontSize: '24px', color: '#FF0050' }} />;
      case 'twitter':
      case 'x':
        return <TwitterOutlined style={{ fontSize: '24px', color: '#1DA1F2' }} />;
      case 'instagram':
        return <InstagramOutlined style={{ fontSize: '24px', color: '#E4405F' }} />;
      case 'youtube':
        return <YoutubeOutlined style={{ fontSize: '24px', color: '#FF0000' }} />;
      default:
        return <TwitterOutlined style={{ fontSize: '24px', color: '#888' }} />;
    }
  };

  const formatEngagement = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <Text style={{ color: '#B8BCC8', display: 'block', marginTop: '16px' }}>Loading live trends...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Unable to load trending markets"
        description={error}
        type="error"
        showIcon
        style={{ marginBottom: '24px' }}
      />
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <Row gutter={[16, 16]}>
        {trends.map((trend, index) => (
          <Col xs={24} sm={12} md={8} lg={4.8} key={index}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card
                style={{
                  background: 'linear-gradient(135deg, rgba(26, 26, 28, 0.9) 0%, rgba(20, 20, 22, 0.9) 100%)',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  borderRadius: '12px',
                  height: '100%',
                  transition: 'all 0.3s ease',
                }}
                hoverable
                bodyStyle={{ padding: '20px' }}
              >
                <div style={{ marginBottom: '12px' }}>
                  {getPlatformIcon(trend.platform)}
                </div>
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: '12px',
                    minHeight: '48px',
                  }}
                >
                  {trend.content.length > 50 ? trend.content.substring(0, 50) + '...' : trend.content}
                </Text>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text style={{ color: '#B8BCC8', fontSize: '12px', display: 'block' }}>
                      Engagement
                    </Text>
                    <Text style={{ color: '#FFB300', fontSize: '14px', fontWeight: 600 }}>
                      {formatEngagement(trend.engagement)}
                    </Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Text style={{ color: '#B8BCC8', fontSize: '12px', display: 'block' }}>
                      Trend Score
                    </Text>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <ArrowUpOutlined style={{ color: '#52C41A', fontSize: '12px', marginRight: '4px' }} />
                      <Text style={{ color: '#52C41A', fontSize: '14px', fontWeight: 600 }}>
                        {trend.trendScore.toFixed(1)}%
                      </Text>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default LiveTrendingMarkets;
