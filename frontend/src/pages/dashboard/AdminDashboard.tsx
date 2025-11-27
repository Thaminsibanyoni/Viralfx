import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row, Col, Card, Statistic, Typography, Table, Tag, Button, Space, List, Avatar, Timeline, Progress, message, Modal, Form, Input, Select, DatePicker, Tooltip, Alert, Badge, Dropdown, MenuProps, } from 'antd';
import {
  UserOutlined, TrophyOutlined, ExclamationCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, EditOutlined, DeleteOutlined, StopOutlined, PlayCircleOutlined, ReloadOutlined, DatabaseOutlined, ApiOutlined, CloudServerOutlined, BugOutlined, MessageOutlined, FileTextOutlined, BarChartOutlined, ExportOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { adminApi } from '../../services/api/admin.api';
import dayjs from 'dayjs';
import CollapsibleSection from '../../components/common/CollapsibleSection';

const {Title, Text} = Typography;
const {RangePicker} = DatePicker;
const {Option} = Select;

interface AdminStats {
  totalUsers: number;
  activeTraders: number;
  pendingKYC: number;
  flaggedContent: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  apiResponseTime: number;
  dbConnections: number;
  queueSize: number;
  errorRate: number;
}

interface ModerationItem {
  id: string;
  type: 'USER' | 'CONTENT' | 'TRADE';
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reportedBy: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface User {
  id: string;
  email: string;
  username: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  registrationDate: string;
  lastLogin: string;
  totalTrades: number;
  totalVolume: number;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
}

interface ActivityItem {
  id: string;
  type: 'USER_REGISTERED' | 'TRADE_EXECUTED' | 'KYC_SUBMITTED' | 'SYSTEM_ALERT';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {user} = useAuthStore();

  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [moderationModalVisible, setModerationModalVisible] = useState(false);
  const [selectedModerationItem, setSelectedModerationItem] = useState<ModerationItem | null>(null);
  const [userDetailModalVisible, setUserDetailModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Check if user has admin/moderator role
  useEffect(() => {
    if (!user || (user.role !== 'ADMIN' && user.role !== 'MODERATOR')) {
      message.error('Access denied. Admin privileges required.');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch admin statistics
  const {data: stats, isLoading: statsLoading, refetch: refetchStats} = useQuery(
    'adminStats',
    () => adminApi.getStats(),
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch moderation queue
  const {data: moderationQueue, isLoading: moderationLoading} = useQuery(
    'moderationQueue',
    () => adminApi.getModerationQueue(),
    {
      refetchInterval: 15000, // Refresh every 15 seconds
    }
  );

  // Fetch recent activity
  const {data: recentActivity, isLoading: activityLoading} = useQuery(
    'recentActivity',
    () => adminApi.getRecentActivity(),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch users
  const {data: users, isLoading: usersLoading} = useQuery(
    'adminUsers',
    () => adminApi.getUsers(),
    {
      refetchInterval: 60000,
    }
  );

  // Approve moderation item
  const approveMutation = useMutation(
    (itemId: string) => adminApi.approveModerationItem(itemId),
    {
      onSuccess: () => {
        message.success('Item approved successfully');
        queryClient.invalidateQueries('moderationQueue');
        setModerationModalVisible(false);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to approve item');
      },
    }
  );

  // Reject moderation item
  const rejectMutation = useMutation(
    ({ itemId, reason }: { itemId: string; reason: string }) =>
      adminApi.rejectModerationItem(itemId, reason),
    {
      onSuccess: () => {
        message.success('Item rejected successfully');
        queryClient.invalidateQueries('moderationQueue');
        setModerationModalVisible(false);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to reject item');
      },
    }
  );

  // Suspend user
  const suspendUserMutation = useMutation(
    (userId: string) => adminApi.suspendUser(userId),
    {
      onSuccess: () => {
        message.success('User suspended successfully');
        queryClient.invalidateQueries('adminUsers');
        setUserDetailModalVisible(false);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to suspend user');
      },
    }
  );

  // Unban user
  const unbanUserMutation = useMutation(
    (userId: string) => adminApi.unbanUser(userId),
    {
      onSuccess: () => {
        message.success('User unbanned successfully');
        queryClient.invalidateQueries('adminUsers');
        setUserDetailModalVisible(false);
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to unban user');
      },
    }
  );

  const moderationColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'USER' ? 'blue' : type === 'CONTENT' ? 'green' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: ModerationItem) => (
        <div>
          <Text style={{ color: '#FFB300' }}>{title}</Text>
          <br />
          <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>{record.description}</Text>
        </div>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={priority === 'HIGH' ? 'red' : priority === 'MEDIUM' ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'PENDING' ? 'orange' : status === 'APPROVED' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Reported By',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      render: (reportedBy: string) => (
        <Text style={{ color: '#B8BCC8' }}>{reportedBy}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ModerationItem) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedModerationItem(record);
              setModerationModalVisible(true);
            }}
            style={{ color: '#FFB300' }}
          >
            Review
          </Button>
        </Space>
      ),
    },
  ];

  const userColumns = [
    {
      title: 'User',
      key: 'user',
      render: (record: User) => (
        <div>
          <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>{record.username}</Text>
          <br />
          <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>{record.email}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : status === 'SUSPENDED' ? 'orange' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'KYC',
      dataIndex: 'kycStatus',
      key: 'kycStatus',
      render: (kycStatus: string) => (
        <Tag color={kycStatus === 'VERIFIED' ? 'green' : kycStatus === 'PENDING' ? 'orange' : 'red'}>
          {kycStatus}
        </Tag>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'ADMIN' ? 'purple' : role === 'MODERATOR' ? 'blue' : 'default'}>
          {role}
        </Tag>
      ),
    },
    {
      title: 'Trades',
      dataIndex: 'totalTrades',
      key: 'totalTrades',
      render: (trades: number) => (
        <Text style={{ color: '#B8BCC8' }}>{trades.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Volume',
      dataIndex: 'totalVolume',
      key: 'totalVolume',
      render: (volume: number) => (
        <Text style={{ color: '#B8BCC8' }}>R{volume.toLocaleString()}</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: User) => {
        const menuItems: MenuProps['items'] = [
          {
            key: 'view',
            label: 'View Details',
            icon: <EyeOutlined />,
            onClick: () => {
              setSelectedUser(record);
              setUserDetailModalVisible(true);
            },
          },
          {
            key: 'edit',
            label: 'Edit User',
            icon: <EditOutlined />,
            onClick: () => navigate(`/admin/users/${record.id}`),
          },
          ...(record.status === 'ACTIVE' ? [{
            key: 'suspend',
            label: 'Suspend',
            icon: <StopOutlined />,
            onClick: () => suspendUserMutation.mutate(record.id),
          }] : [{
            key: 'unban',
            label: 'Unban',
            icon: <PlayCircleOutlined />,
            onClick: () => unbanUserMutation.mutate(record.id),
          }]),
        ];

        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button type="link" style={{ color: '#FFB300' }}>
              Actions
            </Button>
          </Dropdown>
        );
      },
    },
  ];

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY': return '#52C41A';
      case 'WARNING': return '#FFB300';
      case 'CRITICAL': return '#FF4D4F';
      default: return '#B8BCC8';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'INFO': return <MessageOutlined style={{ color: '#1890FF' }} />;
      case 'WARNING': return <ExclamationCircleOutlined style={{ color: '#FFB300' }} />;
      case 'ERROR': return <BugOutlined style={{ color: '#FF4D4F' }} />;
      default: return <MessageOutlined style={{ color: '#B8BCC8' }} />;
    }
  };

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: '32px' }}>
        <Col>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Admin Dashboard
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Platform administration and monitoring
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                refetchStats();
                queryClient.invalidateQueries();
              }}
              loading={statsLoading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={() => navigate('/admin/broadcast')}
              style={{
                background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                border: 'none',
              }}
            >
              Broadcast Message
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Platform Statistics */}
      <CollapsibleSection
        title="Platform Statistics"
        icon={<BarChartOutlined style={{ color: '#FFB300' }} />}
        badge={<Badge count={4} size="small" />}
        variant="card"
        defaultExpanded={true}
        persistState={true}
        storageKey="admin-platform-stats"
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
            >
              <Statistic
                title={<Text style={{ color: '#B8BCC8' }}>Total Users</Text>}
                value={stats?.totalUsers || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#FFB300', fontSize: '24px' }}
                formatter={(value) => Number(value).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
            >
              <Statistic
                title={<Text style={{ color: '#B8BCC8' }}>Active Traders</Text>}
                value={stats?.activeTraders || 0}
                prefix={<TrophyOutlined />}
                valueStyle={{ color: '#52C41A', fontSize: '24px' }}
                formatter={(value) => Number(value).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
            >
              <Statistic
                title={<Text style={{ color: '#B8BCC8' }}>Pending KYC</Text>}
                value={stats?.pendingKYC || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#FFB300', fontSize: '24px' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
            >
              <Statistic
                title={<Text style={{ color: '#B8BCC8' }}>Flagged Content</Text>}
                value={stats?.flaggedContent || 0}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#FF4D4F', fontSize: '24px' }}
              />
            </Card>
          </Col>
        </Row>
      </CollapsibleSection>

      {/* System Health */}
      <CollapsibleSection
        title="System Health"
        icon={<CloudServerOutlined style={{ color: '#FFB300' }} />}
        badge={stats?.systemHealth === 'CRITICAL' ? <Badge count="!" size="small" style={{ backgroundColor: '#ff4d4f' }} /> : undefined}
        variant="card"
        defaultExpanded={true}
        persistState={true}
        storageKey="admin-system-health"
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Badge
                color={getHealthColor(stats?.systemHealth || 'UNKNOWN')}
                text={
                  <Text style={{ color: '#B8BCC8' }}>Overall Status</Text>
                }
              />
              <div style={{ marginTop: '8px' }}>
                <Tag
                  color={stats?.systemHealth === 'HEALTHY' ? 'green' : stats?.systemHealth === 'WARNING' ? 'orange' : 'red'}
                >
                  {stats?.systemHealth || 'UNKNOWN'}
                </Tag>
              </div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                API Response Time
              </Text>
              <Progress
                percent={Math.min((stats?.apiResponseTime || 0) / 10, 100)}
                format={() => `${stats?.apiResponseTime || 0}ms`}
                strokeColor={stats?.apiResponseTime && stats.apiResponseTime < 500 ? '#52C41A' : '#FFB300'}
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                Error Rate
              </Text>
              <Progress
                percent={stats?.errorRate || 0}
                format={() => `${stats?.errorRate || 0}%`}
                strokeColor={stats?.errorRate && stats.errorRate < 5 ? '#52C41A' : '#FF4D4F'}
              />
            </div>
          </Col>
        </Row>

        <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
          <Col xs={24} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <DatabaseOutlined style={{ fontSize: '24px', color: '#FFB300', marginBottom: '8px' }} />
              <Text style={{ color: '#B8BCC8', display: 'block', fontSize: '12px' }}>
                DB Connections
              </Text>
              <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
                {stats?.dbConnections || 0}
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <ApiOutlined style={{ fontSize: '24px', color: '#FFB300', marginBottom: '8px' }} />
              <Text style={{ color: '#B8BCC8', display: 'block', fontSize: '12px' }}>
                API Servers
              </Text>
              <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
                3/3
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <CloudServerOutlined style={{ fontSize: '24px', color: '#FFB300', marginBottom: '8px' }} />
              <Text style={{ color: '#B8BCC8', display: 'block', fontSize: '12px' }}>
                Queue Size
              </Text>
              <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
                {stats?.queueSize || 0}
              </Text>
            </div>
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ textAlign: 'center' }}>
              <BugOutlined style={{ fontSize: '24px', color: '#FFB300', marginBottom: '8px' }} />
              <Text style={{ color: '#B8BCC8', display: 'block', fontSize: '12px' }}>
                Error Logs (1h)
              </Text>
              <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
                12
              </Text>
            </div>
          </Col>
        </Row>
      </CollapsibleSection>

      <Row gutter={[24, 24]}>
        {/* Recent Activity */}
        <Col xs={24} lg={8}>
          <CollapsibleSection
            title="Recent Activity"
            icon={<MessageOutlined style={{ color: '#FFB300' }} />}
            badge={recentActivity?.length ? <Badge count={recentActivity.length} size="small" /> : undefined}
            variant="card"
            defaultExpanded={true}
            persistState={true}
            storageKey="admin-recent-activity"
            headerClassName="p-4"
            contentClassName="p-0"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <span></span>
                <Button
                  type="link"
                  onClick={() => navigate('/admin/activity')}
                  style={{ color: '#FFB300', padding: 0, height: 'auto' }}
                >
                  View All
                </Button>
              </div>
              <Timeline style={{ color: '#B8BCC8' }}>
                {recentActivity?.slice(0, 8).map((activity: ActivityItem) => (
                  <Timeline.Item
                    key={activity.id}
                    dot={getSeverityIcon(activity.severity)}
                    color={activity.severity === 'ERROR' ? 'red' : activity.severity === 'WARNING' ? 'orange' : 'blue'}
                  >
                    <div>
                      <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>{activity.title}</Text>
                      <br />
                      <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>{activity.description}</Text>
                      <br />
                      <Text style={{ color: '#B8BCC8', fontSize: '10px' }}>
                        {dayjs(activity.timestamp).fromNow()}
                      </Text>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          </CollapsibleSection>
        </Col>

        {/* Moderation Queue */}
        <Col xs={24} lg={16}>
          <CollapsibleSection
            title="Moderation Queue"
            icon={<ExclamationCircleOutlined style={{ color: '#FFB300' }} />}
            badge={stats?.pendingKYC ? <Badge count={stats.pendingKYC} size="small" /> : undefined}
            variant="card"
            defaultExpanded={true}
            persistState={true}
            storageKey="admin-moderation-queue"
            headerClassName="p-4"
            contentClassName="p-0"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <span></span>
                <Button
                  type="link"
                  onClick={() => navigate('/admin/moderation')}
                  style={{ color: '#FFB300', padding: 0, height: 'auto' }}
                >
                  View All
                </Button>
              </div>
              <Table
                dataSource={moderationQueue || []}
                columns={moderationColumns}
                pagination={{ pageSize: 5 }}
                loading={moderationLoading}
                rowKey="id"
                size="small"
              />
            </div>
          </CollapsibleSection>
        </Col>

        {/* User Management */}
        <Col xs={24}>
          <CollapsibleSection
            title="User Management"
            icon={<UserOutlined style={{ color: '#FFB300' }} />}
            badge={users?.length ? <Badge count={users.length} size="small" /> : undefined}
            variant="card"
            defaultExpanded={true}
            persistState={true}
            storageKey="admin-user-management"
            headerClassName="p-4"
            contentClassName="p-0"
          >
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <span></span>
                <Space>
                  <Button
                    type="link"
                    onClick={() => navigate('/admin/users')}
                    style={{ color: '#FFB300', padding: 0, height: 'auto' }}
                  >
                    View All Users
                  </Button>
                  <Button
                    icon={<ExportOutlined />}
                    onClick={() => {
                      message.info('Export functionality coming soon');
                    }}
                    style={{ borderColor: '#FFB300', color: '#FFB300' }}
                  >
                    Export
                  </Button>
                </Space>
              </div>
              <Table
                dataSource={users?.slice(0, 10) || []}
                columns={userColumns}
                pagination={false}
                loading={usersLoading}
                rowKey="id"
                rowSelection={{
                  selectedRowKeys: selectedUsers,
                  onChange: setSelectedUsers,
                  getCheckboxProps: (record: User) => ({
                    disabled: record.role === 'ADMIN',
                  }),
                }}
              />
            </div>
          </CollapsibleSection>
        </Col>
      </Row>

      {/* Moderation Review Modal */}
      <Modal
        title="Review Moderation Item"
        open={moderationModalVisible}
        onCancel={() => setModerationModalVisible(false)}
        footer={[
          <Button key="reject" danger onClick={() => {
            if (selectedModerationItem) {
              rejectMutation.mutate({
                itemId: selectedModerationItem.id,
                reason: 'Content violates community guidelines',
              });
            }
          }}>
            Reject
          </Button>,
          <Button
            key="approve"
            type="primary"
            onClick={() => {
              if (selectedModerationItem) {
                approveMutation.mutate(selectedModerationItem.id);
              }
            }}
            loading={approveMutation.isLoading}
          >
            Approve
          </Button>,
        ]}
        style={{ background: '#1A1A1C' }}
      >
        {selectedModerationItem && (
          <div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Type:</Text>
                <Tag color={selectedModerationItem.type === 'USER' ? 'blue' : 'green'} style={{ marginLeft: '8px' }}>
                  {selectedModerationItem.type}
                </Tag>
              </div>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Title:</Text>
                <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>{selectedModerationItem.title}</Text>
              </div>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Description:</Text>
                <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>{selectedModerationItem.description}</Text>
              </div>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Priority:</Text>
                <Tag color={selectedModerationItem.priority === 'HIGH' ? 'red' : 'orange'} style={{ marginLeft: '8px' }}>
                  {selectedModerationItem.priority}
                </Tag>
              </div>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Reported By:</Text>
                <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>{selectedModerationItem.reportedBy}</Text>
              </div>
              <div>
                <Text strong style={{ color: '#FFB300' }}>Created:</Text>
                <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>
                  {dayjs(selectedModerationItem.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
              </div>
            </Space>
          </div>
        )}
      </Modal>

      {/* User Details Modal */}
      <Modal
        title="User Details"
        open={userDetailModalVisible}
        onCancel={() => setUserDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setUserDetailModalVisible(false)}>
            Close
          </Button>,
        ]}
        width={600}
        style={{ background: '#1A1A1C' }}
      >
        {selectedUser && (
          <div>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Username:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>{selectedUser.username}</Text>
                </Col>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Email:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>{selectedUser.email}</Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Text strong style={{ color: '#FFB300' }}>Status:</Text>
                  <Tag color={selectedUser.status === 'ACTIVE' ? 'green' : 'red'} style={{ marginLeft: '8px' }}>
                    {selectedUser.status}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text strong style={{ color: '#FFB300' }}>KYC:</Text>
                  <Tag color={selectedUser.kycStatus === 'VERIFIED' ? 'green' : 'orange'} style={{ marginLeft: '8px' }}>
                    {selectedUser.kycStatus}
                  </Tag>
                </Col>
                <Col span={8}>
                  <Text strong style={{ color: '#FFB300' }}>Role:</Text>
                  <Tag color={selectedUser.role === 'ADMIN' ? 'purple' : 'blue'} style={{ marginLeft: '8px' }}>
                    {selectedUser.role}
                  </Tag>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Registration:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>
                    {dayjs(selectedUser.registrationDate).format('YYYY-MM-DD')}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Last Login:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>
                    {dayjs(selectedUser.lastLogin).fromNow()}
                  </Text>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Total Trades:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>
                    {selectedUser.totalTrades.toLocaleString()}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text strong style={{ color: '#FFB300' }}>Total Volume:</Text>
                  <Text style={{ color: '#B8BCC8', marginLeft: '8px' }}>
                    R{selectedUser.totalVolume.toLocaleString()}
                  </Text>
                </Col>
              </Row>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminDashboard;