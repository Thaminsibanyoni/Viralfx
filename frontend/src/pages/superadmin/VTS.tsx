import React, { useState } from 'react';
import {
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Upload, UploadProps, Empty, Spin, } from 'antd';
import {
  DollarOutlined, StarOutlined, ThunderboltOutlined, EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, UploadOutlined, DownloadOutlined, MergeCellsOutlined, ForkOutlined, TagsOutlined, GlobalOutlined, BarChartOutlined, FireOutlined, ClockCircleOutlined, CheckCircleOutlined, PauseCircleOutlined, ExclamationCircleOutlined, SettingOutlined, LineChartOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { VTSSymbol } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;

interface VTSSymbolFilters {
  page: number;
  limit: number;
  category?: string;
  region?: string;
  status?: string;
  search?: string;
}

interface MergeFormData {
  sourceId: string;
  targetId: string;
  reason: string;
}

interface CreateSymbolData {
  symbol: string;
  title: string;
  alias: string;
  category: string;
  region: string;
  description?: string;
}

const VTS: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('symbols');
  const [vtsFilters, setVtsFilters] = useState<VTSSymbolFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedSymbol, setSelectedSymbol] = useState<VTSSymbol | null>(null);
  const [symbolModalVisible, setSymbolModalVisible] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [mergeModalVisible, setMergeModalVisible] = useState<boolean>(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState<boolean>(false);
  const [bulkActionsModalVisible, setBulkActionsModalVisible] = useState<boolean>(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Forms
  const [createForm] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [categoryForm] = Form.useForm();

  // Permissions
  const canViewVTS = checkPermission('vts:view');
  const canManageVTS = checkPermission('vts:manage');
  const canMergeSymbols = checkPermission('vts:merge');
  const canEditCategories = checkPermission('vts:categories');
  const canImportExport = checkPermission('vts:import_export');

  // Data fetching
  const {data: vtsData, isLoading: vtsLoading, refetch: refetchVTS, } = useQuery(
    ['vts-symbols', vtsFilters],
    () => adminApi.getVTSSymbols(vtsFilters),
    {
      enabled: canViewVTS,
      keepPreviousData: true,
    }
  );

  // Mutations
  const mergeSymbolsMutation = useMutation(
    (data: MergeFormData) => adminApi.mergeSymbols(data.sourceId, data.targetId),
    {
      onSuccess: () => {
        message.success('Symbols merged successfully');
        queryClient.invalidateQueries('vts-symbols');
        setMergeModalVisible(false);
        mergeForm.resetFields();
      },
      onError: () => {
        message.error('Failed to merge symbols');
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
        setCategoryModalVisible(false);
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
        setSelectedRowKeys([]);
      },
      onError: () => {
        message.error('Failed to freeze symbol');
      },
    }
  );

  const unfreezeSymbolMutation = useMutation(
    (symbolId: string) => adminApi.unfreezeSymbol(symbolId),
    {
      onSuccess: () => {
        message.success('Symbol unfrozen successfully');
        queryClient.invalidateQueries('vts-symbols');
        setSelectedRowKeys([]);
      },
      onError: () => {
        message.error('Failed to unfreeze symbol');
      },
    }
  );

  // Event handlers
  const handleVTSFilterChange = (key: string, value: any) => {
    setVtsFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewSymbol = (symbol: VTSSymbol) => {
    setSelectedSymbol(symbol);
    setSymbolModalVisible(true);
  };

  const handleMergeSymbols = () => {
    mergeForm.validateFields().then((values) => {
      mergeSymbolsMutation.mutate(values);
    });
  };

  const handleUpdateCategory = (category: string) => {
    if (selectedSymbol) {
      updateSymbolCategoryMutation.mutate({
        symbolId: selectedSymbol.id,
        category,
      });
    }
  };

  const handleBulkFreeze = (reason: string) => {
    const promises = selectedRowKeys.map(key =>
      freezeSymbolMutation.mutateAsync({
        symbolId: key as string,
        reason,
      })
    );

    Promise.all(promises).then(() => {
      message.success(`${selectedRowKeys.length} symbols frozen successfully`);
      setBulkActionsModalVisible(false);
      setSelectedRowKeys([]);
    }).catch(() => {
      message.error('Some symbols failed to freeze');
    });
  };

  const handleBulkUnfreeze = () => {
    const promises = selectedRowKeys.map(key =>
      unfreezeSymbolMutation.mutateAsync(key as string)
    );

    Promise.all(promises).then(() => {
      message.success(`${selectedRowKeys.length} symbols unfrozen successfully`);
      setSelectedRowKeys([]);
    }).catch(() => {
      message.error('Some symbols failed to unfreeze');
    });
  };

  // Row selection
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys);
    },
    getCheckboxProps: (record: VTSSymbol) => ({
      disabled: record.status === 'ARCHIVED',
    }),
  };

  // Upload props
  const uploadProps: UploadProps = {
    name: 'file',
    action: '/api/v1/admin/vts/import',
    headers: {
      authorization: `Bearer ${localStorage.getItem('admin_access_token')}`,
    },
    onChange(info) {
      if (info.file.status === 'done') {
        message.success(`${info.file.name} file imported successfully`);
        refetchVTS();
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file import failed.`);
      }
    },
  };

  // Table columns
  const vtsColumns: ColumnType<VTSSymbol>[] = [
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
      title: 'Virality Score',
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
      sorter: (a, b) => a.viralityScore - b.viralityScore,
    },
    {
      title: 'Usage Stats',
      key: 'usage',
      render: (_, record: VTSSymbol) => (
        <Space direction="vertical" size={0}>
          <Space>
            <DollarOutlined style={{ color: '#52c41a' }} />
            <Text>Bets: {record.usage.bets.toLocaleString()}</Text>
          </Space>
          <Space>
            <StarOutlined style={{ color: '#1890ff' }} />
            <Text>Watchlists: {record.usage.watchlists.toLocaleString()}</Text>
          </Space>
          <Space>
            <BarChartOutlined style={{ color: '#722ed1' }} />
            <Text>Orders: {record.usage.marketOrders.toLocaleString()}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => moment(date).format('YYYY-MM-DD'),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
              {canEditCategories && (
                <Menu.Item
                  key="category"
                  icon={<TagsOutlined />}
                  onClick={() => {
                    setSelectedSymbol(record);
                    categoryForm.setFieldsValue({ category: record.category });
                    setCategoryModalVisible(true);
                  }}
                >
                  Update Category
                </Menu.Item>
              )}
              {canMergeSymbols && (
                <Menu.Item
                  key="merge"
                  icon={<MergeCellsOutlined />}
                  onClick={() => {
                    mergeForm.setFieldsValue({ sourceId: record.id });
                    setMergeModalVisible(true);
                  }}
                >
                  Merge Symbol
                </Menu.Item>
              )}
              {record.status === 'ACTIVE' && (
                <Menu.Item
                  key="freeze"
                  icon={<PauseCircleOutlined />}
                  danger
                  onClick={() => {
                    Modal.confirm({
                      title: 'Freeze Symbol',
                      content: 'Are you sure you want to freeze this symbol?',
                      onOk: () => freezeSymbolMutation.mutate({
                        symbolId: record.id,
                        reason: 'Administrative action',
                      }),
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
                  onClick={() => unfreezeSymbolMutation.mutate(record.id)}
                >
                  Unfreeze Symbol
                </Menu.Item>
              )}
            </Menu>
          }
        >
          <Button type="text" icon={<SettingOutlined />}>
            Actions
          </Button>
        </Dropdown>
      ),
    },
  ];

  if (!canViewVTS) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the VTS Management page."
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
              VTS Management
            </Title>
            <Text type="secondary">Manage Viral Trading Symbols and market data</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchVTS()}
              >
                Refresh
              </Button>
              {canImportExport && (
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>Import Symbols</Button>
                </Upload>
              )}
              {canImportExport && (
                <Button icon={<DownloadOutlined />}>
                  Export Data
                </Button>
              )}
              {canManageVTS && (
                <Button type="primary" icon={<PlusOutlined />}>
                  Add Symbol
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
              title="Total Symbols"
              value={vtsData?.total || 0}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Symbols"
              value={vtsData?.data?.filter((s: VTSSymbol) => s.status === 'ACTIVE').length || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Frozen Symbols"
              value={vtsData?.data?.filter((s: VTSSymbol) => s.status === 'FROZEN').length || 0}
              prefix={<PauseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Virality"
              value={vtsData?.data?.reduce((acc: number, s: VTSSymbol) => acc + s.viralityScore, 0) / (vtsData?.data?.length || 0) || 0}
              precision={1}
              suffix="%"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
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
              <Select.Option value="INDICES">Indices</Select.Option>
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

      {/* Bulk Actions */}
      {selectedRowKeys.length > 0 && (
        <Card className="mb-4" size="small">
          <Row justify="space-between" align="middle">
            <Col>
              <Text>
                {selectedRowKeys.length} symbols selected
              </Text>
            </Col>
            <Col>
              <Space>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>
                  Clear Selection
                </Button>
                {canManageVTS && (
                  <>
                    <Button
                      size="small"
                      icon={<PauseCircleOutlined />}
                      onClick={() => setBulkActionsModalVisible(true)}
                    >
                      Bulk Freeze
                    </Button>
                    <Button
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={handleBulkUnfreeze}
                    >
                      Bulk Unfreeze
                    </Button>
                  </>
                )}
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      {/* Symbols Table */}
      <Card>
        <Table
          columns={vtsColumns}
          dataSource={vtsData?.data || []}
          loading={vtsLoading}
          rowKey="id"
          rowSelection={canManageVTS ? rowSelection : undefined}
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
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Symbol Details Modal */}
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
        ]}
        width={800}
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

      {/* Merge Symbols Modal */}
      <Modal
        title={
          <Space>
            <MergeCellsOutlined />
            Merge Symbols
          </Space>
        }
        visible={mergeModalVisible}
        onCancel={() => {
          setMergeModalVisible(false);
          mergeForm.resetFields();
        }}
        onOk={handleMergeSymbols}
        confirmLoading={mergeSymbolsMutation.isLoading}
        width={600}
      >
        <Form
          form={mergeForm}
          layout="vertical"
        >
          <Form.Item
            label="Source Symbol ID"
            name="sourceId"
            rules={[{ required: true, message: 'Please enter the source symbol ID' }]}
          >
            <Input placeholder="Source symbol ID (will be merged into target)" />
          </Form.Item>
          <Form.Item
            label="Target Symbol ID"
            name="targetId"
            rules={[{ required: true, message: 'Please enter the target symbol ID' }]}
          >
            <Input placeholder="Target symbol ID (will remain active)" />
          </Form.Item>
          <Form.Item
            label="Merge Reason"
            name="reason"
            rules={[{ required: true, message: 'Please provide a reason for merging' }]}
          >
            <TextArea rows={3} placeholder="Explain why these symbols are being merged..." />
          </Form.Item>
        </Form>
        <Alert
          message="Warning"
          description="Merging symbols is irreversible. The source symbol will be archived and all references will be redirected to the target symbol."
          type="warning"
          showIcon
          className="mt-4"
        />
      </Modal>

      {/* Update Category Modal */}
      <Modal
        title={
          <Space>
            <TagsOutlined />
            Update Symbol Category
          </Space>
        }
        visible={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        onOk={() => {
          const category = categoryForm.getFieldValue('category');
          handleUpdateCategory(category);
        }}
        confirmLoading={updateSymbolCategoryMutation.isLoading}
      >
        <Form
          form={categoryForm}
          layout="vertical"
        >
          <Form.Item
            label="New Category"
            name="category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select placeholder="Select new category">
              <Select.Option value="STOCKS">Stocks</Select.Option>
              <Select.Option value="CRYPTO">Crypto</Select.Option>
              <Select.Option value="FOREX">Forex</Select.Option>
              <Select.Option value="COMMODITIES">Commodities</Select.Option>
              <Select.Option value="INDICES">Indices</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Bulk Actions Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            Bulk Actions
          </Space>
        }
        visible={bulkActionsModalVisible}
        onCancel={() => setBulkActionsModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>Selected {selectedRowKeys.length} symbols</Text>
          <Button
            type="primary"
            danger
            block
            onClick={() => {
              Modal.confirm({
                title: 'Bulk Freeze Symbols',
                content: `Are you sure you want to freeze ${selectedRowKeys.length} symbols?`,
                onOk: () => handleBulkFreeze('Administrative bulk freeze'),
              });
            }}
          >
            Freeze All Selected
          </Button>
          <Button block onClick={handleBulkUnfreeze}>
            Unfreeze All Selected
          </Button>
          <Button onClick={() => setBulkActionsModalVisible(false)}>
            Cancel
          </Button>
        </Space>
      </Modal>
    </div>
  );
};

export default VTS;