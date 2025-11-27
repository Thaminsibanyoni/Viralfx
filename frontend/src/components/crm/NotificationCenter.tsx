import React, { useState, useRef, useEffect } from 'react';
import {
  Badge, Button, Dropdown, List, Avatar, Typography, Space, Empty, Divider, Tag, Tooltip, Switch, Input, Modal, message, } from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined, SettingOutlined, SearchOutlined, FilterOutlined, InfoCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, UserOutlined, TeamOutlined, FileTextOutlined, DollarOutlined, MessageOutlined, WarningOutlined, } from '@ant-design/icons';
import { useCRMWebSocket } from '../../hooks/useCRMWebSocket';
import { NotificationData } from '../../services/websocket/crmWebSocket';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const {Text} = Typography;

interface NotificationCenterProps {
  className?: string;
  showSettings?: boolean;
  maxItems?: number;
  filterCategories?: string[];
}

interface NotificationSettings {
  enableSounds: boolean;
  enableBrowserNotifications: boolean;
  enableEmailNotifications: boolean;
  showDesktopNotifications: boolean;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  categories: {
    ticket: boolean;
    broker: boolean;
    billing: boolean;
    deal: boolean;
    system: boolean;
    message: boolean;
  };
  priorities: {
    low: boolean;
    medium: boolean;
    high: boolean;
    urgent: boolean;
  };
}

