import React, { useState } from 'react';
import {
  Table, Card, Button, Space, Tag, Typography, Input, Select, Progress, Badge, Tooltip, Popconfirm, Modal, Form, message, Row, Col, Statistic, Drawer, Descriptions, Tabs, Alert, Upload, InputNumber, } from 'antd';
import {
  TeamOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, CheckOutlined, CloseOutlined, StopOutlined, TrophyOutlined, SafetyOutlined, DollarOutlined, UsersOutlined, FileTextOutlined, ReloadOutlined, WarningOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';
import { Broker } from '../../types/admin.types';
import BrokerDetailDrawer from '../../components/superadmin/BrokerDetailDrawer';
import BrokerApprovalModal from '../../components/superadmin/BrokerApprovalModal';
import FSCAVerificationModal from '../../components/superadmin/FSCAVerificationModal';
import TierUpgradeModal from '../../components/superadmin/TierUpgradeModal';

const {Title, Text} = Typography;
const {Option} = Select;
const {Search} = Input;
const {TabPane} = Tabs;

const Brokers: React.FC = () => {
  const queryClient = useQueryClient();
  const {checkPermission} = useAdminStore();

  // State
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    status: undefined,
    tier: undefined,
    search: '',
    fscaVerified: undefined,
    minClients: undefined,
    maxClients: undefined,
  });

  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [approvalModalVisible, setApprovalModalVisible] = useState(false);
  const [fscaModalVisible, setFscaModalVisible] = useState(false);
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Queries
  const {data: brokersData, isLoading, error, refetch, } = useQuery({
    queryKey: ['admin-brokers', filters],
    queryFn: () => adminApi.getBrokers(filters),
    keepPreviousData: true,
  });

  const {data: brokerStats} = useQuery({
    queryKey: ['admin-broker-stats'],
    queryFn: () => adminApi.getBrokerStats(),
  });

  // Mutations
  const approveBrokerMutation = useMutation({
    mutationFn: (brokerId: string) => adminApi.approveBroker(brokerId),
    onSuccess: () => {
      message.success('Broker approved successfully');
      queryClient.invalidateQueries(['admin-brokers']);
      setApprovalModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to approve broker');
    },
  });

  const rejectBrokerMutation = useMutation({
    mutationFn: ({ brokerId, reason }: { brokerId: string; reason: string }) =>
      adminApi.rejectBroker(brokerId, reason),
    onSuccess: () => {
      message.success('Broker application rejected');
      queryClient.invalidateQueries(['admin-brokers']);
      setApprovalModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to reject broker');
    },
  });

  const suspendBrokerMutation = useMutation({
    mutationFn: ({ brokerId, reason }: { brokerId: string; reason: string }) =>
      adminApi.suspendBroker(brokerId, reason),
    onSuccess: () => {
      message.success('Broker suspended successfully');
      queryClient.invalidateQueries(['admin-brokers']);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to suspend broker');
    },
  });

  const verifyBrokerMutation = useMutation({
    mutationFn: ({ brokerId, verificationData }: { brokerId: string; verificationData: any }) =>
      adminApi.verifyBroker(brokerId, verificationData),
    onSuccess: () => {
      message.success('FSCA verification completed');
      queryClient.invalidateQueries(['admin-brokers']);
      setFscaModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to verify broker');
    },
  });

  // Event handlers
  const handleSearch = (value: string) => {
    setFilters({ ...filters, search: value, page: 1 });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handleTableChange = (pagination: any) => {
    setFilters({
      ...filters,
      page: pagination.current,
      limit: pagination.pageSize,
    });
  };

  const handleViewBroker = (broker: Broker) => {
    setSelectedBroker(broker);
    setDetailDrawerVisible(true);
  };

  const handleApproveBroker = (broker: Broker) => {
    setSelectedBroker(broker);
    setApprovalModalVisible(true);
  };

  const handleSuspendBroker = (broker: Broker) => {
    Modal.confirm({
      title: 'Suspend Broker',
      content: (
        <Form layout="vertical">
          <Form.Item
            name="reason"
            label="Suspension Reason"
            rules={[{ required: true, message: 'Please enter a reason for suspension' }]}
          >
            <Input.TextArea placeholder="Enter suspension reason..." />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const form = document.querySelector('form');
        const reason = form?.querySelector('textarea')?.value;

        if (reason) {
          await suspendBrokerMutation.mutateAsync({
            brokerId: broker.id,
            reason,
          });
        }
      },
    });
  };

  const handleFSCAVerification = (broker: Broker) => {
    setSelectedBroker(broker);
    setFscaModalVisible(true);
  };

  const handleTierUpgrade = (broker: Broker) => {
    setSelectedBroker(broker);
    setTierModalVisible(true);
  };

  const handleExport = () => {
    setExportModalVisible(true);
  };

  // Table columns
  const columns: ColumnsType<Broker> = [
    {
      title: 'Broker',
      key: 'broker',
      width: 200,
      render: (_, record) => (
        <Space>
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <TeamOutlined className="text-purple-600 text-lg" />
          </div>
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-sm text-gray-500">{record.email}</div>
            {record.registrationNumber && (
              <div className="text-xs text-gray-400">
                Reg: {record.registrationNumber}
              </div>
            )}
          </div>
        </Space>
      ),
    },

    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colors = {
          PENDING: 'orange',
          VERIFIED: 'green',
          SUSPENDED: 'red',
          REJECTED: 'default',
        };

        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      },
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Verified', value: 'VERIFIED' },
        { text: 'Suspended', value: 'SUSPENDED' },
        { text: 'Rejected', value: 'REJECTED' },
      ],
    },

    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: 100,
      render: (tier: string) => {
        const colors = {
          STARTER: 'default',
          VERIFIED: 'blue',
          PREMIUM: 'purple',
          ENTERPRISE: 'gold',
        };

        return <Tag color={colors[tier as keyof typeof colors]}>{tier}</Tag>;
      },
      filters: [
        { text: 'Starter', value: 'STARTER' },
        { text: 'Verified', value: 'VERIFIED' },
        { text: 'Premium', value: 'PREMIUM' },
        { text: 'Enterprise', value: 'ENTERPRISE' },
      ],
    },

    {
      title: 'FSCA Status',
      key: 'fscaStatus',
      width: 120,
      render: (_, record) => (
        <div className="space-y-1">
          {record.fscaVerified ? (
            <Tag color="green" icon={<CheckOutlined />}>
              Verified
            </Tag>
          ) : (
            <Tag color="orange" icon={<WarningOutlined />}>
              Not Verified
            </Tag>
          )}
          {record.fscaLicense && (
            <div className="text-xs text-gray-500">
              {record.fscaLicense}
            </div>
          )}
        </div>
      ),
      filters: [
        { text: 'Verified', value: true },
        { text: 'Not Verified', value: false },
      ],
    },

    {
      title: 'Performance',
      key: 'performance',
      width: 150,
      render: (_, record) => (
        <div>
          <div className="flex justify-between text-sm">
            <Text>Volume:</Text>
            <Text>${record.tradingVolume?.toLocaleString()}</Text>
          </div>
          <div className="flex justify-between text-sm">
            <Text>Commission:</Text>
            <Text>{record.commissionRate}%</Text>
          </div>
          <div className="mt-1">
            <Progress
              percent={record.complianceScore}
              size="small"
              strokeColor={record.complianceScore >= 90 ? '#52c41a' : '#faad14'}
              showInfo={false}
            />
          </div>
        </div>
      ),
    },

    {
      title: 'Clients',
      key: 'clients',
      width: 120,
      render: (_, record) => (
        <div>
          <div className="flex justify-between text-sm">
            <Text>Total:</Text>
            <Text>{record.totalClients}</Text>
          </div>
          <div className="flex justify-between text-sm">
            <Text>Active:</Text>
            <Badge count={record.activeClients} showZero color="green" />
          </div>
        </div>
      ),
      sorter: (a: Broker, b: Broker) => a.totalClients - b.totalClients,
    },

    {
      title: 'Contact',
      key: 'contact',
      width: 150,
      render: (_, record) => (
        <div>
          {record.phone && (
            <div className="text-sm">{record.phone}</div>
          )}
          {record.website && (
            <div className="text-sm text-blue-500 truncate">
              <a href={record.website} target="_blank" rel="noopener noreferrer">
                {record.website}
              </a>
            </div>
          )}
          {record.address && (
            <div className="text-xs text-gray-500 truncate">
              {record.address}
            </div>
          )}
        </div>
      ),
    },

    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
      sorter: true,
    },

    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewBroker(record)}
            />
          </Tooltip>

          {record.status === 'PENDING' && checkPermission('brokers:approve') && (
            <Tooltip title="Approve Application">
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => handleApproveBroker(record)}
                className="text-green-600"
              />
            </Tooltip>
          )}

          {record.status === 'PENDING' && checkPermission('brokers:reject') && (
            <Tooltip title="Reject Application">
              <Button
                type="text"
                icon={<CloseOutlined />}
                className="text-red-600"
              />
            </Tooltip>
          )}

          {record.status === 'VERIFIED' && checkPermission('brokers:verify') && (
            <Tooltip title="FSCA Verification">
              <Button
                type="text"
                icon={<SafetyOutlined />}
                onClick={() => handleFSCAVerification(record)}
                className={!record.fscaVerified ? 'text-orange-600' : 'text-gray-400'}
              />
            </Tooltip>
          )}

          {record.status === 'VERIFIED' && checkPermission('brokers:manage') && (
            <Tooltip title="Upgrade Tier">
              <Button
                type="text"
                icon={<TrophyOutlined />}
                onClick={() => handleTierUpgrade(record)}
              />
            </Tooltip>
          )}

          {record.status === 'VERIFIED' && checkPermission('brokers:suspend') && (
            <Tooltip title="Suspend Broker">
              <Button
                type="text"
                icon={<StopOutlined />}
                onClick={() => handleSuspendBroker(record)}
                className="text-red-600"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (error) {
    return (
      <Alert
        message="Error loading brokers"
        description="Failed to load broker data. Please try again."
        type="error"
        action={
          <Button size="small" onClick={() => refetch()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={2}>Broker Management</Title>
          <Text type="secondary">
            Manage broker applications, FSCA verification, and compliance
          </Text>
        </div>

        <Space>
          {selectedRowKeys.length > 0 && (
            <Button
              type="default"
              icon={<ExportOutlined />}
              onClick={handleExport}
            >
              Export Selected
            </Button>
          )}
          <Button
            type="default"
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            Export All
          </Button>
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      {brokerStats && (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Brokers"
                value={brokerStats.totalBrokers}
                prefix={<TeamOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#4B0082' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Active Brokers"
                value={brokerStats.activeBrokers}
                prefix={<CheckOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Pending Applications"
                value={brokerStats.pendingApplications}
                prefix={<FileTextOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Trading Volume"
                value={brokerStats.totalVolume}
                prefix={<DollarOutlined />}
                formatter={(value) => `$${formatNumber(value as number)}`}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Search
              placeholder="Search by name, email, or registration number"
              allowClear
              enterButton={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              onSearch={handleSearch}
            />
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Status"
              allowClear
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(value) => handleFilterChange('status', value)}
            >
              <Option value="PENDING">Pending</Option>
              <Option value="VERIFIED">Verified</Option>
              <Option value="SUSPENDED">Suspended</Option>
              <Option value="REJECTED">Rejected</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Tier"
              allowClear
              style={{ width: '100%' }}
              value={filters.tier}
              onChange={(value) => handleFilterChange('tier', value)}
            >
              <Option value="STARTER">Starter</Option>
              <Option value="VERIFIED">Verified</Option>
              <Option value="PREMIUM">Premium</Option>
              <Option value="ENTERPRISE">Enterprise</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="FSCA Verified"
              allowClear
              style={{ width: '100%' }}
              value={filters.fscaVerified}
              onChange={(value) => handleFilterChange('fscaVerified', value)}
            >
              <Option value={true}>Verified</Option>
              <Option value={false}>Not Verified</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Space>
              <Button icon={<FilterOutlined />} onClick={() => {
                setFilters({
                  page: 1,
                  limit: 50,
                  status: undefined,
                  tier: undefined,
                  search: '',
                  fscaVerified: undefined,
                  minClients: undefined,
                  maxClients: undefined,
                });
              }}>
                Reset
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Brokers Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={brokersData?.brokers}
          rowKey="id"
          rowSelection={rowSelection}
          loading={isLoading}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: brokersData?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} brokers`,
            onChange: handleTableChange,
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* Modals and Drawers */}
      <BrokerDetailDrawer
        visible={detailDrawerVisible}
        broker={selectedBroker}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedBroker(null);
        }}
      />

      <BrokerApprovalModal
        visible={approvalModalVisible}
        broker={selectedBroker}
        onApprove={async () => {
          if (selectedBroker) {
            await approveBrokerMutation.mutateAsync(selectedBroker.id);
          }
        }}
        onReject={async (reason: string) => {
          if (selectedBroker) {
            await rejectBrokerMutation.mutateAsync({
              brokerId: selectedBroker.id,
              reason,
            });
          }
        }}
        onCancel={() => {
          setApprovalModalVisible(false);
          setSelectedBroker(null);
        }}
        loading={approveBrokerMutation.isLoading || rejectBrokerMutation.isLoading}
      />

      <FSCAVerificationModal
        visible={fscaModalVisible}
        broker={selectedBroker}
        onVerify={async (verificationData: any) => {
          if (selectedBroker) {
            await verifyBrokerMutation.mutateAsync({
              brokerId: selectedBroker.id,
              verificationData,
            });
          }
        }}
        onCancel={() => {
          setFscaModalVisible(false);
          setSelectedBroker(null);
        }}
        loading={verifyBrokerMutation.isLoading}
      />

      <TierUpgradeModal
        visible={tierModalVisible}
        broker={selectedBroker}
        onUpgrade={async (tierData: any) => {
          // Implement tier upgrade logic
          console.log('Upgrade broker to tier:', tierData);
          message.success('Tier upgrade initiated');
          setTierModalVisible(false);
        }}
        onCancel={() => {
          setTierModalVisible(false);
          setSelectedBroker(null);
        }}
      />
    </div>
  );
};

export default Brokers;