import React, { useState, useMemo } from 'react';
import {
  Table, Input, Select, Button, Space, Tag, Badge, Progress, Tooltip, Popconfirm, Dropdown, Menu, Typography, Row, Col, Card, Statistic, Divider, message, Drawer, Descriptions, } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/lib/table';
import type { FilterValue, SorterResult } from 'antd/lib/table/interface';
import {
  SearchOutlined, FilterOutlined, ReloadOutlined, DownloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SettingOutlined, ExperimentOutlined, MoreOutlined, ExportOutlined, ImportOutlined, MailOutlined, PhoneOutlined, BellOutlined, MessageOutlined, GlobalOutlined, ApiOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, CaretUpOutlined, CaretDownOutlined, } from '@ant-design/icons';

const {Search} = Input;
const {Option} = Select;
const {Text, Title} = Typography;

export interface ProviderHealthData {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app' | 'webhook';
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE' | 'OFFLINE';
  healthScore: number;
  uptime: number;
  responseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  circuitBreaker: {
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    threshold: number;
    timeout: number;
  };
  quotas: {
    current: number;
    limit: number;
    resetTime: Date;
  };
  costs: {
    current: number;
    projected: number;
    currency: string;
  };
  region: string;
  priority: number;
  metadata?: Record<string, any>;
}

export interface ProviderTableProps {
  data: ProviderHealthData[];
  loading?: boolean;
  onViewDetails?: (provider: ProviderHealthData) => void;
  onEdit?: (provider: ProviderHealthData) => void;
  onDelete?: (provider: ProviderHealthData) => void;
  onTest?: (provider: ProviderHealthData) => void;
  onConfigure?: (provider: ProviderHealthData) => void;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'json' | 'xlsx') => void;
  onImport?: (file: File) => void;
  pagination?: TablePaginationConfig;
  rowSelection?: {
    selectedRowKeys: React.Key[];
    onChange: (selectedRowKeys: React.Key[], selectedRows: ProviderHealthData[]) => void;
  };
  className?: string;
}

