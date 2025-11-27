import React, { useState } from 'react';
import {
  
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Empty, Spin, Transfer, TreeSelect, } from 'antd';
import {
  TeamOutlined, UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, EyeOutlined, SearchOutlined, FilterOutlined, ReloadOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, SecurityScanOutlined, CrownOutlined, SafetyOutlined, SettingOutlined, GlobalOutlined, MailOutlined, PhoneOutlined, CalendarOutlined, ClockCircleOutlined, KeyOutlined, FileTextOutlined, BulbOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import {
  AdminUser, AdminRole, AdminStatus, CreateAdminRequest, UpdateAdminRequest, } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;

interface AdminFilters {
  page: number;
  limit: number;
  role?: string;
  status?: string;
  search?: string;
}

const Admins: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission, hasRole} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('admins');
  const [adminFilters, setAdminFilters] = useState<AdminFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
  const [adminModalVisible, setAdminModalVisible] = useState<boolean>(false);
  const [createModalVisible, setCreateModalVisible] = useState<boolean>(false);
  const [permissionsModalVisible, setPermissionsModalVisible] = useState<boolean>(false);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Permissions
  const canViewAdmins = checkPermission('admin:view');
  const canCreateAdmins = checkPermission('admin:create');
  const canEditAdmins = checkPermission('admin:edit');
  const canDeleteAdmins = checkPermission('admin:delete');
  const canManagePermissions = checkPermission('admin:permissions');
  const _isSuperAdmin = hasRole('SUPER_ADMIN');

  // Data fetching
  const {data: adminsData, isLoading: adminsLoading, refetch: refetchAdmins, } = useQuery(
    ['admins', adminFilters],
    () => adminApi.getAdmins(adminFilters),
    {
      enabled: canViewAdmins,
      keepPreviousData: true,
    }
  );

  const {data: permissionsData, isLoading: permissionsLoading, } = useQuery(
    'permissions',
    () => adminApi.getPermissions(),
    {
      enabled: canManagePermissions,
    }
  );

  const {data: rolesData, isLoading: rolesLoading, } = useQuery(
    'roles',
    () => adminApi.getRoles(),
    {
      enabled: canEditAdmins,
    }
  );

  // Mutations
  const createAdminMutation = useMutation(
    (adminData: CreateAdminRequest) => adminApi.createAdmin(adminData),
    {
      onSuccess: () => {
        message.success('Admin created successfully');
        queryClient.invalidateQueries('admins');
        setCreateModalVisible(false);
        createForm.resetFields();
      },
      onError: () => {
        message.error('Failed to create admin');
      },
    }
  );

  const updateAdminMutation = useMutation(
    ({ adminId, adminData }: { adminId: string; adminData: UpdateAdminRequest }) =>
      adminApi.updateAdmin(adminId, adminData),
    {
      onSuccess: () => {
        message.success('Admin updated successfully');
        queryClient.invalidateQueries('admins');
        setAdminModalVisible(false);
      },
      onError: () => {
        message.error('Failed to update admin');
      },
    }
  );

  // Event handlers
  const handleAdminFilterChange = (key: string, value: any) => {
    setAdminFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewAdmin = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    editForm.setFieldsValue({
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      status: admin.status,
      department: admin.department,
    });
    setAdminModalVisible(true);
  };

  const handleCreateAdmin = () => {
    createForm.validateFields().then((values) => {
      createAdminMutation.mutate(values);
    });
  };

  const handleUpdateAdmin = () => {
    if (selectedAdmin) {
      editForm.validateFields().then((values) => {
        updateAdminMutation.mutate({
          adminId: selectedAdmin.id,
          adminData: values,
        });
      });
    }
  };

  const getStatusColor = (status: AdminStatus) => {
    const colors = {
      ACTIVE: 'green',
      SUSPENDED: 'orange',
      PENDING: 'blue',
      LOCKED: 'red',
    };
    return colors[status] || 'default';
  };

  const getRoleColor = (role: AdminRole) => {
    const colors = {
      SUPER_ADMIN: 'purple',
      USER_OPS: 'blue',
      BROKER_OPS: 'green',
      TREND_OPS: 'orange',
      RISK_OPS: 'red',
      FINANCE_OPS: 'cyan',
      SUPPORT_OPS: 'magenta',
      TECH_OPS: 'gold',
      CONTENT_OPS: 'lime',
      DEPARTMENT_HEAD: 'volcano',
    };
    return colors[role] || 'default';
  };

  // Table columns for Admins
  const adminColumns: ColumnType<AdminUser>[] = [
    {
      title: 'Admin User',
      key: 'admin',
      render: (_, record: AdminUser) => (
        <Space>
          <Avatar
            size="large"
            src={record.avatar}
            icon={<UserOutlined />}
          />
          <Space direction="vertical" size={0}>
            <Text strong>{`${record.firstName} ${record.lastName}`}</Text>
            {record.username && <Text type="secondary">@{record.username}</Text>}
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.email}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: AdminRole) => (
        <Tag color={getRoleColor(role)}>
          {role === 'SUPER_ADMIN' && <CrownOutlined />}
          {role.replace(/_/g, ' ')}
        </Tag>
      ),
      filters: Object.values(AdminRole).map(role => ({
        text: role.replace(/_/g, ' '),
        value: role,
      })),
      onFilter: (value, record) => record.role === value,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      render: (department: string) => (
        department ? <Tag color="blue">{department}</Tag> : <Text type="secondary">-</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AdminStatus) => (
        <Badge
          status={getStatusColor(status) as any}
          text={status}
        />
      ),
      filters: Object.values(AdminStatus).map(status => ({
        text: status,
        value: status,
      })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Security',
      key: 'security',
      render: (_, record: AdminUser) => (
        <Space direction="vertical" size={0}>
          <Space>
            {record.twoFactorEnabled ? (
              <Tooltip title="2FA Enabled">
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              </Tooltip>
            ) : (
              <Tooltip title="2FA Disabled">
                <WarningOutlined style={{ color: '#fa8c16' }} />
              </Tooltip>
            )}
            <Text style={{ fontSize: '12px' }}>
              {record.twoFactorEnabled ? '2FA' : 'No 2FA'}
            </Text>
          </Space>
          {record.ipWhitelist && record.ipWhitelist.length > 0 && (
            <Space>
              <SafetyOutlined style={{ color: '#1890ff' }} />
              <Text style={{ fontSize: '12px' }}>
                IP Whitelist ({record.ipWhitelist.length})
              </Text>
            </Space>
          )}
        </Space>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date: string) => (
        date ? (
          <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
            {moment(date).fromNow()}
          </Tooltip>
        ) : (
          <Text type="secondary">Never</Text>
        )
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => moment(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: AdminUser) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewAdmin(record)}
            />
          </Tooltip>
          {canEditAdmins && (
            <Tooltip title="Edit Admin">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => handleViewAdmin(record)}
              />
            </Tooltip>
          )}
          {canManagePermissions && (
            <Tooltip title="Manage Permissions">
              <Button
                type="text"
                icon={<KeyOutlined />}
                onClick={() => {
                  setSelectedAdmin(record);
                  setPermissionsModalVisible(true);
                }}
              />
            </Tooltip>
          )}
          {canDeleteAdmins && record.id !== selectedAdmin?.id && (
            <Popconfirm
              title="Delete Admin"
              description="Are you sure you want to delete this admin user?"
              onConfirm={() => {/* Handle delete */}}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  if (!canViewAdmins) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Admin Management page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Mock data for permissions
  const mockPermissions = permissionsData || [
    { id: '1', name: 'admin:view', description: 'View admin users' },
    { id: '2', name: 'admin:create', description: 'Create admin users' },
    { id: '3', name: 'admin:edit', description: 'Edit admin users' },
    { id: '4', name: 'admin:delete', description: 'Delete admin users' },
    { id: '5', name: 'users:view', description: 'View platform users' },
    { id: '6', name: 'users:suspend', description: 'Suspend users' },
    { id: '7', name: 'brokers:view', description: 'View brokers' },
    { id: '8', name: 'brokers:approve', description: 'Approve brokers' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Admin Management
            </Title>
            <Text type="secondary">Manage platform administrators and permissions</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetchAdmins()}
              >
                Refresh
              </Button>
              {canCreateAdmins && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
                  Create Admin
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
              title="Total Admins"
              value={adminsData?.total || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Admins"
              value={adminsData?.data?.filter((a: AdminUser) => a.status === 'ACTIVE').length || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Super Admins"
              value={adminsData?.data?.filter((a: AdminUser) => a.role === 'SUPER_ADMIN').length || 0}
              prefix={<CrownOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="2FA Enabled"
              value={adminsData?.data?.filter((a: AdminUser) => a.twoFactorEnabled).length || 0}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4" size="small">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="Search admins..."
              prefix={<SearchOutlined />}
              value={adminFilters.search}
              onChange={(e) => handleAdminFilterChange('search', e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Role"
              value={adminFilters.role}
              onChange={(value) => handleAdminFilterChange('role', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value={AdminRole.SUPER_ADMIN}>Super Admin</Select.Option>
              <Select.Option value={AdminRole.USER_OPS}>User Operations</Select.Option>
              <Select.Option value={AdminRole.BROKER_OPS}>Broker Operations</Select.Option>
              <Select.Option value={AdminRole.TREND_OPS}>Trend Operations</Select.Option>
              <Select.Option value={AdminRole.RISK_OPS}>Risk Operations</Select.Option>
              <Select.Option value={AdminRole.FINANCE_OPS}>Finance Operations</Select.Option>
              <Select.Option value={AdminRole.SUPPORT_OPS}>Support Operations</Select.Option>
              <Select.Option value={AdminRole.TECH_OPS}>Tech Operations</Select.Option>
              <Select.Option value={AdminRole.CONTENT_OPS}>Content Operations</Select.Option>
              <Select.Option value={AdminRole.DEPARTMENT_HEAD}>Department Head</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Status"
              value={adminFilters.status}
              onChange={(value) => handleAdminFilterChange('status', value)}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value={AdminStatus.ACTIVE}>Active</Select.Option>
              <Select.Option value={AdminStatus.SUSPENDED}>Suspended</Select.Option>
              <Select.Option value={AdminStatus.PENDING}>Pending</Select.Option>
              <Select.Option value={AdminStatus.LOCKED}>Locked</Select.Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Admins Table */}
      <Card>
        <Table
          columns={adminColumns}
          dataSource={adminsData?.data || []}
          loading={adminsLoading}
          rowKey="id"
          pagination={{
            current: adminFilters.page,
            pageSize: adminFilters.limit,
            total: adminsData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} admins`,
            onChange: (page, pageSize) => {
              setAdminFilters(prev => ({
                ...prev,
                page,
                limit: pageSize || 20,
              }));
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Admin Details Modal */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            Admin Details: {selectedAdmin?.firstName} {selectedAdmin?.lastName}
          </Space>
        }
        visible={adminModalVisible}
        onCancel={() => setAdminModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setAdminModalVisible(false)}>
            Close
          </Button>,
          canEditAdmins && (
            <Button key="save" type="primary" onClick={handleUpdateAdmin}>
              Save Changes
            </Button>
          ),
        ]}
        width={800}
      >
        {selectedAdmin && (
          <Form form={editForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="First Name" name="firstName">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Last Name" name="lastName">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Role" name="role">
                  <Select>
                    {Object.values(AdminRole).map(role => (
                      <Select.Option key={role} value={role}>
                        {role.replace(/_/g, ' ')}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Status" name="status">
                  <Select>
                    {Object.values(AdminStatus).map(status => (
                      <Select.Option key={status} value={status}>
                        {status}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Department" name="department">
                  <Input placeholder="e.g., Operations, Support, Engineering" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Email">
                  <Input value={selectedAdmin.email} disabled />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <Descriptions bordered column={2}>
              <Descriptions.Item label="Username">
                {selectedAdmin.username || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Email Verified">
                <Badge
                  status={selectedAdmin.emailVerifiedAt ? 'success' : 'default'}
                  text={selectedAdmin.emailVerifiedAt ? 'Verified' : 'Not Verified'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="2FA Enabled">
                <Badge
                  status={selectedAdmin.twoFactorEnabled ? 'success' : 'error'}
                  text={selectedAdmin.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selectedAdmin.phone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {moment(selectedAdmin.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {moment(selectedAdmin.updatedAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Login">
                {selectedAdmin.lastLoginAt ?
                  moment(selectedAdmin.lastLoginAt).format('YYYY-MM-DD HH:mm:ss') :
                  'Never'
                }
              </Descriptions.Item>
            </Descriptions>
          </Form>
        )}
      </Modal>

      {/* Create Admin Modal */}
      <Modal
        title={
          <Space>
            <PlusOutlined />
            Create Admin User
          </Space>
        }
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateAdmin}
        confirmLoading={createAdminMutation.isLoading}
        width={700}
      >
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="First Name"
                name="firstName"
                rules={[{ required: true, message: 'Please enter first name' }]}
              >
                <Input placeholder="John" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Last Name"
                name="lastName"
                rules={[{ required: true, message: 'Please enter last name' }]}
              >
                <Input placeholder="Doe" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Please enter email' },
              { type: 'email', message: 'Please enter valid email' }
            ]}
          >
            <Input placeholder="john.doe@example.com" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Please enter password' }]}
          >
            <Input.Password placeholder="Enter secure password" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Role"
                name="role"
                rules={[{ required: true, message: 'Please select role' }]}
              >
                <Select placeholder="Select role">
                  {Object.values(AdminRole).map(role => (
                    <Select.Option key={role} value={role}>
                      {role.replace(/_/g, ' ')}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Department" name="department">
                <Input placeholder="e.g., Operations" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Permission IDs" name="permissionIds">
            <Select
              mode="multiple"
              placeholder="Select permissions"
              options={mockPermissions.map(perm => ({
                label: `${perm.name} - ${perm.description}`,
                value: perm.id,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Permissions Modal */}
      <Modal
        title={
          <Space>
            <KeyOutlined />
            Manage Permissions: {selectedAdmin?.firstName} {selectedAdmin?.lastName}
          </Space>
        }
        visible={permissionsModalVisible}
        onCancel={() => setPermissionsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPermissionsModalVisible(false)}>
            Close
          </Button>,
          <Button key="save" type="primary">
            Save Permissions
          </Button>,
        ]}
        width={800}
      >
        <Transfer
          dataSource={mockPermissions}
          targetKeys={targetKeys}
          onChange={setTargetKeys}
          render={(item) => `${item.name} - ${item.description}`}
          listStyle={{
            width: 300,
            height: 300,
          }}
          titles={['Available Permissions', 'Assigned Permissions']}
        />
      </Modal>
    </div>
  );
};

export default Admins;