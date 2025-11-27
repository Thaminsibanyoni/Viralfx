import React from 'react';
import { Card, Badge, Progress, Space, Typography, Row, Col, Tag, Tooltip, Button, Statistic } from 'antd';
import { motion } from 'framer-motion';
import {
  MailOutlined, PhoneOutlined, BellOutlined, MessageOutlined, GlobalOutlined, ApiOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, ThunderboltOutlined, EyeOutlined, SettingOutlined, ExperimentOutlined, CaretUpOutlined, CaretDownOutlined, } from '@ant-design/icons';

const {Text, Title} = Typography;

export interface ProviderHealthData {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app' | 'webhook';
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE' | 'OFFLINE';
  healthScore: number;
  uptime: number;
  responseTime: number;
  successRate: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  circuitBreaker: {
    status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    threshold: number;
    timeout: number;
  };
  quotas: {
    current: number;
    limit: number;
    resetTime: Date;
  };
  costs: {
    current: number;
    projected: number;
    currency: string;
  };
  region: string;
  priority: number;
  metadata?: Record<string, any>;
}

export interface ProviderHealthCardProps {
  provider: ProviderHealthData;
  compact?: boolean;
  onViewDetails?: (provider: ProviderHealthData) => void;
  onRunTest?: (provider: ProviderHealthData) => void;
  onConfigure?: (provider: ProviderHealthData) => void;
  loading?: boolean;
  className?: string;
}

