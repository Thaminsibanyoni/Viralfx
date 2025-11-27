import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Button, Table, Progress, Tag, Space, Typography, message, Tooltip, QRCode, Modal, Input, Divider, Avatar, List, Badge, } from 'antd';
import {
  UserOutlined, ShareAltOutlined, GiftOutlined, TrophyOutlined, CopyOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, TwitterOutlined, FacebookOutlined, MessageOutlined, MailOutlined, QrcodeOutlined, CrownOutlined, StarOutlined, FireOutlined, } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { referralApi } from '../../services/api/referral.api';
import { ReferralStats, Referral, Reward } from '../../types/referral.types';

const {Title, Paragraph, Text} = Typography;

const ReferralDashboard: React.FC = () => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState<string>('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const _fetchReferralData = async () => {
    try {
      setLoading(true);
      const [statsData, referralsData, rewardsData, codeData] = await Promise.all([
        referralApi.getReferralStats(),
        referralApi.getReferralHistory(),
        referralApi.getRewards(),
        referralApi.getReferralCode(),
      ]);

      setStats(statsData);
      setReferrals(referralsData);
      setRewards(rewardsData);
      setReferralCode(codeData.code);
    } catch (error) {
      message.error('Failed to load referral data');
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${type} copied to clipboard!`);
  };

  const shareReferral = (platform: string) => {
    const referralLink = `https://viralfx.co.za/signup?ref=${referralCode}`;
    const message = `Join ViralFX - the ultimate viral trading platform! Use my referral code: ${referralCode}`;

    let shareUrl = '';

    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(referralLink)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(message + ' ' + referralLink)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent('Join ViralFX')}&body=${encodeURIComponent(message + '\n\n' + referralLink)}`;
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank');
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'BRONZE':
        return <StarOutlined style={{ color: '#CD7F32' }} />;
      case 'SILVER':
        return <StarOutlined style={{ color: '#C0C0C0' }} />;
      case 'GOLD':
        return <CrownOutlined style={{ color: '#FFD700' }} />;
      case 'PLATINUM':
        return <CrownOutlined style={{ color: '#E5E4E2' }} />;
      case 'DIAMOND':
        return <TrophyOutlined style={{ color: '#B9F2FF' }} />;
      default:
        return <UserOutlined />;
    }
  };

  const getReferralStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'ACTIVE':
        return 'processing';
      case 'PENDING':
        return 'warning';
      case 'EXPIRED':
        return 'default';
      default:
        return 'default';
    }
  };

  const getReferralStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleOutlined />;
      case 'ACTIVE':
        return <ClockCircleOutlined />;
      case 'PENDING':
        return <ExclamationCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const referralColumns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getReferralStatusColor(status)} icon={getReferralStatusIcon(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Referred User',
      dataIndex: ['referee', 'username'],
      key: 'referee',
      render: (username: string, record: Referral) => (
        <Space>
          <Avatar icon={<UserOutlined />} size="small" />
          <span>{username || 'Pending'}</span>
        </Space>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Reward Earned',
      dataIndex: 'totalRewardEarned',
      key: 'totalRewardEarned',
      render: (amount: number) => (
        <Text strong>R {amount?.toFixed(2) || '0.00'}</Text>
      ),
    },
  ];

  const rewardColumns = [
    {
      title: 'Type',
      dataIndex: 'rewardType',
      key: 'rewardType',
      render: (type: string) => (
        <Tag color="blue">
          <GiftOutlined /> {type}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'rewardAmount',
      key: 'rewardAmount',
      render: (amount: number, record: Reward) => (
        <Text strong>R {amount.toFixed(2)} {record.currency}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'PAID' ? 'success' : status === 'PENDING' ? 'processing' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Expires',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (date: string) => date ? new Date(date).toLocaleDateString() : 'Never',
    },
  ];

  if (!stats) {
    return <div>Loading...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="p-6"
    >
      {/* Header */}
      <div className="mb-8">
        <Title level={2}>Referral Program</Title>
        <Paragraph className="text-gray-600">
          Invite friends to join ViralFX and earn rewards for every successful referral!
        </Paragraph>
      </div>

      {/* Stats Overview */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} sm={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card className="text-center">
              <Statistic
                title="Total Referrals"
                value={stats.totalReferrals}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card className="text-center">
              <Statistic
                title="Completed Referrals"
                value={stats.completedReferrals}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card className="text-center">
              <Statistic
                title="Total Earned"
                value={stats.totalEarned}
                prefix="R"
                precision={2}
                suffix={<GiftOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card className="text-center">
              <Statistic
                title="Conversion Rate"
                value={stats.conversionRate}
                suffix="%"
                prefix={<FireOutlined />}
                precision={1}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Referral Code Section */}
      <Row gutter={[24, 24]} className="mb-8">
        <Col xs={24} md={12}>
          <Card title="Your Referral Code" className="h-full">
            <Space direction="vertical" className="w-full" size="large">
              <div className="text-center">
                <Title level={2} className="text-purple-600 font-mono">
                  {referralCode}
                </Title>
                <Space>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(referralCode, 'Referral code')}
                  >
                    Copy Code
                  </Button>
                  <Button
                    icon={<QrcodeOutlined />}
                    onClick={() => setQrModalVisible(true)}
                  >
                    Show QR
                  </Button>
                </Space>
              </div>

              <Divider />

              <div>
                <Text strong>Referral Link:</Text>
                <div className="mt-2 p-3 bg-gray-50 rounded font-mono text-sm break-all">
                  https://viralfx.co.za/signup?ref={referralCode}
                </div>
                <Button
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(`https://viralfx.co.za/signup?ref=${referralCode}`, 'Referral link')}
                >
                  Copy Link
                </Button>
              </div>

              <div>
                <Text strong>Share:</Text>
                <div className="mt-2">
                  <Space>
                    <Button
                      icon={<TwitterOutlined />}
                      onClick={() => shareReferral('twitter')}
                    >
                      Twitter
                    </Button>
                    <Button
                      icon={<FacebookOutlined />}
                      onClick={() => shareReferral('facebook')}
                    >
                      Facebook
                    </Button>
                    <Button
                      icon={<MessageOutlined />}
                      onClick={() => shareReferral('whatsapp')}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      icon={<MailOutlined />}
                      onClick={() => shareReferral('email')}
                    >
                      Email
                    </Button>
                  </Space>
                </div>
              </div>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Your Tier" className="h-full">
            <Space direction="vertical" className="w-full" size="large">
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {getTierIcon(stats.currentTier)}
                </div>
                <Title level={3}>{stats.currentTier}</Title>
                <Paragraph>
                  {stats.nextTier && (
                    <span>
                      {stats.tierProgress.required - stats.tierProgress.current} more referrals to reach {stats.nextTier}
                    </span>
                  )}
                </Paragraph>
              </div>

              <div>
                <Text strong>Tier Progress:</Text>
                <Progress
                  percent={stats.tierProgress.percentage}
                  status={stats.tierProgress.percentage === 100 ? 'success' : 'active'}
                  className="mt-2"
                />
                <div className="flex justify-between mt-1 text-sm text-gray-500">
                  <span>Level {stats.tierProgress.current}</span>
                  <span>Level {stats.tierProgress.required}</span>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded">
                <Text strong>Tier Benefits:</Text>
                <List size="small" className="mt-2">
                  <List.Item>Base reward per referral</List.Item>
                  <List.Item>Bonus rewards for milestones</List.Item>
                  <List.Item>Priority support access</List.Item>
                  <List.Item>Exclusive promotional offers</List.Item>
                </List>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Referrals History */}
      <Card title="Referral History" className="mb-8">
        <Table
          dataSource={referrals}
          columns={referralColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>

      {/* Rewards History */}
      <Card title="Rewards Earned">
        <Table
          dataSource={rewards}
          columns={rewardColumns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          loading={loading}
        />
      </Card>

      {/* QR Code Modal */}
      <Modal
        title="Referral QR Code"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={null}
        className="text-center"
      >
        <div className="p-4">
          <QRCode
            value={`https://viralfx.co.za/signup?ref=${referralCode}`}
            size={200}
          />
          <div className="mt-4">
            <Text strong>Scan to join ViralFX!</Text>
            <br />
            <Text type="secondary">Referral Code: {referralCode}</Text>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
};

export default ReferralDashboard;