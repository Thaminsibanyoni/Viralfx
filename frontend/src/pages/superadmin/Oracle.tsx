import React, { useState, useEffect } from 'react';
import {
  
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Empty, Spin, Slider, Steps, } from 'antd';
import {
  DatabaseOutlined, CloudServerOutlined, ReloadOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined, SettingOutlined, EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, GlobalOutlined, ThunderboltOutlined, LineChartOutlined, BarChartOutlined, ClockCircleOutlined, ApiOutlined, SecurityScanOutlined, RocketOutlined, SyncOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { OracleNode, OracleRequest } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;
const {Step} = Steps;

interface OracleNodeFilters {
  page: number;
  limit: number;
  status?: string;
  region?: string;
  search?: string;
}

interface OracleRequestFilters {
  page: number;
  limit: number;
  status?: string;
  dataType?: string;
  startDate?: string;
  endDate?: string;
}

const Oracle: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('nodes');
  const [nodeFilters, setNodeFilters] = useState<OracleNodeFilters>({
    page: 1,
    limit: 20,
  });
  const [requestFilters, setRequestFilters] = useState<OracleRequestFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedNode, setSelectedNode] = useState<OracleNode | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<OracleRequest | null>(null);
  const [nodeModalVisible, setNodeModalVisible] = useState<boolean>(false);
  const [requestModalVisible, setRequestModalVisible] = useState<boolean>(false);
  const [healthModalVisible, setHealthModalVisible] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(30000); // 30 seconds

  // Permissions
  const canViewOracle = checkPermission('oracle:view');
  const canManageOracle = checkPermission('oracle:manage');
  const canRestartNodes = checkPermission('oracle:restart');
  const canViewHealth = checkPermission('oracle:health');

  // Data fetching
  const {data: oracleNodesData, isLoading: nodesLoading, refetch: refetchNodes, } = useQuery(
    ['oracle-nodes', nodeFilters],
    () => adminApi.getOracleNodes(nodeFilters),
    {
      enabled: canViewOracle,
      keepPreviousData: true,
      refetchInterval: refreshInterval,
    }
  );

  const {data: oracleRequestsData, isLoading: requestsLoading, refetch: refetchRequests, } = useQuery(
    ['oracle-requests', requestFilters],
    () => adminApi.getOracleRequests ? adminApi.getOracleRequests(requestFilters) : { data: [], total: 0, page: 1, limit: 20 },
    {
      enabled: canViewOracle && !!adminApi.getOracleRequests,
      keepPreviousData: true,
      refetchInterval: refreshInterval,
    }
  );

  const {data: consensusHealth, isLoading: healthLoading, refetch: refetchHealth, } = useQuery(
    'oracle-consensus-health',
    () => adminApi.getConsensusHealth(),
    {
      enabled: canViewHealth,
      refetchInterval: refreshInterval,
    }
  );

  // Mutations
  const restartNodeMutation = useMutation(
    (nodeId: string) => adminApi.restartNode(nodeId),
    {
      onSuccess: () => {
        message.success('Oracle node restarted successfully');
        queryClient.invalidateQueries('oracle-nodes');
      },
      onError: () => {
        message.error('Failed to restart Oracle node');
      },
    }
  );

  const disableNodeMutation = useMutation(
    ({ nodeId, reason }: { nodeId: string; reason: string }) =>
      adminApi.disableNode(nodeId, reason),
    {
      onSuccess: () => {
        message.success('Oracle node disabled successfully');
        queryClient.invalidateQueries('oracle-nodes');
      },
      onError: () => {
        message.error('Failed to disable Oracle node');
      },
    }
  );

  const enableNodeMutation = useMutation(
    (nodeId: string) => adminApi.enableNode(nodeId),
    {
      onSuccess: () => {
        message.success('Oracle node enabled successfully');
        queryClient.invalidateQueries('oracle-nodes');
      },
      onError: () => {
        message.error('Failed to enable Oracle node');
      },
    }
  );

  // Auto-refresh effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'nodes') {
        refetchNodes();
      } else if (activeTab === 'requests') {
        refetchRequests();
      }
      refetchHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, activeTab]);

  // Event handlers
  const handleNodeFilterChange = (key: string, value: any) => {
    setNodeFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleRequestFilterChange = (key: string, value: any) => {
    setRequestFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewNode = (node: OracleNode) => {
    setSelectedNode(node);
    setNodeModalVisible(true);
  };

  const handleViewRequest = (request: OracleRequest) => {
    setSelectedRequest(request);
    setRequestModalVisible(true);
  };

  const handleRestartNode = (nodeId: string) => {
    restartNodeMutation.mutate(nodeId);
  };

  const handleDisableNode = (nodeId: string, reason: string) => {
    disableNodeMutation.mutate({ nodeId, reason });
  };

  const handleEnableNode = (nodeId: string) => {
    enableNodeMutation.mutate(nodeId);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      ONLINE: 'green',
      OFFLINE: 'red',
      MAINTENANCE: 'orange',
      SUSPENDED: 'purple',
      DECOMMISSIONED: 'gray',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  const getRequestStatusColor = (status: string) => {
    const colors = {
      PENDING: 'orange',
      PROCESSING: 'blue',
      COMPLETED: 'green',
      FAILED: 'red',
    };
    return colors[status as keyof typeof colors] || 'default';
  };

  // Table columns for Oracle Nodes
  const nodeColumns: ColumnType<OracleNode>[] = [
    {
      title: 'Node ID',
      dataIndex: 'nodeId',
      key: 'nodeId',
      render: (nodeId: string) => (
        <Text code copyable={{ text: nodeId }}>
          {nodeId.slice(-8)}
        </Text>
      ),
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (endpoint: string) => (
        <Tooltip title={endpoint}>
          <Text ellipsis style={{ maxWidth: 150 }}>{endpoint}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      render: (region: string) => (
        <Tag color="geekblue" icon={<GlobalOutlined />}>{region}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status}
        />
      ),
    },
    {
      title: 'Reputation',
      dataIndex: 'reputation',
      key: 'reputation',
      render: (reputation: number) => (
        <Progress
          percent={reputation}
          size="small"
          status={reputation > 80 ? 'success' : reputation > 50 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(1)}`}
        />
      ),
      sorter: (a, b) => a.reputation - b.reputation,
    },
    {
      title: 'Uptime',
      dataIndex: 'uptimePercentage',
      key: 'uptimePercentage',
      render: (uptime: number) => (
        <Progress
          percent={uptime}
          size="small"
          status={uptime > 99 ? 'success' : uptime > 95 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(2)}%`}
        />
      ),
      sorter: (a, b) => a.uptimePercentage - b.uptimePercentage,
    },
    {
      title: 'Performance',
      key: 'performance',
      render: (_, record: OracleNode) => (
        <Space direction="vertical" size={0}>
          <Text type="secondary">
            Requests: {record.performance.recentRequests}
          </Text>
          <Text type="secondary">
            Response: {record.performance.averageResponseTime}ms
          </Text>
          <Text type="secondary">
            Consensus: {record.performance.consensusScore}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      render: (date: string) => (
        <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
          {moment(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: OracleNode) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewNode(record)}
            />
          </Tooltip>
          {canRestartNodes && record.status === 'ONLINE' && (
            <Tooltip title="Restart Node">
              <Popconfirm
                title="Restart Node"
                description="Are you sure you want to restart this Oracle node?"
                onConfirm={() => handleRestartNode(record.id)}
                okText="Restart"
                cancelText="Cancel"
              >
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  loading={restartNodeMutation.isLoading}
                />
              </Popconfirm>
            </Tooltip>
          )}
          {canManageOracle && record.status === 'ONLINE' && (
            <Tooltip title="Disable Node">
              <Popconfirm
                title="Disable Node"
                description="Are you sure you want to disable this Oracle node?"
                onConfirm={() => handleDisableNode(record.id, 'Administrative action')}
                okText="Disable"
                cancelText="Cancel"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  icon={<StopOutlined />}
                  danger
                  loading={disableNodeMutation.isLoading}
                />
              </Popconfirm>
            </Tooltip>
          )}
          {canManageOracle && record.status === 'SUSPENDED' && (
            <Tooltip title="Enable Node">
              <Button
                type="text"
                icon={<PlayCircleOutlined />}
                onClick={() => handleEnableNode(record.id)}
                loading={enableNodeMutation.isLoading}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Table columns for Oracle Requests
  const requestColumns: ColumnType<OracleRequest>[] = [
    {
      title: 'Request ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => (
        <Text code copyable={{ text: id }}>
          {id.slice(-8)}
        </Text>
      ),
    },
    {
      title: 'Topic',
      key: 'topic',
      render: (_, record: OracleRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.topic?.title || record.topicId}</Text>
          <Text code>{record.topic?.symbol || 'Unknown'}</Text>
        </Space>
      ),
    },
    {
      title: 'Data Type',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (type: string) => (
        <Tag color="blue" icon={<ApiOutlined />}>{type}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getRequestStatusColor(status) as any}
          text={status}
        />
      ),
    },
    {
      title: 'Consensus',
      dataIndex: 'consensusLevel',
      key: 'consensusLevel',
      render: (level: number) => (
        <Progress
          percent={level}
          size="small"
          status={level > 80 ? 'success' : level > 50 ? 'normal' : 'exception'}
          format={(percent) => `${percent?.toFixed(1)}%`}
        />
      ),
    },
    {
      title: 'Responses',
      key: 'responses',
      render: (_, record: OracleRequest) => (
        <Space direction="vertical" size={0}>
          <Text>Valid: {record.validResponses}/{record.totalResponses}</Text>
          <Progress
            percent={record.totalResponses > 0 ? (record.validResponses / record.totalResponses) * 100 : 0}
            size="small"
            showInfo={false}
          />
        </Space>
      ),
    },
    {
      title: 'Processing Time',
      dataIndex: 'processingTime',
      key: 'processingTime',
      render: (time: number) => (
        <Text>{time ? `${time}ms` : '-'}</Text>
      ),
    },
    {
      title: 'Requested',
      dataIndex: 'requestedAt',
      key: 'requestedAt',
      render: (date: string) => (
        <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
          {moment(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: OracleRequest) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewRequest(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!canViewOracle) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Oracle Management page."
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
              Oracle Management
            </Title>
            <Text type="secondary">Manage Oracle nodes and data requests</Text>
          </Col>
          <Col>
            <Space>
              <Select
                value={refreshInterval}
                onChange={setRefreshInterval}
                style={{ width: 150 }}
              >
                <Select.Option value={5000}>5 seconds</Select.Option>
                <Select.Option value={15000}>15 seconds</Select.Option>
                <Select.Option value={30000}>30 seconds</Select.Option>
                <Select.Option value={60000}>1 minute</Select.Option>
                <Select.Option value={0}>Manual</Select.Option>
              </Select>
              <Button
                icon={<SyncOutlined />}
                onClick={() => {
                  refetchNodes();
                  refetchRequests();
                  refetchHealth();
                }}
              >
                Refresh
              </Button>
              {canViewHealth && (
                <Button
                  icon={<BarChartOutlined />}
                  onClick={() => setHealthModalVisible(true)}
                >
                  Consensus Health
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
              title="Total Nodes"
              value={oracleNodesData?.total || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Online Nodes"
              value={oracleNodesData?.data?.filter((n: OracleNode) => n.status === 'ONLINE').length || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Reputation"
              value={oracleNodesData?.data?.reduce((acc: number, n: OracleNode) => acc + n.reputation, 0) / (oracleNodesData?.data?.length || 0) || 0}
              precision={1}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending Requests"
              value={oracleRequestsData?.data?.filter((r: OracleRequest) => r.status === 'PENDING').length || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Consensus Health Summary */}
      {consensusHealth && (
        <Card className="mb-4" size="small">
          <Row gutter={16} align="middle">
            <Col span={6}>
              <Statistic
                title="Network Health"
                value={consensusHealth.overallHealth}
                precision={1}
                suffix="%"
                valueStyle={{
                  color: consensusHealth.overallHealth > 90 ? '#52c41a' :
                         consensusHealth.overallHealth > 70 ? '#fa8c16' : '#ff4d4f'
                }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Active Nodes"
                value={consensusHealth.activeNodes}
                suffix={`/ ${consensusHealth.totalNodes}`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Avg Response Time"
                value={consensusHealth.averageResponseTime}
                suffix="ms"
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Success Rate"
                value={consensusHealth.successRate}
                precision={1}
                suffix="%"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <CloudServerOutlined />
                Oracle Nodes
              </span>
            }
            key="nodes"
          >
            {/* Node Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Input
                    placeholder="Search nodes..."
                    prefix={<SearchOutlined />}
                    value={nodeFilters.search}
                    onChange={(e) => handleNodeFilterChange('search', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={nodeFilters.status}
                    onChange={(value) => handleNodeFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="ONLINE">Online</Select.Option>
                    <Select.Option value="OFFLINE">Offline</Select.Option>
                    <Select.Option value="MAINTENANCE">Maintenance</Select.Option>
                    <Select.Option value="SUSPENDED">Suspended</Select.Option>
                    <Select.Option value="DECOMMISSIONED">Decommissioned</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Region"
                    value={nodeFilters.region}
                    onChange={(value) => handleNodeFilterChange('region', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="US">US</Select.Option>
                    <Select.Option value="EU">EU</Select.Option>
                    <Select.Option value="ASIA">Asia</Select.Option>
                    <Select.Option value="GLOBAL">Global</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Text type="secondary">
                    Auto-refresh: {refreshInterval === 0 ? 'Manual' : `${refreshInterval / 1000}s`}
                  </Text>
                </Col>
              </Row>
            </Card>

            {/* Nodes Table */}
            <Table
              columns={nodeColumns}
              dataSource={oracleNodesData?.data || []}
              loading={nodesLoading}
              rowKey="id"
              pagination={{
                current: nodeFilters.page,
                pageSize: nodeFilters.limit,
                total: oracleNodesData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} nodes`,
                onChange: (page, pageSize) => {
                  setNodeFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1400 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <ApiOutlined />
                Data Requests
              </span>
            }
            key="requests"
          >
            {/* Request Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Status"
                    value={requestFilters.status}
                    onChange={(value) => handleRequestFilterChange('status', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="PENDING">Pending</Select.Option>
                    <Select.Option value="PROCESSING">Processing</Select.Option>
                    <Select.Option value="COMPLETED">Completed</Select.Option>
                    <Select.Option value="FAILED">Failed</Select.Option>
                  </Select>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Select
                    placeholder="Data Type"
                    value={requestFilters.dataType}
                    onChange={(value) => handleRequestFilterChange('dataType', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="PRICE">Price Data</Select.Option>
                    <Select.Option value="VOLUME">Volume Data</Select.Option>
                    <Select.Option value="SENTIMENT">Sentiment Analysis</Select.Option>
                    <Select.Option value="SOCIAL">Social Metrics</Select.Option>
                  </Select>
                </Col>
              </Row>
            </Card>

            {/* Requests Table */}
            <Table
              columns={requestColumns}
              dataSource={oracleRequestsData?.data || []}
              loading={requestsLoading}
              rowKey="id"
              pagination={{
                current: requestFilters.page,
                pageSize: requestFilters.limit,
                total: oracleRequestsData?.total || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} requests`,
                onChange: (page, pageSize) => {
                  setRequestFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1200 }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Node Details Modal */}
      <Modal
        title={
          <Space>
            <CloudServerOutlined />
            Oracle Node Details
          </Space>
        }
        visible={nodeModalVisible}
        onCancel={() => setNodeModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setNodeModalVisible(false)}>
            Close
          </Button>,
          canRestartNodes && selectedNode?.status === 'ONLINE' && (
            <Popconfirm
              title="Restart Node"
              description="Are you sure you want to restart this Oracle node?"
              onConfirm={() => selectedNode && handleRestartNode(selectedNode.id)}
              okText="Restart"
              cancelText="Cancel"
            >
              <Button
                key="restart"
                icon={<ReloadOutlined />}
                loading={restartNodeMutation.isLoading}
              >
                Restart Node
              </Button>
            </Popconfirm>
          ),
        ]}
        width={800}
      >
        {selectedNode && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Node ID" span={2}>
              <Text code copyable={{ text: selectedNode.nodeId }}>
                {selectedNode.nodeId}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Endpoint" span={2}>
              {selectedNode.endpoint}
            </Descriptions.Item>
            <Descriptions.Item label="Region">
              <Tag color="geekblue">{selectedNode.region}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getStatusColor(selectedNode.status) as any}
                text={selectedNode.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Version">
              {selectedNode.version}
            </Descriptions.Item>
            <Descriptions.Item label="Public Key">
              <Text code copyable style={{ fontSize: '12px' }}>
                {selectedNode.publicKey.slice(0, 32)}...
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Reputation Score">
              <Progress
                percent={selectedNode.reputation}
                status={selectedNode.reputation > 80 ? 'success' : 'normal'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Uptime">
              <Progress
                percent={selectedNode.uptimePercentage}
                status={selectedNode.uptimePercentage > 99 ? 'success' : 'normal'}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Performance" span={2}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Recent Requests"
                    value={selectedNode.performance.recentRequests}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Avg Response Time"
                    value={selectedNode.performance.averageResponseTime}
                    suffix="ms"
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Consensus Score"
                    value={selectedNode.performance.consensusScore}
                  />
                </Col>
              </Row>
            </Descriptions.Item>
            <Descriptions.Item label="Total Requests">
              {selectedNode.totalRequests.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="Response Rate">
              {selectedNode.responseRate.toFixed(2)}%
            </Descriptions.Item>
            <Descriptions.Item label="Last Seen">
              {moment(selectedNode.lastSeen).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Created">
              {moment(selectedNode.createdAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Request Details Modal */}
      <Modal
        title={
          <Space>
            <ApiOutlined />
            Oracle Request Details
          </Space>
        }
        visible={requestModalVisible}
        onCancel={() => setRequestModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setRequestModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {selectedRequest && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Request ID" span={2}>
              <Text code copyable={{ text: selectedRequest.id }}>
                {selectedRequest.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Topic">
              {selectedRequest.topic?.title || 'Unknown'}
            </Descriptions.Item>
            <Descriptions.Item label="Symbol">
              <Text code>{selectedRequest.topic?.symbol || 'Unknown'}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Data Type">
              <Tag color="blue">{selectedRequest.dataType}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Status">
              <Badge
                status={getRequestStatusColor(selectedRequest.status) as any}
                text={selectedRequest.status}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Consensus Level">
              <Progress
                percent={selectedRequest.consensusLevel}
                size="small"
              />
            </Descriptions.Item>
            <Descriptions.Item label="Responses">
              {selectedRequest.validResponses} / {selectedRequest.totalResponses}
            </Descriptions.Item>
            <Descriptions.Item label="Processing Time">
              {selectedRequest.processingTime ? `${selectedRequest.processingTime}ms` : '-'}
            </Descriptions.Item>
            {selectedRequest.finalResult && (
              <Descriptions.Item label="Result" span={2}>
                <pre style={{
                  background: '#f5f5f5',
                  padding: '8px',
                  borderRadius: '4px',
                  fontSize: '12px'
                }}>
                  {JSON.stringify(selectedRequest.finalResult, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Requested">
              {moment(selectedRequest.requestedAt).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Completed">
              {selectedRequest.completedAt ?
                moment(selectedRequest.completedAt).format('YYYY-MM-DD HH:mm:ss') :
                '-'
              }
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Consensus Health Modal */}
      <Modal
        title={
          <Space>
            <BarChartOutlined />
            Consensus Health Dashboard
          </Space>
        }
        visible={healthModalVisible}
        onCancel={() => setHealthModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHealthModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {consensusHealth ? (
          <div>
            <Row gutter={[16, 16]} className="mb-4">
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Overall Network Health"
                    value={consensusHealth.overallHealth}
                    precision={1}
                    suffix="%"
                    valueStyle={{
                      color: consensusHealth.overallHealth > 90 ? '#52c41a' :
                             consensusHealth.overallHealth > 70 ? '#fa8c16' : '#ff4d4f'
                    }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card>
                  <Statistic
                    title="Success Rate"
                    value={consensusHealth.successRate}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions bordered column={1}>
              <Descriptions.Item label="Active Nodes">
                {consensusHealth.activeNodes} / {consensusHealth.totalNodes}
              </Descriptions.Item>
              <Descriptions.Item label="Average Response Time">
                {consensusHealth.averageResponseTime}ms
              </Descriptions.Item>
              <Descriptions.Item label="Last Consensus Check">
                {moment(consensusHealth.lastCheck).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            {consensusHealth.nodeHealth && (
              <div className="mt-4">
                <Title level={5}>Individual Node Health</Title>
                <List
                  dataSource={consensusHealth.nodeHealth}
                  renderItem={(node: any) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<CloudServerOutlined />} />}
                        title={node.nodeId}
                        description={
                          <Space>
                            <Badge
                              status={node.online ? 'success' : 'error'}
                              text={node.online ? 'Online' : 'Offline'}
                            />
                            <Text>Health: {node.health}%</Text>
                            <Text>Response: {node.responseTime}ms</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        ) : (
          <Spin />
        )}
      </Modal>
    </div>
  );
};

export default Oracle;