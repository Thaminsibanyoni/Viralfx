import React, { useState } from 'react';
import { Card, Typography, Table, Tag, Button, Switch, Space, message, Modal, Form, Input, Select, Spin, Badge, Tooltip } from 'antd';
import { ApiOutlined, PlusOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiMarketplace from '../../services/api/api-marketplace.api';

const {Title, Paragraph, Text} = Typography;
const {Option} = Select;

const Webhooks: React.FC = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const {data: webhooksData, isLoading, error, } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiMarketplace.webhooks.getWebhooks(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const createWebhookMutation = useMutation({
    mutationFn: (data: any) => apiMarketplace.webhooks.createWebhook(data),
    onSuccess: () => {
      message.success('Webhook created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      queryClient.invalidateQueries(['webhooks']);
    },
    onError: (error: any) => {
      message.error('Failed to create webhook: ' + error.message);
    },
  });

  const updateWebhookMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiMarketplace.webhooks.updateWebhook(id, data),
    onSuccess: () => {
      message.success('Webhook updated successfully');
      queryClient.invalidateQueries(['webhooks']);
    },
    onError: (error: any) => {
      message.error('Failed to update webhook: ' + error.message);
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (id: string) => apiMarketplace.webhooks.deleteWebhook(id),
    onSuccess: () => {
      message.success('Webhook deleted successfully');
      queryClient.invalidateQueries(['webhooks']);
    },
    onError: (error: any) => {
      message.error('Failed to delete webhook: ' + error.message);
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: ({ id, event }: { id: string; event?: string }) => apiMarketplace.webhooks.testWebhook(id, event),
    onSuccess: (data) => {
      message.success(data.success ? 'Test webhook sent successfully' : 'Test webhook failed');
      setTestModalVisible(false);
    },
    onError: (error: any) => {
      message.error('Failed to test webhook: ' + error.message);
    },
  });

  const columns = [
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      render: (url: string) => (
        <Tooltip title={url}>
          <Text code style={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {url}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Events',
      dataIndex: 'events',
      key: 'events',
      render: (events: string[]) => (
        <div>
          {events.map(event => (
            <Tag key={event} color="blue" style={{ marginBottom: 4 }}>
              {event}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: any) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleWebhook(record.id, checked)}
          loading={updateWebhookMutation.isLoading}
        />
      ),
    },
    {
      title: 'Last Delivery',
      key: 'lastDelivery',
      render: (record: any) => (
        <div>
          <Badge
            status={record.lastDeliveryStatus === 'success' ? 'success' : record.lastDeliveryStatus === 'failed' ? 'error' : 'default'}
          />
          <span style={{ marginLeft: 8 }}>
            {record.lastDelivery || 'Never'}
          </span>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Tooltip title="Test Webhook">
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTestWebhook(record)}
              loading={testWebhookMutation.isLoading}
            />
          </Tooltip>
          <Tooltip title="Edit Webhook">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditWebhook(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Webhook">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteWebhook(record.id)}
              loading={deleteWebhookMutation.isLoading}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleCreateWebhook = (values: any) => {
    createWebhookMutation.mutate(values);
  };

  const _handleToggleWebhook = (id: string, isActive: boolean) => {
    updateWebhookMutation.mutate({ id, data: { isActive } });
  };

  const _handleEditWebhook = (webhook: any) => {
    setSelectedWebhook(webhook);
    form.setFieldsValue(webhook);
    setCreateModalVisible(true);
  };

  const _handleDeleteWebhook = (id: string) => {
    Modal.confirm({
      title: 'Delete Webhook',
      content: 'Are you sure you want to delete this webhook? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        deleteWebhookMutation.mutate(id);
      },
    });
  };

  const _handleTestWebhook = (webhook: any) => {
    setSelectedWebhook(webhook);
    setTestModalVisible(true);
  };

  const handleTestSubmit = (values: any) => {
    if (selectedWebhook) {
      testWebhookMutation.mutate({
        id: selectedWebhook.id,
        event: values.event,
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <p>Loading webhooks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Failed to load webhooks</Title>
        <Paragraph>Please try again later or contact support.</Paragraph>
        <Button type="primary" onClick={() => queryClient.invalidateQueries(['webhooks'])}>
          <ReloadOutlined /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ApiOutlined /> Webhooks
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          Create Webhook
        </Button>
      </div>

      <Paragraph>
        Configure webhooks to receive real-time notifications about API usage, billing events, key management, and more.
      </Paragraph>

      <Card>
        <Table
          columns={columns}
          dataSource={webhooksData || []}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={isLoading}
        />
      </Card>

      <Modal
        title={selectedWebhook ? "Edit Webhook" : "Create Webhook"}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setSelectedWebhook(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateWebhook}
        >
          <Form.Item
            label="URL"
            name="url"
            rules={[
              { required: true, message: 'Please enter webhook URL' },
              { type: 'url', message: 'Please enter a valid URL' }
            ]}
          >
            <Input placeholder="https://your-domain.com/webhook" />
          </Form.Item>

          <Form.Item
            label="Events"
            name="events"
            rules={[{ required: true, message: 'Please select at least one event' }]}
          >
            <Select mode="multiple" placeholder="Select events to subscribe to">
              <Option value="usage.threshold">Usage Threshold Reached</Option>
              <Option value="invoice.paid">Invoice Paid</Option>
              <Option value="invoice.failed">Invoice Payment Failed</Option>
              <Option value="key.created">API Key Created</Option>
              <Option value="key.revoked">API Key Revoked</Option>
              <Option value="quota.exceeded">Quota Exceeded</Option>
              <Option value="quota.reset">Quota Reset</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Secret (Optional)"
            name="secret"
            help="Leave empty to auto-generate a secure secret"
          >
            <Input.Password placeholder="Webhook signing secret" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="Describe what this webhook is used for" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createWebhookMutation.isLoading || updateWebhookMutation.isLoading}
              >
                {selectedWebhook ? 'Update Webhook' : 'Create Webhook'}
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                setSelectedWebhook(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Test Webhook"
        open={testModalVisible}
        onCancel={() => {
          setTestModalVisible(false);
          setSelectedWebhook(null);
        }}
        footer={null}
        width={500}
      >
        <Paragraph>
          Send a test event to <Text code>{selectedWebhook?.url}</Text>
        </Paragraph>

        <Form layout="vertical" onFinish={handleTestSubmit}>
          <Form.Item
            label="Event Type"
            name="event"
            initialValue="test"
          >
            <Select>
              <Option value="test">Test Event</Option>
              <Option value="usage.threshold">Usage Threshold Reached</Option>
              <Option value="invoice.paid">Invoice Paid</Option>
              <Option value="key.created">API Key Created</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={testWebhookMutation.isLoading}
              >
                Send Test Event
              </Button>
              <Button onClick={() => setTestModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Webhooks;