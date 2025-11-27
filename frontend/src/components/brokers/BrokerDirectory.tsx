import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Button, Space, Tag, Avatar, Rate, Input, Select, Slider, Badge, Tooltip, Modal, List, Divider, Statistic, Empty, Spin, } from 'antd';
import {
  TeamOutlined, StarOutlined, TrophyOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SearchOutlined, FilterOutlined, LinkOutlined, DollarOutlined, SafetyOutlined, GlobalOutlined, RocketOutlined, ClockCircleOutlined, SecurityScanOutlined, BankOutlined, UserOutlined, } from '@ant-design/icons';
import { Broker, BrokerTier } from '../../types/broker';
import { useBrokerStore } from '../../stores/brokerStore';
import { toast } from 'react-hot-toast';

const {Title, Text, Paragraph} = Typography;
const {Option} = Select;
const {Search} = Input;

interface BrokerDirectoryProps {
  visible: boolean;
  onClose: () => void;
  onLinkBroker: (brokerId: string, provider: string) => void;
}

const BrokerDirectory: React.FC<BrokerDirectoryProps> = ({
  visible,
  onClose,
  onLinkBroker,
}) => {
  const {linkBroker, linking, linkingError} = useBrokerStore();

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [filters, setFilters] = useState({
    tier: '',
    regulation: '',
    minRating: 0,
    maxFees: 100,
    country: '',
  });

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  // Mock broker data
  const mockBrokers: Broker[] = [
    {
      id: '1',
      companyName: 'FXCM South Africa',
      tier: BrokerTier.ENTERPRISE,
      status: 'ACTIVE',
      registrationNumber: '2005/017545/07',
      fisNumber: 'FSP44714',
      website: 'https://www.fxcm.co.za',
      supportEmail: 'support@fxcm.co.za',
      supportPhone: '+27 11 580 7400',
      commissionRate: 0.5,
      referralBonus: 100,
      description: 'Leading global forex broker with strong presence in South Africa. Regulated by FSCA with excellent trading conditions.',
      logoUrl: '/brokers/fxcm.png',
      country: 'South Africa',
      foundedYear: 1999,
      employeeCount: 2000,
      tradingVolume: 450000000000,
      activeClients: 150000,
      minimumDeposit: 50,
      maximumLeverage: 400,
      spreads: 'From 0.2 pips',
      regulations: ['FSCA', 'FCA', 'ASIC'],
      tradingPlatforms: ['MT4', 'MT5', 'Trading Station'],
      customerSupport: '24/7',
      educationResources: true,
      apiAccess: true,
      socialTrading: false,
      copyTrading: true,
      islamicAccount: true,
      demoAccount: true,
      languages: ['English', 'Afrikaans', 'Zulu'],
      paymentMethods: ['EFT', 'Credit Card', 'Crypto'],
      withdrawalTime: '1-2 business days',
      rating: 4.5,
      reviewsCount: 1250,
      awards: ['Best Forex Broker SA 2023', 'Most Trusted Broker 2022'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      companyName: 'HotForex South Africa',
      tier: BrokerTier.PREMIUM,
      status: 'ACTIVE',
      registrationNumber: '2013/177505/07',
      fisNumber: 'FSP46632',
      website: 'https://www.hotforex.co.za',
      supportEmail: 'support@hotforex.co.za',
      supportPhone: '+27 87 943 8084',
      commissionRate: 0.6,
      referralBonus: 150,
      description: 'Award-winning forex and commodities broker offering competitive trading conditions and excellent customer support.',
      logoUrl: '/brokers/hotforex.png',
      country: 'South Africa',
      foundedYear: 2010,
      employeeCount: 1000,
      tradingVolume: 250000000000,
      activeClients: 80000,
      minimumDeposit: 5,
      maximumLeverage: 1000,
      spreads: 'From 0.1 pips',
      regulations: ['FSCA', 'CySEC', 'DFSA'],
      tradingPlatforms: ['MT4', 'MT5'],
      customerSupport: '24/5',
      educationResources: true,
      apiAccess: true,
      socialTrading: true,
      copyTrading: true,
      islamicAccount: true,
      demoAccount: true,
      languages: ['English', 'Afrikaans'],
      paymentMethods: ['EFT', 'Credit Card', 'OZOW'],
      withdrawalTime: '1-3 business days',
      rating: 4.3,
      reviewsCount: 890,
      awards: ['Best Customer Service 2023', 'Fastest Growing Broker 2022'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      companyName: 'Exness South Africa',
      tier: BrokerTier.PREMIUM,
      status: 'ACTIVE',
      registrationNumber: '2018/475686/07',
      fisNumber: 'FSP51772',
      website: 'https://www.exness.co.za',
      supportEmail: 'support@exness.co.za',
      supportPhone: '+27 87 550 2130',
      commissionRate: 0.4,
      referralBonus: 80,
      description: 'Global forex broker known for instant withdrawals and unlimited leverage options.',
      logoUrl: '/brokers/exness.png',
      country: 'South Africa',
      foundedYear: 2008,
      employeeCount: 1500,
      tradingVolume: 380000000000,
      activeClients: 120000,
      minimumDeposit: 10,
      maximumLeverage: 'Unlimited',
      spreads: 'From 0.0 pips',
      regulations: ['FSCA', 'CySEC', 'FCA'],
      tradingPlatforms: ['MT4', 'MT5'],
      customerSupport: '24/7',
      educationResources: true,
      apiAccess: true,
      socialTrading: false,
      copyTrading: true,
      islamicAccount: true,
      demoAccount: true,
      languages: ['English', 'Afrikaans', 'Portuguese'],
      paymentMethods: ['EFT', 'Crypto', 'Neteller'],
      withdrawalTime: 'Instant',
      rating: 4.4,
      reviewsCount: 2100,
      awards: ['Best Trading Conditions 2023', 'Instant Withdrawals Award 2022'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      companyName: 'Tickmill South Africa',
      tier: BrokerTier.VERIFIED,
      status: 'ACTIVE',
      registrationNumber: '2016/441769/07',
      fisNumber: 'FSP49646',
      website: 'https://www.tickmill.co.za',
      supportEmail: 'support@tickmill.co.za',
      supportPhone: '+27 10 590 1300',
      commissionRate: 0.7,
      referralBonus: 120,
      description: 'ECN forex broker offering tight spreads, fast execution, and comprehensive educational resources.',
      logoUrl: '/brokers/tickmill.png',
      country: 'South Africa',
      foundedYear: 2014,
      employeeCount: 300,
      tradingVolume: 120000000000,
      activeClients: 45000,
      minimumDeposit: 25,
      maximumLeverage: 500,
      spreads: 'From 0.0 pips',
      regulations: ['FSCA', 'FCA', 'CySEC'],
      tradingPlatforms: ['MT4', 'MT5'],
      customerSupport: '24/5',
      educationResources: true,
      apiAccess: true,
      socialTrading: false,
      copyTrading: false,
      islamicAccount: true,
      demoAccount: true,
      languages: ['English', 'Afrikaans'],
      paymentMethods: ['EFT', 'Credit Card'],
      withdrawalTime: '1-2 business days',
      rating: 4.2,
      reviewsCount: 650,
      awards: ['Best ECN Broker 2023'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const [brokers] = useState<Broker[]>(mockBrokers);

  const filteredBrokers = brokers.filter(broker => {
    // Search filter
    if (searchTerm && !broker.companyName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !broker.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Tier filter
    if (filters.tier && broker.tier !== filters.tier) return false;

    // Regulation filter
    if (filters.regulation && !broker.regulations.includes(filters.regulation)) return false;

    // Rating filter
    if (broker.rating < filters.minRating) return false;

    // Fees filter
    if (broker.commissionRate > filters.maxFees / 100) return false;

    // Country filter
    if (filters.country && broker.country !== filters.country) return false;

    return true;
  });

  const getTierColor = (tier: BrokerTier) => {
    switch (tier) {
      case BrokerTier.ENTERPRISE: return 'gold';
      case BrokerTier.PREMIUM: return 'purple';
      case BrokerTier.VERIFIED: return 'blue';
      case BrokerTier.STARTER: return 'default';
      default: return 'default';
    }
  };

  const getTierIcon = (tier: BrokerTier) => {
    switch (tier) {
      case BrokerTier.ENTERPRISE: return <TrophyOutlined style={{ color: viralFxColors.accentGold }} />;
      case BrokerTier.PREMIUM: return <StarOutlined style={{ color: viralFxColors.primaryPurple }} />;
      case BrokerTier.VERIFIED: return <CheckCircleOutlined style={{ color: viralFxColors.successGreen }} />;
      case BrokerTier.STARTER: return <UserOutlined style={{ color: viralFxColors.textSecondary }} />;
      default: return <UserOutlined />;
    }
  };

  const handleLinkBroker = async (broker: Broker) => {
    try {
      await onLinkBroker(broker.id, 'oauth');
      toast.success(`Successfully initiated linking to ${broker.companyName}`);
      onClose();
    } catch (error) {
      toast.error('Failed to link broker. Please try again.');
    }
  };

  const renderBrokerCard = (broker: Broker) => (
    <Col xs={24} sm={12} lg={8} key={broker.id}>
      <Card
        hoverable
        style={{
          height: '100%',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        bodyStyle={{ padding: '20px' }}
        actions={[
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => handleLinkBroker(broker)}
            loading={linking}
            style={{
              backgroundColor: viralFxColors.primaryPurple,
              borderColor: viralFxColors.primaryPurple,
            }}
          >
            Link Broker
          </Button>,
          <Button
            onClick={() => {
              setSelectedBroker(broker);
              setDetailModalVisible(true);
            }}
          >
            View Details
          </Button>,
        ]}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <Avatar
            size={64}
            src={broker.logoUrl}
            icon={<BankOutlined />}
            style={{
              border: `3px solid ${viralFxColors.borderDefault}`,
            }}
          />
          <div style={{ marginTop: '12px' }}>
            <Space>
              <Tag color={getTierColor(broker.tier)} icon={getTierIcon(broker.tier)}>
                {broker.tier}
              </Tag>
              <Tag color="green" icon={<CheckCircleOutlined />}>
                FSCA Regulated
              </Tag>
            </Space>
          </div>
        </div>

        <Title level={5} style={{ textAlign: 'center', margin: '16px 0', color: viralFxColors.textPrimary }}>
          {broker.companyName}
        </Title>

        <Paragraph
          ellipsis={{ rows: 2 }}
          style={{ textAlign: 'center', color: viralFxColors.textSecondary, fontSize: '14px' }}
        >
          {broker.description}
        </Paragraph>

        <div style={{ marginTop: '16px' }}>
          <Row gutter={8}>
            <Col span={12}>
              <Statistic
                title="Rating"
                value={broker.rating}
                precision={1}
                prefix={<StarOutlined style={{ color: viralFxColors.accentGold }} />}
                suffix={`/ 5`}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Commission"
                value={broker.commissionRate}
                precision={1}
                suffix="%"
                valueStyle={{ fontSize: '14px', color: viralFxColors.successGreen }}
              />
            </Col>
          </Row>
        </div>

        <div style={{ marginTop: '16px' }}>
          <Space wrap>
            <Tag color="blue" icon={<DollarOutlined />}>
              Min: R{broker.minimumDeposit}
            </Tag>
            <Tag color="purple" icon={<RocketOutlined />}>
              {broker.activeClients.toLocaleString()} clients
            </Tag>
          </Space>
        </div>

        <div style={{ marginTop: '12px' }}>
          <Rate disabled defaultValue={broker.rating} style={{ fontSize: '14px' }} />
          <Text type="secondary" style={{ marginLeft: '8px', fontSize: '12px' }}>
            ({broker.reviewsCount} reviews)
          </Text>
        </div>
      </Card>
    </Col>
  );

  const renderBrokerDetails = () => {
    if (!selectedBroker) return null;

    return (
      <Modal
        title={
          <Space>
            <Avatar size="small" src={selectedBroker.logoUrl} icon={<BankOutlined />} />
            <span>{selectedBroker.companyName}</span>
            <Tag color={getTierColor(selectedBroker.tier)}>{selectedBroker.tier}</Tag>
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Close
          </Button>,
          <Button
            key="link"
            type="primary"
            icon={<LinkOutlined />}
            onClick={() => {
              handleLinkBroker(selectedBroker);
              setDetailModalVisible(false);
            }}
            loading={linking}
            style={{
              backgroundColor: viralFxColors.primaryPurple,
              borderColor: viralFxColors.primaryPurple,
            }}
          >
            Link This Broker
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {/* Key Information */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Commission Rate"
                  value={selectedBroker.commissionRate}
                  precision={1}
                  suffix="%"
                  valueStyle={{ color: viralFxColors.successGreen }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Referral Bonus"
                  value={selectedBroker.referralBonus}
                  prefix="R"
                  valueStyle={{ color: viralFxColors.accentGold }}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Rating"
                  value={selectedBroker.rating}
                  precision={1}
                  prefix={<StarOutlined />}
                  valueStyle={{ color: viralFxColors.warningOrange }}
                />
              </Card>
            </Col>
          </Row>

          {/* Description */}
          <Card title="About" size="small" style={{ marginBottom: '16px' }}>
            <Paragraph>{selectedBroker.description}</Paragraph>
          </Card>

          {/* Trading Information */}
          <Card title="Trading Information" size="small" style={{ marginBottom: '16px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Space direction="vertical">
                  <div>
                    <Text strong>Minimum Deposit: </Text>
                    <Text>R{selectedBroker.minimumDeposit}</Text>
                  </div>
                  <div>
                    <Text strong>Maximum Leverage: </Text>
                    <Text>{selectedBroker.maximumLeverage}</Text>
                  </div>
                  <div>
                    <Text strong>Spreads: </Text>
                    <Text>{selectedBroker.spreads}</Text>
                  </div>
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical">
                  <div>
                    <Text strong>Active Clients: </Text>
                    <Text>{selectedBroker.activeClients.toLocaleString()}</Text>
                  </div>
                  <div>
                    <Text strong>Customer Support: </Text>
                    <Text>{selectedBroker.customerSupport}</Text>
                  </div>
                  <div>
                    <Text strong>Withdrawal Time: </Text>
                    <Text>{selectedBroker.withdrawalTime}</Text>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {/* Regulations */}
          <Card title="Regulations" size="small" style={{ marginBottom: '16px' }}>
            <Space wrap>
              {selectedBroker.regulations.map((reg) => (
                <Tag key={reg} color="green" icon={<SafetyOutlined />}>
                  {reg}
                </Tag>
              ))}
            </Space>
          </Card>

          {/* Features */}
          <Card title="Features" size="small">
            <Row gutter={[16, 8]}>
              <Col span={12}>
                <Space direction="vertical">
                  <div>
                    {selectedBroker.educationResources && (
                      <Tag color="blue">Education Resources</Tag>
                    )}
                  </div>
                  <div>
                    {selectedBroker.apiAccess && <Tag color="blue">API Access</Tag>}
                  </div>
                  <div>
                    {selectedBroker.socialTrading && <Tag color="blue">Social Trading</Tag>}
                  </div>
                  <div>
                    {selectedBroker.copyTrading && <Tag color="blue">Copy Trading</Tag>}
                  </div>
                </Space>
              </Col>
              <Col span={12}>
                <Space direction="vertical">
                  <div>
                    {selectedBroker.islamicAccount && <Tag color="blue">Islamic Account</Tag>}
                  </div>
                  <div>
                    {selectedBroker.demoAccount && <Tag color="blue">Demo Account</Tag>}
                  </div>
                  <div>
                    <Tag color="blue">
                      {selectedBroker.languages.length} Languages
                    </Tag>
                  </div>
                  <div>
                    <Tag color="blue">
                      {selectedBroker.paymentMethods.length} Payment Methods
                    </Tag>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>
        </div>
      </Modal>
    );
  };

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined style={{ color: viralFxColors.accentGold }} />
          <span>Broker Directory</span>
          <Badge count={filteredBrokers.length} showZero />
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
      {/* Search and Filters */}
      <div style={{ marginBottom: '24px' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="Search brokers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Tier"
              value={filters.tier}
              onChange={(value) => setFilters(prev => ({ ...prev, tier: value }))}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value={BrokerTier.ENTERPRISE}>Enterprise</Option>
              <Option value={BrokerTier.PREMIUM}>Premium</Option>
              <Option value={BrokerTier.VERIFIED}>Verified</Option>
              <Option value={BrokerTier.STARTER}>Starter</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Regulation"
              value={filters.regulation}
              onChange={(value) => setFilters(prev => ({ ...prev, regulation: value }))}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value="FSCA">FSCA</Option>
              <Option value="FCA">FCA</Option>
              <Option value="CySEC">CySEC</Option>
              <Option value="ASIC">ASIC</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Min Rating"
              value={filters.minRating > 0 ? filters.minRating : undefined}
              onChange={(value) => setFilters(prev => ({ ...prev, minRating: value || 0 }))}
              style={{ width: '100%' }}
              allowClear
            >
              <Option value={4}>4+ Stars</Option>
              <Option value={4.2}>4.2+ Stars</Option>
              <Option value={4.5}>4.5+ Stars</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Button
              icon={<FilterOutlined />}
              onClick={() => setFilters({
                tier: '',
                regulation: '',
                minRating: 0,
                maxFees: 100,
                country: '',
              })}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </div>

      {/* Broker Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
        </div>
      ) : filteredBrokers.length === 0 ? (
        <Empty
          description="No brokers found matching your criteria"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredBrokers.map(renderBrokerCard)}
        </Row>
      )}

      {renderBrokerDetails()}
    </Modal>
  );
};

export default BrokerDirectory;