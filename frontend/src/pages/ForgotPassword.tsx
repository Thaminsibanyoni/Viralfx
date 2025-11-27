import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Space, Alert, Result, message, } from 'antd';
import {
  MailOutlined, ArrowLeftOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const {Title, Text} = Typography;

interface ForgotPasswordForm {
  email: string;
}

const ForgotPassword: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [rateLimitMessage, setRateLimitMessage] = useState('');
  const [attempts, setAttempts] = useState(0);

  const {forgotPassword} = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const attemptKey = 'forgot_password_attempts';
    const lastAttemptKey = 'forgot_password_last_attempt';

    const savedAttempts = parseInt(localStorage.getItem(attemptKey) || '0', 10);
    const lastAttempt = parseInt(localStorage.getItem(lastAttemptKey) || '0', 10);

    if (savedAttempts >= 3 && Date.now() - lastAttempt < 3600000) { // 1 hour
      const remainingTime = Math.ceil((3600000 - (Date.now() - lastAttempt)) / 60000);
      setRateLimitMessage(`Too many requests. Please try again in ${remainingTime} minutes.`);
      setCountdown(remainingTime);
      setAttempts(savedAttempts);
    }
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 60000); // Update every minute

      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const onFinish = async (values: ForgotPasswordForm) => {
    setLoading(true);

    try {
      const attemptKey = 'forgot_password_attempts';
      const lastAttemptKey = 'forgot_password_last_attempt';

      const savedAttempts = parseInt(localStorage.getItem(attemptKey) || '0', 10);
      const lastAttempt = parseInt(localStorage.getItem(lastAttemptKey) || '0', 10);

      if (savedAttempts >= 3 && Date.now() - lastAttempt < 3600000) {
        const remainingTime = Math.ceil((3600000 - (Date.now() - lastAttempt)) / 60000);
        setRateLimitMessage(`Too many requests. Please try again in ${remainingTime} minutes.`);
        setCountdown(remainingTime);
        return;
      }

      await forgotPassword(values.email);

      // Reset attempts on successful request
      localStorage.removeItem(attemptKey);
      localStorage.removeItem(lastAttemptKey);

      setSuccess(true);
      message.success('Password reset email sent successfully!');
    } catch (error: any) {
      const attemptKey = 'forgot_password_attempts';
      const lastAttemptKey = 'forgot_password_last_attempt';

      const newAttempts = attempts + 1;
      localStorage.setItem(attemptKey, newAttempts.toString());
      localStorage.setItem(lastAttemptKey, Date.now().toString());
      setAttempts(newAttempts);

      if (newAttempts >= 3) {
        setRateLimitMessage('Too many requests. Please try again in 1 hour.');
        setCountdown(60);
      }

      message.error(error.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
          <Card
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
            bodyStyle={{ padding: '40px' }}
          >
            <Result
              status="success"
              title="Email Sent!"
              subTitle={
                <div style={{ color: '#B8BCC8', marginTop: '16px' }}>
                  We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.
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
                  Return to Login
                </Button>,
                <Button
                  key="resend"
                  type="link"
                  onClick={() => setSuccess(false)}
                  style={{ color: '#FFB300' }}
                >
                  Didn't receive email? Try again
                </Button>,
              ]}
            />
          </Card>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Link
              to="/login"
              style={{
                color: '#FFB300',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ArrowLeftOutlined />
              Back to Login
            </Link>
          </div>
        </div>
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
            Reset Password
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Enter your email to receive password reset instructions
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
              description={
                <div>
                  <div>{rateLimitMessage}</div>
                  {countdown > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <ClockCircleOutlined style={{ marginRight: '8px' }} />
                      <span>Time remaining: {countdown} minute{countdown !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
              }
              type="warning"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          )}

          <Form
            form={form}
            name="forgotPassword"
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
                prefix={<MailOutlined style={{ color: '#4B0082' }} />}
                placeholder="Enter your email address"
                disabled={countdown > 0}
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
                disabled={countdown > 0}
                block
                style={{
                  background: countdown > 0
                    ? 'rgba(75, 0, 130, 0.3)'
                    : 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: '600',
                  boxShadow: countdown > 0 ? 'none' : '0 4px 12px rgba(75, 0, 130, 0.3)',
                }}
              >
                {countdown > 0 ? `Please wait (${countdown} min)` : 'Send Reset Email'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Link
              to="/login"
              style={{
                color: '#FFB300',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ArrowLeftOutlined />
              Back to Login
            </Link>
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
            Remember your password?{' '}
            <Link to="/login" style={{ color: '#FFB300' }}>
              Sign in
            </Link>
          </Text>
        </div>

        <div style={{
          marginTop: '32px',
          padding: '16px',
          background: 'rgba(75, 0, 130, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 179, 0, 0.2)'
        }}>
          <Text style={{ color: '#B8BCC8', fontSize: '14px', lineHeight: '1.6' }}>
            <strong style={{ color: '#FFB300' }}>Security Note:</strong> For your protection, password reset links expire after 1 hour and can only be used once. If you don't receive the email, please check your spam folder.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;