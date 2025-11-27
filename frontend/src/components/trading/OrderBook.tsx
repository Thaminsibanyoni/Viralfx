import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Input, Select, Switch, Statistic, Tag, Tooltip } from 'antd';
import {
  ShoppingOutlined, SwapOutlined, ThunderboltOutlined, SyncOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';

const {Option} = Select;
const {Search} = Input;

interface OrderBookProps {
  trendId: string;
  onOrderClick?: (order: any) => void;
}

interface OrderBookEntry {
  price: number;
  quantity: number;
  total: number;
  orders: number;
  cumulative: number;
}

interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPercentage: number;
  totalVolume: number;
  lastUpdate: string;
}

const OrderBook: React.FC<OrderBookProps> = ({ trendId, onOrderClick }) => {
  const {user} = useAuth();
  const {subscribeToOrders, orderBookData} = useWebSocket();
  const [activeSide, setActiveSide] = useState<'both' | 'bids' | 'asks'>('both');
  const [depth, setDepth] = useState(20);
  const [groupSize, setGroupSize] = useState(0.000001);
  const [showCumulative, setShowCumulative] = useState(true);
  const [hideSmallOrders, setHideSmallOrders] = useState(false);
  const [searchPrice, setSearchPrice] = useState('');

  useEffect(() => {
    subscribeToOrders(user?.id || '');
  }, [user?.id]);

  // Mock order book data (would come from WebSocket)
  const mockOrderBookData: OrderBookData = useMemo(() => {
    const basePrice = 100 + Math.random() * 50;
    const bids: OrderBookEntry[] = [];
    const asks: OrderBookEntry[] = [];

    // Generate bids (buy orders)
    for (let i = 0; i < depth; i++) {
      const price = basePrice - (i + 1) * 0.001;
      const quantity = Math.floor(Math.random() * 10000) + 1000;
      const orders = Math.floor(Math.random() * 5) + 1;
      bids.push({
        price,
        quantity,
        total: quantity * price,
        orders,
        cumulative: 0
      });
    }

    // Generate asks (sell orders)
    for (let i = 0; i < depth; i++) {
      const price = basePrice + (i + 1) * 0.001;
      const quantity = Math.floor(Math.random() * 10000) + 1000;
      const orders = Math.floor(Math.random() * 5) + 1;
      asks.push({
        price,
        quantity,
        total: quantity * price,
        orders,
        cumulative: 0
      });
    }

    // Calculate cumulative values
    let bidCumulative = 0;
    bids.forEach((bid, index) => {
      bidCumulative += bid.total;
      bids[index].cumulative = bidCumulative;
    });

    let askCumulative = 0;
    asks.forEach((ask, index) => {
      askCumulative += ask.total;
      asks[index].cumulative = askCumulative;
    });

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadPercentage = bestBid > 0 ? (spread / bestBid) * 100 : 0;
    const totalVolume = bids.reduce((sum, bid) => sum + bid.total, 0) + asks.reduce((sum, ask) => sum + ask.total, 0);

    return {
      bids: bids.reverse(), // Reverse bids to show highest price first
      asks,
      spread,
      spreadPercentage,
      totalVolume,
      lastUpdate: new Date().toISOString()
    };
  }, [depth]);

  const processedOrderBookData = mockOrderBookData;

  // Filter and group orders
  const processedBids = useMemo(() => {
    let processed = [...processedOrderBookData.bids];

    if (hideSmallOrders) {
      processed = processed.filter(bid => bid.total > 1000);
    }

    if (searchPrice) {
      const targetPrice = parseFloat(searchPrice);
      processed = processed.filter(bid => Math.abs(bid.price - targetPrice) < 0.01);
    }

    return processed;
  }, [processedOrderBookData.bids, hideSmallOrders, searchPrice]);

  const processedAsks = useMemo(() => {
    let processed = [...processedOrderBookData.asks];

    if (hideSmallOrders) {
      processed = processed.filter(ask => ask.total > 1000);
    }

    if (searchPrice) {
      const targetPrice = parseFloat(searchPrice);
      processed = processed.filter(ask => Math.abs(ask.price - targetPrice) < 0.01);
    }

    return processed;
  }, [processedOrderBookData.asks, hideSmallOrders, searchPrice]);

  // Table columns
  const bidColumns = [
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      align: 'right' as const,
      render: (price: number) => (
        <span className="bid-price">{price.toFixed(6)}</span>
      ),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => b.price - a.price,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (quantity: number) => quantity.toLocaleString(),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => b.quantity - a.quantity,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (total: number) => (
        <span className="bid-total">${total.toFixed(2)}</span>
      ),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => b.total - a.total,
    },
    ...(showCumulative ? [{
      title: 'Cumulative',
      dataIndex: 'cumulative',
      key: 'cumulative',
      align: 'right' as const,
      render: (cumulative: number) => (
        <span className="bid-cumulative">${cumulative.toFixed(2)}</span>
      ),
    }] : []),
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      align: 'right' as const,
      render: (orders: number) => (
        <Tag color="green">{orders}</Tag>
      ),
    },
  ];

  const askColumns = [
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      align: 'left' as const,
      render: (orders: number) => (
        <Tag color="red">{orders}</Tag>
      ),
    },
    ...(showCumulative ? [{
      title: 'Cumulative',
      dataIndex: 'cumulative',
      key: 'cumulative',
      align: 'left' as const,
      render: (cumulative: number) => (
        <span className="ask-cumulative">${cumulative.toFixed(2)}</span>
      ),
    }] : []),
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'left' as const,
      render: (total: number) => (
        <span className="ask-total">${total.toFixed(2)}</span>
      ),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => a.total - b.total,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'left' as const,
      render: (quantity: number) => quantity.toLocaleString(),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => a.quantity - b.quantity,
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      align: 'left' as const,
      render: (price: number) => (
        <span className="ask-price">{price.toFixed(6)}</span>
      ),
      sorter: (a: OrderBookEntry, b: OrderBookEntry) => a.price - b.price,
    },
  ];

  const formatSpread = () => {
    return {
      value: orderBookData.spread.toFixed(6),
      percentage: orderBookData.spreadPercentage.toFixed(4)
    };
  };

  const handleRowClick = (record: OrderBookEntry, side: 'bid' | 'ask') => {
    if (onOrderClick) {
      onOrderClick({
        ...record,
        side,
        type: side === 'bid' ? 'BUY' : 'SELL'
      });
    }
  };

  return (
    <Card
      className="orderbook-card"
      title={
        <div className="orderbook-header">
          <div className="title">
            <ThunderboltOutlined />
            <span>Order Book</span>
          </div>
          <div className="spread-info">
            <Tag color="blue">
              Spread: {formatSpread().value} ({formatSpread().percentage}%)
            </Tag>
          </div>
        </div>
      }
      extra={
        <div className="orderbook-controls">
          <Select
            value={activeSide}
            onChange={setActiveSide}
            size="small"
            style={{ width: 100, marginRight: 8 }}
          >
            <Option value="both">Both</Option>
            <Option value="bids">Bids</Option>
            <Option value="asks">Asks</Option>
          </Select>

          <Select
            value={depth}
            onChange={setDepth}
            size="small"
            style={{ width: 80, marginRight: 8 }}
          >
            <Option value={10}>10</Option>
            <Option value={20}>20</Option>
            <Option value={50}>50</Option>
            <Option value={100}>100</Option>
          </Select>

          <Search
            placeholder="Search price"
            value={searchPrice}
            onChange={(e) => setSearchPrice(e.target.value)}
            size="small"
            style={{ width: 120, marginRight: 8 }}
          />

          <Tooltip title="Hide small orders (< $1000)">
            <Switch
              size="small"
              checked={hideSmallOrders}
              onChange={setHideSmallOrders}
              style={{ marginRight: 8 }}
            />
          </Tooltip>

          <Tooltip title="Show cumulative volume">
            <Switch
              size="small"
              checked={showCumulative}
              onChange={setShowCumulative}
            />
          </Tooltip>
        </div>
      }
    >
      <div className="orderbook-content">
        {/* Statistics */}
        <div className="orderbook-stats">
          <Statistic
            title="Total Volume"
            value={orderBookData.totalVolume}
            prefix="$"
            precision={2}
          />
          <Statistic
            title="Best Bid"
            value={orderBookData.bids[0]?.price || 0}
            precision={6}
            valueStyle={{ color: '#52c41a' }}
          />
          <Statistic
            title="Best Ask"
            value={orderBookData.asks[0]?.price || 0}
            precision={6}
            valueStyle={{ color: '#ff4d4f' }}
          />
        </div>

        {/* Order Book Tables */}
        <div className="orderbook-tables">
          {(activeSide === 'both' || activeSide === 'bids') && (
            <div className="bids-section">
              <div className="section-header">
                <ShoppingOutlined />
                <span>Bids (Buy Orders)</span>
                <Tag color="green">{processedBids.length} orders</Tag>
              </div>
              <Table
                dataSource={processedBids}
                columns={bidColumns}
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
                rowKey="price"
                onRow={(record) => ({
                  onClick: () => handleRowClick(record, 'bid'),
                  style: { cursor: 'pointer' },
                })}
                className="bids-table"
              />
            </div>
          )}

          {/* Market Price Line */}
          {activeSide === 'both' && (
            <div className="market-price-line">
              <div className="price-line">
                <span>Market Price</span>
                <span className="price">
                  ${(orderBookData.bids[0]?.price + orderBookData.asks[0]?.price) / 2}
                </span>
              </div>
            </div>
          )}

          {(activeSide === 'both' || activeSide === 'asks') && (
            <div className="asks-section">
              <div className="section-header">
                <SwapOutlined />
                <span>Asks (Sell Orders)</span>
                <Tag color="red">{processedAsks.length} orders</Tag>
              </div>
              <Table
                dataSource={processedAsks}
                columns={askColumns}
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
                rowKey="price"
                onRow={(record) => ({
                  onClick: () => handleRowClick(record, 'ask'),
                  style: { cursor: 'pointer' },
                })}
                className="asks-table"
              />
            </div>
          )}
        </div>

        {/* Depth Chart */}
        <div className="depth-chart">
          <div className="chart-placeholder">
            <p>Depth Chart</p>
            <small>Visual representation of order book depth</small>
          </div>
        </div>

        {/* Last Update */}
        <div className="last-update">
          <SyncOutlined spin={false} />
          <span>Last updated: {new Date(orderBookData.lastUpdate).toLocaleTimeString()}</span>
        </div>
      </div>
    </Card>
  );
};

export default OrderBook;