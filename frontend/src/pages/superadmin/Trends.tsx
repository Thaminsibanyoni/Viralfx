import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, } from 'antd';
import {
  RiseOutlined, FallOutlined, EyeOutlined, EditOutlined, PauseCircleOutlined, PlayCircleOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, BarChartOutlined, LineChartOutlined, FireOutlined, ThunderboltOutlined, GlobalOutlined, StarOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { Trend, VTSSymbol } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;

interface TrendFilters {
  page: number;
  limit: number;
  status?: string;
  category?: string;
  region?: string;
  search?: string;
}

interface VTSSymbolFilters {
  page: number;
  limit: number;
  category?: string;
  region?: string;
  status?: string;
  search?: string;
}

const Trends: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('trends');
  const [trendFilters, setTrendFilters] = useState<TrendFilters>({
    page: 1,
    limit: 20,
  });
  const [vtsFilters, setVtsFilters] = useState<VTSSymbolFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<VTSSymbol | null>(null);
  const [trendModalVisible, setTrendModalVisible] = useState<boolean>(false);
  const [symbolModalVisible, setSymbolModalVisible] = useState<boolean>(false);
  const [overrideModalVisible, setOverrideModalVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // Forms
  const [trendForm] = Form.useForm();
  const [overrideForm] = Form.useForm();

  // Permissions
  const canViewTrends = checkPermission('trends:view');
  const canEditTrends = checkPermission('trends:edit');
  const canApproveTrends = checkPermission('trends:approve');
  const canOverrideTrends = checkPermission('trends:override');
  const canManageVTS = checkPermission('vts:manage');

  // Data fetching
  const {data: trendsData, isLoading: trendsLoading, refetch: refetchTrends, } = useQuery(
    ['trends', trendFilters],
    () => adminApi.getTrends(trendFilters),
    {
      enabled: canViewTrends,
      keepPreviousData: true,
    }
  );

  const {data: vtsData, isLoading: vtsLoading, refetch: refetchVTS, } = useQuery(
    ['vts-symbols', vtsFilters],
    () => adminApi.getVTSSymbols(vtsFilters),
    {
      enabled: canManageVTS,
      keepPreviousData: true,
    }
  );

  // Mutations
  const approveTrendMutation = useMutation(
    (trendId: string) => adminApi.approveTrend(trendId),
    {
      onSuccess: () => {
        message.success('Trend approved successfully');
        queryClient.invalidateQueries('trends');
        setTrendModalVisible(false);
      },
      onError: () => {
        message.error('Failed to approve trend');
      },
    }
  );

  const overrideTrendMutation = useMutation(
    ({ trendId, data }: { trendId: string; data: any }) =>
      adminApi.overrideTrend(trendId, data),
    {
      onSuccess: () => {
        message.success('Trend overridden successfully');
        queryClient.invalidateQueries('trends');
        setOverrideModalVisible(false);
        overrideForm.resetFields();
      },
      onError: () => {
        message.error('Failed to override trend');
      },
    }
  );

  const updateSymbolCategoryMutation = useMutation(
    ({ symbolId, category }: { symbolId: string; category: string }) =>
      adminApi.updateSymbolCategory(symbolId, category),
    {
      onSuccess: () => {
        message.success('Symbol category updated successfully');
        queryClient.invalidateQueries('vts-symbols');
        setSymbolModalVisible(false);
      },
      onError: () => {
        message.error('Failed to update symbol category');
      },
    }
  );

  const freezeSymbolMutation = useMutation(
    ({ symbolId, reason }: { symbolId: string; reason: string }) =>
      adminApi.freezeSymbol(symbolId, reason),
    {
      onSuccess: () => {
        message.success('Symbol frozen successfully');
        queryClient.invalidateQueries('vts-symbols');
        setSymbolModalVisible(false);
      },
      onError: () => {
        message.error('Failed to freeze symbol');
      },
    }
  );

  // Event handlers
  const handleTrendFilterChange = (key: string, value: any) => {
    setTrendFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleVTSFilterChange = (key: string, value: any) => {
    setVtsFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewTrend = (trend: Trend) => {
    setSelectedTrend(trend);
    trendForm.setFieldsValue(trend);
    setTrendModalVisible(true);
  };

  const handleViewSymbol = (symbol: VTSSymbol) => {
    setSelectedSymbol(symbol);
    setSymbolModalVisible(true);
  };

  const handleApproveTrend = () => {
    if (selectedTrend) {
      approveTrendMutation.mutate(selectedTrend.id);
    }
  };

  const handleOverrideTrend = () => {
    overrideForm.validateFields().then((values) => {
      if (selectedTrend) {
        overrideTrendMutation.mutate({
          trendId: selectedTrend.id,
          data: values,
        });
      }
    });
  };

  const handleUpdateSymbolCategory = (category: string) => {
    if (selectedSymbol) {
      updateSymbolCategoryMutation.mutate({
        symbolId: selectedSymbol.id,
        category,
      });
    }
  };

  const handleFreezeSymbol = (reason: string) => {
    if (selectedSymbol) {
      freezeSymbolMutation.mutate({
        symbolId: selectedSymbol.id,
        reason,
      });
    }
  };

  // Table columns for Trends
  const trendColumns: ColumnsType<Trend>[] = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: Trend) => (
        <Space direction="vertical" size={0}>
          <Text strong>{symbol}</Text>
          {record.alias && <Text type="secondary">{record.alias}</Text>}
        </Space>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <Tooltip title={title}>
          <Text ellipsis style={{ maxWidth: 200 }}>{title}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      render: (region: string) => (
        <Tag color="geekblue" icon={<GlobalOutlined />}>{region}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          ACTIVE: 'green',
          PAUSED: 'orange',
          ARCHIVED: 'gray',
        };
        return (
          <Badge
            status={colors[status as keyof typeof colors] as any}
            text={status}
          />
        );
      },
    },
    {
      title: 'Metrics',
      key: 'metrics',
      render: (_, record: Trend) => (
        <Space direction="vertical" size={0}>
          <Space>
            <FireOutlined style={{ color: '#ff4d4f' }} />
            <Text>Virality: {record.viralityScore}</Text>
          </Space>
          <Space>
            <ThunderboltOutlined style={{ color: '#52c41a' }} />
            <Text>Sentiment: {record.sentimentScore}</Text>
          </Space>
          <Space>
            <BarChartOutlined style={{ color: '#1890ff' }} />
            <Text>Volume: {record.volume}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: Trend) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewTrend(record)}
            />
          </Tooltip>
          {canEditTrends && record.status === 'PAUSED' && (
            <Tooltip title="Resume Trend">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => {/* Handle resume */}}
              />
            </Tooltip>
          )}
          {canEditTrends && record.status === 'ACTIVE' && (
            <Tooltip title="Pause Trend">
              <Button
                type="text"
                icon={<PauseCircleOutlined />}
                onClick={() => {/* Handle pause */}}
              />
            </Tooltip>
          )}
          {canOverrideTrends && (
            <Tooltip title="Override Trend">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedTrend(record);
                  setOverrideModalVisible(true);
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Table columns for VTS Symbols
  const vtsColumns: ColumnsType<VTSSymbol>[] = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: VTSSymbol) => (
        <Space direction="vertical" size={0}>
          <Text strong>{symbol}</Text>
          <Text type="secondary">{record.alias}</Text>
          <Text type="secondary">v{record.version}</Text>
        </Space>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <Tooltip title={title}>
          <Text ellipsis style={{ maxWidth: 200 }}>{title}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      render: (region: string) => (
        <Tag color="geekblue" icon={<GlobalOutlined />}>{region}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          ACTIVE: 'green',
          FROZEN: 'red',
          ARCHIVED: 'gray',
        };
        return (
          <Badge
            status={colors[status as keyof typeof colors] as any}
            text={status}
          />
        );
      },
    },
    {
      title: 'Usage Stats',
      key: 'usage',
      render: (_, record: VTSSymbol) => (
        <Space direction="vertical" size={0}>
          <Text>Bets: {record.usage.bets.toLocaleString()}</Text>
          <Text>Watchlists: {record.usage.watchlists.toLocaleString()}</Text>
          <Text>Orders: {record.usage.marketOrders.toLocaleString()}</Text>
        </Space>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'viralityScore',
      key: 'viralityScore',
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          status={score > 80 ? 'success' : score > 50 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: VTSSymbol) => (
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item
                key="view"
                icon={<EyeOutlined />}
                onClick={() => handleViewSymbol(record)}
              >
                View Details
              </Menu.Item>
              <Menu.Item
                key="category"
                icon={<EditOutlined />}
                onClick={() => handleUpdateSymbolCategory(record.category)}
              >
                Update Category
              </Menu.Item>
              {record.status === 'ACTIVE' && (
                <Menu.Item
                  key="freeze"
                  icon={<PauseCircleOutlined />}
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: 'Freeze Symbol',
                      content: 'Are you sure you want to freeze this symbol?',
                      onOk: () => handleFreezeSymbol('Administrative action'),
                    });
                  }}
                >
                  Freeze Symbol
                </Menu.Item>
              )}
              {record.status === 'FROZEN' && (
                <Menu.Item
                  key="unfreeze"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {/* Handle unfreeze */}}
                >
                  Unfreeze Symbol
                </Menu.Item>
              )}
            </Menu>
          }
        >
          <Button type="text" icon={<EditOutlined />}>
            Actions
          </Button>
        </Dropdown>
      ),
    },
  ];

  if (!canViewTrends) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Trends Management page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Trends Management
            </Title>
            <Text type="secondary">Monitor and manage trading trends and VTS symbols</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (activeTab === 'trends') {
                    refetchTrends();
                  } else {
                    refetchVTS();
                  }
                }}
              >
                Refresh
              </Button>
              {canEditTrends && (
                <Button type="primary" icon={<PlusOutlined />}>
                  Add Trend
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Trends"
              value={trendsData?.total || 0}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Trends"
              value={trendsData?.data?.filter((t: Trend) => t.status === 'ACTIVE').length || 0}
              prefix={<FireOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="VTS Symbols"
              value={vtsData?.total || 0}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Virality"
              value={trendsData?.data?.reduce((acc: number, t: Trend) => acc + t.viralityScore, 0) / (trendsData?.data?.length || 0) || 0}
              precision={1}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <RiseOutlined />
                Market Trends
              </span>
            }
            key="trends"
          >
            {/* Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Input
                    placeholder="Search trends..."
                    prefix={<SearchOutlined />}
                    value={trendFilters.search}
                    onChange={(e) => handleTrendFilterChange('search', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={trendFilters.status}
                    onChange={(value) => handleTrendFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="ACTIVE">Active</Select.Option>
                    <Select.Option value="PAUSED">Paused</Select.Option>
                    <Select.Option value="ARCHIVED">Archived</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Category"
                    value={trendFilters.category}
                    onChange={(value) => handleTrendFilterChange('category', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="STOCKS">Stocks</Select.Option>
                    <Select.Option value="CRYPTO">Crypto</Select.Option>
                    <Select.Option value="FOREX">Forex</Select.Option>
                    <Select.Option value="COMMODITIES">Commodities</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Region"
                    value={trendFilters.region}
                    onChange={(value) => handleTrendFilterChange('region', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="US">US</Select.Option>
                    <Select.Option value="EU">EU</Select.Option>
                    <Select.Option value="ASIA">Asia</Select.Option>
                    <Select.Option value="GLOBAL">Global</Select.Option>
                  </Select>
                </Col>
              </Row>
            </Card>

            {/* Trends Table */}
            <Table
              columns={trendColumns}
              dataSource={trendsData?.data || []}
              loading={trendsLoading}
              rowKey="id"
              pagination={{
                current: trendsData?.page || 1,
                pageSize: trendsData?.limit || 20,
                total: trendsData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} trends`,
                onChange: (page, pageSize) => {
                  setTrendFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1200 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <StarOutlined />
                VTS Symbols
              </span>
            }
            key="vts"
            disabled={!canManageVTS}
          >
            {!canManageVTS ? (
              <Alert
                message="Access Restricted"
                description="You need VTS management permissions to access this section."
                type="warning"
                showIcon
              />
            ) : (
              <>
                {/* VTS Filters */}
                <Card className="mb-4" size="small">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <Input
                        placeholder="Search symbols..."
                        prefix={<SearchOutlined />}
                        value={vtsFilters.search}
                        onChange={(e) => handleVTSFilterChange('search', e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Status"
                        value={vtsFilters.status}
                        onChange={(value) => handleVTSFilterChange('status', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="ACTIVE">Active</Select.Option>
                        <Select.Option value="FROZEN">Frozen</Select.Option>
                        <Select.Option value="ARCHIVED">Archived</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Category"
                        value={vtsFilters.category}
                        onChange={(value) => handleVTSFilterChange('category', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="STOCKS">Stocks</Select.Option>
                        <Select.Option value="CRYPTO">Crypto</Select.Option>
                        <Select.Option value="FOREX">Forex</Select.Option>
                        <Select.Option value="COMMODITIES">Commodities</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Region"
                        value={vtsFilters.region}
                        onChange={(value) => handleVTSFilterChange('region', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="US">US</Select.Option>
                        <Select.Option value="EU">EU</Select.Option>
                        <Select.Option value="ASIA">Asia</Select.Option>
                        <Select.Option value="GLOBAL">Global</Select.Option>
                      </Select>
                    </Col>
                  </Row>
                </Card>

                {/* VTS Symbols Table */}
                <Table
                  columns={vtsColumns}
                  dataSource={vtsData?.data || []}
                  loading={vtsLoading}
                  rowKey="id"
                  pagination={{
                    current: vtsData?.page || 1,
                    pageSize: vtsData?.limit || 20,
                    total: vtsData?.total || 0,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} of ${total} symbols`,
                    onChange: (page, pageSize) => {
                      setVtsFilters(prev => ({
                        ...prev,
                        page,
                        limit: pageSize || 20,
                      }));
                    },
                  }}
                  scroll={{ x: 1200 }}
                />
              </>
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Trend Details Modal */}
      <Modal
        title={
          <Space>
            <RiseOutlined />
            Trend Details: {selectedTrend?.symbol}
          </Space>
        }
        visible={trendModalVisible}
        onCancel={() => setTrendModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTrendModalVisible(false)}>
            Close
          </Button>,
          canApproveTrends && selectedTrend?.status !== 'ACTIVE' && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleApproveTrend}
              loading={approveTrendMutation.isLoading}
            >
              Approve Trend
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedTrend && (
          <Form
            form={trendForm}
            layout="vertical"
            disabled
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Symbol">
                  <Input value={selectedTrend.symbol} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Alias">
                  <Input value={selectedTrend.alias} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Title">
              <Input value={selectedTrend.title} />
            </Form.Item>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Category">
                  <Input value={selectedTrend.category} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Region">
                  <Input value={selectedTrend.region} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Status">
                  <Input value={selectedTrend.status} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Virality Score">
                  <Progress
                    percent={selectedTrend.viralityScore}
                    status={selectedTrend.viralityScore > 80 ? 'success' : 'normal'}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Sentiment Score">
                  <Progress
                    percent={selectedTrend.sentimentScore}
                    status={selectedTrend.sentimentScore > 60 ? 'success' : 'normal'}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Volume">
                  <InputNumber
                    value={selectedTrend.volume}
                    style={{ width: '100%' }}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Description">
              <TextArea rows={3} value={selectedTrend.description} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Override Trend Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            Override Trend: {selectedTrend?.symbol}
          </Space>
        }
        visible={overrideModalVisible}
        onCancel={() => {
          setOverrideModalVisible(false);
          overrideForm.resetFields();
        }}
        onOk={handleOverrideTrend}
        confirmLoading={overrideTrendMutation.isLoading}
        width={600}
      >
        <Form
          form={overrideForm}
          layout="vertical"
          initialValues={{
            newViralityScore: selectedTrend?.viralityScore,
            newSentimentScore: selectedTrend?.sentimentScore,
            newVolume: selectedTrend?.volume,
          }}
        >
          <Form.Item
            label="New Virality Score"
            name="newViralityScore"
            rules={[{ required: true, type: 'number', min: 0, max: 100 }]}
          >
            <InputNumber
              min={0}
              max={100}
              style={{ width: '100%' }}
              formatter={value => `${value}%`}
              parser={value => value!.replace('%', '')}
            />
          </Form.Item>
          <Form.Item
            label="New Sentiment Score"
            name="newSentimentScore"
            rules={[{ required: true, type: 'number', min: 0, max: 100 }]}
          >
            <InputNumber
              min={0}
              max={100}
              style={{ width: '100%' }}
              formatter={value => `${value}%`}
              parser={value => value!.replace('%', '')}
            />
          </Form.Item>
          <Form.Item
            label="New Volume"
            name="newVolume"
            rules={[{ required: true, type: 'number', min: 0 }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>
          <Form.Item
            label="Override Reason"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason for override' }]}
          >
            <TextArea rows={3} placeholder="Explain why this trend is being overridden..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* VTS Symbol Details Modal */}
      <Modal
        title={
          <Space>
            <StarOutlined />
            Symbol Details: {selectedSymbol?.symbol}
          </Space>
        }
        visible={symbolModalVisible}
        onCancel={() => setSymbolModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setSymbolModalVisible(false)}>
            Close
          </Button>,
          canManageVTS && selectedSymbol?.status === 'ACTIVE' && (
            <Popconfirm
              title="Freeze Symbol"
              description="Are you sure you want to freeze this symbol?"
              onConfirm={() => handleFreezeSymbol('Administrative action')}
              okText="Freeze"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button key="freeze" danger icon={<PauseCircleOutlined />}>
                Freeze Symbol
              </Button>
            </Popconfirm>
          ),
        ]}
        width={700}
      >
        {selectedSymbol && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Symbol" span={2}>
              <Text strong>{selectedSymbol.symbol}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Alias" span={2}>
              {selectedSymbol.alias}
            </Descriptions.Item>
            <Descriptions.Item label="Title" span={2}>
              {selectedSymbol.title}
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              <Tag color="blue">{selectedSymbol.category}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              <Tag color="geekblue">{selectedSymbol.region}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={selectedSymbol.status === 'ACTIVE' ? 'success' :
                       selectedSymbol.status === 'FROZEN' ? 'error' : 'default'}
                text={selectedSymbol.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Version">
              v{selectedSymbol.version}
            </Descriptions.Item>
            <Descriptions.Item label="Virality Score" span={2}>
              <Progress
                percent={selectedSymbol.viralityScore}
                status={selectedSymbol.viralityScore > 80 ? 'success' :
                       selectedSymbol.viralityScore > 50 ? 'normal' : 'exception'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Usage Statistics" span={2}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Total Bets"
                    value={selectedSymbol.usage.bets}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Watchlists"
                    value={selectedSymbol.usage.watchlists}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Market Orders"
                    value={selectedSymbol.usage.marketOrders}
                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Col>
              </Row>
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {moment(selectedSymbol.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {moment(selectedSymbol.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Trends;