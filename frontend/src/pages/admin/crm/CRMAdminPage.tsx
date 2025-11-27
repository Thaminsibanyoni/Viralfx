import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Card, Row, Col, Statistic, Typography, Space, Tabs, Avatar, Progress, Tag, Button, } from 'antd';
import {
  DashboardOutlined, TeamOutlined, DollarOutlined, CustomerServiceOutlined, ThunderboltOutlined, UserOutlined, FileTextOutlined, RiseOutlined, AlertOutlined, CheckCircleOutlined, ClockCircleOutlined, StarOutlined, } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { crmApi } from '../../../services/api/crm.api';
import BrokersPage from './BrokersPage';
import BillingPage from './BillingPage';
import TicketsPage from './TicketsPage';
import DealsPage from './DealsPage';

const {Header, Content, Sider} = Layout;
const {Title} = Typography;

const CRMAdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  // Get active tab from URL path
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('brokers')) return 'brokers';
    if (path.includes('billing')) return 'billing';
    if (path.includes('tickets')) return 'tickets';
    if (path.includes('deals')) return 'deals';
    return 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  // Fetch dashboard statistics
  const {data: dashboardData} = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: async () => {
      const [
        brokersResponse,
        invoicesResponse,
        ticketsResponse,
        dealsResponse,
        analyticsResponse
      ] = await Promise.all([
        crmApi.getAllBrokerAccounts({ limit: 5 }),
        crmApi.getInvoices({ limit: 5 }),
        crmApi.getTickets({ limit: 5 }),
        crmApi.getDeals({ limit: 5 }),
        crmApi.getAnalyticsRevenue({
          startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
          endDate: dayjs().format('YYYY-MM-DD')
        })
      ]);

      return {
        brokers: brokersResponse.data,
        invoices: invoicesResponse.data,
        tickets: ticketsResponse.data,
        deals: dealsResponse.data,
        analytics: analyticsResponse.data
      };
    },
  });

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const newPath = `/admin/crm${key !== 'dashboard' ? `/${key}` : ''}`;
    navigate(newPath);
  };

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'brokers',
      icon: <TeamOutlined />,
      label: 'Brokers',
    },
    {
      key: 'billing',
      icon: <DollarOutlined />,
      label: 'Billing',
    },
    {
      key: 'tickets',
      icon: <CustomerServiceOutlined />,
      label: 'Support',
    },
    {
      key: 'deals',
      icon: <ThunderboltOutlined />,
      label: 'Pipeline',
    },
  ];

  const renderDashboard = () => (
    <div className="p-6">
      <Title level={2}>CRM Dashboard</Title>

      {/* Quick Stats */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Brokers"
              value={dashboardData?.brokers?.total || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Tickets"
              value={dashboardData?.tickets?.data?.filter(t =>
                ['OPEN', 'IN_PROGRESS'].includes(t.status)
              ).length || 0}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pipeline Value"
              value={dashboardData?.deals?.data?.reduce((sum, deal) =>
                sum + (Number(deal.value) * deal.probability / 100), 0
              ) || 0}
              prefix={<RiseOutlined />}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={dashboardData?.analytics?.totalRevenue || 0}
              prefix={<DollarOutlined />}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Recent Brokers" className="h-96">
            {dashboardData?.brokers?.data?.map((broker) => (
              <div key={broker.id} className="flex justify-between items-center py-3 border-b">
                <div className="flex items-center space-x-3">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <div>
                    <div className="font-medium">{broker.broker?.companyName}</div>
                    <div className="text-sm text-gray-500">{broker.broker?.email}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Tag color={broker.status === 'ACTIVE' ? 'green' : 'orange'}>
                    {broker.status}
                  </Tag>
                  <div className="text-xs text-gray-500 mt-1">
                    {dayjs(broker.createdAt).format('MMM DD')}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Open Tickets" className="h-96">
            {dashboardData?.tickets?.data?.filter(t =>
              ['OPEN', 'IN_PROGRESS'].includes(t.status)
            ).map((ticket) => (
              <div key={ticket.id} className="flex justify-between items-center py-3 border-b">
                <div className="flex-1">
                  <div className="font-medium">{ticket.title}</div>
                  <div className="text-sm text-gray-500">
                    {ticket.broker?.broker?.companyName ||
                     `${ticket.user?.firstName} ${ticket.user?.lastName}`}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <Tag color={getPriorityColor(ticket.priority)}>
                    {ticket.priority}
                  </Tag>
                  <div className="text-xs text-gray-500 mt-1">
                    {dayjs(ticket.createdAt).format('MMM DD')}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} className="mt-4">
        <Col span={12}>
          <Card title="Pipeline Deals" className="h-96">
            {dashboardData?.deals?.data?.slice(0, 5).map((deal) => (
              <div key={deal.id} className="flex justify-between items-center py-3 border-b">
                <div className="flex-1">
                  <div className="font-medium">{deal.title}</div>
                  <div className="text-sm text-gray-500">{deal.broker?.broker?.companyName}</div>
                </div>
                <div className="text-right ml-4">
                  <div className="font-medium">${Number(deal.value).toLocaleString()}</div>
                  <Progress
                    percent={deal.probability}
                    size="small"
                    className="mt-1"
                    format={() => `${deal.probability}%`}
                  />
                </div>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Revenue by Tier" className="h-96">
            {Object.entries(dashboardData?.analytics?.revenueByTier || {}).map(([tier, revenue]) => (
              <div key={tier} className="flex justify-between items-center py-3 border-b">
                <div className="flex items-center space-x-2">
                  <Tag color={getTierColor(tier)}>{tier}</Tag>
                </div>
                <div className="font-medium">${Number(revenue).toLocaleString()}</div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'brokers':
        return <BrokersPage />;
      case 'billing':
        return <BillingPage />;
      case 'tickets':
        return <TicketsPage />;
      case 'deals':
        return <DealsPage />;
      default:
        return renderDashboard();
    }
  };

  const _getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'green',
      NORMAL: 'blue',
      HIGH: 'orange',
      URGENT: 'red',
    };
    return colors[priority] || 'default';
  };

  const _getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      STARTER: 'default',
      VERIFIED: 'blue',
      PARTNER: 'purple',
      ENTERPRISE: 'gold',
    };
    return colors[tier] || 'default';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={200}
        style={{
          background: '#fff',
          borderRight: '1px solid #f0f0f0',
        }}
      >
        <div className="p-4 text-center font-bold text-lg">
          {collapsed ? 'CRM' : 'ViralFX CRM'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeTab]}
          items={menuItems}
          onClick={({ key }) => handleTabChange(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Title level={4} style={{ margin: 0 }}>
            {menuItems.find(item => item.key === activeTab)?.label || 'CRM'}
          </Title>
        </Header>
        <Content style={{ background: '#fff' }}>
          {renderContent()}
        </Content>
      </Layout>
    </Layout>
  );
};

export default CRMAdminPage;