import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, Row, Col, Statistic, Form, Modal, message, Tooltip, Drawer, Descriptions, DatePicker, Popconfirm, } from 'antd';
import {
  DollarOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, PlusOutlined, EditOutlined, SendOutlined, CreditCardOutlined, FilePdfOutlined, ReloadOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, StopOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, BrokerInvoice, InvoiceFilters } from '../../../services/api/crm.api';
import InvoiceForm from '../../../components/crm/InvoiceForm';
import InvoiceViewer from '../../../components/crm/InvoicePdfViewer';
import PaymentModal from '../../../components/crm/PaymentModal';

const {Title} = Typography;
const {Option} = Select;
const {RangePicker} = DatePicker;

interface BillingPageProps {}

const BillingPage: React.FC<BillingPageProps> = () => {
  const [filters, setFilters] = useState<InvoiceFilters>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<BrokerInvoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<BrokerInvoice | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pdfVisible, setPdfVisible] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);

  const queryClient = useQueryClient();

  // Fetch invoices
  const {data: invoicesData, isLoading, refetch} = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => crmApi.getInvoices(filters),
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: (invoiceData: Partial<BrokerInvoice>) => crmApi.generateInvoice(invoiceData),
    onSuccess: () => {
      message.success('Invoice generated successfully');
      setIsModalVisible(false);
      setEditingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: () => {
      message.error('Failed to generate invoice');
    },
  });

  // Send invoice mutation
  const sendInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => crmApi.sendInvoice(invoiceId),
    onSuccess: () => {
      message.success('Invoice sent successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: () => {
      message.error('Failed to send invoice');
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof InvoiceFilters, value: any) => {
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

  // Handle edit invoice
  const _handleEditInvoice = (invoice: BrokerInvoice) => {
    setEditingInvoice(invoice);
    setIsModalVisible(true);
  };

  // Handle create invoice
  const handleCreateInvoice = () => {
    setEditingInvoice(null);
    setIsModalVisible(true);
  };

  // Handle form submit
  const handleFormSubmit = (values: Partial<BrokerInvoice>) => {
    createInvoiceMutation.mutate(values);
  };

  // Handle view invoice
  const handleViewInvoice = (invoice: BrokerInvoice) => {
    setSelectedInvoice(invoice);
    setDrawerVisible(true);
  };

  // Handle send invoice
  const handleSendInvoice = (invoice: BrokerInvoice) => {
    sendInvoiceMutation.mutate(invoice.id);
  };

  // Handle view PDF
  const handleViewPDF = async (invoice: BrokerInvoice) => {
    try {
      const response = await crmApi.generateInvoicePDF(invoice.id);
      window.open(response.data.url, '_blank');
    } catch (error) {
      message.error('Failed to generate PDF');
    }
  };

  // Handle initiate payment
  const handleInitiatePayment = (invoice: BrokerInvoice) => {
    setSelectedInvoice(invoice);
    setPaymentVisible(true);
  };

  // Table columns
  const columns: ColumnsType<BrokerInvoice> = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (invoiceNumber, record) => (
        <Button
          type="link"
          onClick={() => handleViewInvoice(record)}
        >
          {invoiceNumber}
        </Button>
      ),
    },
    {
      title: 'Broker',
      dataIndex: 'broker',
      key: 'broker',
      render: (broker) => (
        <div>
          <div className="font-medium">{broker?.broker?.companyName}</div>
          <div className="text-sm text-gray-500">{broker?.broker?.email}</div>
        </div>
      ),
    },
    {
      title: 'Issue Date',
      dataIndex: 'issueDate',
      key: 'issueDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
      sorter: true,
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => {
        const isOverdue = dayjs(date).isBefore(dayjs(), 'day');
        return (
          <span className={isOverdue ? 'text-red-500' : ''}>
            {dayjs(date).format('YYYY-MM-DD')}
            {isOverdue && <ExclamationCircleOutlined className="ml-1" />}
          </span>
        );
      },
      sorter: true,
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount, record) => (
        <div>
          <div className="font-medium">${Number(amount).toLocaleString()}</div>
          <div className="text-sm text-gray-500">
            Paid: ${Number(record.amountPaid).toLocaleString()}
          </div>
        </div>
      ),
      sorter: true,
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
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (paymentStatus) => (
        <Tag color={getPaymentStatusColor(paymentStatus)}>
          {paymentStatus}
        </Tag>
      ),
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
              onClick={() => handleViewInvoice(record)}
            />
          </Tooltip>
          <Tooltip title="View PDF">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={() => handleViewPDF(record)}
            />
          </Tooltip>
          {record.status === 'DRAFT' && (
            <Tooltip title="Send Invoice">
              <Button
                type="text"
                icon={<SendOutlined />}
                onClick={() => handleSendInvoice(record)}
              />
            </Tooltip>
          )}
          {record.paymentStatus !== 'PAID' && (
            <Tooltip title="Initiate Payment">
              <Button
                type="text"
                icon={<CreditCardOutlined />}
                onClick={() => handleInitiatePayment(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'default',
      SENT: 'blue',
      PAID: 'green',
      OVERDUE: 'red',
      CANCELLED: 'orange',
    };
    return colors[status] || 'default';
  };

  const _getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      DRAFT: <EditOutlined />,
      SENT: <SendOutlined />,
      PAID: <CheckCircleOutlined />,
      OVERDUE: <ExclamationCircleOutlined />,
      CANCELLED: <StopOutlined />,
    };
    return icons[status];
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      UNPAID: 'red',
      PARTIALLY_PAID: 'orange',
      PAID: 'green',
      OVERDUE: 'red',
    };
    return colors[status] || 'default';
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <Title level={2}>Billing Management</Title>
          <Space>
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateInvoice}>
              Generate Invoice
            </Button>
          </Space>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} className="mb-6">
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Invoices"
                value={invoicesData?.data?.total || 0}
                prefix={<FilePdfOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Outstanding Amount"
                value={invoicesData?.data?.data?.reduce((sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.amountPaid)), 0) || 0}
                prefix={<DollarOutlined />}
                precision={2}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Overdue Invoices"
                value={invoicesData?.data?.data?.filter(inv =>
                  inv.paymentStatus === 'OVERDUE' ||
                  (inv.dueDate && dayjs(inv.dueDate).isBefore(dayjs(), 'day') && inv.paymentStatus !== 'PAID')
                ).length || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Paid This Month"
                value={invoicesData?.data?.data?.filter(inv =>
                  inv.paidAt && dayjs(inv.paidAt).isSame(dayjs(), 'month')
                ).reduce((sum, inv) => sum + Number(inv.amountPaid), 0) || 0}
                prefix={<CheckCircleOutlined />}
                precision={2}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="Search by invoice number or broker"
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
                <Option value="DRAFT">Draft</Option>
                <Option value="SENT">Sent</Option>
                <Option value="PAID">Paid</Option>
                <Option value="OVERDUE">Overdue</Option>
                <Option value="CANCELLED">Cancelled</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Payment Status"
                value={filters.paymentStatus}
                onChange={(value) => handleFilterChange('paymentStatus', value)}
                allowClear
                style={{ width: '100%' }}
              >
                <Option value="UNPAID">Unpaid</Option>
                <Option value="PARTIALLY_PAID">Partially Paid</Option>
                <Option value="PAID">Paid</Option>
                <Option value="OVERDUE">Overdue</Option>
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

      {/* Invoices Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={invoicesData?.data?.data}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: filters.page || 1,
            pageSize: filters.limit || 10,
            total: invoicesData?.data?.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} invoices`,
            onChange: (page, pageSize) => {
              setFilters(prev => ({ ...prev, page, limit: pageSize }));
            },
          }}
        />
      </Card>

      {/* Generate Invoice Modal */}
      <Modal
        title="Generate New Invoice"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingInvoice(null);
        }}
        footer={null}
        width={800}
      >
        <InvoiceForm
          initialValues={editingInvoice}
          onSubmit={handleFormSubmit}
          loading={createInvoiceMutation.isPending}
        />
      </Modal>

      {/* Invoice Details Drawer */}
      <Drawer
        title={`Invoice ${selectedInvoice?.invoiceNumber}`}
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        width={600}
      >
        {selectedInvoice && (
          <div className="space-y-6">
            <Descriptions title="Invoice Details" bordered column={2}>
              <Descriptions.Item label="Invoice Number">
                {selectedInvoice.invoiceNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedInvoice.status)}>
                  {selectedInvoice.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Issue Date">
                {dayjs(selectedInvoice.issueDate).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="Due Date">
                {dayjs(selectedInvoice.dueDate).format('YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">
                ${Number(selectedInvoice.totalAmount).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Amount Paid">
                ${Number(selectedInvoice.amountPaid).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Status" span={2}>
                <Tag color={getPaymentStatusColor(selectedInvoice.paymentStatus)}>
                  {selectedInvoice.paymentStatus}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Notes" span={2}>
                {selectedInvoice.notes || 'No notes'}
              </Descriptions.Item>
            </Descriptions>

            {/* Invoice Items */}
            <div>
              <Title level={4}>Invoice Items</Title>
              {selectedInvoice.items?.map((item) => (
                <div key={item.id} className="flex justify-between py-2 border-b">
                  <div>
                    <div className="font-medium">{item.description}</div>
                    <div className="text-sm text-gray-500">Qty: {item.quantity} × ${Number(item.unitPrice).toFixed(2)}</div>
                  </div>
                  <div className="font-medium">${Number(item.total).toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
              <Button icon={<FilePdfOutlined />} onClick={() => handleViewPDF(selectedInvoice)}>
                View PDF
              </Button>
              {selectedInvoice.status === 'DRAFT' && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => handleSendInvoice(selectedInvoice)}
                >
                  Send Invoice
                </Button>
              )}
              {selectedInvoice.paymentStatus !== 'PAID' && (
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  onClick={() => {
                    setDrawerVisible(false);
                    handleInitiatePayment(selectedInvoice);
                  }}
                >
                  Initiate Payment
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Payment Modal */}
      <Modal
        title="Initiate Payment"
        open={paymentVisible}
        onCancel={() => setPaymentVisible(false)}
        footer={null}
      >
        {selectedInvoice && (
          <PaymentModal
            invoice={selectedInvoice}
            onSuccess={() => {
              setPaymentVisible(false);
              queryClient.invalidateQueries({ queryKey: ['invoices'] });
              message.success('Payment initiated successfully');
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default BillingPage;