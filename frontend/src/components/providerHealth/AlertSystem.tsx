import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, List, Badge, Button, Space, Typography, Tag, Tooltip, Dropdown, Menu, Modal, Form, Input, Select, Switch, InputNumber, Alert as AntAlert, Pagination, Empty, Drawer, Descriptions, Timeline, Statistic, Row, Col, Tabs, Progress, Avatar, } from 'antd';
import {
  BellOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined, CloseCircleOutlined, CheckCircleOutlined, DeleteOutlined, SettingOutlined, EyeOutlined, FilterOutlined, MoreOutlined, NotificationOutlined, SoundOutlined, MailOutlined, MessageOutlined, ApiOutlined, ClockCircleOutlined, FireOutlined, ThunderboltOutlined, } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;
const {TextArea} = Input;

export enum AlertSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  SUPPRESSED = 'SUPPRESSED',
}

export enum AlertType {
  PROVIDER_DOWN = 'PROVIDER_DOWN',
  HIGH_LATENCY = 'HIGH_LATENCY',
  LOW_SUCCESS_RATE = 'LOW_SUCCESS_RATE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  CIRCUIT_BREAKER_OPEN = 'CIRCUIT_BREAKER_OPEN',
  SLA_VIOLATION = 'SLA_VIOLATION',
  COST_ANOMALY = 'COST_ANOMALY',
  HEALTH_CHECK_FAILED = 'HEALTH_CHECK_FAILED',
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  type: AlertType;
  source: string;
  providerId?: string;
  providerName?: string;
  timestamp: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
  metadata: Record<string, any>;
  tags: string[];
  assignee?: string;
  escalationLevel: number;
  autoResolveTimeout?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  severity: AlertSeverity;
  enabled: boolean;
  conditions: {
    metric: string;
    operator: string;
    threshold: number;
    duration: number;
  }[];
  actions: {
    type: 'email' | 'slack' | 'webhook' | 'pagerduty';
    config: Record<string, any>;
  }[];
  cooldownPeriod: number;
  suppressionRules: string[];
  tags: string[];
}

export interface AlertSettings {
  notifications: {
    email: boolean;
    slack: boolean;
    push: boolean;
    sound: boolean;
    desktop: boolean;
  };
  thresholds: {
    latency: number;
    errorRate: number;
    successRate: number;
    quotaUsage: number;
  };
  autoResolution: {
    enabled: boolean;
    timeout: number;
  };
  escalation: {
    enabled: boolean;
    levels: {
      level: number;
      timeout: number;
      actions: string[];
    }[];
  };
}

