import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Select, DatePicker, Tag, Space, Tooltip } from 'antd';
import {
  HistoryOutlined, FilterOutlined, ExportOutlined, EyeOutlined, SearchOutlined, SyncOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { ColumnType } from 'antd/lib/table';
import moment from 'moment';

const {Option} = Select;
const {RangePicker} = DatePicker;

interface TradeHistoryProps {
  trendId?: string;
  userId?: string;
}

interface TradeRecord {
  id: string;
  orderId: string;
  userId: string;
  trendId: string;
  trendSymbol: string;
  trendName: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price: number;
  totalValue: number;
  fee: number;
  feeCurrency: string;
  status: 'PENDING' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  filledAt?: string;
  cancelledAt?: string;
  averageFillPrice?: number;
  filledQuantity: number;
  remainingQuantity: number;
}

const TradeHistory: React.FC<TradeHistoryProps> = ({ trendId, userId }) => {
  const {user} = useAuth();
  const {subscribeToOrders, orderHistory} = useWebSocket();
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[moment.Moment, moment.Moment] | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    subscribeToOrders(userId || user?.id || '');
  }, [userId, user?.id]);

  // Mock trade history data
  const mockTradeHistory: TradeRecord[] = useMemo(() => {
    const trades: TradeRecord[] = [];
    const now = new Date();

    for (let i = 0; i < 100; i++) {
      const isBuy = Math.random() > 0.5;
      const trendId = Math.random().toString(36).substring(2, 15);
      const quantity = Math.floor(Math.random() * 10000) + 100;
      const price = 10 + Math.random() * 90;
      const totalValue = quantity * price;
      const statusOptions = ['FILLED', 'PARTIAL_FILLED', 'CANCELLED', 'PENDING'];
      const status = statusOptions[Math.floor(Math.random() * statusOptions.length)] as TradeRecord['status'];
      const typeOptions = ['MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT'];
      const type = typeOptions[Math.floor(Math.random() * typeOptions.length)] as TradeRecord['orderType'];

      const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
      const filledAt = status === 'FILLED' || status === 'PARTIAL_FILLED'
        ? new Date(createdAt.getTime() + Math.random() * 60 * 60 * 1000)
        : null;

      trades.push({
        id: `trade_${i}`,
        orderId: `order_${i}`,
        userId: userId || user?.id || 'user_1',
        trendId,
        trendSymbol: `VIRAL/SA_TREND_${(i % 10) + 1}`,
        trendName: `Trend ${i + 1}`,
        type: isBuy ? 'BUY' : 'SELL',
        orderType: type,
        quantity,
        price,
        totalValue,
        fee: totalValue * 0.002,
        feeCurrency: 'ZAR',
        status,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        filledAt: filledAt?.toISOString(),
        averageFillPrice: status === 'FILLED' ? price : price * (0.98 + Math.random() * 0.04),
        filledQuantity: status === 'FILLED' ? quantity : Math.floor(quantity * (Math.random() * 0.8 + 0.1)),
        remainingQuantity: status === 'FILLED' ? 0 : Math.floor(quantity * Math.random() * 0.9)
      });
    }

    return trades.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [userId, user?.id]);

  const tradeHistory = orderHistory || mockTradeHistory;

  // Filter trades
  const filteredTrades = useMemo(() => {
    let filtered = [...tradeHistory];

    // Filter by trendId if provided
    if (trendId) {
      filtered = filtered.filter(trade => trade.trendId === trendId);
    }

    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(trade =>
        trade.trendSymbol.toLowerCase().includes(searchText.toLowerCase()) ||
        trade.trendName.toLowerCase().includes(searchText.toLowerCase()) ||
        trade.orderId.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter.length > 0) {
      filtered = filtered.filter(trade => statusFilter.includes(trade.status));
    }

    // Filter by type
    if (typeFilter.length > 0) {
      filtered = filtered.filter(trade => typeFilter.includes(trade.type));
    }

    // Filter by date range
    if (dateRange) {
      const [start, end] = dateRange;
      filtered = filtered.filter(trade => {
        const tradeDate = moment(trade.createdAt);
        return tradeDate.isBetween(start, end, 'day', '[]');
      });
    }

    return filtered;
  }, [tradeHistory, trendId, searchText, statusFilter, typeFilter, dateRange]);

  // Pagination
  const paginatedTrades = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTrades.slice(startIndex, endIndex);
  }, [filteredTrades, currentPage, pageSize]);

  const formatCurrency = (amount: number, currency: string = 'ZAR') => {
    return `${currency} ${amount.toFixed(2)}`;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'FILLED': '#52c41a',
      'PARTIAL_FILLED': '#1890ff',
      'CANCELLED': '#ff4d4f',
      'PENDING': '#faad14',
      'REJECTED': '#ff4d4f'
    };
    return colors[status as keyof typeof colors] || '#d9d9d9';
  };

  const getTypeIcon = (type: string) => {
    return type === 'BUY' ? '🟢' : '🔴';
  };

  const handleExport = () => {
    const csvContent = [
      [
        'Date', 'Time', 'Symbol', 'Type', 'Order Type', 'Quantity', 'Price', 'Total Value', 'Fee', 'Status'
      ],
      ...filteredTrades.map(trade => [
        moment(trade.createdAt).format('YYYY-MM-DD'),
        moment(trade.createdAt).format('HH:mm:ss'),
        trade.trendSymbol,
        trade.type,
        trade.orderType,
        trade.quantity.toString(),
        trade.price.toFixed(6),
        trade.totalValue.toFixed(2),
        trade.fee.toFixed(2),
        trade.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trade_history_${moment().format('YYYY-MM-DD')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnType<TradeRecord>[] = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      width: 100,
      render: (date: string) => moment(date).format('YYYY-MM-DD'),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'time',
      width: 80,
      render: (date: string) => moment(date).format('HH:mm:ss'),
    },
    {
      title: 'Symbol',
      dataIndex: 'trendSymbol',
      key: 'symbol',
      width: 140,
      render: (symbol: string, record: TradeRecord) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{symbol}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.trendName}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <span>
          {getTypeIcon(type)} {type}
        </span>
      ),
      filters: [
        { text: 'Buy', value: 'BUY' },
        { text: 'Sell', value: 'SELL' },
      ],
      onFilter: (value: any, record: TradeRecord) => record.type === value,
    },
    {
      title: 'Order Type',
      dataIndex: 'orderType',
      key: 'orderType',
      width: 100,
      filters: [
        { text: 'Market', value: 'MARKET' },
        { text: 'Limit', value: 'LIMIT' },
        { text: 'Stop Loss', value: 'STOP_LOSS' },
        { text: 'Take Profit', value: 'TAKE_PROFIT' },
      ],
      onFilter: (value: any, record: TradeRecord) => record.orderType === value,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right' as const,
      render: (quantity: number) => quantity.toLocaleString(),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'right' as const,
      render: (price: number) => price.toFixed(6),
    },
    {
      title: 'Total Value',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 120,
      align: 'right' as const,
      render: (value: number, record: TradeRecord) => (
        <div>
          <div>{formatCurrency(value, record.feeCurrency)}</div>
          {record.averageFillPrice && record.averageFillPrice !== record.price && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              Avg: {record.averageFillPrice.toFixed(6)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Filled',
      dataIndex: 'filledQuantity',
      key: 'filledQuantity',
      width: 100,
      align: 'right' as const,
      render: (filled: number, record: TradeRecord) => (
        <div>
          <div>{filled.toLocaleString()}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {((filled / record.quantity) * 100).toFixed(1)}%
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
      filters: [
        { text: 'Filled', value: 'FILLED' },
        { text: 'Partial Filled', value: 'PARTIAL_FILLED' },
        { text: 'Cancelled', value: 'CANCELLED' },
        { text: 'Pending', value: 'PENDING' },
        { text: 'Rejected', value: 'REJECTED' },
      ],
      onFilter: (value: any, record: TradeRecord) => record.status === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record: TradeRecord) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              size="small"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleRefresh = () => {
    setLoading(true);
    // Would fetch fresh data from API
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <Card
      title={
        <div className="trade-history-header">
          <div className="title">
            <HistoryOutlined />
            <span>Trade History</span>
            <Tag color="blue">{filteredTrades.length} trades</Tag>
          </div>
          <div className="actions">
            <Button
              icon={<FilterOutlined />}
              size="small"
              onClick={() => {/* Show advanced filters */}}
            >
              Filters
            </Button>
            <Button
              icon={<ExportOutlined />}
              size="small"
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              icon={<SyncOutlined />}
              size="small"
              onClick={handleRefresh}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
      }
      extra={
        <div className="trade-history-filters">
          <Search
            placeholder="Search by symbol or order ID"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            prefix={<SearchOutlined />}
            style={{ width: 200, marginRight: 16 }}
          />

          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            style={{ marginRight: 16 }}
            placeholder={['Start Date', 'End Date']}
          />
        </div>
      }
    >
      <Table
        columns={columns}
        dataSource={paginatedTrades}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: filteredTrades.length,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} trades`,
          onChange: (page, pageSize) => {
            setCurrentPage(page);
            setPageSize(pageSize || 20);
          },
        }}
        scroll={{ x: 1200 }}
        size="small"
        className="trade-history-table"
      />
    </Card>
  );
};

export default TradeHistory;