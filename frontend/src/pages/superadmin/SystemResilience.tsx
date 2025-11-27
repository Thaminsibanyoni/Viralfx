import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Typography, Progress, Alert, Button, Table, Tag, Space, Tabs, Form, Input, Select, InputNumber, Switch, DatePicker, Modal, Drawer, Tooltip, Badge, Divider, Timeline, message, Spin, Empty, Popconfirm, notification, Collapse, List, Avatar, Descriptions, Steps, Result, Dropdown, MenuProps, Grid, } from 'antd';
import {
  ThunderboltOutlined, ExperimentOutlined, AlertOutlined, CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, FireOutlined, SafetyOutlined, DashboardOutlined, CopyOutlined, LineChartOutlined, SettingOutlined, FileTextOutlined, WarningOutlined, InfoCircleOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined, UploadOutlined, ScheduleOutlined, SafetyCertificateOutlined, BugOutlined, CloudOutlined, DatabaseOutlined, ApiOutlined, ClusterOutlined, DeploymentUnitOutlined, HddOutlined, GlobalOutlined, RouterOutlined, ServerOutlined, TeamOutlined, ClockCircleOutlined, BarChartOutlined, PieChartOutlined, HeatMapOutlined, RiseOutlined, FallOutlined, IssuesCloseOutlined, ExclamationCircleOutlined, } from '@ant-design/icons';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart, RadialBarChart, RadialBar } from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, subHours, subDays } from 'date-fns';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';
import DifferentialSyncClient from '../../services/websocket/differentialSyncClient';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {Panel} = Collapse;
const {Step} = Steps;
const {useBreakpoint} = Grid;

// Types
interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'stopped';
  target: {
    type: string;
    components: string[];
    region?: string;
  };
  configuration: {
    duration: number;
    intensity: number;
    parameters: Record<string, any>;
  };
  schedule?: {
    startTime?: Date;
    endTime?: Date;
    recurring?: {
      frequency: string;
      interval: number;
    };
  };
  safetyLimits?: {
    maxFailureRate: number;
    rollbackThreshold: number;
    criticalServicesExempt: boolean;
  };
  results?: {
    successRate: number;
    impactScore: number;
    recoveryTime: number;
    metrics: Record<string, number>;
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface ChaosTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  tags: string[];
  target: {
    type: string;
    recommendedComponents: string[];
  };
  configuration: {
    defaultDuration: number;
    defaultIntensity: number;
    adjustableParameters: Array<{
      name: string;
      type: string;
      defaultValue: any;
      min?: number;
      max?: number;
      description: string;
    }>;
  };
  safetyGuidelines: string[];
  expectedImpact: {
    description: string;
    affectedMetrics: string[];
    recoveryTime: string;
  };
  usageCount: number;
}

interface ResilienceMetrics {
  overallScore: number;
  components: {
    [key: string]: {
      health: number;
      availability: number;
      responseTime: number;
      errorRate: number;
    };
  };
  trends: Array<{
    timestamp: Date;
    score: number;
    availability: number;
    responseTime: number;
  }>;
  recommendations: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    action: string;
  }>;
}

interface ActiveEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  component: string;
  startTime: Date;
  estimatedRecovery: Date;
  impactedServices: string[];
  mitigationActions: string[];
}

