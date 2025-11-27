import React, { useState, useMemo } from 'react';
import {
  Card, Progress, Space, Typography, Row, Col, Tag, Tooltip, Alert, Button, Statistic, Timeline, Badge, List, Popover, Tabs, } from 'antd';
import {
  SafetyOutlined, WarningOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, RiseOutlined, FallOutlined, InfoCircleOutlined, BellOutlined, SettingOutlined, EyeOutlined, } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;

export interface SLAAlert {
  id: string;
  type: 'UPTIME' | 'RESPONSE_TIME' | 'SUCCESS_RATE' | 'COST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  resolved: boolean;
  providerId: string;
  providerName: string;
}

export interface MonthlyDowntime {
  allowed: number; // seconds
  used: number; // seconds
  remaining: number; // seconds
}

export interface SLATarget {
  uptime: number; // percentage
  responseTime: number; // milliseconds
  successRate: number; // percentage
}

export interface SLAActual {
  uptime: number; // percentage
  responseTime: number; // milliseconds
  successRate: number; // percentage
}

export interface SLACompliance {
  uptime: number; // percentage of target met
  responseTime: number; // percentage of target met
  successRate: number; // percentage of target met
  overall: number; // overall compliance percentage
}

export interface SLAData {
  providerId: string;
  providerName: string;
  target: SLATarget;
  actual: SLAActual;
  compliance: SLACompliance;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  monthlyDowntime: MonthlyDowntime;
  period: string;
  alerts: SLAAlert[];
}

export interface SLAMonitorProps {
  slaData: SLAData[];
  loading?: boolean;
  onViewDetails?: (sla: SLAData) => void;
  onConfigureAlerts?: (sla: SLAData) => void;
  className?: string;
  showChart?: boolean;
  showTimeline?: boolean;
  timeRange?: 'day' | 'week' | 'month';
}

