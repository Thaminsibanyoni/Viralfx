import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, DatePicker, Row, Col, Statistic, Tabs, Form, Modal, message, Tooltip, Drawer, Descriptions, Timeline, Alert, Progress, Badge, Popconfirm, Menu, Dropdown, } from 'antd';
import {
  TeamOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, UserOutlined, DollarOutlined, CalendarOutlined, CheckOutlined, CloseOutlined, ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, ClockCircleOutlined, FileTextOutlined, DashboardOutlined, CustomerServiceOutlined, ThunderboltOutlined, SettingOutlined, MoreOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, type Lead, type Opportunity, type Contract, type CRMDashboard, BrokerAccount, SupportTicket, BrokerDeal } from '../../services/api/crm.api';

const {Title, Text} = Typography;
const {TabPane} = Tabs;
const {RangePicker} = DatePicker;
const {Option} = Select;

const CRM: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [leadModalVisible, setLeadModalVisible] = useState(false);
  const [opportunityModalVisible, setOpportunityModalVisible] = useState(false);
  const [contractModalVisible, setContractModalVisible] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [form] = Form.useForm();
  const [opportunityForm] = Form.useForm();
  const [contractForm] = Form.useForm();

  const _queryClient = useQueryClient();

  // Dashboard Query
  const {data: dashboard, isLoading: dashboardLoading, refetch: refetchDashboard} = useQuery({
    queryKey: ['crm-dashboard', filters, dateRange],
    queryFn: () => crmApi.getDashboard({
      ...(dateRange && {
        startDate: dateRange[0].toISOString(),
        endDate: dateRange[1].toISOString(),
      }),
      ...filters,
    }),
  });

  // Leads Query
  const {data: leadsData, isLoading: leadsLoading, refetch: refetchLeads} = useQuery({
    queryKey: ['crm-leads', filters, dateRange],
    queryFn: () => crmApi.getLeads({
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

  // Opportunities Query
  const {data: opportunitiesData, isLoading: opportunitiesLoading, refetch: refetchOpportunities} = useQuery({
    queryKey: ['crm-opportunities', filters, dateRange],
    queryFn: () => crmApi.getOpportunities({
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

  // Contracts Query
  const {data: contractsData, isLoading: contractsLoading, refetch: refetchContracts} = useQuery({
    queryKey: ['crm-contracts', filters, dateRange],
    queryFn: () => crmApi.getContracts({
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

  // Sales Forecast Query
  const {data: forecast, refetch: refetchForecast} = useQuery({
    queryKey: ['crm-forecast'],
    queryFn: () => crmApi.getSalesForecast(30),
  });

  // New CRM Module Queries
  const {data: brokersData, isLoading: brokersLoading} = useQuery({
    queryKey: ['crm-brokers'],
    queryFn: () => crmApi.getAllBrokerAccounts({ limit: 5 }),
  });

  const {data: ticketsData, isLoading: ticketsLoading} = useQuery({
    queryKey: ['crm-tickets'],
    queryFn: () => crmApi.getTickets({ limit: 5 }),
  });

  const {data: dealsData, isLoading: dealsLoading} = useQuery({
    queryKey: ['crm-deals'],
    queryFn: () => crmApi.getDeals({ limit: 5 }),
  });

  const {data: analyticsData} = useQuery({
    queryKey: ['crm-analytics'],
    queryFn: () => crmApi.getAnalyticsRevenue({
      startDate: dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD')
    }),
  });

  // Mutations
  const createLeadMutation = useMutation({
    mutationFn: crmApi.createLead,
    onSuccess: () => {
      message.success('Lead created successfully');
      setLeadModalVisible(false);
      form.resetFields();
      refetchLeads();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create lead');
    },
  });

  const _updateLeadStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      crmApi.updateLeadStatus(id, status, notes),
    onSuccess: () => {
      message.success('Lead status updated');
      refetchLeads();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update lead status');
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: crmApi.deleteLead,
    onSuccess: () => {
      message.success('Lead deleted successfully');
      setSelectedLead(null);
      refetchLeads();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete lead');
    },
  });

  const _convertLeadToOpportunityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      crmApi.convertLeadToOpportunity(id, data),
    onSuccess: () => {
      message.success('Lead converted to opportunity');
      setSelectedLead(null);
      refetchLeads();
      refetchOpportunities();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to convert lead');
    },
  });

  const _updateOpportunityStageMutation = useMutation({
    mutationFn: ({ id, stage, notes }: { id: string; stage: string; notes?: string }) =>
      crmApi.updateOpportunityStage(id, stage, notes),
    onSuccess: () => {
      message.success('Opportunity stage updated');
      refetchOpportunities();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update opportunity');
    },
  });

  const closeOpportunityMutation = useMutation({
    mutationFn: ({ id, type, data }: { id: string; type: 'won' | 'lost'; data?: any }) =>
      type === 'won'
        ? crmApi.closeWonOpportunity(id, data?.actualValue, data?.notes)
        : crmApi.closeLostOpportunity(id, data?.lostReason, data?.notes),
    onSuccess: () => {
      message.success(`Opportunity marked as ${type}`);
      setSelectedOpportunity(null);
      refetchOpportunities();
      refetchDashboard();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || `Failed to mark opportunity as ${type}`);
    },
  });

  const _updateContractStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      crmApi.updateContractStatus(id, status, notes),
    onSuccess: () => {
      message.success('Contract status updated');
      refetchContracts();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update contract');
    },
  });

  const signContractMutation = useMutation({
    mutationFn: ({ id, signedBy, notes }: { id: string; signedBy?: string; notes?: string }) =>
      crmApi.signContract(id, new Date().toISOString(), signedBy, notes),
    onSuccess: () => {
      message.success('Contract signed successfully');
      refetchContracts();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to sign contract');
    },
  });

  // Lead Table Columns
  const leadColumns: ColumnsType<Lead> = [
    {
      title: 'Name',
      dataIndex: 'firstName',
      key: 'name',
      render: (_, record) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'QUALIFIED' ? 'green' : status === 'CONVERTED' ? 'blue' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Lead Score',
      dataIndex: 'leadScore',
      key: 'leadScore',
      render: (score) => (
        <Badge
          count={score}
          style={{
            backgroundColor: score >= 80 ? '#52c41a' : score >= 50 ? '#faad14' : '#f5222d'
          }}
        />
      ),
    },
    {
      title: 'Revenue',
      dataIndex: 'estimatedRevenue',
      key: 'estimatedRevenue',
      render: (revenue) => revenue ? `R${revenue.toLocaleString()}` : '-',
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
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setSelectedLead(record)}
            />
          </Tooltip>
          <Tooltip title="Convert to Opportunity">
            <Button
              type="text"
              icon={<ArrowUpOutlined />}
              onClick={() => setSelectedLead(record)}
              disabled={record.status === 'CONVERTED'}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this lead?"
            onConfirm={() => deleteLeadMutation.mutate(record.id)}
          >
            <Tooltip title="Delete">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Opportunity Table Columns
  const opportunityColumns: ColumnsType<Opportunity> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage) => (
        <Tag color={
          stage === 'CLOSED_WON' ? 'green' :
          stage === 'CLOSED_LOST' ? 'red' :
          stage === 'NEGOTIATION' ? 'orange' : 'blue'
        }>
          {stage.replace('_', ' ')}
        </Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value) => `R${value.toLocaleString()}`,
    },
    {
      title: 'Probability',
      dataIndex: 'probability',
      key: 'probability',
      render: (probability) => `${probability}%`,
    },
    {
      title: 'Weighted Value',
      key: 'weightedValue',
      render: (_, record) => `R${Math.round(record.value * record.probability / 100).toLocaleString()}`,
    },
    {
      title: 'Expected Close',
      dataIndex: 'expectedCloseDate',
      key: 'expectedCloseDate',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : '-',
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
              onClick={() => setSelectedOpportunity(record)}
            />
          </Tooltip>
          {record.stage !== 'CLOSED_WON' && record.stage !== 'CLOSED_LOST' && (
            <>
              <Tooltip title="Mark as Won">
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  onClick={() => closeOpportunityMutation.mutate({ id: record.id, type: 'won' })}
                />
              </Tooltip>
              <Tooltip title="Mark as Lost">
                <Button
                  type="text"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => setSelectedOpportunity(record)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Contract Table Columns
  const contractColumns: ColumnsType<Contract> = [
    {
      title: 'Contract Number',
      dataIndex: 'contractNumber',
      key: 'contractNumber',
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value) => `R${value.toLocaleString()}`,
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (date) => dayjs(date).format('MMM DD, YYYY'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={
          status === 'ACTIVE' ? 'green' :
          status === 'EXPIRED' ? 'red' :
          status === 'TERMINATED' ? 'orange' : 'default'
        }>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Signed',
      dataIndex: 'signedAt',
      key: 'signedAt',
      render: (date) => date ? dayjs(date).format('MMM DD, YYYY') : 'Not Signed',
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
              onClick={() => setSelectedContract(record)}
            />
          </Tooltip>
          {!record.signedAt && (
            <Tooltip title="Sign Contract">
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => signContractMutation.mutate({ id: record.id })}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const handleCreateLead = (values: any) => {
    createLeadMutation.mutate(values);
  };

  const handleCreateOpportunity = (values: any) => {
    createLeadMutation.mutate(values);
  };

  const _handleCreateContract = (values: any) => {
    createLeadMutation.mutate(values);
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

    if (type === 'leads') {
      crmApi.exportLeads(exportData).then((response) => {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Leads exported successfully');
      });
    } else if (type === 'opportunities') {
      crmApi.exportOpportunities(exportData).then((response) => {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `opportunities_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Opportunities exported successfully');
      });
    } else if (type === 'contracts') {
      crmApi.exportContracts(exportData).then((response) => {
        const blob = new Blob([response], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `contracts_${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        message.success('Contracts exported successfully');
      });
    }
  };

  const renderDashboard = () => (
    <div>
      {/* New CRM Module Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Brokers"
              value={brokersData?.data?.data?.filter(b => b.status === 'ACTIVE').length || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Open Tickets"
              value={ticketsData?.data?.data?.filter(t =>
                ['OPEN', 'IN_PROGRESS'].includes(t.status)
              ).length || 0}
              prefix={<CustomerServiceOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pipeline Deals"
              value={dealsData?.data?.data?.filter(d =>
                !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage?.name || '')
              ).length || 0}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={analyticsData?.data?.totalRevenue || 0}
              prefix={<DollarOutlined />}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Legacy CRM Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Leads"
              value={dashboard?.data.leads.total || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Opportunities"
              value={dashboard?.data.opportunities.totalValue || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Pipeline Value"
              value={dashboard?.data.opportunities.pipelineValue || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#faad14' }}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Overall Conversion"
              value={dashboard?.data.conversion.overallConversion || 0}
              suffix="%"
              prefix={<ArrowUpOutlined />}
              valueStyle={{
                color: dashboard?.data.conversion.overallConversion > 20 ? '#52c41a' : '#f5222d'
              }}
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Lead Status Distribution" style={{ height: 400 }}>
            {dashboard?.data.leads.byStatus.map((item: any) => (
              <div key={item.status} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{item.status}</Text>
                  <Tag>{item.count}</Tag>
                </div>
                <Progress
                  percent={(item.count / dashboard.data.leads.total) * 100}
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Opportunity Pipeline" style={{ height: 400 }}>
            {dashboard?.data.opportunities.byStage.map((item: any) => (
              <div key={item.stage} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{item.stage.replace('_', ' ')}</Text>
                  <Text>R{Number(item.totalValue).toLocaleString()}</Text>
                </div>
                <Progress
                  percent={(Number(item.totalValue) / dashboard.data.opportunities.totalValue) * 100}
                  showInfo={false}
                  size="small"
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="Sales Forecast (Next 30 Days)">
            <Table
              columns={[
                { title: 'Opportunity', dataIndex: 'name', key: 'name' },
                { title: 'Broker', dataIndex: 'brokerName', key: 'brokerName' },
                { title: 'Expected Close', dataIndex: 'expectedCloseDate', key: 'expectedCloseDate', render: (date) => dayjs(date).format('MMM DD, YYYY') },
                { title: 'Value', dataIndex: 'value', key: 'value', render: (value) => `R${value.toLocaleString()}` },
                { title: 'Probability', dataIndex: 'probability', key: 'probability', render: (prob) => `${prob}%` },
                { title: 'Weighted Value', key: 'weightedValue', render: (_, record) => `R${Math.round(record.value * record.probability / 100).toLocaleString()}` },
                { title: 'Stage', dataIndex: 'stage', key: 'stage', render: (stage) => stage.replace('_', ' ') },
              ]}
              dataSource={forecast?.data.opportunities || []}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderLeads = () => (
    <div>
      <Card
        title="Leads Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setLeadModalVisible(true)}
            >
              Add Lead
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('leads')}
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchLeads()}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="Search leads..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="NEW">New</Option>
              <Option value="CONTACTED">Contacted</Option>
              <Option value="QUALIFIED">Qualified</Option>
              <Option value="CONVERTED">Converted</Option>
            </Select>
            <RangePicker onChange={setDateRange} />
          </Space>
        </div>
        <Table
          columns={leadColumns}
          dataSource={leadsData?.data.data || []}
          loading={leadsLoading}
          pagination={{
            total: leadsData?.data.total || 0,
            pageSize: 20,
            current: leadsData?.data.page || 1,
          }}
        />
      </Card>

      {/* Lead Modal */}
      <Modal
        title="Create Lead"
        visible={leadModalVisible}
        onCancel={() => setLeadModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateLead}>
          <Form.Item name="firstName" label="First Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="company" label="Company">
            <Input />
          </Form.Item>
          <Form.Item name="source" label="Source" rules={[{ required: true }]}>
            <Select>
              <Option value="WEBSITE">Website</Option>
              <Option value="REFERRAL">Referral</Option>
              <Option value="COLD_CALL">Cold Call</Option>
              <Option value="EVENT">Event</Option>
              <Option value="PARTNER">Partner</Option>
            </Select>
          </Form.Item>
          <Form.Item name="estimatedRevenue" label="Estimated Revenue">
            <Input type="number" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setLeadModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createLeadMutation.isLoading}>
                Create Lead
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Lead Details Drawer */}
      <Drawer
        title="Lead Details"
        placement="right"
        width={600}
        onClose={() => setSelectedLead(null)}
        open={!!selectedLead}
      >
        {selectedLead && (
          <div>
            <Descriptions title="Lead Information" bordered column={2}>
              <Descriptions.Item label="Name">
                {selectedLead.firstName} {selectedLead.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">{selectedLead.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{selectedLead.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Company">{selectedLead.company || '-'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedLead.status === 'QUALIFIED' ? 'green' : 'default'}>
                  {selectedLead.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Source">{selectedLead.source}</Descriptions.Item>
              <Descriptions.Item label="Lead Score">
                <Badge
                  count={selectedLead.leadScore}
                  style={{
                    backgroundColor: selectedLead.leadScore >= 80 ? '#52c41a' :
                                   selectedLead.leadScore >= 50 ? '#faad14' : '#f5222d'
                  }}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Revenue">
                {selectedLead.estimatedRevenue ? `R${selectedLead.estimatedRevenue.toLocaleString()}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedLead.createdAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>

            {selectedLead.notes && (
              <Card title="Notes" style={{ marginTop: 16 }}>
                <Text>{selectedLead.notes}</Text>
              </Card>
            )}

            <div style={{ marginTop: 24 }}>
              <Space>
                {selectedLead.status !== 'CONVERTED' && (
                  <Button
                    type="primary"
                    onClick={() => {
                      form.setFieldsValue({
                        name: `${selectedLead.firstName} ${selectedLead.lastName}`,
                        brokerId: selectedLead.brokerId,
                      });
                      setLeadModalVisible(true);
                      setSelectedLead(null);
                    }}
                  >
                    Convert to Opportunity
                  </Button>
                )}
                <Popconfirm
                  title="Are you sure you want to delete this lead?"
                  onConfirm={() => {
                    deleteLeadMutation.mutate(selectedLead.id);
                    setSelectedLead(null);
                  }}
                >
                  <Button danger>Delete Lead</Button>
                </Popconfirm>
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );

  const renderOpportunities = () => (
    <div>
      <Card
        title="Opportunities Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setOpportunityModalVisible(true)}
            >
              Add Opportunity
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('opportunities')}
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchOpportunities()}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="Search opportunities..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Stage"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, stage: value })}
            >
              <Option value="PROSPECTING">Prospecting</Option>
              <Option value="QUALIFICATION">Qualification</Option>
              <Option value="PROPOSAL">Proposal</Option>
              <Option value="NEGOTIATION">Negotiation</Option>
              <Option value="CLOSED_WON">Closed Won</Option>
              <Option value="CLOSED_LOST">Closed Lost</Option>
            </Select>
            <RangePicker onChange={setDateRange} />
          </Space>
        </div>
        <Table
          columns={opportunityColumns}
          dataSource={opportunitiesData?.data.data || []}
          loading={opportunitiesLoading}
          pagination={{
            total: opportunitiesData?.data.total || 0,
            pageSize: 20,
            current: opportunitiesData?.data.page || 1,
          }}
        />
      </Card>

      {/* Opportunity Modal */}
      <Modal
        title="Create Opportunity"
        visible={opportunityModalVisible}
        onCancel={() => setOpportunityModalVisible(false)}
        footer={null}
      >
        <Form form={opportunityForm} layout="vertical" onFinish={handleCreateOpportunity}>
          <Form.Item name="name" label="Opportunity Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="value" label="Value" rules={[{ required: true }]}>
            <Input type="number" />
          </Form.Item>
          <Form.Item name="probability" label="Probability (%)" rules={[{ required: true }]}>
            <Input type="number" min={0} max={100} />
          </Form.Item>
          <Form.Item name="expectedCloseDate" label="Expected Close Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setOpportunityModalVisible(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={createLeadMutation.isLoading}>
                Create Opportunity
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Opportunity Details Drawer */}
      <Drawer
        title="Opportunity Details"
        placement="right"
        width={600}
        onClose={() => setSelectedOpportunity(null)}
        open={!!selectedOpportunity}
      >
        {selectedOpportunity && (
          <div>
            <Descriptions title="Opportunity Information" bordered column={2}>
              <Descriptions.Item label="Name">{selectedOpportunity.name}</Descriptions.Item>
              <Descriptions.Item label="Stage">
                <Tag color={
                  selectedOpportunity.stage === 'CLOSED_WON' ? 'green' :
                  selectedOpportunity.stage === 'CLOSED_LOST' ? 'red' :
                  selectedOpportunity.stage === 'NEGOTIATION' ? 'orange' : 'blue'
                }>
                  {selectedOpportunity.stage.replace('_', ' ')}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Value">
                R{selectedOpportunity.value.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Probability">
                {selectedOpportunity.probability}%
              </Descriptions.Item>
              <Descriptions.Item label="Weighted Value">
                R{Math.round(selectedOpportunity.value * selectedOpportunity.probability / 100).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Expected Close">
                {selectedOpportunity.expectedCloseDate ?
                  dayjs(selectedOpportunity.expectedCloseDate).format('MMM DD, YYYY') :
                  '-'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedOpportunity.createdAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>

            {selectedOpportunity.notes && (
              <Card title="Notes" style={{ marginTop: 16 }}>
                <Text>{selectedOpportunity.notes}</Text>
              </Card>
            )}

            <div style={{ marginTop: 24 }}>
              <Space>
                {selectedOpportunity.stage !== 'CLOSED_WON' && selectedOpportunity.stage !== 'CLOSED_LOST' && (
                  <>
                    <Popconfirm
                      title="Mark this opportunity as won?"
                      onConfirm={() => {
                        closeOpportunityMutation.mutate({
                          id: selectedOpportunity.id,
                          type: 'won',
                          data: { actualValue: selectedOpportunity.value }
                        });
                        setSelectedOpportunity(null);
                      }}
                    >
                      <Button type="primary" icon={<CheckOutlined />}>
                        Mark as Won
                      </Button>
                    </Popconfirm>
                    <Popconfirm
                      title="Mark this opportunity as lost?"
                      onConfirm={() => setSelectedOpportunity(selectedOpportunity)}
                    >
                      <Button danger icon={<CloseOutlined />}>
                        Mark as Lost
                      </Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );

  const renderContracts = () => (
    <div>
      <Card
        title="Contracts Management"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setContractModalVisible(true)}
            >
              Add Contract
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => handleExport('contracts')}
            >
              Export
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetchContracts()}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Input
              placeholder="Search contracts..."
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
            />
            <Select
              placeholder="Status"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value })}
            >
              <Option value="ACTIVE">Active</Option>
              <Option value="EXPIRED">Expired</Option>
              <Option value="TERMINATED">Terminated</Option>
            </Select>
            <RangePicker onChange={setDateRange} />
          </Space>
        </div>
        <Table
          columns={contractColumns}
          dataSource={contractsData?.data.data || []}
          loading={contractsLoading}
          pagination={{
            total: contractsData?.data.total || 0,
            pageSize: 20,
            current: contractsData?.data.page || 1,
          }}
        />
      </Card>

      {/* Contract Details Drawer */}
      <Drawer
        title="Contract Details"
        placement="right"
        width={600}
        onClose={() => setSelectedContract(null)}
        open={!!selectedContract}
      >
        {selectedContract && (
          <div>
            <Descriptions title="Contract Information" bordered column={2}>
              <Descriptions.Item label="Contract Number">
                {selectedContract.contractNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Title">{selectedContract.title}</Descriptions.Item>
              <Descriptions.Item label="Value">
                R{selectedContract.value.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={
                  selectedContract.status === 'ACTIVE' ? 'green' :
                  selectedContract.status === 'EXPIRED' ? 'red' :
                  selectedContract.status === 'TERMINATED' ? 'orange' : 'default'
                }>
                  {selectedContract.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Start Date">
                {dayjs(selectedContract.startDate).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="End Date">
                {dayjs(selectedContract.endDate).format('MMM DD, YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Signed">
                {selectedContract.signedAt ?
                  dayjs(selectedContract.signedAt).format('MMM DD, YYYY') :
                  'Not Signed'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedContract.createdAt).format('MMM DD, YYYY')}
              </Descriptions.Item>
            </Descriptions>

            {selectedContract.terms && (
              <Card title="Terms & Conditions" style={{ marginTop: 16 }}>
                <Text>{selectedContract.terms}</Text>
              </Card>
            )}

            {selectedContract.notes && (
              <Card title="Notes" style={{ marginTop: 16 }}>
                <Text>{selectedContract.notes}</Text>
              </Card>
            )}

            <div style={{ marginTop: 24 }}>
              <Space>
                {!selectedContract.signedAt && (
                  <Popconfirm
                    title="Sign this contract?"
                    onConfirm={() => signContractMutation.mutate({ id: selectedContract.id })}
                  >
                    <Button type="primary" icon={<CheckOutlined />}>
                      Sign Contract
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );

  return (
    <div className="crm-page">
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>CRM Management</Title>
        <Space>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item
                  key="brokers"
                  icon={<TeamOutlined />}
                  onClick={() => navigate('/admin/crm/brokers')}
                >
                  Full Broker Management
                </Menu.Item>
                <Menu.Item
                  key="billing"
                  icon={<DollarOutlined />}
                  onClick={() => navigate('/admin/crm/billing')}
                >
                  Billing & Invoices
                </Menu.Item>
                <Menu.Item
                  key="support"
                  icon={<CustomerServiceOutlined />}
                  onClick={() => navigate('/admin/crm/tickets')}
                >
                  Support Tickets
                </Menu.Item>
                <Menu.Item
                  key="pipeline"
                  icon={<ThunderboltOutlined />}
                  onClick={() => navigate('/admin/crm/deals')}
                >
                  Sales Pipeline
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  key="full-crm"
                  icon={<DashboardOutlined />}
                  onClick={() => navigate('/admin/crm')}
                >
                  Complete CRM Dashboard
                </Menu.Item>
              </Menu>
            }
          >
            <Button type="primary" icon={<SettingOutlined />}>
              Advanced CRM <MoreOutlined />
            </Button>
          </Dropdown>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Dashboard" key="dashboard">
          {renderDashboard()}
        </TabPane>
        <TabPane tab="Leads" key="leads">
          {renderLeads()}
        </TabPane>
        <TabPane tab="Opportunities" key="opportunities">
          {renderOpportunities()}
        </TabPane>
        <TabPane tab="Contracts" key="contracts">
          {renderContracts()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default CRM;