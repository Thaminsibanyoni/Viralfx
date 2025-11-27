import React, { useState, useEffect } from 'react';
import {
  Layout, Card, List, Typography, Button, Space, Tag, Avatar, Tabs, Input, Select, DatePicker, Switch, Badge, Tooltip, Modal, Form, Alert, Empty, Spin, Divider, Row, Col, } from 'antd';
import {
  BellOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, StarOutlined, DeleteOutlined, SearchOutlined, FilterOutlined, SettingOutlined, ClockCircleOutlined, TrophyOutlined, DollarOutlined, UserOutlined, SecurityScanOutlined, SystemUpdateOutlined, MessageOutlined, CalendarOutlined, FileTextOutlined, RocketOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { Notification } from '../types/notification.types';

dayjs.extend(relativeTime);

const {Content} = Layout;
const {Title, Text, Paragraph} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;
const {Search} = Input;

interface NotificationCenterState {
  notifications: Notification[];
  loading: boolean;
  unreadCount: number;
  filters: {
    type?: string;
    category?: string;
    read?: boolean;
    priority?: string;
    dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  };
  settings: {
    emailNotifications: boolean;
    pushNotifications: boolean;
    smsNotifications: boolean;
    inAppNotifications: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
}

const NotificationCenter: React.FC = () => {
  const {user} = useAuthStore();

  const [state, setState] = useState<NotificationCenterState>({
    notifications: [],
    loading: true,
    unreadCount: 0,
    filters: {},
    settings: {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      inAppNotifications: true,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
      },
    },
  });

  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  // Mock notifications data
  const mockNotifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      category: 'trading',
      title: 'Trade Completed Successfully',
      message: 'Your EUR/USD trade has been completed with a profit of R1,250.',
      read: false,
      priority: 'medium',
      createdAt: dayjs().subtract(15, 'minutes').toISOString(),
      actionUrl: '/trading/history',
      actionText: 'View Trade',
      userId: user?.id || 'current-user',
      metadata: { tradeId: 'TRX123', profit: 1250 },
    },
    {
      id: '2',
      type: 'warning',
      category: 'security',
      title: 'New Login Detected',
      message: 'A new login to your account was detected from Cape Town, South Africa.',
      read: false,
      priority: 'high',
      createdAt: dayjs().subtract(2, 'hours').toISOString(),
      actionUrl: '/settings/security',
      actionText: 'Review Activity',
      userId: user?.id || 'current-user',
    },
    {
      id: '3',
      type: 'info',
      category: 'system',
      title: 'Platform Maintenance Scheduled',
      message: 'Scheduled maintenance will occur on Sunday from 2:00 AM to 4:00 AM.',
      read: true,
      priority: 'low',
      createdAt: dayjs().subtract(1, 'day').toISOString(),
      userId: user?.id || 'current-user',
    },
    {
      id: '4',
      type: 'success',
      category: 'promotion',
      title: 'Welcome Bonus Available!',
      message: 'Claim your 100% deposit bonus up to R10,000.',
      read: false,
      priority: 'medium',
      createdAt: dayjs().subtract(3, 'hours').toISOString(),
      actionUrl: '/promotions/welcome-bonus',
      actionText: 'Claim Bonus',
      userId: user?.id || 'current-user',
    },
    {
      id: '5',
      type: 'info',
      category: 'billing',
      title: 'Monthly Statement Available',
      message: 'Your March 2024 trading statement is now available for download.',
      read: true,
      priority: 'low',
      createdAt: dayjs().subtract(2, 'days').toISOString(),
      actionUrl: '/billing/statements',
      actionText: 'Download',
      userId: user?.id || 'current-user',
    },
    {
      id: '6',
      type: 'error',
      category: 'trading',
      title: 'Order Rejected',
      message: 'Your BTC order was rejected due to insufficient balance.',
      read: false,
      priority: 'high',
      createdAt: dayjs().subtract(5, 'hours').toISOString(),
      actionUrl: '/wallet/deposit',
      actionText: 'Add Funds',
      userId: user?.id || 'current-user',
    },
    {
      id: '7',
      type: 'success',
      category: 'social',
      title: 'New Follower',
      message: 'John Doe started following your trading profile.',
      read: true,
      priority: 'low',
      createdAt: dayjs().subtract(1, 'week').toISOString(),
      actionUrl: '/social/profile/johndoe',
      actionText: 'View Profile',
      userId: user?.id || 'current-user',
    },
  ];

  useEffect(() => {
    // Simulate loading notifications
    const loadNotifications = async () => {
      try {
        setState(prev => ({ ...prev, loading: true }));
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        setState(prev => ({
          ...prev,
          notifications: mockNotifications,
          unreadCount: mockNotifications.filter(n => !n.read).length,
          loading: false,
        }));
      } catch (error) {
        toast.error('Failed to load notifications');
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    loadNotifications();
  }, []);

  const getNotificationIcon = (type: string, category: string) => {
    const iconProps = { style: { fontSize: '16px' } };

    switch (category) {
      case 'trading':
        return <DollarOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.accentGold }} />;
      case 'security':
        return <SecurityScanOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.errorRed }} />;
      case 'billing':
        return <FileTextOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.primaryPurple }} />;
      case 'system':
        return <SystemUpdateOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.textSecondary }} />;
      case 'social':
        return <UserOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.successGreen }} />;
      case 'promotion':
        return <RocketOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.warningOrange }} />;
      default:
        return <InfoCircleOutlined {...iconProps} style={{ ...iconProps.style, color: viralFxColors.primaryPurple }} />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return viralFxColors.successGreen;
      case 'warning': return viralFxColors.warningOrange;
      case 'error': return viralFxColors.errorRed;
      default: return viralFxColors.primaryPurple;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      trading: viralFxColors.accentGold,
      security: viralFxColors.errorRed,
      billing: viralFxColors.primaryPurple,
      system: viralFxColors.textSecondary,
      social: viralFxColors.successGreen,
      promotion: viralFxColors.warningOrange,
    };
    return colors[category as keyof typeof colors] || viralFxColors.textSecondary;
  };

  const markAsRead = (notificationId: string) => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));
  };

  const markAllAsRead = () => {
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (notificationId: string) => {
    setState(prev => {
      const updatedNotifications = prev.notifications.filter(n => n.id !== notificationId);
      const deletedNotification = prev.notifications.find(n => n.id === notificationId);
      return {
        ...prev,
        notifications: updatedNotifications,
        unreadCount: deletedNotification && !deletedNotification.read
          ? prev.unreadCount - 1
          : prev.unreadCount,
      };
    });
    toast.success('Notification deleted');
  };

  const clearAllNotifications = () => {
    setState(prev => ({
      ...prev,
      notifications: [],
      unreadCount: 0,
    }));
    toast.success('All notifications cleared');
  };

  const filteredNotifications = state.notifications.filter(notification => {
    // Search filter
    if (searchTerm && !notification.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !notification.message.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Tab filter
    if (activeTab === 'unread' && notification.read) return false;
    if (activeTab === 'read' && !notification.read) return false;

    // Category filter
    if (state.filters.category && notification.category !== state.filters.category) return false;

    // Type filter
    if (state.filters.type && notification.type !== state.filters.type) return false;

    // Priority filter
    if (state.filters.priority && notification.priority !== state.filters.priority) return false;

    return true;
  });

  const renderNotificationItem = (notification: Notification) => (
    <List.Item
      key={notification.id}
      style={{
        padding: '16px',
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
        marginBottom: '12px',
        backgroundColor: notification.read ? viralFxColors.backgroundPrimary : `${viralFxColors.primaryPurple}10`,
        borderLeft: `4px solid ${getNotificationColor(notification.type)}`,
      }}
      actions={[
        !notification.read && (
          <Button
            type="text"
            icon={<CheckCircleOutlined />}
            onClick={() => markAsRead(notification.id)}
            style={{ color: viralFxColors.successGreen }}
          >
            Mark as read
          </Button>
        ),
        <Button
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => deleteNotification(notification.id)}
          style={{ color: viralFxColors.errorRed }}
        >
          Delete
        </Button>,
      ].filter(Boolean)}
    >
      <List.Item.Meta
        avatar={
          <Avatar
            icon={getNotificationIcon(notification.type, notification.category)}
            style={{
              backgroundColor: getNotificationColor(notification.type),
            }}
          />
        }
        title={
          <Space>
            <span style={{ fontWeight: notification.read ? 'normal' : '600' }}>
              {notification.title}
            </span>
            <Tag color={getCategoryColor(notification.category)} size="small">
              {notification.category}
            </Tag>
            {notification.priority === 'high' && (
              <Tag color="red" size="small">
                High Priority
              </Tag>
            )}
          </Space>
        }
        description={
          <div>
            <Paragraph style={{ margin: '8px 0', color: viralFxColors.textSecondary }}>
              {notification.message}
            </Paragraph>
            <Space>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                <ClockCircleOutlined /> {dayjs(notification.createdAt).fromNow()}
              </Text>
              {notification.actionText && (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: 'auto', color: viralFxColors.primaryPurple }}
                >
                  {notification.actionText}
                </Button>
              )}
            </Space>
          </div>
        }
      />
    </List.Item>
  );

  const renderSettingsModal = () => (
    <Modal
      title="Notification Settings"
      open={settingsModalVisible}
      onCancel={() => setSettingsModalVisible(false)}
      footer={[
        <Button key="cancel" onClick={() => setSettingsModalVisible(false)}>
          Cancel
        </Button>,
        <Button key="save" type="primary" onClick={() => setSettingsModalVisible(false)}>
          Save Settings
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Title level={5}>Notification Channels</Title>
          <Space direction="vertical">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Email Notifications</span>
              <Switch checked={state.settings.emailNotifications} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Push Notifications</span>
              <Switch checked={state.settings.pushNotifications} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>SMS Notifications</span>
              <Switch checked={state.settings.smsNotifications} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>In-App Notifications</span>
              <Switch checked={state.settings.inAppNotifications} />
            </div>
          </Space>
        </div>

        <Divider />

        <div>
          <Title level={5}>Quiet Hours</Title>
          <Space direction="vertical">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Enable Quiet Hours</span>
              <Switch checked={state.settings.quietHours.enabled} />
            </div>
            {state.settings.quietHours.enabled && (
              <div>
                <Text>Mute notifications from {state.settings.quietHours.start} to {state.settings.quietHours.end}</Text>
              </div>
            )}
          </Space>
        </div>
      </Space>
    </Modal>
  );

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          All Notifications
          {state.unreadCount > 0 && (
            <Badge count={state.unreadCount} style={{ marginLeft: 8 }} />
          )}
        </span>
      ),
    },
    {
      key: 'unread',
      label: 'Unread',
    },
    {
      key: 'read',
      label: 'Read',
    },
  ];

  if (state.loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
        <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <BellOutlined style={{ fontSize: '48px', color: viralFxColors.primaryPurple, marginBottom: '16px' }} />
            <div style={{ fontSize: '18px', color: viralFxColors.textSecondary }}>Loading notifications...</div>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
      <Content style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          background: viralFxColors.backgroundPrimary,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                margin: 0,
                color: viralFxColors.textPrimary,
                fontSize: '28px',
                fontWeight: 600,
                background: `linear-gradient(135deg, ${viralFxColors.primaryPurple}, ${viralFxColors.primaryPurpleLight})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Notification Center
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: viralFxColors.textSecondary,
                fontSize: '16px'
              }}>
                Stay updated with your latest activities and alerts
              </p>
            </div>
            <Space>
              {state.unreadCount > 0 && (
                <Button
                  onClick={markAllAsRead}
                  style={{
                    borderColor: viralFxColors.primaryPurple,
                    color: viralFxColors.primaryPurple,
                  }}
                >
                  Mark All as Read ({state.unreadCount})
                </Button>
              )}
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsModalVisible(true)}
                style={{
                  backgroundColor: viralFxColors.primaryPurple,
                  borderColor: viralFxColors.primaryPurple,
                }}
              >
                Settings
              </Button>
            </Space>
          </div>
        </div>

        {/* Filters and Search */}
        <Card
          style={{
            marginBottom: '24px',
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%' }}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Category"
                value={state.filters.category}
                onChange={(value) => setState(prev => ({
                  ...prev,
                  filters: { ...prev.filters, category: value }
                }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="trading">Trading</Option>
                <Option value="security">Security</Option>
                <Option value="billing">Billing</Option>
                <Option value="system">System</Option>
                <Option value="social">Social</Option>
                <Option value="promotion">Promotion</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Priority"
                value={state.filters.priority}
                onChange={(value) => setState(prev => ({
                  ...prev,
                  filters: { ...prev.filters, priority: value }
                }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="high">High</Option>
                <Option value="medium">Medium</Option>
                <Option value="low">Low</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Type"
                value={state.filters.type}
                onChange={(value) => setState(prev => ({
                  ...prev,
                  filters: { ...prev.filters, type: value }
                }))}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="info">Info</Option>
                <Option value="success">Success</Option>
                <Option value="warning">Warning</Option>
                <Option value="error">Error</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Button
                onClick={clearAllNotifications}
                style={{ width: '100%' }}
                disabled={filteredNotifications.length === 0}
              >
                Clear All
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Notifications Content */}
        <Card
          style={{
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            tabBarStyle={{ marginBottom: '24px' }}
          />

          {filteredNotifications.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  {searchTerm || state.filters.category || state.filters.priority || state.filters.type
                    ? 'No notifications match your filters'
                    : activeTab === 'unread'
                    ? 'No unread notifications'
                    : activeTab === 'read'
                    ? 'No read notifications'
                    : 'No notifications'
                  }
                </span>
              }
            />
          ) : (
            <List
              dataSource={filteredNotifications}
              renderItem={renderNotificationItem}
              style={{ background: viralFxColors.backgroundSecondary, borderRadius: '8px', padding: '16px' }}
            />
          )}
        </Card>

        {renderSettingsModal()}
      </Content>
    </Layout>
  );
};

export default NotificationCenter;