const SLAMonitor: React.FC<SLAMonitorProps> = ({
  slaData,
  loading = false,
  onViewDetails,
  onConfigureAlerts,
  className = '',
  showChart = true,
  showTimeline = true,
  timeRange = 'month',
}) => {
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');

  const getRiskLevelColor = (level: string) => {
    const colors = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
      CRITICAL: 'purple',
    };
    return colors[level as keyof typeof colors] || 'default';
  };

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 100) return '#52c41a';
    if (percentage >= 90) return '#faad14';
    if (percentage >= 80) return '#fa8c16';
    return '#ff4d4f';
  };

  const getSeverityIcon = (severity: string) => {
    const icons = {
      LOW: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
      MEDIUM: <WarningOutlined style={{ color: '#faad14' }} />,
      HIGH: <ExclamationCircleOutlined style={{ color: '#ff7a45' }} />,
      CRITICAL: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
    };
    return icons[severity as keyof typeof icons] || <InfoCircleOutlined />;
  };

  const formatDowntime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getAlertTypeIcon = (type: string) => {
    const icons = {
      UPTIME: <ClockCircleOutlined />,
      RESPONSE_TIME: <RiseOutlined />,
      SUCCESS_RATE: <FallOutlined />,
      COST: <InfoCircleOutlined />,
    };
    return icons[type as keyof typeof icons] || <InfoCircleOutlined />;
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const compliant = slaData.filter(sla => sla.compliance.overall >= 100).length;
    const atRisk = slaData.filter(sla => sla.compliance.overall < 100 && sla.compliance.overall >= 90).length;
    const nonCompliant = slaData.filter(sla => sla.compliance.overall < 90).length;
    const highRisk = slaData.filter(sla => ['HIGH', 'CRITICAL'].includes(sla.riskLevel)).length;
    const activeAlerts = slaData.reduce((acc, sla) => acc + sla.alerts.filter(alert => !alert.resolved).length, 0);

    return {
      total: slaData.length,
      compliant,
      atRisk,
      nonCompliant,
      highRisk,
      activeAlerts,
      averageCompliance: slaData.length > 0
        ? slaData.reduce((acc, sla) => acc + sla.compliance.overall, 0) / slaData.length
        : 0,
    };
  }, [slaData]);

  // Prepare chart data
  const complianceChartData = useMemo(() => {
    return slaData.map(sla => ({
      name: sla.providerName,
      uptime: sla.compliance.uptime,
      responseTime: sla.compliance.responseTime,
      successRate: sla.compliance.successRate,
      overall: sla.compliance.overall,
    }));
  }, [slaData]);

  const riskDistributionData = useMemo(() => {
    const riskCounts = slaData.reduce((acc, sla) => {
      acc[sla.riskLevel] = (acc[sla.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(riskCounts).map(([risk, count]) => ({
      name: risk,
      value: count,
      color: getRiskLevelColor(risk),
    }));
  }, [slaData]);

  // Filter data based on selected risk level
  const filteredSlaData = useMemo(() => {
    if (selectedRiskLevel === 'all') return slaData;
    return slaData.filter(sla => sla.riskLevel === selectedRiskLevel);
  }, [slaData, selectedRiskLevel]);

  // Get recent alerts
  const recentAlerts = useMemo(() => {
    return slaData
      .flatMap(sla => sla.alerts)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);
  }, [slaData]);

  return (
    <div className={`sla-monitor ${className}`}>
      {/* Summary Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="SLA Compliant"
              value={summaryStats.compliant}
              suffix={`/ ${summaryStats.total}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="At Risk"
              value={summaryStats.atRisk}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Non-Compliant"
              value={summaryStats.nonCompliant}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Compliance"
              value={summaryStats.averageCompliance}
              precision={1}
              suffix="%"
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      {showChart && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={16}>
            <Card title="Compliance Overview" loading={loading}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="uptime" fill="#52c41a" name="Uptime %" />
                  <Bar dataKey="responseTime" fill="#1890ff" name="Response Time %" />
                  <Bar dataKey="successRate" fill="#722ed1" name="Success Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={8}>
            <Card title="Risk Distribution" loading={loading}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {riskDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main SLA Data */}
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Title level={4} style={{ margin: 0 }}>SLA Compliance Details</Title>
            <Button
              size="small"
              type={selectedRiskLevel === 'all' ? 'primary' : 'default'}
              onClick={() => setSelectedRiskLevel('all')}
            >
              All ({slaData.length})
            </Button>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(level => (
              <Button
                key={level}
                size="small"
                type={selectedRiskLevel === level ? 'primary' : 'default'}
                onClick={() => setSelectedRiskLevel(level)}
              >
                {level} ({slaData.filter(sla => sla.riskLevel === level).length})
              </Button>
            ))}
          </Space>
        </div>

        <Row gutter={[16, 16]}>
          {filteredSlaData.map(sla => (
            <Col xs={24} sm={12} md={8} lg={6} key={sla.providerId}>
              <Card
                size="small"
                className={`sla-card ${sla.compliance.overall < 100 ? 'border-red-200' : 'border-green-200'}`}
                actions={[
                  <Tooltip title="View Details" key="view">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => onViewDetails?.(sla)}
                    />
                  </Tooltip>,
                  <Tooltip title="Configure Alerts" key="configure">
                    <Button
                      type="text"
                      icon={<SettingOutlined />}
                      onClick={() => onConfigureAlerts?.(sla)}
                    />
                  </Tooltip>,
                ]}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space align="center">
                    <Title level={5} style={{ margin: 0 }}>{sla.providerName}</Title>
                    <Tag color={getRiskLevelColor(sla.riskLevel)}>
                      {sla.riskLevel}
                    </Tag>
                  </Space>

                  {/* Overall Compliance Circle */}
                  <div style={{ textAlign: 'center', margin: '8px 0' }}>
                    <Progress
                      type="circle"
                      percent={Math.round(sla.compliance.overall)}
                      size={60}
                      strokeColor={getComplianceColor(sla.compliance.overall)}
                      format={() => `${Math.round(sla.compliance.overall)}%`}
                    />
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                      Overall
                    </Text>
                  </div>

                  {/* Individual Metrics */}
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary">Uptime:</Text>
                      <Text style={{ color: getComplianceColor(sla.compliance.uptime) }}>
                        {sla.actual.uptime}% ({sla.compliance.uptime.toFixed(1)}%)
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary">Response:</Text>
                      <Text style={{ color: getComplianceColor(sla.compliance.responseTime) }}>
                        {sla.actual.responseTime}ms ({sla.compliance.responseTime.toFixed(1)}%)
                      </Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary">Success:</Text>
                      <Text style={{ color: getComplianceColor(sla.compliance.successRate) }}>
                        {sla.actual.successRate}% ({sla.compliance.successRate.toFixed(1)}%)
                      </Text>
                    </div>
                  </div>

                  {/* Downtime Allowance */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Downtime Used:</Text>
                      <Text style={{ fontSize: '11px' }}>
                        {formatDowntime(sla.monthlyDowntime.used)} / {formatDowntime(sla.monthlyDowntime.allowed)}
                      </Text>
                    </div>
                    <Progress
                      percent={(sla.monthlyDowntime.used / sla.monthlyDowntime.allowed) * 100}
                      size="small"
                      strokeColor={sla.monthlyDowntime.used / sla.monthlyDowntime.allowed > 0.8 ? '#ff4d4f' : '#52c41a'}
                      showInfo={false}
                    />
                  </div>

                  {/* Alert Count */}
                  {sla.alerts.filter(alert => !alert.resolved).length > 0 && (
                    <Alert
                      message={`${sla.alerts.filter(alert => !alert.resolved).length} active alerts`}
                      type="warning"
                      size="small"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Alerts Timeline */}
      {showTimeline && recentAlerts.length > 0 && (
        <Card title="Recent Alerts" style={{ marginTop: 24 }}>
          <List
            dataSource={recentAlerts}
            renderItem={(alert) => (
              <List.Item>
                <List.Item.Meta
                  avatar={getSeverityIcon(alert.severity)}
                  title={
                    <Space>
                      <Text strong>{alert.providerName}</Text>
                      <Tag color={getRiskLevelColor(alert.severity)}>
                        {alert.severity}
                      </Tag>
                      {getAlertTypeIcon(alert.type)}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text>{alert.message}</Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {alert.timestamp.toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
                {!alert.resolved && (
                  <Button size="small" type="primary">
                    Resolve
                  </Button>
                )}
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default SLAMonitor;