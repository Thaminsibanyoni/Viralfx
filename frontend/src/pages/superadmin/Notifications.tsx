import React, { useState } from 'react';
import {
  
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Empty, Spin, Slider, DatePicker, Radio, Checkbox, TreeSelect, Upload, UploadProps, } from 'antd';
import {
  MailOutlined, BellOutlined, SendOutlined, EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, CopyOutlined, DownloadOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, UserOutlined, TeamOutlined, GlobalOutlined, MobileOutlined, MessageOutlined, SettingOutlined, ScheduleOutlined, FileTextOutlined, BarChartOutlined, ThunderboltOutlined, RocketOutlined, BulbOutlined, PhoneOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import {
  NotificationTemplate, NotificationHistory, DeliveryLog, NotificationFormData, } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;
const {Group: RadioGroup} = Radio;

interface TemplateFilters {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

interface HistoryFilters {
  page: number;
  limit: number;
  status?: string;
  channel?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

interface DeliveryFilters {
  page: number;
  limit: number;
  status?: string;
  channel?: string;
  userId?: string;
}

const Notifications: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('templates');
  const [templateFilters, setTemplateFilters] = useState<TemplateFilters>({
    page: 1,
    limit: 20,
  });
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>({
    page: 1,
    limit: 20,
  });
  const [deliveryFilters, setDeliveryFilters] = useState<DeliveryFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<NotificationHistory | null>(null);
  const [templateModalVisible, setTemplateModalVisible] = useState<boolean>(false);
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [testModalVisible, setTestModalVisible] = useState<boolean>(false);
  const [previewModalVisible, setPreviewModalVisible] = useState<boolean>(false);

  // Forms
  const [createForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [testForm] = Form.useForm();

  // Permissions
  const canViewNotifications = checkPermission('notifications:view');
  const canManageTemplates = checkPermission('notifications:templates');
  const canSendBroadcasts = checkPermission('notifications:broadcast');
  const canViewHistory = checkPermission('notifications:history');

  // Data fetching
  const {data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates, } = useQuery(
    ['notification-templates', templateFilters],
    () => adminApi.getNotificationTemplates(templateFilters),
    {
      enabled: canViewNotifications,
      keepPreviousData: true,
    }
  );

  const {data: historyData, isLoading: historyLoading, refetch: refetchHistory, } = useQuery(
    ['notification-history', historyFilters],
    () => adminApi.getNotificationHistory(historyFilters),
    {
      enabled: canViewHistory,
      keepPreviousData: true,
    }
  );

  // Mock delivery logs data
  const mockDeliveryLogs: DeliveryLog[] = [
    {
      id: '1',
      notificationId: 'notif_1',
      userId: 'user_1',
      channel: 'email',
      status: 'DELIVERED',
      sentAt: new Date(),
      deliveredAt: new Date(),
      openedAt: new Date(),
      clickedAt: new Date(),
      user: {
        id: 'user_1',
        email: 'user@example.com',
        username: 'john_doe',
      },
    },
  ];

  // Mutations
  const createTemplateMutation = useMutation(
    (templateData: any) => adminApi.createTemplate(templateData),
    {
      onSuccess: () => {
        message.success('Notification template created successfully');
        queryClient.invalidateQueries('notification-templates');
        setCreateModalVisible(false);
        createForm.resetFields();
      },
      onError: () => {
        message.error('Failed to create notification template');
      },
    }
  );

  const updateTemplateMutation = useMutation(
    ({ templateId, templateData }: { templateId: string; templateData: any }) =>
      adminApi.updateTemplate(templateId, templateData),
    {
      onSuccess: () => {
        message.success('Notification template updated successfully');
        queryClient.invalidateQueries('notification-templates');
        setTemplateModalVisible(false);
      },
      onError: () => {
        message.error('Failed to update notification template');
      },
    }
  );

  const deleteTemplateMutation = useMutation(
    (templateId: string) => adminApi.deleteTemplate(templateId),
    {
      onSuccess: () => {
        message.success('Notification template deleted successfully');
        queryClient.invalidateQueries('notification-templates');
        setTemplateModalVisible(false);
      },
      onError: () => {
        message.error('Failed to delete notification template');
      },
    }
  );

  const broadcastNotificationMutation = useMutation(
    (notificationData: any) => adminApi.broadcastNotification(notificationData),
    {
      onSuccess: () => {
        message.success('Notification broadcasted successfully');
        setCreateModalVisible(false);
        createForm.resetFields();
        queryClient.invalidateQueries('notification-history');
      },
      onError: () => {
        message.error('Failed to broadcast notification');
      },
    }
  );

  // Event handlers
  const handleTemplateFilterChange = (key: string, value: any) => {
    setTemplateFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleHistoryFilterChange = (key: string, value: any) => {
    setHistoryFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewTemplate = (template: NotificationTemplate) => {
    setSelectedTemplate(template);
    templateForm.setFieldsValue(template);
    setTemplateModalVisible(true);
  };

  const handleViewHistory = (history: NotificationHistory) => {
    setSelectedHistory(history);
    setHistoryModalVisible(true);
  };

  const handleCreateTemplate = () => {
    createForm.validateFields().then((values) => {
      createTemplateMutation.mutate(values);
    });
  };

  const handleUpdateTemplate = () => {
    if (selectedTemplate) {
      templateForm.validateFields().then((values) => {
        updateTemplateMutation.mutate({
          templateId: selectedTemplate.id,
          templateData: values,
        });
      });
    }
  };

  const handleDeleteTemplate = () => {
    if (selectedTemplate) {
      deleteTemplateMutation.mutate(selectedTemplate.id);
    }
  };

  const _handleBroadcastNotification = () => {
    createForm.validateFields().then((values) => {
      broadcastNotificationMutation.mutate(values);
    });
  };

  const getChannelIcon = (channel: string) => {
    const icons = {
      email: <MailOutlined />,
      sms: <PhoneOutlined />,
      push: <BellOutlined />,
      in_app: <MessageOutlined />,
      webhook: <GlobalOutlined />,
    };
    return icons[channel as keyof typeof icons] || <MailOutlined />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'orange',
      SENT: 'blue',
      DELIVERED: 'green',
      FAILED: 'red',
      CANCELLED: 'gray',
      OPENED: 'purple',
      CLICKED: 'cyan',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Table columns for Templates
  const templateColumns: ColumnType<NotificationTemplate>[] = [
    {
      title: 'Template Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: NotificationTemplate) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="blue">{category.replace('_', ' ').toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Channels',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => (
        <Space wrap>
          {channels.map((channel) => (
            <Tooltip title={channel} key={channel}>
              {getChannelIcon(channel)}
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Usage Count',
      dataIndex: 'usageCount',
      key: 'usageCount',
      render: (count: number) => (
        <Statistic value={count} valueStyle={{ fontSize: '14px' }} />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Switch checked={isActive} disabled />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => moment(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: NotificationTemplate) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewTemplate(record)}
            />
          </Tooltip>
          {canManageTemplates && (
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item
                    key="edit"
                    icon={<EditOutlined />}
                    onClick={() => handleViewTemplate(record)}
                  >
                    Edit Template
                  </Menu.Item>
                  <Menu.Item
                    key="duplicate"
                    icon={<CopyOutlined />}
                    onClick={() => {
                      // Handle template duplication
                    }}
                  >
                    Duplicate
                  </Menu.Item>
                  <Menu.Item
                    key="test"
                    icon={<SendOutlined />}
                    onClick={() => {
                      setSelectedTemplate(record);
                      setTestModalVisible(true);
                    }}
                  >
                    Test Send
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    key="delete"
                    icon={<DeleteOutlined />}
                    danger
                    onClick={() => {
                      setSelectedTemplate(record);
                      handleDeleteTemplate();
                    }}
                  >
                    Delete Template
                  </Menu.Item>
                </Menu>
              }
            >
              <Button type="text" icon={<SettingOutlined />} />
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  // Table columns for History
  const historyColumns: ColumnType<NotificationHistory>[] = [
    {
      title: 'Campaign',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: NotificationHistory) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.type}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors = {
          BROADCAST: 'red',
          SEGMENT: 'blue',
          USER: 'green',
          TEST: 'orange',
          SCHEDULED: 'purple',
        };
        return (
          <Tag color={colors[type as keyof typeof colors]}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status}
        />
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => {
        const colors = {
          high: 'red',
          medium: 'orange',
          low: 'green',
        };
        return (
          <Tag color={colors[priority as keyof typeof colors]}>
            {priority.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Channels',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => (
        <Space wrap>
          {channels.map((channel) => (
            <Tooltip title={channel} key={channel}>
              {getChannelIcon(channel)}
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: 'Recipients',
      render: (_, record: NotificationHistory) => (
        <Space direction="vertical" size={0}>
          <Text>{record.sentCount.toLocaleString()} / {record.recipientCount.toLocaleString()}</Text>
          <Progress
            percent={record.recipientCount > 0 ? (record.sentCount / record.recipientCount) * 100 : 0}
            size="small"
            showInfo={false}
          />
        </Space>
      ),
    },
    {
      title: 'Created By',
      dataIndex: 'creator',
      key: 'creator',
      render: (creator: NotificationHistory['creator']) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{`${creator.firstName} ${creator.lastName}`}</Text>
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
          {moment(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: NotificationHistory) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewHistory(record)}
            />
          </Tooltip>
          <Tooltip title="View Delivery Logs">
            <Button
              type="text"
              icon={<BarChartOutlined />}
              onClick={() => {/* Handle view delivery logs */}}
            />
          </Tooltip>
          {canSendBroadcasts && record.status === 'DRAFT' && (
            <Tooltip title="Send Now">
              <Button
                type="text"
                icon={<SendOutlined />}
                onClick={() => {/* Handle send now */}}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Table columns for Delivery Logs
  const deliveryColumns: ColumnType<DeliveryLog>[] = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      render: (user: DeliveryLog['user']) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{user.email}</Text>
        </Space>
      ),
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel: string) => (
        <Space>
          {getChannelIcon(channel)}
          <Text>{channel}</Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status}
        />
      ),
    },
    {
      title: 'Timeline',
      key: 'timeline',
      render: (_, record: DeliveryLog) => (
        <Space direction="vertical" size={0}>
          {record.sentAt && (
            <Text style={{ fontSize: '12px' }}>
              Sent: {moment(record.sentAt).format('HH:mm:ss')}
            </Text>
          )}
          {record.deliveredAt && (
            <Text style={{ fontSize: '12px' }}>
              Delivered: {moment(record.deliveredAt).format('HH:mm:ss')}
            </Text>
          )}
          {record.openedAt && (
            <Text style={{ fontSize: '12px' }}>
              Opened: {moment(record.openedAt).format('HH:mm:ss')}
            </Text>
          )}
          {record.clickedAt && (
            <Text style={{ fontSize: '12px' }}>
              Clicked: {moment(record.clickedAt).format('HH:mm:ss')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Response Time',
      dataIndex: 'responseTime',
      key: 'responseTime',
      render: (time: number) => (
        <Text>{time ? `${time}ms` : '-'}</Text>
      ),
    },
  ];

  if (!canViewNotifications) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Notification Management page."
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
              Notification Management
            </Title>
            <Text type="secondary">Manage notifications, templates, and delivery</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchTemplates();
                  refetchHistory();
                }}
              >
                Refresh
              </Button>
              {canSendBroadcasts && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                  Send Notification
                </Button>
              )}
              {canManageTemplates && (
                <Button icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                  Create Template
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
              title="Total Templates"
              value={templatesData?.total || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Campaigns"
              value={historyData?.data?.filter((h: NotificationHistory) =>
                ['PENDING', 'PROCESSING', 'SENT'].includes(h.status)
              ).length || 0}
              prefix={<RocketOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Messages Sent Today"
              value={historyData?.data?.filter((h: NotificationHistory) =>
                moment(h.createdAt).isSame(moment(), 'day')
              ).reduce((acc: number, h: NotificationHistory) => acc + h.sentCount, 0) || 0}
              prefix={<SendOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Delivery Rate"
              value={95.8}
              precision={1}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
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
                <FileTextOutlined />
                Templates
              </span>
            }
            key="templates"
          >
            {/* Template Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8}>
                  <Input
                    placeholder="Search templates..."
                    prefix={<SearchOutlined />}
                    value={templateFilters.search}
                    onChange={(e) => handleTemplateFilterChange('search', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Select
                    placeholder="Category"
                    value={templateFilters.category}
                    onChange={(value) => handleTemplateFilterChange('category', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="MARKETING">Marketing</Select.Option>
                    <Select.Option value="TRANSACTIONAL">Transactional</Select.Option>
                    <Select.Option value="SECURITY">Security</Select.Option>
                    <Select.Option value="SYSTEM">System</Select.Option>
                  </Select>
                </Col>
              </Row>
            </Card>

            {/* Templates Table */}
            <Table
              columns={templateColumns}
              dataSource={templatesData?.data || []}
              loading={templatesLoading}
              rowKey="id"
              pagination={{
                current: templateFilters.page,
                pageSize: templateFilters.limit,
                total: templatesData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} templates`,
                onChange: (page, pageSize) => {
                  setTemplateFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1000 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <MailOutlined />
                Campaign History
              </span>
            }
            key="history"
          >
            {/* History Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={historyFilters.status}
                    onChange={(value) => handleHistoryFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="PENDING">Pending</Select.Option>
                    <Select.Option value="SENT">Sent</Select.Option>
                    <Select.Option value="DELIVERED">Delivered</Select.Option>
                    <Select.Option value="FAILED">Failed</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Type"
                    value={historyFilters.type}
                    onChange={(value) => handleHistoryFilterChange('type', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="BROADCAST">Broadcast</Select.Option>
                    <Select.Option value="SEGMENT">Segment</Select.Option>
                    <Select.Option value="USER">User</Select.Option>
                    <Select.Option value="TEST">Test</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Channel"
                    value={historyFilters.channel}
                    onChange={(value) => handleHistoryFilterChange('channel', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="email">Email</Select.Option>
                    <Select.Option value="sms">SMS</Select.Option>
                    <Select.Option value="push">Push</Select.Option>
                    <Select.Option value="in_app">In-App</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={(dates) => {
                      if (dates) {
                        handleHistoryFilterChange('startDate', dates[0]?.format('YYYY-MM-DD'));
                        handleHistoryFilterChange('endDate', dates[1]?.format('YYYY-MM-DD'));
                      } else {
                        handleHistoryFilterChange('startDate', undefined);
                        handleHistoryFilterChange('endDate', undefined);
                      }
                    }}
                  />
                </Col>
              </Row>
            </Card>

            {/* History Table */}
            <Table
              columns={historyColumns}
              dataSource={historyData?.data || []}
              loading={historyLoading}
              rowKey="id"
              pagination={{
                current: historyFilters.page,
                pageSize: historyFilters.limit,
                total: historyData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} campaigns`,
                onChange: (page, pageSize) => {
                  setHistoryFilters(prev => ({
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
                <BarChartOutlined />
                Delivery Logs
              </span>
            }
            key="delivery"
          >
            {/* Delivery Log Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={deliveryFilters.status}
                    onChange={(value) => handleDeliveryFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="PENDING">Pending</Select.Option>
                    <Select.Option value="SENT">Sent</Select.Option>
                    <Select.Option value="DELIVERED">Delivered</Select.Option>
                    <Select.Option value="FAILED">Failed</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Channel"
                    value={deliveryFilters.channel}
                    onChange={(value) => handleDeliveryFilterChange('channel', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="email">Email</Select.Option>
                    <Select.Option value="sms">SMS</Select.Option>
                    <Select.Option value="push">Push</Select.Option>
                    <Select.Option value="in_app">In-App</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Input
                    placeholder="User ID or Email"
                    value={deliveryFilters.userId}
                    onChange={(e) => handleDeliveryFilterChange('userId', e.target.value)}
                    allowClear
                  />
                </Col>
              </Row>
            </Card>

            {/* Delivery Logs Table */}
            <Table
              columns={deliveryColumns}
              dataSource={mockDeliveryLogs}
              rowKey="id"
              pagination={{
                current: deliveryFilters.page,
                pageSize: deliveryFilters.limit,
                total: mockDeliveryLogs.length,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} logs`,
                onChange: (page, pageSize) => {
                  setDeliveryFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 800 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Template Details Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined />
            Template Details: {selectedTemplate?.name}
          </Space>
        }
        visible={templateModalVisible}
        onCancel={() => setTemplateModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTemplateModalVisible(false)}>
            Close
          </Button>,
          canManageTemplates && (
            <Button key="save" type="primary" onClick={handleUpdateTemplate}>
              Save Changes
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedTemplate && (
          <Form form={templateForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Template Name" name="name">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Category" name="category">
                  <Select>
                    <Select.Option value="MARKETING">Marketing</Select.Option>
                    <Select.Option value="TRANSACTIONAL">Transactional</Select.Option>
                    <Select.Option value="SECURITY">Security</Select.Option>
                    <Select.Option value="SYSTEM">System</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Description" name="description">
              <TextArea rows={2} />
            </Form.Item>
            <Form.Item label="Channels" name="channels">
              <Checkbox.Group>
                <Checkbox value="email">Email</Checkbox>
                <Checkbox value="sms">SMS</Checkbox>
                <Checkbox value="push">Push Notification</Checkbox>
                <Checkbox value="in_app">In-App</Checkbox>
              </Checkbox.Group>
            </Form.Item>
            <Form.Item label="Subject" name="subject">
              <Input />
            </Form.Item>
            <Form.Item label="Content" name="content">
              <TextArea rows={6} />
            </Form.Item>
            <Form.Item label="Available Variables">
              <Text code>
                {'{user_name}, {user_email}, {date}, {time}, {platform_name}'}
              </Text>
            </Form.Item>
            <Form.Item label="Active" name="isActive" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Create Template Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            Create Notification Template
          </Space>
        }
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateTemplate}
        confirmLoading={createTemplateMutation.isLoading}
        width={800}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Template Name"
                name="name"
                rules={[{ required: true, message: 'Please enter template name' }]}
              >
                <Input placeholder="Welcome Email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Category"
                name="category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  <Select.Option value="MARKETING">Marketing</Select.Option>
                  <Select.Option value="TRANSACTIONAL">Transactional</Select.Option>
                  <Select.Option value="SECURITY">Security</Select.Option>
                  <Select.Option value="SYSTEM">System</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Description"
            name="description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <TextArea rows={2} placeholder="Brief description of the template" />
          </Form.Item>
          <Form.Item
            label="Channels"
            name="channels"
            rules={[{ required: true, message: 'Please select at least one channel' }]}
          >
            <Checkbox.Group>
              <Checkbox value="email">Email</Checkbox>
              <Checkbox value="sms">SMS</Checkbox>
              <Checkbox value="push">Push Notification</Checkbox>
              <Checkbox value="in_app">In-App</Checkbox>
            </Checkbox.Group>
          </Form.Item>
          <Form.Item
            label="Subject"
            name="subject"
            rules={[{ required: true, message: 'Please enter subject' }]}
          >
            <Input placeholder="Welcome to ViralFX!" />
          </Form.Item>
          <Form.Item
            label="Content"
            name="content"
            rules={[{ required: true, message: 'Please enter content' }]}
          >
            <TextArea rows={6} placeholder="Hello {user_name}, welcome to ViralFX!" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Campaign Details Modal */}
      <Modal
        title={
          <Space>
            <MailOutlined />
            Campaign Details
          </Space>
        }
        visible={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {selectedHistory && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Campaign Name" span={2}>
              {selectedHistory.title}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color="blue">{selectedHistory.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getStatusColor(selectedHistory.status) as any}
                text={selectedHistory.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              <Tag color={selectedHistory.priority === 'high' ? 'red' :
                        selectedHistory.priority === 'medium' ? 'orange' : 'green'}>
                {selectedHistory.priority.toUpperCase()}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              {selectedHistory.category}
            </Descriptions.Item>
            <Descriptions.Item label="Channels" span={2}>
              <Space wrap>
                {selectedHistory.channels.map((channel) => (
                  <Tooltip title={channel} key={channel}>
                    {getChannelIcon(channel)}
                  </Tooltip>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Recipients">
              {selectedHistory.recipientCount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Sent">
              {selectedHistory.sentCount.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Created By">
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text>{`${selectedHistory.creator.firstName} ${selectedHistory.creator.lastName}`}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {moment(selectedHistory.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Message" span={2}>
              <Paragraph style={{ maxHeight: 200, overflow: 'auto' }}>
                {selectedHistory.message}
              </Paragraph>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Notifications;