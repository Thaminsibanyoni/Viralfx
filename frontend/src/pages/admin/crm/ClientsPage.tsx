import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, Row, Col, Statistic, Form, Modal, message, Tooltip, Avatar, Drawer, Descriptions, DatePicker, } from 'antd';
import {
  UserOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, PlusOutlined, EditOutlined, MessageOutlined, CalendarOutlined, DollarOutlined, RiseOutlined, ReloadOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, ClientRecord, ClientFilters } from '../../../services/api/crm.api';
import ClientForm from '../../../components/crm/ClientForm';
import ClientInteractionForm from '../../../components/crm/ClientInteractionForm';

const {Title} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;

interface ClientsPageProps {}

const ClientsPage: React.FC<ClientsPageProps> = () => {
  const [filters, setFilters] = useState<ClientFilters>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [interactionModalVisible, setInteractionModalVisible] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [interactionForm] = Form.useForm();

  const queryClient = useQueryClient();

  // Fetch clients
  const {data: clientsData, isLoading, refetch} = useQuery({
    queryKey: ['clients', filters],
    queryFn: () => crmApi.getClients(filters),
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: (clientData: Partial<ClientRecord>) => crmApi.createClient(clientData),
    onSuccess: () => {
      message.success('Client created successfully');
      setIsModalVisible(false);
      setEditingClient(null);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: () => {
      message.error('Failed to create client');
    },
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ClientRecord> }) =>
      crmApi.updateClient(id, data),
    onSuccess: () => {
      message.success('Client updated successfully');
      setIsModalVisible(false);
      setEditingClient(null);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: () => {
      message.error('Failed to update client');
    },
  });

  // Add interaction mutation
  const addInteractionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      crmApi.addClientInteraction(id, data),
    onSuccess: () => {
      message.success('Interaction added successfully');
      setInteractionModalVisible(false);
      interactionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (selectedClient) {
        queryClient.invalidateQueries({ queryKey: ['client-interactions', selectedClient.id] });
      }
    },
    onError: () => {
      message.error('Failed to add interaction');
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof ClientFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handle date range filter
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        lastActivityAfter: dates[0].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters(prev => ({ ...prev, lastActivityAfter: undefined }));
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({});
  };

  // Handle create client
  const handleCreateClient = () => {
    setEditingClient(null);
    setIsModalVisible(true);
  };

  // Handle edit client
  const handleEditClient = (client: ClientRecord) => {
    setEditingClient(client);
    setIsModalVisible(true);
  };

  // Handle form submit
  const handleFormSubmit = (values: Partial<ClientRecord>) => {
    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, data: values });
    } else {
      createClientMutation.mutate(values);
    }
  };

  // Handle view client
  const handleViewClient = (client: ClientRecord) => {
    setSelectedClient(client);
    setDrawerVisible(true);
  };

  // Handle add interaction
  const handleAddInteraction = (client: ClientRecord) => {
    setSelectedClient(client);
    setInteractionModalVisible(true);
  };

  // Handle interaction form submit
  const handleInteractionSubmit = (values: any) => {
    if (selectedClient) {
      addInteractionMutation.mutate({
        id: selectedClient.id,
        data: values,
      });
    }
  };

  // Table columns
  const columns: ColumnsType<ClientRecord> = [
    {
      title: 'Client',
      key: 'client',
      render: (_, record) => (
        <div className="flex items-center space-x-3">
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <div className="font-medium">
              {record.user?.firstName} {record.user?.lastName}
            </div>
            <div className="text-sm text-gray-500">{record.user?.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Segment',
      dataIndex: 'segment',
      key: 'segment',
      render: (segment) => (
        <Tag color={getSegmentColor(segment)}>
          {segment}
        </Tag>
      ),
    },
    {
      title: 'Broker',
      dataIndex: 'brokerId',
      key: 'brokerId',
      render: (brokerId) => (
        <span className="text-sm">
          {brokerId ? `Assigned (${brokerId.slice(0, 8)}...)` : 'Unassigned'}
        </span>
      ),
    },
    {
      title: 'Activity',
      key: 'activity',
      render: (_, record) => (
        <div>
          <div className="text-sm">
            <span className="font-medium">{record.totalTrades}</span> trades
          </div>
          <div className="text-xs text-gray-500">
            Volume: ${Number(record.totalVolume).toLocaleString()}
          </div>
        </div>
      ),
    },
    {
      title: 'P&L',
      dataIndex: 'totalPnl',
      key: 'totalPnl',
      render: (pnl) => {
        const value = Number(pnl);
        return (
          <span className={value >= 0 ? 'text-green-600' : 'text-red-600'}>
            ${value.toLocaleString()}
          </span>
        );
      },
    },
    {
      title: 'Risk Score',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (riskScore) => {
        if (!riskScore) return <span className="text-gray-500">Not assessed</span>;
        const score = Number(riskScore);
        return (
          <Tag color={score <= 2 ? 'green' : score <= 3.5 ? 'orange' : 'red'}>
            {score.toFixed(2)}
          </Tag>
        );
      },
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (date) => date ? dayjs(date).fromNow() : 'Never',
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
              onClick={() => handleViewClient(record)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditClient(record)}
            />
          </Tooltip>
          <Tooltip title="Add Interaction">
            <Button
              type="text"
              icon={<MessageOutlined />}
              onClick={() => handleAddInteraction(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const getSegmentColor = (segment: string) => {
    const colors: Record<string, string> = {
      VIP: 'gold',
      ACTIVE: 'green',
      DORMANT: 'orange',
      HIGH_RISK: 'red',
      STANDARD: 'blue',
    };
    return colors[segment] || 'default';
  };

  // Calculate statistics
  const totalClients = clientsData?.data?.total || 0;
  const activeClients = clientsData?.data?.data?.filter(c => c.segment === 'ACTIVE').length || 0;
  const vipClients = clientsData?.data?.data?.filter(c => c.segment === 'VIP').length || 0;
  const totalVolume = clientsData?.data?.data?.reduce((sum, c) => sum + Number(c.totalVolume), 0) || 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Client Management</Title>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateClient}>
              Add Client
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Clients"
                value={totalClients}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active Clients"
                value={activeClients}
                prefix={<RiseOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="VIP Clients"
                value={vipClients}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Volume"
                value={totalVolume}
                prefix={<DollarOutlined />}
                precision={0}
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
                placeholder="Search by name or email"
                prefix={<SearchOutlined />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="Segment"
                value={filters.segment}
                onChange={(value) => handleFilterChange('segment', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="VIP">VIP</Option>
                <Option value="ACTIVE">Active</Option>
                <Option value="DORMANT">Dormant</Option>
                <Option value="HIGH_RISK">High Risk</Option>
                <Option value="STANDARD">Standard</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Source"
                value={filters.source}
                onChange={(value) => handleFilterChange('source', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="ORGANIC">Organic</Option>
                <Option value="REFERRAL">Referral</Option>
                <Option value="ADVERTISING">Advertising</Option>
                <Option value="PARTNER">Partner</Option>
                <Option value="BROKER">Broker</Option>
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                placeholder={['Last Activity From', 'Last Activity To']}
                onChange={handleDateRangeChange}
                style={{ width: '100%' }}
              />
            </Col>
            <Col span={4}>
              <Space>
                <Button icon={<FilterOutlined />} onClick={resetFilters}>
                  Reset
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                  Refresh
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>
      </div>

      {/* Clients Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={clientsData?.data?.data}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: filters.page || 1,
            pageSize: filters.limit || 10,
            total: clientsData?.data?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} clients`,
            onChange: (page, pageSize) => {
              setFilters(prev => ({ ...prev, page, limit: pageSize }));
            },
          }}
        />
      </Card>

      {/* Add/Edit Client Modal */}
      <Modal
        title={editingClient ? 'Edit Client' : 'Add New Client'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingClient(null);
        }}
        footer={null}
        width={800}
      >
        <ClientForm
          initialValues={editingClient}
          onSubmit={handleFormSubmit}
          loading={createClientMutation.isPending || updateClientMutation.isPending}
        />
      </Modal>

      {/* Client Details Drawer */}
      <Drawer
        title={`${selectedClient?.user?.firstName} ${selectedClient?.user?.lastName}`}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedClient && (
          <div className="space-y-6">
            <Descriptions title="Client Information" bordered column={2}>
              <Descriptions.Item label="Name">
                {selectedClient.user?.firstName} {selectedClient.user?.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedClient.user?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {selectedClient.user?.phone || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Country">
                {selectedClient.user?.country || 'Not provided'}
              </Descriptions.Item>
              <Descriptions.Item label="Segment">
                <Tag color={getSegmentColor(selectedClient.segment)}>
                  {selectedClient.segment}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source">
                {selectedClient.source || 'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Trades">
                {selectedClient.totalTrades}
              </Descriptions.Item>
              <Descriptions.Item label="Total Volume">
                ${Number(selectedClient.totalVolume).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Total P&L">
                <span className={Number(selectedClient.totalPnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${Number(selectedClient.totalPnl).toLocaleString()}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Risk Score">
                {selectedClient.riskScore ? (
                  <Tag color={Number(selectedClient.riskScore) <= 2 ? 'green' :
                               Number(selectedClient.riskScore) <= 3.5 ? 'orange' : 'red'}>
                    {Number(selectedClient.riskScore).toFixed(2)}
                  </Tag>
                ) : 'Not assessed'}
              </Descriptions.Item>
              <Descriptions.Item label="Last Activity">
                {selectedClient.lastActivityAt ? dayjs(selectedClient.lastActivityAt).format('YYYY-MM-DD HH:mm') : 'Never'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedClient.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            <div className="flex space-x-2">
              <Button icon={<EditOutlined />} onClick={() => {
                setDrawerVisible(false);
                handleEditClient(selectedClient);
              }}>
                Edit Client
              </Button>
              <Button icon={<MessageOutlined />} onClick={() => {
                setInteractionModalVisible(true);
              }}>
                Add Interaction
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Add Interaction Modal */}
      <Modal
        title="Add Client Interaction"
        open={interactionModalVisible}
        onCancel={() => {
          setInteractionModalVisible(false);
          interactionForm.resetFields();
        }}
        footer={null}
      >
        <ClientInteractionForm
          form={interactionForm}
          onSubmit={handleInteractionSubmit}
          loading={addInteractionMutation.isPending}
        />
      </Modal>
    </div>
  );
};

export default ClientsPage;