const SystemResilience: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedExperiment, setSelectedExperiment] = useState<ChaosExperiment | null>(null);
  const [experimentModalVisible, setExperimentModalVisible] = useState(false);
  const [templateDrawerVisible, setTemplateDrawerVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChaosTemplate | null>(null);
  const [experimentForm] = Form.useForm();
  const [templateForm] = Form.useForm();
  const [wsClient, setWsClient] = useState<DifferentialSyncClient | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<ResilienceMetrics | null>(null);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const _screens = useBreakpoint();

  const queryClient = useQueryClient();
  const {admin, checkPermission} = useAdminStore();

  // Initialize WebSocket connection
  useEffect(() => {
    if (!admin?.id) return;

    const client = new DifferentialSyncClient({
      clientId: `admin-${admin.id}-${Date.now()}`,
      websocketUrl: `${import.meta.env.VITE_ADMIN_WS_URL || 'ws://localhost:3000'}/admin/resilience`,
      entityTypes: ['resilience', 'chaos-experiments', 'system-health'],
      qualityMonitoring: true,
    });

    client.on('connected', () => {
      console.log('System Resilience WebSocket connected');
      client.subscribe(['resilience', 'chaos-experiments']);
    });

    client.on('state:updated', (data) => {
      if (data.entityType === 'resilience') {
        setRealTimeMetrics(data.newState);
      } else if (data.entityType === 'chaos-experiments') {
        queryClient.invalidateQueries({ queryKey: ['chaos-experiments'] });
      }
    });

    client.on('error', (error) => {
      console.error('WebSocket error:', error);
      notification.error({
        message: 'Connection Error',
        description: 'Failed to connect to real-time monitoring',
      });
    });

    client.connect().catch(console.error);
    setWsClient(client);

    return () => {
      client.disconnect();
    };
  }, [admin?.id, queryClient]);

  // Fetch resilience metrics
  const {data: resilienceMetrics, isLoading: metricsLoading, refetch: refetchMetrics, } = useQuery({
    queryKey: ['resilience-metrics'],
    queryFn: () => adminApi.getResilienceMetrics(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch chaos experiments
  const {data: experimentsData, isLoading: experimentsLoading, refetch: refetchExperiments, } = useQuery({
    queryKey: ['chaos-experiments'],
    queryFn: () => adminApi.getChaosExperiments({ page: 1, limit: 20 }),
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // Fetch chaos templates
  const {data: templatesData, isLoading: templatesLoading, } = useQuery({
    queryKey: ['chaos-templates'],
    queryFn: () => adminApi.getChaosTemplates(),
  });

  // Fetch system components
  const {data: componentsData, isLoading: componentsLoading, } = useQuery({
    queryKey: ['system-components'],
    queryFn: () => adminApi.getSystemComponents(),
  });

  // Fetch resilience recommendations
  const {data: recommendationsData, isLoading: recommendationsLoading, } = useQuery({
    queryKey: ['resilience-recommendations'],
    queryFn: () => adminApi.getResilienceRecommendations(),
    refetchInterval: 60000, // Refresh every minute
  });

  // Mutations
  const createExperimentMutation = useMutation({
    mutationFn: (data: any) => adminApi.createChaosExperiment(data),
    onSuccess: () => {
      message.success('Chaos experiment created successfully');
      setExperimentModalVisible(false);
      experimentForm.resetFields();
      refetchExperiments();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create experiment');
    },
  });

  const startExperimentMutation = useMutation({
    mutationFn: (experimentId: string) => adminApi.startChaosExperiment(experimentId),
    onSuccess: () => {
      message.success('Experiment started successfully');
      refetchExperiments();
      refetchMetrics();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to start experiment');
    },
  });

  const stopExperimentMutation = useMutation({
    mutationFn: ({ experimentId, force }: { experimentId: string; force?: boolean }) =>
      adminApi.stopChaosExperiment(experimentId, force),
    onSuccess: () => {
      message.success('Experiment stopped successfully');
      refetchExperiments();
      refetchMetrics();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to stop experiment');
    },
  });

  const deleteExperimentMutation = useMutation({
    mutationFn: (experimentId: string) => adminApi.deleteChaosExperiment(experimentId),
    onSuccess: () => {
      message.success('Experiment deleted successfully');
      refetchExperiments();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete experiment');
    },
  });

  // Helper functions
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'default',
      scheduled: 'processing',
      running: 'success',
      paused: 'warning',
      completed: 'success',
      failed: 'error',
      stopped: 'error',
    };
    return colors[status] || 'default';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      low: 'green',
      medium: 'orange',
      high: 'red',
      critical: 'red',
    };
    return colors[severity] || 'default';
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Handle emergency stop
  const handleEmergencyStop = async () => {
    Modal.confirm({
      title: 'Emergency Stop',
      content: 'This will immediately stop all running chaos experiments. This action cannot be undone.',
      okText: 'Emergency Stop',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const runningExperiments = experimentsData?.data?.filter((exp: ChaosExperiment) =>
            exp.status === 'running'
          ) || [];

          const stopPromises = runningExperiments.map((exp: ChaosExperiment) =>
            adminApi.stopChaosExperiment(exp.id, true)
          );

          await Promise.all(stopPromises);
          setIsEmergencyMode(false);
          message.success('All experiments stopped successfully');
          refetchExperiments();
          refetchMetrics();
        } catch (error) {
          message.error('Failed to stop all experiments');
        }
      },
    });
  };

  // Generate gauge data for resilience score
  const generateGaugeData = (score: number) => {
    return [
      {
        name: 'Resilience Score',
        value: score,
        fill: getHealthColor(score),
      },
    ];
  };

  // Component health data
  const componentHealthData = componentsData?.data?.map((component: any) => ({
    name: component.name,
    health: component.health,
    availability: component.availability,
    responseTime: component.responseTime,
  })) || [];

  // Metrics trend data
  const metricsTrendData = resilienceMetrics?.trends?.map((trend: any) => ({
    timestamp: format(new Date(trend.timestamp), 'HH:mm'),
    score: trend.score,
    availability: trend.availability,
    responseTime: trend.responseTime,
  })) || [];

  // Event handlers
  const handleCreateExperiment = (values: any) => {
    createExperimentMutation.mutate(values);
  };

  const handleStartExperiment = (experimentId: string) => {
    startExperimentMutation.mutate(experimentId);
  };

  const handleStopExperiment = (experimentId: string, force = false) => {
    stopExperimentMutation.mutate({ experimentId, force });
  };

  const handleDeleteExperiment = (experimentId: string) => {
    deleteExperimentMutation.mutate(experimentId);
  };

  const handleViewExperiment = (experiment: ChaosExperiment) => {
    setSelectedExperiment(experiment);
    setExperimentModalVisible(true);
  };

  const handleViewTemplate = (template: ChaosTemplate) => {
    setSelectedTemplate(template);
    setTemplateDrawerVisible(true);
  };

  // Table columns for experiments
  const experimentColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ChaosExperiment) => (
        <Space>
          <Text strong>{text}</Text>
          {record.status === 'running' && <Badge status="processing" />}
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'target',
      key: 'target',
      render: (target: ChaosExperiment['target']) => (
        <Space direction="vertical" size="small">
          <Text type="secondary">{target.type}</Text>
          <Text>{target.components.length} components</Text>
        </Space>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (record: ChaosExperiment) => {
        if (record.status === 'running' && record.startedAt) {
          const elapsed = Date.now() - new Date(record.startedAt).getTime();
          const progress = Math.min((elapsed / record.configuration.duration) * 100, 100);
          return <Progress percent={progress} size="small" />;
        }
        return <Text type="secondary">-</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ChaosExperiment) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewExperiment(record)}
            />
          </Tooltip>
          {record.status === 'draft' && (
            <Tooltip title="Start">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartExperiment(record.id)}
                loading={startExperimentMutation.isLoading}
              />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="Stop">
              <Popconfirm
                title="Stop this experiment?"
                onConfirm={() => handleStopExperiment(record.id)}
              >
                <Button
                  type="text"
                  icon={<StopOutlined />}
                  loading={stopExperimentMutation.isLoading}
                />
              </Popconfirm>
            </Tooltip>
          )}
          <Dropdown
            menu={{
              items: [
                {
                  key: 'edit',
                  label: 'Edit',
                  icon: <EditOutlined />,
                },
                {
                  key: 'duplicate',
                  label: 'Duplicate',
                  icon: <CopyOutlined />,
                },
                {
                  type: 'divider',
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDeleteExperiment(record.id),
                },
              ],
            }}
          >
            <Button type="text" icon={<SettingOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  // Loading states
  if (metricsLoading || experimentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">
            System Resilience
          </Title>
          <Text type="secondary">
            Chaos testing and resilience monitoring for ViralFX infrastructure
          </Text>
        </div>
        <Space>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => setExperimentModalVisible(true)}
            disabled={!checkPermission('resilience:experiments:create')}
          >
            Create Experiment
          </Button>
          <Button
            icon={<WarningOutlined />}
            danger
            onClick={handleEmergencyStop}
            loading={isEmergencyMode}
            disabled={!experimentsData?.data?.some((exp: ChaosExperiment) => exp.status === 'running')}
          >
            Emergency Stop
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchMetrics();
              refetchExperiments();
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Real-time Alerts */}
      {activeEvents.length > 0 && (
        <Alert
          message="Active Chaos Events"
          description={`There are ${activeEvents.length} active chaos events affecting system performance`}
          type="warning"
          showIcon
          closable
          action={
            <Button size="small" type="text">
              View Details
            </Button>
          }
        />
      )}

      {/* Main Content */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab={<span><DashboardOutlined />Dashboard</span>} key="dashboard">
          {/* Resilience Overview */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Overall Resilience Score"
                  value={resilienceMetrics?.overallScore || 0}
                  suffix="/100"
                  prefix={<SafetyOutlined />}
                  valueStyle={{ color: getHealthColor(resilienceMetrics?.overallScore || 0) }}
                />
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="90%"
                      data={generateGaugeData(resilienceMetrics?.overallScore || 0)}
                    >
                      <RadialBar
                        dataKey="value"
                        cornerRadius={10}
                        fill={getHealthColor(resilienceMetrics?.overallScore || 0)}
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Active Experiments"
                  value={experimentsData?.data?.filter((exp: ChaosExperiment) =>
                    exp.status === 'running'
                  ).length || 0}
                  prefix={<ExperimentOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <div className="mt-4">
                  <Progress
                    percent={((experimentsData?.data?.filter((exp: ChaosExperiment) =>
                      exp.status === 'running'
                    ).length || 0) / Math.max(experimentsData?.data?.length || 1, 1)) * 100}
                    size="small"
                    format={() => `${experimentsData?.data?.filter((exp: ChaosExperiment) =>
                      exp.status === 'running'
                    ).length || 0}/${experimentsData?.data?.length || 0}`}
                  />
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="System Health"
                  value={resilienceMetrics?.components ?
                    Object.values(resilienceMetrics.components).reduce((acc, comp) => acc + comp.health, 0) /
                    Object.keys(resilienceMetrics.components).length : 0}
                  suffix="%"
                  prefix={<CheckCircleOutlined />}
                  precision={1}
                  valueStyle={{
                    color: getHealthColor(resilienceMetrics?.components ?
                      Object.values(resilienceMetrics.components).reduce((acc, comp) => acc + comp.health, 0) /
                      Object.keys(resilienceMetrics.components).length : 0)
                  }}
                />
                <div className="mt-4 space-y-2">
                  {componentHealthData.slice(0, 3).map((component) => (
                    <div key={component.name} className="flex justify-between items-center">
                      <Text type="secondary" className="text-xs">{component.name}</Text>
                      <Text className="text-xs">{component.health}%</Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="Uptime Today"
                  value={99.9}
                  suffix="%"
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
                <div className="mt-4">
                  <Space>
                    <Tag color="green">Stable</Tag>
                    <Tag color="blue">Normal</Tag>
                  </Space>
                  <div className="mt-2">
                    <Text type="secondary" className="text-xs">
                      No incidents in last 24h
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Component Health and Trends */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} lg={12}>
              <Card title="Component Health" extra={
                <Button type="link" size="small">
                  View All
                </Button>
              }>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={componentHealthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="health" fill="#52c41a" />
                    <Bar dataKey="availability" fill="#1890ff" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Resilience Trends" extra={
                <Button type="link" size="small">
                  Expand
                </Button>
              }>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metricsTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <RechartsTooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#52c41a"
                      strokeWidth={2}
                      name="Resilience Score"
                    />
                    <Line
                      type="monotone"
                      dataKey="availability"
                      stroke="#1890ff"
                      strokeWidth={2}
                      name="Availability %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>

          {/* Recommendations */}
          {recommendationsData?.data && recommendationsData.data.length > 0 && (
            <Card title="Resilience Recommendations" extra={
              <Button type="link" size="small">
                View All Recommendations
              </Button>
            }>
              <List
                dataSource={recommendationsData.data.slice(0, 5)}
                renderItem={(item: any) => (
                  <List.Item
                    actions={[
                      <Button type="link" size="small">
                        Apply
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: getSeverityColor(item.severity) }}>
                          {item.severity === 'critical' ? <ExclamationCircleOutlined /> : <InfoCircleOutlined />}
                        </Avatar>
                      }
                      title={item.title}
                      description={item.description}
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </TabPane>

        <TabPane tab={<span><ExperimentOutlined />Experiments</span>} key="experiments">
          <Card
            title="Chaos Experiments"
            extra={
              <Space>
                <Select
                  placeholder="Filter by status"
                  style={{ width: 120 }}
                  allowClear
                >
                  <Select.Option value="draft">Draft</Select.Option>
                  <Select.Option value="running">Running</Select.Option>
                  <Select.Option value="completed">Completed</Select.Option>
                  <Select.Option value="failed">Failed</Select.Option>
                </Select>
                <Select
                  placeholder="Filter by category"
                  style={{ width: 120 }}
                  allowClear
                >
                  <Select.Option value="latency">Latency</Select.Option>
                  <Select.Option value="fault">Fault Injection</Select.Option>
                  <Select.Option value="network">Network</Select.Option>
                  <Select.Option value="resource">Resource</Select.Option>
                </Select>
              </Space>
            }
          >
            <Table
              columns={experimentColumns}
              dataSource={experimentsData?.data || []}
              loading={experimentsLoading}
              rowKey="id"
              pagination={{
                total: experimentsData?.total || 0,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><ThunderboltOutlined />Templates</span>} key="templates">
          <Row gutter={[16, 16]}>
            {templatesData?.data?.map((template: ChaosTemplate) => (
              <Col xs={24} sm={12} lg={8} key={template.id}>
                <Card
                  title={template.name}
                  extra={
                    <Tag color={template.difficulty === 'beginner' ? 'green' :
                              template.difficulty === 'intermediate' ? 'orange' :
                              template.difficulty === 'advanced' ? 'red' : 'purple'}>
                      {template.difficulty.toUpperCase()}
                    </Tag>
                  }
                  actions={[
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewTemplate(template)}
                    >
                      View
                    </Button>,
                    <Button
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => {
                        setSelectedTemplate(template);
                        setExperimentModalVisible(true);
                      }}
                    >
                      Use Template
                    </Button>
                  ]}
                >
                  <Paragraph ellipsis={{ rows: 2 }}>
                    {template.description}
                  </Paragraph>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <Text type="secondary">Category:</Text>
                      <Tag>{template.category}</Tag>
                    </div>
                    <div className="flex justify-between">
                      <Text type="secondary">Used:</Text>
                      <Text>{template.usageCount} times</Text>
                    </div>
                    <div className="flex justify-between">
                      <Text type="secondary">Duration:</Text>
                      <Text>{formatDuration(template.configuration.defaultDuration)}</Text>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Space wrap>
                      {template.tags.slice(0, 3).map((tag) => (
                        <Tag key={tag} size="small">{tag}</Tag>
                      ))}
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab={<span><LineChartOutlined />Analytics</span>} key="analytics">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Experiment Success Rate">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Successful', value: 75, fill: '#52c41a' },
                        { name: 'Failed', value: 25, fill: '#ff4d4f' },
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label
                    >
                      {[
                        { name: 'Successful', value: 75, fill: '#52c41a' },
                        { name: 'Failed', value: 25, fill: '#ff4d4f' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title="Failure Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { type: 'Network', count: 15 },
                      { type: 'Database', count: 8 },
                      { type: 'API', count: 12 },
                      { type: 'Cache', count: 5 },
                      { type: 'Storage', count: 3 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#1890ff" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>

            <Col xs={24}>
              <Card title="Recovery Time Analysis">
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={metricsTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <RechartsTooltip />
                    <Area
                      type="monotone"
                      dataKey="responseTime"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* Create/Edit Experiment Modal */}
      <Modal
        title={selectedExperiment ? 'Edit Experiment' : 'Create Chaos Experiment'}
        open={experimentModalVisible}
        onCancel={() => {
          setExperimentModalVisible(false);
          setSelectedExperiment(null);
          experimentForm.resetFields();
        }}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form
          form={experimentForm}
          layout="vertical"
          onFinish={handleCreateExperiment}
          initialValues={selectedTemplate ? {
            category: selectedTemplate.category,
            configuration: {
              duration: selectedTemplate.configuration.defaultDuration,
              intensity: selectedTemplate.configuration.defaultIntensity,
            },
          } : selectedExperiment}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Experiment Name"
                rules={[{ required: true, message: 'Please enter experiment name' }]}
              >
                <Input placeholder="Enter experiment name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select category' }]}
              >
                <Select placeholder="Select category">
                  <Select.Option value="latency">Latency Injection</Select.Option>
                  <Select.Option value="fault">Fault Injection</Select.Option>
                  <Select.Option value="network">Network Issues</Select.Option>
                  <Select.Option value="resource">Resource Exhaustion</Select.Option>
                  <Select.Option value="disk">Disk I/O</Select.Option>
                  <Select.Option value="memory">Memory Pressure</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Describe what this experiment will test"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['target', 'type']}
                label="Target Type"
                rules={[{ required: true, message: 'Please select target type' }]}
              >
                <Select placeholder="Select target type">
                  <Select.Option value="service">Service</Select.Option>
                  <Select.Option value="component">Component</Select.Option>
                  <Select.Option value="infrastructure">Infrastructure</Select.Option>
                  <Select.Option value="network">Network</Select.Option>
                  <Select.Option value="database">Database</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['target', 'components']}
                label="Target Components"
                rules={[{ required: true, message: 'Please select target components' }]}
              >
                <Select
                  mode="multiple"
                  placeholder="Select components"
                  options={componentsData?.data?.map((comp: any) => ({
                    label: comp.name,
                    value: comp.id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name={['configuration', 'duration']}
                label="Duration (ms)"
                rules={[{ required: true, message: 'Please enter duration' }]}
              >
                <InputNumber
                  min={1000}
                  max={3600000}
                  style={{ width: '100%' }}
                  formatter={(value) => formatDuration(value || 0)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['configuration', 'intensity']}
                label="Intensity (%)"
                rules={[{ required: true, message: 'Please enter intensity' }]}
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name={['target', 'region']}
                label="Region"
              >
                <Select placeholder="Select region (optional)">
                  <Select.Option value="us-east-1">US East</Select.Option>
                  <Select.Option value="us-west-2">US West</Select.Option>
                  <Select.Option value="eu-west-1">EU West</Select.Option>
                  <Select.Option value="ap-southeast-1">Asia Pacific</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name={['safetyLimits', 'criticalServicesExempt']}
            label="Safety Settings"
            valuePropName="checked"
          >
            <Switch checkedChildren="Exempt Critical Services" unCheckedChildren="Include All Services" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={['safetyLimits', 'maxFailureRate']}
                label="Max Failure Rate (%)"
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                  placeholder="Failure threshold for auto-stop"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['safetyLimits', 'rollbackThreshold']}
                label="Rollback Threshold (%)"
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: '100%' }}
                  placeholder="Performance degradation threshold"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item className="mb-0">
            <Space>
              <Button type="primary" htmlType="submit" loading={createExperimentMutation.isLoading}>
                {selectedExperiment ? 'Update Experiment' : 'Create Experiment'}
              </Button>
              <Button
                onClick={() => {
                  setExperimentModalVisible(false);
                  setSelectedExperiment(null);
                  experimentForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Template Details Drawer */}
      <Drawer
        title={selectedTemplate?.name}
        placement="right"
        onClose={() => {
          setTemplateDrawerVisible(false);
          setSelectedTemplate(null);
        }}
        open={templateDrawerVisible}
        width={600}
      >
        {selectedTemplate && (
          <div className="space-y-6">
            <div>
              <Title level={5}>Description</Title>
              <Paragraph>{selectedTemplate.description}</Paragraph>
            </div>

            <div>
              <Title level={5}>Details</Title>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Category">{selectedTemplate.category}</Descriptions.Item>
                <Descriptions.Item label="Difficulty">
                  <Tag color={selectedTemplate.difficulty === 'beginner' ? 'green' :
                            selectedTemplate.difficulty === 'intermediate' ? 'orange' :
                            selectedTemplate.difficulty === 'advanced' ? 'red' : 'purple'}>
                    {selectedTemplate.difficulty.toUpperCase()}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Duration">
                  {formatDuration(selectedTemplate.configuration.defaultDuration)}
                </Descriptions.Item>
                <Descriptions.Item label="Used Count">{selectedTemplate.usageCount}</Descriptions.Item>
              </Descriptions>
            </div>

            <div>
              <Title level={5}>Expected Impact</Title>
              <Paragraph>{selectedTemplate.expectedImpact.description}</Paragraph>
              <div className="mt-2">
                <Text type="secondary">Recovery Time: </Text>
                <Text>{selectedTemplate.expectedImpact.recoveryTime}</Text>
              </div>
            </div>

            <div>
              <Title level={5}>Safety Guidelines</Title>
              <List
                dataSource={selectedTemplate.safetyGuidelines}
                renderItem={(guideline) => (
                  <List.Item>
                    <Text>{guideline}</Text>
                  </List.Item>
                )}
              />
            </div>

            <div>
              <Title level={5}>Tags</Title>
              <Space wrap>
                {selectedTemplate.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            </div>

            <div className="absolute bottom-6 left-6 right-6">
              <Button
                type="primary"
                block
                size="large"
                onClick={() => {
                  setTemplateDrawerVisible(false);
                  setExperimentModalVisible(true);
                }}
              >
                Use This Template
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SystemResilience;