import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space, Tooltip, Progress, Statistic, Row, Col, message, Popconfirm, Typography, Alert, Divider, } from 'antd';
import {
  PlusOutlined, KeyOutlined, DeleteOutlined, SyncOutlined, EyeInvisibleOutlined, EyeOutlined, CopyOutlined, ExclamationCircleOutlined, ThunderboltOutlined, CalendarOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Line } from '@ant-design/plots';
import dayjs from 'dayjs';
import apiMarketplace, { ApiKey, ApiPlan } from '../../services/api/api-marketplace.api';
import { useNavigate } from 'react-router-dom';
import styles from './Keys.module.scss';

const {Title, Text, Paragraph} = Typography;
const {Option} = Select;
const {TextArea} = Input;

const Keys: React.FC = () => {
  const _navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newKeyData, setNewKeyData] = useState<any>(null);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [form] = Form.useForm();

  // Fetch API keys
  const {data: keysData, isLoading: keysLoading, error: keysError, } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiMarketplace.keys.getKeys(),
  });

  // Fetch products for plan selection
  const {data: productsData, } = useQuery({
    queryKey: ['api-products-plans'],
    queryFn: async () => {
      const products = await apiMarketplace.products.getProducts();
      return products.products;
    },
  });

  // Create API key mutation
  const createKeyMutation = useMutation({
    mutationFn: apiMarketplace.keys.createKey,
    onSuccess: (data) => {
      message.success('API key created successfully!');
      setCreateModalVisible(false);
      setNewKeyData(data);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create API key');
    },
  });

  // Revoke key mutation
  const revokeKeyMutation = useMutation({
    mutationFn: apiMarketplace.keys.revokeKey,
    onSuccess: () => {
      message.success('API key revoked successfully!');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setSelectedKey(null);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to revoke API key');
    },
  });

  // Rotate key mutation
  const rotateKeyMutation = useMutation({
    mutationFn: apiMarketplace.keys.rotateKey,
    onSuccess: (data) => {
      message.success('API key rotated successfully!');
      setNewKeyData(data);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to rotate API key');
    },
  });

  const handleCreateKey = async (values: any) => {
    createKeyMutation.mutate(values);
  };

  const handleRevokeKey = (key: ApiKey) => {
    revokeKeyMutation.mutate(key.id);
  };

  const handleRotateKey = (key: ApiKey) => {
    rotateKeyMutation.mutate(key.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('Copied to clipboard!');
    });
  };

  const _formatKeyDisplay = (key: string) => {
    if (key.length <= 8) return key;
    return `${key.substring(0, 8)}...`;
  };

  const getStatusColor = (key: ApiKey) => {
    if (key.revoked) return 'error';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'warning';
    return 'success';
  };

  const getStatusText = (key: ApiKey) => {
    if (key.revoked) return 'Revoked';
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return 'Expired';
    return 'Active';
  };

  const calculateUsagePercentage = (key: ApiKey) => {
    if (!key.plan?.quota) return 0;
    return Math.round((key.usageCount / key.plan.quota) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  // Table columns
  const columns = [
    {
      title: 'Label',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, record: ApiKey) => (
        <Space>
          <KeyOutlined />
          <div>
            <div style={{ fontWeight: 500 }}>
              {label || `API Key ${record.id.substring(0, 8)}`}
            </div>
            {record.isSandbox && <Tag color="orange">Sandbox</Tag>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Plan',
      dataIndex: ['plan', 'name'],
      key: 'plan',
      render: (planName: string, record: ApiKey) => (
        <div>
          <div style={{ fontWeight: 500 }}>{planName}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.plan?.rateLimit} requests/min
          </Text>
        </div>
      ),
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (record: ApiKey) => {
        const percentage = calculateUsagePercentage(record);
        const color = getUsageColor(percentage);

        return (
          <div style={{ width: 200 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 12 }}>
                {record.usageCount.toLocaleString()} calls
              </Text>
              {record.plan?.quota && (
                <Text style={{ fontSize: 12 }}>
                  of {record.plan.quota.toLocaleString()}
                </Text>
              )}
            </div>
            {record.plan?.quota && (
              <Progress
                percent={percentage}
                size="small"
                strokeColor={color}
                showInfo={false}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: ApiKey) => (
        <Tag color={getStatusColor(record)}>
          {getStatusText(record)}
        </Tag>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (date: string) => (
        <Text type="secondary">
          {date ? dayjs(date).fromNow() : 'Never'}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ApiKey) => (
        <Space>
          <Tooltip title="Rotate Key">
            <Button
              icon={<SyncOutlined />}
              onClick={() => handleRotateKey(record)}
              disabled={record.revoked}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to revoke this API key?"
            description="This action cannot be undone."
            onConfirm={() => handleRevokeKey(record)}
            disabled={record.revoked}
          >
            <Tooltip title="Revoke Key">
              <Button
                icon={<DeleteOutlined />}
                danger
                disabled={record.revoked}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Generate usage chart data for selected key
  const getUsageChartData = () => {
    if (!selectedKey) return [];

    // Mock data for demonstration - replace with actual API call
    const data = [];
    const now = dayjs();

    for (let i = 29; i >= 0; i--) {
      const date = now.subtract(i, 'day');
      data.push({
        date: date.format('YYYY-MM-DD'),
        requests: Math.floor(Math.random() * 1000) + 100,
      });
    }

    return data;
  };

  return (
    <div className={styles.keys}>
      <div className={styles.header}>
        <div>
          <Title level={2} className={styles.title}>
            <KeyOutlined /> API Keys
          </Title>
          <Paragraph className={styles.description}>
            Manage your API keys, monitor usage, and control access to ViralFX APIs.
          </Paragraph>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
          size="large"
        >
          Create API Key
        </Button>
      </div>

      {/* Statistics */}
      <Row gutter={[24, 24]} className={styles.stats}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Keys"
              value={keysData?.filter(k => !k.revoked).length || 0}
              prefix={<KeyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Requests This Month"
              value={keysData?.reduce((sum, k) => sum + k.usageCount, 0) || 0}
              prefix={<ThunderboltOutlined />}
              formatter={(value) => `${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Usage This Week"
              value={Math.floor(Math.random() * 50000) + 10000}
              prefix={<CalendarOutlined />}
              formatter={(value) => `${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
      </Row>

      {/* API Keys Table */}
      <Card className={styles.tableCard}>
        <Table
          columns={columns}
          dataSource={keysData}
          loading={keysLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
          onRow={(record) => ({
            onClick: () => setSelectedKey(record),
            className: selectedKey?.id === record.id ? styles.selectedRow : '',
          })}
        />
      </Card>

      {/* Key Details Modal */}
      {selectedKey && (
        <Modal
          title={`API Key Details - ${selectedKey.label || 'Unnamed Key'}`}
          open={!!selectedKey}
          onCancel={() => setSelectedKey(null)}
          footer={null}
          width={800}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Key Information" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>Key ID:</Text>
                    <div>
                      <Text code>{selectedKey.id}</Text>
                      <Button
                        type="link"
                        icon={<CopyOutlined />}
                        size="small"
                        onClick={() => copyToClipboard(selectedKey.id)}
                      />
                    </div>
                  </div>
                  <div>
                    <Text strong>Plan:</Text>
                    <div>{selectedKey.plan?.name}</div>
                  </div>
                  <div>
                    <Text strong>Status:</Text>
                    <Tag color={getStatusColor(selectedKey)}>
                      {getStatusText(selectedKey)}
                    </Tag>
                  </div>
                  <div>
                    <Text strong>Created:</Text>
                    <div>{dayjs(selectedKey.createdAt).format('YYYY-MM-DD HH:mm:ss')}</div>
                  </div>
                  <div>
                    <Text strong>Last Used:</Text>
                    <div>
                      {selectedKey.lastUsedAt
                        ? dayjs(selectedKey.lastUsedAt).format('YYYY-MM-DD HH:mm:ss')
                        : 'Never'}
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card title="Usage Analytics" size="small">
                {selectedKey.plan?.quota ? (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text strong>Monthly Usage</Text>
                      <Text>{calculateUsagePercentage(selectedKey)}%</Text>
                    </div>
                    <Progress
                      percent={calculateUsagePercentage(selectedKey)}
                      strokeColor={getUsageColor(calculateUsagePercentage(selectedKey))}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text type="secondary">
                        {selectedKey.usageCount.toLocaleString()} used
                      </Text>
                      <Text type="secondary">
                        {selectedKey.plan.quota.toLocaleString()} total
                      </Text>
                    </div>
                  </div>
                ) : (
                  <Alert
                    message="Unlimited Usage"
                    description="This plan has unlimited API calls"
                    type="info"
                    showIcon
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
            <Col span={24}>
              <Card title="30-Day Usage Trend" size="small">
                <Line
                  data={getUsageChartData()}
                  xField="date"
                  yField="requests"
                  smooth
                  color="#4B0082"
                  height={200}
                />
              </Card>
            </Col>
          </Row>
        </Modal>
      )}

      {/* Create Key Modal */}
      <Modal
        title="Create New API Key"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateKey}
        >
          <Form.Item
            label="Plan"
            name="planId"
            rules={[{ required: true, message: 'Please select a plan' }]}
          >
            <Select placeholder="Select a plan" size="large">
              {productsData?.map((product) => (
                <Select.OptGroup key={product.id} label={product.name}>
                  {product.plans?.map((plan) => (
                    <Option key={plan.id} value={plan.id}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{plan.name}</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {plan.monthlyFee ? `R${plan.monthlyFee}/month` : 'Custom pricing'} • {plan.rateLimit} requests/min
                          {plan.quota && ` • ${plan.quota.toLocaleString()} calls/month`}
                        </Text>
                      </div>
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Label"
            name="label"
            help="A friendly name to identify this API key"
          >
            <Input placeholder="Production API Key" size="large" />
          </Form.Item>

          <Form.Item
            label="IP Whitelist"
            name="ipWhitelist"
            help="Optional: List of IP addresses allowed to use this key (CIDR notation)"
          >
            <Select
              mode="tags"
              placeholder="Enter IP addresses"
              style={{ width: '100%' }}
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Sandbox Mode"
            name="isSandbox"
            valuePropName="checked"
            help="Enable sandbox mode for testing without affecting production usage"
          >
            <Switch />
          </Form.Item>

          <Divider />

          <Alert
            message="Important Security Notice"
            description="Your API key will be displayed only once after creation. Save it securely as it cannot be retrieved again."
            type="warning"
            icon={<ExclamationCircleOutlined />}
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createKeyMutation.isLoading}
                size="large"
              >
                Create API Key
              </Button>
              <Button
                onClick={() => setCreateModalVisible(false)}
                size="large"
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* New Key Display Modal */}
      {newKeyData && (
        <Modal
          title="API Key Created Successfully!"
          open={!!newKeyData}
          onCancel={() => setNewKeyData(null)}
          footer={[
            <Button key="copy" icon={<CopyOutlined />} onClick={() => copyToClipboard(newKeyData.key)}>
              Copy Key
            </Button>,
            <Button key="done" type="primary" onClick={() => setNewKeyData(null)}>
              Done
            </Button>,
          ]}
          width={600}
        >
          <Alert
            message="Save Your API Key"
            description="This is the only time your API key will be displayed. Save it securely now."
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Card>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Your API Key:</Text>
                <div className={styles.keyDisplay}>
                  <Input
                    value={newKeyData.key}
                    readOnly
                    size="large"
                    style={{ fontFamily: 'monospace', fontSize: 16 }}
                    suffix={
                      <Button
                        type="link"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(newKeyData.key)}
                      />
                    }
                  />
                </div>
              </div>

              <div>
                <Text strong>Key Details:</Text>
                <ul>
                  <li>Plan: {newKeyData.apiKey.plan.name}</li>
                  <li>Label: {newKeyData.apiKey.label || 'None'}</li>
                  <li>Rate Limit: {newKeyData.apiKey.plan.rateLimit} requests/minute</li>
                  {newKeyData.apiKey.plan.quota && (
                    <li>Monthly Quota: {newKeyData.apiKey.plan.quota.toLocaleString()} calls</li>
                  )}
                </ul>
              </div>
            </Space>
          </Card>
        </Modal>
      )}
    </div>
  );
};

export default Keys;