const ProviderTable: React.FC<ProviderTableProps> = ({
  data,
  loading = false,
  onViewDetails,
  onEdit,
  onDelete,
  onTest,
  onConfigure,
  onRefresh,
  onExport,
  onImport,
  pagination,
  rowSelection,
  className = '',
}) => {
  const [searchText, setSearchText] = useState('');
  const [filteredInfo, setFilteredInfo] = useState<Record<string, FilterValue | null>>({});
  const [sortedInfo, setSortedInfo] = useState<SorterResult<ProviderHealthData>>({});
  const [selectedProvider, setSelectedProvider] = useState<ProviderHealthData | null>(null);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [filters, setFilters] = useState({
    status: [] as string[],
    type: [] as string[],
    region: [] as string[],
    riskLevel: [] as string[],
  });

  const getProviderIcon = (type: string) => {
    const icons = {
      email: <MailOutlined />,
      sms: <PhoneOutlined />,
      push: <BellOutlined />,
      in_app: <MessageOutlined />,
      webhook: <GlobalOutlined />,
    };
    return icons[type as keyof typeof icons] || <ApiOutlined />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      HEALTHY: 'success',
      DEGRADED: 'warning',
      UNHEALTHY: 'error',
      MAINTENANCE: 'processing',
      OFFLINE: 'default',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return '#52c41a';
    if (score >= 70) return '#faad14';
    if (score >= 50) return '#fa8c16';
    return '#ff4d4f';
  };

  const getRiskLevel = (provider: ProviderHealthData) => {
    if (provider.healthScore >= 90 && provider.successRate >= 95) return 'LOW';
    if (provider.healthScore >= 70 && provider.successRate >= 90) return 'MEDIUM';
    if (provider.healthScore >= 50 && provider.successRate >= 85) return 'HIGH';
    return 'CRITICAL';
  };

  const getRiskLevelColor = (level: string) => {
    const colors = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
      CRITICAL: 'purple',
    };
    return colors[level as keyof typeof colors] || 'default';
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatThroughput = (rate: number) => {
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k`;
    return rate.toString();
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(provider => {
      const matchesSearch = !searchText ||
        provider.name.toLowerCase().includes(searchText.toLowerCase()) ||
        provider.type.toLowerCase().includes(searchText.toLowerCase()) ||
        provider.region.toLowerCase().includes(searchText.toLowerCase());

      const matchesStatus = filters.status.length === 0 || filters.status.includes(provider.status);
      const matchesType = filters.type.length === 0 || filters.type.includes(provider.type);
      const matchesRegion = filters.region.length === 0 || filters.region.includes(provider.region);
      const matchesRiskLevel = filters.riskLevel.length === 0 || filters.riskLevel.includes(getRiskLevel(provider));

      return matchesSearch && matchesStatus && matchesType && matchesRegion && matchesRiskLevel;
    });
  }, [data, searchText, filters]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredData.length;
    const healthy = filteredData.filter(p => p.status === 'HEALTHY').length;
    const degraded = filteredData.filter(p => p.status === 'DEGRADED').length;
    const unhealthy = filteredData.filter(p => p.status === 'UNHEALTHY').length;
    const averageHealthScore = total > 0 ? filteredData.reduce((acc, p) => acc + p.healthScore, 0) / total : 0;
    const totalCost = filteredData.reduce((acc, p) => acc + p.costs.current, 0);

    return { total, healthy, degraded, unhealthy, averageHealthScore, totalCost };
  }, [filteredData]);

  // Handle row actions
  const handleViewDetails = (provider: ProviderHealthData) => {
    setSelectedProvider(provider);
    setDetailsDrawerVisible(true);
    onViewDetails?.(provider);
  };

  const handleDelete = async (provider: ProviderHealthData) => {
    try {
      await onDelete?.(provider);
      message.success('Provider deleted successfully');
    } catch (error) {
      message.error('Failed to delete provider');
    }
  };

  const handleExport = (format: 'csv' | 'json' | 'xlsx') => {
    onExport?.(format);
  };

  const columns: ColumnsType<ProviderHealthData> = [
    {
      title: 'Provider',
      key: 'provider',
      width: 200,
      filteredValue: filteredInfo.provider || null,
      onFilter: (value, record) => record.name.includes(value as string),
      sorter: (a, b) => a.name.localeCompare(b.name),
      sortOrder: sortedInfo.columnKey === 'provider' && sortedInfo.order,
      render: (_, record) => (
        <Space>
          {getProviderIcon(record.type)}
          <div>
            <Text strong>{record.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.type.toUpperCase()}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filters: [
        { text: 'Healthy', value: 'HEALTHY' },
        { text: 'Degraded', value: 'DEGRADED' },
        { text: 'Unhealthy', value: 'UNHEALTHY' },
        { text: 'Maintenance', value: 'MAINTENANCE' },
        { text: 'Offline', value: 'OFFLINE' },
      ],
      filteredValue: filters.status,
      onFilter: (value, record) => record.status === value,
      render: (status: string, record: ProviderHealthData) => (
        <Space direction="vertical" size={0}>
          <Badge
            status={getStatusColor(status) as any}
            text={status}
          />
          <Progress
            percent={record.healthScore}
            size="small"
            strokeColor={getHealthScoreColor(record.healthScore)}
            showInfo={false}
            style={{ width: 80 }}
          />
          <Text style={{ fontSize: '12px' }}>
            {record.healthScore}%
          </Text>
        </Space>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 180,
      render: (_, record: ProviderHealthData) => (
        <Space direction="vertical" size={0}>
          <Space>
            <Text style={{ fontSize: '12px' }}>Success:</Text>
            <Text strong style={{ fontSize: '12px', color: record.successRate >= 95 ? '#52c41a' : '#faad14' }}>
              {record.successRate}%
            </Text>
          </Space>
          <Space>
            <Text style={{ fontSize: '12px' }}>Response:</Text>
            <Text strong style={{ fontSize: '12px' }}>
              {formatResponseTime(record.responseTime)}
            </Text>
          </Space>
          <Space>
            <Text style={{ fontSize: '12px' }}>Throughput:</Text>
            <Text strong style={{ fontSize: '12px' }}>
              {formatThroughput(record.throughput)}/min
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Risk Level',
      key: 'riskLevel',
      width: 100,
      filters: [
        { text: 'Low', value: 'LOW' },
        { text: 'Medium', value: 'MEDIUM' },
        { text: 'High', value: 'HIGH' },
        { text: 'Critical', value: 'CRITICAL' },
      ],
      filteredValue: filters.riskLevel,
      onFilter: (value, record) => getRiskLevel(record) === value,
      render: (_, record: ProviderHealthData) => {
        const riskLevel = getRiskLevel(record);
        return (
          <Tag color={getRiskLevelColor(riskLevel)}>
            {riskLevel}
          </Tag>
        );
      },
    },
    {
      title: 'Circuit Breaker',
      dataIndex: 'circuitBreaker',
      key: 'circuitBreaker',
      width: 140,
      render: (circuitBreaker: ProviderHealthData['circuitBreaker']) => (
        <Space direction="vertical" size={0}>
          <Tag
            color={circuitBreaker.status === 'CLOSED' ? 'green' :
                   circuitBreaker.status === 'HALF_OPEN' ? 'orange' : 'red'}
          >
            {circuitBreaker.status}
          </Tag>
          <Text style={{ fontSize: '12px' }}>
            {circuitBreaker.failures}/{circuitBreaker.threshold}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Cost',
      dataIndex: 'costs',
      key: 'costs',
      width: 120,
      sorter: (a, b) => a.costs.current - b.costs.current,
      render: (costs: ProviderHealthData['costs']) => (
        <Space direction="vertical" size={0}>
          <Text strong>{formatCurrency(costs.current, costs.currency)}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {formatCurrency(costs.projected, costs.currency)} proj.
          </Text>
        </Space>
      ),
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      width: 100,
      filters: [
        { text: 'Global', value: 'global' },
        { text: 'US East', value: 'us-east-1' },
        { text: 'US West', value: 'us-west-2' },
        { text: 'Europe', value: 'eu-west-1' },
        { text: 'Asia Pacific', value: 'ap-southeast-1' },
      ],
      filteredValue: filters.region,
      onFilter: (value, record) => record.region === value,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record: ProviderHealthData) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          <Tooltip title="Run Test">
            <Button
              type="text"
              icon={<ExperimentOutlined />}
              onClick={() => onTest?.(record)}
            />
          </Tooltip>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => onEdit?.(record)}>
                  Edit
                </Menu.Item>
                <Menu.Item key="config" icon={<SettingOutlined />} onClick={() => onConfigure?.(record)}>
                  Configure
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  key="delete"
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => handleDelete(record)}
                >
                  Delete
                </Menu.Item>
              </Menu>
            }
          >
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<ProviderHealthData> | SorterResult<ProviderHealthData>[]
  ) => {
    setFilteredInfo(filters);
    setSortedInfo(sorter as SorterResult<ProviderHealthData>);
  };

  return (
    <div className={`provider-table ${className}`}>
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Providers"
              value={statistics.total}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Healthy"
              value={statistics.healthy}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Avg Health Score"
              value={statistics.averageHealthScore}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Total Cost"
              value={statistics.totalCost}
              precision={2}
              prefix="$"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Search
              placeholder="Search providers..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} sm={16}>
            <Space wrap>
              <Select
                mode="multiple"
                placeholder="Status"
                value={filters.status}
                onChange={(values) => setFilters(prev => ({ ...prev, status: values }))}
                style={{ minWidth: 120 }}
                allowClear
              >
                <Option value="HEALTHY">Healthy</Option>
                <Option value="DEGRADED">Degraded</Option>
                <Option value="UNHEALTHY">Unhealthy</Option>
                <Option value="MAINTENANCE">Maintenance</Option>
                <Option value="OFFLINE">Offline</Option>
              </Select>

              <Select
                mode="multiple"
                placeholder="Type"
                value={filters.type}
                onChange={(values) => setFilters(prev => ({ ...prev, type: values }))}
                style={{ minWidth: 120 }}
                allowClear
              >
                <Option value="email">Email</Option>
                <Option value="sms">SMS</Option>
                <Option value="push">Push</Option>
                <Option value="in_app">In-App</Option>
                <Option value="webhook">Webhook</Option>
              </Select>

              <Select
                mode="multiple"
                placeholder="Region"
                value={filters.region}
                onChange={(values) => setFilters(prev => ({ ...prev, region: values }))}
                style={{ minWidth: 120 }}
                allowClear
              >
                <Option value="global">Global</Option>
                <Option value="us-east-1">US East</Option>
                <Option value="us-west-2">US West</Option>
                <Option value="eu-west-1">Europe</Option>
                <Option value="ap-southeast-1">Asia Pacific</Option>
              </Select>

              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilters({ status: [], type: [], region: [], riskLevel: [] })}
              >
                Clear Filters
              </Button>

              <Divider type="vertical" />

              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item key="csv" onClick={() => handleExport('csv')}>
                      Export as CSV
                    </Menu.Item>
                    <Menu.Item key="json" onClick={() => handleExport('json')}>
                      Export as JSON
                    </Menu.Item>
                    <Menu.Item key="xlsx" onClick={() => handleExport('xlsx')}>
                      Export as Excel
                    </Menu.Item>
                  </Menu>
                }
              >
                <Button icon={<ExportOutlined />}>
                  Export
                </Button>
              </Dropdown>

              <Button icon={<ImportOutlined />}>
                Import
              </Button>

              <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredData}
        loading={loading}
        rowKey="id"
        pagination={{
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} providers`,
          ...pagination,
        }}
        scroll={{ x: 1200 }}
        onChange={handleTableChange}
        rowSelection={rowSelection}
        size="small"
      />

      {/* Details Drawer */}
      <Drawer
        title="Provider Details"
        placement="right"
        onClose={() => setDetailsDrawerVisible(false)}
        open={detailsDrawerVisible}
        width={600}
      >
        {selectedProvider && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Provider Name">
              {selectedProvider.name}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color="blue">{selectedProvider.type.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getStatusColor(selectedProvider.status) as any}
                text={selectedProvider.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Health Score">
              <Progress
                percent={selectedProvider.healthScore}
                strokeColor={getHealthScoreColor(selectedProvider.healthScore)}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Uptime">
              {selectedProvider.uptime}%
            </Descriptions.Item>
            <Descriptions.Item label="Response Time">
              {formatResponseTime(selectedProvider.responseTime)}
            </Descriptions.Item>
            <Descriptions.Item label="Success Rate">
              {selectedProvider.successRate}%
            </Descriptions.Item>
            <Descriptions.Item label="Throughput">
              {formatThroughput(selectedProvider.throughput)} messages/min
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              {selectedProvider.region}
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              {selectedProvider.priority}
            </Descriptions.Item>
            <Descriptions.Item label="Circuit Breaker">
              <Tag
                color={selectedProvider.circuitBreaker.status === 'CLOSED' ? 'green' :
                       selectedProvider.circuitBreaker.status === 'HALF_OPEN' ? 'orange' : 'red'}
              >
                {selectedProvider.circuitBreaker.status}
              </Tag>
              ({selectedProvider.circuitBreaker.failures}/{selectedProvider.circuitBreaker.threshold} failures)
            </Descriptions.Item>
            <Descriptions.Item label="Last Check">
              {selectedProvider.lastCheck.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Current Cost">
              {formatCurrency(selectedProvider.costs.current, selectedProvider.costs.currency)}
              {' '}({formatCurrency(selectedProvider.costs.projected, selectedProvider.costs.currency)} projected)
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default ProviderTable;