const ProviderHealthCard: React.FC<ProviderHealthCardProps> = ({
  provider,
  compact = false,
  onViewDetails,
  onRunTest,
  onConfigure,
  loading = false,
  className = '',
}) => {
  const getProviderIcon = (type: string) => {
    const icons = {
      email: <MailOutlined />,
      sms: <PhoneOutlined />,
      push: <BellOutlined />,
      in_app: <MessageOutlined />,
      webhook: <GlobalOutlined />,
    };
    return icons[type as keyof typeof icons] || <ApiOutlined />;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      HEALTHY: 'success',
      DEGRADED: 'warning',
      UNHEALTHY: 'error',
      MAINTENANCE: 'processing',
      OFFLINE: 'default',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return '#52c41a';
    if (score >= 70) return '#faad14';
    if (score >= 50) return '#fa8c16';
    return '#ff4d4f';
  };

  const getCircuitBreakerColor = (status: string) => {
    const colors = {
      CLOSED: 'green',
      HALF_OPEN: 'orange',
      OPEN: 'red',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const _formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatThroughput = (rate: number) => {
    if (rate >= 1000) return `${(rate / 1000).toFixed(1)}k`;
    return rate.toString();
  };

  const getQuotaPercentage = () => {
    return (provider.quotas.current / provider.quotas.limit) * 100;
  };

  const getTimeSinceLastCheck = () => {
    const now = new Date();
    const diff = now.getTime() - provider.lastCheck.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const cardActions = compact ? [] : [
    <Tooltip title="View Details" key="view">
      <Button
        type="text"
        icon={<EyeOutlined />}
        onClick={() => onViewDetails?.(provider)}
        aria-label={`View details for ${provider.name}`}
      />
    </Tooltip>,
    <Tooltip title="Run Test" key="test">
      <Button
        type="text"
        icon={<ExperimentOutlined />}
        onClick={() => onRunTest?.(provider)}
        aria-label={`Run test for ${provider.name}`}
      />
    </Tooltip>,
    <Tooltip title="Configure" key="configure">
      <Button
        type="text"
        icon={<SettingOutlined />}
        onClick={() => onConfigure?.(provider)}
        aria-label={`Configure ${provider.name}`}
      />
    </Tooltip>,
  ];

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`provider-health-card ${className}`}
        size={compact ? 'small' : 'default'}
        loading={loading}
        actions={cardActions}
        hoverable
        role="article"
        aria-label={`Provider health card for ${provider.name}`}
      >
        {/* Header */}
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Space align="center">
            {getProviderIcon(provider.type)}
            <div style={{ flex: 1 }}>
              <Title level={5} className="mb-0" style={{ margin: 0 }}>
                {provider.name}
              </Title>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {provider.type.toUpperCase()} • {provider.region}
              </Text>
            </div>
            <Badge
              status={getStatusColor(provider.status) as any}
              text={provider.status}
              aria-label={`Provider status: ${provider.status}`}
            />
          </Space>

          {/* Health Score Circle */}
          {!compact && (
            <div style={{ textAlign: 'center', margin: '12px 0' }}>
              <Progress
                type="circle"
                percent={provider.healthScore}
                size={compact ? 60 : 80}
                strokeColor={getHealthScoreColor(provider.healthScore)}
                format={() => `${provider.healthScore}%`}
                aria-label={`Health score: ${provider.healthScore}%`}
              />
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                Health Score
              </Text>
            </div>
          )}

          {/* Key Metrics Grid */}
          <Row gutter={compact ? [8, 8] : [16, 8]}>
            <Col span={12}>
              <Statistic
                title={<Text style={{ fontSize: '12px' }}>Success Rate</Text>}
                value={provider.successRate}
                precision={1}
                suffix="%"
                valueStyle={{
                  fontSize: '16px',
                  color: provider.successRate >= 95 ? '#52c41a' :
                         provider.successRate >= 90 ? '#faad14' : '#ff4d4f'
                }}
                prefix={provider.successRate >= 95 ? <CaretUpOutlined /> : <CaretDownOutlined />}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title={<Text style={{ fontSize: '12px' }}>Response Time</Text>}
                value={provider.responseTime}
                suffix="ms"
                valueStyle={{
                  fontSize: '16px',
                  color: provider.responseTime <= 200 ? '#52c41a' :
                         provider.responseTime <= 500 ? '#faad14' : '#ff4d4f'
                }}
              />
            </Col>
            {!compact && (
              <>
                <Col span={12}>
                  <Statistic
                    title={<Text style={{ fontSize: '12px' }}>Throughput</Text>}
                    value={formatThroughput(provider.throughput)}
                    suffix="/min"
                    valueStyle={{ fontSize: '16px' }}
                    prefix={<ThunderboltOutlined style={{ color: '#1890ff' }} />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={<Text style={{ fontSize: '12px' }}>Uptime</Text>}
                    value={provider.uptime}
                    precision={1}
                    suffix="%"
                    valueStyle={{
                      fontSize: '16px',
                      color: provider.uptime >= 99.5 ? '#52c41a' :
                             provider.uptime >= 99.0 ? '#faad14' : '#ff4d4f'
                    }}
                  />
                </Col>
              </>
            )}
          </Row>

          {/* Status Indicators */}
          <Space wrap size={4}>
            <Tag
              color={getCircuitBreakerColor(provider.circuitBreaker.status)}
              aria-label={`Circuit breaker status: ${provider.circuitBreaker.status}`}
            >
              CB: {provider.circuitBreaker.status}
            </Tag>
            <Tag color="blue" aria-label={`Region: ${provider.region}`}>
              {provider.region}
            </Tag>
            {provider.priority <= 2 && (
              <Tag color="gold" aria-label={`Priority: ${provider.priority}`}>
                P{provider.priority}
              </Tag>
            )}
          </Space>

          {/* Quota Usage */}
          {!compact && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: '12px' }} type="secondary">Quota Usage</Text>
                <Text style={{ fontSize: '12px' }}>
                  {provider.quotas.current.toLocaleString()} / {provider.quotas.limit.toLocaleString()}
                </Text>
              </div>
              <Progress
                percent={getQuotaPercentage()}
                size="small"
                strokeColor={getQuotaPercentage() > 80 ? '#ff4d4f' : '#52c41a'}
                showInfo={false}
                aria-label={`Quota usage: ${getQuotaPercentage().toFixed(1)}%`}
              />
            </div>
          )}

          {/* Last Check Info */}
          <Text type="secondary" style={{ fontSize: '11px' }}>
            <ClockCircleOutlined /> Last check: {getTimeSinceLastCheck()}
          </Text>
        </Space>
      </Card>
    </motion.div>
  );
};

export default ProviderHealthCard;