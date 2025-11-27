import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Button, DatePicker, Select, Tabs, Space, Tag, Progress, Alert, Spin, message, Drawer, Modal, Form, Input, InputNumber, Switch, Divider, Tooltip, Badge, List, Avatar, Typography, Empty
} from 'antd';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, TooltipProps
} from 'recharts';
import {
  DollarOutlined, RiseOutlined, UserOutlined, CalendarOutlined, DownloadOutlined, SettingOutlined, AlertOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, BarChartOutlined, PieChartOutlined, LineChartOutlined, FileTextOutlined, ReloadOutlined, EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined
} from '@ant-design/icons';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import financialReportingApi, { FinancialDashboard, MRRData, NRRData, RevenueAnalytics } from '../../services/api/financial-reporting.api';
import './FinancialReports.scss';

const {RangePicker} = DatePicker;
const {Option} = Select;
const {TabPane} = Tabs;
const {Title, Text} = Typography;

const FinancialReports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<FinancialDashboard | null>(null);
  const [revenueAnalytics, setRevenueAnalytics] = useState<RevenueAnalytics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [dateRange, setDateRange] = useState<[string, string]>([
    format(startOfMonth(subMonths(new Date(), 11)), 'yyyy-MM-dd'),
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  ]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [reportDetailVisible, setReportDetailVisible] = useState(false);
  const [financialSettings, setFinancialSettings] = useState<any>({});
  const [financialAlerts, setFinancialAlerts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [alertForm] = Form.useForm();
  const [exportForm] = Form.useForm();

  // Load financial data
  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const [dashboardRes, analyticsRes, alertsRes, reportsRes] = await Promise.all([
        financialReportingApi.getDashboard({
          startDate: dateRange[0],
          endDate: dateRange[1]
        }),
        financialReportingApi.getRevenueAnalytics({
          startDate: dateRange[0],
          endDate: dateRange[1]
        }),
        financialReportingApi.getFinancialAlerts(),
        financialReportingApi.getFinancialReports()
      ]);

      setDashboard(dashboardRes.data);
      setRevenueAnalytics(analyticsRes.data);
      setFinancialAlerts(alertsRes.data || []);
      setReports(reportsRes.data?.data || []);
    } catch (error) {
      message.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, [dateRange, selectedPeriod]);

  // Get trend color
  const getTrendColor = (value: number) => {
    if (value > 0) return '#52c41a';
    if (value < 0) return '#f5222d';
    return '#8c8c8c';
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Export data
  const handleExport = async (values: any) => {
    try {
      const result = await financialReportingApi.exportData({
        type: values.type,
        format: values.format,
        startDate: dateRange[0],
        endDate: dateRange[1],
        filters: values.filters || {}
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([result.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `financial-report-${format(new Date(), 'yyyy-MM-dd')}.${values.format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      message.success('Export completed successfully');
      setExportModalVisible(false);
      exportForm.resetFields();
    } catch (error) {
      message.error('Export failed');
    }
  };

  // Create financial alert
  const handleCreateAlert = async (values: any) => {
    try {
      await financialReportingApi.createFinancialAlert(values);
      message.success('Alert created successfully');
      setAlertModalVisible(false);
      alertForm.resetFields();
      loadFinancialData();
    } catch (error) {
      message.error('Failed to create alert');
    }
  };

  // Update financial settings
  const handleUpdateSettings = async (values: any) => {
    try {
      await financialReportingApi.updateFinancialSettings(values);
      message.success('Settings updated successfully');
      setSettingsModalVisible(false);
      setFinancialSettings(values);
    } catch (error) {
      message.error('Failed to update settings');
    }
  };

  // Render dashboard overview
  const renderDashboardOverview = () => {
    if (!dashboard) return null;

    const metrics = [
      {
        title: 'Total Revenue',
        value: formatCurrency(dashboard.overview.totalRevenue),
        change: dashboard.overview.growthRate,
        icon: <DollarOutlined style={{ color: '#1890ff' }} />,
        prefix: '$'
      },
      {
        title: 'Monthly Recurring Revenue',
        value: formatCurrency(dashboard.overview.mrr),
        change: 0,
        icon: <CalendarOutlined style={{ color: '#52c41a' }} />,
        prefix: '$'
      },
      {
        title: 'Annual Recurring Revenue',
        value: formatCurrency(dashboard.overview.arr),
        change: 0,
        icon: <RiseOutlined style={{ color: '#faad14' }} />,
        prefix: '$'
      },
      {
        title: 'Net Revenue Retention',
        value: `${dashboard.overview.nrr}%`,
        change: 0,
        icon: <UserOutlined style={{ color: '#722ed1' }} />,
        prefix: ''
      },
      {
        title: 'Customer Lifetime Value',
        value: formatCurrency(dashboard.overview.ltv),
        change: 0,
        icon: <RiseOutlined style={{ color: '#13c2c2' }} />,
        prefix: '$'
      },
      {
        title: 'Customer Acquisition Cost',
        value: formatCurrency(dashboard.overview.cac),
        change: 0,
        icon: <UserOutlined style={{ color: '#eb2f96' }} />,
        prefix: '$'
      },
      {
        title: 'LTV:CAC Ratio',
        value: dashboard.overview.ltvCacRatio.toFixed(2),
        change: 0,
        icon: <BarChartOutlined style={{ color: '#fa8c16' }} />,
        prefix: ''
      },
      {
        title: 'Churn Rate',
        value: `${dashboard.overview.churnRate}%`,
        change: 0,
        icon: <AlertOutlined style={{ color: '#f5222d' }} />,
        prefix: ''
      }
    ];

    return (
      <div className="financial-overview">
        <Row gutter={[16, 16]}>
          {metrics.map((metric, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card>
                <Statistic
                  title={
                    <Space>
                      {metric.icon}
                      <span>{metric.title}</span>
                    </Space>
                  }
                  value={metric.value}
                  precision={metric.prefix === '$' ? 0 : 2}
                  prefix={metric.prefix}
                  suffix={
                    metric.change !== 0 && (
                      <span style={{ color: getTrendColor(metric.change) }}>
                        {metric.change > 0 ? '+' : ''}{metric.change}%
                      </span>
                    )
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  // Render revenue charts
  const renderRevenueCharts = () => {
    if (!revenueAnalytics) return null;

    const monthlyData = revenueAnalytics.trends.monthlyRevenue.map(item => ({
      ...item,
      month: format(new Date(item.month), 'MMM yyyy')
    }));

    const growthData = revenueAnalytics.trends.growth.map(item => ({
      ...item,
      period: format(new Date(item.period), 'MMM yyyy')
    }));

    const tierData = Object.entries(revenueAnalytics.breakdown.byTier).map(([tier, value]) => ({
      name: tier,
      value
    }));

    const COLORS = ['#1890ff', '#52c41a', '#faad14', '#722ed1', '#13c2c2'];

    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Revenue Trend" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#1890ff" fill="#1890ff" />
                <Area type="monotone" dataKey="mrr" stackId="1" stroke="#52c41a" fill="#52c41a" />
                <Area type="monotone" dataKey="arr" stackId="1" stroke="#faad14" fill="#faad14" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Growth Rates" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Line type="monotone" dataKey="revenueGrowth" stroke="#1890ff" name="Revenue Growth %" />
                <Line type="monotone" dataKey="mrrGrowth" stroke="#52c41a" name="MRR Growth %" />
                <Line type="monotone" dataKey="arrGrowth" stroke="#faad14" name="ARR Growth %" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Revenue by Tier" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Revenue by Source" className="chart-card">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(revenueAnalytics.breakdown.bySource).map(([source, value]) => ({ name: source, value }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="value" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    );
  };

  // Render subscription metrics
  const renderSubscriptionMetrics = () => {
    if (!dashboard) return null;

    const {subscriptions} = dashboard;

    return (
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Subscriptions"
              value={subscriptions.active}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="New Subscriptions"
              value={subscriptions.new}
              prefix={<PlusOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Churned Subscriptions"
              value={subscriptions.churned}
              prefix={<DeleteOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Net Growth"
              value={subscriptions.netGrowth}
              prefix={subscriptions.netGrowth >= 0 ? <RiseOutlined style={{ color: '#52c41a' }} /> : <RiseOutlined style={{ color: '#f5222d' }} />}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // Render alerts section
  const renderAlerts = () => {
    const getAlertSeverity = (severity: string) => {
      switch (severity) {
        case 'HIGH': return 'error';
        case 'MEDIUM': return 'warning';
        case 'LOW': return 'info';
        default: return 'default';
      }
    };

    const getAlertIcon = (severity: string) => {
      switch (severity) {
        case 'HIGH': return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />;
        case 'MEDIUM': return <AlertOutlined style={{ color: '#faad14' }} />;
        case 'LOW': return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
        default: return <AlertOutlined />;
      }
    };

    return (
      <Card
        title="Financial Alerts"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAlertModalVisible(true)}
          >
            Create Alert
          </Button>
        }
      >
        {financialAlerts.length === 0 ? (
          <Empty description="No financial alerts configured" />
        ) : (
          <List
            dataSource={financialAlerts}
            renderItem={(alert: any) => (
              <List.Item
                actions={[
                  <Button
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => {/* Handle edit */}}
                  >
                    Edit
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {/* Handle delete */}}
                  >
                    Delete
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={getAlertIcon(alert.severity)}
                  title={
                    <Space>
                      <span>{alert.name}</span>
                      <Tag color={getAlertSeverity(alert.severity)}>
                        {alert.severity}
                      </Tag>
                    </Space>
                  }
                  description={alert.description}
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    );
  };

  // Render reports section
  const renderReports = () => {
    const reportColumns = [
      {
        title: 'Report Name',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <Tag color="blue">{type.toUpperCase()}</Tag>
        )
      },
      {
        title: 'Period',
        dataIndex: 'period',
        key: 'period',
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => {
          const statusConfig = {
            COMPLETED: { color: 'success', icon: <CheckCircleOutlined /> },
            PENDING: { color: 'processing', icon: <ClockCircleOutlined /> },
            FAILED: { color: 'error', icon: <ExclamationCircleOutlined /> },
          };
          const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
          return (
            <Badge status={config.color as any} text={status} icon={config.icon} />
          );
        }
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => format(new Date(date), 'MMM dd, yyyy')
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (record: any) => (
          <Space>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedReport(record);
                setReportDetailVisible(true);
              }}
            >
              View
            </Button>
            <Button
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => {/* Handle download */}}
            >
              Download
            </Button>
          </Space>
        )
      }
    ];

    return (
      <Card
        title="Financial Reports"
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadFinancialData}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<FileTextOutlined />}
              onClick={() => setExportModalVisible(true)}
            >
              Generate Report
            </Button>
          </Space>
        }
      >
        <Table
          columns={reportColumns}
          dataSource={reports}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Card>
    );
  };

  if (loading && !dashboard) {
    return (
      <div className="financial-reports-loading">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="financial-reports">
      <div className="financial-reports-header">
        <div className="header-content">
          <Title level={2}>Financial Reports</Title>
          <Text type="secondary">
            Comprehensive financial analytics and reporting dashboard
          </Text>
        </div>
        <div className="header-actions">
          <Space>
            <RangePicker
              value={[new Date(dateRange[0]), new Date(dateRange[1])]}
              onChange={(dates: any) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([
                    format(dates[0], 'yyyy-MM-dd'),
                    format(dates[1], 'yyyy-MM-dd')
                  ]);
                }
              }}
              format="YYYY-MM-DD"
            />
            <Select
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              style={{ width: 120 }}
            >
              <Option value="day">Daily</Option>
              <Option value="week">Weekly</Option>
              <Option value="month">Monthly</Option>
              <Option value="quarter">Quarterly</Option>
              <Option value="year">Yearly</Option>
            </Select>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsModalVisible(true)}
            >
              Settings
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadFinancialData}
              loading={loading}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Dashboard" key="dashboard">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {renderDashboardOverview()}
            {renderRevenueCharts()}
            {renderSubscriptionMetrics()}
          </Space>
        </TabPane>
        <TabPane tab="Analytics" key="analytics">
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {renderRevenueCharts()}
          </Space>
        </TabPane>
        <TabPane tab="Alerts" key="alerts">
          {renderAlerts()}
        </TabPane>
        <TabPane tab="Reports" key="reports">
          {renderReports()}
        </TabPane>
      </Tabs>

      {/* Settings Modal */}
      <Modal
        title="Financial Settings"
        visible={settingsModalVisible}
        onCancel={() => setSettingsModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateSettings}
          initialValues={financialSettings}
        >
          <Form.Item
            name="currency"
            label="Currency"
            rules={[{ required: true, message: 'Please select currency' }]}
          >
            <Select>
              <Option value="USD">USD - US Dollar</Option>
              <Option value="EUR">EUR - Euro</Option>
              <Option value="GBP">GBP - British Pound</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="reportingPeriod"
            label="Reporting Period"
            rules={[{ required: true, message: 'Please select reporting period' }]}
          >
            <Select>
              <Option value="monthly">Monthly</Option>
              <Option value="quarterly">Quarterly</Option>
              <Option value="annually">Annually</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="fiscalYearStart"
            label="Fiscal Year Start"
            rules={[{ required: true, message: 'Please select fiscal year start' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="timezone"
            label="Timezone"
            rules={[{ required: true, message: 'Please select timezone' }]}
          >
            <Select>
              <Option value="UTC">UTC</Option>
              <Option value="America/New_York">Eastern Time</Option>
              <Option value="America/Los_Angeles">Pacific Time</Option>
              <Option value="Europe/London">London</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Save Settings
              </Button>
              <Button onClick={() => setSettingsModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Alert Modal */}
      <Modal
        title="Create Financial Alert"
        visible={alertModalVisible}
        onCancel={() => setAlertModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={alertForm}
          layout="vertical"
          onFinish={handleCreateAlert}
        >
          <Form.Item
            name="name"
            label="Alert Name"
            rules={[{ required: true, message: 'Please enter alert name' }]}
          >
            <Input placeholder="Enter alert name" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
          >
            <Input.TextArea rows={3} placeholder="Enter alert description" />
          </Form.Item>
          <Form.Item
            name="type"
            label="Alert Type"
            rules={[{ required: true, message: 'Please select alert type' }]}
          >
            <Select>
              <Option value="revenue">Revenue</Option>
              <Option value="mrr">MRR</Option>
              <Option value="churn">Churn Rate</Option>
              <Option value="ltv_cac">LTV:CAC Ratio</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="threshold"
            label="Threshold"
            rules={[{ required: true, message: 'Please enter threshold' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter threshold value"
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="condition"
            label="Condition"
            rules={[{ required: true, message: 'Please select condition' }]}
          >
            <Select>
              <Option value="greater_than">Greater Than</Option>
              <Option value="less_than">Less Than</Option>
              <Option value="equals">Equals</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="recipients"
            label="Recipients"
            rules={[{ required: true, message: 'Please enter recipients' }]}
          >
            <Select mode="tags" placeholder="Enter email addresses">
              {/* Add email options */}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Alert
              </Button>
              <Button onClick={() => setAlertModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Export Modal */}
      <Modal
        title="Generate Financial Report"
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={exportForm}
          layout="vertical"
          onFinish={handleExport}
        >
          <Form.Item
            name="type"
            label="Report Type"
            rules={[{ required: true, message: 'Please select report type' }]}
          >
            <Select>
              <Option value="mrr">MRR Report</Option>
              <Option value="nrr">NRR Report</Option>
              <Option value="revenue">Revenue Report</Option>
              <Option value="customers">Customer Report</Option>
              <Option value="all">Complete Report</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="format"
            label="Export Format"
            rules={[{ required: true, message: 'Please select format' }]}
          >
            <Select>
              <Option value="csv">CSV</Option>
              <Option value="json">JSON</Option>
              <Option value="excel">Excel</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Generate Report
              </Button>
              <Button onClick={() => setExportModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Report Detail Drawer */}
      <Drawer
        title="Financial Report Details"
        placement="right"
        onClose={() => setReportDetailVisible(false)}
        open={reportDetailVisible}
        width={800}
      >
        {selectedReport && (
          <div className="report-detail">
            {/* Add report detail content */}
            <Text>Report details would be displayed here</Text>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default FinancialReports;