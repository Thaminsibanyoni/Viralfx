import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Avatar, Tag, Descriptions, Space, Alert, message, Modal, List, Statistic, Progress, Tooltip, Rate, Typography, Divider, Empty, Spin, } from 'antd';
import {
  TeamOutlined, CheckCircleOutlined, ExclamationCircleOutlined, LinkOutlined, UserOutlined, TrophyOutlined, SafetyOutlined, PhoneOutlined, MailOutlined, GlobalOutlined, ClockCircleOutlined, StarOutlined, BankOutlined, DeleteOutlined, } from '@ant-design/icons';
import { User } from '../../types/user.types';
import { Broker, AttributionType } from '../../types/broker';
import { useBrokerStore } from '../../stores/brokerStore';
import { brokerApi } from '../../services/api/broker.api';
import { toast } from 'react-hot-toast';
import { OAUTH_PROVIDERS } from '../../types/broker';

const {Title, Text, Paragraph} = Typography;

interface BrokerTabProps {
  user: User;
  broker?: Broker;
  onUpdateUser: (userData: Partial<User>) => void;
}

const BrokerTab: React.FC<BrokerTabProps> = ({ user, broker, onUpdateUser }) => {
  const {linkedBroker, isLinking, linkingError, availableBrokers, isLoadingBrokers, linkBroker, unlinkBroker, fetchAvailableBrokers, } = useBrokerStore();

  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [unlinkModalVisible, setUnlinkModalVisible] = useState(false);

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

  const brokerTiers = {
    STARTER: { color: '#6c757d', label: 'Starter', icon: '🌱' },
    VERIFIED: { color: '#28a745', label: 'Verified', icon: '✅' },
    PREMIUM: { color: '#fd7e14', label: 'Premium', icon: '⭐' },
    ENTERPRISE: { color: '#dc3545', label: 'Enterprise', icon: '🏢' },
  };

  useEffect(() => {
    if (broker) {
      setSelectedBroker(broker);
    }
    if (!linkedBroker && availableBrokers.length === 0) {
      fetchAvailableBrokers();
    }
  }, [broker, linkedBroker, availableBrokers, fetchAvailableBrokers]);

  const handleLinkBroker = async (brokerId: string, provider: string) => {
    await linkBroker(brokerId, provider);
    setLinkModalVisible(false);
    setSelectedBroker(null);
  };

  const handleUnlinkBroker = async () => {
    await unlinkBroker();
    setUnlinkModalVisible(false);
    setSelectedBroker(null);
  };

  const getBrokerTierColor = (tier: string) => {
    return brokerTiers[tier as keyof typeof brokerTiers]?.color || viralFxColors.textSecondary;
  };

  const getBrokerTierLabel = (tier: string) => {
    return brokerTiers[tier as keyof typeof brokerTiers]?.label || tier;
  };

  const getBrokerTierIcon = (tier: string) => {
    return brokerTiers[tier as keyof typeof brokerTiers]?.icon || '📈';
  };

  const renderBenefits = (benefits: string[]) => {
    return (
      <div style={{ marginTop: '12px' }}>
        <Text strong style={{ color: viralFxColors.textPrimary, display: 'block', marginBottom: '8px' }}>
          Benefits of linking with this broker:
        </Text>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {benefits.map((benefit, index) => (
            <li key={index} style={{ color: viralFxColors.textSecondary, marginBottom: '4px' }}>
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderCurrentBroker = () => {
    if (!linkedBroker || !broker) return null;

    const benefits = [
      'Access to expert trading advice and support',
      'Lower commission rates on large trades',
      'Priority customer service',
      'Risk management tools and insights',
      'Educational resources and webinars',
      'Co-branded platform features',
    ];

    return (
      <Card
        style={{
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
          {broker.logoUrl ? (
            <Avatar
              size={80}
              src={broker.logoUrl}
              style={{ border: `2px solid ${viralFxColors.borderDefault}` }}
            />
          ) : (
            <Avatar
              size={80}
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                border: `2px solid ${viralFxColors.primaryPurple}`,
                fontSize: '32px',
                color: 'white',
              }}
            >
              {broker.companyName.charAt(0)}
            </Avatar>
          )}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Title level={4} style={{ margin: 0, color: viralFxColors.textPrimary }}>
                {broker.companyName}
              </Title>
              <Tag
                color={getBrokerTierColor(broker.tier)}
                style={{
                  backgroundColor: `${getBrokerTierColor(broker.tier)}15`,
                  borderColor: getBrokerTierColor(broker.tier),
                  color: 'white',
                }}
              >
                {getBrokerTierIcon(broker.tier)} {getBrokerTierLabel(broker.tier)}
              </Tag>
            </div>

            {broker.verificationStatus === 'FSCA Verified' && (
              <Tag
                color="success"
                icon={<CheckCircleOutlined />}
                style={{
                  backgroundColor: '#f6ffed',
                  borderColor: '#b7eb8f',
                  color: '#52c41a',
                }}
              >
                FSCA Verified
              </Tag>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <Space split>
                <Space>
                  <PhoneOutlined style={{ color: viralFxColors.textSecondary }} />
                  <Text style={{ color: viralFxColors.textSecondary }}>
                    {broker.contactPhone || 'Not provided'}
                  </Text>
                </Space>
                <Space>
                  <MailOutlined style={{ color: viralFxColors.textSecondary }} />
                  <Text style={{ color: viralFxColors.textSecondary }}>
                    {broker.contactEmail}
                  </Text>
                </Space>
                <Space>
                  <GlobalOutlined style={{ color: viralFxColors.textSecondary }} />
                  <Text style={{ color: viralFxColors.textSecondary }}>
                    {broker.website || 'Not provided'}
                  </Text>
                </Space>
              </Space>
            </div>
          </div>
        </div>

        <Descriptions
          bordered
          column={2}
          size="small"
          items={[
            {
              label: 'Registration',
              children: broker.registrationNumber,
            },
            {
              label: 'FSCA License',
              children: broker.fscaLicenseNumber || 'Not verified',
            },
            {
              label: 'Commission Rate',
              children: '30%',
              span: 1.5,
            },
            {
              label: 'Total Traders',
              children: broker.totalTraders.toLocaleString(),
            },
            {
              label: 'Total Volume',
              children: `R ${broker.totalVolume.toLocaleString()}`,
            },
            {
              label: 'Average Rating',
              children: (
                <Rate
                  disabled
                  value={broker.averageRating}
                  allowHalf
                  style={{ color: viralFxColors.accentGold }}
                />
              ),
            },
            {
              label: 'Status',
              children: (
                <Tag
                  color={broker.status === 'VERIFIED' ? 'success' : broker.status === 'PENDING' ? 'warning' : 'default'}
                >
                  {broker.status}
                </Tag>
              ),
            },
          ]}
          style={{ marginBottom: '24px' }}
        />

        {renderBenefits(benefits)}

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong style={{ color: viralFxColors.textPrimary }}>
              Linked Since
            </Text>
            <Text style={{ color: viralFxColors.textSecondary }}>
              {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          </div>

          <Button
            danger
            onClick={() => setUnlinkModalVisible(true)}
            icon={<DeleteOutlined />}
            style={{
              borderColor: viralFxColors.errorRed,
              color: viralFxColors.errorRed,
            }}
          >
            Unlink Broker
          </Button>
        </div>
      </Card>
    );
  };

  const renderNoBroker = () => {
    const benefits = [
      'Professional guidance and market insights',
      'Lower trading fees on high-volume trades',
      'Priority customer support',
      'Risk management tools and portfolio analytics',
      'Educational resources and trading signals',
      'Co-branded features and exclusive promotions',
    ];

    return (
      <div>
        <Card
          style={{
            textAlign: 'center',
            padding: '48px',
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            marginBottom: '24px',
          }}
        >
          <TeamOutlined
            style={{
              fontSize: '48px',
              color: viralFxColors.textSecondary,
              marginBottom: '16px',
            }}
          />
          <Title level={3} style={{ margin: 0, color: viralFxColors.textPrimary }}>
            No Broker Linked
          </Title>
          <Paragraph style={{ color: viralFxColors.textSecondary, maxWidth: '400px', margin: '0 auto' }}>
            You haven't linked your account to a broker yet. Linking to a broker provides additional benefits and support for your trading journey.
          </Paragraph>
        </Card>

        <Card
          style={{
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            marginBottom: '24px',
          }}
        >
          <Alert
            message="Broker Benefits"
            description={benefits.join(' • ')}
            type="info"
            showIcon
            style={{
              backgroundColor: '#e6f7ff',
              borderColor: '#91d5ff',
            }}
          />
        </Card>
      </div>
    );
  };

  const renderAvailableBrokers = () => {
    if (isLoadingBrokers) {
      return (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <Spin size="large" tip="Loading available brokers..." />
        </div>
      );
    }

    if (availableBrokers.length === 0) {
      return (
        <Empty
          description="No brokers available at the moment"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ color: viralFxColors.textSecondary }}
        />
      );
    }

    return (
      <Row gutter={[16, 16]}>
        {availableBrokers.map((broker) => (
          <Col xs={24} sm={12} lg={8} key={broker.id}>
            <Card
              hoverable
              style={{
                border: `1px solid ${viralFxColors.borderDefault}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onClick={() => {
                setSelectedBroker(broker);
                setLinkModalVisible(true);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                {broker.logoUrl ? (
                  <Avatar
                    size={60}
                    src={broker.logoUrl}
                    style={{ border: `2px solid ${viralFxColors.borderDefault}` }}
                  />
                ) : (
                  <Avatar
                    size={60}
                    style={{
                      backgroundColor: viralFxColors.primaryPurple,
                      border: `2px solid ${viralFxColors.primaryPurple}`,
                      fontSize: '24px',
                      color: 'white',
                    }}
                  >
                    {broker.companyName.charAt(0)}
                  </Avatar>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Text strong style={{ color: viralFxColors.textPrimary, fontSize: '16px' }}>
                      {broker.companyName}
                    </Text>
                    <Tag
                      color={getBrokerTierColor(broker.tier)}
                      style={{
                        backgroundColor: `${getBrokerTierColor(broker.tier)}15`,
                        borderColor: getBrokerTierColor(broker.tier),
                        color: 'white',
                        fontSize: '12px',
                      }}
                    >
                      {getBrokerTierIcon(broker.tier)} {getBrokerTierLabel(broker.tier)}
                    </Tag>
                  </div>

                  {broker.verificationStatus === 'FSCA Verified' && (
                    <Tag
                      color="success"
                      icon={<CheckCircleOutlined />}
                      style={{
                        backgroundColor: '#f6ffed',
                        borderColor: '#b7eb8f',
                        color: '#52c41a',
                        fontSize: '12px',
                      }}
                    >
                      FSCA Verified
                    </Tag>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Statistic
                      title="Clients"
                      value={broker.totalTraders}
                      valueStyle={{ fontSize: '14px' }}
                      style={{ textAlign: 'center' }}
                    />
                    <Statistic
                      title="Rating"
                      value={broker.averageRating}
                      precision={1}
                      valueStyle={{ fontSize: '14px' }}
                      style={{ textAlign: 'center' }}
                      suffix={
                        <Rate
                          disabled
                          value={broker.averageRating}
                          allowHalf
                          style={{ color: viralFxColors.accentGold }}
                        />
                      }
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                    Min Deposit: R{broker.paymentInfo?.minimumDeposit.toLocaleString()}
                  </Text>
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<LinkOutlined />}
                  style={{
                    backgroundColor: viralFxColors.primaryPurple,
                    borderColor: viralFxColors.primaryPurple,
                    borderRadius: '6px',
                  }}
                >
                  Link Broker
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <div>
      {linkedBroker && broker ? (
        renderCurrentBroker()
      ) : (
        <>
          {renderNoBroker()}
          {renderAvailableBrokers()}
        </>
      )}

      {/* Link Broker Modal */}
      <Modal
        title="Link with Broker"
        open={linkModalVisible && selectedBroker}
        onCancel={() => {
          setLinkModalVisible(false);
          setSelectedBroker(null);
        }}
        footer={null}
        width={600}
      >
        {selectedBroker && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              {selectedBroker.logoUrl ? (
                <Avatar
                  size={80}
                  src={selectedBroker.logoUrl}
                  style={{
                    border: `3px solid ${viralFxColors.borderDefault}`,
                    marginBottom: '12px',
                  }}
                />
              ) : (
                <Avatar
                  size={80}
                  style={{
                    backgroundColor: viralFxColors.primaryPurple,
                    border: `3px solid ${viralFxColors.primaryPurple}`,
                    fontSize: '32px',
                    color: 'white',
                    marginBottom: '12px',
                  }}
                >
                  {selectedBroker.companyName.charAt(0)}
                </Avatar>
              )}
              <Title level={4} style={{ color: viralFxColors.textPrimary, margin: 0 }}>
                {selectedBroker.companyName}
              </Title>
              <Text style={{ color: viralFxColors.textSecondary }}>
                Choose an authentication method to link your account
              </Text>
            </div>

            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                {
                  label: 'Tier',
                  children: (
                    <Tag
                      color={getBrokerTierColor(selectedBroker.tier)}
                      style={{
                        backgroundColor: `${getBrokerTierColor(selectedBroker.tier)}15`,
                        borderColor: getBrokerTierColor(selectedBroker.tier),
                        color: 'white',
                      }}
                    >
                      {getBrokerTierIcon(selectedBroker.tier)} {getBrokerTierLabel(selectedBroker.tier)}
                    </Tag>
                  ),
                },
                {
                  label: 'Commission',
                  children: '30% of trading fees',
                },
                {
                  label: 'Trust Score',
                  children: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Progress
                        percent={selectedBroker.trustScore}
                        strokeColor={viralFxColors.primaryPurple}
                        size="small"
                        format={(percent) => `${percent}%`}
                        style={{ flex: 1 }}
                      />
                      <Text style={{ color: viralFxColors.textPrimary, minWidth: '40px' }}>
                        {selectedBroker.trustScore}%
                      </Text>
                    </div>
                  ),
                },
              ]}
              style={{ marginBottom: '24px' }}
            />

            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: viralFxColors.textSecondary, marginBottom: '16px' }}>
                Choose how you'd like to authenticate with {selectedBroker.companyName}:
              </Text>

              <Row gutter={16} style={{ marginTop: '16px' }}>
                {Object.entries(OAUTH_PROVIDERS).map(([key, provider]) => (
                  <Col xs={24} sm={12} key={key}>
                    <Button
                      type="primary"
                      icon={provider.icon}
                      onClick={() => handleLinkBroker(selectedBroker.id, provider.id)}
                      style={{
                        width: '100%',
                        backgroundColor: provider.color,
                        borderColor: provider.color,
                        borderRadius: '6px',
                        height: '48px',
                        color: 'white',
                        fontSize: '16px',
                      }}
                    >
                      Continue with {provider.displayName}
                    </Button>
                  </Col>
                ))}
              </Row>

              <Text
                type="secondary"
                style={{
                  fontSize: '12px',
                  color: viralFxColors.textSecondary,
                  marginTop: '16px',
                  textAlign: 'center',
                }}
              >
                By linking, you agree to share your trading activity with {selectedBroker.companyName} and allow them to provide support.
              </Text>
            </div>
          </div>
        )}
      </Modal>

      {/* Unlink Broker Confirmation Modal */}
      <Modal
        title="Unlink from Broker"
        open={unlinkModalVisible}
        onCancel={() => setUnlinkModalVisible(false)}
        onOk={handleUnlinkBroker}
        okText="Unlink"
        okButtonProps={{
          style: {
            backgroundColor: viralFxColors.errorRed,
            borderColor: viralFxColors.errorRed,
          },
        }}
        cancelText="Cancel"
        width={500}
      >
        {broker && (
          <div>
            <Alert
              message="This action will remove your link with your broker"
              description="You will lose access to broker-specific features and benefits. You can always link again later."
              type="warning"
              showIcon
              style={{
                marginBottom: '16px',
                backgroundColor: '#fffbe6',
                borderColor: '#ffe58f',
              }}
            />

            <Descriptions
              bordered
              column={1}
              size="small"
              items={[
                {
                  label: 'Current Broker',
                  children: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {broker.logoUrl ? (
                        <Avatar
                          size={32}
                          src={broker.logoUrl}
                          style={{ border: `1px solid ${viralFxColors.borderDefault}` }}
                        />
                      ) : (
                        <Avatar size={32} style={{ backgroundColor: viralFxColors.primaryPurple, color: 'white' }}>
                          {broker.companyName.charAt(0)}
                        </Avatar>
                      )}
                      <Text strong>{broker.companyName}</Text>
                    </div>
                  ),
                },
                {
                  label: 'Commission Rate',
                  children: '30%',
                },
                {
                  label: 'Link Date',
                  children: new Date().toLocaleDateString(),
                },
              ]}
              style={{ marginTop: '16px' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BrokerTab;