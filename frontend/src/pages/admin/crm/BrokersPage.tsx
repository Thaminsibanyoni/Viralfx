import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, Row, Col, Statistic, Form, Modal, message, Tooltip, Badge, Avatar, Progress, Popconfirm, Drawer, Descriptions, } from 'antd';
import {
  TeamOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, PlusOutlined, EditOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, UserOutlined, BankOutlined, FileTextOutlined, AlertOutlined, StarOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, BrokerAccount, BrokerFilters } from '../../../services/api/crm.api';
import BrokerForm from '../../../components/crm/BrokerForm';
import BrokerCard from '../../../components/crm/BrokerCard';

const {Title} = Typography;
const {Option} = Select;

interface BrokersPageProps {}

const BrokersPage: React.FC<BrokersPageProps> = () => {
  const [filters, setFilters] = useState<BrokerFilters>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBroker, setEditingBroker] = useState<BrokerAccount | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerAccount | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const queryClient = useQueryClient();

  // Fetch brokers
  const {data: brokersData, isLoading, refetch} = useQuery({
    queryKey: ['brokers', filters],
    queryFn: () => crmApi.getAllBrokerAccounts(filters),
  });

  // Create broker mutation
  const createBrokerMutation = useMutation({
    mutationFn: (brokerData: Partial<BrokerAccount>) => crmApi.createBrokerAccount(brokerData),
    onSuccess: () => {
      message.success('Broker created successfully');
      setIsModalVisible(false);
      setEditingBroker(null);
      queryClient.invalidateQueries({ queryKey: ['brokers'] });
    },
    onError: () => {
      message.error('Failed to create broker');
    },
  });

  // Update broker mutation
  const updateBrokerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BrokerAccount> }) =>
      crmApi.updateBrokerAccount(id, data),
    onSuccess: () => {
      message.success('Broker updated successfully');
      setIsModalVisible(false);
      setEditingBroker(null);
      queryClient.invalidateQueries({ queryKey: ['brokers'] });
    },
    onError: () => {
      message.error('Failed to update broker');
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof BrokerFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({});
  };

  // Handle edit broker
  const handleEditBroker = (broker: BrokerAccount) => {
    setEditingBroker(broker);
    setIsModalVisible(true);
  };

  // Handle create broker
  const handleCreateBroker = () => {
    setEditingBroker(null);
    setIsModalVisible(true);
  };

  // Handle form submit
  const handleFormSubmit = (values: Partial<BrokerAccount>) => {
    if (editingBroker) {
      updateBrokerMutation.mutate({ id: editingBroker.id, data: values });
    } else {
      createBrokerMutation.mutate(values);
    }
  };

  // Handle view broker details
  const handleViewBroker = (broker: BrokerAccount) => {
    setSelectedBroker(broker);
    setDrawerVisible(true);
  };

  // Table columns
  const columns: ColumnsType<BrokerAccount> = [
    {
      title: 'Broker',
      key: 'broker',
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div className="font-medium">{record.broker?.companyName}</div>
            <div className="text-sm text-gray-500">{record.broker?.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'broker',
      key: 'tier',
      render: (broker) => (
        <Tag color={getTierColor(broker?.tier)}>
          {broker?.tier || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Compliance',
      dataIndex: 'complianceStatus',
      key: 'complianceStatus',
      render: (complianceStatus, record) => (
        <div className="space-y-1">
          <Tag color={getComplianceColor(complianceStatus)}>
            {complianceStatus}
          </Tag>
          {record.fscaVerified && (
            <Tag color="green" icon={<CheckOutlined />}>
              FSCA Verified
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Risk Rating',
      dataIndex: 'riskRating',
      key: 'riskRating',
      render: (riskRating) => (
        <Tag color={getRiskColor(riskRating)}>
          {riskRating}
        </Tag>
      ),
    },
    {
      title: 'Credit Limit',
      dataIndex: 'creditLimit',
      key: 'creditLimit',
      render: (creditLimit) => (
        <span>${Number(creditLimit).toLocaleString()}</span>
      ),
    },
    {
      title: 'Payment Terms',
      dataIndex: 'paymentTerms',
      key: 'paymentTerms',
      render: (paymentTerms) => (
        <span>{paymentTerms} days</span>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewBroker(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditBroker(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const tierColors: Record<string, string> = {
    STARTER: 'default',
    VERIFIED: 'blue',
    PARTNER: 'purple',
    ENTERPRISE: 'gold',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'green',
    INACTIVE: 'default',
    PENDING: 'orange',
    SUSPENDED: 'red',
  };

  const complianceColors: Record<string, string> = {
    APPROVED: 'green',
    PENDING: 'orange',
    SUSPENDED: 'red',
  };

  const riskColors: Record<string, string> = {
    LOW: 'green',
    MEDIUM: 'orange',
    HIGH: 'red',
  };

  const _getTierColor = (tier?: string) => tierColors[tier || ''] || 'default';
  const _getStatusColor = (status: string) => statusColors[status] || 'default';
  const _getComplianceColor = (status: string) => complianceColors[status] || 'default';
  const _getRiskColor = (risk: string) => riskColors[risk] || 'default';

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Broker Management</Title>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBroker}>
              Add Broker
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Brokers"
                value={brokersData?.data?.total || 0}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active Brokers"
                value={brokersData?.data?.data?.filter(b => b.status === 'ACTIVE').length || 0}
                prefix={<CheckOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Pending Compliance"
                value={brokersData?.data?.data?.filter(b => b.complianceStatus === 'PENDING').length || 0}
                prefix={<AlertOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="FSCA Verified"
                value={brokersData?.data?.data?.filter(b => b.fscaVerified).length || 0}
                prefix={<StarOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="Search by company name or email"
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Status"
                value={filters.status}
                onChange={(value) => handleFilterChange('status', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="ACTIVE">Active</Option>
                <Option value="INACTIVE">Inactive</Option>
                <Option value="PENDING">Pending</Option>
                <Option value="SUSPENDED">Suspended</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Tier"
                value={filters.tier}
                onChange={(value) => handleFilterChange('tier', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="STARTER">Starter</Option>
                <Option value="VERIFIED">Verified</Option>
                <Option value="PARTNER">Partner</Option>
                <Option value="ENTERPRISE">Enterprise</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Compliance"
                value={filters.complianceStatus}
                onChange={(value) => handleFilterChange('complianceStatus', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="APPROVED">Approved</Option>
                <Option value="PENDING">Pending</Option>
                <Option value="SUSPENDED">Suspended</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Space>
                <Button icon={<FilterOutlined />} onClick={resetFilters}>
                  Reset Filters
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Brokers Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={brokersData?.data?.data}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: filters.page || 1,
            pageSize: filters.limit || 10,
            total: brokersData?.data?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} brokers`,
            onChange: (page, pageSize) => {
              setFilters(prev => ({ ...prev, page, limit: pageSize }));
            },
          }}
        />
      </Card>

      {/* Add/Edit Broker Modal */}
      <Modal
        title={editingBroker ? 'Edit Broker' : 'Add New Broker'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingBroker(null);
        }}
        footer={null}
        width={800}
      >
        <BrokerForm
          initialValues={editingBroker}
          onSubmit={handleFormSubmit}
          loading={createBrokerMutation.isPending || updateBrokerMutation.isPending}
        />
      </Modal>

      {/* Broker Details Drawer */}
      <Drawer
        title={selectedBroker?.broker?.companyName}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedBroker && (
          <BrokerCard
            broker={selectedBroker}
            onEdit={() => {
              setDrawerVisible(false);
              handleEditBroker(selectedBroker);
            }}
          />
        )}
      </Drawer>
    </div>
  );
};

export default BrokersPage;