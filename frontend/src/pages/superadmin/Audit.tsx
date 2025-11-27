import React, { useState } from 'react';
import {
  
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Empty, Spin, DatePicker, Collapse, } from 'antd';
import {
  AuditOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, DownloadOutlined, EyeOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, UserOutlined, SecurityScanOutlined, SettingOutlined, LockOutlined, UnlockOutlined, FileTextOutlined, GlobalOutlined, ClockCircleOutlined, BarChartOutlined, CalendarOutlined, TeamOutlined, DatabaseOutlined, ThunderboltOutlined, SafetyOutlined, HistoryOutlined, BugOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { AdminAuditLog, AuditAction, AuditSeverity } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;
const {Panel} = Collapse;

interface AuditLogFilters {
  page: number;
  limit: number;
  action?: string;
  adminId?: string;
  targetType?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

const Audit: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const _queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('logs');
  const [auditFilters, setAuditFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);
  const [logModalVisible, setLogModalVisible] = useState<boolean>(false);
  const [statisticsModalVisible, setStatisticsModalVisible] = useState<boolean>(false);
  const [exportModalVisible, setExportModalVisible] = useState<boolean>(false);

  // Permissions
  const canViewAudit = checkPermission('audit:view');
  const canExportAudit = checkPermission('audit:export');
  const canViewStatistics = checkPermission('audit:statistics');

  // Data fetching
  const {data: auditLogsData, isLoading: logsLoading, refetch: refetchLogs, } = useQuery(
    ['audit-logs', auditFilters],
    () => adminApi.getAuditLogs(auditFilters),
    {
      enabled: canViewAudit,
      keepPreviousData: true,
    }
  );

  const {data: auditStats, isLoading: statsLoading, refetch: refetchStats, } = useQuery(
    'audit-statistics',
    () => adminApi.getAuditStatistics(),
    {
      enabled: canViewStatistics,
    }
  );

  // Event handlers
  const handleAuditFilterChange = (key: string, value: any) => {
    setAuditFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewLog = (log: AdminAuditLog) => {
    setSelectedLog(log);
    setLogModalVisible(true);
  };

  const handleExportLogs = (format: 'csv' | 'json' | 'pdf') => {
    // Handle export logic
    const params = new URLSearchParams();
    Object.entries(auditFilters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, String(value));
    });

    const exportUrl = `/api/v1/admin/audit/export?${params.toString()}&format=${format}`;

    // Create download link
    const link = document.createElement('a');
    link.href = exportUrl;
    link.download = `audit-logs-${moment().format('YYYY-MM-DD')}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    message.success(`Audit logs exported as ${format.toUpperCase()}`);
    setExportModalVisible(false);
  };

  const getActionIcon = (action: AuditAction) => {
    const icons = {
      [AuditAction.LOGIN]: <UnlockOutlined />,
      [AuditAction.LOGOUT]: <LockOutlined />,
      [AuditAction.USER_SUSPEND]: <UserOutlined />,
      [AuditAction.USER_BAN]: <SecurityScanOutlined />,
      [AuditAction.BROKER_APPROVE]: <CheckCircleOutlined />,
      [AuditAction.BROKER_SUSPEND]: <WarningOutlined />,
      [AuditAction.TREND_APPROVE]: <ThunderboltOutlined />,
      [AuditAction.TREND_OVERRIDE]: <SettingOutlined />,
      [AuditAction.NOTIFICATION_SEND]: <FileTextOutlined />,
      [AuditAction.ADMIN_CREATED]: <TeamOutlined />,
      [AuditAction.ADMIN_UPDATED]: <EditOutlined />,
      [AuditAction.ADMIN_DELETED]: <ExclamationCircleOutlined />,
      [AuditAction.PLATFORM_SETTING_CHANGE]: <SettingOutlined />,
    };
    return icons[action] || <AuditOutlined />;
  };

  const _getSeverityColor = (severity: AuditSeverity) => {
    const colors = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
      CRITICAL: 'purple',
    };
    return colors[severity] || 'default';
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    const colors = {
      LOW: 'success',
      MEDIUM: 'warning',
      HIGH: 'error',
      CRITICAL: 'processing',
    };
    return colors[severity] || 'default';
  };

  // Table columns for Audit Logs
  const auditColumns: ColumnType<AdminAuditLog>[] = [
    {
      title: 'Timestamp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
          <Space direction="vertical" size={0}>
            <Text>{moment(date).format('YYYY-MM-DD')}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {moment(date).format('HH:mm:ss')}
            </Text>
          </Space>
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Admin',
      key: 'admin',
      render: (_, record: AdminAuditLog) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Space direction="vertical" size={0}>
            <Text strong>{record.admin?.firstName} {record.admin?.lastName}</Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.admin?.email}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: AuditAction) => (
        <Space>
          {getActionIcon(action)}
          <Text>{action.replace(/_/g, ' ')}</Text>
        </Space>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: AuditSeverity) => (
        <Badge
          status={getSeverityBadge(severity) as any}
          text={severity}
        />
      ),
      filters: Object.values(AuditSeverity).map(severity => ({
        text: severity,
        value: severity,
      })),
      onFilter: (value, record) => record.severity === value,
    },
    {
      title: 'Target',
      key: 'target',
      render: (_, record: AdminAuditLog) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: '12px' }}>
            {record.targetType}
          </Text>
          {record.targetId && (
            <Text type="secondary" style={{ fontSize: '11px' }}>
              ID: {record.targetId.slice(-8)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <Tooltip title={description}>
          <Text ellipsis style={{ maxWidth: 200 }}>{description}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ip: string) => (
        <Text code>{ip}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: AdminAuditLog) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewLog(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!canViewAudit) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Audit Logs page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Mock statistics
  const mockStats = auditStats || {
    totalLogs: 15420,
    criticalLogs: 23,
    highLogs: 156,
    mediumLogs: 1234,
    lowLogs: 14007,
    todayLogs: 342,
    weekLogs: 2156,
    monthLogs: 8765,
    topActions: [
      { action: 'LOGIN', count: 3421 },
      { action: 'LOGOUT', count: 3210 },
      { action: 'USER_SUSPEND', count: 156 },
      { action: 'BROKER_APPROVE', count: 89 },
      { action: 'PLATFORM_SETTING_CHANGE', count: 67 },
    ],
    recentCriticalLogs: [
      {
        id: '1',
        action: 'ADMIN_DELETED',
        severity: 'CRITICAL',
        description: 'Admin user deleted by superadmin',
        createdAt: new Date(),
        admin: { firstName: 'John', lastName: 'Doe' },
      },
    ],
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Audit Logs
            </Title>
            <Text type="secondary">View and analyze system audit trails</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<BarChartOutlined />}
                onClick={() => setStatisticsModalVisible(true)}
                disabled={!canViewStatistics}
              >
                Statistics
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => setExportModalVisible(true)}
                disabled={!canExportAudit}
              >
                Export
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchLogs();
                  refetchStats();
                }}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Logs"
              value={mockStats.totalLogs}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Critical Events"
              value={mockStats.criticalLogs}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Today's Logs"
              value={mockStats.todayLogs}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="This Week"
              value={mockStats.weekLogs}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Severity Distribution */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Critical"
              value={mockStats.criticalLogs}
              valueStyle={{ color: '#722ed1' }}
              prefix={<Badge status="processing" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="High"
              value={mockStats.highLogs}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<Badge status="error" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Medium"
              value={mockStats.mediumLogs}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<Badge status="warning" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Low"
              value={mockStats.lowLogs}
              valueStyle={{ color: '#52c41a' }}
              prefix={<Badge status="success" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4" size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Action"
              value={auditFilters.action}
              onChange={(value) => handleAuditFilterChange('action', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value={AuditAction.LOGIN}>Login</Select.Option>
              <Select.Option value={AuditAction.LOGOUT}>Logout</Select.Option>
              <Select.Option value={AuditAction.USER_SUSPEND}>User Suspend</Select.Option>
              <Select.Option value={AuditAction.USER_BAN}>User Ban</Select.Option>
              <Select.Option value={AuditAction.BROKER_APPROVE}>Broker Approve</Select.Option>
              <Select.Option value={AuditAction.TREND_APPROVE}>Trend Approve</Select.Option>
              <Select.Option value={AuditAction.ADMIN_CREATED}>Admin Created</Select.Option>
              <Select.Option value={AuditAction.PLATFORM_SETTING_CHANGE}>Setting Change</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Severity"
              value={auditFilters.severity}
              onChange={(value) => handleAuditFilterChange('severity', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value={AuditSeverity.LOW}>Low</Select.Option>
              <Select.Option value={AuditSeverity.MEDIUM}>Medium</Select.Option>
              <Select.Option value={AuditSeverity.HIGH}>High</Select.Option>
              <Select.Option value={AuditSeverity.CRITICAL}>Critical</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Target Type"
              value={auditFilters.targetType}
              onChange={(value) => handleAuditFilterChange('targetType', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value="USER">User</Select.Option>
              <Select.Option value="BROKER">Broker</Select.Option>
              <Select.Option value="ADMIN">Admin</Select.Option>
              <Select.Option value="TREND">Trend</Select.Option>
              <Select.Option value="PLATFORM_SETTING">Platform Setting</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => {
                if (dates) {
                  handleAuditFilterChange('startDate', dates[0]?.format('YYYY-MM-DD'));
                  handleAuditFilterChange('endDate', dates[1]?.format('YYYY-MM-DD'));
                } else {
                  handleAuditFilterChange('startDate', undefined);
                  handleAuditFilterChange('endDate', undefined);
                }
              }}
            />
          </Col>
        </Row>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <Table
          columns={auditColumns}
          dataSource={auditLogsData?.data || []}
          loading={logsLoading}
          rowKey="id"
          pagination={{
            current: auditLogsData?.page || 1,
            pageSize: auditFilters.limit,
            total: auditLogsData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} audit logs`,
            onChange: (page, pageSize) => {
              setAuditFilters(prev => ({
                ...prev,
                page,
                limit: pageSize || 20,
              }));
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Log Details Modal */}
      <Modal
        title={
          <Space>
            <AuditOutlined />
            Audit Log Details
          </Space>
        }
        visible={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {selectedLog && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Log ID" span={2}>
              <Text code copyable={{ text: selectedLog.id }}>
                {selectedLog.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Timestamp" span={2}>
              {moment(selectedLog.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Admin User">
              <Space>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text>
                  {selectedLog.admin ?
                    `${selectedLog.admin.firstName} ${selectedLog.admin.lastName}` :
                    'Unknown'
                  }
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Admin Email">
              <Text>{selectedLog.admin?.email || 'N/A'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Action">
              <Space>
                {getActionIcon(selectedLog.action)}
                <Text>{selectedLog.action.replace(/_/g, ' ')}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Severity">
              <Badge
                status={getSeverityBadge(selectedLog.severity) as any}
                text={selectedLog.severity}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Target Type">
              <Text code>{selectedLog.targetType}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Target ID">
              <Text code copyable={{ text: selectedLog.targetId }}>
                {selectedLog.targetId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="IP Address">
              <Text code>{selectedLog.ipAddress}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="User Agent">
              <Text ellipsis style={{ maxWidth: 200 }}>
                {selectedLog.userAgent || 'N/A'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>
              <Paragraph>{selectedLog.description}</Paragraph>
            </Descriptions.Item>
            {selectedLog.metadata && (
              <Descriptions.Item label="Metadata" span={2}>
                <pre style={{
                  fontSize: '12px',
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Statistics Modal */}
      <Modal
        title={
          <Space>
            <BarChartOutlined />
            Audit Statistics
          </Space>
        }
        visible={statisticsModalVisible}
        onCancel={() => setStatisticsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setStatisticsModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        <Row gutter={[16, 16]} className="mb-4">
          <Col span={8}>
            <Card>
              <Statistic
                title="Total Logs"
                value={mockStats.totalLogs}
                prefix={<DatabaseOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="This Month"
                value={mockStats.monthLogs}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Critical/High Ratio"
                value={((mockStats.criticalLogs + mockStats.highLogs) / mockStats.totalLogs * 100).toFixed(2)}
                suffix="%"
                prefix={<WarningOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card title="Top Actions" size="small">
              <List
                dataSource={mockStats.topActions}
                renderItem={(item: any) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Badge count={item.count} />}
                      title={item.action.replace(/_/g, ' ')}
                      description={`${item.count} occurrences`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Recent Critical Events" size="small">
              <Timeline>
                {mockStats.recentCriticalLogs.map((log: any) => (
                  <Timeline.Item
                    key={log.id}
                    color="red"
                    dot={<ExclamationCircleOutlined />}
                  >
                    <Space direction="vertical" size={0}>
                      <Text strong>{log.action.replace(/_/g, ' ')}</Text>
                      <Text type="secondary">{log.description}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {moment(log.createdAt).fromNow()} by {log.admin.firstName} {log.admin.lastName}
                      </Text>
                    </Space>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Col>
        </Row>
      </Modal>

      {/* Export Modal */}
      <Modal
        title={
          <Space>
            <DownloadOutlined />
            Export Audit Logs
          </Space>
        }
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>
            Export audit logs with current filters applied. Date range:
            {auditFilters.startDate && auditFilters.endDate ?
              ` ${auditFilters.startDate} to ${auditFilters.endDate}` :
              ' All time'
            }
          </Text>
          <Divider />
          <Space wrap style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => handleExportLogs('csv')}
            >
              Export as CSV
            </Button>
            <Button
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => handleExportLogs('json')}
            >
              Export as JSON
            </Button>
            <Button
              size="large"
              icon={<DownloadOutlined />}
              onClick={() => handleExportLogs('pdf')}
            >
              Export as PDF
            </Button>
          </Space>
          <Alert
            message="Export Information"
            description="Large datasets may take several minutes to process. You will receive a notification when the export is ready."
            type="info"
            showIcon
          />
        </Space>
      </Modal>
    </div>
  );
};

export default Audit;