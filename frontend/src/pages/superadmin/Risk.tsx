import React, { useState } from 'react';
import {
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, DatePicker, Divider, } from 'antd';
import {
  ExclamationCircleOutlined, WarningOutlined, SecurityScanOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, FileSearchOutlined, BugOutlined, SafetyOutlined, ThunderboltOutlined, ClockCircleOutlined, UserOutlined, GlobalOutlined, FireOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { RiskAlert, HarmfulContent } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;

interface RiskAlertFilters {
  page: number;
  limit: number;
  severity?: string;
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

interface HarmfulContentFilters {
  page: number;
  limit: number;
  type?: string;
  status?: string;
  severity?: string;
  platform?: string;
}

const Risk: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('alerts');
  const [riskFilters, setRiskFilters] = useState<RiskAlertFilters>({
    page: 1,
    limit: 20,
  });
  const [contentFilters, setContentFilters] = useState<HarmfulContentFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedAlert, setSelectedAlert] = useState<RiskAlert | null>(null);
  const [selectedContent, setSelectedContent] = useState<HarmfulContent | null>(null);
  const [alertModalVisible, setAlertModalVisible] = useState<boolean>(false);
  const [contentModalVisible, setContentModalVisible] = useState<boolean>(false);
  const [notesModalVisible, setNotesModalVisible] = useState<boolean>(false);

  // Forms
  const [notesForm] = Form.useForm();

  // Permissions
  const canViewRisk = checkPermission('risk:view');
  const canManageRisk = checkPermission('risk:manage');
  const canReviewContent = checkPermission('risk:content');
  const canExportReports = checkPermission('risk:export');

  // Data fetching
  const {data: riskAlertsData, isLoading: alertsLoading, refetch: refetchAlerts, } = useQuery(
    ['risk-alerts', riskFilters],
    () => adminApi.getRiskAlerts(riskFilters),
    {
      enabled: canViewRisk,
      keepPreviousData: true,
    }
  );

  const {data: harmfulContentData, isLoading: contentLoading, refetch: refetchContent, } = useQuery(
    ['harmful-content', contentFilters],
    () => adminApi.getHarmfulContent(contentFilters),
    {
      enabled: canReviewContent,
      keepPreviousData: true,
    }
  );

  // Mutations
  const blockContentMutation = useMutation(
    ({ contentId, reason }: { contentId: string; reason: string }) =>
      adminApi.blockContent(contentId, reason),
    {
      onSuccess: () => {
        message.success('Content blocked successfully');
        queryClient.invalidateQueries('harmful-content');
        setContentModalVisible(false);
      },
      onError: () => {
        message.error('Failed to block content');
      },
    }
  );

  const approveContentMutation = useMutation(
    (contentId: string) => adminApi.approveContent(contentId),
    {
      onSuccess: () => {
        message.success('Content approved successfully');
        queryClient.invalidateQueries('harmful-content');
        setContentModalVisible(false);
      },
      onError: () => {
        message.error('Failed to approve content');
      },
    }
  );

  // Event handlers
  const handleRiskFilterChange = (key: string, value: any) => {
    setRiskFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleContentFilterChange = (key: string, value: any) => {
    setContentFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewAlert = (alert: RiskAlert) => {
    setSelectedAlert(alert);
    setAlertModalVisible(true);
  };

  const handleViewContent = (content: HarmfulContent) => {
    setSelectedContent(content);
    setContentModalVisible(true);
  };

  const handleBlockContent = (reason: string) => {
    if (selectedContent) {
      blockContentMutation.mutate({
        contentId: selectedContent.id,
        reason,
      });
    }
  };

  const handleApproveContent = () => {
    if (selectedContent) {
      approveContentMutation.mutate(selectedContent.id);
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
      CRITICAL: 'purple',
    };
    return colors[severity as keyof typeof colors] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      OPEN: 'red',
      INVESTIGATING: 'orange',
      RESOLVED: 'green',
      FLAGGED: 'orange',
      PENDING_REVIEW: 'blue',
      APPROVED: 'green',
      BLOCKED: 'red',
      FALSE_POSITIVE: 'gray',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Table columns for Risk Alerts
  const alertColumns: ColumnsType<RiskAlert>[] = [
    {
      title: 'Alert ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Text code copyable={{ text: id }}>
          {id.slice(-8)}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag icon={<BugOutlined />} color="blue">{type}</Tag>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => (
        <Tooltip title={title}>
          <Text ellipsis style={{ maxWidth: 200 }}>{title}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Badge
          status={getSeverityColor(severity) as any}
          text={severity}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status.replace('_', ' ')}
        />
      ),
    },
    {
      title: 'Target',
      key: 'target',
      render: (_, record: RiskAlert) => (
        <Space direction="vertical" size={0}>
          {record.userId && (
            <Space>
              <UserOutlined />
              <Text>User: {record.userId.slice(-8)}</Text>
            </Space>
          )}
          {record.contentId && (
            <Space>
              <FileSearchOutlined />
              <Text>Content: {record.contentId.slice(-8)}</Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => moment(date).fromNow(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: RiskAlert) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewAlert(record)}
            />
          </Tooltip>
          {canManageRisk && record.status === 'OPEN' && (
            <Tooltip title="Start Investigation">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => {/* Handle investigation */}}
              />
            </Tooltip>
          )}
          {canManageRisk && record.status === 'INVESTIGATING' && (
            <Tooltip title="Resolve Alert">
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => {/* Handle resolve */}}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Table columns for Harmful Content
  const contentColumns: ColumnsType<HarmfulContent>[] = [
    {
      title: 'Content ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Text code copyable={{ text: id }}>
          {id.slice(-8)}
        </Text>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeIcons = {
          FAKE_NEWS: <WarningOutlined />,
          VIOLENCE: <ExclamationCircleOutlined />,
          HATE_SPEECH: <FireOutlined />,
          MISINFORMATION: <BugOutlined />,
          SPAM: <FileSearchOutlined />,
        };
        return (
          <Tag icon={typeIcons[type as keyof typeof typeIcons]} color="volcano">
            {type.replace('_', ' ')}
          </Tag>
        );
      },
    },
    {
      title: 'Content',
      dataIndex: 'content',
      key: 'content',
      render: (content: string) => (
        <Tooltip title={content}>
          <Text ellipsis style={{ maxWidth: 250 }}>
            {content.length > 100 ? `${content.slice(0, 100)}...` : content}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Platform',
      dataIndex: 'platform',
      key: 'platform',
      render: (platform: string) => <Tag color="blue">{platform}</Tag>,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (severity: string) => (
        <Badge
          status={getSeverityColor(severity) as any}
          text={severity}
        />
      ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress
          percent={confidence}
          size="small"
          status={confidence > 80 ? 'success' : confidence > 50 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status.replace('_', ' ')}
        />
      ),
    },
    {
      title: 'Reporter',
      dataIndex: 'reporter',
      key: 'reporter',
      render: (reporter: string) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <Text>{reporter || 'System'}</Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: HarmfulContent) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewContent(record)}
            />
          </Tooltip>
          {canReviewContent && record.status === 'PENDING_REVIEW' && (
            <>
              <Tooltip title="Approve Content">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleApproveContent()}
                  loading={approveContentMutation.isLoading}
                />
              </Tooltip>
              <Tooltip title="Block Content">
                <Popconfirm
                  title="Block Content"
                  description="Are you sure you want to block this content?"
                  onConfirm={() => handleBlockContent('Harmful content detected')}
                  okText="Block"
                  cancelText="Cancel"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={blockContentMutation.isLoading}
                  />
                </Popconfirm>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (!canViewRisk) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Risk Management page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Risk Management
            </Title>
            <Text type="secondary">Monitor and manage platform security risks</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (activeTab === 'alerts') {
                    refetchAlerts();
                  } else {
                    refetchContent();
                  }
                }}
              >
                Refresh
              </Button>
              {canExportReports && (
                <Button type="primary" icon={<PlusOutlined />}>
                  Export Report
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Open Alerts"
              value={riskAlertsData?.data?.filter((a: RiskAlert) => a.status === 'OPEN').length || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Under Investigation"
              value={riskAlertsData?.data?.filter((a: RiskAlert) => a.status === 'INVESTIGATING').length || 0}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Content Pending Review"
              value={harmfulContentData?.data?.filter((c: HarmfulContent) => c.status === 'PENDING_REVIEW').length || 0}
              prefix={<FileSearchOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Resolved Today"
              value={riskAlertsData?.data?.filter((a: RiskAlert) =>
                a.status === 'RESOLVED' &&
                moment(a.createdAt).isSame(moment(), 'day')
              ).length || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <SecurityScanOutlined />
                Risk Alerts
              </span>
            }
            key="alerts"
          >
            {/* Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Severity"
                    value={riskFilters.severity}
                    onChange={(value) => handleRiskFilterChange('severity', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="LOW">Low</Select.Option>
                    <Select.Option value="MEDIUM">Medium</Select.Option>
                    <Select.Option value="HIGH">High</Select.Option>
                    <Select.Option value="CRITICAL">Critical</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={riskFilters.status}
                    onChange={(value) => handleRiskFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="OPEN">Open</Select.Option>
                    <Select.Option value="INVESTIGATING">Investigating</Select.Option>
                    <Select.Option value="RESOLVED">Resolved</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Type"
                    value={riskFilters.type}
                    onChange={(value) => handleRiskFilterChange('type', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</Select.Option>
                    <Select.Option value="FRAUD_DETECTION">Fraud Detection</Select.Option>
                    <Select.Option value="ACCOUNT_TAKEOVER">Account Takeover</Select.Option>
                    <Select.Option value="MARKET_MANIPULATION">Market Manipulation</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={(dates) => {
                      if (dates) {
                        handleRiskFilterChange('startDate', dates[0]?.format('YYYY-MM-DD'));
                        handleRiskFilterChange('endDate', dates[1]?.format('YYYY-MM-DD'));
                      } else {
                        handleRiskFilterChange('startDate', undefined);
                        handleRiskFilterChange('endDate', undefined);
                      }
                    }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Alerts Table */}
            <Table
              columns={alertColumns}
              dataSource={riskAlertsData?.data || []}
              loading={alertsLoading}
              rowKey="id"
              pagination={{
                current: riskAlertsData?.page || 1,
                pageSize: riskAlertsData?.limit || 20,
                total: riskAlertsData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} alerts`,
                onChange: (page, pageSize) => {
                  setRiskFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1200 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <SafetyOutlined />
                Content Moderation
              </span>
            }
            key="content"
            disabled={!canReviewContent}
          >
            {!canReviewContent ? (
              <Alert
                message="Access Restricted"
                description="You need content review permissions to access this section."
                type="warning"
                showIcon
              />
            ) : (
              <>
                {/* Content Filters */}
                <Card className="mb-4" size="small">
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Content Type"
                        value={contentFilters.type}
                        onChange={(value) => handleContentFilterChange('type', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="FAKE_NEWS">Fake News</Select.Option>
                        <Select.Option value="VIOLENCE">Violence</Select.Option>
                        <Select.Option value="HATE_SPEECH">Hate Speech</Select.Option>
                        <Select.Option value="MISINFORMATION">Misinformation</Select.Option>
                        <Select.Option value="SPAM">Spam</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Status"
                        value={contentFilters.status}
                        onChange={(value) => handleContentFilterChange('status', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="FLAGGED">Flagged</Select.Option>
                        <Select.Option value="PENDING_REVIEW">Pending Review</Select.Option>
                        <Select.Option value="APPROVED">Approved</Select.Option>
                        <Select.Option value="BLOCKED">Blocked</Select.Option>
                        <Select.Option value="FALSE_POSITIVE">False Positive</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Select
                        placeholder="Severity"
                        value={contentFilters.severity}
                        onChange={(value) => handleContentFilterChange('severity', value)}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        <Select.Option value="LOW">Low</Select.Option>
                        <Select.Option value="MEDIUM">Medium</Select.Option>
                        <Select.Option value="HIGH">High</Select.Option>
                        <Select.Option value="CRITICAL">Critical</Select.Option>
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Input
                        placeholder="Platform"
                        value={contentFilters.platform}
                        onChange={(e) => handleContentFilterChange('platform', e.target.value)}
                        allowClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* Content Table */}
                <Table
                  columns={contentColumns}
                  dataSource={harmfulContentData?.data || []}
                  loading={contentLoading}
                  rowKey="id"
                  pagination={{
                    current: harmfulContentData?.page || 1,
                    pageSize: harmfulContentData?.limit || 20,
                    total: harmfulContentData?.total || 0,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} of ${total} items`,
                    onChange: (page, pageSize) => {
                      setContentFilters(prev => ({
                        ...prev,
                        page,
                        limit: pageSize || 20,
                      }));
                    },
                  }}
                  scroll={{ x: 1400 }}
                />
              </>
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Risk Alert Details Modal */}
      <Modal
        title={
          <Space>
            <SecurityScanOutlined />
            Risk Alert Details
          </Space>
        }
        visible={alertModalVisible}
        onCancel={() => setAlertModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAlertModalVisible(false)}>
            Close
          </Button>,
          canManageRisk && selectedAlert?.status === 'OPEN' && (
            <Button
              key="investigate"
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => {/* Handle investigation */}}
            >
              Start Investigation
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedAlert && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Alert ID" span={2}>
              <Text code copyable={{ text: selectedAlert.id }}>
                {selectedAlert.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag icon={<BugOutlined />} color="blue">{selectedAlert.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Severity">
              <Badge
                status={getSeverityColor(selectedAlert.severity) as any}
                text={selectedAlert.severity}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getStatusColor(selectedAlert.status) as any}
                text={selectedAlert.status.replace('_', ' ')}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {moment(selectedAlert.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            {selectedAlert.resolvedAt && (
              <Descriptions.Item label="Resolved">
                {moment(selectedAlert.resolvedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Title" span={2}>
              {selectedAlert.title}
            </Descriptions.Item>
            <Descriptions.Item label="Message" span={2}>
              <Paragraph>{selectedAlert.message}</Paragraph>
            </Descriptions.Item>
            {selectedAlert.userId && (
              <Descriptions.Item label="User ID">
                <Text code>{selectedAlert.userId}</Text>
              </Descriptions.Item>
            )}
            {selectedAlert.contentId && (
              <Descriptions.Item label="Content ID">
                <Text code>{selectedAlert.contentId}</Text>
              </Descriptions.Item>
            )}
            {selectedAlert.metadata && (
              <Descriptions.Item label="Metadata" span={2}>
                <pre>{JSON.stringify(selectedAlert.metadata, null, 2)}</pre>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* Content Details Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            Content Moderation Details
          </Space>
        }
        visible={contentModalVisible}
        onCancel={() => setContentModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setContentModalVisible(false)}>
            Close
          </Button>,
          canReviewContent && selectedContent?.status === 'PENDING_REVIEW' && (
            <>
              <Button
                key="approve"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleApproveContent}
                loading={approveContentMutation.isLoading}
              >
                Approve Content
              </Button>
              <Popconfirm
                title="Block Content"
                description="Are you sure you want to block this content?"
                onConfirm={() => handleBlockContent('Harmful content detected')}
                okText="Block"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  key="block"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={blockContentMutation.isLoading}
                >
                  Block Content
                </Button>
              </Popconfirm>
            </>
          ),
        ]}
        width={900}
      >
        {selectedContent && (
          <div>
            <Descriptions bordered column={2} className="mb-4">
              <Descriptions.Item label="Content ID" span={2}>
                <Text code copyable={{ text: selectedContent.id }}>
                  {selectedContent.id}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag icon={<BugOutlined />} color="volcano">
                  {selectedContent.type.replace('_', ' ')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Platform">
                <Tag color="blue">{selectedContent.platform}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Severity">
                <Badge
                  status={getSeverityColor(selectedContent.severity) as any}
                  text={selectedContent.severity}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Confidence">
                <Progress
                  percent={selectedContent.confidence}
                  size="small"
                  status={selectedContent.confidence > 80 ? 'success' : 'normal'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge
                  status={getStatusColor(selectedContent.status) as any}
                  text={selectedContent.status.replace('_', ' ')}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Reporter">
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text>{selectedContent.reporter || 'System Detection'}</Text>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {moment(selectedContent.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Card title="Content Preview" size="small">
              <Paragraph
                copyable={{ text: selectedContent.content }}
                style={{
                  maxHeight: 200,
                  overflow: 'auto',
                  padding: '12px',
                  background: '#f5f5f5',
                  borderRadius: '6px'
                }}
              >
                {selectedContent.content}
              </Paragraph>
            </Card>

            {selectedContent.metadata && (
              <Card title="Detection Metadata" size="small" className="mt-4">
                <pre style={{
                  fontSize: '12px',
                  background: '#f5f5f5',
                  padding: '12px',
                  borderRadius: '6px',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {JSON.stringify(selectedContent.metadata, null, 2)}
                </pre>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Risk;