import React, { useState } from 'react';
import { Card, Typography, Table, Tag, Button, message, Spin, Space, Modal } from 'antd';
import { DollarOutlined, DownloadOutlined, PayCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiMarketplace from '../../services/api/api-marketplace.api';

const {Title, Paragraph} = Typography;

const Billing: React.FC = () => {
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const queryClient = useQueryClient();

  const {data: invoicesData, isLoading, error, } = useQuery({
    queryKey: ['api-invoices'],
    queryFn: () => apiMarketplace.billing.getInvoices(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const downloadInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiMarketplace.billing.downloadInvoicePdf(invoiceId),
    onSuccess: (data) => {
      window.open(data.pdfUrl, '_blank');
      message.success('Invoice PDF downloaded successfully');
    },
    onError: (error: any) => {
      message.error('Failed to download invoice: ' + error.message);
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: ({ invoiceId, paymentMethod }: { invoiceId: string; paymentMethod: string }) =>
      apiMarketplace.billing.payInvoice(invoiceId, paymentMethod),
    onSuccess: (data) => {
      window.open(data.paymentUrl, '_blank');
      setPaymentModalVisible(false);
      message.success('Payment initiated successfully');
    },
    onError: (error: any) => {
      message.error('Failed to initiate payment: ' + error.message);
    },
  });

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => `INV-${id.substring(0, 8).toUpperCase()}`,
    },
    {
      title: 'Billing Period',
      key: 'period',
      render: (record: any) => {
        const start = new Date(record.billingPeriodStart).toLocaleDateString();
        const end = new Date(record.billingPeriodEnd).toLocaleDateString();
        return `${start} - ${end}`;
      },
    },
    {
      title: 'Amount Due',
      dataIndex: 'amountDue',
      key: 'amountDue',
      render: (amount: number) => `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Amount Paid',
      dataIndex: 'amountPaid',
      key: 'amountPaid',
      render: (amount: number) => `R${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap = {
          PAID: 'green',
          PENDING: 'orange',
          OVERDUE: 'red',
          FAILED: 'red',
        };
        return <Tag color={colorMap[status as keyof typeof colorMap] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadInvoice(record.id)}
            loading={downloadInvoiceMutation.isLoading}
          >
            Download
          </Button>
          {record.status === 'PENDING' && (
            <Button
              type="primary"
              size="small"
              icon={<PayCircleOutlined />}
              onClick={() => handlePayInvoice(record)}
              loading={payInvoiceMutation.isLoading}
            >
              Pay
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const _handleDownloadInvoice = (invoiceId: string) => {
    downloadInvoiceMutation.mutate(invoiceId);
  };

  const _handlePayInvoice = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentModalVisible(true);
  };

  const handlePaymentMethodSelect = (paymentMethod: string) => {
    if (selectedInvoice) {
      payInvoiceMutation.mutate({
        invoiceId: selectedInvoice.id,
        paymentMethod,
      });
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <p>Loading billing information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Title level={3}>Failed to load billing information</Title>
        <Paragraph>Please try again later or contact support.</Paragraph>
        <Button type="primary" onClick={() => queryClient.invalidateQueries(['api-invoices'])}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <DollarOutlined /> Billing & Invoices
      </Title>
      <Paragraph>
        View and manage your API usage billing, invoices, and payment history. All pricing is in South African Rand (ZAR).
      </Paragraph>

      <Card>
        <Table
          columns={columns}
          dataSource={invoicesData?.invoices || []}
          rowKey="id"
          pagination={{
            pageSize: 10,
            total: invoicesData?.pagination?.total,
            current: invoicesData?.pagination?.page,
            onChange: (page) => {
              // Handle page change if needed
            },
          }}
          loading={isLoading}
        />
      </Card>

      <Modal
        title="Select Payment Method"
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            block
            onClick={() => handlePaymentMethodSelect('paystack')}
            loading={payInvoiceMutation.isLoading}
          >
            Pay with Paystack (Card & Bank Transfer)
          </Button>
          <Button
            type="primary"
            size="large"
            block
            onClick={() => handlePaymentMethodSelect('payfast')}
            loading={payInvoiceMutation.isLoading}
          >
            Pay with PayFast (South Africa)
          </Button>
          <Button
            type="primary"
            size="large"
            block
            onClick={() => handlePaymentMethodSelect('ozow')}
            loading={payInvoiceMutation.isLoading}
          >
            Pay with Ozow (Instant EFT)
          </Button>
        </Space>
        {selectedInvoice && (
          <div style={{ marginTop: 16, padding: 16, background: '#f5f5f5', borderRadius: 4 }}>
            <p><strong>Invoice:</strong> INV-{selectedInvoice.id.substring(0, 8).toUpperCase()}</p>
            <p><strong>Amount:</strong> R{Number(selectedInvoice.amountDue).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</p>
            <p><strong>Due Date:</strong> {new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Billing;