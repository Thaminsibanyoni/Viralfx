import React, { useState, useEffect } from 'react';
import {
  Avatar, Tooltip, Badge, Dropdown, Menu, Typography, Space, List, Tag, Divider, Button, Switch, } from 'antd';
import {
  UserOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, TeamOutlined, SettingOutlined, } from '@ant-design/icons';
import { useCRMWebSocket } from '../../hooks/useCRMWebSocket';
import dayjs from 'dayjs';

const {Text} = Typography;

interface OnlineUser {
  userId: string;
  userName: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: string;
  avatar?: string;
  email?: string;
  role?: string;
}

interface LiveUserStatusProps {
  users?: OnlineUser[];
  showStatusText?: boolean;
  showLastSeen?: boolean;
  allowStatusChange?: boolean;
  className?: string;
  maxVisible?: number;
}

const statusConfig = {
  online: {
    color: '#52c41a',
    label: 'Online',
    icon: <CheckCircleOutlined />,
  },
  away: {
    color: '#faad14',
    label: 'Away',
    icon: <ClockCircleOutlined />,
  },
  busy: {
    color: '#ff4d4f',
    label: 'Busy',
    icon: <CloseCircleOutlined />,
  },
  offline: {
    color: '#8c8c8c',
    label: 'Offline',
    icon: <CloseCircleOutlined />,
  },
};

