import React, { useState, useEffect } from 'react';
import {
  Form, Input, Button, Card, Row, Col, Switch, List, Modal, Alert, Divider, Space, Tag, Progress, QRCode, Typography, message, Tooltip, } from 'antd';
import {
  LockOutlined, SafetyOutlined, EyeOutlined, EyeInvisibleOutlined, MobileOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DeleteOutlined, CopyOutlined, KeyOutlined, SecurityScanOutlined, } from '@ant-design/icons';
import { User } from '../../types/user.types';
import { toast } from 'react-hot-toast';

const {Title, Text} = Typography;
const {Password} = Input;

interface SecurityTabProps {
  user: User;
  onUpdateUser: (userData: Partial<User>) => void;
}

interface Session {
  id: string;
  device: string;
  browser: string;
  os: string;
  ipAddress: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  lastAccessAt: string;
}

interface LoginHistory {
  id: string;
  ipAddress: string;
  location?: string;
  device: string;
  browser: string;
  success: boolean;
  createdAt: string;
  failureReason?: string;
}

const SecurityTab: React.FC<SecurityTabProps> = ({ user, onUpdateUser }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [twoFactorModalVisible, setTwoFactorModalVisible] = useState(false);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

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

  // Mock data - in real implementation, fetch from API
  const [activeSessions, setActiveSessions] = useState<Session[]>([
    {
      id: '1',
      device: 'Chrome on Windows',
      browser: 'Chrome 119.0',
      os: 'Windows 11',
      ipAddress: '192.168.1.100',
      location: 'Johannesburg, ZA',
      isActive: true,
      createdAt: '2024-01-15T10:30:00Z',
      lastAccessAt: '2024-01-20T14:45:00Z',
    },
    {
      id: '2',
      device: 'Safari on iPhone',
      browser: 'Safari 17.0',
      os: 'iOS 17.0',
      ipAddress: '192.168.1.101',
      location: 'Cape Town, ZA',
      isActive: true,
      createdAt: '2024-01-18T09:15:00Z',
      lastAccessAt: '2024-01-20T12:30:00Z',
    },
  ]);

  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([
    {
      id: '1',
      ipAddress: '192.168.1.100',
      location: 'Johannesburg, ZA',
      device: 'Chrome on Windows',
      browser: 'Chrome 119.0',
      success: true,
      createdAt: '2024-01-20T14:45:00Z',
    },
    {
      id: '2',
      ipAddress: '192.168.1.102',
      location: 'Unknown',
      device: 'Firefox on Linux',
      browser: 'Firefox 118.0',
      success: false,
      createdAt: '2024-01-20T13:30:00Z',
      failureReason: 'Invalid password',
    },
  ]);

  const [securityScore, setSecurityScore] = useState(65);

  useEffect(() => {
    calculateSecurityScore();
  }, [user]);

  const calculateSecurityScore = () => {
    let score = 0;
    const factors = {
      strongPassword: 25,
      twoFactorEnabled: 30,
      emailVerified: 15,
      phoneVerified: 15,
      recentLogin: 15,
    };

    if (user.isTwoFactorEnabled) score += factors.twoFactorEnabled;
    if (user.emailVerified) score += factors.emailVerified;
    if (user.phoneVerified) score += factors.phoneVerified;
    if (user.lastLoginAt) {
      const lastLogin = new Date(user.lastLoginAt);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (lastLogin > thirtyDaysAgo) score += factors.recentLogin;
    }

    setSecurityScore(score);
  };

  const handleChangePassword = async (values: any) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const updatedUser = {
        ...user,
        // In real implementation, this would be handled by the API
      };

      onUpdateUser(updatedUser);
      form.resetFields();
      toast.success('Password changed successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to change password. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = () => {
    setTwoFactorModalVisible(true);
    setQrCodeVisible(true);
  };

  const handleDisable2FA = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      const updatedUser = {
        ...user,
        isTwoFactorEnabled: false,
        twoFactorSecret: undefined,
      };

      onUpdateUser(updatedUser);
      calculateSecurityScore();

      toast.success('2FA disabled successfully!', {
        style: {
          background: viralFxColors.warningOrange,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to disable 2FA. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      setActiveSessions(activeSessions.filter(s => s.id !== sessionId));
      toast.success('Session revoked successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to revoke session. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleRevokeAllSessions = async () => {
    Modal.confirm({
      title: 'Revoke All Sessions',
      content: 'Are you sure you want to revoke all active sessions? You will need to log in again on all devices.',
      okText: 'Revoke All',
      cancelText: 'Cancel',
      okButtonProps: {
        style: {
          backgroundColor: viralFxColors.errorRed,
          borderColor: viralFxColors.errorRed,
        },
      },
      onOk: async () => {
        try {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 1000));

          setActiveSessions([]);
          toast.success('All sessions revoked successfully!', {
            style: {
              background: viralFxColors.successGreen,
              color: 'white',
            },
          });
        } catch (error) {
          toast.error('Failed to revoke sessions. Please try again.', {
            style: {
              background: viralFxColors.errorRed,
              color: 'white',
            },
          });
        }
      },
    });
  };

  const getSecurityScoreColor = () => {
    if (securityScore >= 80) return viralFxColors.successGreen;
    if (securityScore >= 60) return viralFxColors.warningOrange;
    return viralFxColors.errorRed;
  };

  const getSecurityScoreStatus = () => {
    if (securityScore >= 80) return 'Excellent';
    if (securityScore >= 60) return 'Good';
    if (securityScore >= 40) return 'Fair';
    return 'Poor';
  };

  return (
    <div>
      {/* Security Score Card */}
      <Card
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Row gutter={24} align="middle">
          <Col xs={24} md={16}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <SecurityScanOutlined
                style={{
                  fontSize: '48px',
                  color: getSecurityScoreColor(),
                }}
              />
              <div>
                <Title level={3} style={{ margin: 0, color: viralFxColors.textPrimary }}>
                  Security Score
                </Title>
                <Text style={{ color: viralFxColors.textSecondary, fontSize: '16px' }}>
                  Your account security is {getSecurityScoreStatus().toLowerCase()}
                </Text>
              </div>
            </div>
          </Col>
          <Col xs={24} md={8}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={securityScore}
                strokeColor={getSecurityScoreColor()}
                format={(percent) => (
                  <div style={{ color: getSecurityScoreColor() }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{percent}%</div>
                    <div style={{ fontSize: '12px' }}>{getSecurityScoreStatus()}</div>
                  </div>
                )}
                size={100}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Password Change */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LockOutlined style={{ color: viralFxColors.primaryPurple }} />
            <span style={{ color: viralFxColors.textPrimary }}>Change Password</span>
          </div>
        }
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ maxWidth: '600px' }}
        >
          <Form.Item
            label="Current Password"
            name="currentPassword"
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Password
              placeholder="Enter current password"
              visibilityToggle={{
                visible: currentPasswordVisible,
                onVisibleChange: setCurrentPasswordVisible,
              }}
              style={{
                borderRadius: '6px',
                borderColor: viralFxColors.borderDefault,
              }}
            />
          </Form.Item>

          <Form.Item
            label="New Password"
            name="newPassword"
            rules={[
              { required: true, message: 'Please enter your new password' },
              { min: 8, message: 'Password must be at least 8 characters' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                message: 'Password must contain uppercase, lowercase, number, and special character',
              },
            ]}
          >
            <Password
              placeholder="Enter new password"
              visibilityToggle={{
                visible: newPasswordVisible,
                onVisibleChange: setNewPasswordVisible,
              }}
              style={{
                borderRadius: '6px',
                borderColor: viralFxColors.borderDefault,
              }}
            />
          </Form.Item>

          <Form.Item
            label="Confirm New Password"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Please confirm your new password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Password
              placeholder="Confirm new password"
              visibilityToggle={{
                visible: confirmPasswordVisible,
                onVisibleChange: setConfirmPasswordVisible,
              }}
              style={{
                borderRadius: '6px',
                borderColor: viralFxColors.borderDefault,
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
                borderRadius: '6px',
                boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
              }}
            >
              Change Password
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Two-Factor Authentication */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SafetyOutlined style={{ color: viralFxColors.primaryPurple }} />
            <span style={{ color: viralFxColors.textPrimary }}>Two-Factor Authentication</span>
          </div>
        }
        extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text>2FA Status:</Text>
            {user.isTwoFactorEnabled ? (
              <Tag
                color="success"
                icon={<CheckCircleOutlined />}
                style={{
                  backgroundColor: '#f6ffed',
                  borderColor: '#b7eb8f',
                  color: '#52c41a',
                }}
              >
                Enabled
              </Tag>
            ) : (
              <Tag
                color="warning"
                icon={<ExclamationCircleOutlined />}
                style={{
                  backgroundColor: '#fffbe6',
                  borderColor: '#ffe58f',
                  color: '#faad14',
                }}
              >
                Disabled
              </Tag>
            )}
          </div>
        }
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Alert
          message="Enhanced Account Security"
          description="Two-factor authentication adds an extra layer of security to your account by requiring a second form of verification when you log in."
          type="info"
          showIcon
          style={{
            marginBottom: '16px',
            backgroundColor: '#e6f7ff',
            borderColor: '#91d5ff',
          }}
        />

        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          {user.isTwoFactorEnabled ? (
            <div>
              <KeyOutlined
                style={{
                  fontSize: '48px',
                  color: viralFxColors.successGreen,
                  marginBottom: '16px',
                }}
              />
              <p style={{ color: viralFxColors.textSecondary, marginBottom: '16px' }}>
                Your account is protected with 2FA
              </p>
              <Button
                onClick={handleDisable2FA}
                style={{
                  borderColor: viralFxColors.errorRed,
                  color: viralFxColors.errorRed,
                }}
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div>
              <MobileOutlined
                style={{
                  fontSize: '48px',
                  color: viralFxColors.warningOrange,
                  marginBottom: '16px',
                }}
              />
              <p style={{ color: viralFxColors.textSecondary, marginBottom: '16px' }}>
                Enable 2FA to protect your account
              </p>
              <Button
                type="primary"
                onClick={handleEnable2FA}
                style={{
                  backgroundColor: viralFxColors.primaryPurple,
                  borderColor: viralFxColors.primaryPurple,
                  borderRadius: '6px',
                  boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
                }}
              >
                Enable 2FA
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* 2FA Setup Modal */}
      <Modal
        title="Set Up Two-Factor Authentication"
        open={twoFactorModalVisible}
        onCancel={() => setTwoFactorModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setTwoFactorModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            type="primary"
            style={{
              backgroundColor: viralFxColors.primaryPurple,
              borderColor: viralFxColors.primaryPurple,
            }}
            onClick={() => {
              // Simulate 2FA setup
              const updatedUser = {
                ...user,
                isTwoFactorEnabled: true,
                twoFactorSecret: 'simulated-secret',
              };
              onUpdateUser(updatedUser);
              calculateSecurityScore();
              setTwoFactorModalVisible(false);
              setQrCodeVisible(false);
              toast.success('2FA enabled successfully!', {
                style: {
                  background: viralFxColors.successGreen,
                  color: 'white',
                },
              });
            }}
          >
            Confirm Setup
          </Button>,
        ]}
        width={600}
      >
        {qrCodeVisible && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ marginBottom: '16px', color: viralFxColors.textSecondary }}>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <div style={{ display: 'inline-block', padding: '20px', backgroundColor: '#fff', border: `1px solid ${viralFxColors.borderDefault}`, borderRadius: '8px' }}>
              <QRCode
                value="otpauth://totp/ViralFX:user@email.com?secret=JBSWY3DPEHPK3PXP&issuer=ViralFX"
                size={200}
              />
            </div>
            <p style={{ marginTop: '16px', color: viralFxColors.textSecondary, fontSize: '14px' }}>
              Or manually enter: <Text code>JBSWY3DPEHPK3PXP</Text>
            </p>
          </div>
        )}
      </Modal>

      <Row gutter={24}>
        <Col xs={24} lg={12}>
          {/* Active Sessions */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MobileOutlined style={{ color: viralFxColors.primaryPurple }} />
                  <span style={{ color: viralFxColors.textPrimary }}>Active Sessions</span>
                </div>
                <Button
                  size="small"
                  onClick={handleRevokeAllSessions}
                  style={{
                    borderColor: viralFxColors.errorRed,
                    color: viralFxColors.errorRed,
                  }}
                >
                  Revoke All
                </Button>
              </div>
            }
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <List
              dataSource={activeSessions}
              renderItem={(session) => (
                <List.Item
                  actions={[
                    <Button
                      key="revoke"
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRevokeSession(session.id)}
                      style={{
                        borderColor: viralFxColors.errorRed,
                        color: viralFxColors.errorRed,
                      }}
                    >
                      Revoke
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: viralFxColors.backgroundSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                        }}
                      >
                        {session.os.includes('iPhone') ? '📱' : '💻'}
                      </div>
                    }
                    title={
                      <div>
                        <div style={{ color: viralFxColors.textPrimary, fontWeight: 500 }}>
                          {session.device}
                        </div>
                        <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                          {session.ipAddress} • {session.location}
                        </div>
                      </div>
                    }
                    description={
                      <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                        Last active: {new Date(session.lastAccessAt).toLocaleString()}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          {/* Login History */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SecurityScanOutlined style={{ color: viralFxColors.primaryPurple }} />
                <span style={{ color: viralFxColors.textPrimary }}>Login History</span>
              </div>
            }
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <List
              dataSource={loginHistory.slice(0, 5)}
              renderItem={(login) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: login.success
                            ? '#f6ffed'
                            : '#fff1f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: login.success ? '#52c41a' : '#f5222d',
                        }}
                      >
                        {login.success ? '✓' : '✗'}
                      </div>
                    }
                    title={
                      <div>
                        <div style={{ color: viralFxColors.textPrimary, fontWeight: 500 }}>
                          {login.device}
                        </div>
                        <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                          {login.ipAddress} • {login.location}
                        </div>
                      </div>
                    }
                    description={
                      <div>
                        <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                          {new Date(login.createdAt).toLocaleString()}
                        </div>
                        {login.failureReason && (
                          <div style={{ color: viralFxColors.errorRed, fontSize: '12px' }}>
                            {login.failureReason}
                          </div>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SecurityTab;