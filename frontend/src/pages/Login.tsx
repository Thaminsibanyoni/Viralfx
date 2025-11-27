import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Space, Divider, Alert, Checkbox, Row, Col, message, } from 'antd';
import {
  UserOutlined, LockOutlined, EyeOutlined, EyeInvisibleOutlined, GoogleOutlined, AppleOutlined, FacebookOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const {Title, Text} = Typography;

interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
  twoFactorCode?: string;
}

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);

  const {login, user, twoFactorRequired} = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  useEffect(() => {
    if (twoFactorRequired) {
      setRequiresTwoFactor(true);
    }
  }, [twoFactorRequired]);

  useEffect(() => {
    const attemptKey = `login_attempts_${form.getFieldValue('email') || 'anonymous'}`;
    const attempts = parseInt(localStorage.getItem(attemptKey) || '0', 10);
    const lastAttempt = parseInt(localStorage.getItem(`${attemptKey}_time`) || '0', 10);

    if (attempts >= 3 && Date.now() - lastAttempt < 3600000) { // 1 hour
      const remainingTime = Math.ceil((3600000 - (Date.now() - lastAttempt)) / 60000);
      setRateLimitMessage(`Too many login attempts. Please try again in ${remainingTime} minutes.`);
      setLoginAttempts(attempts);
    }
  }, []);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setRateLimitMessage('');

    try {
      const attemptKey = `login_attempts_${values.email}`;
      const currentAttempts = parseInt(localStorage.getItem(attemptKey) || '0', 10);
      const lastAttempt = parseInt(localStorage.getItem(`${attemptKey}_time`) || '0', 10);

      if (currentAttempts >= 3 && Date.now() - lastAttempt < 3600000) {
        const remainingTime = Math.ceil((3600000 - (Date.now() - lastAttempt)) / 60000);
        setRateLimitMessage(`Too many login attempts. Please try again in ${remainingTime} minutes.`);
        return;
      }

      await login(values.email, values.password, values.twoFactorCode);

      if (requiresTwoFactor) {
        message.info('Please enter your 2FA code');
        return;
      }

      localStorage.removeItem(attemptKey);
      localStorage.removeItem(`${attemptKey}_time`);

      message.success('Login successful!');
      navigate(from, { replace: true });
    } catch (error: any) {
      const attemptKey = `login_attempts_${values.email}`;
      const newAttempts = loginAttempts + 1;

      localStorage.setItem(attemptKey, newAttempts.toString());
      localStorage.setItem(`${attemptKey}_time`, Date.now().toString());
      setLoginAttempts(newAttempts);

      if (newAttempts >= 3) {
        setRateLimitMessage('Too many failed attempts. Please try again in 1 hour.');
      }

      if (error.message?.includes('2FA') || error.message?.includes('two factor')) {
        setRequiresTwoFactor(true);
        message.warning('Please enter your 2FA code');
      } else {
        message.error(error.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'apple' | 'facebook') => {
    message.info(`${provider} OAuth login will be implemented soon`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
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
            Welcome Back
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Sign in to your ViralFX account
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
          {rateLimitMessage && (
            <Alert
              message="Rate Limited"
              description={rateLimitMessage}
              type="warning"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#4B0082' }} />}
                placeholder="Email address"
                style={{
                  background: '#0E0E10',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  color: '#B8BCC8',
                }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please input your password!' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#4B0082' }} />}
                placeholder="Password"
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

            {requiresTwoFactor && (
              <Form.Item
                name="twoFactorCode"
                rules={[
                  { required: true, message: 'Please enter your 2FA code!' },
                  { len: 6, message: '2FA code must be 6 digits!' },
                  { pattern: /^\d+$/, message: '2FA code must contain only numbers!' },
                ]}
              >
                <Input
                  placeholder="Enter 6-digit 2FA code"
                  maxLength={6}
                  style={{
                    background: '#0E0E10',
                    border: '1px solid rgba(255, 179, 0, 0.2)',
                    color: '#B8BCC8',
                    textAlign: 'center',
                    fontSize: '18px',
                    letterSpacing: '4px',
                  }}
                />
              </Form.Item>
            )}

            <Form.Item>
              <Row justify="space-between" align="middle">
                <Col>
                  <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                    <Checkbox style={{ color: '#B8BCC8' }}>
                      Remember me
                    </Checkbox>
                  </Form.Item>
                </Col>
                <Col>
                  <Link
                    to="/forgot-password"
                    style={{ color: '#FFB300', textDecoration: 'none' }}
                  >
                    Forgot password?
                  </Link>
                </Col>
              </Row>
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
                {requiresTwoFactor ? 'Verify & Sign In' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ borderColor: 'rgba(255, 179, 0, 0.2)' }}>
            <Text style={{ color: '#B8BCC8' }}>Or continue with</Text>
          </Divider>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              icon={<GoogleOutlined />}
              block
              size="large"
              onClick={() => handleOAuthLogin('google')}
              style={{
                borderColor: '#4285F4',
                color: '#4285F4',
                height: '44px',
              }}
            >
              Continue with Google
            </Button>

            <Row gutter={12}>
              <Col span={12}>
                <Button
                  icon={<AppleOutlined />}
                  block
                  size="large"
                  onClick={() => handleOAuthLogin('apple')}
                  style={{
                    borderColor: '#000000',
                    color: '#000000',
                    height: '44px',
                  }}
                >
                  Apple
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  icon={<FacebookOutlined />}
                  block
                  size="large"
                  onClick={() => handleOAuthLogin('facebook')}
                  style={{
                    borderColor: '#1877F2',
                    color: '#1877F2',
                    height: '44px',
                  }}
                >
                  Facebook
                </Button>
              </Col>
            </Row>
          </Space>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Text style={{ color: '#B8BCC8' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                style={{ color: '#FFB300', textDecoration: 'none' }}
              >
                Sign up
              </Link>
            </Text>
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
            By signing in, you agree to our{' '}
            <Link to="/legal/terms" style={{ color: '#FFB300' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/legal/privacy" style={{ color: '#FFB300' }}>
              Privacy Policy
            </Link>
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Login;