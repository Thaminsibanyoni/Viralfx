import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Button, Space, Divider, Table, Tag, Badge, Descriptions, Alert, Modal, Form, Input, Select, Upload, message, Spin, Breadcrumb, Dropdown, Menu, } from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, SendOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FilePdfOutlined, FileExcelOutlined, FileTextOutlined, CreditCardOutlined, BankOutlined, WalletOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined, MoreOutlined, PrinterOutlined, MailOutlined, } from '@ant-design/icons';
import { crmApi } from '../../../services/api/crm.api';
import { BrokerInvoice } from '../../../services/api/crm.api';
import dayjs from 'dayjs';

const {Title, Text} = Typography;
const {Option} = Select;

const InvoiceView: React.FC = () => {
  const {invoiceId} = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [invoice, setInvoice] = useState<BrokerInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [sendModalVisible, setSendModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoice();
      fetchPaymentHistory();
    }
  }, [invoiceId]);

  const fetchInvoice = async () => {
    if (!invoiceId) return;

    setLoading(true);
    try {
      const response = await crmApi.getInvoice(invoiceId);
      if (response.data) {
        setInvoice(response.data);
        form.setFieldsValue(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch invoice:', error);
      message.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const _fetchPaymentHistory = async () => {
    if (!invoiceId) return;

    try {
      const response = await crmApi.getPaymentHistory(invoiceId);
      if (response.data) {
        setPaymentHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch payment history:', error);
    }
  };

  const handleDownload = async (format: 'pdf' | 'excel') => {
    if (!invoice) return;

    setDownloading(true);
    try {
      const response = await crmApi.downloadInvoice(invoice.id, format);
      if (response.data) {
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `invoice-${invoice.invoiceNumber}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        message.success(`Invoice downloaded as ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Failed to download invoice:', error);
      message.error('Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };

  const handleSendInvoice = async (values: any) => {
    if (!invoice) return;

    setSending(true);
    try {
      const response = await crmApi.sendInvoice(invoice.id, {
        email: values.email,
        message: values.message,
        includePdf: values.includePdf,
      });
      if (response.data) {
        message.success('Invoice sent successfully');
        setSendModalVisible(false);
        fetchInvoice(); // Refresh to update sent status
      }
    } catch (error) {
      console.error('Failed to send invoice:', error);
      message.error('Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const handleStatusUpdate = async (values: any) => {
    if (!invoice) return;

    try {
      const response = await crmApi.updateInvoiceStatus(invoice.id, {
        status: values.status,
        notes: values.notes,
      });
      if (response.data) {
        message.success('Invoice status updated successfully');
        setStatusModalVisible(false);
        fetchInvoice(); // Refresh to update status
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      message.error('Failed to update invoice status');
    }
  };

  const handlePayment = async (method: 'paystack' | 'payfast' | 'wallet') => {
    if (!invoice) return;

    try {
      const response = await crmApi.initiatePayment(invoice.id, { method });
      if (response.data?.paymentUrl) {
        window.open(response.data.paymentUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to initiate payment:', error);
      message.error('Failed to initiate payment');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'default',
      SENT: 'processing',
      PAID: 'success',
      OVERDUE: 'error',
      CANCELLED: 'warning',
      REFUNDED: 'purple',
    };
    return colors[status] || 'default';
  };

  const getPaymentMethodIcon = (method: string) => {
    const icons: Record<string, React.ReactNode> = {
      PAYSTACK: <CreditCardOutlined />,
      PAYFAST: <BankOutlined />,
      WALLET: <WalletOutlined />,
      BANK_TRANSFER: <BankOutlined />,
    };
    return icons[method] || <CreditCardOutlined />;
  };

  const paymentHistoryColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM DD, YYYY HH:mm'),
    },
    {
      title: 'Method',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => (
        <Space>
          {getPaymentMethodIcon(method)}
          <span>{method.replace('_', ' ')}</span>
        </Space>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `R${amount.toLocaleString()}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'COMPLETED' ? 'green' : status === 'PENDING' ? 'orange' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Reference',
      dataIndex: 'transactionReference',
      key: 'transactionReference',
    },
  ];

  const invoiceItemColumns = [
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: 'Unit Price',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right' as const,
      render: (price: number) => `R${price.toLocaleString()}`,
    },
    {
      title: 'VAT',
      dataIndex: 'vatRate',
      key: 'vatRate',
      align: 'right' as const,
      render: (rate: number) => `${rate}%`,
    },
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (total: number) => `R${total.toLocaleString()}`,
    },
  ];

  const menuItems = (
    <Menu>
      <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
        Edit Invoice
      </Menu.Item>
      <Menu.Item key="status" icon={<CheckCircleOutlined />} onClick={() => setStatusModalVisible(true)}>
        Update Status
      </Menu.Item>
      <Menu.Item key="send" icon={<MailOutlined />} onClick={() => setSendModalVisible(true)}>
        Send Invoice
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="download-pdf" icon={<FilePdfOutlined />} onClick={() => handleDownload('pdf')}>
        Download PDF
      </Menu.Item>
      <Menu.Item key="download-excel" icon={<FileExcelOutlined />} onClick={() => handleDownload('excel')}>
        Download Excel
      </Menu.Item>
      <Menu.Item key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
        Print Invoice
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="delete" icon={<DeleteOutlined />} danger>
        Delete Invoice
      </Menu.Item>
    </Menu>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spin size="large" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <Alert
        message="Invoice Not Found"
        description="The invoice you're looking for doesn't exist or you don't have permission to view it."
        type="error"
        showIcon
        action={
          <Button type="primary" onClick={() => navigate('/admin/crm/billing')}>
            Back to Billing
          </Button>
        }
      />
    );
  }

  const totalAmount = invoice.items?.reduce((sum, item) => sum + item.total, 0) || 0;
  const totalVAT = invoice.items?.reduce((sum, item) => sum + (item.total * item.vatRate / 100), 0) || 0;
  const grandTotal = totalAmount + totalVAT;
  const amountPaid = paymentHistory
    .filter(p => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = grandTotal - amountPaid;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/crm/billing')}
          >
            Back to Billing
          </Button>
          <Breadcrumb>
            <Breadcrumb.Item>CRM</Breadcrumb.Item>
            <Breadcrumb.Item>
              <a onClick={() => navigate('/admin/crm/billing')}>Billing</a>
            </Breadcrumb.Item>
            <Breadcrumb.Item>Invoice</Breadcrumb.Item>
          </Breadcrumb>
        </div>
        <Space>
          <Dropdown overlay={menuItems} trigger={['click']}>
            <Button icon={<MoreOutlined />}>
              More Actions
            </Button>
          </Dropdown>
        </Space>
      </div>

      {/* Invoice Header */}
      <Card>
        <Row gutter={[24, 16]}>
          <Col span={16}>
            <div>
              <Title level={2} className="mb-2">Invoice {invoice.invoiceNumber}</Title>
              <Space size="large">
                <div>
                  <Text type="secondary">Status:</Text>
                  <Tag color={getStatusColor(invoice.status)} className="ml-2">
                    {invoice.status}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary">Issue Date:</Text>
                  <Text className="ml-2">{dayjs(invoice.issuedAt).format('MMM DD, YYYY')}</Text>
                </div>
                <div>
                  <Text type="secondary">Due Date:</Text>
                  <Text className="ml-2">{dayjs(invoice.dueDate).format('MMM DD, YYYY')}</Text>
                </div>
              </Space>
            </div>
          </Col>
          <Col span={8}>
            <div className="text-right">
              <Title level={3}>R{grandTotal.toLocaleString()}</Title>
              {balanceDue > 0 && (
                <div>
                  <Text type="secondary">Amount Due:</Text>
                  <Title level={4} type="danger" className="inline ml-2">
                    R{balanceDue.toLocaleString()}
                  </Title>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Invoice Details */}
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Bill To">
            <Descriptions column={1}>
              <Descriptions.Item label="Company">
                {invoice.broker?.companyName || invoice.broker?.user?.firstName} {invoice.broker?.user?.lastName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {invoice.broker?.user?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {invoice.broker?.user?.phoneNumber}
              </Descriptions.Item>
              <Descriptions.Item label="Address">
                {invoice.broker?.businessAddress || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="VAT Number">
                {invoice.broker?.taxNumber || 'N/A'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Payment Information">
            <Space direction="vertical" className="w-full">
              {balanceDue > 0 && invoice.status !== 'PAID' && (
                <Alert
                  message="Payment Required"
                  description="This invoice has outstanding balance. Select a payment method below to proceed."
                  type="warning"
                  showIcon
                />
              )}

              <Space wrap>
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  onClick={() => handlePayment('paystack')}
                  disabled={balanceDue <= 0}
                >
                  Pay with Paystack
                </Button>
                <Button
                  icon={<BankOutlined />}
                  onClick={() => handlePayment('payfast')}
                  disabled={balanceDue <= 0}
                >
                  Pay with PayFast
                </Button>
                <Button
                  icon={<WalletOutlined />}
                  onClick={() => handlePayment('wallet')}
                  disabled={balanceDue <= 0}
                >
                  Pay from Wallet
                </Button>
              </Space>

              <Divider />

              <div>
                <Text strong>Bank Details (EFT):</Text>
                <div className="mt-2 space-y-1">
                  <Text>Bank: First National Bank</Text>
                  <Text>Account Name: ViralFX (Pty) Ltd</Text>
                  <Text>Account Number: 62345678901</Text>
                  <Text>Branch Code: 250655</Text>
                </div>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Invoice Items */}
      <Card title="Invoice Items">
        <Table
          columns={invoiceItemColumns}
          dataSource={invoice.items}
          pagination={false}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={4}>
                <Text strong>Subtotal:</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <Text strong>R{totalAmount.toLocaleString()}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />

        <div className="mt-4 text-right">
          <Space direction="vertical" size="small">
            <div className="flex justify-between">
              <span>VAT ({invoice.items?.[0]?.vatRate || 15}%):</span>
              <span>R{totalVAT.toLocaleString()}</span>
            </div>
            <Divider className="my-2" />
            <div className="flex justify-between">
              <Title level={4} className="mb-0">Total:</Title>
              <Title level={4} className="mb-0">R{grandTotal.toLocaleString()}</Title>
            </div>
            {amountPaid > 0 && (
              <>
                <div className="flex justify-between">
                  <Text type="secondary">Amount Paid:</Text>
                  <Text type="secondary">-R{amountPaid.toLocaleString()}</Text>
                </div>
                <div className="flex justify-between">
                  <Title level={4} type="danger" className="mb-0">Balance Due:</Title>
                  <Title level={4} type="danger" className="mb-0">R{balanceDue.toLocaleString()}</Title>
                </div>
              </>
            )}
          </Space>
        </div>
      </Card>

      {/* Payment History */}
      {paymentHistory.length > 0 && (
        <Card title="Payment History">
          <Table
            columns={paymentHistoryColumns}
            dataSource={paymentHistory}
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card title="Notes">
          <Text>{invoice.notes}</Text>
        </Card>
      )}

      {/* Send Invoice Modal */}
      <Modal
        title="Send Invoice"
        open={sendModalVisible}
        onCancel={() => setSendModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleSendInvoice} layout="vertical">
          <Form.Item
            label="Recipient Email"
            name="email"
            rules={[
              { required: true, message: 'Please enter email address' },
              { type: 'email' },
            ]}
            initialValue={invoice.broker?.user?.email}
          >
            <Input placeholder="Enter email address" />
          </Form.Item>
          <Form.Item
            label="Message"
            name="message"
            initialValue="Please find attached your invoice for payment."
          >
            <TextArea rows={4} placeholder="Enter message" />
          </Form.Item>
          <Form.Item name="includePdf" valuePropName="checked" initialValue={true}>
            <input type="checkbox" /> Include PDF attachment
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={sending} icon={<SendOutlined />}>
                Send Invoice
              </Button>
              <Button onClick={() => setSendModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title="Update Invoice Status"
        open={statusModalVisible}
        onCancel={() => setStatusModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleStatusUpdate} layout="vertical">
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select new status">
              <Option value="DRAFT">Draft</Option>
              <Option value="SENT">Sent</Option>
              <Option value="PAID">Paid</Option>
              <Option value="OVERDUE">Overdue</Option>
              <Option value="CANCELLED">Cancelled</Option>
              <Option value="REFUNDED">Refunded</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Notes"
            name="notes"
          >
            <TextArea rows={3} placeholder="Add notes about this status change" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Update Status
              </Button>
              <Button onClick={() => setStatusModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InvoiceView;