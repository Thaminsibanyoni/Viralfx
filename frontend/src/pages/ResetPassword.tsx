import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Space, Alert, Result, Progress, message, Tooltip, } from 'antd';
import {
  LockOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const {Title, Text} = Typography;

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const {resetPassword} = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setValidToken(false);
      return;
    }

    // In a real implementation, you'd validate the token with an API call
    // For now, we'll simulate token validation
    const validateToken = async () => {
      try {
        // Simulate API call to validate token
        // await authApi.validateResetToken(token);

        // For demo purposes, consider tokens that are at least 20 characters long as valid
        if (token.length >= 20) {
          setValidToken(true);
        } else {
          setValidToken(false);
        }
      } catch (error) {
        setValidToken(false);
      }
    };

    validateToken();
  }, [token]);

  useEffect(() => {
    if (resetSuccess && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (resetSuccess && redirectCountdown === 0) {
      navigate('/login');
    }
  }, [resetSuccess, redirectCountdown, navigate]);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 10;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 20;
    if (/[^a-zA-Z\d]/.test(password)) strength += 20;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return '#FF4D4F';
    if (passwordStrength < 60) return '#FFB300';
    if (passwordStrength < 80) return '#52C41A';
    return '#1890FF';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 30) return 'Weak';
    if (passwordStrength < 60) return 'Fair';
    if (passwordStrength < 80) return 'Good';
    return 'Strong';
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const onFinish = async (values: ResetPasswordForm) => {
    if (!token) {
      message.error('Invalid reset token');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, values.password);
      setResetSuccess(true);
      message.success('Password reset successful!');
    } catch (error: any) {
      message.error(error.message || 'Failed to reset password. The token may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (validToken === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
        }}
      >
        <LoadingSpinner size="large" tip="Validating reset token..." />
      </div>
    );
  }

  if (validToken === false) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
          padding: '20px',
        }}
      >
        <Card
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255, 179, 0, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            width: '100%',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <Result
            status="error"
            icon={<ExclamationCircleOutlined style={{ color: '#FF4D4F' }} />}
            title="Invalid Reset Link"
            subTitle={
              <div style={{ color: '#B8BCC8', marginTop: '16px' }}>
                This password reset link is invalid or has expired. Please request a new password reset email.
              </div>
            }
            extra={[
              <Button
                key="forgot"
                type="primary"
                onClick={() => navigate('/forgot-password')}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                }}
              >
                Request New Reset
              </Button>,
              <Button
                key="login"
                onClick={() => navigate('/login')}
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                Back to Login
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
          padding: '20px',
        }}
      >
        <Card
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255, 179, 0, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '400px',
            width: '100%',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: '#52C41A' }} />}
            title="Password Reset Successful!"
            subTitle={
              <div style={{ color: '#B8BCC8', marginTop: '16px' }}>
                Your password has been successfully reset. You will be redirected to the login page in {redirectCountdown} seconds...
              </div>
            }
            extra={[
              <Button
                key="login"
                type="primary"
                onClick={() => navigate('/login')}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                }}
              >
                Go to Login Now
              </Button>,
            ]}
          />
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
        padding: '20px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            VF
          </div>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Set New Password
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Create a strong password for your ViralFX account
          </Text>
        </div>

        <Card
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255, 179, 0, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
          bodyStyle={{ padding: '32px' }}
        >
          <Alert
            message="Password Requirements"
            description={
              <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#B8BCC8' }}>
                <li>At least 8 characters long</li>
                <li>Contains both uppercase and lowercase letters</li>
                <li>Includes at least one number</li>
                <li>Contains at least one special character</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: '24px' }}
          />

          <Form
            form={form}
            name="resetPassword"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              label={
                <span style={{ color: '#B8BCC8' }}>
                  New Password
                  <Tooltip title="Use a strong password that you haven't used before">
                    <InfoCircleOutlined style={{ marginLeft: '8px', color: '#FFB300' }} />
                  </Tooltip>
                </span>
              }
              name="password"
              rules={[
                { required: true, message: 'Please input your new password!' },
                { min: 8, message: 'Password must be at least 8 characters!' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                  message: 'Password must include uppercase, lowercase, number, and special character!',
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#4B0082' }} />}
                placeholder="Enter your new password"
                onChange={handlePasswordChange}
                visibilityToggle={{
                  visible: showPassword,
                  onVisibleChange: setShowPassword,
                }}
                iconRender={(visible) =>
                  visible ? (
                    <EyeOutlined style={{ color: '#FFB300' }} />
                  ) : (
                    <EyeInvisibleOutlined style={{ color: '#B8BCC8' }} />
                  )
                }
                style={{
                  background: '#0E0E10',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  color: '#B8BCC8',
                }}
              />
            </Form.Item>

            {passwordStrength > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                    Password Strength
                  </Text>
                  <Text style={{ color: getPasswordStrengthColor(), fontSize: '12px' }}>
                    {getPasswordStrengthText()}
                  </Text>
                </div>
                <Progress
                  percent={passwordStrength}
                  strokeColor={getPasswordStrengthColor()}
                  showInfo={false}
                  size="small"
                />
              </div>
            )}

            <Form.Item
              label={<span style={{ color: '#B8BCC8' }}>Confirm New Password</span>}
              name="confirmPassword"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your new password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject('Passwords do not match!');
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#4B0082' }} />}
                placeholder="Confirm your new password"
                style={{
                  background: '#0E0E10',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  color: '#B8BCC8',
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                }}
              >
                Reset Password
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Link
              to="/login"
              style={{
                color: '#FFB300',
                textDecoration: 'none',
              }}
            >
              Back to Login
            </Link>
          </div>
        </Card>

        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: 'rgba(75, 0, 130, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 179, 0, 0.2)'
        }}>
          <Text style={{ color: '#B8BCC8', fontSize: '14px', lineHeight: '1.6' }}>
            <strong style={{ color: '#FFB300' }}>Security Tip:</strong> This reset link will expire in 1 hour for your security. If you need more time, please request a new password reset.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;