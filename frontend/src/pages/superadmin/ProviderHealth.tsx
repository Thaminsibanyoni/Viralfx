import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  
  Card, Row, Col, Statistic, Progress, Badge, Table, Button, Select, Input, Space, Tag, Tooltip, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, Modal, Form, InputNumber, Switch, message, Tabs, Typography, Divider, Empty, Spin, Rate, DatePicker, Radio, Checkbox, Transfer, TreeSelect, Upload, UploadProps, } from 'antd';
import {
  MailOutlined, BellOutlined, SendOutlined, PhoneOutlined, MessageOutlined, GlobalOutlined, SettingOutlined, ReloadOutlined, ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, ThunderboltOutlined, RocketOutlined, BarChartOutlined, LineChartOutlined, HeatMapOutlined, DashboardOutlined, MonitorOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, DownloadOutlined, EyeOutlined, ToolOutlined, ExperimentOutlined, SafetyOutlined, DashboardTwoTone, FireOutlined, ApiOutlined, CloudOutlined, TeamOutlined, UserOutlined, ScheduleOutlined, FileTextOutlined, AreaChartOutlined, DotChartOutlined, CaretUpOutlined, CaretDownOutlined, InfoCircleOutlined, BugOutlined, CheckSquareOutlined, CloseSquareOutlined, PlaySquareOutlined, } from '@ant-design/icons';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter, Treemap, ComposedChart, ReferenceLine, ReferenceArea, } from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;
const {Group: RadioGroup} = Radio;
const {TextArea} = Input;

// Provider Health Types
interface ProviderHealth {
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
  metadata: Record<string, any>;
}

interface SLACompliance {
  providerId: string;
  providerName: string;
  target: {
    uptime: number;
    responseTime: number;
    successRate: number;
  };
  actual: {
    uptime: number;
    responseTime: number;
    successRate: number;
  };
  compliance: {
    uptime: number;
    responseTime: number;
    successRate: number;
    overall: number;
  };
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  monthlyDowntime: {
    allowed: number;
    used: number;
    remaining: number;
  };
  period: string;
  alerts: SLAAlert[];
}

interface SLAAlert {
  id: string;
  type: 'UPTIME' | 'RESPONSE_TIME' | 'SUCCESS_RATE' | 'COST';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

interface PerformanceMetrics {
  timestamp: Date;
  providerId: string;
  latency: number;
  throughput: number;
  successRate: number;
  errorRate: number;
  cost: number;
  region: string;
}

interface RoutingAnalytics {
  providerId: string;
  providerName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  costPerRequest: number;
  regions: Record<string, {
    requests: number;
    successRate: number;
    averageLatency: number;
  }>;
  timeDistribution: Record<string, number>;
}

interface ProviderTest {
  id: string;
  providerId: string;
  testName: string;
  type: 'HEALTH_CHECK' | 'PERFORMANCE' | 'LOAD' | 'FAILover';
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  results: {
    latency: number;
    successRate: number;
    throughput: number;
    errorRate: number;
  };
  logs: string[];
  metadata: Record<string, any>;
}

interface WebSocketMessage {
  type: 'PROVIDER_HEALTH_UPDATE' | 'SLA_VIOLATION' | 'PERFORMANCE_ALERT' | 'ROUTING_CHANGE';
  payload: any;
  timestamp: string;
}

const ProviderHealth: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();
  const _websocketRef = useRef<any>(null);

