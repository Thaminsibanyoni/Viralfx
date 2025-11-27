import React, { useState, useEffect } from 'react';
import {
  Card, Switch, Select, TimePicker, Button, Row, Col, Divider, Alert, message, Typography, Space, Tag, Tooltip, } from 'antd';
import {
  BellOutlined, MailOutlined, MobileOutlined, DesktopOutlined, SettingOutlined, SoundOutlined, EyeOutlined, CheckCircleOutlined, } from '@ant-design/icons';
import { User, NotificationPreferences } from '../../types/user.types';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

const {Title, Text} = Typography;
const {Option} = Select;

interface NotificationsTabProps {
  user: User;
  onUpdateUser: (userData: Partial<User>) => void;
}

const NotificationsTab: React.FC<NotificationsTabProps> = ({ user, onUpdateUser }) => {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<string | null>(null);

  // Helper function to format key names
  const formatKey = (key: string): string => {
    return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').toLowerCase();
  };

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    infoBlue: '#2196f3',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  // Initialize form state from user preferences
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      orderConfirmations: user.preferences?.notifications?.email?.orderConfirmations ?? true,
      priceAlerts: user.preferences?.notifications?.email?.priceAlerts ?? true,
      trendAlerts: user.preferences?.notifications?.email?.trendAlerts ?? true,
      marketingEmails: user.preferences?.notifications?.email?.marketingEmails ?? false,
      securityAlerts: user.preferences?.notifications?.email?.securityAlerts ?? true,
      weeklySummary: user.preferences?.notifications?.email?.weeklySummary ?? true,
      brokerUpdates: user.preferences?.notifications?.email?.brokerUpdates ?? true,
      systemUpdates: user.preferences?.notifications?.email?.systemUpdates ?? false,
    },
    push: {
      orderConfirmations: user.preferences?.notifications?.push?.orderConfirmations ?? true,
      priceAlerts: user.preferences?.notifications?.push?.priceAlerts ?? true,
      trendAlerts: user.preferences?.notifications?.push?.trendAlerts ?? true,
      securityAlerts: user.preferences?.notifications?.push?.securityAlerts ?? true,
      brokerUpdates: user.preferences?.notifications?.push?.brokerUpdates ?? true,
    },
    sms: {
      securityAlerts: user.preferences?.notifications?.sms?.securityAlerts ?? false,
      criticalAlerts: user.preferences?.notifications?.sms?.criticalAlerts ?? false,
    },
    inApp: {
      realTimeUpdates: user.preferences?.notifications?.inApp?.realTimeUpdates ?? true,
      soundEffects: user.preferences?.notifications?.inApp?.soundEffects ?? true,
      desktopNotifications: user.preferences?.notifications?.inApp?.desktopNotifications ?? true,
    },
    frequency: (user.preferences?.notifications?.frequency as any) ?? 'instant',
    quietHours: user.preferences?.notifications?.quietHours ?? {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'Africa/Johannesburg',
    },
  });

  const handleSavePreferences = async () => {
    setLoading(true);
    try {
      // Update user preferences
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          notifications: preferences,
        },
      };

      onUpdateUser(updatedUser);
      toast.success('Notification preferences saved successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to save preferences. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async (type: string) => {
    setTestLoading(type);
    try {
      // Simulate API call to send test notification
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success(`Test ${type} notification sent!`, {
        style: {
          background: viralFxColors.infoBlue,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error(`Failed to send test ${type} notification.`, {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setTestLoading(null);
    }
  };

  const updatePreferences = (category: keyof NotificationPreferences, field: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const updateQuietHours = (field: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      quietHours: {
        ...prev.quietHours,
        [field]: value,
      },
    }));
  };

  const handleBrowserNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Browser notifications enabled!', {
          style: {
            background: viralFxColors.successGreen,
            color: 'white',
          },
        });
        updatePreferences('inApp', 'desktopNotifications', true);
      } else {
        toast.error('Browser notification permission denied.', {
          style: {
            background: viralFxColors.warningOrange,
            color: 'white',
          },
        });
      }
    } catch (error) {
      toast.error('Failed to request browser notification permission.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  return (
    <div>
      {/* Notification Settings Overview */}
      <Card
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <BellOutlined
            style={{
              fontSize: '32px',
              color: viralFxColors.primaryPurple,
            }}
          />
          <div>
            <Title level={3} style={{ margin: 0, color: viralFxColors.textPrimary }}>
              Notification Preferences
            </Title>
            <Text style={{ color: viralFxColors.textSecondary }}>
              Choose how you want to receive notifications from ViralFX
            </Text>
          </div>
        </div>

        <Alert
          message="Stay Informed"
          description="Customize your notification preferences to stay updated on your trades, account activity, and important market updates."
          type="info"
          showIcon
          style={{
            backgroundColor: '#e6f7ff',
            borderColor: '#91d5ff',
          }}
        />
      </Card>

      <Row gutter={24}>
        {/* Email Notifications */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MailOutlined style={{ color: viralFxColors.primaryPurple }} />
                <span style={{ color: viralFxColors.textPrimary }}>Email Notifications</span>
              </div>
            }
            extra={
              <Button
                size="small"
                loading={testLoading === 'email'}
                onClick={() => handleTestNotification('email')}
                style={{
                  borderColor: viralFxColors.primaryPurple,
                  color: viralFxColors.primaryPurple,
                }}
              >
                Test Email
              </Button>
            }
            style={{
              marginBottom: '24px',
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(preferences.email).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: viralFxColors.textPrimary }}>
                    {formatKey(key)}
                  </span>
                  <Switch
                    checked={value}
                    onChange={(checked) => updatePreferences('email', key, checked)}
                    style={{
                      backgroundColor: value ? viralFxColors.primaryPurple : undefined,
                    }}
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Push Notifications */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BellOutlined style={{ color: viralFxColors.primaryPurple }} />
                <span style={{ color: viralFxColors.textPrimary }}>Push Notifications</span>
              </div>
            }
            extra={
              <Button
                size="small"
                loading={testLoading === 'push'}
                onClick={() => handleTestNotification('push')}
                style={{
                  borderColor: viralFxColors.primaryPurple,
                  color: viralFxColors.primaryPurple,
                }}
              >
                Test Push
              </Button>
            }
            style={{
              marginBottom: '24px',
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(preferences.push).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: viralFxColors.textPrimary }}>
                    {formatKey(key)}
                  </span>
                  <Switch
                    checked={value}
                    onChange={(checked) => updatePreferences('push', key, checked)}
                    style={{
                      backgroundColor: value ? viralFxColors.primaryPurple : undefined,
                    }}
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>

        {/* SMS Notifications */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MobileOutlined style={{ color: viralFxColors.primaryPurple }} />
                <span style={{ color: viralFxColors.textPrimary }}>SMS Notifications</span>
              </div>
            }
            extra={
              !user.phoneVerified && (
                <Tag
                  color="warning"
                  style={{
                    backgroundColor: '#fffbe6',
                    borderColor: '#ffe58f',
                    color: '#faad14',
                  }}
                >
                  Phone Required
                </Tag>
              )
            }
            style={{
              marginBottom: '24px',
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(preferences.sms).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: viralFxColors.textPrimary }}>
                      {formatKey(key)}
                    </div>
                    {key === 'criticalAlerts' && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Only for urgent security matters
                      </Text>
                    )}
                  </div>
                  <Switch
                    checked={value}
                    onChange={(checked) => updatePreferences('sms', key, checked)}
                    disabled={!user.phoneVerified}
                    style={{
                      backgroundColor: value && user.phoneVerified ? viralFxColors.primaryPurple : undefined,
                    }}
                  />
                </div>
              ))}
            </Space>

            {!user.phoneVerified && (
              <Alert
                message="Phone Verification Required"
                description="Verify your phone number in the Profile tab to enable SMS notifications."
                type="warning"
                showIcon
                style={{
                  marginTop: '16px',
                  backgroundColor: '#fffbe6',
                  borderColor: '#ffe58f',
                }}
              />
            )}
          </Card>
        </Col>

        {/* In-App Notifications */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DesktopOutlined style={{ color: viralFxColors.primaryPurple }} />
                <span style={{ color: viralFxColors.textPrimary }}>In-App Notifications</span>
              </div>
            }
            style={{
              marginBottom: '24px',
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(preferences.inApp).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: viralFxColors.textPrimary }}>
                      {formatKey(key)}
                    </div>
                    {key === 'desktopNotifications' && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Browser permission required
                      </Text>
                    )}
                    {key === 'realTimeUpdates' && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Live updates in dashboard
                      </Text>
                    )}
                  </div>
                  {key === 'desktopNotifications' ? (
                    <Tooltip title="Enable browser notifications">
                      <Button
                        icon={<EyeOutlined />}
                        size="small"
                        onClick={handleBrowserNotificationPermission}
                        style={{
                          borderColor: viralFxColors.primaryPurple,
                          color: viralFxColors.primaryPurple,
                        }}
                      >
                        Enable
                      </Button>
                    </Tooltip>
                  ) : (
                    <Switch
                      checked={value}
                      onChange={(checked) => updatePreferences('inApp', key, checked)}
                      style={{
                        backgroundColor: value ? viralFxColors.primaryPurple : undefined,
                      }}
                    />
                  )}
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Notification Frequency & Quiet Hours */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingOutlined style={{ color: viralFxColors.primaryPurple }} />
            <span style={{ color: viralFxColors.textPrimary }}>Notification Frequency & Schedule</span>
          </div>
        }
        style={{
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ color: viralFxColors.textPrimary, display: 'block', marginBottom: '8px' }}>
                Email Summary Frequency
              </Text>
              <Select
                value={preferences.frequency}
                onChange={(value) => updatePreferences('frequency' as any, value, value)}
                style={{
                  width: '100%',
                  borderRadius: '6px',
                }}
              >
                <Option value="instant">Instant notifications</Option>
                <Option value="hourly">Hourly digest</Option>
                <Option value="daily">Daily digest</Option>
              </Select>
            </div>
          </Col>

          <Col xs={24} md={12}>
            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ color: viralFxColors.textPrimary, display: 'block', marginBottom: '8px' }}>
                In-App Sound Effects
              </Text>
              <Space>
                <SoundOutlined style={{ color: viralFxColors.textSecondary }} />
                <Switch
                  checked={preferences.inApp.soundEffects}
                  onChange={(checked) => updatePreferences('inApp', 'soundEffects', checked)}
                  style={{
                    backgroundColor: preferences.inApp.soundEffects ? viralFxColors.primaryPurple : undefined,
                  }}
                />
              </Space>
            </div>
          </Col>
        </Row>

        <Divider />

        <div>
          <div style={{ marginBottom: '16px' }}>
            <Text strong style={{ color: viralFxColors.textPrimary, display: 'block', marginBottom: '8px' }}>
              Quiet Hours
            </Text>
            <Text type="secondary" style={{ color: viralFxColors.textSecondary }}>
              Temporarily pause notifications during specified hours
            </Text>
          </div>

          <Row gutter={24} align="middle">
            <Col xs={24} md={6}>
              <Space>
                <Switch
                  checked={preferences.quietHours.enabled}
                  onChange={(checked) => updateQuietHours('enabled', checked)}
                  style={{
                    backgroundColor: preferences.quietHours.enabled ? viralFxColors.primaryPurple : undefined,
                  }}
                />
                <Text style={{ color: viralFxColors.textPrimary }}>
                  Enable quiet hours
                </Text>
              </Space>
            </Col>

            <Col xs={24} md={6}>
              <div>
                <Text style={{ color: viralFxColors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>
                  From
                </Text>
                <TimePicker
                  value={dayjs(preferences.quietHours.startTime, 'HH:mm')}
                  format="HH:mm"
                  onChange={(time) => updateQuietHours('startTime', time?.format('HH:mm'))}
                  disabled={!preferences.quietHours.enabled}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>

            <Col xs={24} md={6}>
              <div>
                <Text style={{ color: viralFxColors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>
                  To
                </Text>
                <TimePicker
                  value={dayjs(preferences.quietHours.endTime, 'HH:mm')}
                  format="HH:mm"
                  onChange={(time) => updateQuietHours('endTime', time?.format('HH:mm'))}
                  disabled={!preferences.quietHours.enabled}
                  style={{ width: '100%' }}
                />
              </div>
            </Col>

            <Col xs={24} md={6}>
              <div>
                <Text style={{ color: viralFxColors.textSecondary, fontSize: '12px', marginBottom: '4px' }}>
                  Timezone
                </Text>
                <Select
                  value={preferences.quietHours.timezone}
                  onChange={(value) => updateQuietHours('timezone', value)}
                  style={{ width: '100%' }}
                  disabled={!preferences.quietHours.enabled}
                >
                  <Option value="Africa/Johannesburg">South Africa (Johannesburg)</Option>
                  <Option value="Africa/Cairo">Egypt (Cairo)</Option>
                  <Option value="Europe/London">UK (London)</Option>
                  <Option value="Europe/Paris">France (Paris)</Option>
                  <Option value="America/New_York">US (New York)</Option>
                </Select>
              </div>
            </Col>
          </Row>
        </div>
      </Card>

      {/* Save Button */}
      <div style={{ marginTop: '24px', textAlign: 'center' }}>
        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={handleSavePreferences}
          style={{
            backgroundColor: viralFxColors.primaryPurple,
            borderColor: viralFxColors.primaryPurple,
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
            minWidth: '200px',
          }}
        >
          Save Preferences
        </Button>
      </div>
    </div>
  );
};

export default NotificationsTab;