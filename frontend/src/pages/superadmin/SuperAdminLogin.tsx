import React, { useState } from 'react';
import {
  Card, Form, Input, Button, Typography, Space, Divider, Alert, Checkbox, message, Row, Col, } from 'antd';
import {
  UserOutlined, LockOutlined, SafetyOutlined, ThunderboltOutlined, CrownOutlined, } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../../stores/adminStore';

const {Title, Text, Paragraph} = Typography;

interface LoginFormData {
  email: string;
  password: string;
  twoFactorCode?: string;
  rememberMe: boolean;
}

const SuperAdminLogin: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const {login, isLoading} = useAdminStore();
  const [error, setError] = useState<string>('');
  const [requires2FA, setRequires2FA] = useState<boolean>(false);

  const onFinish = async (values: LoginFormData) => {
    try {
      setError('');
      await login({
        email: values.email,
        password: values.password,
        twoFactorCode: values.twoFactorCode,
        deviceFingerprint: 'web-browser',
      });

      message.success('Login successful');
      navigate('/superadmin');
    } catch (err: any) {
      if (err.response?.status === 401 && err.response?.data?.requiresTwoFactor) {
        setRequires2FA(true);
        setError('Please enter your 2FA code');
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>

      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <ThunderboltOutlined className="text-white text-2xl" />
            </div>
          </div>
          <Title level={2} className="text-white mb-2">
            ViralFX
          </Title>
          <Title level={4} className="text-blue-400 mb-0">
            SuperAdmin Portal
          </Title>
          <Text className="text-gray-400">
            Secure Administrative Access
          </Text>
        </div>

        {/* Login Form */}
        <Card className="bg-gray-900/90 backdrop-blur-lg border-gray-800 shadow-2xl">
          <Form
            form={form}
            name="adminLogin"
            onFinish={onFinish}
            size="large"
            layout="vertical"
          >
            {error && (
              <Alert
                message={error}
                type="error"
                showIcon
                closable
                onClose={() => setError('')}
                className="mb-6"
              />
            )}

            <Form.Item
              name="email"
              label={<Text className="text-gray-300">Email Address</Text>}
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input
                prefix={<UserOutlined className="text-gray-400" />}
                placeholder="admin@viralfx.com"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<Text className="text-gray-300">Password</Text>}
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="text-gray-400" />}
                placeholder="Enter your password"
                className="bg-gray-800 border-gray-700 text-white placeholder-gray-500"
              />
            </Form.Item>

            {requires2FA && (
              <Form.Item
                name="twoFactorCode"
                label={<Text className="text-gray-300">Two-Factor Authentication Code</Text>}
                rules={[{ required: true, message: 'Please enter your 2FA code' }]}
              >
                <Input
                  prefix={<SafetyOutlined className="text-gray-400" />}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 text-center text-xl tracking-widest"
                />
              </Form.Item>
            )}

            <Form.Item>
              <div className="flex items-center justify-between">
                <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                  <Checkbox className="text-gray-300">
                    Remember this device
                  </Checkbox>
                </Form.Item>
                <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300">
                  Forgot Password?
                </Link>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 border-0 hover:from-blue-600 hover:to-purple-700 text-white font-semibold"
              >
                <CrownOutlined className="mr-2" />
                Access SuperAdmin Portal
              </Button>
            </Form.Item>
          </Form>

          <Divider className="border-gray-700">
            <Text className="text-gray-400 text-sm">Security Information</Text>
          </Divider>

          <div className="space-y-2">
            <div className="flex items-center text-sm">
              <SafetyOutlined className="text-green-400 mr-2" />
              <Text className="text-gray-300">End-to-end encryption</Text>
            </div>
            <div className="flex items-center text-sm">
              <SafetyOutlined className="text-green-400 mr-2" />
              <Text className="text-gray-300">Multi-factor authentication</Text>
            </div>
            <div className="flex items-center text-sm">
              <SafetyOutlined className="text-green-400 mr-2" />
              <Text className="text-gray-300">Session monitoring</Text>
            </div>
            <div className="flex items-center text-sm">
              <SafetyOutlined className="text-green-400 mr-2" />
              <Text className="text-gray-300">IP address verification</Text>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <Text className="text-gray-500 text-sm">
            Unauthorized access is prohibited and will be prosecuted
          </Text>
          <br />
          <Text className="text-gray-600 text-xs mt-2">
            © 2024 ViralFX. All rights reserved.
          </Text>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;