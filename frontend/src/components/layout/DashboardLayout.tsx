import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Avatar, Dropdown, Space, Badge, Button, Typography, Drawer, theme, Tooltip, } from 'antd';
import {
  DashboardOutlined, RiseOutlined, BarChartOutlined, WalletOutlined, MessageOutlined, BellOutlined, UserOutlined, SettingOutlined, LogoutOutlined, MenuOutlined, CloseOutlined, TeamOutlined, CrownOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { useBrokerStore } from '../../stores/brokerStore';
import NotificationCenter from '../notifications/NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

const {Header, Sider, Content} = Layout;
const {Text} = Typography;

const DashboardLayout: React.FC = () => {
  const {user, logout} = useAuthStore();
  const {broker} = useBrokerStore();
  const {unreadCount} = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const {token} = theme.useToken();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setCollapsed(mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/markets',
      icon: <RiseOutlined />,
      label: 'Markets',
    },
    {
      key: '/analytics',
      icon: <BarChartOutlined />,
      label: 'Analytics',
    },
    {
      key: '/wallet',
      icon: <WalletOutlined />,
      label: 'Wallet',
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: 'Chat',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      children: [
        {
          key: '/settings/profile',
          label: 'Profile',
        },
        {
          key: '/settings/broker',
          label: 'Broker',
        },
        {
          key: '/settings/security',
          label: 'Security',
        },
      ],
    },
    // Broker-specific menu items
    ...(broker ? [
      {
        key: 'broker-section',
        label: 'Broker Tools',
        type: 'divider',
      },
      {
        key: '/broker/dashboard',
        icon: <CrownOutlined />,
        label: 'Broker Dashboard',
      },
      {
        key: '/broker/clients',
        icon: <TeamOutlined />,
        label: 'Client Management',
      },
    ] : []),
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
      onClick: () => navigate('/settings/profile'),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
      onClick: () => navigate('/settings'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  const selectedKeys = [location.pathname];

  const renderHeader = () => (
    <Header
      style={{
        padding: '0 24px',
        background: viralFxColors.backgroundPrimary,
        borderBottom: `1px solid ${viralFxColors.borderDefault}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: '64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setMobileMenuOpen(true)}
            style={{ marginRight: '16px' }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              background: `linear-gradient(135deg, ${viralFxColors.primaryPurple}, ${viralFxColors.primaryPurpleLight})`,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '12px',
            }}
          >
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              VX
            </Text>
          </div>
          <Text
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: viralFxColors.textPrimary,
            }}
          >
            ViralFX
          </Text>
          {broker && (
            <div
              style={{
                marginLeft: '16px',
                padding: '4px 12px',
                background: `${viralFxColors.accentGold}20`,
                border: `1px solid ${viralFxColors.accentGold}`,
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CrownOutlined style={{ color: viralFxColors.accentGold, marginRight: '4px', fontSize: '12px' }} />
              <Text style={{ color: viralFxColors.accentGold, fontSize: '12px', fontWeight: 500 }}>
                {broker.tier}
              </Text>
            </div>
          )}
        </div>
      </div>

      <Space size="middle">
        {/* Notifications */}
        <Tooltip title="Notifications">
          <Button
            type="text"
            icon={
              <Badge count={unreadCount} size="small">
                <BellOutlined style={{ fontSize: '18px', color: viralFxColors.textSecondary }} />
              </Badge>
            }
            onClick={() => setNotificationDrawerOpen(true)}
          />
        </Tooltip>

        {/* User Dropdown */}
        <Dropdown
          menu={{ items: userMenuItems }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Avatar
              size="small"
              src={user?.avatarUrl}
              icon={<UserOutlined />}
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                marginRight: '8px',
              }}
            />
            <Text style={{ color: viralFxColors.textPrimary }}>
              {user?.firstName} {user?.lastName}
            </Text>
          </div>
        </Dropdown>
      </Space>
    </Header>
  );

  const renderSidebar = () => (
    <>
      {!isMobile ? (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={250}
          collapsedWidth={80}
          style={{
            background: viralFxColors.backgroundPrimary,
            borderRight: `1px solid ${viralFxColors.borderDefault}`,
            overflow: 'auto',
            height: 'calc(100vh - 64px)',
          }}
        >
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{
              border: 'none',
              height: '100%',
            }}
          />
        </Sider>
      ) : (
        <Drawer
          title={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  background: `linear-gradient(135deg, ${viralFxColors.primaryPurple}, ${viralFxColors.primaryPurpleLight})`,
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '8px',
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                  VX
                </Text>
              </div>
              <Text>ViralFX</Text>
            </div>
          }
          placement="left"
          onClose={() => setMobileMenuOpen(false)}
          open={mobileMenuOpen}
          bodyStyle={{ padding: 0 }}
          width={250}
        >
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ border: 'none' }}
          />
        </Drawer>
      )}
    </>
  );

  return (
    <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
      {renderHeader()}
      <Layout>
        {renderSidebar()}
        <Layout style={{ marginLeft: isMobile ? 0 : collapsed ? 80 : 250 }}>
          <Content
            style={{
              padding: '24px',
              background: viralFxColors.backgroundSecondary,
              minHeight: 'calc(100vh - 64px)',
              transition: 'all 0.2s',
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      </Layout>

      {/* Notifications Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <BellOutlined style={{ marginRight: '8px', color: viralFxColors.primaryPurple }} />
              <Text>Notifications</Text>
              {unreadCount > 0 && (
                <Badge
                  count={unreadCount}
                  style={{ marginLeft: '8px', backgroundColor: viralFxColors.errorRed }}
                />
              )}
            </div>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setNotificationDrawerOpen(false)}
            />
          </div>
        }
        placement="right"
        onClose={() => setNotificationDrawerOpen(false)}
        open={notificationDrawerOpen}
        width={400}
        bodyStyle={{ padding: 0 }}
      >
        <NotificationCenter compact={true} />
      </Drawer>
    </Layout>
  );
};

export default DashboardLayout;