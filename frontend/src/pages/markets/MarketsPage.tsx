import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Table, Button, Input, Select, Slider, Space, Tag, Typography, Statistic, Progress, Tooltip, message, Switch, Empty, Spin, Pagination, AutoComplete, } from 'antd';
import {
  SearchOutlined, FilterOutlined, RiseOutlined, FallOutlined, FireOutlined, StarOutlined, StarFilled, EyeOutlined, ReloadOutlined, BarChartOutlined, AppstoreOutlined, SortAscendingOutlined, SortDescendingOutlined, HeartOutlined, HeartFilled, ThunderboltOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketsApi } from '../../services/api/markets.api';
import { useSocket } from '../../hooks/useSocket';
import TrendCard from '../../components/trading/TrendCard';
import type { ColumnsType } from 'antd/es/table';
import type { Market, MarketFilters } from '../../types/market';

const {Title, Text} = Typography;
const {Option} = Select;

const MarketsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<MarketFilters>({
    category: undefined,
    priceRange: [0, 10000],
    viralityRange: [0, 100],
    riskLevel: undefined,
    platform: undefined,
    sortBy: 'volume',
    sortOrder: 'desc',
    search: '',
  });

  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Fetch markets
  const {data: markets, isLoading: marketsLoading, refetch: refetchMarkets} = useQuery(
    ['markets', filters],
    () => marketsApi.getMarkets(filters),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
      keepPreviousData: true,
    }
  );

  // Fetch trending markets
  const {data: trendingMarkets} = useQuery(
    'trendingMarkets',
    () => marketsApi.getTrendingMarkets(5),
    {
      refetchInterval: 60000,
    }
  );

  // Watchlist mutations
  const addToWatchlistMutation = useMutation(
    (marketId: string) => marketsApi.addToWatchlist(marketId),
    {
      onSuccess: () => {
        message.success('Added to watchlist');
        queryClient.invalidateQueries('watchlist');
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to add to watchlist');
      },
    }
  );

  const removeFromWatchlistMutation = useMutation(
    (marketId: string) => marketsApi.removeFromWatchlist(marketId),
    {
      onSuccess: () => {
        message.success('Removed from watchlist');
        queryClient.invalidateQueries('watchlist');
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to remove from watchlist');
      },
    }
  );

  // WebSocket for real-time price updates
  useEffect(() => {
    if (!socket) return;

    const handlePriceUpdate = (data: { marketId: string; price: number; change: number }) => {
      queryClient.setQueryData(['markets', filters], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((market: Market) =>
            market.id === data.marketId
              ? { ...market, currentPrice: data.price, priceChange24h: data.change }
              : market
          ),
        };
      });
    };

    const handleViralityUpdate = (data: { marketId: string; viralityScore: number }) => {
      queryClient.setQueryData(['markets', filters], (old: any) => {
        if (!old || !old.data) return old;
        return {
          ...old,
          data: old.data.map((market: Market) =>
            market.id === data.marketId
              ? { ...market, viralityScore: data.viralityScore }
              : market
          ),
        };
      });
    };

    socket.on('price_update', handlePriceUpdate);
    socket.on('virality_update', handleViralityUpdate);

    return () => {
      socket.off('price_update', handlePriceUpdate);
      socket.off('virality_update', handleViralityUpdate);
    };
  }, [socket, filters, queryClient]);

  const filteredMarkets = useMemo(() => {
    if (!markets?.data) return [];

    return markets.data.filter(market => {
      const matchesSearch = !filters.search ||
        market.symbol.toLowerCase().includes(filters.search.toLowerCase()) ||
        market.name.toLowerCase().includes(filters.search.toLowerCase());

      const matchesCategory = !filters.category || market.category === filters.category;
      const matchesPriceRange = market.currentPrice >= filters.priceRange![0] && market.currentPrice <= filters.priceRange![1];
      const matchesViralityRange = market.viralityScore >= filters.viralityRange![0] && market.viralityScore <= filters.viralityRange![1];
      const matchesRiskLevel = !filters.riskLevel || market.riskScore === filters.riskLevel;
      const matchesPlatform = !filters.platform || market.platforms.includes(filters.platform);

      return matchesSearch && matchesCategory && matchesPriceRange && matchesViralityRange && matchesRiskLevel && matchesPlatform;
    });
  }, [markets, filters]);

  const sortedMarkets = useMemo(() => {
    const sorted = [...filteredMarkets];
    const {sortBy, sortOrder} = filters;

    sorted.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'price':
          aValue = a.currentPrice;
          bValue = b.currentPrice;
          break;
        case 'volume':
          aValue = a.volume24h;
          bValue = b.volume24h;
          break;
        case 'change':
          aValue = a.priceChange24h;
          bValue = b.priceChange24h;
          break;
        case 'virality':
          aValue = a.viralityScore;
          bValue = b.viralityScore;
          break;
        case 'risk':
          aValue = a.riskScore;
          bValue = b.riskScore;
          break;
        default:
          aValue = a.volume24h;
          bValue = b.volume24h;
      }

      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return sorted;
  }, [filteredMarkets, filters]);

  const handleSearch = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleSortChange = (sortBy: string) => {
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const toggleWatchlist = (marketId: string) => {
    const market = marketsData?.data.find(m => m.id === marketId);
    const symbol = market?.symbol;
    if (!symbol) return;

    if (watchlist.includes(marketId)) {
      removeFromWatchlistMutation.mutate(symbol);
      setWatchlist(prev => prev.filter(id => id !== marketId));
    } else {
      addToWatchlistMutation.mutate(symbol);
      setWatchlist(prev => [...prev, marketId]);
    }
  };

  const toggleFavorite = (marketId: string) => {
    setFavorites(prev =>
      prev.includes(marketId)
        ? prev.filter(id => id !== marketId)
        : [...prev, marketId]
    );
  };

  const tableColumns: ColumnsType<Market> = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: Market) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            type="text"
            icon={favorites.includes(record.id) ? <StarFilled style={{ color: '#FFB300' }} /> : <StarOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(record.id);
            }}
          />
          <Button
            type="link"
            onClick={() => navigate(`/markets/${symbol.toLowerCase()}`)}
            style={{ color: '#FFB300', fontWeight: 'bold', padding: 0 }}
          >
            {symbol}
          </Button>
        </div>
      ),
      sorter: false,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Text style={{ color: '#B8BCC8' }}>{name}</Text>
      ),
      sorter: false,
    },
    {
      title: 'Price',
      dataIndex: 'currentPrice',
      key: 'price',
      render: (price: number) => (
        <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>
          R{price.toLocaleString()}
        </Text>
      ),
      sorter: false,
    },
    {
      title: '24h Change',
      dataIndex: 'priceChange24h',
      key: 'change',
      render: (change: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {change >= 0 ? <RiseOutlined style={{ color: '#52C41A' }} /> : <FallOutlined style={{ color: '#FF4D4F' }} />}
          <Text style={{ color: change >= 0 ? '#52C41A' : '#FF4D4F', fontWeight: 'bold' }}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </Text>
        </div>
      ),
      sorter: false,
    },
    {
      title: 'Volume',
      dataIndex: 'volume24h',
      key: 'volume',
      render: (volume: number) => (
        <Text style={{ color: '#B8BCC8' }}>
          R{(volume / 1000000).toFixed(1)}M
        </Text>
      ),
      sorter: false,
    },
    {
      title: 'Virality',
      dataIndex: 'viralityScore',
      key: 'virality',
      render: (score: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Progress
            percent={score}
            size="small"
            strokeColor={score >= 70 ? '#52C41A' : score >= 40 ? '#FFB300' : '#FF4D4F'}
            style={{ width: '60px' }}
            showInfo={false}
          />
          <Text style={{ color: '#FFB300', fontSize: '12px' }}>{score}%</Text>
        </div>
      ),
      sorter: false,
    },
    {
      title: 'Risk',
      dataIndex: 'riskScore',
      key: 'risk',
      render: (risk: string) => (
        <Tag
          color={
            risk === 'LOW' ? 'green' :
            risk === 'MEDIUM' ? 'orange' :
            risk === 'HIGH' ? 'red' : 'purple'
          }
        >
          {risk}
        </Tag>
      ),
      sorter: false,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Market) => (
        <Space>
          <Button
            type="link"
            icon={watchlist.includes(record.id) ? <EyeOutlined style={{ color: '#FFB300' }} /> : <EyeOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              toggleWatchlist(record.id);
            }}
          >
            {watchlist.includes(record.id) ? 'Watching' : 'Watch'}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={() => navigate(`/markets/${record.symbol.toLowerCase()}?action=trade`)}
            style={{
              background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
              border: 'none',
            }}
          >
            Trade
          </Button>
        </Space>
      ),
      sorter: false,
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '32px' }}>
        <Col>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Markets
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Discover and trade viral market trends
          </Text>
        </Col>
        <Col>
          <Space>
            <Tooltip title="Refresh markets">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchMarkets()}
                loading={marketsLoading}
              />
            </Tooltip>
            <Switch
              checkedChildren={<BarChartOutlined />}
              unCheckedChildren={<AppstoreOutlined />}
              checked={viewMode === 'table'}
              onChange={(checked) => setViewMode(checked ? 'table' : 'grid')}
            />
          </Space>
        </Col>
      </Row>

      {/* Market Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Total Markets</Text>}
              value={markets?.total || 0}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#FFB300', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>24h Volume</Text>}
              value={sortedMarkets.reduce((sum, market) => sum + market.volume24h, 0)}
              prefix={<ThunderboltOutlined />}
              precision={0}
              valueStyle={{ color: '#52C41A', fontSize: '24px' }}
              formatter={(value) => `R${(Number(value) / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Top Gainer</Text>}
              value={sortedMarkets.length > 0 ? Math.max(...sortedMarkets.map(m => m.priceChange24h)) : 0}
              prefix={<RiseOutlined />}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#52C41A', fontSize: '24px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Top Loser</Text>}
              value={sortedMarkets.length > 0 ? Math.min(...sortedMarkets.map(m => m.priceChange24h)) : 0}
              prefix={<FallOutlined />}
              precision={2}
              suffix="%"
              valueStyle={{ color: '#FF4D4F', fontSize: '24px' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Filters Sidebar */}
        <Col xs={24} lg={6}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FilterOutlined />
                <Text style={{ color: '#FFB300' }}>Filters</Text>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
              height: 'fit-content',
            }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Category
                </Text>
                <Select
                  value={filters.category}
                  onChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="MUSIC">Music</Option>
                  <Option value="SPORTS">Sports</Option>
                  <Option value="TECH">Technology</Option>
                  <Option value="FASHION">Fashion</Option>
                  <Option value="FOOD">Food</Option>
                  <Option value="ENTERTAINMENT">Entertainment</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Price Range: R{filters.priceRange![0]} - R{filters.priceRange![1]}
                </Text>
                <Slider
                  range
                  value={filters.priceRange}
                  onChange={(value) => setFilters(prev => ({ ...prev, priceRange: value }))}
                  min={0}
                  max={10000}
                  trackStyle={{ backgroundColor: '#FFB300' }}
                  handleStyle={{ borderColor: '#FFB300' }}
                />
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Virality Range: {filters.viralityRange![0]}% - {filters.viralityRange![1]}%
                </Text>
                <Slider
                  range
                  value={filters.viralityRange}
                  onChange={(value) => setFilters(prev => ({ ...prev, viralityRange: value }))}
                  min={0}
                  max={100}
                  trackStyle={{ backgroundColor: '#FFB300' }}
                  handleStyle={{ borderColor: '#FFB300' }}
                />
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Risk Level
                </Text>
                <Select
                  value={filters.riskLevel}
                  onChange={(value) => setFilters(prev => ({ ...prev, riskLevel: value }))}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="LOW">Low</Option>
                  <Option value="MEDIUM">Medium</Option>
                  <Option value="HIGH">High</Option>
                  <Option value="EXTREME">Extreme</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                  Platform
                </Text>
                <Select
                  value={filters.platform}
                  onChange={(value) => setFilters(prev => ({ ...prev, platform: value }))}
                  style={{ width: '100%' }}
                  allowClear
                >
                  <Option value="TWITTER">Twitter</Option>
                  <Option value="TIKTOK">TikTok</Option>
                  <Option value="INSTAGRAM">Instagram</Option>
                  <Option value="YOUTUBE">YouTube</Option>
                </Select>
              </div>
            </Space>
          </Card>

          {/* Trending Now */}
          {trendingMarkets && trendingMarkets.length > 0 && (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FireOutlined style={{ color: '#FF4D4F' }} />
                  <Text style={{ color: '#FFB300' }}>Trending Now</Text>
                </div>
              }
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                height: 'fit-content',
                marginTop: '24px',
              }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {trendingMarkets.map((market: Market, index: number) => (
                  <div
                    key={market.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => navigate(`/markets/${market.symbol.toLowerCase()}`)}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      {index + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>{market.symbol}</Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RiseOutlined style={{ color: '#52C41A', fontSize: '12px' }} />
                        <Text style={{ color: '#52C41A', fontSize: '12px' }}>
                          +{market.priceChange24h.toFixed(2)}%
                        </Text>
                      </div>
                    </div>
                  </div>
                ))}
              </Space>
            </Card>
          )}
        </Col>

        {/* Markets Content */}
        <Col xs={24} lg={18}>
          {/* Search and Sort */}
          <div style={{ marginBottom: '24px' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12}>
                <AutoComplete
                  style={{ width: '100%' }}
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSelect={handleSearch}
                  options={sortedMarkets.map(market => ({
                    value: market.symbol,
                    label: (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{market.symbol} - {market.name}</span>
                        <span style={{ color: market.priceChange24h >= 0 ? '#52C41A' : '#FF4D4F' }}>
                          {market.priceChange24h >= 0 ? '+' : ''}{market.priceChange24h.toFixed(2)}%
                        </span>
                      </div>
                    ),
                  }))}
                >
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Search markets..."
                    style={{
                      background: '#1A1A1C',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  />
                </AutoComplete>
              </Col>
              <Col xs={24} sm={12}>
                <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Select
                    value={filters.sortBy}
                    onChange={handleSortChange}
                    style={{ width: 120 }}
                  >
                    <Option value="volume">Volume</Option>
                    <Option value="price">Price</Option>
                    <Option value="change">Change</Option>
                    <Option value="virality">Virality</Option>
                    <Option value="risk">Risk</Option>
                  </Select>
                  <Button
                    icon={filters.sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                    onClick={() => setFilters(prev => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc' }))}
                  />
                </Space>
              </Col>
            </Row>
          </div>

          {/* Markets Display */}
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            {marketsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : sortedMarkets.length === 0 ? (
              <Empty
                description={
                  <Text style={{ color: '#B8BCC8' }}>
                    No markets found matching your criteria
                  </Text>
                }
              />
            ) : viewMode === 'table' ? (
              <Table
                columns={tableColumns}
                dataSource={sortedMarkets}
                pagination={{
                  total: sortedMarkets.length,
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} markets`,
                }}
                rowKey="id"
                onRow={(record) => ({
                  onClick: () => navigate(`/markets/${record.symbol.toLowerCase()}`),
                  style: { cursor: 'pointer' },
                })}
              />
            ) : (
              <Row gutter={[16, 16]}>
                {sortedMarkets.map((market: Market) => (
                  <Col xs={24} sm={12} lg={8} key={market.id}>
                    <TrendCard
                      market={market}
                      onTrade={() => navigate(`/markets/${market.symbol.toLowerCase()}?action=trade`)}
                      onWatch={() => toggleWatchlist(market.id)}
                      isWatching={watchlist.includes(market.id)}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MarketsPage;