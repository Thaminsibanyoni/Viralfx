import React, { useState, useEffect } from 'react';
import { Layout, Card, Tabs, Spin, message, theme } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useBrokerStore } from '../stores/brokerStore';
import { UserOutlined, LockOutlined, BellOutlined, WalletOutlined, TeamOutlined, SettingOutlined } from '@ant-design/icons';

// Import tab components
import ProfileTab from '../components/settings/ProfileTab';
import SecurityTab from '../components/settings/SecurityTab';
import NotificationsTab from '../components/settings/NotificationsTab';
import WalletTab from '../components/settings/WalletTab';
import BrokerTab from '../components/settings/BrokerTab';
import PreferencesTab from '../components/settings/PreferencesTab';

const {Content} = Layout;

interface SettingsTabType {
  key: string;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
}

const Settings: React.FC = () => {
  const {token} = theme.useToken();
  const {user, updateUser} = useAuthStore();
  const {broker} = useBrokerStore();
  const navigate = useNavigate();
  const _location = useLocation();
  const {tab} = useParams();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(tab || 'profile');

  // Define ViralFX color scheme
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

  const settingsTabs: SettingsTabType[] = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <UserOutlined />,
      component: ProfileTab,
    },
    {
      key: 'security',
      label: 'Security',
      icon: <LockOutlined />,
      component: SecurityTab,
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: <BellOutlined />,
      component: NotificationsTab,
    },
    {
      key: 'wallet',
      label: 'Wallet',
      icon: <WalletOutlined />,
      component: WalletTab,
    },
    {
      key: 'broker',
      label: 'Broker',
      icon: <TeamOutlined />,
      component: BrokerTab,
    },
    {
      key: 'preferences',
      label: 'Preferences',
      icon: <SettingOutlined />,
      component: PreferencesTab,
    },
  ];

  useEffect(() => {
    // Load user data when component mounts
    const loadUserData = async () => {
      try {
        setLoading(true);
        // If we need to refresh user data from server, do it here
        // For now, we'll use the data from the store
      } catch (error) {
        message.error('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  useEffect(() => {
    // Handle tab navigation from URL
    if (tab && settingsTabs.find(t => t.key === tab)) {
      setActiveTab(tab);
    }
  }, [tab]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/settings/${newTab}`, { replace: true });
  };

  const renderTabContent = () => {
    const activeTabConfig = settingsTabs.find(t => t.key === activeTab);
    if (!activeTabConfig) return null;

    const Component = activeTabConfig.component;
    return (
      <Component
        user={user}
        broker={broker}
        onUpdateUser={updateUser}
      />
    );
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
        <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Spin size="large" tip="Loading settings..." />
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
                Settings
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: viralFxColors.textSecondary,
                fontSize: '16px'
              }}>
                Manage your account settings and preferences
              </p>
            </div>
            {broker && (
              <div style={{
                padding: '12px 20px',
                background: `linear-gradient(135deg, ${viralFxColors.accentGold}, ${viralFxColors.warningOrange})`,
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 500,
                fontSize: '14px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(255, 179, 0, 0.3)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>🤝 Linked to Broker</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{broker.companyName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Content */}
        <Card
          style={{
            borderRadius: '12px',
            border: `1px solid ${viralFxColors.borderDefault}`,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            overflow: 'hidden'
          }}
          bodyStyle={{ padding: 0 }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            type="card"
            size="large"
              tabBarStyle={{
              background: viralFxColors.backgroundSecondary,
              margin: 0,
              padding: '0 24px',
              borderBottom: `1px solid ${viralFxColors.borderDefault}`,
            }}
            items={settingsTabs.map(tab => ({
              key: tab.key,
              label: (
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontWeight: 500,
                  color: activeTab === tab.key ? viralFxColors.primaryPurple : viralFxColors.textSecondary
                }}>
                  {tab.icon}
                  {tab.label}
                </span>
              ),
              children: (
                <div style={{
                  padding: '24px',
                  minHeight: '400px',
                  background: viralFxColors.backgroundPrimary
                }}>
                  {renderTabContent()}
                </div>
              ),
            }))}
            />
        </Card>
      </Content>
    </Layout>
  );
};

export default Settings;