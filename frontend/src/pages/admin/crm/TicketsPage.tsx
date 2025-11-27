import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, Row, Col, Statistic, Form, Modal, message, Tooltip, Badge, Avatar, Popconfirm, Drawer, Descriptions, Timeline, DatePicker, Rate, } from 'antd';
import {
  CustomerServiceOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, PlusOutlined, EditOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, ReloadOutlined, MessageOutlined, UserSwitchOutlined, StarOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, SupportTicket, TicketFilters } from '../../../services/api/crm.api';
import TicketForm from '../../../components/crm/TicketForm';
import TicketDetail from '../../../components/crm/TicketDetail';

const {Title} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;
const {TextArea} = Input;

interface TicketsPageProps {}

const TicketsPage: React.FC<TicketsPageProps> = () => {
  const [filters, setFilters] = useState<TicketFilters>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [closeForm] = Form.useForm();

  const queryClient = useQueryClient();

  // Fetch tickets
  const {data: ticketsData, isLoading, refetch} = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => crmApi.getTickets(filters),
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: (ticketData: Partial<SupportTicket>) => crmApi.createTicket(ticketData),
    onSuccess: () => {
      message.success('Ticket created successfully');
      setIsModalVisible(false);
      setEditingTicket(null);
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: () => {
      message.error('Failed to create ticket');
    },
  });

  // Close ticket mutation
  const closeTicketMutation = useMutation({
    mutationFn: ({ id, notes, rating, feedback }: { id: string; notes?: string; rating?: number; feedback?: string }) =>
      crmApi.closeTicket(id, notes, rating, feedback),
    onSuccess: () => {
      message.success('Ticket closed successfully');
      setCloseModalVisible(false);
      closeForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: () => {
      message.error('Failed to close ticket');
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof TicketFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Handle date range filter
  const handleDateRangeChange = (dates: any) => {
    if (dates && dates.length === 2) {
      setFilters(prev => ({
        ...prev,
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD'),
      }));
    } else {
      setFilters(prev => ({ ...prev, startDate: undefined, endDate: undefined }));
    }
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({});
  };

  // Handle create ticket
  const handleCreateTicket = () => {
    setEditingTicket(null);
    setIsModalVisible(true);
  };

  // Handle form submit
  const handleFormSubmit = (values: Partial<SupportTicket>) => {
    createTicketMutation.mutate(values);
  };

  // Handle view ticket
  const handleViewTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDrawerVisible(true);
  };

  // Handle close ticket
  const handleCloseTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setCloseModalVisible(true);
  };

  // Handle close ticket submit
  const handleCloseSubmit = (values: { notes?: string; rating?: number; feedback?: string }) => {
    if (selectedTicket) {
      closeTicketMutation.mutate({
        id: selectedTicket.id,
        ...values,
      });
    }
  };

  // Table columns
  const columns: ColumnsType<SupportTicket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (ticketNumber, record) => (
        <Button
          type="link"
          onClick={() => handleViewTicket(record)}
        >
          {ticketNumber}
        </Button>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title) => (
        <div className="max-w-xs truncate" title={title}>
          {title}
        </div>
      ),
    },
    {
      title: 'Client',
      key: 'client',
      render: (_, record) => (
        <div>
          {record.broker ? (
            <>
              <div className="font-medium">{record.broker.broker?.companyName}</div>
              <div className="text-sm text-gray-500">Broker</div>
            </>
          ) : record.client ? (
            <>
              <div className="font-medium">
                {record.client.user?.firstName} {record.client.user?.lastName}
              </div>
              <div className="text-sm text-gray-500">{record.client.user?.email}</div>
            </>
          ) : record.user ? (
            <>
              <div className="font-medium">
                {record.user.firstName} {record.user.lastName}
              </div>
              <div className="text-sm text-gray-500">{record.user.email}</div>
            </>
          ) : (
            <span className="text-gray-500">Unknown</span>
          )}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => (
        <Tag color={getCategoryColor(category)}>
          {category}
        </Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee) => assignee ? (
        <div className="flex items-center space-x-2">
          <Avatar size="small" icon={<UserOutlined />} />
          <span>{assignee.firstName} {assignee.lastName}</span>
        </div>
      ) : (
        <Tag color="orange">Unassigned</Tag>
      ),
    },
    {
      title: 'SLA',
      key: 'sla',
      render: (_, record) => {
        if (!record.slaDeadline) return <span className="text-gray-500">No SLA</span>;

        const now = dayjs();
        const deadline = dayjs(record.slaDeadline);
        const hoursRemaining = deadline.diff(now, 'hour');

        if (record.status === 'CLOSED' || record.status === 'RESOLVED') {
          return <Tag color="green">Met</Tag>;
        }

        if (hoursRemaining < 0) {
          return <Tag color="red" icon={<ExclamationCircleOutlined />}>Breached</Tag>;
        } else if (hoursRemaining < 2) {
          return <Tag color="orange" icon={<ClockCircleOutlined />}>{hoursRemaining}h left</Tag>;
        } else {
          return <Tag color="blue">{hoursRemaining}h left</Tag>;
        }
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
      sorter: true,
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
              onClick={() => handleViewTicket(record)}
            />
          </Tooltip>
          {record.status !== 'CLOSED' && record.status !== 'RESOLVED' && (
            <Tooltip title="Close Ticket">
              <Popconfirm
                title="Are you sure you want to close this ticket?"
                onConfirm={() => handleCloseTicket(record)}
                okText="Yes"
                cancelText="No"
              >
                <Button type="text" icon={<CheckCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const _getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'blue',
      IN_PROGRESS: 'orange',
      PENDING: 'default',
      RESOLVED: 'green',
      CLOSED: 'default',
    };
    return colors[status] || 'default';
  };

  const _getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      OPEN: <ExclamationCircleOutlined />,
      IN_PROGRESS: <ClockCircleOutlined />,
      PENDING: <ClockCircleOutlined />,
      RESOLVED: <CheckCircleOutlined />,
      CLOSED: <CloseCircleOutlined />,
    };
    return icons[status];
  };

  const _getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      LOW: 'green',
      NORMAL: 'blue',
      HIGH: 'orange',
      URGENT: 'red',
    };
    return colors[priority] || 'default';
  };

  const _getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      BILLING: 'purple',
      TECHNICAL: 'blue',
      ACCOUNT: 'orange',
      COMPLIANCE: 'red',
      GENERAL: 'default',
      FEATURE_REQUEST: 'green',
    };
    return colors[category] || 'default';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Support Tickets</Title>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTicket}>
              Create Ticket
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Tickets"
                value={ticketsData?.data?.total || 0}
                prefix={<CustomerServiceOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Open Tickets"
                value={ticketsData?.data?.data?.filter(t => t.status === 'OPEN').length || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="In Progress"
                value={ticketsData?.data?.data?.filter(t => t.status === 'IN_PROGRESS').length || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="SLA Breach"
                value={ticketsData?.data?.data?.filter(t => {
                  if (!t.slaDeadline || t.status === 'CLOSED' || t.status === 'RESOLVED') return false;
                  return dayjs(t.slaDeadline).isBefore(dayjs());
                }).length || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="Search by ticket number or title"
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
                <Option value="OPEN">Open</Option>
                <Option value="IN_PROGRESS">In Progress</Option>
                <Option value="PENDING">Pending</Option>
                <Option value="RESOLVED">Resolved</Option>
                <Option value="CLOSED">Closed</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Priority"
                value={filters.priority}
                onChange={(value) => handleFilterChange('priority', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="LOW">Low</Option>
                <Option value="NORMAL">Normal</Option>
                <Option value="HIGH">High</Option>
                <Option value="URGENT">Urgent</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Category"
                value={filters.category}
                onChange={(value) => handleFilterChange('category', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="BILLING">Billing</Option>
                <Option value="TECHNICAL">Technical</Option>
                <Option value="ACCOUNT">Account</Option>
                <Option value="COMPLIANCE">Compliance</Option>
                <Option value="GENERAL">General</Option>
                <Option value="FEATURE_REQUEST">Feature Request</Option>
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                placeholder={['Start Date', 'End Date']}
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

      {/* Tickets Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={ticketsData?.data?.data}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: filters.page || 1,
            pageSize: filters.limit || 10,
            total: ticketsData?.data?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} tickets`,
            onChange: (page, pageSize) => {
              setFilters(prev => ({ ...prev, page, limit: pageSize }));
            },
          }}
        />
      </Card>

      {/* Create Ticket Modal */}
      <Modal
        title="Create New Ticket"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingTicket(null);
        }}
        footer={null}
        width={800}
      >
        <TicketForm
          initialValues={editingTicket}
          onSubmit={handleFormSubmit}
          loading={createTicketMutation.isPending}
        />
      </Modal>

      {/* Ticket Details Drawer */}
      <Drawer
        title={`Ticket ${selectedTicket?.ticketNumber}`}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={800}
      >
        {selectedTicket && (
          <TicketDetail
            ticket={selectedTicket}
            onUpdate={() => queryClient.invalidateQueries({ queryKey: ['tickets'] })}
          />
        )}
      </Drawer>

      {/* Close Ticket Modal */}
      <Modal
        title="Close Ticket"
        open={closeModalVisible}
        onCancel={() => {
          setCloseModalVisible(false);
          closeForm.resetFields();
        }}
        onOk={() => closeForm.submit()}
        confirmLoading={closeTicketMutation.isPending}
      >
        <Form
          form={closeForm}
          layout="vertical"
          onFinish={handleCloseSubmit}
        >
          <Form.Item
            label="Resolution Notes"
            name="notes"
            rules={[{ required: true, message: 'Please enter resolution notes' }]}
          >
            <TextArea rows={4} placeholder="Enter resolution details..." />
          </Form.Item>
          <Form.Item
            label="Customer Satisfaction"
            name="rating"
          >
            <Rate allowHalf />
          </Form.Item>
          <Form.Item
            label="Customer Feedback"
            name="feedback"
          >
            <TextArea rows={3} placeholder="Optional customer feedback..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TicketsPage;