import React, { useState } from 'react';
import {
  Layout, Card, Row, Col, Statistic, Tabs, Table, Button, Space, Tag, Progress, Typography, List, Avatar, Badge, Input, Select, DatePicker, Modal, Form, message, Tooltip, } from 'antd';
import {
  UserOutlined, DollarOutlined, FileTextOutlined, MessageOutlined, CheckCircleOutlined, ExclamationCircleOutlined, PlusOutlined, SearchOutlined, FilterOutlined, BellOutlined, TeamOutlined, RiseOutlined, ClockCircleOutlined, CustomerServiceOutlined, ThunderboltOutlined, SettingOutlined, MoreOutlined, } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dropdown, Menu } from 'antd';
import dayjs from 'dayjs';
import { crmApi } from '../../services/api/crm.api';

const {Header, Content, Sider} = Layout;
const {TabPane} = Tabs;
const {Title, Text} = Typography;
const {RangePicker} = DatePicker;

interface Broker {
  id: string;
  companyName: string;
  tier: string;
  status: string;
  totalTraders: number;
  totalVolume: number;
  lastActive: string;
  complianceStatus: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  priority: string;
  status: string;
  broker?: string;
  createdAt: string;
  assignedTo?: string;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  stage: string;
  expectedCloseDate: string;
  assignedTo?: string;
}

const CRMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch real CRM data using React Query
  const {data: brokersData, isLoading: brokersLoading} = useQuery({
    queryKey: ['dashboard-brokers'],
    queryFn: () => crmApi.getAllBrokerAccounts({ limit: 10 }),
  });

  const {data: ticketsData, isLoading: ticketsLoading} = useQuery({
    queryKey: ['dashboard-tickets'],
    queryFn: () => crmApi.getTickets({ limit: 10 }),
  });

  const {data: dealsData, isLoading: dealsLoading} = useQuery({
    queryKey: ['dashboard-deals'],
    queryFn: () => crmApi.getDeals({ limit: 10 }),
  });

  const {data: analyticsData, isLoading: analyticsLoading} = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => crmApi.getAnalyticsRevenue({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD')
    }),
  });

  const {data: invoicesData, isLoading: invoicesLoading} = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: () => crmApi.getOverdueInvoices({ limit: 10 }),
  });

  // Calculate metrics from real data
  const brokers = brokersData?.data?.data || [];
  const tickets = ticketsData?.data?.data || [];
  const deals = dealsData?.data?.data || [];

  const metrics = {
    totalBrokers: brokersData?.data?.total || 0,
    activeBrokers: brokers.filter(b => b.status === 'ACTIVE').length,
    totalRevenue: analyticsData?.data?.totalRevenue || 0,
    openTickets: tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).length,
    overdueInvoices: invoicesData?.data?.total || 0,
    pipelineValue: deals.reduce((sum, deal) => sum + (Number(deal.value) * deal.probability / 100), 0),
    winRate: deals.length > 0 ? (deals.filter(d => d.stage?.name === 'CLOSED_WON').length / deals.length) * 100 : 0,
    compliancePending: brokers.filter(b => b.complianceStatus === 'PENDING').length,
  };

  const loading = brokersLoading || ticketsLoading || dealsLoading || analyticsLoading || invoicesLoading;

  const _handleNavigateToAdmin = () => {
    navigate('/admin/crm');
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      STARTER: 'default',
      VERIFIED: 'blue',
      PARTNER: 'purple',
      ENTERPRISE: 'gold',
    };
    return colors[tier] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'green',
      INACTIVE: 'default',
      PENDING: 'orange',
      SUSPENDED: 'red',
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'green',
      NORMAL: 'blue',
      HIGH: 'orange',
      URGENT: 'red',
    };
    return colors[priority] || 'default';
  };

  const adminMenuItems = [
    {
      key: 'brokers',
      icon: <TeamOutlined />,
      label: 'Broker Management',
      onClick: () => navigate('/admin/crm/brokers'),
    },
    {
      key: 'billing',
      icon: <DollarOutlined />,
      label: 'Billing & Invoices',
      onClick: () => navigate('/admin/crm/billing'),
    },
    {
      key: 'support',
      icon: <CustomerServiceOutlined />,
      label: 'Support Tickets',
      onClick: () => navigate('/admin/crm/tickets'),
    },
    {
      key: 'pipeline',
      icon: <ThunderboltOutlined />,
      label: 'Sales Pipeline',
      onClick: () => navigate('/admin/crm/deals'),
    },
    {
      key: 'full-crm',
      icon: <SettingOutlined />,
      label: 'Complete CRM',
      onClick: () => navigate('/admin/crm'),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={3} style={{ margin: 0 }}>CRM Dashboard</Title>
        <Space>
          <Dropdown
            overlay={<Menu items={adminMenuItems} />}
            placement="bottomRight"
          >
            <Button type="primary" icon={<SettingOutlined />}>
              Advanced CRM <MoreOutlined />
            </Button>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ margin: '24px 16px', background: '#fff', padding: 24 }}>
        {/* Key Metrics */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Brokers"
                value={metrics.totalBrokers}
                prefix={<TeamOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active Brokers"
                value={metrics.activeBrokers}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#3f8600' }}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Open Tickets"
                value={metrics.openTickets}
                prefix={<MessageOutlined />}
                valueStyle={{ color: '#cf1322' }}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pipeline Value"
                value={metrics.pipelineValue}
                prefix={<RiseOutlined />}
                precision={0}
                valueStyle={{ color: '#1890ff' }}
                formatter={(value) => `$${Number(value).toLocaleString()}`}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Monthly Revenue"
                value={metrics.totalRevenue}
                prefix={<DollarOutlined />}
                precision={0}
                valueStyle={{ color: '#52c41a' }}
                formatter={(value) => `$${Number(value).toLocaleString()}`}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Overdue Invoices"
                value={metrics.overdueInvoices}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Win Rate"
                value={metrics.winRate}
                suffix="%"
                prefix={<RiseOutlined />}
                precision={1}
                valueStyle={{ color: '#52c41a' }}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Compliance Pending"
                value={metrics.compliancePending}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Overview" key="overview">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card title="Recent Brokers" loading={loading}>
                  <List
                    dataSource={brokers.slice(0, 5)}
                    renderItem={(broker) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<UserOutlined />} />}
                          title={broker.broker?.companyName}
                          description={
                            <Space>
                              <Tag color={getTierColor(broker.broker?.tier || '')}>
                                {broker.broker?.tier}
                              </Tag>
                              <Tag color={getStatusColor(broker.status)}>
                                {broker.status}
                              </Tag>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>

              <Col span={8}>
                <Card title="Open Tickets" loading={loading}>
                  <List
                    dataSource={tickets.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status)).slice(0, 5)}
                    renderItem={(ticket) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<MessageOutlined />} />}
                          title={ticket.title}
                          description={
                            <Space>
                              <Tag color={getPriorityColor(ticket.priority)}>
                                {ticket.priority}
                              </Tag>
                              <Text type="secondary">{dayjs(ticket.createdAt).format('MMM DD')}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>

              <Col span={8}>
                <Card title="Active Deals" loading={loading}>
                  <List
                    dataSource={deals.filter(d => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage?.name || '')).slice(0, 5)}
                    renderItem={(deal) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={<Avatar icon={<RiseOutlined />} />}
                          title={deal.title}
                          description={
                            <Space>
                              <Text strong>${Number(deal.value).toLocaleString()}</Text>
                              <Progress percent={deal.probability} size="small" style={{ width: 60 }} />
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="Quick Actions" key="actions">
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Card
                  hoverable
                  onClick={() => navigate('/admin/crm/brokers')}
                  style={{ textAlign: 'center' }}
                >
                  <TeamOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                  <Title level={4}>Manage Brokers</Title>
                  <Text type="secondary">Create and manage broker accounts</Text>
                </Card>
              </Col>

              <Col span={6}>
                <Card
                  hoverable
                  onClick={() => navigate('/admin/crm/billing')}
                  style={{ textAlign: 'center' }}
                >
                  <DollarOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                  <Title level={4}>Billing & Invoices</Title>
                  <Text type="secondary">Generate invoices and track payments</Text>
                </Card>
              </Col>

              <Col span={6}>
                <Card
                  hoverable
                  onClick={() => navigate('/admin/crm/tickets')}
                  style={{ textAlign: 'center' }}
                >
                  <MessageOutlined style={{ fontSize: 48, color: '#fa8c16', marginBottom: 16 }} />
                  <Title level={4}>Support Tickets</Title>
                  <Text type="secondary">Handle customer support requests</Text>
                </Card>
              </Col>

              <Col span={6}>
                <Card
                  hoverable
                  onClick={() => navigate('/admin/crm/deals')}
                  style={{ textAlign: 'center' }}
                >
                  <ThunderboltOutlined style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }} />
                  <Title level={4}>Sales Pipeline</Title>
                  <Text type="secondary">Manage deals and opportunities</Text>
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Content>
    </Layout>
  );
};

export default CRMDashboard;