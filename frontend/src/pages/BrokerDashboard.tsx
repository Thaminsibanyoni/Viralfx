import React, { useState, useEffect } from 'react';
import {
  Layout, Row, Col, Card, Statistic, Table, Progress, Space, Typography, Button, Tabs, Avatar, Tag, Timeline, Alert, Select, DatePicker, List, Divider, Tooltip, } from 'antd';
import {
  TeamOutlined, TrophyOutlined, DollarOutlined, RiseOutlined, UserOutlined, StarOutlined, LinkOutlined, EyeOutlined, RiseOutlined, BarChartOutlined, CalendarOutlined, MessageOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useBrokerStore } from '../stores/brokerStore';
import { Broker, BrokerClient, BrokerAnalytics, BrokerBill } from '../types/broker';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

const {Content} = Layout;
const {Title, Text} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;

const BrokerDashboard: React.FC = () => {
  const {user} = useAuthStore();
  const {broker, brokerStats, brokerClients, brokerAnalytics, fetchBrokerData, fetchBrokerAnalytics} = useBrokerStore();

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [activeTab, setActiveTab] = useState('overview');

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await fetchBrokerData();
      } catch (error) {
        toast.error('Failed to load broker data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchBrokerData]);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (dateRange) {
        try {
          setAnalyticsLoading(true);
          await fetchBrokerAnalytics({
            startDate: dateRange[0].toISOString(),
            endDate: dateRange[1].toISOString(),
          });
        } catch (error) {
          toast.error('Failed to load analytics data');
        } finally {
          setAnalyticsLoading(false);
        }
      }
    };

    loadAnalytics();
  }, [dateRange, fetchBrokerAnalytics]);

  const getCommissionProgress = () => {
    if (!brokerStats) return 0;
    const monthlyTarget = 50000; // Example monthly target
    return Math.min((brokerStats.totalCommission / monthlyTarget) * 100, 100);
  };

  const getTierProgress = () => {
    if (!broker) return 0;
    const currentTierIndex = ['STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'].indexOf(broker.tier);
    const maxTierIndex = 3;
    return ((currentTierIndex + 1) / (maxTierIndex + 1)) * 100;
  };

  const clientColumns = [
    {
      title: 'Client',
      dataIndex: 'client',
      key: 'client',
      render: (client: any) => (
        <Space>
          <Avatar size="small" src={client.avatarUrl} icon={<UserOutlined />} />
          <div>
            <div style={{ fontWeight: 500 }}>
              {client.firstName} {client.lastName}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {client.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={status === 'ACTIVE' ? 'green' : status === 'PENDING' ? 'orange' : 'default'}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: 'Total Volume',
      dataIndex: 'totalVolume',
      key: 'totalVolume',
      render: (volume: number) => `R${volume.toLocaleString()}`,
    },
    {
      title: 'Commission',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (commission: number) => (
        <Text style={{ color: viralFxColors.successGreen, fontWeight: 500 }}>
          R{commission.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
    },
  ];

  const billColumns = [
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
    },
    {
      title: 'Commission',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      render: (amount: number) => `R${amount.toLocaleString()}`,
    },
    {
      title: 'Bonus',
      dataIndex: 'bonusAmount',
      key: 'bonusAmount',
      render: (amount: number) => (
        <Text style={{ color: viralFxColors.accentGold, fontWeight: 500 }}>
          +R{amount.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => (
        <Text style={{ fontWeight: 600, color: viralFxColors.primaryPurple }}>
          R{amount.toLocaleString()}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag
          color={status === 'PAID' ? 'green' : status === 'PENDING' ? 'orange' : 'default'}
        >
          {status}
        </Tag>
      ),
    },
  ];

  const renderOverview = () => (
    <div>
      {/* Stats Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Statistic
              title="Total Clients"
              value={brokerStats?.totalClients || 0}
              prefix={<TeamOutlined style={{ color: viralFxColors.primaryPurple }} />}
              valueStyle={{ color: viralFxColors.primaryPurple }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Statistic
              title="Total Commission"
              value={brokerStats?.totalCommission || 0}
              precision={2}
              prefix="R"
              valueStyle={{ color: viralFxColors.successGreen }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Statistic
              title="Monthly Volume"
              value={brokerStats?.monthlyVolume || 0}
              precision={2}
              prefix="R"
              valueStyle={{ color: viralFxColors.accentGold }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Statistic
              title="Active Now"
              value={brokerStats?.activeClients || 0}
              prefix={<RiseOutlined style={{ color: viralFxColors.warningOrange }} />}
              valueStyle={{ color: viralFxColors.warningOrange }}
            />
          </Card>
        </Col>
      </Row>

      {/* Progress Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={12}>
          <Card
            title="Monthly Commission Target"
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Progress
              percent={getCommissionProgress()}
              strokeColor={{
                '0%': viralFxColors.primaryPurple,
                '100%': viralFxColors.accentGold,
              }}
              format={(percent) => `${percent.toFixed(1)}%`}
            />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Current: R{(brokerStats?.totalCommission || 0).toLocaleString()}</Text>
              <Text type="secondary">Target: R50,000</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Tier Progress"
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Progress
              percent={getTierProgress()}
              strokeColor={{
                '0%': viralFxColors.primaryPurple,
                '100%': viralFxColors.accentGold,
              }}
              format={(percent) => `${percent.toFixed(0)}%`}
            />
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <Tag color="purple" style={{ margin: 0 }}>
                {broker?.tier || 'STARTER'}
              </Tag>
              <Text type="secondary">Next: Premium</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            title="Recent Client Activity"
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Timeline
              items={[
                {
                  color: viralFxColors.successGreen,
                  children: (
                    <div>
                      <Text strong>New client registered</Text>
                      <br />
                      <Text type="secondary">John Doe joined 2 hours ago</Text>
                    </div>
                  ),
                },
                {
                  color: viralFxColors.accentGold,
                  children: (
                    <div>
                      <Text strong>Commission earned</Text>
                      <br />
                      <Text type="secondary">R250 from client trades</Text>
                    </div>
                  ),
                },
                {
                  color: viralFxColors.primaryPurple,
                  children: (
                    <div>
                      <Text strong>Tier upgrade achieved</Text>
                      <br />
                      <Text type="secondary">Moved to Verified tier</Text>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Quick Actions"
            style={{
              border: `1px solid ${viralFxColors.borderDefault}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
            }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<UserOutlined />}
                block
                style={{
                  backgroundColor: viralFxColors.primaryPurple,
                  borderColor: viralFxColors.primaryPurple,
                }}
              >
                Invite New Client
              </Button>
              <Button
                icon={<BarChartOutlined />}
                block
              >
                View Analytics
              </Button>
              <Button
                icon={<MessageOutlined />}
                block
              >
                Contact Support
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderClients = () => (
    <Card
      title="Client Management"
      style={{
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Select placeholder="Filter by status" style={{ width: 150 }} allowClear>
            <Option value="ACTIVE">Active</Option>
            <Option value="PENDING">Pending</Option>
            <Option value="INACTIVE">Inactive</Option>
          </Select>
          <Select placeholder="Sort by" style={{ width: 150 }}>
            <Option value="createdAt">Join Date</Option>
            <Option value="totalVolume">Volume</Option>
            <Option value="totalCommission">Commission</Option>
          </Select>
        </Space>
        <Button
          type="primary"
          icon={<UserOutlined />}
          style={{
            backgroundColor: viralFxColors.primaryPurple,
            borderColor: viralFxColors.primaryPurple,
          }}
        >
          Invite Client
        </Button>
      </div>

      <Table
        columns={clientColumns}
        dataSource={brokerClients}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} clients`,
        }}
      />
    </Card>
  );

  const renderAnalytics = () => (
    <div>
      <Card
        title="Analytics Dashboard"
        style={{
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          marginBottom: '24px',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange(dates)}
            style={{ marginRight: '16px' }}
          />
          <Select defaultValue="revenue" style={{ width: 150 }}>
            <Option value="revenue">Revenue</Option>
            <Option value="clients">Clients</Option>
            <Option value="volume">Volume</Option>
          </Select>
        </div>

        {/* Analytics content would go here - charts, graphs, etc. */}
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <RiseOutlined style={{ fontSize: '48px', color: viralFxColors.primaryPurple, marginBottom: '16px' }} />
          <Title level={4}>Analytics Charts Coming Soon</Title>
          <Text type="secondary">Detailed analytics and reporting dashboard will be available here.</Text>
        </div>
      </Card>
    </div>
  );

  const renderBills = () => (
    <Card
      title="Commission Bills"
      style={{
        border: `1px solid ${viralFxColors.borderDefault}`,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
    >
      <Table
        columns={billColumns}
        dataSource={[]} // Would come from brokerBills
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} bills`,
        }}
      />
    </Card>
  );

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: renderOverview(),
    },
    {
      key: 'clients',
      label: 'Clients',
      children: renderClients(),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      children: renderAnalytics(),
    },
    {
      key: 'bills',
      label: 'Bills',
      children: renderBills(),
    },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
        <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div style={{ fontSize: '18px', color: viralFxColors.textSecondary }}>Loading broker dashboard...</div>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh', background: viralFxColors.backgroundSecondary }}>
      <Content style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{
          marginBottom: '24px',
          background: viralFxColors.backgroundPrimary,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                margin: 0,
                color: viralFxColors.textPrimary,
                fontSize: '28px',
                fontWeight: 600,
                background: `linear-gradient(135deg, ${viralFxColors.primaryPurple}, ${viralFxColors.primaryPurpleLight})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Broker Dashboard
              </h1>
              <p style={{
                margin: '8px 0 0 0',
                color: viralFxColors.textSecondary,
                fontSize: '16px'
              }}>
                Manage your brokerage business and track performance
              </p>
            </div>
            {broker && (
              <div style={{
                padding: '12px 20px',
                background: `linear-gradient(135deg, ${viralFxColors.accentGold}, ${viralFxColors.warningOrange})`,
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 500,
                fontSize: '14px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(255, 179, 0, 0.3)'
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>🏆 {broker.tier}</div>
                <div style={{ fontSize: '12px', opacity: 0.9 }}>{broker.companyName}</div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Content */}
        <Card
          style={{
            borderRadius: '12px',
            border: `1px solid ${viralFxColors.borderDefault}`,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            size="large"
            tabBarStyle={{
              marginBottom: '24px',
              borderBottom: `2px solid ${viralFxColors.borderDefault}`,
            }}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default BrokerDashboard;