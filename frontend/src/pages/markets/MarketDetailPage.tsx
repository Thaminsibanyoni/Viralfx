import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Statistic, Button, Space, Tag, Table, Tabs, InputNumber, Select, Progress, Tooltip, Alert, message, Divider, List, Avatar, Badge, Switch, Dropdown, MenuProps, } from 'antd';
import {
  RiseOutlined, FallOutlined, StarOutlined, StarFilled, HeartOutlined, HeartFilled, EyeOutlined, BellOutlined, ShareAltOutlined, FullscreenOutlined, ReloadOutlined, InfoCircleOutlined, WarningOutlined, ThunderboltOutlined, FireOutlined, DollarCircleOutlined, BarChartOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketsApi } from '../../services/api/markets.api';
import { useSocket } from '../../hooks/useSocket';
import PriceChart from '../../components/trading/PriceChart';
import OrderBook from '../../components/trading/OrderBook';
import TradingInterface from '../../components/trading/TradingInterface';
import TradeHistory from '../../components/trading/TradeHistory';
import type { Market, OrderBookEntry, Trade } from '../../types/market';

const {Title, Text} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;

const MarketDetailPage: React.FC = () => {
  const {symbol} = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const socket = useSocket();

  const [chartTimeframe, setChartTimeframe] = useState('1D');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'STOP'>('MARKET');
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const chartRef = useRef<any>(null);

  const action = new URLSearchParams(location.search).get('action');

  // Fetch market data
  const {data: market, isLoading: marketLoading, refetch: refetchMarket} = useQuery(
    ['market', symbol],
    () => marketsApi.getMarket(symbol!),
    {
      enabled: !!symbol,
      refetchInterval: 30000,
    }
  );

  // Fetch order book
  const {data: orderBook} = useQuery(
    ['orderBook', symbol],
    () => marketsApi.getMarketOrderBook(symbol!),
    {
      enabled: !!symbol,
      refetchInterval: 1000,
    }
  );

  // Fetch recent trades
  const {data: recentTrades} = useQuery(
    ['recentTrades', symbol],
    () => marketsApi.getMarketTrades(symbol!),
    {
      enabled: !!symbol,
      refetchInterval: 5000,
    }
  );

  // Fetch market stats
  const {data: marketStats} = useQuery(
    ['marketStats', symbol],
    () => marketsApi.getMarketStats(symbol!),
    {
      enabled: !!symbol,
      refetchInterval: 30000,
    }
  );

  // Create order mutation
  const createOrderMutation = useMutation(
    (orderData: any) => marketsApi.createOrder(symbol!, orderData),
    {
      onSuccess: () => {
        message.success('Order placed successfully');
        queryClient.invalidateQueries(['walletBalance']);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to place order');
      },
    }
  );

  // Watchlist mutations
  const addToWatchlistMutation = useMutation(
    () => marketsApi.addToWatchlist(market!.symbol),
    {
      onSuccess: () => {
        setIsWatched(true);
        message.success('Added to watchlist');
      },
    },
  );

  const removeFromWatchlistMutation = useMutation(
    () => marketsApi.removeFromWatchlist(market!.symbol),
    {
      onSuccess: () => {
        setIsWatched(false);
        message.success('Removed from watchlist');
      },
    },
  );

  // WebSocket for real-time updates
  useEffect(() => {
    if (!socket || !symbol) return;

    const handlePriceUpdate = (data: { symbol: string; price: number; change: number; volume: number }) => {
      if (data.symbol.toUpperCase() === symbol?.toUpperCase()) {
        queryClient.setQueryData(['market', symbol], (old: Market) => ({
          ...old,
          currentPrice: data.price,
          priceChange24h: data.change,
          volume24h: data.volume,
        }));
      }
    };

    const handleOrderBookUpdate = (data: { symbol: string; orderBook: any }) => {
      if (data.symbol.toUpperCase() === symbol?.toUpperCase()) {
        queryClient.setQueryData(['orderBook', symbol], data.orderBook);
      }
    };

    const handleNewTrade = (data: Trade) => {
      if (data.marketId.toUpperCase() === symbol?.toUpperCase()) {
        queryClient.setQueryData(['recentTrades', symbol], (old: Trade[] = []) => [data, ...old.slice(0, 99)]);
      }
    };

    socket.on('price_update', handlePriceUpdate);
    socket.on('orderbook_update', handleOrderBookUpdate);
    socket.on('new_trade', handleNewTrade);

    // Subscribe to market updates
    socket.emit('subscribe_market', { symbol });

    return () => {
      socket.off('price_update', handlePriceUpdate);
      socket.off('orderbook_update', handleOrderBookUpdate);
      socket.off('new_trade', handleNewTrade);
      socket.emit('unsubscribe_market', { symbol });
    };
  }, [socket, symbol, queryClient]);

  useEffect(() => {
    if (market) {
      setPrice(market.currentPrice);
    }
  }, [market]);

  const handlePlaceOrder = () => {
    if (!market) return;

    const orderData = {
      type: orderType,
      side: tradeSide,
      quantity,
      price: orderType === 'MARKET' ? undefined : price,
    };

    createOrderMutation.mutate(orderData);
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // API call to toggle favorite
  };

  const toggleWatch = () => {
    if (isWatched) {
      removeFromWatchlistMutation.mutate();
    } else {
      addToWatchlistMutation.mutate();
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    message.success('Link copied to clipboard');
  };

  const handleFullscreen = () => {
    if (chartRef.current) {
      chartRef.current.requestFullscreen();
    }
  };

  const moreMenuItems: MenuProps['items'] = [
    {
      key: 'alert',
      label: 'Set Price Alert',
      icon: <BellOutlined />,
      onClick: () => message.info('Price alerts coming soon'),
    },
    {
      key: 'export',
      label: 'Export Data',
      icon: <BarChartOutlined />,
      onClick: () => message.info('Export functionality coming soon'),
    },
  ];

  const tradeColumns = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleTimeString(),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `R${price.toFixed(2)}`,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => quantity.toLocaleString(),
    },
    {
      title: 'Type',
      dataIndex: 'side',
      key: 'side',
      render: (side: string) => (
        <Tag color={side === 'BUY' ? 'green' : 'red'}>{side}</Tag>
      ),
    },
  ];

  if (marketLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#0E0E10', minHeight: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '60px', height: '60px', border: '3px solid rgba(255, 179, 0, 0.2)' }} />
          <Text style={{ color: '#B8BCC8' }}>Loading market data...</Text>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#0E0E10', minHeight: '100vh' }}>
        <Alert
          message="Market Not Found"
          description="The market you're looking for doesn't exist or has been delisted."
          type="error"
          showIcon
          action={
            <Button type="primary" onClick={() => navigate('/markets')}>
              Back to Markets
            </Button>
          }
        />
      </div>
    );
  }

  const totalBuyVolume = orderBook?.bids?.reduce((sum: number, bid: OrderBookEntry) => sum + bid.total, 0) || 0;
  const totalSellVolume = orderBook?.asks?.reduce((sum: number, ask: OrderBookEntry) => sum + ask.total, 0) || 0;

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Market Header */}
      <div style={{ marginBottom: '32px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
              <Button
                type="text"
                onClick={() => navigate('/markets')}
                style={{ color: '#B8BCC8' }}
              >
                ← Back to Markets
              </Button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
                  {market.symbol}
                </Title>
                <Text style={{ color: '#B8BCC8', fontSize: '18px' }}>
                  {market.name}
                </Text>
              </div>
            </div>
            <Space size="large">
              <Space>
                {market.priceChange24h >= 0 ? (
                  <RiseOutlined style={{ color: '#52C41A' }} />
                ) : (
                  <FallOutlined style={{ color: '#FF4D4F' }} />
                )}
                <Text style={{ color: '#FFB300', fontSize: '32px', fontWeight: 'bold' }}>
                  R{market.currentPrice.toFixed(2)}
                </Text>
                <Text
                  style={{
                    color: market.priceChange24h >= 0 ? '#52C41A' : '#FF4D4F',
                    fontSize: '18px',
                    fontWeight: 'bold',
                  }}
                >
                  {market.priceChange24h >= 0 ? '+' : ''}{market.priceChange24h.toFixed(2)}%
                </Text>
              </Space>
              <Tag color={market.category === 'MUSIC' ? 'purple' : market.category === 'SPORTS' ? 'blue' : 'default'}>
                {market.category}
              </Tag>
              <Tag
                color={
                  market.riskScore === 'LOW' ? 'green' :
                  market.riskScore === 'MEDIUM' ? 'orange' :
                  market.riskScore === 'HIGH' ? 'red' : 'purple'
                }
              >
                {market.riskScore} RISK
              </Tag>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                <Button
                  type="text"
                  icon={isFavorite ? <StarFilled style={{ color: '#FFB300' }} /> : <StarOutlined />}
                  onClick={toggleFavorite}
                />
              </Tooltip>
              <Tooltip title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}>
                <Button
                  type="text"
                  icon={isWatched ? <EyeOutlined style={{ color: '#FFB300' }} /> : <EyeOutlined />}
                  onClick={toggleWatch}
                />
              </Tooltip>
              <Tooltip title="Share">
                <Button type="text" icon={<ShareAltOutlined />} onClick={handleShare} />
              </Tooltip>
              <Tooltip title="Fullscreen chart">
                <Button type="text" icon={<FullscreenOutlined />} onClick={handleFullscreen} />
              </Tooltip>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchMarket()}
                loading={marketLoading}
              />
              <Dropdown menu={{ items: moreMenuItems }} trigger={['click']}>
                <Button icon={<InfoCircleOutlined />} />
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Market Stats */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>24h Volume</Text>}
              value={market.volume24h}
              prefix={<DollarCircleOutlined />}
              valueStyle={{ color: '#FFB300', fontSize: '20px' }}
              formatter={(value) => `R${(Number(value) / 1000000).toFixed(1)}M`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>24h High</Text>}
              value={marketStats?.high24h || 0}
              valueStyle={{ color: '#52C41A', fontSize: '20px' }}
              formatter={(value) => `R${Number(value).toFixed(2)}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>24h Low</Text>}
              value={marketStats?.low24h || 0}
              valueStyle={{ color: '#FF4D4F', fontSize: '20px' }}
              formatter={(value) => `R${Number(value).toFixed(2)}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}>
            <Statistic
              title={<Text style={{ color: '#B8BCC8' }}>Virality Score</Text>}
              value={market.viralityScore}
              suffix="%"
              prefix={<FireOutlined />}
              valueStyle={{
                color: market.viralityScore >= 70 ? '#52C41A' : market.viralityScore >= 40 ? '#FFB300' : '#FF4D4F',
                fontSize: '20px'
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content */}
      <Row gutter={[24, 24]}>
        {/* Price Chart */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>Price Chart</Text>
                <Select value={chartTimeframe} onChange={setChartTimeframe} style={{ width: 100 }}>
                  <Option value="1H">1H</Option>
                  <Option value="4H">4H</Option>
                  <Option value="1D">1D</Option>
                  <Option value="1W">1W</Option>
                  <Option value="1M">1M</Option>
                </Select>
              </div>
            }
            style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
            bodyStyle={{ padding: '0' }}
            ref={chartRef}
          >
            <PriceChart
              symbol={symbol!}
              timeframe={chartTimeframe}
              height={400}
            />
          </Card>

          {/* Recent Trades */}
          <Card
            title={<Text style={{ color: '#FFB300' }}>Recent Trades</Text>}
            style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)', marginTop: '24px' }}
          >
            <Table
              dataSource={recentTrades || []}
              columns={tradeColumns}
              pagination={{ pageSize: 10 }}
              size="small"
              rowKey="id"
            />
          </Card>
        </Col>

        {/* Trading Panel */}
        <Col xs={24} lg={8}>
          {/* Order Form */}
          <Card
            title={<Text style={{ color: '#FFB300' }}>Place Order</Text>}
            style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>Order Type</Text>
                <Select value={orderType} onChange={setOrderType} style={{ width: '100%' }}>
                  <Option value="MARKET">Market</Option>
                  <Option value="LIMIT">Limit</Option>
                  <Option value="STOP">Stop</Option>
                </Select>
              </div>

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>Side</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <Button
                    type={tradeSide === 'BUY' ? 'primary' : 'default'}
                    onClick={() => setTradeSide('BUY')}
                    style={{
                      background: tradeSide === 'BUY' ? '#52C41A' : 'transparent',
                      borderColor: tradeSide === 'BUY' ? '#52C41A' : '#52C41A',
                      color: tradeSide === 'BUY' ? 'white' : '#52C41A',
                    }}
                  >
                    BUY
                  </Button>
                  <Button
                    type={tradeSide === 'SELL' ? 'primary' : 'default'}
                    onClick={() => setTradeSide('SELL')}
                    style={{
                      background: tradeSide === 'SELL' ? '#FF4D4F' : 'transparent',
                      borderColor: tradeSide === 'SELL' ? '#FF4D4F' : '#FF4D4F',
                      color: tradeSide === 'SELL' ? 'white' : '#FF4D4F',
                    }}
                  >
                    SELL
                  </Button>
                </div>
              </div>

              {orderType !== 'MARKET' && (
                <div>
                  <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>Price</Text>
                  <InputNumber
                    value={price}
                    onChange={setPrice}
                    style={{ width: '100%' }}
                    precision={2}
                    formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value!.replace(/R\s?|(,*)/g, '')}
                  />
                </div>
              )}

              <div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>Quantity</Text>
                <InputNumber
                  value={quantity}
                  onChange={setQuantity}
                  style={{ width: '100%' }}
                  min={1}
                />
              </div>

              <div style={{ padding: '16px', background: 'rgba(255, 179, 0, 0.1)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <Text style={{ color: '#B8BCC8' }}>Estimated Total</Text>
                  <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>
                    R{((orderType === 'MARKET' ? market.currentPrice : price) * quantity).toFixed(2)}
                  </Text>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                onClick={handlePlaceOrder}
                loading={createOrderMutation.isLoading}
                block
                style={{
                  background: tradeSide === 'BUY' ? '#52C41A' : '#FF4D4F',
                  border: 'none',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                {tradeSide === 'BUY' ? 'Place Buy Order' : 'Place Sell Order'}
              </Button>
            </Space>
          </Card>

          {/* Order Book */}
          <Card
            title={<Text style={{ color: '#FFB300' }}>Order Book</Text>}
            style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)', marginTop: '24px' }}
          >
            <OrderBook data={orderBook} />
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text style={{ color: '#B8BCC8' }}>Total Volume</Text>
                <Text style={{ color: '#FFB300' }}>
                  {((totalBuyVolume + totalSellVolume) / 1000000).toFixed(2)}M
                </Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text style={{ color: '#52C41A' }}>Buy Volume: {(totalBuyVolume / 1000000).toFixed(2)}M</Text>
                <Text style={{ color: '#FF4D4F' }}>Sell Volume: {(totalSellVolume / 1000000).toFixed(2)}M</Text>
              </div>
            </div>
          </Card>

          {/* Market Info */}
          <Card
            title={<Text style={{ color: '#FFB300' }}>Market Information</Text>}
            style={{ background: '#1A1A1C', border: '1px solid rgba(255, 179, 0, 0.2)', marginTop: '24px' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Description</Text>
                <Text style={{ color: '#B8BCC8' }}>{market.description}</Text>
              </div>
              <div>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Category</Text>
                <Tag color="blue">{market.category}</Tag>
              </div>
              <div>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Platforms</Text>
                <div style={{ marginTop: '4px' }}>
                  {market.platforms.map(platform => (
                    <Tag key={platform} style={{ margin: '2px' }}>
                      {platform}
                    </Tag>
                  ))}
                </div>
              </div>
              <div>
                <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Sentiment</Text>
                <Progress
                  percent={market.sentiment === 'POSITIVE' ? 75 : market.sentiment === 'NEGATIVE' ? 25 : 50}
                  strokeColor={market.sentiment === 'POSITIVE' ? '#52C41A' : market.sentiment === 'NEGATIVE' ? '#FF4D4F' : '#FFB300'}
                  showInfo={false}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Risk Warning */}
      <Alert
        message={
          <span>
            <WarningOutlined style={{ marginRight: '8px' }} />
            Risk Warning
          </span>
        }
        description="Trading viral trends involves high risk. Past performance does not guarantee future results. Only trade with money you can afford to lose."
        type="warning"
        showIcon
        style={{ marginTop: '24px' }}
      />
    </div>
  );
};

export default MarketDetailPage;