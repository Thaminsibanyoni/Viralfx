import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Tabs, Button, Space, Typography, Alert, Spin, Badge, Statistic, Avatar, List, Progress, Divider } from 'antd';
import {
  ThunderboltOutlined, WalletOutlined, HistoryOutlined, RiseOutlined, SettingOutlined, BellOutlined, SyncOutlined, EyeOutlined, EyeInvisibleOutlined, FireOutlined, ArrowUpOutlined, ArrowDownOutlined, TrophyOutlined, RiseOutlined, FallOutlined, StarOutlined, ClockCircleOutlined, MenuOutlined, UserOutlined, SearchOutlined, DashboardOutlined, BarChartOutlined, MessageOutlined
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import TrendCard from '../components/trading/TrendCard';
import TradingInterface from '../components/trading/TradingInterface';
import OrderBook from '../components/trading/OrderBook';
import TradeHistory from '../components/trading/TradeHistory';
import WalletBalance from '../components/trading/WalletBalance';
import Search from '../components/ui/Search';
import TrendChart from '../components/trading/TrendChart';
import MarketStats from '../components/trading/MarketStats';

const {Header, Content, Sider} = Layout;
const {Title, Text} = Typography;
const {TabPane} = Tabs;

interface TrendData {
  id: string;
  symbol: string;
  name: string;
  category: string;
  price: number;
  volume: number;
  change: number;
  viralityScore: number;
  description: string;
  platforms: string[];
  lastUpdate: string;
}

const TradingDashboard: React.FC = () => {
  const {user} = useAuth();
  const {connectionStatus, marketData, walletData, notifications, subscribeToMarkets, subscribeToWallets, subscribeToOrders} = useWebSocket();

  const [selectedTrend, setSelectedTrend] = useState<TrendData | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('ZAR');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Subscribe to real-time data
    if (user?.id) {
      subscribeToMarkets();
      subscribeToWallets(user.id);
      subscribeToOrders(user.id);
    }

    // Load initial trends
    loadTrends();
  }, [user, subscribeToMarkets, subscribeToWallets, subscribeToOrders]);

  const loadTrends = async () => {
    // Mock trend data - would come from API
    const mockTrends: TrendData[] = [
      {
        id: '1',
        symbol: 'VIRAL/SA_MUSIC_001',
        name: 'Amapiano Vibes',
        category: 'Music',
        price: 156.78,
        volume: 1250000,
        change: 12.5,
        viralityScore: 8.7,
        description: 'South African Amapiano music trending globally',
        platforms: ['TikTok', 'YouTube', 'Twitter'],
        lastUpdate: new Date().toISOString()
      },
      {
        id: '2',
        symbol: 'VIRAL/SA_SPORT_001',
        name: 'Springbok Champions',
        category: 'Sports',
        price: 234.56,
        volume: 980000,
        change: 8.3,
        viralityScore: 9.2,
        description: 'Springboks Rugby World Cup celebration trends',
        platforms: ['Twitter', 'Instagram', 'Facebook'],
        lastUpdate: new Date().toISOString()
      },
      {
        id: '3',
        symbol: 'VIRAL/SA_FOOD_001',
        name: 'Braai Master',
        category: 'Food',
        price: 89.45,
        volume: 450000,
        change: -3.2,
        viralityScore: 6.8,
        description: 'Traditional South African braai techniques trending',
        platforms: ['TikTok', 'Instagram', 'YouTube'],
        lastUpdate: new Date().toISOString()
      },
      {
        id: '4',
        symbol: 'VIRAL/SA_FASHION_001',
        name: 'Shweshwe Chic',
        category: 'Fashion',
        price: 178.90,
        volume: 670000,
        change: 15.7,
        viralityScore: 7.9,
        description: 'Traditional Shweshwe fabric modern fashion',
        platforms: ['Instagram', 'Pinterest', 'TikTok'],
        lastUpdate: new Date().toISOString()
      },
      {
        id: '5',
        symbol: 'VIRAL/SA_TECH_001',
        name: 'SA Tech Innovations',
        category: 'Technology',
        price: 298.34,
        volume: 890000,
        change: 22.1,
        viralityScore: 8.4,
        description: 'South African tech startups gaining attention',
        platforms: ['Twitter', 'LinkedIn', 'TechCrunch'],
        lastUpdate: new Date().toISOString()
      },
      {
        id: '6',
        symbol: 'VIRAL/SA_COMEDY_001',
        name: 'Comedy Gold',
        category: 'Entertainment',
        price: 67.23,
        volume: 1230000,
        change: -5.8,
        viralityScore: 7.2,
        description: 'South African comedy sketches going viral',
        platforms: ['YouTube', 'TikTok', 'Facebook'],
        lastUpdate: new Date().toISOString()
      }
    ];

    setTrends(mockTrends);
    if (mockTrends.length > 0) {
      setSelectedTrend(mockTrends[0]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTrends();
      // Refresh other data as needed
    } finally {
      setRefreshing(false);
    }
  };

  const handleTrendSelect = (trend: TrendData) => {
    setSelectedTrend(trend);
  };

  const handleSearch = (value: string) => {
    // Implement search functionality
    console.log('Searching for:', value);
  };

  const _formatCurrency = (amount: number, currency: string = 'ZAR') => {
    const symbols = {
      'ZAR': 'R',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'BTC': '₿',
      'ETH': 'Ξ'
    };
    return `${symbols[currency as keyof typeof symbols] || currency} ${amount.toFixed(2)}`;
  };

  const getConnectionStatusBadge = () => {
    const statusConfig = {
      connecting: { status: 'warning' as const, text: 'Connecting...' },
      connected: { status: 'success' as const, text: 'Connected' },
      disconnected: { status: 'error' as const, text: 'Disconnected' },
      error: { status: 'error' as const, text: 'Error' }
    };

    const config = statusConfig[connectionStatus] || statusConfig.disconnected;
    return <Badge status={config.status} text={config.text} />;
  };

  // Enhanced color scheme for better visual hierarchy
  const colorScheme = {
    background: '#0a0e1a',
    surface: '#1a1f2e',
    surfaceLight: '#252b3d',
    border: '#2d3748',
    primary: '#9333ea',
    primaryLight: '#a855f7',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    text: '#ffffff',
    textSecondary: '#9ca3af',
    textMuted: '#6b7280'
  };

  const renderTopHeader = () => (
    <div style={{
      background: colorScheme.surface,
      padding: '12px 24px',
      borderBottom: `1px solid ${colorScheme.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      {/* Logo and Brand */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ color: colorScheme.text, marginRight: '16px' }}
          className="mobile-menu-button"
        />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: `linear-gradient(135deg, ${colorScheme.primary}, ${colorScheme.primaryLight})`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <ThunderboltOutlined style={{ color: 'white', fontSize: '20px' }} />
          </div>
          <div>
            <Title level={4} style={{ margin: 0, color: colorScheme.text, fontSize: '18px' }}>
              ViralFX
            </Title>
            <Text style={{ color: colorScheme.textSecondary, fontSize: '12px' }}>
              {getConnectionStatusBadge()}
            </Text>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mobile-hidden" style={{ flex: 1, maxWidth: '500px', margin: '0 32px' }}>
        <Search
          placeholder="Search trends, symbols, or orders..."
          onSearch={handleSearch}
          style={{ width: '100%' }}
        />
      </div>

      {/* User Actions */}
      <Space size="middle">
        <Button
          icon={showBalance ? <EyeOutlined /> : <EyeInvisibleOutlined />}
          onClick={() => setShowBalance(!showBalance)}
          type="text"
          style={{ color: colorScheme.textSecondary }}
        />
        <Button
          icon={<SyncOutlined />}
          onClick={handleRefresh}
          loading={refreshing}
          type="text"
          style={{ color: colorScheme.textSecondary }}
        />
        <Button
          icon={<BellOutlined />}
          type="text"
          style={{ color: colorScheme.textSecondary }}
        >
          {notifications.length > 0 && (
            <Badge count={notifications.length} size="small" style={{ backgroundColor: colorScheme.danger }} />
          )}
        </Button>
        <Button
          icon={<SettingOutlined />}
          type="text"
          style={{ color: colorScheme.textSecondary }}
        />
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '16px' }}>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: colorScheme.primary }} />
          <Text style={{ color: colorScheme.text, marginLeft: '8px' }}>
            {user?.firstName} {user?.lastName}
          </Text>
        </div>
      </Space>
    </div>
  );

  const renderNavigation = () => (
    <div style={{
      background: colorScheme.surfaceLight,
      padding: '0 24px',
      borderBottom: `1px solid ${colorScheme.border}`,
      display: 'flex',
      alignItems: 'center'
    }}>
      <Space size="large">
        {[
          { key: 'overview', icon: <DashboardOutlined />, label: 'Overview' },
          { key: 'markets', icon: <RiseOutlined />, label: 'Markets' },
          { key: 'portfolio', icon: <BarChartOutlined />, label: 'Portfolio' },
          { key: 'trading', icon: <ThunderboltOutlined />, label: 'Trading' },
          { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
          { key: 'history', icon: <HistoryOutlined />, label: 'History' },
        ].map(item => (
          <Button
            key={item.key}
            type="text"
            icon={item.icon}
            onClick={() => setActiveTab(item.key)}
            style={{
              color: activeTab === item.key ? colorScheme.primary : colorScheme.textSecondary,
              backgroundColor: activeTab === item.key ? `${colorScheme.primary}20` : 'transparent',
              borderRadius: '6px',
              height: '36px',
              fontWeight: activeTab === item.key ? 600 : 400
            }}
          >
            {item.label}
          </Button>
        ))}
      </Space>
    </div>
  );

  const renderLeftSidebar = () => (
    <Sider
      width={280}
      collapsed={sidebarCollapsed}
      collapsedWidth={0}
      onCollapse={setSidebarCollapsed}
      style={{
        background: colorScheme.surface,
        borderRight: `1px solid ${colorScheme.border}`,
        overflow: 'auto',
        height: 'calc(100vh - 112px)',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ padding: '16px' }}>
        <WalletBalance
          selectedCurrency={selectedCurrency}
          onCurrencyChange={setSelectedCurrency}
        />
      </div>

      <Divider style={{ borderColor: colorScheme.border, margin: '0 16px' }} />

      {/* Quick Stats */}
      <div style={{ padding: '16px' }}>
        <Title level={5} style={{ color: colorScheme.text, margin: '0 0 16px 0' }}>
          Quick Stats
        </Title>
        <Row gutter={[8, 8]}>
          <Col span={12}>
            <Card size="small" style={{ background: colorScheme.surfaceLight, border: `1px solid ${colorScheme.border}` }}>
              <Statistic
                title="24h Volume"
                value={1250000}
                formatter={(value) => `${(value as number / 1000000).toFixed(1)}M`}
                valueStyle={{ color: colorScheme.text, fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" style={{ background: colorScheme.surfaceLight, border: `1px solid ${colorScheme.border}` }}>
              <Statistic
                title="Active Trends"
                value={trends.filter(t => t.change > 0).length}
                valueStyle={{ color: colorScheme.success, fontSize: '16px' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Divider style={{ borderColor: colorScheme.border, margin: '0 16px' }} />

      {/* Market Stats */}
      <div style={{ padding: '16px' }}>
        <MarketStats currency={selectedCurrency} />
      </div>
    </Sider>
  );

  const renderRightSidebar = () => {
    // Calculate market movers
    const topGainers = [...trends]
      .filter(t => t.change > 0)
      .sort((a, b) => b.change - a.change)
      .slice(0, 5);

    const topLosers = [...trends]
      .filter(t => t.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 5);

    return (
      <Sider
        width={280}
        className="mobile-hidden"
        style={{
          background: colorScheme.surface,
          borderLeft: `1px solid ${colorScheme.border}`,
          overflow: 'auto',
          height: 'calc(100vh - 112px)',
        }}
      >
        {/* Market Movers - Gainers */}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <TrophyOutlined style={{ color: colorScheme.success, marginRight: '8px' }} />
            <Title level={5} style={{ color: colorScheme.text, margin: 0 }}>
              Top Gainers
            </Title>
          </div>
          <List
            size="small"
            dataSource={topGainers}
            renderItem={(trend) => (
              <List.Item style={{ padding: '8px 0', borderBottom: `1px solid ${colorScheme.border}` }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text style={{ color: colorScheme.text, fontSize: '12px', fontWeight: 500 }}>
                        {trend.name}
                      </Text>
                      <br />
                      <Text style={{ color: colorScheme.textMuted, fontSize: '10px' }}>
                        {trend.symbol}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: colorScheme.success, fontSize: '12px', fontWeight: 600 }}>
                        <RiseOutlined /> +{trend.change.toFixed(1)}%
                      </div>
                      <div style={{ color: colorScheme.textSecondary, fontSize: '10px' }}>
                        R{trend.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>

        <Divider style={{ borderColor: colorScheme.border, margin: '0' }} />

        {/* Market Movers - Losers */}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <FireOutlined style={{ color: colorScheme.danger, marginRight: '8px' }} />
            <Title level={5} style={{ color: colorScheme.text, margin: 0 }}>
              Top Losers
            </Title>
          </div>
          <List
            size="small"
            dataSource={topLosers}
            renderItem={(trend) => (
              <List.Item style={{ padding: '8px 0', borderBottom: `1px solid ${colorScheme.border}` }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text style={{ color: colorScheme.text, fontSize: '12px', fontWeight: 500 }}>
                        {trend.name}
                      </Text>
                      <br />
                      <Text style={{ color: colorScheme.textMuted, fontSize: '10px' }}>
                        {trend.symbol}
                      </Text>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: colorScheme.danger, fontSize: '12px', fontWeight: 600 }}>
                        <FallOutlined /> {trend.change.toFixed(1)}%
                      </div>
                      <div style={{ color: colorScheme.textSecondary, fontSize: '10px' }}>
                        R{trend.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>

        <Divider style={{ borderColor: colorScheme.border, margin: '0' }} />

        {/* Trending Now */}
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <StarOutlined style={{ color: colorScheme.warning, marginRight: '8px' }} />
            <Title level={5} style={{ color: colorScheme.text, margin: 0 }}>
              Trending Now
            </Title>
          </div>
          <List
            size="small"
            dataSource={[...trends].sort((a, b) => b.viralityScore - a.viralityScore).slice(0, 3)}
            renderItem={(trend) => (
              <List.Item style={{ padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: colorScheme.text, fontSize: '12px', fontWeight: 500 }}>
                        {trend.name}
                      </Text>
                      <Progress
                        percent={trend.viralityScore * 10}
                        size="small"
                        strokeColor={colorScheme.warning}
                        showInfo={false}
                        style={{ marginTop: '4px' }}
                      />
                    </div>
                    <Badge count={Math.round(trend.viralityScore)} style={{ backgroundColor: colorScheme.warning }} />
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Sider>
    );
  };

  return (
    <>
      <style>
        {`
          .trading-dashboard .mobile-menu-button {
            display: block !important;
          }

          @media (max-width: 768px) {
            .trading-dashboard .ant-layout-sider {
              position: fixed !important;
              z-index: 999;
              height: 100vh !important;
            }

            .trading-dashboard .ant-layout-content {
              margin-left: 0 !important;
              margin-right: 0 !important;
            }

            .trading-dashboard .mobile-hidden {
              display: none !important;
            }

            .trading-dashboard .mobile-full-width {
              width: 100% !important;
              max-width: none !important;
              margin: 0 !important;
            }
          }

          @media (max-width: 576px) {
            .trading-dashboard .ant-col {
              margin-bottom: 16px;
            }
          }
        `}
      </style>

      <Layout className="trading-dashboard" style={{ minHeight: '100vh', background: colorScheme.background }}>
        {renderTopHeader()}
        {renderNavigation()}

        <Layout>
          {renderLeftSidebar()}

          {/* Main Content */}
          <Content style={{
            padding: '24px',
            overflow: 'auto',
            background: colorScheme.background,
            minHeight: 'calc(100vh - 112px)',
            transition: 'all 0.2s'
          }}>
          {activeTab === 'overview' && (
            <div>
              <Alert
                message="Real-Time Trading Dashboard"
                description="All prices and data are updated in real-time using ZAR as the primary currency."
                type="info"
                showIcon
                style={{ marginBottom: '24px', background: `${colorScheme.primary}20`, border: `1px solid ${colorScheme.primary}50` }}
              />

              <Row gutter={[16, 16]}>
                {trends.map(trend => (
                  <Col xs={24} sm={12} lg={8} xl={6} key={trend.id}>
                    <TrendCard
                      trend={{
                        id: trend.id,
                        symbol: trend.symbol,
                        name: trend.name,
                        category: trend.category,
                        currentPrice: trend.price,
                        priceChange24h: trend.change,
                        volume24h: trend.volume,
                        viralityScore: trend.viralityScore * 10,
                        engagementRate: Math.random() * 100,
                        sentimentScore: Math.random() * 2 - 1,
                        riskScore: Math.random() * 100,
                        description: trend.description,
                        author: 'Various',
                        platform: trend.platforms[0],
                        hashtags: [],
                        mediaUrls: [],
                        isActive: true
                      }}
                      onSelect={handleTrendSelect}
                      selected={selectedTrend?.id === trend.id}
                      currency={selectedCurrency}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          )}

          {activeTab === 'trading' && (
            selectedTrend ? (
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                  <Card
                    title={`Trade ${selectedTrend.symbol}`}
                    style={{
                      background: colorScheme.surface,
                      border: `1px solid ${colorScheme.border}`,
                      borderRadius: '8px'
                    }}
                    bodyStyle={{ padding: 0 }}
                  >
                    <TrendChart trendId={selectedTrend.id} />
                  </Card>

                  <Card
                    title="Order Book"
                    style={{
                      marginTop: '16px',
                      background: colorScheme.surface,
                      border: `1px solid ${colorScheme.border}`,
                      borderRadius: '8px'
                    }}
                  >
                    <OrderBook trendId={selectedTrend.id} />
                  </Card>
                </Col>

                <Col xs={24} lg={8}>
                  <TradingInterface
                    trend={{
                      id: selectedTrend.id,
                      symbol: selectedTrend.symbol,
                      name: selectedTrend.name,
                      category: selectedTrend.category,
                      currentPrice: selectedTrend.price,
                      priceChange24h: selectedTrend.change,
                      volume24h: selectedTrend.volume,
                      viralityScore: selectedTrend.viralityScore * 10,
                      engagementRate: Math.random() * 100,
                      sentimentScore: Math.random() * 2 - 1,
                      riskScore: Math.random() * 100,
                      description: selectedTrend.description,
                      author: 'Various',
                      platform: selectedTrend.platforms[0],
                      hashtags: [],
                      mediaUrls: [],
                      isActive: true
                    }}
                    onTradeSuccess={(trade) => {
                      console.log('Trade successful:', trade);
                    }}
                  />
                </Col>
              </Row>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '100px',
                background: colorScheme.surface,
                borderRadius: '8px',
                border: `1px solid ${colorScheme.border}`
              }}>
                <Title level={4} style={{ color: colorScheme.text }}>Select a Trend to Start Trading</Title>
                <Text style={{ color: colorScheme.textSecondary }}>
                  Choose from the overview to begin trading on viral trends
                </Text>
              </div>
            )
          )}

          {activeTab === 'history' && (
            <div style={{
              background: colorScheme.surface,
              borderRadius: '8px',
              border: `1px solid ${colorScheme.border}`,
              padding: '24px'
            }}>
              <TradeHistory userId={user?.id} />
            </div>
          )}

          {activeTab === 'markets' && (
            <div style={{
              textAlign: 'center',
              padding: '100px',
              background: colorScheme.surface,
              borderRadius: '8px',
              border: `1px solid ${colorScheme.border}`
            }}>
              <RiseOutlined style={{ fontSize: '64px', color: colorScheme.primary, marginBottom: '24px' }} />
              <Title level={4} style={{ color: colorScheme.text }}>Markets Overview</Title>
              <Text style={{ color: colorScheme.textSecondary }}>
                Comprehensive market analysis and insights coming soon
              </Text>
            </div>
          )}

          {activeTab === 'portfolio' && (
            <div style={{
              textAlign: 'center',
              padding: '100px',
              background: colorScheme.surface,
              borderRadius: '8px',
              border: `1px solid ${colorScheme.border}`
            }}>
              <BarChartOutlined style={{ fontSize: '64px', color: colorScheme.primary, marginBottom: '24px' }} />
              <Title level={4} style={{ color: colorScheme.text }}>Portfolio Management</Title>
              <Text style={{ color: colorScheme.textSecondary }}>
                Track your portfolio performance and analytics
              </Text>
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{
              textAlign: 'center',
              padding: '100px',
              background: colorScheme.surface,
              borderRadius: '8px',
              border: `1px solid ${colorScheme.border}`
            }}>
              <MessageOutlined style={{ fontSize: '64px', color: colorScheme.primary, marginBottom: '24px' }} />
              <Title level={4} style={{ color: colorScheme.text }}>Trading Community</Title>
              <Text style={{ color: colorScheme.textSecondary }}>
                Connect with other traders and share insights
              </Text>
            </div>
          )}
        </Content>

        {renderRightSidebar()}
      </Layout>
      </Layout>
    </>
  );
};

export default TradingDashboard;