  // State management
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedProvider, setSelectedProvider] = useState<ProviderHealth | null>(null);
  const [providerModalVisible, setProviderModalVisible] = useState<boolean>(false);
  const [testModalVisible, setTestModalVisible] = useState<boolean>(false);
  const [slaModalVisible, setSlaModalVisible] = useState<boolean>(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('24h');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [alertFilters, setAlertFilters] = useState<any>({
    severity: [],
    type: [],
    resolved: false,
  });

  // Forms
  const [providerForm] = Form.useForm();
  const [testForm] = Form.useForm();
  const [slaForm] = Form.useForm();

  // Permissions
  const canViewProviderHealth = checkPermission('notifications:providers:view');
  const canManageProviders = checkPermission('notifications:providers:manage');
  const canRunTests = checkPermission('notifications:providers:test');
  const canViewAnalytics = checkPermission('notifications:analytics:view');

  // Mock data generation
  const generateMockProviderHealth = (): ProviderHealth[] => [
    {
      id: 'prov_1',
      name: 'SendGrid',
      type: 'email',
      status: 'HEALTHY',
      healthScore: 98,
      uptime: 99.9,
      responseTime: 145,
      successRate: 99.2,
      errorRate: 0.8,
      throughput: 1250,
      lastCheck: new Date(),
      circuitBreaker: {
        status: 'CLOSED',
        failures: 2,
        threshold: 10,
        timeout: 60000,
      },
      quotas: {
        current: 8450,
        limit: 10000,
        resetTime: new Date(Date.now() + 3600000),
      },
      costs: {
        current: 12.45,
        projected: 145.80,
        currency: 'USD',
      },
      region: 'global',
      priority: 1,
      metadata: {},
    },
    {
      id: 'prov_2',
      name: 'Twilio',
      type: 'sms',
      status: 'DEGRADED',
      healthScore: 76,
      uptime: 98.2,
      responseTime: 289,
      successRate: 96.8,
      errorRate: 3.2,
      throughput: 450,
      lastCheck: new Date(),
      circuitBreaker: {
        status: 'HALF_OPEN',
        failures: 7,
        threshold: 10,
        timeout: 60000,
      },
      quotas: {
        current: 2340,
        limit: 5000,
        resetTime: new Date(Date.now() + 3600000),
      },
      costs: {
        current: 8.90,
        projected: 89.20,
        currency: 'USD',
      },
      region: 'global',
      priority: 2,
      metadata: {},
    },
    {
      id: 'prov_3',
      name: 'Firebase Cloud Messaging',
      type: 'push',
      status: 'HEALTHY',
      healthScore: 94,
      uptime: 99.7,
      responseTime: 89,
      successRate: 98.5,
      errorRate: 1.5,
      throughput: 2100,
      lastCheck: new Date(),
      circuitBreaker: {
        status: 'CLOSED',
        failures: 1,
        threshold: 10,
        timeout: 60000,
      },
      quotas: {
        current: 5670,
        limit: 10000,
        resetTime: new Date(Date.now() + 3600000),
      },
      costs: {
        current: 0,
        projected: 0,
        currency: 'USD',
      },
      region: 'global',
      priority: 1,
      metadata: {},
    },
    {
      id: 'prov_4',
      name: 'OneSignal',
      type: 'push',
      status: 'MAINTENANCE',
      healthScore: 45,
      uptime: 95.1,
      responseTime: 445,
      successRate: 91.2,
      errorRate: 8.8,
      throughput: 890,
      lastCheck: new Date(),
      circuitBreaker: {
        status: 'OPEN',
        failures: 12,
        threshold: 10,
        timeout: 120000,
      },
      quotas: {
        current: 3200,
        limit: 10000,
        resetTime: new Date(Date.now() + 3600000),
      },
      costs: {
        current: 15.30,
        projected: 165.80,
        currency: 'USD',
      },
      region: 'global',
      priority: 3,
      metadata: {},
    },
  ];

  const generateMockSLAData = (): SLACompliance[] => [
    {
      providerId: 'prov_1',
      providerName: 'SendGrid',
      target: {
        uptime: 99.5,
        responseTime: 200,
        successRate: 99.0,
      },
      actual: {
        uptime: 99.9,
        responseTime: 145,
        successRate: 99.2,
      },
      compliance: {
        uptime: 100.4,
        responseTime: 72.5,
        successRate: 100.2,
        overall: 100.2,
      },
      riskLevel: 'LOW',
      monthlyDowntime: {
        allowed: 2160, // 36 hours in seconds
        used: 180,
        remaining: 1980,
      },
      period: '2024-11',
      alerts: [],
    },
    {
      providerId: 'prov_2',
      providerName: 'Twilio',
      target: {
        uptime: 99.0,
        responseTime: 300,
        successRate: 98.5,
      },
      actual: {
        uptime: 98.2,
        responseTime: 289,
        successRate: 96.8,
      },
      compliance: {
        uptime: 99.2,
        responseTime: 96.3,
        successRate: 98.3,
        overall: 97.9,
      },
      riskLevel: 'MEDIUM',
      monthlyDowntime: {
        allowed: 4320, // 72 hours in seconds
        used: 2520,
        remaining: 1800,
      },
      period: '2024-11',
      alerts: [
        {
          id: 'alert_1',
          type: 'SUCCESS_RATE',
          severity: 'MEDIUM',
          message: 'Success rate below threshold for 2 hours',
          timestamp: new Date(Date.now() - 7200000),
          resolved: false,
        },
      ],
    },
  ];

  const generateMockPerformanceData = (): PerformanceMetrics[] => {
    const now = Date.now();
    const data: PerformanceMetrics[] = [];
    const providers = ['prov_1', 'prov_2', 'prov_3', 'prov_4'];
    const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

    for (let i = 0; i < 168; i++) { // 7 days of hourly data
      const timestamp = new Date(now - (i * 3600000));
      providers.forEach(providerId => {
        regions.forEach(region => {
          data.push({
            timestamp,
            providerId,
            latency: Math.floor(Math.random() * 200) + 50,
            throughput: Math.floor(Math.random() * 1000) + 100,
            successRate: 95 + Math.random() * 5,
            errorRate: Math.random() * 5,
            cost: Math.random() * 10,
            region,
          });
        });
      });
    }

    return data;
  };

  // WebSocket setup
  useEffect(() => {
    if (autoRefresh && canViewProviderHealth) {
      // Mock WebSocket connection for real-time updates
      const _mockWebSocket = {
        send: () => {},
        close: () => {},
        onmessage: null,
        onopen: null,
        onclose: null,
        onerror: null,
      };

      // Simulate real-time updates
      const interval = setInterval(() => {
        // Update provider health randomly
        queryClient.invalidateQueries('provider-health');
      }, 30000); // Update every 30 seconds

      return () => {
        clearInterval(interval);
      };
    }
  }, [autoRefresh, canViewProviderHealth, queryClient]);

  // Data fetching
  const {data: providersData, isLoading: providersLoading, refetch: refetchProviders, } = useQuery(
    'provider-health',
    () => Promise.resolve({ data: generateMockProviderHealth() }),
    {
      enabled: canViewProviderHealth,
      refetchInterval: autoRefresh ? 30000 : false,
    }
  );

  const {data: slaData, isLoading: slaLoading, refetch: refetchSLA, } = useQuery(
    'sla-compliance',
    () => Promise.resolve({ data: generateMockSLAData() }),
    {
      enabled: canViewProviderHealth,
      refetchInterval: autoRefresh ? 60000 : false,
    }
  );

  const {data: performanceData, isLoading: performanceLoading, } = useQuery(
    'performance-metrics',
    () => Promise.resolve({ data: generateMockPerformanceData() }),
    {
      enabled: canViewAnalytics,
    }
  );

  // Mutations
  const testProviderMutation = useMutation(
    (testData: any) => {
      // Mock provider test
      return new Promise(resolve => setTimeout(resolve, 2000));
    },
    {
      onSuccess: () => {
        message.success('Provider test completed successfully');
        setTestModalVisible(false);
        testForm.resetFields();
      },
      onError: () => {
        message.error('Failed to test provider');
      },
    }
  );

  const updateSLAMutation = useMutation(
    (slaData: any) => {
      // Mock SLA update
      return new Promise(resolve => setTimeout(resolve, 1000));
    },
    {
      onSuccess: () => {
        message.success('SLA settings updated successfully');
        setSlaModalVisible(false);
        slaForm.resetFields();
        queryClient.invalidateQueries('sla-compliance');
      },
      onError: () => {
        message.error('Failed to update SLA settings');
      },
    }
  );

  // Helper functions
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
      HEALTHY: 'green',
      DEGRADED: 'orange',
      UNHEALTHY: 'red',
      MAINTENANCE: 'blue',
      OFFLINE: 'gray',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return '#52c41a';
    if (score >= 70) return '#faad14';
    if (score >= 50) return '#fa8c16';
    return '#ff4d4f';
  };

  const getRiskLevelColor = (level: string) => {
    const colors = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
      CRITICAL: 'purple',
    };
    return colors[level as keyof typeof colors] || 'default';
  };

  const _formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  // Event handlers
  const handleTestProvider = () => {
    testForm.validateFields().then((values) => {
      testProviderMutation.mutate(values);
    });
  };

  const handleUpdateSLA = () => {
    slaForm.validateFields().then((values) => {
      updateSLAMutation.mutate(values);
    });
  };

  const handleViewProvider = (provider: ProviderHealth) => {
    setSelectedProvider(provider);
    setProviderModalVisible(true);
  };

  // Chart data processing
  const performanceChartData = useMemo(() => {
    if (!performanceData?.data) return [];

    return performanceData.data
      .filter((metric: PerformanceMetrics) => {
        if (selectedRegion !== 'all') {
          return metric.region === selectedRegion;
        }
        return true;
      })
      .slice(0, 24) // Last 24 hours
      .map((metric: PerformanceMetrics) => ({
        time: moment(metric.timestamp).format('HH:mm'),
        latency: metric.latency,
        throughput: metric.throughput,
        successRate: metric.successRate,
        cost: metric.cost,
      }));
  }, [performanceData, selectedRegion]);

  const providerComparisonData = useMemo(() => {
    if (!providersData?.data) return [];

    return providersData.data.map((provider: ProviderHealth) => ({
      name: provider.name,
      healthScore: provider.healthScore,
      responseTime: provider.responseTime,
      successRate: provider.successRate,
      cost: provider.costs.current,
      throughput: provider.throughput,
    }));
  }, [providersData]);

  const slaComplianceData = useMemo(() => {
    if (!slaData?.data) return [];

    return slaData.data.map((sla: SLACompliance) => ({
      provider: sla.providerName,
      uptime: sla.compliance.uptime,
      responseTime: sla.compliance.responseTime,
      successRate: sla.compliance.successRate,
      overall: sla.compliance.overall,
    }));
  }, [slaData]);

  const regionHeatmapData = useMemo(() => {
    if (!performanceData?.data) return [];

    const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
    const providers = ['SendGrid', 'Twilio', 'FCM', 'OneSignal'];

    return regions.map(region => ({
      region: region.replace('-', ' ').toUpperCase(),
      ...providers.reduce((acc, provider) => {
        const providerMetrics = performanceData.data
          .filter((metric: PerformanceMetrics) =>
            metric.region === region &&
            metric.providerId === providers.indexOf(provider).toString()
          );
        const avgLatency = providerMetrics.length > 0
          ? providerMetrics.reduce((sum, m) => sum + m.latency, 0) / providerMetrics.length
          : 0;
        acc[provider] = Math.round(avgLatency);
        return acc;
      }, {} as Record<string, number>),
    }));
  }, [performanceData]);

  // Table columns
  const providerColumns: ColumnType<ProviderHealth>[] = [
    {
      title: 'Provider',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProviderHealth) => (
        <Space>
          {getProviderIcon(record.type)}
          <div>
            <Text strong>{name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.type.toUpperCase()}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: ProviderHealth) => (
        <Space direction="vertical" size={0}>
          <Badge
            status={getStatusColor(status) as any}
            text={status}
          />
          <Progress
            percent={record.healthScore}
            size="small"
            strokeColor={getHealthScoreColor(record.healthScore)}
            showInfo={false}
          />
          <Text style={{ fontSize: '12px' }}>
            {record.healthScore}% Health
          </Text>
        </Space>
      ),
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record: ProviderHealth) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: '12px' }}>
            <CaretUpOutlined style={{ color: '#52c41a' }} /> {record.successRate}% Success
          </Text>
          <Text style={{ fontSize: '12px' }}>
            <ClockCircleOutlined /> {record.responseTime}ms
          </Text>
          <Text style={{ fontSize: '12px' }}>
            <ThunderboltOutlined /> {record.throughput}/min
          </Text>
        </Space>
      ),
    },
    {
      title: 'Circuit Breaker',
      dataIndex: 'circuitBreaker',
      key: 'circuitBreaker',
      render: (circuitBreaker: ProviderHealth['circuitBreaker']) => (
        <Space direction="vertical" size={0}>
          <Tag
            color={circuitBreaker.status === 'CLOSED' ? 'green' :
                   circuitBreaker.status === 'HALF_OPEN' ? 'orange' : 'red'}
          >
            {circuitBreaker.status}
          </Tag>
          <Text style={{ fontSize: '12px' }}>
            {circuitBreaker.failures}/{circuitBreaker.threshold} failures
          </Text>
        </Space>
      ),
    },
    {
      title: 'Quota',
      dataIndex: 'quotas',
      key: 'quotas',
      render: (quotas: ProviderHealth['quotas']) => (
        <Space direction="vertical" size={0}>
          <Progress
            percent={(quotas.current / quotas.limit) * 100}
            size="small"
            format={() => `${quotas.current.toLocaleString()}/${quotas.limit.toLocaleString()}`}
          />
          <Text style={{ fontSize: '12px' }}>
            Resets: {moment(quotas.resetTime).fromNow()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Cost',
      dataIndex: 'costs',
      key: 'costs',
      render: (costs: ProviderHealth['costs']) => (
        <Space direction="vertical" size={0}>
          <Text strong>${costs.current.toFixed(2)}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ${costs.projected.toFixed(2)} projected
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ProviderHealth) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewProvider(record)}
            />
          </Tooltip>
          {canRunTests && (
            <Tooltip title="Run Test">
              <Button
                type="text"
                icon={<ExperimentOutlined />}
                onClick={() => {
                  setSelectedProvider(record);
                  setTestModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {canManageProviders && (
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item key="config" icon={<SettingOutlined />}>
                    Configure
                  </Menu.Item>
                  <Menu.Item key="sla" icon={<SafetyOutlined />} onClick={() => {
                    setSelectedProvider(record);
                    setSlaModalVisible(true);
                  }}>
                    SLA Settings
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item key="disable" icon={<StopOutlined />} danger>
                    Disable Provider
                  </Menu.Item>
                </Menu>
              }
            >
              <Button type="text" icon={<SettingOutlined />} />
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  const slaColumns: ColumnType<SLACompliance>[] = [
    {
      title: 'Provider',
      dataIndex: 'providerName',
      key: 'providerName',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Overall Compliance',
      dataIndex: 'compliance',
      key: 'overall',
      render: (compliance: SLACompliance['compliance']) => (
        <Space>
          <Progress
            type="circle"
            percent={Math.round(compliance.overall)}
            size={50}
            strokeColor={compliance.overall >= 100 ? '#52c41a' : '#faad14'}
          />
          <div>
            <Text strong>{compliance.overall.toFixed(1)}%</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Overall
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Metrics',
      key: 'metrics',
      render: (_, record: SLACompliance) => (
        <Space direction="vertical" size={0}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 120 }}>
            <Text style={{ fontSize: '12px' }}>Uptime:</Text>
            <Text style={{ fontSize: '12px', color: record.compliance.uptime >= 100 ? '#52c41a' : '#faad14' }}>
              {record.actual.uptime}%
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 120 }}>
            <Text style={{ fontSize: '12px' }}>Response:</Text>
            <Text style={{ fontSize: '12px', color: record.compliance.responseTime >= 100 ? '#52c41a' : '#faad14' }}>
              {record.actual.responseTime}ms
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: 120 }}>
            <Text style={{ fontSize: '12px' }}>Success:</Text>
            <Text style={{ fontSize: '12px', color: record.compliance.successRate >= 100 ? '#52c41a' : '#faad14' }}>
              {record.actual.successRate}%
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Risk Level',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (riskLevel: string) => (
        <Tag color={getRiskLevelColor(riskLevel)}>
          {riskLevel}
        </Tag>
      ),
    },
    {
      title: 'Downtime Allowance',
      dataIndex: 'monthlyDowntime',
      key: 'monthlyDowntime',
      render: (downtime: SLACompliance['monthlyDowntime']) => (
        <Space direction="vertical" size={0}>
          <Progress
            percent={(downtime.used / downtime.allowed) * 100}
            size="small"
            strokeColor={downtime.used / downtime.allowed > 0.8 ? '#ff4d4f' : '#52c41a'}
            format={() => `${Math.round(downtime.used / 60)}m/${Math.round(downtime.allowed / 60)}m`}
          />
          <Text style={{ fontSize: '12px' }}>
            {Math.round(downtime.remaining / 60)}m remaining
          </Text>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: SLACompliance) => (
        <Space>
          <Tooltip title="View SLA Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedProvider(providersData?.data?.find(p => p.id === record.providerId) || null);
                setSlaModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Configure Alerts">
            <Button
              type="text"
              icon={<BellOutlined />}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!canViewProviderHealth) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Provider Health monitoring page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Provider Health Monitor
            </Title>
            <Text type="secondary">
              Real-time monitoring of notification provider health and performance
            </Text>
          </Col>
          <Col>
            <Space>
              <Select
                value={selectedTimeRange}
                onChange={setSelectedTimeRange}
                style={{ width: 120 }}
              >
                <Select.Option value="1h">Last Hour</Select.Option>
                <Select.Option value="24h">Last 24h</Select.Option>
                <Select.Option value="7d">Last 7 Days</Select.Option>
                <Select.Option value="30d">Last 30 Days</Select.Option>
              </Select>
              <Select
                value={selectedRegion}
                onChange={setSelectedRegion}
                style={{ width: 150 }}
              >
                <Select.Option value="all">All Regions</Select.Option>
                <Select.Option value="us-east-1">US East</Select.Option>
                <Select.Option value="us-west-2">US West</Select.Option>
                <Select.Option value="eu-west-1">Europe</Select.Option>
                <Select.Option value="ap-southeast-1">Asia Pacific</Select.Option>
              </Select>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren="Auto"
                unCheckedChildren="Manual"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchProviders();
                  refetchSLA();
                }}
              >
                Refresh
              </Button>
              {canManageProviders && (
                <Button type="primary" icon={<PlusOutlined />}>
                  Add Provider
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
              title="Healthy Providers"
              value={providersData?.data?.filter((p: ProviderHealth) => p.status === 'HEALTHY').length || 0}
              suffix={`/ ${providersData?.data?.length || 0}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Average Health Score"
              value={
                providersData?.data?.reduce((acc: number, p: ProviderHealth) => acc + p.healthScore, 0) /
                (providersData?.data?.length || 1)
              }
              precision={1}
              suffix="%"
              prefix={<DashboardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="SLA Compliance"
              value={slaData?.data?.filter((s: SLACompliance) => s.compliance.overall >= 100).length || 0}
              suffix={`/ ${slaData?.data?.length || 0}`}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Alerts"
              value={slaData?.data?.reduce((acc: number, s: SLACompliance) => acc + s.alerts.filter(a => !a.resolved).length, 0) || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
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
                <DashboardOutlined />
                Overview
              </span>
            }
            key="overview"
          >
            {/* Provider Health Overview */}
            <Row gutter={[16, 16]} className="mb-6">
              <Col span={24}>
                <Title level={4}>Provider Health Status</Title>
                <Row gutter={[16, 16]}>
                  {providersData?.data?.map((provider: ProviderHealth) => (
                    <Col xs={24} sm={12} md={8} lg={6} key={provider.id}>
                      <Card
                        size="small"
                        className={
                          provider.status === 'HEALTHY' ? 'border-green-200' :
                          provider.status === 'DEGRADED' ? 'border-orange-200' :
                          provider.status === 'UNHEALTHY' ? 'border-red-200' :
                          'border-blue-200'
                        }
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Space>
                            {getProviderIcon(provider.type)}
                            <Text strong>{provider.name}</Text>
                            <Badge
                              status={getStatusColor(provider.status) as any}
                              text={provider.status}
                            />
                          </Space>

                          <Progress
                            type="circle"
                            percent={provider.healthScore}
                            size={60}
                            strokeColor={getHealthScoreColor(provider.healthScore)}
                          />

                          <Row gutter={8}>
                            <Col span={12}>
                              <Text style={{ fontSize: '12px' }} type="secondary">Success Rate</Text>
                              <br />
                              <Text strong>{provider.successRate}%</Text>
                            </Col>
                            <Col span={12}>
                              <Text style={{ fontSize: '12px' }} type="secondary">Response Time</Text>
                              <br />
                              <Text strong>{provider.responseTime}ms</Text>
                            </Col>
                          </Row>

                          <Row gutter={8}>
                            <Col span={12}>
                              <Text style={{ fontSize: '12px' }} type="secondary">Throughput</Text>
                              <br />
                              <Text strong>{provider.throughput}/min</Text>
                            </Col>
                            <Col span={12}>
                              <Text style={{ fontSize: '12px' }} type="secondary">Cost</Text>
                              <br />
                              <Text strong>${provider.costs.current}</Text>
                            </Col>
                          </Row>

                          <Space>
                            <Tag
                              color={provider.circuitBreaker.status === 'CLOSED' ? 'green' :
                                     provider.circuitBreaker.status === 'HALF_OPEN' ? 'orange' : 'red'}
                            >
                              CB: {provider.circuitBreaker.status}
                            </Tag>
                            <Tag color="blue">
                              {provider.region}
                            </Tag>
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Col>
            </Row>

            {/* Performance Charts */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Performance Trends" size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="latency"
                        stroke="#8884d8"
                        name="Latency (ms)"
                      />
                      <Line
                        type="monotone"
                        dataKey="successRate"
                        stroke="#82ca9d"
                        name="Success Rate (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Provider Comparison" size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={providerComparisonData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" />
                      <PolarRadiusAxis />
                      <Radar
                        name="Health Score"
                        dataKey="healthScore"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.3}
                      />
                      <Radar
                        name="Success Rate"
                        dataKey="successRate"
                        stroke="#82ca9d"
                        fill="#82ca9d"
                        fillOpacity={0.3}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane
            tab={
              <span>
                <MonitorOutlined />
                Providers
              </span>
            }
            key="providers"
          >
            <Table
              columns={providerColumns}
              dataSource={providersData?.data || []}
              loading={providersLoading}
              rowKey="id"
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} providers`,
              }}
              scroll={{ x: 1000 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <SafetyOutlined />
                SLA Compliance
              </span>
            }
            key="sla"
          >
            {/* SLA Overview Cards */}
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="SLA Compliant Providers"
                    value={slaData?.data?.filter((s: SLACompliance) => s.compliance.overall >= 100).length || 0}
                    suffix={`/ ${slaData?.data?.length || 0}`}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="Average Compliance"
                    value={
                      slaData?.data?.reduce((acc: number, s: SLACompliance) => acc + s.compliance.overall, 0) /
                      (slaData?.data?.length || 1)
                    }
                    precision={1}
                    suffix="%"
                    prefix={<BarChartOutlined />}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card>
                  <Statistic
                    title="High Risk Providers"
                    value={slaData?.data?.filter((s: SLACompliance) =>
                      ['HIGH', 'CRITICAL'].includes(s.riskLevel)
                    ).length || 0}
                    prefix={<WarningOutlined />}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* SLA Compliance Chart */}
            <Row gutter={[16, 16]} className="mb-6">
              <Col span={24}>
                <Card title="SLA Compliance Overview" size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={slaComplianceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="provider" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="uptime" fill="#52c41a" name="Uptime %" />
                      <Bar dataKey="responseTime" fill="#1890ff" name="Response Time %" />
                      <Bar dataKey="successRate" fill="#722ed1" name="Success Rate %" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            <Table
              columns={slaColumns}
              dataSource={slaData?.data || []}
              loading={slaLoading}
              rowKey="providerId"
              pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} SLA records`,
              }}
              scroll={{ x: 800 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <LineChartOutlined />
                Analytics
              </span>
            }
            key="analytics"
          >
            <Row gutter={[16, 16]} className="mb-6">
              <Col span={24}>
                <Card title="Regional Performance Heatmap" size="small">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={regionHeatmapData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="region" />
                      <YAxis />
                      <RechartsTooltip />
                      <Legend />
                      <Bar dataKey="SendGrid" fill="#8884d8" name="SendGrid (ms)" />
                      <Bar dataKey="Twilio" fill="#82ca9d" name="Twilio (ms)" />
                      <Bar dataKey="FCM" fill="#ffc658" name="FCM (ms)" />
                      <Bar dataKey="OneSignal" fill="#ff7300" name="OneSignal (ms)" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Cost Analysis" size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={providerComparisonData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, cost }) => `${name}: $${cost.toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
                      >
                        {providerComparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
                        ))}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Throughput Analysis" size="small">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Area
                        type="monotone"
                        dataKey="throughput"
                        stroke="#8884d8"
                        fill="#8884d8"
                        fillOpacity={0.3}
                        name="Messages/min"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane
            tab={
              <span>
                <ExperimentOutlined />
                Testing
              </span>
            }
            key="testing"
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card title="Provider Testing Tools" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Alert
                      message="Testing Guidelines"
                      description="Run provider tests during low-traffic periods to minimize impact on production services. Test results are logged for audit purposes."
                      type="info"
                      showIcon
                      className="mb-4"
                    />

                    <Row gutter={[16, 16]}>
                      {providersData?.data?.map((provider: ProviderHealth) => (
                        <Col xs={24} sm={12} md={8} lg={6} key={provider.id}>
                          <Card size="small" hoverable>
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <Space>
                                {getProviderIcon(provider.type)}
                                <Text strong>{provider.name}</Text>
                              </Space>

                              <Space direction="vertical" style={{ width: '100%' }}>
                                <Button
                                  block
                                  icon={<PlayCircleOutlined />}
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setTestModalVisible(true);
                                  }}
                                >
                                  Health Check
                                </Button>
                                <Button
                                  block
                                  icon={<ThunderboltOutlined />}
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setTestModalVisible(true);
                                  }}
                                >
                                  Performance Test
                                </Button>
                                <Button
                                  block
                                  icon={<CloudOutlined />}
                                  onClick={() => {
                                    setSelectedProvider(provider);
                                    setTestModalVisible(true);
                                  }}
                                >
                                  Load Test
                                </Button>
                              </Space>

                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                Last test: Never
                              </Text>
                            </Space>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Space>
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>

      {/* Provider Details Modal */}
      <Modal
        title={
          <Space>
            {selectedProvider && getProviderIcon(selectedProvider.type)}
            Provider Details: {selectedProvider?.name}
          </Space>
        }
        visible={providerModalVisible}
        onCancel={() => setProviderModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setProviderModalVisible(false)}>
            Close
          </Button>,
          canRunTests && (
            <Button key="test" icon={<ExperimentOutlined />} onClick={() => {
              setProviderModalVisible(false);
              setTestModalVisible(true);
            }}>
              Run Test
            </Button>
          ),
          canManageProviders && (
            <Button key="configure" type="primary" icon={<SettingOutlined />}>
              Configure
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedProvider && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Provider Name" span={2}>
              {selectedProvider.name}
            </Descriptions.Item>
            <Descriptions.Item label="Type">
              <Tag color="blue">{selectedProvider.type.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getStatusColor(selectedProvider.status) as any}
                text={selectedProvider.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Health Score">
              <Progress
                percent={selectedProvider.healthScore}
                strokeColor={getHealthScoreColor(selectedProvider.healthScore)}
                format={() => `${selectedProvider.healthScore}%`}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Uptime">
              {selectedProvider.uptime}%
            </Descriptions.Item>
            <Descriptions.Item label="Response Time">
              {selectedProvider.responseTime}ms
            </Descriptions.Item>
            <Descriptions.Item label="Success Rate">
              {selectedProvider.successRate}%
            </Descriptions.Item>
            <Descriptions.Item label="Throughput">
              {selectedProvider.throughput} messages/min
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              {selectedProvider.region}
            </Descriptions.Item>
            <Descriptions.Item label="Priority">
              {selectedProvider.priority}
            </Descriptions.Item>
            <Descriptions.Item label="Circuit Breaker Status">
              <Tag
                color={selectedProvider.circuitBreaker.status === 'CLOSED' ? 'green' :
                       selectedProvider.circuitBreaker.status === 'HALF_OPEN' ? 'orange' : 'red'}
              >
                {selectedProvider.circuitBreaker.status}
              </Tag>
              ({selectedProvider.circuitBreaker.failures}/{selectedProvider.circuitBreaker.threshold} failures)
            </Descriptions.Item>
            <Descriptions.Item label="Last Check">
              {moment(selectedProvider.lastCheck).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Current Cost" span={2}>
              ${selectedProvider.costs.current.toFixed(2)} (${selectedProvider.costs.projected.toFixed(2)} projected)
            </Descriptions.Item>
            <Descriptions.Item label="Quota Usage" span={2}>
              <Progress
                percent={(selectedProvider.quotas.current / selectedProvider.quotas.limit) * 100}
                format={() => `${selectedProvider.quotas.current.toLocaleString()}/${selectedProvider.quotas.limit.toLocaleString()}`}
              />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Resets: {moment(selectedProvider.quotas.resetTime).fromNow()}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Provider Test Modal */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined />
            Test Provider: {selectedProvider?.name}
          </Space>
        }
        visible={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        onOk={handleTestProvider}
        confirmLoading={testProviderMutation.isLoading}
        width={600}
      >
        <Form form={testForm} layout="vertical">
          <Form.Item
            label="Test Type"
            name="testType"
            rules={[{ required: true, message: 'Please select test type' }]}
          >
            <RadioGroup>
              <Radio value="HEALTH_CHECK">Health Check</Radio>
              <Radio value="PERFORMANCE">Performance Test</Radio>
              <Radio value="LOAD">Load Test</Radio>
              <Radio value="FAILOVER">Failover Test</Radio>
            </RadioGroup>
          </Form.Item>

          <Form.Item
            label="Test Message Count"
            name="messageCount"
            initialValue={10}
            rules={[{ required: true, message: 'Please enter message count' }]}
          >
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Test Regions"
            name="regions"
            initialValue={['us-east-1']}
          >
            <Checkbox.Group>
              <Checkbox value="us-east-1">US East</Checkbox>
              <Checkbox value="us-west-2">US West</Checkbox>
              <Checkbox value="eu-west-1">Europe</Checkbox>
              <Checkbox value="ap-southeast-1">Asia Pacific</Checkbox>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label="Test Duration (seconds)"
            name="duration"
            initialValue={60}
            rules={[{ required: true, message: 'Please enter test duration' }]}
          >
            <InputNumber min={10} max={300} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Concurrency Level"
            name="concurrency"
            initialValue={1}
          >
            <Slider min={1} max={10} marks={{ 1: '1', 5: '5', 10: '10' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* SLA Settings Modal */}
      <Modal
        title={
          <Space>
            <SafetyOutlined />
            SLA Settings: {selectedProvider?.name}
          </Space>
        }
        visible={slaModalVisible}
        onCancel={() => setSlaModalVisible(false)}
        onOk={handleUpdateSLA}
        confirmLoading={updateSLAMutation.isLoading}
        width={700}
      >
        <Form form={slaForm} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Uptime Target (%)"
                name="uptimeTarget"
                initialValue={99.5}
                rules={[{ required: true, message: 'Please enter uptime target' }]}
              >
                <InputNumber min={90} max={100} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Response Time Target (ms)"
                name="responseTimeTarget"
                initialValue={200}
                rules={[{ required: true, message: 'Please enter response time target' }]}
              >
                <InputNumber min={50} max={5000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Success Rate Target (%)"
                name="successRateTarget"
                initialValue={99.0}
                rules={[{ required: true, message: 'Please enter success rate target' }]}
              >
                <InputNumber min={90} max={100} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Monthly Downtime Allowance (minutes)"
                name="monthlyDowntimeAllowance"
                initialValue={2160}
                rules={[{ required: true, message: 'Please enter downtime allowance' }]}
              >
                <InputNumber min={0} max={43200} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Alert Threshold (%)"
                name="alertThreshold"
                initialValue={80}
                rules={[{ required: true, message: 'Please enter alert threshold' }]}
              >
                <InputNumber min={50} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Alert Channels"
            name="alertChannels"
            initialValue={['email', 'slack']}
          >
            <Checkbox.Group>
              <Checkbox value="email">Email</Checkbox>
              <Checkbox value="slack">Slack</Checkbox>
              <Checkbox value="pagerduty">PagerDuty</Checkbox>
              <Checkbox value="webhook">Webhook</Checkbox>
            </Checkbox.Group>
          </Form.Item>

          <Form.Item
            label="Auto-failover Enabled"
            name="autoFailover"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Escalation Policy"
            name="escalationPolicy"
          >
            <TextArea rows={4} placeholder="Define escalation rules and notification preferences..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProviderHealth;