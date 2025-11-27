import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, DatePicker, Row, Col, Statistic, Tabs, Form, Modal, message, Tooltip, Drawer, Descriptions, Timeline, Alert, Progress, Badge, Popconfirm, Rate, List, Avatar, InputNumber, Switch, } from 'antd';
import {
  CustomerServiceOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, ClockCircleOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, BookOutlined, ExclamationCircleOutlined, UserOutlined, MessageOutlined, CalendarOutlined, WarningOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { supportApi, type Ticket, type SupportDashboard, type TicketCategory, type KnowledgeBaseArticle } from '../../services/api/support.api';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;
const {Option} = Select;
const {TextArea} = Input;

const Support: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TicketCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [articleModalVisible, setArticleModalVisible] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [articleForm] = Form.useForm();

  const _queryClient = useQueryClient();

  // Dashboard Query
  const {data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard} = useQuery({
    queryKey: ['support-dashboard'],
    queryFn: () => supportApi.getDashboard(),
  });

  // Tickets Query
  const {data: ticketsData, isLoading: ticketsLoading, refetch: refetchTickets} = useQuery({
    queryKey: ['support-tickets', filters, dateRange],
    queryFn: () => supportApi.getTickets({
      page: 1,
      limit: 20,
      ...(dateRange && {
        dateRange: {
          start: dateRange[0].toDate(),
          end: dateRange[1].toDate(),
        },
      }),
      ...filters,
    }),
  });

  // Categories Query
  const {data: categoriesData, isLoading: categoriesLoading, refetch: refetchCategories} = useQuery({
    queryKey: ['support-categories'],
    queryFn: () => supportApi.getCategories(),
  });

  // Knowledge Base Query
  const {data: articlesData, isLoading: articlesLoading, refetch: refetchArticles} = useQuery({
    queryKey: ['support-articles', filters],
    queryFn: () => supportApi.getArticles({
      page: 1,
      limit: 20,
      ...filters,
    }),
  });

  // Mutations
  const createTicketMutation = useMutation({
    mutationFn: supportApi.createTicket,
    onSuccess: () => {
      message.success('Ticket created successfully');
      setTicketModalVisible(false);
      form.resetFields();
      refetchTickets();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create ticket');
    },
  });

  const updateTicketStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      supportApi.updateTicketStatus(id, status, notes),
    onSuccess: () => {
      message.success('Ticket status updated');
      refetchTickets();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update ticket');
    },
  });

  const assignTicketMutation = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string }) =>
      supportApi.assignTicket(id, assignedTo),
    onSuccess: () => {
      message.success('Ticket assigned successfully');
      refetchTickets();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to assign ticket');
    },
  });

  const _addTicketMessageMutation = useMutation({
    mutationFn: ({ id, messageData }: { id: string; messageData: any }) =>
      supportApi.addTicketMessage(id, messageData),
    onSuccess: () => {
      message.success('Message added successfully');
      refetchTickets();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to add message');
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: supportApi.createCategory,
    onSuccess: () => {
      message.success('Category created successfully');
      setCategoryModalVisible(false);
      categoryForm.resetFields();
      refetchCategories();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create category');
    },
  });

  const createArticleMutation = useMutation({
    mutationFn: supportApi.createArticle,
    onSuccess: () => {
      message.success('Article created successfully');
      setArticleModalVisible(false);
      articleForm.resetFields();
      refetchArticles();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create article');
    },
  });

  const publishArticleMutation = useMutation({
    mutationFn: supportApi.publishArticle,
    onSuccess: () => {
      message.success('Article published successfully');
      refetchArticles();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to publish article');
    },
  });

  const handleCreateTicket = (values: any) => {
    createTicketMutation.mutate(values);
  };

  const _handleCreateCategory = (values: any) => {
    createCategoryMutation.mutate(values);
  };

  const handleCreateArticle = (values: any) => {
    createArticleMutation.mutate(values);
  };

  const handleExport = (type: string) => {
    const exportData = {
      ...(dateRange && {
        dateRange: {
          start: dateRange[0].toDate(),
          end: dateRange[1].toDate(),
        },
      }),
      ...filters,
    };

    if (type === 'tickets') {
      supportApi.exportTickets(exportData).then((response) => {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tickets_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Tickets exported successfully');
      });
    } else if (type === 'articles') {
      supportApi.exportArticles(exportData).then((response) => {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `articles_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Articles exported successfully');
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return '#ff4d4f';
      case 'HIGH':
        return '#ff7a45';
      case 'MEDIUM':
        return '#faad14';
      case 'LOW':
        return '#52c41a';
      default:
        return '#d9d9d9';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return '#1890ff';
      case 'OPEN':
        return '#52c41a';
      case 'PENDING':
        return '#faad14';
      case 'RESOLVED':
        return '#52c41a';
      case 'CLOSED':
        return '#722ed1';
      case 'REOPENED':
        return '#ff4d4f';
      default:
        return '#d9d9d9';
    }
  };

  // Ticket Table Columns
  const ticketColumns: ColumnsType<Ticket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (number) => (
        <Tag color="blue">#{number}</Tag>
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      render: (text) => (
        <Tooltip title={text}>
          <Text ellipsis style={{ maxWidth: 200 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'categoryId',
      key: 'categoryId',
      render: (categoryId) => {
        const category = categoriesData?.data.find((cat: any) => cat.id === categoryId);
        return category ? <Tag>{category.name}</Tag> : '-';
      },
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
        <Tag color={getStatusColor(status)}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY HH:mm'),
    },
    {
      title: 'First Response',
      dataIndex: 'firstResponseAt',
      key: 'firstResponseAt',
      render: (date) => date ? dayjs(date).format('MMM DD, HH:mm') : '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedTicket(record)}
            />
          </Tooltip>
          <Tooltip title="Assign">
            <Button
              type="text"
              icon={<UserOutlined />}
              onClick={() => assignTicketMutation.mutate({
                id: record.id,
                assignedTo: 'agent-id' // In a real app, this would be a dropdown of agents
              })}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Knowledge Base Table Columns
  const articleColumns: ColumnsType<KnowledgeBaseArticle> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text) => (
        <Text ellipsis style={{ maxWidth: 300 }}>{text}</Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={
          status === 'PUBLISHED' ? 'green' :
          status === 'DRAFT' ? 'orange' : 'default'
        }>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
      render: (views) => (
        <Badge count={views} showZero />
      ),
    },
    {
      title: 'Helpful',
      dataIndex: 'helpful',
      key: 'helpful',
      render: (helpful, record) => (
        <Space>
          <Badge count={helpful} showZero />
          <Text style={{ color: '#666' }}>/</Text>
          <Badge count={record.notHelpful} showZero />
          <Rate
            disabled
            defaultValue={helpful / (helpful + record.notHelpful) || 0}
            allowHalf
            style={{ fontSize: 12 }}
          />
        </Space>
      ),
    },
    {
      title: 'Author',
      dataIndex: 'authorId',
      key: 'authorId',
      render: () => 'Admin', // In a real app, this would fetch user info
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Article">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedArticle(record)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <Tooltip title="Publish">
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => publishArticleMutation.mutate(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const renderDashboard = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Tickets"
              value={dashboard?.data.summary.totalTickets || 0}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Open Tickets"
              value={dashboard?.data.summary.openTickets || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Resolved Today"
              value={dashboard?.data.summary.resolvedTickets || 0}
              prefix={<CheckOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={dashboard?.data.summary.avgResolutionTime || 0}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{
                color: dashboard?.data.summary.avgResolutionTime < 60 ? '#52c41a' : '#faad14'
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Tickets by Status" style={{ height: 300 }}>
            {dashboard?.data.charts.ticketsByStatus.map((item: any) => (
              <div key={item.status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>{item.status}</Text>
                  <Tag color={getStatusColor(item.status)}>{item.count}</Tag>
                </div>
                <Progress
                  percent={(item.count / dashboard.data.summary.totalTickets) * 100}
                  showInfo={false}
                  strokeColor={getStatusColor(item.status)}
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Tickets by Priority" style={{ height: 300 }}>
            {dashboard?.data.charts.ticketsByPriority.map((item: any) => (
              <div key={item.priority} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text>{item.priority}</Text>
                  <Tag color={getPriorityColor(item.priority)}>{item.count}</Tag>
                </div>
                <Progress
                  percent={(item.count / dashboard.data.summary.totalTickets) * 100}
                  showInfo={false}
                  strokeColor={getPriorityColor(item.priority)}
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Knowledge Base Overview">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Statistic
                  title="Total Articles"
                  value={dashboard?.data.knowledgeBase.totalArticles || 0}
                  prefix={<BookOutlined />}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Published Articles"
                  value={dashboard?.data.knowledgeBase.publishedArticles || 0}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="Total Views"
                  value={dashboard?.data.knowledgeBase.totalViews || 0}
                  prefix={<EyeOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderTickets = () => (
    <div>
      <Card
        title="Support Tickets"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setTicketModalVisible(true)}
            >
              Create Ticket
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('tickets')}
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchTickets()}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="Search tickets..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <Select
              placeholder="Status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="NEW">New</Option>
              <Option value="OPEN">Open</Option>
              <Option value="PENDING">Pending</Option>
              <Option value="RESOLVED">Resolved</Option>
              <Option value="CLOSED">Closed</Option>
              <Option value="REOPENED">Reopened</Option>
            </Select>
            <Select
              placeholder="Priority"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, priority: value })}
            >
              <Option value="LOW">Low</Option>
              <Option value="MEDIUM">Medium</Option>
              <Option value="HIGH">High</Option>
              <Option value="CRITICAL">Critical</Option>
            </Select>
            <RangePicker onChange={setDateRange} />
          </Space>
        </div>
        <Table
          columns={ticketColumns}
          dataSource={ticketsData?.data.data || []}
          loading={ticketsLoading}
          pagination={{
            total: ticketsData?.data.total || 0,
            pageSize: 20,
            current: ticketsData?.data.page || 1,
          }}
        />
      </Card>

      {/* Create Ticket Modal */}
      <Modal
        title="Create Support Ticket"
        visible={ticketModalVisible}
        onCancel={() => setTicketModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateTicket}>
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
            <Select placeholder="Select category">
              {categoriesData?.data.map((category: any) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="priority" label="Priority" rules={[{ required: true }]}>
            <Select placeholder="Select priority">
              <Option value="LOW">Low</Option>
              <Option value="MEDIUM">Medium</Option>
              <Option value="HIGH">High</Option>
              <Option value="CRITICAL">Critical</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setTicketModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createTicketMutation.isLoading}>
                Create Ticket
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Ticket Details Drawer */}
      <Drawer
        title={`Ticket #${selectedTicket?.ticketNumber}`}
        placement="right"
        width={800}
        onClose={() => setSelectedTicket(null)}
        open={!!selectedTicket}
      >
        {selectedTicket && (
          <div>
            <Descriptions title="Ticket Information" bordered column={2}>
              <Descriptions.Item label="Subject">{selectedTicket.subject}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedTicket.status)}>
                  {selectedTicket.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(selectedTicket.priority)}>
                  {selectedTicket.priority}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {categoriesData?.data.find((cat: any) => cat.id === selectedTicket.categoryId)?.name || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedTicket.createdAt).format('MMM DD, YYYY HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="First Response">
                {selectedTicket.firstResponseAt ?
                  dayjs(selectedTicket.firstResponseAt).format('MMM DD, HH:mm') :
                  'Not responded yet'
                }
              </Descriptions.Item>
            </Descriptions>

            {selectedTicket.description && (
              <Card title="Description" style={{ marginTop: 16 }}>
                <Paragraph>{selectedTicket.description}</Paragraph>
              </Card>
            )}

            <Card title="Actions" style={{ marginTop: 24 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Select
                    placeholder="Update Status"
                    style={{ width: 200 }}
                    onChange={(value) => {
                      updateTicketStatusMutation.mutate({
                        id: selectedTicket.id,
                        status: value,
                      });
                    }}
                    value={selectedTicket.status}
                  >
                    <Option value="NEW">New</Option>
                    <Option value="OPEN">Open</Option>
                    <Option value="PENDING">Pending</Option>
                    <Option value="RESOLVED">Resolved</Option>
                    <Option value="CLOSED">Closed</Option>
                    <Option value="REOPENED">Reopened</Option>
                  </Select>
                  <Button
                    icon={<MessageOutlined />}
                    onClick={() => {
                      form.setFieldsValue({
                        content: '',
                        isInternal: false,
                      });
                    }}
                  >
                    Add Message
                  </Button>
                </Space>
              </Space>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );

  const renderKnowledgeBase = () => (
    <div>
      <Card
        title="Knowledge Base"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setArticleModalVisible(true)}
            >
              Create Article
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('articles')}
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchArticles()}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="Search articles..."
              prefix={<SearchOutlined />}
              style={{ width: 300 }}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <Select
              placeholder="Status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="DRAFT">Draft</Option>
              <Option value="PUBLISHED">Published</Option>
              <Option value="ARCHIVED">Archived</Option>
            </Select>
            <Button
              icon={<BookOutlined />}
              onClick={() => refetchArticles()}
            >
              Refresh
            </Button>
          </Space>
        </div>
        <Table
          columns={articleColumns}
          dataSource={articlesData?.data.data || []}
          loading={articlesLoading}
          pagination={{
            total: articlesData?.data.total || 0,
            pageSize: 20,
            current: articlesData?.data.page || 1,
          }}
        />
      </Card>

      {/* Create Article Modal */}
      <Modal
        title="Create Knowledge Base Article"
        visible={articleModalVisible}
        onCancel={() => setArticleModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={articleForm} layout="vertical" onFinish={handleCreateArticle}>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="content" label="Content" rules={[{ required: true }]}>
            <TextArea rows={10} />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select placeholder="Select category (optional)">
              {categoriesData?.data.map((category: any) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="tags" label="Tags">
            <Select
              mode="tags"
              placeholder="Add tags (optional)"
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="DRAFT">
            <Select>
              <Option value="DRAFT">Draft</Option>
              <Option value="PUBLISHED">Published</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setArticleModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createArticleMutation.isLoading}>
                Create Article
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Article Details Drawer */}
      <Drawer
        title={selectedArticle?.title}
        placement="right"
        width={800}
        onClose={() => setSelectedArticle(null)}
        open={!!selectedArticle}
      >
        {selectedArticle && (
          <div>
            <Descriptions title="Article Information" bordered column={2}>
              <Descriptions.Item label="Status">
                <Tag color={
                  selectedArticle.status === 'PUBLISHED' ? 'green' :
                  selectedArticle.status === 'DRAFT' ? 'orange' : 'default'
                }>
                  {selectedArticle.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Views">
                <Badge count={selectedArticle.views} showZero />
              </Descriptions.Item>
              <Descriptions.Item label="Helpful">
                <Space>
                  <Badge count={selectedArticle.helpful} showZero />
                  <Text style={{ color: '#666' }}>/</Text>
                  <Badge count={selectedArticle.notHelpful} showZero />
                </Space>
                <Rate
                  disabled
                  defaultValue={selectedArticle.helpful / (selectedArticle.helpful + selectedArticle.notHelpful) || 0}
                  allowHalf
                />
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedArticle.createdAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>

            {selectedArticle.excerpt && (
              <Card title="Excerpt" style={{ marginTop: 16 }}>
                <Paragraph>{selectedArticle.excerpt}</Paragraph>
              </Card>
            )}

            <Card title="Content" style={{ marginTop: 16 }}>
              <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
            </Card>

            <div style={{ marginTop: 24 }}>
              <Space>
                {selectedArticle.status === 'DRAFT' && (
                  <Button
                    type="primary"
                    onClick={() => publishArticleMutation.mutate(selectedArticle.id)}
                  >
                    Publish Article
                  </Button>
                )}
                <Button
                  icon={<ThumbsUpOutlined />}
                  onClick={() => {
                    supportApi.markHelpful(selectedArticle.id, true);
                  }}
                >
                  Helpful
                </Button>
                <Button
                  icon={<ThumbsDownOutlined />}
                  onClick={() => {
                    supportApi.markHelpful(selectedArticle.id, false);
                  }}
                >
                Not Helpful
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );

  return (
    <div className="support-page">
      <Title level={2}>Support Management</Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Dashboard" key="dashboard">
          {renderDashboard()}
        </TabPane>
        <TabPane tab="Tickets" key="tickets">
          {renderTickets()}
        </TabPane>
        <TabPane tab="Knowledge Base" key="knowledge-base">
          {renderKnowledgeBase()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Support;