import React, { useState } from 'react';
import {
  Card, Tabs, Table, Button, Tag, Space, Modal, Form, Input, Select, InputNumber, Switch, message, Statistic, Row, Col, Typography, Popconfirm, Tooltip, Spin, } from 'antd';
import {
  ApiOutlined, PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, DollarOutlined, BarChartOutlined, TrophyOutlined, ReloadOutlined, } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import apiMarketplace from '../../services/api/api-marketplace.api';

const {Title, Text, Paragraph} = Typography;
const {Option} = Select;
const {TextArea} = Input;

const ApiMarketplace: React.FC = () => {
  const [activeTab, setActiveTab] = useState('products');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // Products data from API
  const {data: productsData, isLoading: productsLoading, error: productsError, } = useQuery({
    queryKey: ['admin-api-products'],
    queryFn: () => apiMarketplace.admin.getProducts(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Plans data from API
  const {data: plansData, isLoading: plansLoading, error: plansError, } = useQuery({
    queryKey: ['admin-api-plans'],
    queryFn: () => apiMarketplace.plans.getPlans(),
    refetchInterval: 60000,
  });

  // API Keys data from API
  const {data: keysData, isLoading: keysLoading, error: keysError, } = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: () => apiMarketplace.keys.listKeys(),
    refetchInterval: 60000,
  });

  // Usage statistics from API
  const {data: usageStats, isLoading: usageLoading, error: usageError, } = useQuery({
    queryKey: ['admin-usage-stats'],
    queryFn: () => apiMarketplace.usage.getPlatformUsageOverview(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Billing overview from API
  const {data: billingOverview, isLoading: billingLoading, error: billingError, } = useQuery({
    queryKey: ['admin-billing-overview'],
    queryFn: () => apiMarketplace.billing.getPlatformBillingOverview(),
    refetchInterval: 60000,
  });

  const createProductMutation = useMutation({
    mutationFn: (data: any) => apiMarketplace.products.createProduct(data),
    onSuccess: () => {
      message.success('Product created successfully!');
      setCreateModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries(['admin-api-products']);
    },
    onError: (error: any) => {
      message.error('Failed to create product: ' + error.message);
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiMarketplace.products.updateProduct(id, data),
    onSuccess: () => {
      message.success('Product updated successfully!');
      setCreateModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      queryClient.invalidateQueries(['admin-api-products']);
    },
    onError: (error: any) => {
      message.error('Failed to update product: ' + error.message);
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => apiMarketplace.products.deleteProduct(id),
    onSuccess: () => {
      message.success('Product deleted successfully!');
      queryClient.invalidateQueries(['admin-api-products']);
    },
    onError: (error: any) => {
      message.error('Failed to delete product: ' + error.message);
    },
  });

  const getUsageChartData = () => {
    const data = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day');
      data.push({
        date: date.format('MM/DD'),
        requests: Math.floor(Math.random() * 50000) + 10000,
        revenue: Math.floor(Math.random() * 5000) + 1000,
      });
    }
    return data;
  };

  const handleCreateProduct = async (values: any) => {
    if (editingRecord) {
      updateProductMutation.mutate({ id: editingRecord.id, data: values });
    } else {
      createProductMutation.mutate(values);
    }
  };

  const handleEditProduct = (record: any) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setCreateModalVisible(true);
  };

  const handleDeleteProduct = (id: string) => {
    deleteProductMutation.mutate(id);
  };

  // Products Tab
  const productsColumns = [
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <ApiOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>{name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.slug}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'API Keys',
      dataIndex: 'totalKeys',
      key: 'totalKeys',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: 'Usage',
      dataIndex: 'totalUsage',
      key: 'totalUsage',
      render: (usage: number) => usage.toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Tooltip title="Edit Product">
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditProduct(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this product?"
            description="This action cannot be undone."
            onConfirm={() => handleDeleteProduct(record.id)}
          >
            <Tooltip title="Delete Product">
              <Button icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Plans Tab
  const plansColumns = [
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
    },
    {
      title: 'Plan Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Text code>{code}</Text>,
    },
    {
      title: 'Monthly Fee (ZAR)',
      dataIndex: 'monthlyFee',
      key: 'monthlyFee',
      render: (fee: number) => `R${fee.toLocaleString()}`,
    },
    {
      title: 'Rate Limit',
      dataIndex: 'rateLimit',
      key: 'rateLimit',
      render: (limit: number) => `${limit}/min`,
    },
    {
      title: 'Quota',
      dataIndex: 'quota',
      key: 'quota',
      render: (quota: number) => quota.toLocaleString(),
    },
    {
      title: 'Active Keys',
      dataIndex: 'activeKeys',
      key: 'activeKeys',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button icon={<EditOutlined />} size="small" />
          <Button icon={<DeleteOutlined />} danger size="small" />
        </Space>
      ),
    },
  ];

  // Keys Tab
  const keysColumns = [
    {
      title: 'Customer',
      dataIndex: 'customerEmail',
      key: 'customerEmail',
      render: (email: string, record: any) => (
        <div>
          <div>{email}</div>
          <Tag color={record.customerType === 'USER' ? 'blue' : 'purple'}>
            {record.customerType}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'planName',
      key: 'planName',
    },
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
    },
    {
      title: 'Usage',
      dataIndex: 'usageCount',
      key: 'usageCount',
      render: (count: number) => count.toLocaleString(),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsed',
      key: 'lastUsed',
      render: (date: string) => dayjs(date).fromNow(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space>
          <Button size="small">View Details</Button>
          <Button size="small" danger>Revoke</Button>
        </Space>
      ),
    },
  ];

  const renderCreateEditModal = () => {
    const isEdit = !!editingRecord;

    return (
      <Modal
        title={isEdit ? 'Edit Product' : 'Create Product'}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProduct}
        >
          <Form.Item
            label="Product Name"
            name="name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="Social Mood Index API" />
          </Form.Item>

          <Form.Item
            label="Slug"
            name="slug"
            rules={[{ required: true, message: 'Please enter product slug' }]}
          >
            <Input placeholder="smi-api" />
          </Form.Item>

          <Form.Item
            label="Category"
            name="category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select placeholder="Select category">
              <Option value="SMI">Social Mood Index</Option>
              <Option value="VTS">VTS Symbol Feed</Option>
              <Option value="VIRAL_SCORE">ViralScore</Option>
              <Option value="SENTIMENT">Sentiment</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea rows={3} placeholder="Product description" />
          </Form.Item>

          <Form.Item
            label="Default Plan"
            name="defaultPlan"
            rules={[{ required: true, message: 'Please select default plan' }]}
          >
            <Select placeholder="Select default plan">
              <Option value="starter">Starter</Option>
              <Option value="pro">Pro</Option>
              <Option value="institutional">Institutional</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Features"
            name="features"
          >
            <Select mode="tags" placeholder="Add features" />
          </Form.Item>

          <Form.Item
            label="Active"
            name="isActive"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {isEdit ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                setEditingRecord(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    );
  };

  const tabItems = [
    {
      key: 'products',
      label: (
        <span>
          <ApiOutlined />
          Products
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Title level={4}>API Products</Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => queryClient.invalidateQueries(['admin-api-products'])}
                loading={productsLoading}
              >
                Refresh
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Product
              </Button>
            </Space>
          </div>
          {productsError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Title level={4}>Failed to load products</Title>
              <Paragraph>Please try again later.</Paragraph>
              <Button
                type="primary"
                onClick={() => queryClient.invalidateQueries(['admin-api-products'])}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Table
              columns={productsColumns}
              dataSource={productsData?.products || []}
              rowKey="id"
              loading={productsLoading}
              pagination={{ pageSize: 10 }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'plans',
      label: (
        <span>
          <TrophyOutlined />
          Pricing Plans
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Title level={4}>Pricing Plans</Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries(['admin-api-plans'])}
              loading={plansLoading}
            >
              Refresh
            </Button>
          </div>
          {plansError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Title level={4}>Failed to load plans</Title>
              <Paragraph>Please try again later.</Paragraph>
              <Button
                type="primary"
                onClick={() => queryClient.invalidateQueries(['admin-api-plans'])}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Table
              columns={plansColumns}
              dataSource={plansData || []}
              rowKey="id"
              loading={plansLoading}
              pagination={{ pageSize: 10 }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'keys',
      label: (
        <span>
          <KeyOutlined />
          API Keys
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Title level={4}>API Keys Management</Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries(['admin-api-keys'])}
              loading={keysLoading}
            >
              Refresh
            </Button>
          </div>
          {keysError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Title level={4}>Failed to load API keys</Title>
              <Paragraph>Please try again later.</Paragraph>
              <Button
                type="primary"
                onClick={() => queryClient.invalidateQueries(['admin-api-keys'])}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Table
              columns={keysColumns}
              dataSource={keysData || []}
              rowKey="id"
              loading={keysLoading}
              pagination={{ pageSize: 10 }}
            />
          )}
        </div>
      ),
    },
    {
      key: 'usage',
      label: (
        <span>
          <BarChartOutlined />
          Usage Analytics
        </span>
      ),
      children: (
        <div>
          {usageLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <p>Loading usage statistics...</p>
            </div>
          ) : usageError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Title level={4}>Failed to load usage statistics</Title>
              <Paragraph>Please try again later.</Paragraph>
              <Button
                type="primary"
                onClick={() => queryClient.invalidateQueries(['admin-usage-stats'])}
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Total Requests"
                      value={usageStats?.totalRequests || 0}
                      prefix={<BarChartOutlined />}
                      formatter={(value) => `${Number(value).toLocaleString()}`}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Active API Keys"
                      value={usageStats?.uniqueKeys || 0}
                      prefix={<KeyOutlined />}
                      formatter={(value) => `${Number(value).toLocaleString()}`}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Total Users"
                      value={usageStats?.totalUsers || 0}
                      prefix={<TrophyOutlined />}
                      formatter={(value) => `${Number(value).toLocaleString()}`}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Total Brokers"
                      value={usageStats?.totalBrokers || 0}
                      prefix={<DollarOutlined />}
                      formatter={(value) => `${Number(value).toLocaleString()}`}
                    />
                  </Card>
                </Col>
              </Row>
              <Card title="Usage Trends">
                <Line
                  data={getUsageChartData()}
                  xField="date"
                  yField="requests"
                  smooth
                  color="#4B0082"
                  height={300}
                />
              </Card>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'billing',
      label: (
        <span>
          <DollarOutlined />
          Billing
        </span>
      ),
      children: (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <Title level={4}>Billing Management</Title>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => queryClient.invalidateQueries(['admin-billing-overview'])}
              loading={billingLoading}
            >
              Refresh
            </Button>
          </div>
          <Paragraph>
            Monitor revenue, manage invoices, and handle billing operations.
          </Paragraph>
          {billingLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
              <p>Loading billing overview...</p>
            </div>
          ) : billingError ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Title level={4}>Failed to load billing data</Title>
              <Paragraph>Please try again later.</Paragraph>
              <Button
                type="primary"
                onClick={() => queryClient.invalidateQueries(['admin-billing-overview'])}
              >
                Retry
              </Button>
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Total Revenue">
                  <Statistic
                    value={billingOverview?.totalRevenue || 0}
                    prefix={<DollarOutlined />}
                    formatter={(value) => `R${Number(value).toLocaleString()}`}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Pending Invoices">
                  <Statistic
                    value={billingOverview?.pendingInvoices || 0}
                    prefix={<DollarOutlined />}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Paid Invoices">
                  <Statistic
                    value={billingOverview?.paidInvoices || 0}
                    prefix={<DollarOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Overdue Invoices">
                  <Statistic
                    value={billingOverview?.overdueInvoices || 0}
                    prefix={<DollarOutlined />}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Card>
              </Col>
            </Row>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>API Marketplace Management</Title>
      <Paragraph>
        Manage API products, pricing plans, API keys, usage analytics, and billing for the ViralFX API Marketplace.
      </Paragraph>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Card>

      {renderCreateEditModal()}
    </div>
  );
};

export default ApiMarketplace;