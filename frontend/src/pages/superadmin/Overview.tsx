import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Typography, Progress, Alert, Timeline, Table, Tag, Space, Button, Select, Spin, Empty, } from 'antd';
import {
  UserOutlined, TeamOutlined, DollarOutlined, CloudOutlined, AlertOutlined, TrophyOutlined, ReloadOutlined, LineChartOutlined, } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';

const {Title, Text} = Typography;
const {Option} = Select;

const Overview: React.FC = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const {admin, checkPermission} = useAdminStore();

  // Fetch dashboard metrics
  const {data: metrics, isLoading, error, refetch, } = useQuery({
    queryKey: ['admin-dashboard', timeframe],
    queryFn: () => adminApi.getDashboardOverview(timeframe),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch system alerts
  const {data: alerts} = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: () => adminApi.getSystemAlerts(),
    refetchInterval: 10000, // Refresh alerts every 10 seconds
  });

  // Fetch recent activity
  const {data: activity} = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminApi.getRecentActivity(),
    refetchInterval: 15000, // Refresh activity every 15 seconds
  });

  // Fetch predictive insights
  const {data: insights} = useQuery({
    queryKey: ['admin-insights'],
    queryFn: () => adminApi.getPredictiveInsights(),
    refetchInterval: 300000, // Refresh insights every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Error loading dashboard"
        description="Failed to load dashboard metrics. Please try again."
        type="error"
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical':
        return '#ff4d4f';
      case 'high':
        return '#fa8c16';
      case 'medium':
        return '#faad14';
      case 'low':
        return '#52c41a';
      default:
        return '#d9d9d9';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">
            SuperAdmin Dashboard
          </Title>
          <Text type="secondary">
            Real-time overview of ViralFX platform operations
          </Text>
        </div>
        <Space>
          <Select
            value={timeframe}
            onChange={setTimeframe}
            style={{ width: 120 }}
          >
            <Option value="1h">Last Hour</Option>
            <Option value="24h">Last 24h</Option>
            <Option value="7d">Last 7 Days</Option>
            <Option value="30d">Last 30 Days</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* System Alerts */}
      {alerts?.alerts && alerts.alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.alerts.slice(0, 3).map((alert: any) => (
            <Alert
              key={alert.id}
              message={alert.title}
              description={alert.message}
              type={alert.severity.toLowerCase() as any}
              showIcon
              closable
              action={
                <Button size="small" type="text">
                  View Details
                </Button>
              }
            />
          ))}
        </div>
      )}

      {/* Overview Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={metrics?.overview?.totalUsers || 0}
              prefix={<UserOutlined />}
              formatter={formatNumber}
              valueStyle={{ color: '#4B0082' }}
            />
            <div className="mt-2">
              <Text type="secondary">
                Active: {formatNumber(metrics?.overview?.activeUsers || 0)}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Brokers"
              value={metrics?.overview?.totalBrokers || 0}
              prefix={<TeamOutlined />}
              formatter={formatNumber}
              valueStyle={{ color: '#FFB300' }}
            />
            <div className="mt-2">
              <Text type="secondary">
                Active: {formatNumber(metrics?.overview?.activeBrokers || 0)}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Market Volume"
              value={metrics?.overview?.marketVolume || 0}
              prefix={<DollarOutlined />}
              formatter={formatCurrency}
              valueStyle={{ color: '#52c41a' }}
            />
            <div className="mt-2">
              <Text type="secondary">
                Revenue: {formatCurrency(metrics?.overview?.paymentRevenue || 0)}
              </Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="System Health"
              value={metrics?.overview?.systemHealth || 0}
              suffix="%"
              prefix={<CloudOutlined />}
              valueStyle={{ color: getHealthColor(metrics?.overview?.systemHealth || 0) }}
            />
            <div className="mt-2">
              <Progress
                percent={metrics?.overview?.systemHealth || 0}
                strokeColor={getHealthColor(metrics?.overview?.systemHealth || 0)}
                showInfo={false}
                size="small"
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Department Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Department Overview" extra={
            <Button type="link" size="small">
              View All
            </Button>
          }>
            <Row gutter={[16, 16]}>
              <Col xs={12}>
                <Card size="small">
                  <Statistic
                    title="User Operations"
                    value={metrics?.departments?.userOps?.pendingTasks || 0}
                    prefix={<UserOutlined />}
                    suffix="tasks"
                    valueStyle={{ fontSize: '18px' }}
                  />
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {metrics?.departments?.userOps?.criticalIssues || 0} critical issues
                    </Text>
                  </div>
                </Card>
              </Col>

              <Col xs={12}>
                <Card size="small">
                  <Statistic
                    title="Broker Operations"
                    value={metrics?.departments?.brokerOps?.pendingApplications || 0}
                    prefix={<TeamOutlined />}
                    suffix="applications"
                    valueStyle={{ fontSize: '18px' }}
                  />
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {metrics?.departments?.brokerOps?.complianceIssues || 0} compliance issues
                    </Text>
                  </div>
                </Card>
              </Col>

              <Col xs={12}>
                <Card size="small">
                  <Statistic
                    title="Trend Operations"
                    value={metrics?.departments?.trendOps?.activeTrends || 0}
                    prefix={<TrophyOutlined />}
                    suffix="trends"
                    valueStyle={{ fontSize: '18px' }}
                  />
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {metrics?.departments?.trendOps?.pendingReviews || 0} pending reviews
                    </Text>
                  </div>
                </Card>
              </Col>

              <Col xs={12}>
                <Card size="small">
                  <Statistic
                    title="Risk Operations"
                    value={metrics?.departments?.riskOps?.highRiskAlerts || 0}
                    prefix={<AlertOutlined />}
                    suffix="alerts"
                    valueStyle={{ fontSize: '18px', color: '#ff4d4f' }}
                  />
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {metrics?.departments?.riskOps?.contentReviews || 0} reviews pending
                    </Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="System Health Indicators" extra={
            <Button type="link" size="small" icon={<LineChartOutlined />}>
              Details
            </Button>
          }>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <Text>Oracle Network</Text>
                  <Text>{metrics?.overview?.oracleHealth || 0}%</Text>
                </div>
                <Progress
                  percent={metrics?.overview?.oracleHealth || 0}
                  strokeColor={getHealthColor(metrics?.overview?.oracleHealth || 0)}
                  size="small"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Text>Node Uptime</Text>
                  <Text>{metrics?.overview?.nodeUptime || 0}%</Text>
                </div>
                <Progress
                  percent={metrics?.overview?.nodeUptime || 0}
                  strokeColor={getHealthColor(metrics?.overview?.nodeUptime || 0)}
                  size="small"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <Text>Risk Score</Text>
                  <Text>{metrics?.overview?.riskScore || 0}/100</Text>
                </div>
                <Progress
                  percent={metrics?.overview?.riskScore || 0}
                  strokeColor={getHealthColor(metrics?.overview?.riskScore || 0)}
                  size="small"
                />
              </div>

              <div>
                <Text className="block mb-2">Recent Alerts</Text>
                <div className="flex space-x-2">
                  <Tag color={getSeverityColor('critical')}>
                    {metrics?.overview?.systemAlerts || 0} Critical
                  </Tag>
                  <Tag color={getSeverityColor('high')}>
                    {metrics?.overview?.abuseDetections || 0} High
                  </Tag>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Predictive Insights */}
      {insights && (
        <Card title="Predictive Insights" extra={
          <Button type="link" size="small">
            Analysis Report
          </Button>
        }>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small" title="Risk Assessment">
                <div className="text-center">
                  <Statistic
                    value={insights.overallRiskAssessment?.score || 0}
                    suffix="/100"
                    valueStyle={{
                      color: getHealthColor(insights.overallRiskAssessment?.score || 0),
                      fontSize: '24px',
                    }}
                  />
                  <Tag
                    color={getHealthColor(insights.overallRiskAssessment?.score || 0)}
                    className="mt-2"
                  >
                    {insights.overallRiskAssessment?.level || 'UNKNOWN'}
                  </Tag>
                  <div className="mt-2">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Trend: {insights.overallRiskAssessment?.trend || 'STABLE'}
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card size="small" title="System Performance">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Text>API Response Time</Text>
                    <Text type="secondary">45ms</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text>Database Load</Text>
                    <Text type="secondary">32%</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text>Memory Usage</Text>
                    <Text type="secondary">67%</Text>
                  </div>
                  <div className="flex justify-between">
                    <Text>CPU Usage</Text>
                    <Text type="secondary">45%</Text>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={8}>
              <Card size="small" title="Active Monitoring">
                <div className="space-y-2">
                  <Tag color="green">System Status: Healthy</Tag>
                  <Tag color="blue">7/7 Nodes Online</Tag>
                  <Tag color="orange">2 Pending Reviews</Tag>
                  <Tag color="red">1 Critical Alert</Tag>
                </div>
              </Card>
            </Col>
          </Row>
        </Card>
      )}

      {/* Recent Activity */}
      {activity && (
        <Card title="Recent Activity" extra={
          <Button type="link" size="small">
            View All Activity
          </Button>
        }>
          {activity.length > 0 ? (
            <Timeline
              items={activity.slice(0, 10).map((item: any) => ({
                color: getSeverityColor(item.severity),
                children: (
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <Text strong>{item.admin}</Text>
                        <Text className="ml-2" type="secondary">
                          {item.action}
                        </Text>
                        {item.target && (
                          <Text className="ml-1" code>
                            {item.target}
                          </Text>
                        )}
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(item.timestamp).toLocaleString()}
                      </Text>
                    </div>
                    {item.description && (
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {item.description}
                      </Text>
                    )}
                  </div>
                ),
              }))}
            />
          ) : (
            <Empty description="No recent activity" />
          )}
        </Card>
      )}
    </div>
  );
};

export default Overview;