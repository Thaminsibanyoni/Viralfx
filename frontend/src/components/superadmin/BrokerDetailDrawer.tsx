import React from 'react';
import {
  Drawer, Descriptions, Tag, Avatar, Typography, Row, Col, Card, List, Space, Button, Divider, Statistic, Progress, Timeline, Table, } from 'antd';
import {
  TeamOutlined, MailOutlined, PhoneOutlined, EnvironmentOutlined, BankOutlined, VerifiedOutlined, TrophyOutlined, DollarOutlined, UserOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const {Title, Text} = Typography;

interface BrokerDetailDrawerProps {
  broker: any;
  visible: boolean;
  onClose: () => void;
}

const BrokerDetailDrawer: React.FC<BrokerDetailDrawerProps> = ({
  broker,
  visible,
  onClose,
}) => {
  if (!broker) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'suspended':
        return 'orange';
      case 'pending':
        return 'blue';
      case 'rejected':
        return 'red';
      default:
        return 'default';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'platinum':
        return '#722ed1';
      case 'gold':
        return '#faad14';
      case 'silver':
        return '#8c8c8c';
      case 'bronze':
        return '#cd7f32';
      default:
        return '#1890ff';
    }
  };

  const performanceColumns: ColumnsType<any> = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (month) => dayjs(month).format('MMM YYYY'),
    },
    {
      title: 'New Clients',
      dataIndex: 'newClients',
      key: 'newClients',
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      render: (volume) => `$${(volume / 1000000).toFixed(2)}M`,
    },
    {
      title: 'Commission',
      dataIndex: 'commission',
      key: 'commission',
      render: (commission) => `$${commission.toFixed(2)}`,
    },
  ];

  return (
    <Drawer
      title={
        <Space>
          <Avatar src={broker.logo} icon={<TeamOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {broker.companyName}
            </Title>
            <Text type="secondary">{broker.tier} Tier Broker</Text>
          </div>
        </Space>
      }
      width={900}
      open={visible}
      onClose={onClose}
    >
      {/* Status and Overview */}
      <Card title="Overview" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Status"
              value={broker.status}
              valueStyle={{ color: getStatusColor(broker.status) }}
              prefix={<CheckCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Tier"
              value={broker.tier}
              valueStyle={{ color: getTierColor(broker.tier) }}
              prefix={<TrophyOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Total Clients"
              value={broker.totalClients}
              prefix={<UserOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Monthly Volume"
              value={broker.monthlyVolume}
              prefix={<DollarOutlined />}
              formatter={(value) => `$${(Number(value) / 1000000).toFixed(2)}M`}
            />
          </Col>
        </Row>
      </Card>

      {/* Basic Information */}
      <Card title="Company Information" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Legal Name">
                {broker.legalName || broker.companyName}
              </Descriptions.Item>
              <Descriptions.Item label="Registration Number">
                {broker.registrationNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Tax ID">
                {broker.taxId}
              </Descriptions.Item>
              <Descriptions.Item label="Website">
                {broker.website}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Email">
                <Space>
                  <MailOutlined />
                  {broker.email}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <Space>
                  <PhoneOutlined />
                  {broker.phone}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Established">
                {broker.establishedDate ? dayjs(broker.establishedDate).format('MMMM DD, YYYY') : 'Not provided'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Address Information */}
      <Card title="Address Information" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Headquarters">
            <Space>
              <EnvironmentOutlined />
              {broker.address?.street}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="City">
            {broker.address?.city}
          </Descriptions.Item>
          <Descriptions.Item label="State/Province">
            {broker.address?.state}
          </Descriptions.Item>
          <Descriptions.Item label="Country">
            {broker.address?.country}
          </Descriptions.Item>
          <Descriptions.Item label="Postal Code">
            {broker.address?.postalCode}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Verification Status */}
      <Card title="Verification Status" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="KYC Verified">
                {broker.kycVerified ? (
                  <Tag color="green" icon={<VerifiedOutlined />}>
                    Verified
                  </Tag>
                ) : (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>
                    Pending
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="FSCA Licensed">
                {broker.fscaLicensed ? (
                  <Tag color="green" icon={<VerifiedOutlined />}>
                    Licensed
                  </Tag>
                ) : (
                  <Tag color="red" icon={<ExclamationCircleOutlined />}>
                    Not Licensed
                  </Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="License Number">
                {broker.licenseNumber || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="License Expiry">
                {broker.licenseExpiry ? dayjs(broker.licenseExpiry).format('MMMM DD, YYYY') : 'Not provided'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Financial Performance */}
      <Card title="Financial Performance" style={{ marginBottom: 16 }}>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Statistic
              title="Total Revenue"
              value={broker.totalRevenue}
              prefix={<DollarOutlined />}
              formatter={(value) => `$${(Number(value) / 1000000).toFixed(2)}M`}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Total Commission"
              value={broker.totalCommission}
              prefix={<DollarOutlined />}
              formatter={(value) => `$${(Number(value) / 1000000).toFixed(2)}M`}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Success Rate"
              value={broker.successRate}
              suffix="%"
              prefix={<TrophyOutlined />}
            />
          </Col>
        </Row>

        <Table
          columns={performanceColumns}
          dataSource={broker.performance || []}
          pagination={false}
          size="small"
          title={() => 'Monthly Performance'}
        />
      </Card>

      {/* Tier Progress */}
      <Card title="Tier Progress" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>Current Tier: </Text>
          <Tag color={getTierColor(broker.tier)} style={{ fontSize: 16, padding: '4px 12px' }}>
            {broker.tier.toUpperCase()}
          </Tag>
        </div>

        <Row gutter={16}>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={(broker.clientsForNextTier / broker.requiredClientsForNextTier) * 100}
                format={() => `${broker.clientsForNextTier}/${broker.requiredClientsForNextTier}`}
                size={80}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Clients for Next Tier</Text>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={(broker.volumeForNextTier / broker.requiredVolumeForNextTier) * 100}
                format={() => `${((broker.volumeForNextTier / 1000000).toFixed(1))}M/${((broker.requiredVolumeForNextTier / 1000000).toFixed(1))}M`}
                size={80}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Volume for Next Tier</Text>
              </div>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center' }}>
              <Progress
                type="circle"
                percent={broker.complianceScore}
                format={() => `${broker.complianceScore}%`}
                size={80}
                strokeColor={broker.complianceScore >= 80 ? '#52c41a' : broker.complianceScore >= 60 ? '#faad14' : '#ff4d4f'}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">Compliance Score</Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        <Timeline>
          {broker.recentActivities?.map((activity: any, index: number) => (
            <Timeline.Item
              key={index}
              color={activity.type === 'success' ? 'green' : activity.type === 'warning' ? 'orange' : 'blue'}
            >
              <div>
                <Text strong>{activity.title}</Text>
                <br />
                <Text type="secondary">{activity.description}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(activity.timestamp).fromNow()}
                </Text>
              </div>
            </Timeline.Item>
          )) || <Text type="secondary">No recent activity</Text>}
        </Timeline>
      </Card>
    </Drawer>
  );
};

export default BrokerDetailDrawer;