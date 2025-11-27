import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Statistic, Typography, Button, Space, Table, Tag, List, Avatar, Progress, Spin, message, Dropdown, Tooltip, Alert, } from 'antd';
import {
  WalletOutlined, RiseOutlined, FallOutlined, DollarCircleOutlined, ReloadOutlined, EyeOutlined, FireOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined, SearchOutlined, FilterOutlined, BellOutlined, } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import TrendCard from '../../components/trading/TrendCard';
import WalletBalance from '../../components/trading/WalletBalance';
import { walletApi } from '../../services/api/wallet.api';
import { marketsApi } from '../../services/api/markets.api';
import { topicsApi } from '../../services/api/topics.api';

const {Title, Text} = Typography;

interface Position {
  id: string;
  symbol: string;
  type: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  status: 'FILLED' | 'PENDING';
}

interface Topic {
  id: string;
  title: string;
  description: string;
  viralityScore: number;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  category: string;
  engagementMetrics: {
    likes: number;
    shares: number;
    comments: number;
  };
}

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('ZAR');
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  // Fetch wallet balance
  const {data: walletBalance, isLoading: balanceLoading, refetch: refetchBalance} = useQuery(
    ['walletBalance', currency],
    () => walletApi.getBalance(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch trending topics
  const {data: trendingTopics, isLoading: topicsLoading} = useQuery(
    'trendingTopics',
    () => topicsApi.getTrendingTopics(6),
    {
      refetchInterval: 60000, // Refresh every minute
    }
  );

  // Fetch recent trades
  const {data: recentTrades, isLoading: tradesLoading} = useQuery(
    'recentTrades',
    () => walletApi.getRecentTransactions({ limit: 10, type: 'TRADE' }),
    {
      refetchInterval: 30000,
    }
  );

  // Mock data for positions (in real app, this would come from API)
  useEffect(() => {
    const mockPositions: Position[] = [
      {
        id: '1',
        symbol: 'TSLA',
        type: 'LONG',
        size: 100,
        entryPrice: 234.56,
        currentPrice: 245.78,
        pnl: 1122.00,
        pnlPercent: 4.78,
      },
      {
        id: '2',
        symbol: 'GME',
        type: 'LONG',
        size: 500,
        entryPrice: 45.23,
        currentPrice: 42.15,
        pnl: -1540.00,
        pnlPercent: -6.81,
      },
      {
        id: '3',
        symbol: 'AMC',
        type: 'SHORT',
        size: 1000,
        entryPrice: 18.90,
        currentPrice: 16.45,
        pnl: 2450.00,
        pnlPercent: 12.96,
      },
    ];
    setPositions(mockPositions);
  }, []);

  // Mock data for recent trades
  useEffect(() => {
    if (recentTrades) {
      setTrades(recentTrades.slice(0, 10));
    }
  }, [recentTrades]);

  const currencyOptions = [
    { key: 'ZAR', label: 'ZAR (South African Rand)' },
    { key: 'USD', label: 'USD (US Dollar)' },
    { key: 'EUR', label: 'EUR (Euro)' },
  ];

  const tradeColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string) => (
        <Button
          type="link"
          onClick={() => navigate(`/markets/${symbol.toLowerCase()}`)}
          style={{ color: '#FFB300', fontWeight: 'bold' }}
        >
          {symbol}
        </Button>
      ),
    },
    {
      title: 'Side',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'BUY' ? 'green' : 'red'}>
          {side}
        </Tag>
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => quantity.toLocaleString(),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `R${price.toFixed(2)}`,
    },
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ];

  const positionColumns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string) => (
        <Button
          type="link"
          onClick={() => navigate(`/markets/${symbol.toLowerCase()}`)}
          style={{ color: '#FFB300', fontWeight: 'bold' }}
        >
          {symbol}
        </Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'LONG' ? 'green' : 'red'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => size.toLocaleString(),
    },
    {
      title: 'Entry Price',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      render: (price: number) => `R${price.toFixed(2)}`,
    },
    {
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      render: (price: number) => `R${price.toFixed(2)}`,
    },
    {
      title: 'P&L',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (pnl: number, record: Position) => (
        <span style={{ color: pnl >= 0 ? '#52C41A' : '#FF4D4F', fontWeight: 'bold' }}>
          {pnl >= 0 ? '+' : ''}R{pnl.toFixed(2)} ({record.pnlPercent >= 0 ? '+' : ''}{record.pnlPercent.toFixed(2)}%)
        </span>
      ),
    },
  ];

  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent = positions.length > 0
    ? (totalPnL / (positions.reduce((sum, pos) => sum + (pos.entryPrice * pos.size), 0))) * 100
    : 0;

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '32px' }}>
        <Col>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Trading Dashboard
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Welcome back! Here's your trading overview
          </Text>
        </Col>
        <Col>
          <Space>
            <Dropdown
              menu={{ items: currencyOptions, onClick: ({ key }) => setCurrency(key as string) }}
              placement="bottomRight"
            >
              <Button
                icon={<DollarCircleOutlined />}
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                {currency}
              </Button>
            </Dropdown>
            <Tooltip title="Refresh Dashboard">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchBalance();
                }}
              />
            </Tooltip>
          </Space>
        </Col>
      </Row>

      {/* Portfolio Summary */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total Balance</Text>}
              value={walletBalance?.total || 0}
              prefix={<WalletOutlined />}
              precision={2}
              valueStyle={{ color: '#FFB300', fontSize: '24px' }}
              formatter={(value) => `R${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total P&L</Text>}
              value={totalPnL}
              prefix={totalPnL >= 0 ? <RiseOutlined /> : <FallOutlined />}
              precision={2}
              valueStyle={{
                color: totalPnL >= 0 ? '#52C41A' : '#FF4D4F',
                fontSize: '24px'
              }}
              formatter={(value) => `${value >= 0 ? '+' : ''}R${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Active Positions</Text>}
              value={positions.length}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#FFB300', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>24h Change</Text>}
              value={totalPnLPercent}
              prefix={totalPnLPercent >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              precision={2}
              suffix="%"
              valueStyle={{
                color: totalPnLPercent >= 0 ? '#52C41A' : '#FF4D4F',
                fontSize: '24px'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col span={24}>
          <Card
            title={<Text style={{ color: '#FFB300' }}>Quick Actions</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Space size="large" wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/wallet/funding')}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                }}
              >
                Deposit Funds
              </Button>
              <Button
                icon={<WalletOutlined />}
                onClick={() => navigate('/wallet')}
              >
                View Wallet
              </Button>
              <Button
                icon={<FireOutlined />}
                onClick={() => navigate('/markets')}
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                View Markets
              </Button>
              <Button
                icon={<SearchOutlined />}
                onClick={() => navigate('/topics')}
              >
                Explore Topics
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Trending Topics */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>
                  <FireOutlined style={{ marginRight: '8px' }} />
                  Trending Topics
                </Text>
                <Button
                  type="link"
                  onClick={() => navigate('/topics')}
                  style={{ color: '#FFB300' }}
                >
                  View All
                </Button>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            {topicsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : (
              <List
                dataSource={trendingTopics || []}
                renderItem={(topic: Topic) => (
                  <List.Item
                    style={{
                      borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
                      padding: '16px 0',
                    }}
                  >
                    <TrendCard
                      topic={topic}
                      onTrade={() => navigate(`/markets/trade?topic=${topic.id}`)}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Active Positions */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>Active Positions</Text>
                <Button
                  type="link"
                  onClick={() => navigate('/positions')}
                  style={{ color: '#FFB300' }}
                >
                  View All
                </Button>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Table
              dataSource={positions}
              columns={positionColumns}
              pagination={false}
              size="small"
              style={{
                background: 'transparent',
              }}
            />
          </Card>
        </Col>

        {/* Recent Trades */}
        <Col xs={24}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>Recent Trades</Text>
                <Button
                  type="link"
                  onClick={() => navigate('/trading/history')}
                  style={{ color: '#FFB300' }}
                >
                  View All
                </Button>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Table
              dataSource={trades}
              columns={tradeColumns}
              pagination={{ pageSize: 5 }}
              size="small"
              loading={tradesLoading}
            />
          </Card>
        </Col>

        {/* Market Stats */}
        <Col xs={24}>
          <Card
            title={<Text style={{ color: '#FFB300' }}>Market Statistics</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Alert
              message="Real-time Market Updates"
              description="Market data is updated in real-time. Click on any symbol to view detailed information and place trades."
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                    24h Volume
                  </Text>
                  <Text style={{ color: '#FFB300', fontSize: '20px', fontWeight: 'bold' }}>
                    R2.8B
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                    Active Markets
                  </Text>
                  <Text style={{ color: '#FFB300', fontSize: '20px', fontWeight: 'bold' }}>
                    1,247
                  </Text>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                    Trending Symbols
                  </Text>
                  <Text style={{ color: '#FFB300', fontSize: '20px', fontWeight: 'bold' }}>
                    89
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default UserDashboard;