const LiveUserStatus: React.FC<LiveUserStatusProps> = ({
  users = [],
  showStatusText = true,
  showLastSeen = true,
  allowStatusChange = false,
  className,
  maxVisible = 5,
}) => {
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [showOfflineUsers, setShowOfflineUsers] = useState(false);

  const {onlineUsers, currentUserStatus, updatePresence, } = useCRMWebSocket();

  // Combine props users with WebSocket online users
  const allUsers: OnlineUser[] = React.useMemo(() => {
    const onlineUserMap = new Map(
      onlineUsers.map(user => [user.userName, user])
    );

    return users.map(user => ({
      ...user,
      status: onlineUserMap.get(user.userName)?.status || user.status || 'offline',
      lastSeen: onlineUserMap.get(user.userName)?.lastSeen || user.lastSeen,
    }));
  }, [users, onlineUsers]);

  const onlineUserCount = allUsers.filter(user =>
    user.status === 'online' || user.status === 'away' || user.status === 'busy'
  ).length;

  const visibleUsers = showOfflineUsers
    ? allUsers
    : allUsers.filter(user => user.status !== 'offline');

  const getStatusText = (status: string, lastSeen?: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return 'Unknown';

    if (status === 'offline' && lastSeen) {
      return `Last seen ${dayjs(lastSeen).fromNow()}`;
    }

    return config.label;
  };

  const handleStatusChange = (newStatus: 'online' | 'away' | 'busy' | 'offline') => {
    updatePresence(newStatus);
  };

  const userStatusMenu = (
    <Menu className="live-user-status-menu">
      <Menu.Item key="header" disabled className="menu-header">
        <div className="flex items-center justify-between">
          <Text strong>
            <TeamOutlined /> Team Status ({onlineUserCount} online)
          </Text>
          {allowStatusChange && (
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
        </div>
      </Menu.Item>

      <Menu.Divider />

      {/* Current user status */}
      {allowStatusChange && (
        <Menu.Item key="current-user" className="current-user-status">
          <div className="flex items-center justify-between">
            <Space>
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>You</Text>
              <Tag color={statusConfig[currentUserStatus].color}>
                {statusConfig[currentUserStatus].label}
              </Tag>
            </Space>
          </div>
        </Menu.Item>
      )}

      <Menu.Divider />

      {/* Other users */}
      {visibleUsers.slice(0, maxVisible).map((user) => (
        <Menu.Item key={user.userId} className="user-status-item">
          <div className="flex items-center justify-between w-full">
            <Space>
              <Badge
                status={user.status === 'online' ? 'success' :
                       user.status === 'away' ? 'warning' :
                       user.status === 'busy' ? 'error' : 'default'}
                offset={[-2, 2]}
              >
                <Avatar
                  size="small"
                  src={user.avatar}
                  icon={<UserOutlined />}
                />
              </Badge>
              <div>
                <Text strong className="block text-sm">{user.userName}</Text>
                {showLastSeen && (
                  <Text type="secondary" className="text-xs">
                    {getStatusText(user.status, user.lastSeen)}
                  </Text>
                )}
              </div>
            </Space>
            <div className="flex items-center space-x-2">
              {user.role && (
                <Tag size="small" color="blue">
                  {user.role}
                </Tag>
              )}
              {showStatusText && (
                <Tag size="small" color={statusConfig[user.status as keyof typeof statusConfig]?.color}>
                  {statusConfig[user.status as keyof typeof statusConfig]?.label}
                </Tag>
              )}
            </div>
          </div>
        </Menu.Item>
      ))}

      {visibleUsers.length > maxVisible && (
        <Menu.Item key="show-more" disabled>
          <Text type="secondary" className="text-center w-full block">
            And {visibleUsers.length - maxVisible} more users...
          </Text>
        </Menu.Item>
      )}

      <Menu.Divider />

      {/* Toggle offline users */}
      <Menu.Item
        key="toggle-offline"
        onClick={() => setShowOfflineUsers(!showOfflineUsers)}
      >
        <div className="flex items-center justify-between w-full">
          <Text>Show offline users</Text>
          <Switch
            size="small"
            checked={showOfflineUsers}
            onChange={setShowOfflineUsers}
          />
        </div>
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      <Dropdown
        overlay={userStatusMenu}
        trigger={['click']}
        placement="bottomRight"
        overlayClassName="live-user-status-dropdown"
      >
        <div className={`flex items-center space-x-2 cursor-pointer ${className}`}>
          <Badge count={onlineUserCount} size="small" offset={[0, 0]}>
            <TeamOutlined style={{ fontSize: 16 }} />
          </Badge>
          {showStatusText && (
            <Text type="secondary" className="text-sm">
              {onlineUserCount} online
            </Text>
          )}
        </div>
      </Dropdown>

      {/* Status Settings Modal */}
      <Modal
        title="Status Settings"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setSettingsModalVisible(false)}>
            Cancel
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <Text strong>Your Status</Text>
          <Space direction="vertical" className="w-full">
            {Object.entries(statusConfig).map(([status, config]) => (
              <div
                key={status}
                className={`flex items-center justify-between p-3 rounded cursor-pointer hover:bg-gray-50 ${
                  currentUserStatus === status ? 'bg-blue-50 border border-blue-200' : ''
                }`}
                onClick={() => handleStatusChange(status as any)}
              >
                <Space>
                  <Badge
                    status={status === 'online' ? 'success' :
                           status === 'away' ? 'warning' :
                           status === 'busy' ? 'error' : 'default'}
                  />
                  {config.icon}
                  <Text>{config.label}</Text>
                </Space>
                {currentUserStatus === status && (
                  <CheckCircleOutlined style={{ color: '#1890ff' }} />
                )}
              </div>
            ))}
          </Space>

          <Divider />

          <div>
            <Text strong>Status Descriptions</Text>
            <List
              size="small"
              className="mt-2"
              dataSource={[
                { status: 'online', description: 'Available and active' },
                { status: 'away', description: 'Away from keyboard' },
                { status: 'busy', description: 'Do not disturb' },
                { status: 'offline', description: 'Not available' },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Badge
                      status={item.status === 'online' ? 'success' :
                             item.status === 'away' ? 'warning' :
                             item.status === 'busy' ? 'error' : 'default'}
                    />}
                    title={<Text className="capitalize">{item.status}</Text>}
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

// Individual User Status Component
export const _UserStatusIndicator: React.FC<{
  user: OnlineUser;
  showText?: boolean;
  showLastSeen?: boolean;
  className?: string;
}> = ({ user, showText = false, showLastSeen = false, className }) => {
  const config = statusConfig[user.status as keyof typeof statusConfig];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge
        status={user.status === 'online' ? 'success' :
               user.status === 'away' ? 'warning' :
               user.status === 'busy' ? 'error' : 'default'}
        offset={[-2, 2]}
      >
        <Avatar
          size="small"
          src={user.avatar}
          icon={<UserOutlined />}
        />
      </Badge>

      <div>
        <Text strong>{user.userName}</Text>
        {showText && (
          <div>
            <Tag size="small" color={config.color}>
              {config.label}
            </Tag>
          </div>
        )}
        {showLastSeen && user.status === 'offline' && user.lastSeen && (
          <Text type="secondary" className="text-xs block">
            {getStatusText(user.status, user.lastSeen)}
          </Text>
        )}
      </div>
    </div>
  );
};

// Compact User Status for Lists
export const CompactUserStatus: React.FC<{
  user: OnlineUser;
  className?: string;
}> = ({ user, className }) => {
  const config = statusConfig[user.status as keyof typeof statusConfig];

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Badge
        status={user.status === 'online' ? 'success' :
               user.status === 'away' ? 'warning' :
               user.status === 'busy' ? 'error' : 'default'}
      />
      <Text className="text-sm">{user.userName}</Text>
      <Tag size="small" color={config.color} className="ml-1">
        {config.label}
      </Tag>
    </div>
  );
};

// Team Presence Overview
export const _TeamPresenceOverview: React.FC<{
  title?: string;
  maxUsers?: number;
  className?: string;
}> = ({ title = 'Team Presence', maxUsers = 8, className }) => {
  const {onlineUsers} = useCRMWebSocket();

  const onlineCount = onlineUsers.filter(user =>
    user.status === 'online' || user.status === 'away' || user.status === 'busy'
  ).length;

  return (
    <div className={`p-4 bg-white rounded-lg shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <Text strong>{title}</Text>
        <Badge count={onlineCount} showZero />
      </div>

      <div className="space-y-2">
        {onlineUsers.slice(0, maxUsers).map((user) => (
          <CompactUserStatus
            key={user.userName}
            user={{
              userId: user.userName,
              userName: user.userName,
              status: user.status,
              lastSeen: user.lastSeen,
            }}
          />
        ))}

        {onlineUsers.length > maxUsers && (
          <Text type="secondary" className="text-xs">
            +{onlineUsers.length - maxUsers} more team members
          </Text>
        )}
      </div>
    </div>
  );
};

export default LiveUserStatus;