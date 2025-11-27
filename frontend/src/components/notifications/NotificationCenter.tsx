import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dropdown, List, Badge, Button, Tag, Empty, Spin, Tabs, Typography, Space, Divider, Modal, Avatar, Tooltip, Alert, message, } from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined, ClearOutlined, ExclamationCircleOutlined, InfoCircleOutlined, CheckCircleOutlined, WarningOutlined, CloseOutlined, ReloadOutlined, } from '@ant-design/icons';
import { useNotifications, Notification } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const {Text, Title} = Typography;
const {TabPane} = Tabs;

interface NotificationCenterProps {
  compact?: boolean;
  trigger?: ['click'];
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
}

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDelete,
  compact = false,
}) => {
  const navigate = useNavigate();

  const getIcon = (type: string, priority: string) => {
    const iconProps = {
      style: {
        color: notification.read ? '#b0b0b0' : undefined,
        fontSize: compact ? '14px' : '16px',
      },
    };

    if (priority === 'high') {
      iconProps.style.color = '#f44336';
    }

    switch (type) {
      case 'success':
        return <CheckCircleOutlined {...iconProps} />;
      case 'warning':
        return <WarningOutlined {...iconProps} />;
      case 'error':
        return <ExclamationCircleOutlined {...iconProps} />;
      default:
        return <InfoCircleOutlined {...iconProps} />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      system: '#1890ff',
      trading: '#52c41a',
      security: '#fa8c16',
      billing: '#eb2f96',
      social: '#722ed1',
      promotion: '#faad14',
      order: '#13c2c2',
      alert: '#ff4d4f',
      broker: '#2f54eb',
    };
    return colors[category] || '#d9d9d9';
  };

  const handleClick = async () => {
    if (!notification.read) {
      await onMarkAsRead(notification.id);
    }

    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Delete Notification',
      content: 'Are you sure you want to delete this notification?',
      onOk: () => onDelete(notification.id),
    });
  };

  return (
    <List.Item
      className={`notification-item ${!notification.read ? 'unread' : 'read'}`}
      style={{
        padding: compact ? '8px 12px' : '12px 16px',
        cursor: notification.actionUrl ? 'pointer' : 'default',
        backgroundColor: notification.read ? 'transparent' : '#f6ffed',
        borderLeft: !notification.read ? `3px solid ${getCategoryColor(notification.category)}` : 'none',
      }}
      onClick={handleClick}
      actions={[
        <Tooltip title="Delete">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={handleDelete}
          />
        </Tooltip>,
      ]}
    >
      <List.Item.Meta
        avatar={
          <Badge dot={!notification.read}>
            <Avatar
              size={compact ? 'small' : 'default'}
              icon={getIcon(notification.type, notification.priority)}
              style={{
                backgroundColor: getCategoryColor(notification.category),
              }}
            />
          </Badge>
        }
        title={
          <Space size="small">
            <Text
              strong={!notification.read}
              style={{
                color: notification.read ? '#b0b0b0' : '#262626',
                fontSize: compact ? '13px' : '14px',
              }}
            >
              {notification.title}
            </Text>
            {notification.priority === 'high' && (
              <Tag color="red" size="small">
                High Priority
              </Tag>
            )}
            <Tag
              color={getCategoryColor(notification.category)}
              size="small"
              style={{ fontSize: '10px' }}
            >
              {notification.category}
            </Tag>
          </Space>
        }
        description={
          <div>
            <Text
              style={{
                color: notification.read ? '#b0b0b0' : '#595959',
                fontSize: compact ? '12px' : '13px',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {notification.message}
            </Text>
            {notification.actionText && (
              <Text
                type="secondary"
                style={{
                  fontSize: '11px',
                  fontStyle: 'italic',
                }}
              >
                {notification.actionText}
              </Text>
            )}
            <Text
              type="secondary"
              style={{
                fontSize: '11px',
                display: 'block',
                marginTop: '4px',
              }}
            >
              {dayjs(notification.createdAt).fromNow()}
            </Text>
          </div>
        }
      />
    </List.Item>
  );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  compact = false,
  trigger = ['click'],
  placement = 'bottomRight',
}) => {
  const {notifications, unreadCount, loading, error, markAsRead, markAllAsRead, deleteNotification, clearAll, refreshNotifications, } = useNotifications();

  const [activeTab, setActiveTab] = useState('all');

  // Group notifications by category
  const _groupedNotifications = useMemo(() => {
    const groups = notifications.reduce((acc, notification) => {
      const category = notification.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(notification);
      return acc;
    }, {} as Record<string, Notification[]>);

    return groups;
  }, [notifications]);

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    switch (activeTab) {
      case 'unread':
        return notifications.filter(n => !n.read);
      case 'orders':
        return notifications.filter(n => n.category === 'order' || n.category === 'trading');
      case 'alerts':
        return notifications.filter(n => n.category === 'alert' || n.category === 'security');
      default:
        return notifications;
    }
  }, [notifications, activeTab]);

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      message.success('All notifications marked as read');
    } catch (error) {
      message.error('Failed to mark all as read');
    }
  };

  const handleClearAll = async () => {
    Modal.confirm({
      title: 'Clear All Notifications',
      content: 'Are you sure you want to clear all notifications? This action cannot be undone.',
      onOk: async () => {
        try {
          await clearAll();
          message.success('All notifications cleared');
        } catch (error) {
          message.error('Failed to clear notifications');
        }
      },
    });
  };

  const content = (
    <div
      style={{
        width: compact ? '320px' : '400px',
        maxHeight: compact ? '400px' : '500px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            Notifications
            {unreadCount > 0 && (
              <Badge
                count={unreadCount}
                style={{ marginLeft: '8px' }}
                size="small"
              />
            )}
          </Title>
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={refreshNotifications}
            loading={loading}
          />
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          style={{ marginBottom: 0 }}
        >
          <TabPane tab={`All (${notifications.length})`} key="all" />
          <TabPane tab={`Unread (${unreadCount})`} key="unread" />
          <TabPane tab="Orders" key="orders" />
          <TabPane tab="Alerts" key="alerts" />
        </Tabs>
      </div>

      {/* Error State */}
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          style={{ margin: '8px' }}
          action={
            <Button size="small" type="primary" onClick={refreshNotifications}>
              Retry
            </Button>
          }
        />
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
        </div>
      )}

      {/* Notifications List */}
      {!loading && !error && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredNotifications.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Text type="secondary">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
                </Text>
              }
              style={{ padding: '20px' }}
            />
          ) : (
            <List
              dataSource={filteredNotifications}
              renderItem={(notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                  compact={compact}
                />
              )}
              size="small"
            />
          )}
        </div>
      )}

      {/* Footer Actions */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #f0f0f0',
            backgroundColor: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            {unreadCount > 0 && (
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read
              </Button>
            )}
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          </Space>
          <Button
            type="link"
            size="small"
            onClick={() => navigate('/notifications')}
          >
            View All
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      overlay={content}
      trigger={trigger}
      placement={placement}
      overlayStyle={{
        borderRadius: '8px',
        boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
      }}
    >
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          icon={<BellOutlined style={{ fontSize: '16px' }} />}
          style={{
            border: 'none',
            color: '#262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            transition: 'all 0.2s',
          }}
          className="notification-bell-button"
        />
      </Badge>
    </Dropdown>
  );
};

export default NotificationCenter;