const defaultSettings: NotificationSettings = {
  enableSounds: true,
  enableBrowserNotifications: true,
  enableEmailNotifications: false,
  showDesktopNotifications: true,
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '08:00',
  },
  categories: {
    ticket: true,
    broker: true,
    billing: true,
    deal: true,
    system: true,
    message: true,
  },
  priorities: {
    low: false,
    medium: true,
    high: true,
    urgent: true,
  },
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  className,
  showSettings = true,
  maxItems = 10,
  filterCategories,
}) => {
  const [visible, setVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, onTicketUpdate, onBrokerUpdate, onDealUpdate, onInvoiceUpdate, onSystemAlert, } = useCRMWebSocket({
    enableNotifications: settings.enableBrowserNotifications,
    enableSounds: settings.enableSounds,
  });

  // Filter notifications based on search and category
  const filteredNotifications = notifications
    .filter(notification => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query)
        );
      }

      // Category filter
      if (selectedCategory && notification.category !== selectedCategory) {
        return false;
      }

      // Global category filter
      if (filterCategories?.length && !filterCategories.includes(notification.category)) {
        return false;
      }

      // Settings category filter
      if (!settings.categories[notification.category as keyof typeof settings.categories]) {
        return false;
      }

      // Settings priority filter
      if (!settings.priorities[notification.priority as keyof typeof settings.priorities]) {
        return false;
      }

      return true;
    })
    .slice(0, maxItems);

  const getNotificationIcon = (type: string, category: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      default:
        switch (category) {
          case 'ticket':
            return <FileTextOutlined style={{ color: '#1890ff' }} />;
          case 'broker':
            return <TeamOutlined style={{ color: '#722ed1' }} />;
          case 'billing':
            return <DollarOutlined style={{ color: '#52c41a' }} />;
          case 'deal':
            return <InfoCircleOutlined style={{ color: '#fa8c16' }} />;
          case 'system':
            return <WarningOutlined style={{ color: '#ff4d4f' }} />;
          case 'message':
            return <MessageOutlined style={{ color: '#13c2c2' }} />;
          default:
            return <BellOutlined style={{ color: '#8c8c8c' }} />;
        }
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      ticket: 'blue',
      broker: 'purple',
      billing: 'green',
      deal: 'orange',
      system: 'red',
      message: 'cyan',
    };
    return colors[category] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'default',
      medium: 'blue',
      high: 'orange',
      urgent: 'red',
    };
    return colors[priority] || 'default';
  };

  const handleNotificationClick = (notification: NotificationData) => {
    if (!notification.readAt) {
      markNotificationAsRead(notification.id);
    }

    if (notification.actionUrl) {
      // Navigate to action URL
      window.location.href = notification.actionUrl;
    }

    setVisible(false);
  };

  const handleMarkAllAsRead = () => {
    markAllNotificationsAsRead();
    message.success('All notifications marked as read');
  };

  const handleClearAll = () => {
    Modal.confirm({
      title: 'Clear All Notifications',
      content: 'Are you sure you want to clear all notifications? This action cannot be undone.',
      okText: 'Clear',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        clearNotifications();
        message.success('All notifications cleared');
        setVisible(false);
      },
    });
  };

  const notificationMenu = (
    <div
      ref={dropdownRef}
      className="notification-center-dropdown"
      style={{ width: 380, maxHeight: 500, overflow: 'hidden' }}
    >
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center space-x-2">
          <BellOutlined />
          <Text strong>Notifications</Text>
          {unreadCount > 0 && (
            <Badge count={unreadCount} size="small" />
          )}
        </div>
        <Space>
          {showSettings && (
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setSettingsModalVisible(true);
              }}
            />
          )}
          <ButtonGroup size="small">
            {unreadCount > 0 && (
              <Button
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkAllAsRead();
                }}
              >
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                type="text"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearAll();
                }}
              >
                Clear
              </Button>
            )}
          </ButtonGroup>
        </Space>
      </div>

      {/* Search and Filter */}
      <div className="p-3 border-b">
        <Input
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      {/* Category Filters */}
      {filterCategories && (
        <div className="p-3 border-b">
          <div className="flex items-center space-x-1 mb-2">
            <FilterOutlined />
            <Text type="secondary" className="text-xs">Filter by category:</Text>
          </div>
          <Space size="small" wrap>
            <Button
              size="small"
              type={selectedCategory === null ? 'primary' : 'default'}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {filterCategories.map(category => (
              <Button
                key={category}
                size="small"
                type={selectedCategory === category ? 'primary' : 'default'}
                onClick={() => setSelectedCategory(category)}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Button>
            ))}
          </Space>
        </div>
      )}

      {/* Notifications List */}
      <div style={{ maxHeight: 350, overflowY: 'auto' }}>
        {filteredNotifications.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No notifications"
            className="py-8"
          />
        ) : (
          <List
            dataSource={filteredNotifications}
            renderItem={(notification) => (
              <List.Item
                className={`cursor-pointer hover:bg-gray-50 px-4 py-3 ${
                  !notification.readAt ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
                style={{ border: 'none', borderBottom: '1px solid #f0f0f0' }}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      icon={getNotificationIcon(notification.type, notification.category)}
                      style={{ backgroundColor: 'transparent' }}
                    />
                  }
                  title={
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Text strong className={!notification.readAt ? 'text-blue-600' : ''}>
                          {notification.title}
                        </Text>
                        <Tag size="small" color={getCategoryColor(notification.category)}>
                          {notification.category}
                        </Tag>
                        {notification.priority !== 'medium' && (
                          <Tag size="small" color={getPriorityColor(notification.priority)}>
                            {notification.priority}
                          </Tag>
                        )}
                      </div>
                      <Text type="secondary" className="text-xs">
                        {dayjs(notification.createdAt).fromNow()}
                      </Text>
                    </div>
                  }
                  description={
                    <div>
                      <Text type="secondary" className="text-sm">
                        {notification.message}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {notifications.length > maxItems && (
        <div className="p-2 text-center border-t">
          <Button type="link" size="small">
            View all notifications
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dropdown
        overlay={notificationMenu}
        trigger={['click']}
        visible={visible}
        onVisibleChange={setVisible}
        placement="bottomRight"
        overlayClassName="notification-center-dropdown-overlay"
      >
        <Badge count={unreadCount} size="small">
          <Button
            type="text"
            icon={<BellOutlined />}
            className={className}
            style={{ border: 'none' }}
          />
        </Badge>
      </Dropdown>

      {/* Settings Modal */}
      <Modal
        title="Notification Settings"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={() => {
              // Save settings to localStorage
              localStorage.setItem('crm_notification_settings', JSON.stringify(settings));
              setSettingsModalVisible(false);
              message.success('Notification settings saved');
            }}
          >
            Save Settings
          </Button>,
        ]}
        width={600}
      >
        <div className="space-y-6">
          {/* General Settings */}
          <div>
            <Text strong className="block mb-3">General Settings</Text>
            <Space direction="vertical" className="w-full">
              <div className="flex items-center justify-between">
                <Text>Enable Sounds</Text>
                <Switch
                  checked={settings.enableSounds}
                  onChange={(checked) =>
                    setSettings(prev => ({ ...prev, enableSounds: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Text>Browser Notifications</Text>
                <Switch
                  checked={settings.enableBrowserNotifications}
                  onChange={(checked) =>
                    setSettings(prev => ({ ...prev, enableBrowserNotifications: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Text>Show Desktop Notifications</Text>
                <Switch
                  checked={settings.showDesktopNotifications}
                  onChange={(checked) =>
                    setSettings(prev => ({ ...prev, showDesktopNotifications: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Text>Email Notifications</Text>
                <Switch
                  checked={settings.enableEmailNotifications}
                  onChange={(checked) =>
                    setSettings(prev => ({ ...prev, enableEmailNotifications: checked }))
                  }
                />
              </div>
            </Space>
          </div>

          {/* Category Filters */}
          <div>
            <Text strong className="block mb-3">Notification Categories</Text>
            <Space direction="vertical" className="w-full">
              {Object.entries(settings.categories).map(([category, enabled]) => (
                <div key={category} className="flex items-center justify-between">
                  <Text className="capitalize">{category}</Text>
                  <Switch
                    checked={enabled}
                    onChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        categories: { ...prev.categories, [category]: checked }
                      }))
                    }
                  />
                </div>
              ))}
            </Space>
          </div>

          {/* Priority Filters */}
          <div>
            <Text strong className="block mb-3">Priority Levels</Text>
            <Space direction="vertical" className="w-full">
              {Object.entries(settings.priorities).map(([priority, enabled]) => (
                <div key={priority} className="flex items-center justify-between">
                  <Text className="capitalize">{priority}</Text>
                  <Switch
                    checked={enabled}
                    onChange={(checked) =>
                      setSettings(prev => ({
                        ...prev,
                        priorities: { ...prev.priorities, [priority]: checked }
                      }))
                    }
                  />
                </div>
              ))}
            </Space>
          </div>

          {/* Quiet Hours */}
          <div>
            <Text strong className="block mb-3">Quiet Hours</Text>
            <div className="flex items-center justify-between mb-3">
              <Text>Enable Quiet Hours</Text>
              <Switch
                checked={settings.quietHours.enabled}
                onChange={(checked) =>
                  setSettings(prev => ({
                    ...prev,
                    quietHours: { ...prev.quietHours, enabled: checked }
                  }))
                }
              />
            </div>
            {settings.quietHours.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Text className="block mb-1">Start Time</Text>
                  <Input
                    type="time"
                    value={settings.quietHours.start}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        quietHours: { ...prev.quietHours, start: e.target.value }
                      }))
                    }
                  />
                </div>
                <div>
                  <Text className="block mb-1">End Time</Text>
                  <Input
                    type="time"
                    value={settings.quietHours.end}
                    onChange={(e) =>
                      setSettings(prev => ({
                        ...prev,
                        quietHours: { ...prev.quietHours, end: e.target.value }
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default NotificationCenter;