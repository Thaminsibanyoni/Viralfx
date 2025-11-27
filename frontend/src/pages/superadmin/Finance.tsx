import React, { useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Typography, Input, Select, DatePicker, Row, Col, Statistic, Tabs, Form, InputNumber, Modal, message, Tooltip, Drawer, Descriptions, Timeline, Alert, Progress, Badge, Upload, Popconfirm, } from 'antd';
import {
  DollarOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, FileTextOutlined, WalletOutlined, CreditCardOutlined, BankOutlined, DownloadOutlined, ReloadOutlined, PieChartOutlined, LineChartOutlined, CheckOutlined, CloseOutlined, PrinterOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { adminApi } from '../../services/api/admin.api';
import { useAdminStore } from '../../stores/adminStore';
import { Transaction, Invoice, Payout } from '../../types/admin.types';
import TransactionDetailDrawer from '../../components/superadmin/TransactionDetailDrawer';
import InvoiceDetailModal from '../../components/superadmin/InvoiceDetailModal';
import CreateInvoiceModal from '../../components/superadmin/CreateInvoiceModal';
import PayoutApprovalModal from '../../components/superadmin/PayoutApprovalModal';
import RevenueAnalytics from '../../components/superadmin/RevenueAnalytics';

const {Title, Text} = Typography;
const {Option} = Select;
const {Search} = Input;
const {RangePicker} = DatePicker;
const {TabPane} = Tabs;

const Finance: React.FC = () => {
  const queryClient = useQueryClient();
  const {checkPermission} = useAdminStore();

  // State
  const [activeTab, setActiveTab] = useState('transactions');
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    status: undefined,
    type: undefined,
    currency: undefined,
    startDate: undefined,
    endDate: undefined,
  });

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionDrawerVisible, setTransactionDrawerVisible] = useState(false);
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [createInvoiceVisible, setCreateInvoiceVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payoutModalVisible, setPayoutModalVisible] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

  // Queries
  const {data: transactionsData, isLoading: transactionsLoading, refetch: refetchTransactions, } = useQuery({
    queryKey: ['admin-finance-transactions', filters],
    queryFn: () => adminApi.getTransactions(filters),
    enabled: activeTab === 'transactions',
    keepPreviousData: true,
  });

  const {data: invoicesData, isLoading: invoicesLoading, refetch: refetchInvoices, } = useQuery({
    queryKey: ['admin-finance-invoices', filters],
    queryFn: () => adminApi.getInvoices({
      page: filters.page,
      limit: filters.limit,
      status: filters.status,
    }),
    enabled: activeTab === 'invoices',
    keepPreviousData: true,
  });

  const {data: payoutsData, isLoading: payoutsLoading, refetch: refetchPayouts, } = useQuery({
    queryKey: ['admin-finance-payouts', filters],
    queryFn: () => adminApi.getPayouts({
      page: filters.page,
      limit: filters.limit,
      status: filters.status,
    }),
    enabled: activeTab === 'payouts',
    keepPreviousData: true,
  });

  const {data: financeOverview, } = useQuery({
    queryKey: ['admin-finance-overview', '30d'],
    queryFn: () => adminApi.getFinanceOverview('30d'),
  });

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (invoiceData: any) => adminApi.createInvoice(invoiceData),
    onSuccess: () => {
      message.success('Invoice created successfully');
      queryClient.invalidateQueries(['admin-finance-invoices']);
      setCreateInvoiceVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create invoice');
    },
  });

  const createPayoutMutation = useMutation({
    mutationFn: (payoutData: any) => adminApi.createPayout(payoutData),
    onSuccess: () => {
      message.success('Payout created successfully');
      queryClient.invalidateQueries(['admin-finance-payouts']);
      setPayoutModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create payout');
    },
  });

  // Event handlers
  const _handleSearch = (value: string) => {
    setFilters({ ...filters, search: value, page: 1 });
  };

  const _handleFilterChange = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value, page: 1 });
  };

  const handleTableChange = (pagination: any, filters?: any, sorter?: any) => {
    setFilters({
      ...filters,
      page: pagination.current,
      limit: pagination.pageSize,
    });
  };

  const _handleViewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTransactionDrawerVisible(true);
  };

  const handleCreateInvoice = () => {
    setCreateInvoiceVisible(true);
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceModalVisible(true);
  };

  const handleCreatePayout = () => {
    setPayoutModalVisible(true);
  };

  const handleApprovePayout = (payout: Payout) => {
    setSelectedPayout(payout);
    setPayoutModalVisible(true);
  };

  const handleExport = (type: 'transactions' | 'invoices' | 'payouts') => {
    // Export logic here
    message.info(`Exporting ${type} data...`);
  };

  // Transaction columns
  const transactionColumns: ColumnsType<Transaction> = [
    {
      title: 'Transaction ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id: string) => (
        <Text code copyable>{id.slice(0, 8)}...</Text>
      ),
    },

    {
      title: 'User/Broker',
      key: 'entity',
      width: 200,
      render: (_, record) => (
        <div>
          {record.userId && (
            <div className="text-sm">
              <Text strong>User: </Text>
              <Text className="ml-1">{record.userId}</Text>
            </div>
          )}
          {record.brokerId && (
            <div className="text-sm">
              <Text strong>Broker: </Text>
              <Text className="ml-1">{record.brokerId}</Text>
            </div>
          )}
        </div>
      ),
    },

    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const typeMap = {
          DEPOSIT: { color: 'green', icon: '↓' },
          WITHDRAWAL: { color: 'red', icon: '↑' },
          BET_STAKE: { color: 'blue', icon: '⚡' },
          BET_PAYOUT: { color: 'purple', icon: '🏆' },
        };

        const config = typeMap[type as keyof typeof typeMap] || { color: 'default', icon: '📄' };

        return (
          <Tag color={config.color}>
            {config.icon} {type.replace('_', ' ')}
          </Tag>
        );
      },
      filters: [
        { text: 'Deposit', value: 'DEPOSIT' },
        { text: 'Withdrawal', value: 'WITHDRAWAL' },
        { text: 'Bet Stake', value: 'BET_STAKE' },
        { text: 'Bet Payout', value: 'BET_PAYOUT' },
      ],
    },

    {
      title: 'Amount',
      key: 'amount',
      width: 150,
      render: (_, record) => (
        <div>
          {record.amountUsd && (
            <div className="font-medium">
              ${record.amountUsd?.toLocaleString()} USD
            </div>
          )}
          {record.amountZar && (
            <div className="text-sm text-gray-500">
              R {record.amountZar?.toLocaleString()}
            </div>
          )}
        </div>
      ),
      sorter: true,
    },

    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const colors = {
          PENDING: 'orange',
          PROCESSING: 'blue',
          COMPLETED: 'green',
          FAILED: 'red',
          CANCELLED: 'default',
        };

        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      },
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Processing', value: 'PROCESSING' },
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Failed', value: 'FAILED' },
        { text: 'Cancelled', value: 'CANCELLED' },
      ],
    },

    {
      title: 'Payment Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
      render: (method: string) => method || 'N/A',
    },

    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      width: 150,
      render: (reference: string) => reference || 'N/A',
    },

    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM DD, HH:mm'),
      sorter: true,
    },
  ];

  // Invoice columns
  const invoiceColumns: ColumnsType<Invoice> = [
    {
      title: 'Invoice #',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },

    {
      title: 'Broker',
      key: 'broker',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.broker?.name}</div>
          <div className="text-sm text-gray-500">{record.broker?.email}</div>
        </div>
      ),
    },

    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      width: 120,
    },

    {
      title: 'Commission',
      dataIndex: 'commission',
      key: 'commission',
      width: 100,
      render: (commission: number) => (
        <Text strong>${commission?.toLocaleString()}</Text>
      ),
    },

    {
      title: 'Fees',
      dataIndex: 'fees',
      key: 'fees',
      width: 100,
      render: (fees: number) => (
        <Text>${fees?.toLocaleString()}</Text>
      ),
    },

    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      render: (total: number) => (
        <Text strong className="text-green-600">
          ${total?.toLocaleString()}
        </Text>
      ),
      sorter: true,
    },

    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors = {
          PENDING: 'orange',
          PAID: 'green',
          OVERDUE: 'red',
          CANCELLED: 'default',
        };

        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      },
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Paid', value: 'PAID' },
        { text: 'Overdue', value: 'OVERDUE' },
        { text: 'Cancelled', value: 'CANCELLED' },
      ],
    },

    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM DD, YYYY'),
      sorter: true,
    },

    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewInvoice(record)}
            />
          </Tooltip>

          {record.status === 'PENDING' && checkPermission('finance:approve') && (
            <Tooltip title="Mark as Paid">
              <Popconfirm
                title="Mark this invoice as paid?"
                onConfirm={async () => {
                  // Implement mark as paid logic
                  message.success('Invoice marked as paid');
                  queryClient.invalidateQueries(['admin-finance-invoices']);
                }}
              >
                <Button type="text" icon={<CheckOutlined />} className="text-green-600" />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // Payout columns
  const payoutColumns: ColumnsType<Payout> = [
    {
      title: 'Payout ID',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id: string) => <Text code>{id.slice(0, 8)}...</Text>,
    },

    {
      title: 'Broker',
      key: 'broker',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.broker?.name}</div>
          <div className="text-sm text-gray-500">{record.broker?.email}</div>
        </div>
      ),
    },

    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount: number) => (
        <Text strong className="text-blue-600">
          ${amount?.toLocaleString()} {record.currency}
        </Text>
      ),
      sorter: true,
    },

    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors = {
          PENDING: 'orange',
          PROCESSING: 'blue',
          COMPLETED: 'green',
          FAILED: 'red',
          CANCELLED: 'default',
        };

        return <Tag color={colors[status as keyof typeof colors]}>{status}</Tag>;
      },
      filters: [
        { text: 'Pending', value: 'PENDING' },
        { text: 'Processing', value: 'PROCESSING' },
        { text: 'Completed', value: 'COMPLETED' },
        { text: 'Failed', value: 'FAILED' },
        { text: 'Cancelled', value: 'CANCELLED' },
      ],
    },

    {
      title: 'Bank Details',
      key: 'bank',
      width: 150,
      render: (_, record) => (
        <div className="text-xs">
          {record.bankDetails && Object.entries(record.bankDetails).map(([key, value]) => (
            <div key={key}>
              <Text strong>{key}:</Text> {value}
            </div>
          ))}
        </div>
      ),
    },

    {
      title: 'Reference',
      dataIndex: 'reference',
      key: 'reference',
      width: 120,
      render: (reference: string) => reference || 'N/A',
    },

    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => dayjs(date).format('MMM DD, HH:mm'),
    },

    {
      title: 'Processed',
      dataIndex: 'processedAt',
      key: 'processedAt',
      width: 120,
      render: (date: string) => date ? dayjs(date).format('MMM DD, HH:mm') : 'N/A',
    },

    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'PENDING' && checkPermission('finance:approve') && (
            <Tooltip title="Approve Payout">
              <Button
                type="text"
                icon={<CheckOutlined />}
                onClick={() => handleApprovePayout(record)}
                className="text-green-600"
              />
            </Tooltip>
          )}

          {record.status === 'PENDING' && checkPermission('finance:reject') && (
            <Tooltip title="Reject Payout">
              <Popconfirm
                title="Reject this payout?"
                onConfirm={async () => {
                  // Implement reject logic
                  message.success('Payout rejected');
                  queryClient.invalidateQueries(['admin-finance-payouts']);
                }}
              >
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  className="text-red-600"
                />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const _formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Title level={2}>Finance Operations</Title>
          <Text type="secondary">
            Manage transactions, invoicing, and broker commissions
          </Text>
        </div>

        <Space>
          <Button
            type="default"
            icon={<PieChartOutlined />}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </Button>
          <Button
            type="default"
            icon={<ExportOutlined />}
            onClick={() => handleExport(activeTab)}
          >
            Export
          </Button>
          <Button
            type="default"
            icon={<ReloadOutlined />}
            onClick={() => {
              if (activeTab === 'transactions') refetchTransactions();
              if (activeTab === 'invoices') refetchInvoices();
              if (activeTab === 'payouts') refetchPayouts();
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* Finance Overview */}
      {financeOverview && activeTab === 'overview' && (
        <RevenueAnalytics data={financeOverview} />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Transactions" key="transactions">
          {/* Transaction Stats */}
          {transactionsData && (
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Total Transactions"
                    value={transactionsData.stats?.total || 0}
                    prefix={<WalletOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#4B0082' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={transactionsData.stats?.completed || 0}
                    prefix={<CheckOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Failed"
                    value={transactionsData.stats?.failed || 0}
                    prefix={<CloseOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Total Volume"
                    value={transactionsData.stats?.totalVolume || 0}
                    prefix={<DollarOutlined />}
                    formatter={(value) => `$${formatNumber(value as number)}`}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Transaction Table */}
          <Card>
            <Table
              columns={transactionColumns}
              dataSource={transactionsData?.transactions}
              rowKey="id"
              loading={transactionsLoading}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: transactionsData?.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} transactions`,
                onChange: handleTableChange,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Invoices" key="invoices">
          {/* Invoice Stats */}
          {invoicesData && (
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Total Invoices"
                    value={invoicesData.stats?.total || 0}
                    prefix={<FileTextOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#4B0082' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Pending"
                    value={invoicesData.stats?.pending || 0}
                    prefix={<ClockCircleOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Paid"
                    value={invoicesData.stats?.paid || 0}
                    prefix={<CheckOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Overdue"
                    value={invoicesData.stats?.overdue || 0}
                    prefix={<WarningOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div className="mb-4 flex justify-between items-center">
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateInvoice}
                disabled={!checkPermission('finance:create')}
              >
                Create Invoice
              </Button>
            </Space>
          </div>

          {/* Invoice Table */}
          <Card>
            <Table
              columns={invoiceColumns}
              dataSource={invoicesData?.invoices}
              rowKey="id"
              loading={invoicesLoading}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: invoicesData?.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} invoices`,
                onChange: handleTableChange,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Payouts" key="payouts">
          {/* Payout Stats */}
          {payoutsData && (
            <Row gutter={[16, 16]} className="mb-6">
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Pending Payouts"
                    value={payoutsData.stats?.pending || 0}
                    prefix={<ClockCircleOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Processing"
                    value={payoutsData.stats?.processing || 0}
                    prefix={<SyncOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Completed"
                    value={payoutsData.stats?.completed || 0}
                    prefix={<CheckOutlined />}
                    formatter={formatNumber}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Card>
              </Col>

              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Total Amount"
                    value={payoutsData.stats?.totalAmount || 0}
                    prefix={<DollarOutlined />}
                    formatter={(value) => `$${formatNumber(value as number)}`}
                    valueStyle={{ color: '#4B0082' }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div className="mb-4 flex justify-between items-center">
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreatePayout}
                disabled={!checkPermission('finance:create')}
              >
                Create Payout
              </Button>
            </Space>
          </div>

          {/* Payout Table */}
          <Card>
            <Table
              columns={payoutColumns}
              dataSource={payoutsData?.payouts}
              rowKey="id"
              loading={payoutsLoading}
              pagination={{
                current: filters.page,
                pageSize: filters.limit,
                total: payoutsData?.total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} payouts`,
                onChange: handleTableChange,
              }}
              scroll={{ x: 1200 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Analytics" key="analytics">
          <RevenueAnalytics data={financeOverview} />
        </TabPane>
      </Tabs>

      {/* Modals and Drawers */}
      <TransactionDetailDrawer
        visible={transactionDrawerVisible}
        transaction={selectedTransaction}
        onClose={() => {
          setTransactionDrawerVisible(false);
          setSelectedTransaction(null);
        }}
      />

      <InvoiceDetailModal
        visible={invoiceModalVisible}
        invoice={selectedInvoice}
        onDownload={() => {
          // Implement download logic
          message.success('Invoice downloaded');
        }}
        onClose={() => {
          setInvoiceModalVisible(false);
          setSelectedInvoice(null);
        }}
      />

      <CreateInvoiceModal
        visible={createInvoiceVisible}
        onConfirm={async (invoiceData: any) => {
          await createInvoiceMutation.mutateAsync(invoiceData);
        }}
        onCancel={() => {
          setCreateInvoiceVisible(false);
        }}
        loading={createInvoiceMutation.isLoading}
      />

      <PayoutApprovalModal
        visible={payoutModalVisible}
        payout={selectedPayout}
        onApprove={async () => {
          await createPayoutMutation.mutateAsync({
            brokerId: selectedPayout!.brokerId,
            amount: selectedPayout!.amount,
            currency: selectedPayout!.currency,
            bankDetails: selectedPayout!.bankDetails,
          });
        }}
        onReject={async (reason: string) => {
          // Implement reject logic
          message.success('Payout rejected');
          queryClient.invalidateQueries(['admin-finance-payouts']);
        }}
        onCancel={() => {
          setPayoutModalVisible(false);
          setSelectedPayout(null);
        }}
        loading={createPayoutMutation.isLoading}
      />
    </div>
  );
};

export default Finance;