import React, { useState, useEffect } from 'react';
import {
  Table, Card, Button, Space, Tag, Avatar, Typography, Input, Select, DatePicker, Modal, Form, message, Tooltip, Popconfirm, Badge, Row, Col, Statistic, Drawer, Descriptions, Timeline, Tabs, Alert, Upload, Switch, InputNumber, } from 'antd';
import {
  UserOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, StopOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined, DownloadOutlined, ReloadOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';
import { User, AdminStatus } from '../../types/admin.types';
import UserDetailDrawer from '../../components/superadmin/UserDetailDrawer';
import SuspenseModal from '../../components/superadmin/SuspenseModal';
import BanModal from '../../components/superadmin/BanModal';
import KYCReviewModal from '../../components/superadmin/KYCReviewModal';
import ExportModal from '../../components/superadmin/ExportModal';

const {Title, Text} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;
const {Search} = Input;
const {TabPane} = Tabs;

const Users: React.FC = () => {
  const _navigate = useNavigate();
  const queryClient = useQueryClient();
  const {checkPermission} = useAdminStore();

  // State
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    status: undefined,
    kycStatus: undefined,
    search: '',
    country: undefined,
    riskScoreMin: undefined,
    riskScoreMax: undefined,
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [banModalVisible, setBanModalVisible] = useState(false);
  const [kycModalVisible, setKycModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // Queries
  const {data: usersData, isLoading, error, refetch, } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => adminApi.getUsers(filters),
    keepPreviousData: true,
  });

  const {data: userStats} = useQuery({
    queryKey: ['admin-user-stats'],
    queryFn: () => adminApi.getUserStats(),
  });

  // Mutations
  const suspendUserMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.suspendUser(userId, reason),
    onSuccess: () => {
      message.success('User suspended successfully');
      queryClient.invalidateQueries(['admin-users']);
      setSuspendModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to suspend user');
    },
  });

  const unsuspendUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.unsuspendUser(userId),
    onSuccess: () => {
      message.success('User unsuspended successfully');
      queryClient.invalidateQueries(['admin-users']);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to unsuspend user');
    },
  });

  const banUserMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.banUser(userId, reason),
    onSuccess: () => {
      message.success('User banned successfully');
      queryClient.invalidateQueries(['admin-users']);
      setBanModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to ban user');
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: (userId: string) => adminApi.unbanUser(userId),
    onSuccess: () => {
      message.success('User unbanned successfully');
      queryClient.invalidateQueries(['admin-users']);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to unban user');
    },
  });

  const approveKYCMutation = useMutation({
    mutationFn: (userId: string) => adminApi.approveKYC(userId),
    onSuccess: () => {
      message.success('KYC approved successfully');
      queryClient.invalidateQueries(['admin-users']);
      setKycModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to approve KYC');
    },
  });

  const rejectKYCMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.rejectKYC(userId, reason),
    onSuccess: () => {
      message.success('KYC rejected successfully');
      queryClient.invalidateQueries(['admin-users']);
      setKycModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to reject KYC');
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

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setDetailDrawerVisible(true);
  };

  const handleSuspendUser = (user: User) => {
    setSelectedUser(user);
    setSuspendModalVisible(true);
  };

  const handleBanUser = (user: User) => {
    setSelectedUser(user);
    setBanModalVisible(true);
  };

  const handleKYCReview = (user: User) => {
    setSelectedUser(user);
    setKycModalVisible(true);
  };

  const handleQuickAction = async (action: string, user: User) => {
    switch (action) {
      case 'unsuspend':
        await unsuspendUserMutation.mutateAsync(user.id);
        break;
      case 'unban':
        await unbanUserMutation.mutateAsync(user.id);
        break;
      default:
        break;
    }
  };

  const handleExport = () => {
    setExportModalVisible(true);
  };

  // Table columns
  const columns: ColumnsType<User> = [
    {
      title: 'User',
      key: 'user',
      width: 200,
      render: (_, record) => (
        <Space>
          <Avatar
            size="small"
            src={record.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#4B0082' }}
          />
          <div>
            <div className="font-medium">{`${record.firstName} ${record.lastName}`}</div>
            <div className="text-sm text-gray-500">{record.email}</div>
            {record.username && (
              <div className="text-xs text-blue-500">@{record.username}</div>
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
      render: (status: AdminStatus) => {
        const colors = {
          ACTIVE: 'green',
          SUSPENDED: 'orange',
          BANNED: 'red',
          PENDING_VERIFICATION: 'blue',
        };

        return (
          <Tag color={colors[status]}>
            {status.replace('_', ' ')}
          </Tag>
        );
      },
    },

    {
      title: 'KYC Status',
      dataIndex: 'kycStatus',
      key: 'kycStatus',
      width: 120,
      render: (kycStatus: string) => {
        const colors = {
          VERIFIED: 'green',
          PENDING: 'orange',
          REJECTED: 'red',
          NOT_STARTED: 'default',
        };

        return (
          <Tag color={colors[kycStatus as keyof typeof colors]}>
            {kycStatus.replace('_', ' ')}
          </Tag>
        );
      },
    },

    {
      title: 'Balance',
      key: 'balance',
      width: 150,
      render: (_, record) => (
        <div>
          <div className="text-sm">${record.balanceUsd?.toLocaleString()} USD</div>
          <div className="text-xs text-gray-500">
            R {record.balanceZar?.toLocaleString()}
          </div>
        </div>
      ),
    },

    {
      title: 'Risk Score',
      dataIndex: 'riskScore',
      key: 'riskScore',
      width: 100,
      render: (score: number) => {
        let color = 'green';
        if (score >= 80) color = 'red';
        else if (score >= 60) color = 'orange';

        return (
          <Tag color={color}>{score}/100</Tag>
        );
      },
      sorter: true,
    },

    {
      title: 'Location',
      key: 'location',
      width: 100,
      render: (_, record) => (
        <div>
          {record.country && (
            <div className="text-sm">{record.country}</div>
          )}
          <div className="text-xs text-gray-500">
            {record.ipAddress}
          </div>
        </div>
      ),
    },

    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 120,
      render: (date: string) =>
        date ? dayjs(date).format('MMM DD, YYYY') : 'Never',
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
              onClick={() => handleViewUser(record)}
            />
          </Tooltip>

          {record.status === 'ACTIVE' && checkPermission('users:suspend') && (
            <Tooltip title="Suspend User">
              <Popconfirm
                title="Are you sure you want to suspend this user?"
                onConfirm={() => handleSuspendUser(record)}
              >
                <Button type="text" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}

          {record.status === 'SUSPENDED' && checkPermission('users:unsuspend') && (
            <Tooltip title="Unsuspend User">
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => handleQuickAction('unsuspend', record)}
              />
            </Tooltip>
          )}

          {record.status === 'ACTIVE' && checkPermission('users:ban') && (
            <Tooltip title="Ban User">
              <Popconfirm
                title="Are you sure you want to ban this user?"
                onConfirm={() => handleBanUser(record)}
              >
                <Button type="text" icon={<StopOutlined />} danger />
              </Popconfirm>
            </Tooltip>
          )}

          {record.status === 'BANNED' && checkPermission('users:unban') && (
            <Tooltip title="Unban User">
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => handleQuickAction('unban', record)}
              />
            </Tooltip>
          )}

          {record.kycStatus === 'PENDING' && checkPermission('kyc:review') && (
            <Tooltip title="Review KYC">
              <Button
                type="text"
                icon={<UploadOutlined />}
                onClick={() => handleKYCReview(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: string[]) => setSelectedRowKeys(keys),
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  if (error) {
    return (
      <Alert
        message="Error loading users"
        description="Failed to load user data. Please try again."
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
          <Title level={2}>User Management</Title>
          <Text type="secondary">
            Manage user accounts, KYC verification, and user status
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
      {userStats && (
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Total Users"
                value={userStats.totalUsers}
                prefix={<UserOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#4B0082' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Active Users"
                value={userStats.activeUsers}
                prefix={<CheckCircleOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Pending KYC"
                value={userStats.pendingKYC}
                prefix={<UploadOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="Suspended/Banned"
                value={userStats.suspendedUsers + userStats.bannedUsers}
                prefix={<StopOutlined />}
                formatter={formatNumber}
                valueStyle={{ color: '#ff4d4f' }}
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
              placeholder="Search by email, name, or username"
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
              <Option value="ACTIVE">Active</Option>
              <Option value="SUSPENDED">Suspended</Option>
              <Option value="BANNED">Banned</Option>
              <Option value="PENDING_VERIFICATION">Pending Verification</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="KYC Status"
              allowClear
              style={{ width: '100%' }}
              value={filters.kycStatus}
              onChange={(value) => handleFilterChange('kycStatus', value)}
            >
              <Option value="VERIFIED">Verified</Option>
              <Option value="PENDING">Pending</Option>
              <Option value="REJECTED">Rejected</Option>
              <Option value="NOT_STARTED">Not Started</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={4}>
            <Select
              placeholder="Country"
              allowClear
              showSearch
              style={{ width: '100%' }}
              value={filters.country}
              onChange={(value) => handleFilterChange('country', value)}
            >
              <Option value="ZA">South Africa</Option>
              <Option value="US">United States</Option>
              <Option value="GB">United Kingdom</Option>
              <Option value="NG">Nigeria</Option>
              <Option value="KE">Kenya</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={6}>
            <Space>
              <RangePicker
                placeholder={['Start Date', 'End Date']}
                onChange={(dates) => {
                  if (dates) {
                    handleFilterChange('dateRange', {
                      startDate: dates[0]!.toDate(),
                      endDate: dates[1]!.toDate(),
                    });
                  } else {
                    handleFilterChange('dateRange', undefined);
                  }
                }}
              />
              <Button
                icon={<FilterOutlined />}
                onClick={() => {
                  setFilters({
                    page: 1,
                    limit: 50,
                    status: undefined,
                    kycStatus: undefined,
                    search: '',
                    country: undefined,
                    riskScoreMin: undefined,
                    riskScoreMax: undefined,
                  });
                }}
              >
                Reset
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Users Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={usersData?.users}
          rowKey="id"
          rowSelection={rowSelection}
          loading={isLoading}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: usersData?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} users`,
            onChange: handleTableChange,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Modals and Drawers */}
      <UserDetailDrawer
        visible={detailDrawerVisible}
        user={selectedUser}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedUser(null);
        }}
      />

      <SuspenseModal
        visible={suspendModalVisible}
        user={selectedUser}
        action="suspend"
        onConfirm={async (reason: string) => {
          if (selectedUser) {
            await suspendUserMutation.mutateAsync({
              userId: selectedUser.id,
              reason,
            });
          }
        }}
        onCancel={() => {
          setSuspendModalVisible(false);
          setSelectedUser(null);
        }}
        loading={suspendUserMutation.isLoading}
      />

      <BanModal
        visible={banModalVisible}
        user={selectedUser}
        onConfirm={async (reason: string, severity: string) => {
          if (selectedUser) {
            await banUserMutation.mutateAsync({
              userId: selectedUser.id,
              reason: `${severity}: ${reason}`,
            });
          }
        }}
        onCancel={() => {
          setBanModalVisible(false);
          setSelectedUser(null);
        }}
        loading={banUserMutation.isLoading}
      />

      <KYCReviewModal
        visible={kycModalVisible}
        user={selectedUser}
        onApprove={async () => {
          if (selectedUser) {
            await approveKYCMutation.mutateAsync(selectedUser.id);
          }
        }}
        onReject={async (reason: string) => {
          if (selectedUser) {
            await rejectKYCMutation.mutateAsync({
              userId: selectedUser.id,
              reason,
            });
          }
        }}
        onCancel={() => {
          setKycModalVisible(false);
          setSelectedUser(null);
        }}
        loading={approveKYCMutation.isLoading || rejectKYCMutation.isLoading}
      />

      <ExportModal
        visible={exportModalVisible}
        selectedCount={selectedRowKeys.length}
        totalCount={usersData?.total}
        onExport={async (options: any) => {
          // Export logic here
          console.log('Export options:', options);
          message.success('Export initiated successfully');
          setExportModalVisible(false);
          setSelectedRowKeys([]);
        }}
        onCancel={() => setExportModalVisible(false)}
      />
    </div>
  );
};

export default Users;