export interface AlertSystemProps {
  alerts: Alert[];
  rules: AlertRule[];
  settings: AlertSettings;
  loading?: boolean;
  onAcknowledge?: (alertId: string) => Promise<void>;
  onResolve?: (alertId: string, resolution?: string) => Promise<void>;
  onSuppress?: (alertId: string, duration: number) => Promise<void>;
  onDelete?: (alertId: string) => Promise<void>;
  onSettingsUpdate?: (settings: AlertSettings) => Promise<void>;
  onRuleUpdate?: (rule: AlertRule) => Promise<void>;
  onTestAlert?: (type: AlertType) => Promise<void>;
  className?: string;
  maxVisible?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const AlertSystem: React.FC<AlertSystemProps> = ({
  alerts,
  rules,
  settings,
  loading = false,
  onAcknowledge,
  onResolve,
  onSuppress,
  onDelete,
  onSettingsUpdate,
  onRuleUpdate,
  onTestAlert,
  className = '',
  maxVisible = 10,
  autoRefresh = true,
  refreshInterval = 30000,
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [filters, setFilters] = useState({
    severity: [] as AlertSeverity[],
    type: [] as AlertType[],
    source: [] as string[],
    tags: [] as string[],
  });
  const [settingsForm] = Form.useForm();
  const [currentPage, setCurrentPage] = useState(1);
  const [showResolved, setShowVisible] = useState(false);

  const getSeverityColor = (severity: AlertSeverity) => {
    const colors = {
      [AlertSeverity.LOW]: '#1890ff',
      [AlertSeverity.MEDIUM]: '#faad14',
      [AlertSeverity.HIGH]: '#ff7a45',
      [AlertSeverity.CRITICAL]: '#ff4d4f',
    };
    return colors[severity];
  };

  const getStatusColor = (status: AlertStatus) => {
    const colors = {
      [AlertStatus.ACTIVE]: '#ff4d4f',
      [AlertStatus.ACKNOWLEDGED]: '#faad14',
      [AlertStatus.RESOLVED]: '#52c41a',
      [AlertStatus.SUPPRESSED]: '#d9d9d9',
    };
    return colors[status];
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    const icons = {
      [AlertSeverity.LOW]: <InfoCircleOutlined />,
      [AlertSeverity.MEDIUM]: <WarningOutlined />,
      [AlertSeverity.HIGH]: <ExclamationCircleOutlined />,
      [AlertSeverity.CRITICAL]: <FireOutlined />,
    };
    return icons[severity];
  };

  const _getTypeIcon = (type: AlertType) => {
    const icons = {
      [AlertType.PROVIDER_DOWN]: <CloseCircleOutlined />,
      [AlertType.HIGH_LATENCY]: <ClockCircleOutlined />,
      [AlertType.LOW_SUCCESS_RATE]: <ThunderboltOutlined />,
      [AlertType.QUOTA_EXCEEDED]: <WarningOutlined />,
      [AlertType.CIRCUIT_BREAKER_OPEN]: <CloseCircleOutlined />,
      [AlertType.SLA_VIOLATION]: <WarningOutlined />,
      [AlertType.COST_ANOMALY]: <ExclamationCircleOutlined />,
      [AlertType.HEALTH_CHECK_FAILED]: <CloseCircleOutlined />,
    };
    return icons[type] || <InfoCircleOutlined />;
  };

  const getTimeSince = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  // Filter alerts based on current filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      const matchesSeverity = filters.severity.length === 0 || filters.severity.includes(alert.severity);
      const matchesType = filters.type.length === 0 || filters.type.includes(alert.type);
      const matchesSource = filters.source.length === 0 || filters.source.includes(alert.source);
      const matchesTags = filters.tags.length === 0 || filters.tags.some(tag => alert.tags.includes(tag));
      const matchesStatus = activeTab === 'all' ||
        (activeTab === 'active' && alert.status === AlertStatus.ACTIVE) ||
        (activeTab === 'acknowledged' && alert.status === AlertStatus.ACKNOWLEDGED) ||
        (activeTab === 'resolved' && alert.status === AlertStatus.RESOLVED);

      return matchesSeverity && matchesType && matchesSource && matchesTags && matchesStatus;
    });
  }, [alerts, filters, activeTab]);

  // Pagination
  const paginatedAlerts = useMemo(() => {
    const startIndex = (currentPage - 1) * maxVisible;
    return filteredAlerts.slice(startIndex, startIndex + maxVisible);
  }, [filteredAlerts, currentPage, maxVisible]);

  // Statistics
  const statistics = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter(a => a.status === AlertStatus.ACTIVE).length;
    const critical = alerts.filter(a => a.severity === AlertSeverity.CRITICAL && a.status === AlertStatus.ACTIVE).length;
    const acknowledged = alerts.filter(a => a.status === AlertStatus.ACKNOWLEDGED).length;

    const bySeverity = {
      [AlertSeverity.LOW]: alerts.filter(a => a.severity === AlertSeverity.LOW).length,
      [AlertSeverity.MEDIUM]: alerts.filter(a => a.severity === AlertSeverity.MEDIUM).length,
      [AlertSeverity.HIGH]: alerts.filter(a => a.severity === AlertSeverity.HIGH).length,
      [AlertSeverity.CRITICAL]: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
    };

    return { total, active, critical, acknowledged, bySeverity };
  }, [alerts]);

  // Alert action handlers
  const handleAcknowledge = async (alertId: string) => {
    try {
      await onAcknowledge?.(alertId);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    Modal.confirm({
      title: 'Resolve Alert',
      content: 'Add any resolution notes:',
      okText: 'Resolve',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await onResolve?.(alertId);
        } catch (error) {
          console.error('Failed to resolve alert:', error);
        }
      },
    });
  };

  const handleSuppress = async (alertId: string) => {
    Modal.confirm({
      title: 'Suppress Alert',
      content: (
        <div>
          <p>How long should this alert be suppressed?</p>
          <InputNumber min={5} max={1440} defaultValue={60} addonAfter="minutes" />
        </div>
      ),
      onOk: async (close) => {
        // In a real implementation, you'd get the duration from the input
        try {
          await onSuppress?.(alertId, 60);
          close();
        } catch (error) {
          console.error('Failed to suppress alert:', error);
        }
      },
    });
  };

  const handleDelete = async (alertId: string) => {
    Modal.confirm({
      title: 'Delete Alert',
      content: 'Are you sure you want to delete this alert? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await onDelete?.(alertId);
        } catch (error) {
          console.error('Failed to delete alert:', error);
        }
      },
    });
  };

  const handleViewDetails = (alert: Alert) => {
    setSelectedAlert(alert);
    setDetailsDrawerVisible(true);
  };

  const handleSettingsSave = async () => {
    try {
      const values = await settingsForm.validateFields();
      await onSettingsUpdate?.(values);
      setSettingsModalVisible(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Render alert item
  const renderAlertItem = (alert: Alert) => (
    <motion.div
      key={alert.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <List.Item
        className={`alert-item alert-${alert.severity.toLowerCase()}`}
        style={{
          borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
          backgroundColor: alert.status === AlertStatus.RESOLVED ? '#f5f5f5' : 'white',
        }}
        actions={[
          alert.status === AlertStatus.ACTIVE && (
            <Tooltip title="Acknowledge" key="acknowledge">
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleAcknowledge(alert.id)}
              />
            </Tooltip>
          ),
          alert.status !== AlertStatus.RESOLVED && (
            <Tooltip title="Resolve" key="resolve">
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleResolve(alert.id)}
              />
            </Tooltip>
          ),
          alert.status === AlertStatus.ACTIVE && (
            <Tooltip title="Suppress" key="suppress">
              <Button
                type="text"
                size="small"
                icon={<NotificationOutlined />}
                onClick={() => handleSuppress(alert.id)}
              />
            </Tooltip>
          ),
          <Tooltip title="View Details" key="details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(alert)}
            />
          </Tooltip>,
          <Dropdown
            key="more"
            overlay={
              <Menu>
                <Menu.Item key="test" onClick={() => onTestAlert?.(alert.type)}>
                  Test Similar Alert
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item key="delete" danger onClick={() => handleDelete(alert.id)}>
                  Delete
                </Menu.Item>
              </Menu>
            }
          >
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>,
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Avatar
              style={{ backgroundColor: getSeverityColor(alert.severity) }}
              icon={getSeverityIcon(alert.severity)}
            />
          }
          title={
            <Space>
              <Text strong>{alert.title}</Text>
              <Tag color={getSeverityColor(alert.severity)}>
                {alert.severity}
              </Tag>
              <Tag color={getStatusColor(alert.status)}>
                {alert.status}
              </Tag>
            </Space>
          }
          description={
            <Space direction="vertical" size={0}>
              <Text>{alert.message}</Text>
              <Space wrap>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {alert.source}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {alert.providerName && `• ${alert.providerName}`}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  • {getTimeSince(alert.timestamp)}
                </Text>
              </Space>
              {alert.tags.length > 0 && (
                <Space wrap size={4}>
                  {alert.tags.slice(0, 3).map(tag => (
                    <Tag key={tag} size="small">{tag}</Tag>
                  ))}
                  {alert.tags.length > 3 && (
                    <Tag size="small">+{alert.tags.length - 3}</Tag>
                  )}
                </Space>
              )}
            </Space>
          }
        />
      </List.Item>
    </motion.div>
  );

  return (
    <div className={`alert-system ${className}`}>
      {/* Statistics Header */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Active Alerts"
              value={statistics.active}
              valueStyle={{ color: statistics.active > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={<BellOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Critical"
              value={statistics.critical}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Acknowledged"
              value={statistics.acknowledged}
              valueStyle={{ color: '#faad14' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card size="small">
            <Statistic
              title="Total"
              value={statistics.total}
              prefix={<NotificationOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12}>
            <Space wrap>
              <Select
                mode="multiple"
                placeholder="Severity"
                value={filters.severity}
                onChange={(values) => setFilters(prev => ({ ...prev, severity: values }))}
                style={{ minWidth: 120 }}
                allowClear
              >
                {Object.values(AlertSeverity).map(severity => (
                  <Option key={severity} value={severity}>
                    <Badge color={getSeverityColor(severity)} text={severity} />
                  </Option>
                ))}
              </Select>

              <Select
                mode="multiple"
                placeholder="Type"
                value={filters.type}
                onChange={(values) => setFilters(prev => ({ ...prev, type: values }))}
                style={{ minWidth: 120 }}
                allowClear
              >
                {Object.values(AlertType).map(type => (
                  <Option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </Option>
                ))}
              </Select>

              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilters({ severity: [], type: [], source: [], tags: [] })}
              >
                Clear Filters
              </Button>
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Space style={{ float: 'right' }}>
              <Switch
                checkedChildren="Auto Refresh"
                unCheckedChildren="Manual"
                checked={autoRefresh}
                // onChange={setAutoRefresh}
              />
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsModalVisible(true)}
              >
                Settings
              </Button>
              <Button
                icon={<NotificationOutlined />}
                onClick={() => onTestAlert?.(AlertType.HEALTH_CHECK_FAILED)}
              >
                Test Alert
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Alert List */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={`Active (${statistics.active})`} key="active" />
          <TabPane tab={`Acknowledged (${statistics.acknowledged})`} key="acknowledged" />
          <TabPane tab={`Resolved (${alerts.filter(a => a.status === AlertStatus.RESOLVED).length})`} key="resolved" />
          <TabPane tab={`All (${statistics.total})`} key="all" />
        </Tabs>

        <AnimatePresence>
          {paginatedAlerts.length > 0 ? (
            <>
              <List
                dataSource={paginatedAlerts}
                renderItem={renderAlertItem}
                loading={loading}
              />
              {filteredAlerts.length > maxVisible && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Pagination
                    current={currentPage}
                    total={filteredAlerts.length}
                    pageSize={maxVisible}
                    onChange={setCurrentPage}
                    showSizeChanger={false}
                    showQuickJumper
                    showTotal={(total, range) =>
                      `${range[0]}-${range[1]} of ${total} alerts`
                    }
                  />
                </div>
              )}
            </>
          ) : (
            <Empty
              description="No alerts found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </AnimatePresence>
      </Card>

      {/* Details Drawer */}
      <Drawer
        title="Alert Details"
        placement="right"
        onClose={() => setDetailsDrawerVisible(false)}
        open={detailsDrawerVisible}
        width={600}
      >
        {selectedAlert && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="Title">
              {selectedAlert.title}
            </Descriptions.Item>
            <Descriptions.Item label="Message">
              {selectedAlert.message}
            </Descriptions.Item>
            <Descriptions.Item label="Severity">
              <Tag color={getSeverityColor(selectedAlert.severity)}>
                {selectedAlert.severity}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={getStatusColor(selectedAlert.status)}>
                {selectedAlert.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              {selectedAlert.type.replace('_', ' ')}
            </Descriptions.Item>
            <Descriptions.Item label="Source">
              {selectedAlert.source}
            </Descriptions.Item>
            {selectedAlert.providerName && (
              <Descriptions.Item label="Provider">
                {selectedAlert.providerName}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Timestamp">
              {selectedAlert.timestamp.toLocaleString()}
            </Descriptions.Item>
            {selectedAlert.acknowledgedAt && (
              <Descriptions.Item label="Acknowledged At">
                {selectedAlert.acknowledgedAt.toLocaleString()}
              </Descriptions.Item>
            )}
            {selectedAlert.resolvedAt && (
              <Descriptions.Item label="Resolved At">
                {selectedAlert.resolvedAt.toLocaleString()}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Escalation Level">
              <Progress
                percent={(selectedAlert.escalationLevel / 5) * 100}
                showInfo={false}
                strokeColor="#ff4d4f"
              />
              <Text>Level {selectedAlert.escalationLevel}</Text>
            </Descriptions.Item>
            {selectedAlert.tags.length > 0 && (
              <Descriptions.Item label="Tags">
                <Space wrap>
                  {selectedAlert.tags.map(tag => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            )}
            {Object.keys(selectedAlert.metadata).length > 0 && (
              <Descriptions.Item label="Metadata">
                <pre style={{ fontSize: '12px' }}>
                  {JSON.stringify(selectedAlert.metadata, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>

      {/* Settings Modal */}
      <Modal
        title="Alert Settings"
        open={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        onOk={handleSettingsSave}
        width={800}
      >
        <Form form={settingsForm} layout="vertical" initialValues={settings}>
          <Tabs defaultActiveKey="notifications">
            <TabPane tab="Notifications" key="notifications">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Email Notifications" name={['notifications', 'email']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Slack Notifications" name={['notifications', 'slack']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Push Notifications" name={['notifications', 'push']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Sound Alerts" name={['notifications', 'sound']} valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="Thresholds" key="thresholds">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Latency Threshold (ms)" name={['thresholds', 'latency']}>
                    <InputNumber min={100} max={10000} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Error Rate Threshold (%)" name={['thresholds', 'errorRate']}>
                    <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Success Rate Threshold (%)" name={['thresholds', 'successRate']}>
                    <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Quota Usage Threshold (%)" name={['thresholds', 'quotaUsage']}>
                    <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="Auto Resolution" key="autoResolution">
              <Form.Item label="Enable Auto Resolution" name={['autoResolution', 'enabled']} valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Auto Resolve Timeout (minutes)" name={['autoResolution', 'timeout']}>
                <InputNumber min={5} max={1440} style={{ width: '100%' }} />
              </Form.Item>
            </TabPane>
          </Tabs>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertSystem;