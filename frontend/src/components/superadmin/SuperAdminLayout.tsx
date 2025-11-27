import React, { useState, useEffect } from 'react';
import {
  Layout, Menu, Avatar, Dropdown, Space, Badge, Typography, Button, theme, Drawer, List, Tooltip, } from 'antd';
import {
  DashboardOutlined, UserOutlined, TeamOutlined, DollarOutlined, TrophyOutlined, AlertOutlined, CloudOutlined, SettingOutlined, NotificationOutlined, FileSearchOutlined, CrownOutlined, BellOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SunOutlined, MoonOutlined, QuestionCircleOutlined, } from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';
import CollapsibleSidebar from './CollapsibleSidebar';

const {Header, Sider, Content} = Layout;
const {Text} = Typography;

interface SuperAdminLayoutProps {
  children?: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}

const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({
  children,
  title,
  actions,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notificationDrawerVisible, setNotificationDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {admin, logout, notifications, checkPermission, hasRole} = useAdminStore();
  const {token: { colorBgContainer, borderRadiusLG},
  } = theme.useToken();

  // Navigation menu items
  const menuItems = [
    {
      key: '/superadmin',
      icon: <DashboardOutlined />,
      label: 'Overview',
      permission: 'dashboard:read',
    },
    {
      key: 'user-ops',
      icon: <UserOutlined />,
      label: 'User Management',
      permission: 'users:read',
      children: [
        {
          key: '/superadmin/users',
          label: 'Users',
          permission: 'users:read',
        },
        {
          key: '/superadmin/users/kyc',
          label: 'KYC Reviews',
          permission: 'kyc:read',
        },
        {
          key: '/superadmin/users/suspensions',
          label: 'Suspensions',
          permission: 'suspensions:read',
        },
      ],
    },
    {
      key: 'broker-ops',
      icon: <TeamOutlined />,
      label: 'Broker Management',
      permission: 'brokers:read',
      children: [
        {
          key: '/superadmin/brokers',
          label: 'Brokers',
          permission: 'brokers:read',
        },
        {
          key: '/superadmin/brokers/applications',
          label: 'Applications',
          permission: 'brokers:read',
        },
        {
          key: '/superadmin/brokers/compliance',
          label: 'Compliance',
          permission: 'compliance:read',
        },
      ],
    },
    {
      key: 'finance-ops',
      icon: <DollarOutlined />,
      label: 'Finance Operations',
      permission: 'finance:read',
      children: [
        {
          key: '/superadmin/finance',
          label: 'Transactions',
          permission: 'finance:read',
        },
        {
          key: '/superadmin/finance/invoices',
          label: 'Invoices',
          permission: 'invoices:read',
        },
        {
          key: '/superadmin/finance/payouts',
          label: 'Payouts',
          permission: 'payouts:read',
        },
      ],
    },
    {
      key: 'trend-ops',
      icon: <TrophyOutlined />,
      label: 'Trend Operations',
      permission: 'trends:read',
      children: [
        {
          key: '/superadmin/trends',
          label: 'Trends',
          permission: 'trends:read',
        },
        {
          key: '/superadmin/vts',
          label: 'VTS Registry',
          permission: 'vts:read',
        },
        {
          key: '/superadmin/trends/disputes',
          label: 'Disputes',
          permission: 'disputes:read',
        },
      ],
    },
    {
      key: 'risk-ops',
      icon: <AlertOutlined />,
      label: 'Risk Management',
      permission: 'risk:read',
      children: [
        {
          key: '/superadmin/risk',
          label: 'Risk Alerts',
          permission: 'risk:read',
        },
        {
          key: '/superadmin/risk/content',
          label: 'Content Moderation',
          permission: 'content:read',
        },
        {
          key: '/superadmin/risk/abuse',
          label: 'Abuse Detection',
          permission: 'abuse:read',
        },
      ],
    },
    {
      key: 'tech-ops',
      icon: <CloudOutlined />,
      label: 'Technical Operations',
      permission: 'tech:read',
      children: [
        {
          key: '/superadmin/oracle',
          label: 'Oracle Network',
          permission: 'oracle:read',
        },
        {
          key: '/superadmin/system/health',
          label: 'System Health',
          permission: 'system:read',
        },
        {
          key: '/superadmin/system/logs',
          label: 'System Logs',
          permission: 'logs:read',
        },
        {
          key: '/superadmin/system/resilience',
          label: 'System Resilience',
          permission: 'resilience:read',
        },
      ],
    },
    {
      key: 'management',
      icon: <SettingOutlined />,
      label: 'Platform Management',
      permission: 'platform:read',
      children: [
        {
          key: '/superadmin/platform',
          label: 'Platform Settings',
          permission: 'platform:read',
          superAdminOnly: true,
        },
        {
          key: '/superadmin/notifications',
          label: 'Notifications',
          permission: 'notifications:read',
        },
        {
          key: '/superadmin/admins',
          label: 'Admin Management',
          permission: 'admins:read',
          superAdminOnly: true,
        },
      ],
    },
    {
      key: '/superadmin/audit',
      icon: <FileSearchOutlined />,
      label: 'Audit Logs',
      permission: 'audit:read',
    },
  ];

  // Filter menu items based on permissions
  const _filteredMenuItems = menuItems
    .filter(item => {
      // Check if item is for SuperAdmin only and user is not SuperAdmin
      if (item.superAdminOnly && !hasRole('SUPER_ADMIN')) {
        return false;
      }
      // Check if user has required permission
      if (item.permission && !checkPermission(item.permission)) {
        return false;
      }
      return true;
    })
    .map(item => {
      // Filter children items
      if (item.children) {
        const filteredChildren = item.children.filter(child => {
          if (child.superAdminOnly && !hasRole('SUPER_ADMIN')) {
            return false;
          }
          if (child.permission && !checkPermission(child.permission)) {
            return false;
          }
          return true;
        });
        return { ...item, children: filteredChildren };
      }
      return item;
    });

  // Handle menu item click
  const _handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  // Get selected keys based on current location
  const _getSelectedKeys = () => {
    const path = location.pathname;
    return [path];
  };

  // Get open keys for submenu
  const _getOpenKeys = () => {
    const path = location.pathname;
    const openKeys: string[] = [];

    menuItems.forEach(item => {
      if (item.children) {
        const childKey = item.children.find(child => child.key === path)?.key;
        if (childKey) {
          openKeys.push(item.key);
        }
      }
    });

    return openKeys;
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/admin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // User dropdown menu
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/superadmin/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/superadmin/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'help',
      icon: <QuestionCircleOutlined />,
      label: 'Help & Documentation',
      onClick: () => window.open('/docs/admin', '_blank'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
      danger: true,
    },
  ];

  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // Here you would implement theme switching logic
  };

  // Unread notifications count
  const unreadCount = notifications?.filter(n => !n.read).length || 0;

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={256}
        className="fixed left-0 top-0 bottom-0 z-10 shadow-lg"
        style={{
          background: '#4B0082', // ViralFX purple
          overflow: 'auto',
        }}
      >
        {/* Logo and Header */}
        <div className="flex items-center justify-center h-16 border-b border-purple-700">
          {!collapsed ? (
            <div className="text-center">
              <div className="flex items-center justify-center mb-1">
                <CrownOutlined className="text-yellow-400 text-2xl mr-2" />
                <span className="text-white font-bold text-lg">SuperAdmin</span>
              </div>
              <Text className="text-purple-200 text-xs">ViralFX Control Panel</Text>
            </div>
          ) : (
            <CrownOutlined className="text-yellow-400 text-2xl" />
          )}
        </div>

        {/* Collapsible Navigation Sidebar */}
        <CollapsibleSidebar
          collapsed={collapsed}
          onCollapse={setCollapsed}
        />

        {/* Collapse Toggle */}
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-purple-700"
          />
        </div>
      </Sider>

      <Layout className={`transition-all duration-300 ${collapsed ? 'ml-20' : 'ml-64'}`}>
        {/* Top Header */}
        <Header
          className="flex items-center justify-between px-6 shadow-md"
          style={{
            background: colorBgContainer,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <div className="flex items-center space-x-4">
            <Button
              type="text"
              icon={<MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="lg:hidden"
            />
            {title && (
              <div>
                <Text className="text-xl font-semibold">{title}</Text>
                {admin && (
                  <Text className="block text-sm text-gray-500">
                    {admin.role.replace('_', ' ')} Dashboard
                  </Text>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Page Actions */}
            {actions}

            {/* Theme Toggle */}
            <Tooltip title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
              <Button
                type="text"
                icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
              />
            </Tooltip>

            {/* Notifications */}
            <Tooltip title="Notifications">
              <Badge count={unreadCount} size="small">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  onClick={() => setNotificationDrawerVisible(true)}
                />
              </Badge>
            </Tooltip>

            {/* User Dropdown */}
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={['click']}
            >
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 px-3 py-2 rounded-lg">
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  src={admin?.avatar}
                  style={{ backgroundColor: '#FFB300' }}
                />
                <div className="hidden sm:block">
                  <div className="text-sm font-medium">
                    {admin?.firstName} {admin?.lastName}
                  </div>
                  <div className="text-xs text-gray-500">
                    {admin?.role.replace('_', ' ')}
                  </div>
                </div>
              </div>
            </Dropdown>
          </div>
        </Header>

        {/* Main Content */}
        <Content
          className="p-6"
          style={{
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
            margin: '16px',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {/* Breadcrumb would go here */}
          {children || <Outlet />}
        </Content>
      </Layout>

      {/* Notifications Drawer */}
      <Drawer
        title="Notifications"
        placement="right"
        onClose={() => setNotificationDrawerVisible(false)}
        open={notificationDrawerVisible}
        width={400}
      >
        <List
          dataSource={notifications || []}
          renderItem={(item: any) => (
            <List.Item
              className={`cursor-pointer hover:bg-gray-50 ${!item.read ? 'bg-blue-50' : ''}`}
              onClick={() => {
                // Mark notification as read
                // This would be implemented in the store
              }}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    size="small"
                    style={{
                      backgroundColor: item.severity === 'HIGH' ? '#ff4d4f' : '#1890ff',
                    }}
                    icon={<BellOutlined />}
                  />
                }
                title={
                  <div className="flex justify-between items-start">
                    <Text className={!item.read ? 'font-semibold' : ''}>
                      {item.title}
                    </Text>
                    <Text type="secondary" className="text-xs">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary" className="text-sm">
                      {item.message}
                    </Text>
                    <div className="mt-1">
                      <Tag size="small" color={item.severity === 'HIGH' ? 'red' : 'blue'}>
                        {item.type}
                      </Tag>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </Layout>
  );
};

export default SuperAdminLayout;