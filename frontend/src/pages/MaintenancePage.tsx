import React, { useState, useEffect } from 'react';
import { Result, Button, Card, Typography, Space, Divider, Row, Col, Statistic, Tooltip, Tag } from 'antd';
import {
  ToolOutlined, ClockCircleOutlined, PhoneOutlined, MailOutlined, TwitterOutlined, FacebookOutlined, LinkedinOutlined, ReloadOutlined, TeamOutlined, MessageOutlined, SafetyOutlined, } from '@ant-design/icons';
import { motion } from 'framer-motion';

const {Title, Paragraph, Text} = Typography;
const {Countdown} = Statistic;

interface MaintenanceInfo {
  title: string;
  message: string;
  estimatedDowntime: string;
  startTime: string;
  endTime?: string;
  affectedServices: string[];
  contactEmail: string;
  supportPhone: string;
  socialLinks: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

const MaintenancePage: React.FC = () => {
  const [maintenanceInfo, setMaintenanceInfo] = useState<MaintenanceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetchMaintenanceInfo();

    // Check status every 30 seconds
    const interval = setInterval(fetchMaintenanceInfo, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMaintenanceInfo = async () => {
    try {
      // In a real app, this would fetch from your API
      // const response = await fetch('/api/maintenance/status');
      // const data = await response.json();

      // Mock data for now
      const mockData: MaintenanceInfo = {
        title: 'System Maintenance in Progress',
        message: 'We\'re currently performing scheduled maintenance to improve our services. We apologize for any inconvenience and appreciate your patience.',
        estimatedDowntime: '2 hours',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        affectedServices: [
          'Trading Platform',
          'Market Data',
          'User Authentication',
          'Wallet Services',
        ],
        contactEmail: 'support@viralfx.co.za',
        supportPhone: '+27 12 345 6789',
        socialLinks: {
          twitter: 'https://twitter.com/viralfx',
          facebook: 'https://facebook.com/viralfx',
          linkedin: 'https://linkedin.com/company/viralfx',
        },
      };

      setMaintenanceInfo(mockData);

      if (mockData.endTime) {
        const endTime = new Date(mockData.endTime).getTime();
        const now = Date.now();
        setTimeRemaining(Math.max(0, endTime - now));
      }
    } catch (error) {
      console.error('Failed to fetch maintenance info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchMaintenanceInfo();
  };

  const handleFinish = () => {
    // Redirect to home when maintenance is over
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <Card loading className="w-96">
          <div className="h-32"></div>
        </Card>
      </div>
    );
  }

  if (!maintenanceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <Result
          status="info"
          title="Checking System Status"
          subTitle="Please wait while we check the current maintenance status..."
          extra={
            <Button type="primary" onClick={handleRefresh} icon={<ReloadOutlined />}>
              Refresh Status
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50"
    >
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="mb-4">
              <ToolOutlined className="text-6xl text-purple-600" />
            </div>
            <Title level={1} className="text-4xl font-bold text-gray-800 mb-4">
              {maintenanceInfo.title}
            </Title>
            <Paragraph className="text-lg text-gray-600 max-w-2xl mx-auto">
              {maintenanceInfo.message}
            </Paragraph>
          </motion.div>

          {/* Main Content */}
          <Row gutter={[24, 24]} className="mb-8">
            {/* Maintenance Details */}
            <Col xs={24} md={16}>
              <motion.div
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="h-full shadow-lg">
                  <Title level={3} className="mb-4 flex items-center">
                    <ClockCircleOutlined className="mr-2 text-purple-600" />
                    Maintenance Details
                  </Title>

                  <Space direction="vertical" className="w-full" size="large">
                    <div>
                      <Text strong className="text-gray-700">Started:</Text>
                      <div className="mt-1">
                        {new Date(maintenanceInfo.startTime).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <Text strong className="text-gray-700">Estimated Duration:</Text>
                      <div className="mt-1">
                        {maintenanceInfo.estimatedDowntime}
                      </div>
                    </div>

                    {maintenanceInfo.endTime && timeRemaining && (
                      <div>
                        <Text strong className="text-gray-700">Time Remaining:</Text>
                        <div className="mt-2">
                          <Countdown
                            value={Date.now() + timeRemaining}
                            format="HH:mm:ss"
                            onFinish={handleFinish}
                            valueStyle={{ color: '#1890ff', fontSize: '24px', fontWeight: 'bold' }}
                          />
                        </div>
                      </div>
                    )}

                    <Divider />

                    <div>
                      <Text strong className="text-gray-700">Affected Services:</Text>
                      <div className="mt-2">
                        <Space wrap>
                          {maintenanceInfo.affectedServices.map((service, index) => (
                            <Tag
                              key={index}
                              color="orange"
                              icon={<SafetyOutlined />}
                            >
                              {service}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                    </div>
                  </Space>
                </Card>
              </motion.div>
            </Col>

            {/* Actions & Support */}
            <Col xs={24} md={8}>
              <motion.div
                initial={{ x: 20 }}
                animate={{ x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Space direction="vertical" className="w-full" size="large">
                  {/* Refresh Button */}
                  <Card className="text-center shadow-lg">
                    <Title level={4} className="mb-4">Check Status</Title>
                    <Button
                      type="primary"
                      size="large"
                      icon={<ReloadOutlined />}
                      onClick={handleRefresh}
                      block
                    >
                      Refresh Status
                    </Button>
                  </Card>

                  {/* Support Contact */}
                  <Card className="shadow-lg">
                    <Title level={4} className="mb-4 flex items-center">
                      <TeamOutlined className="mr-2 text-purple-600" />
                      Need Help?
                    </Title>
                    <Space direction="vertical" className="w-full">
                      <div>
                        <Text type="secondary">Email Support:</Text>
                        <div>
                          <a href={`mailto:${maintenanceInfo.contactEmail}`} className="text-purple-600 hover:text-purple-700">
                            {maintenanceInfo.contactEmail}
                          </a>
                        </div>
                      </div>
                      <div>
                        <Text type="secondary">Phone Support:</Text>
                        <div>
                          <a href={`tel:${maintenanceInfo.supportPhone}`} className="text-purple-600 hover:text-purple-700">
                            {maintenanceInfo.supportPhone}
                          </a>
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Space>
              </motion.div>
            </Col>
          </Row>

          {/* Social Links */}
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="text-center shadow-lg">
              <Title level={4} className="mb-4 flex items-center justify-center">
                <MessageOutlined className="mr-2 text-purple-600" />
                Stay Updated
              </Title>
              <Paragraph className="text-gray-600 mb-4">
                Follow us on social media for real-time updates and announcements.
              </Paragraph>
              <Space size="large">
                {maintenanceInfo.socialLinks.twitter && (
                  <Tooltip title="Twitter">
                    <Button
                      shape="circle"
                      size="large"
                      icon={<TwitterOutlined />}
                      onClick={() => window.open(maintenanceInfo.socialLinks.twitter, '_blank')}
                      className="border-blue-400 text-blue-400 hover:bg-blue-50"
                    />
                  </Tooltip>
                )}
                {maintenanceInfo.socialLinks.facebook && (
                  <Tooltip title="Facebook">
                    <Button
                      shape="circle"
                      size="large"
                      icon={<FacebookOutlined />}
                      onClick={() => window.open(maintenanceInfo.socialLinks.facebook, '_blank')}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    />
                  </Tooltip>
                )}
                {maintenanceInfo.socialLinks.linkedin && (
                  <Tooltip title="LinkedIn">
                    <Button
                      shape="circle"
                      size="large"
                      icon={<LinkedinOutlined />}
                      onClick={() => window.open(maintenanceInfo.socialLinks.linkedin, '_blank')}
                      className="border-blue-700 text-blue-700 hover:bg-blue-50"
                    />
                  </Tooltip>
                )}
              </Space>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 text-gray-500"
          >
            <Text>
              © 2024 ViralFX. All rights reserved. | We appreciate your patience during this maintenance period.
            </Text>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default MaintenancePage;