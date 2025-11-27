import React from 'react';
import {
  Drawer, Descriptions, Tag, Avatar, Typography, Row, Col, Card, List, Space, Button, Divider, } from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, EnvironmentOutlined, BankOutlined, VerifiedOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {Title, Text} = Typography;

interface UserDetailDrawerProps {
  user: any;
  visible: boolean;
  onClose: () => void;
}

const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({
  user,
  visible,
  onClose,
}) => {
  if (!user) return null;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'green';
      case 'suspended':
        return 'orange';
      case 'banned':
        return 'red';
      case 'pending':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getVerificationStatus = (verified: boolean) => {
    return verified ? (
      <Tag color="green" icon={<VerifiedOutlined />}>
        Verified
      </Tag>
    ) : (
      <Tag color="orange" icon={<ClockCircleOutlined />}>
        Pending
      </Tag>
    );
  };

  return (
    <Drawer
      title={
        <Space>
          <Avatar src={user.avatar} icon={<UserOutlined />} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {user.firstName} {user.lastName}
            </Title>
            <Text type="secondary">@{user.username}</Text>
          </div>
        </Space>
      }
      width={720}
      open={visible}
      onClose={onClose}
    >
      {/* Basic Information */}
      <Card title="Basic Information" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Email">
                <Space>
                  <MailOutlined />
                  {user.email}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                <Space>
                  <PhoneOutlined />
                  {user.phone || 'Not provided'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Date of Birth">
                {user.dateOfBirth ? dayjs(user.dateOfBirth).format('MMMM DD, YYYY') : 'Not provided'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(user.status)}>
                  {user.status?.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Account Type">
                {user.accountType || 'Standard'}
              </Descriptions.Item>
              <Descriptions.Item label="Member Since">
                {dayjs(user.createdAt).format('MMMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Address Information */}
      <Card title="Address Information" style={{ marginBottom: 16 }}>
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Address">
            <Space>
              <EnvironmentOutlined />
              {user.address?.street || 'Not provided'}
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="City">
            {user.address?.city || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="State/Province">
            {user.address?.state || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Country">
            {user.address?.country || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Postal Code">
            {user.address?.postalCode || 'Not provided'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Financial Information */}
      <Card title="Financial Information" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Balance">
                <Space>
                  <BankOutlined />
                  ${user.balance?.toFixed(2) || '0.00'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Total Profit/Loss">
                <span style={{ color: user.totalProfitLoss >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  ${user.totalProfitLoss?.toFixed(2) || '0.00'}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Account Level">
                {user.accountLevel || 'Basic'}
              </Descriptions.Item>
              <Descriptions.Item label="Leverage">
                {user.leverage || '1:100'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Verification Status */}
      <Card title="Verification Status" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Email Verified">
                {getVerificationStatus(user.emailVerified)}
              </Descriptions.Item>
              <Descriptions.Item label="Phone Verified">
                {getVerificationStatus(user.phoneVerified)}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Identity Verified">
                {getVerificationStatus(user.identityVerified)}
              </Descriptions.Item>
              <Descriptions.Item label="Address Verified">
                {getVerificationStatus(user.addressVerified)}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Trading Information */}
      <Card title="Trading Information" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Total Trades">
                {user.totalTrades || 0}
              </Descriptions.Item>
              <Descriptions.Item label="Win Rate">
                {user.winRate ? `${(user.winRate * 100).toFixed(2)}%` : 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={12}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Last Login">
                {user.lastLogin ? dayjs(user.lastLogin).format('YYYY-MM-DD HH:mm') : 'Never'}
              </Descriptions.Item>
              <Descriptions.Item label="Login Count">
                {user.loginCount || 0}
              </Descriptions.Item>
            </Descriptions>
          </Col>
        </Row>
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        <List
          dataSource={user.recentActivities || []}
          renderItem={(activity: any) => (
            <List.Item>
              <List.Item.Meta
                title={activity.title}
                description={
                  <Space>
                    <Text type="secondary">{activity.description}</Text>
                    <Text type="secondary">
                      {dayjs(activity.timestamp).fromNow()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: 'No recent activity' }}
        />
      </Card>
    </Drawer>
  );
};

export default UserDetailDrawer;