import React, { useState, useEffect } from 'react';
import {
  Drawer, Descriptions, Tag, Space, Button, Typography, Row, Col, Card, Timeline, Badge, Divider, Alert, Spin, message, Tooltip, Progress, Statistic
} from 'antd';
import {
  TransactionOutlined, UserOutlined, CalendarOutlined, DollarOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, SyncOutlined, BankOutlined, CreditCardOutlined, WalletOutlined, FileTextOutlined, EyeOutlined, DownloadOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import billingApi from '../../services/api/billing.api';

const {Title, Text} = Typography;

interface TransactionDetailDrawerProps {
  visible: boolean;
  transactionId: string | null;
  onClose: () => void;
}

interface Transaction {
  id: string;
  transactionId: string;
  type: 'PAYMENT' | 'REFUND' | 'CHARGEBACK' | 'FEE';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  currency: string;
  description: string;
  brokerId: string;
  invoiceId?: string;
  paymentMethod: 'CREDIT_CARD' | 'BANK_TRANSFER' | 'EWALLET' | 'CRYPTO';
  gateway: 'PAYSTACK' | 'STRIPE' | 'PAYPAL' | 'FLUTTERWAVE';
  gatewayTransactionId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  refunds?: any[];
  fees?: {
    processing: number;
    gateway: number;
    tax: number;
    total: number;
  };
}

const TransactionDetailDrawer: React.FC<TransactionDetailDrawerProps> = ({
  visible,
  transactionId,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    if (visible && transactionId) {
      loadTransaction();
    }
  }, [visible, transactionId]);

  const _loadTransaction = async () => {
    if (!transactionId) return;

    setLoading(true);
    try {
      const response = await billingApi.getTransaction(transactionId);
      setTransaction(response.data);
    } catch (error) {
      message.error('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'PENDING':
        return 'processing';
      case 'PROCESSING':
        return 'warning';
      case 'FAILED':
        return 'error';
      case 'CANCELLED':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleOutlined />;
      case 'PENDING':
        return <ClockCircleOutlined />;
      case 'PROCESSING':
        return <SyncOutlined spin />;
      case 'FAILED':
        return <ExclamationCircleOutlined />;
      case 'CANCELLED':
        return <ExclamationCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PAYMENT':
        return 'green';
      case 'REFUND':
        return 'orange';
      case 'CHARGEBACK':
        return 'red';
      case 'FEE':
        return 'blue';
      default:
        return 'default';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'CREDIT_CARD':
        return <CreditCardOutlined />;
      case 'BANK_TRANSFER':
        return <BankOutlined />;
      case 'EWALLET':
        return <WalletOutlined />;
      default:
        return <DollarOutlined />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const getTransactionTimeline = () => {
    if (!transaction) return [];

    const timeline = [
      {
        key: 'created',
        title: 'Transaction Created',
        time: transaction.createdAt,
        icon: <TransactionOutlined />,
        color: 'blue'
      }
    ];

    if (transaction.completedAt) {
      timeline.push({
        key: 'completed',
        title: 'Transaction Completed',
        time: transaction.completedAt,
        icon: <CheckCircleOutlined />,
        color: 'green'
      });
    }

    if (transaction.failedAt) {
      timeline.push({
        key: 'failed',
        title: 'Transaction Failed',
        time: transaction.failedAt,
        icon: <ExclamationCircleOutlined />,
        color: 'red'
      });
    }

    if (transaction.updatedAt && transaction.updatedAt !== transaction.createdAt) {
      timeline.push({
        key: 'updated',
        title: 'Transaction Updated',
        time: transaction.updatedAt,
        icon: <SyncOutlined />,
        color: 'gray'
      });
    }

    return timeline;
  };

  if (!transaction) {
    return (
      <Drawer
        title="Transaction Details"
        placement="right"
        onClose={onClose}
        open={visible}
        width={800}
      >
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={
        <Space>
          <TransactionOutlined />
          <span>Transaction Details</span>
          <Tag color={getStatusColor(transaction.status)}>
            {getStatusIcon(transaction.status)} {transaction.status}
          </Tag>
        </Space>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={800}
      extra={
        <Space>
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {/* Handle view receipt */}}
          >
            View Receipt
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {/* Handle download */}}
          >
            Download
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Transaction Overview */}
          <Card>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="Amount"
                  value={transaction.amount}
                  formatter={(value) => formatCurrency(Number(value), transaction.currency)}
                  prefix={getPaymentMethodIcon(transaction.paymentMethod)}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Type"
                  value={transaction.type}
                  prefix={<Tag color={getTypeColor(transaction.type)}>{transaction.type}</Tag>}
                />
              </Col>
            </Row>
          </Card>

          {/* Transaction Information */}
          <Card title="Transaction Information">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Transaction ID" span={2}>
                <Text code>{transaction.transactionId}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={getTypeColor(transaction.type)}>
                  {transaction.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge
                  status={getStatusColor(transaction.status) as any}
                  text={transaction.status}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Amount" span={2}>
                <Text strong style={{ fontSize: '16px' }}>
                  {formatCurrency(transaction.amount, transaction.currency)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Payment Method">
                <Space>
                  {getPaymentMethodIcon(transaction.paymentMethod)}
                  {transaction.paymentMethod.replace('_', ' ')}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Gateway">
                <Space>
                  <Tag>{transaction.gateway}</Tag>
                  {transaction.gatewayTransactionId && (
                    <Tooltip title={transaction.gatewayTransactionId}>
                      <FileTextOutlined />
                    </Tooltip>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {transaction.description}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {format(new Date(transaction.createdAt), 'MMM dd, yyyy HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {format(new Date(transaction.updatedAt), 'MMM dd, yyyy HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {transaction.failureReason && (
              <Alert
                message="Transaction Failed"
                description={transaction.failureReason}
                type="error"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>

          {/* Fee Breakdown */}
          {transaction.fees && (
            <Card title="Fee Breakdown">
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Processing Fee"
                    value={transaction.fees.processing}
                    formatter={(value) => formatCurrency(Number(value), transaction.currency)}
                    precision={2}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Gateway Fee"
                    value={transaction.fees.gateway}
                    formatter={(value) => formatCurrency(Number(value), transaction.currency)}
                    precision={2}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Tax"
                    value={transaction.fees.tax}
                    formatter={(value) => formatCurrency(Number(value), transaction.currency)}
                    precision={2}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Total Fees"
                    value={transaction.fees.total}
                    formatter={(value) => formatCurrency(Number(value), transaction.currency)}
                    precision={2}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
              </Row>
              <Divider />
              <Row>
                <Col span={12}>
                  <Text strong>Net Amount:</Text>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                  <Text strong style={{ fontSize: '16px' }}>
                    {formatCurrency(transaction.amount - transaction.fees.total, transaction.currency)}
                  </Text>
                </Col>
              </Row>
            </Card>
          )}

          {/* Transaction Timeline */}
          <Card title="Transaction Timeline">
            <Timeline
              items={getTransactionTimeline().map(item => ({
                dot: item.icon,
                color: item.color,
                children: (
                  <div>
                    <Text strong>{item.title}</Text>
                    <br />
                    <Text type="secondary">
                      {format(new Date(item.time), 'MMM dd, yyyy HH:mm:ss')}
                    </Text>
                  </div>
                )
              }))}
            />
          </Card>

          {/* Metadata */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <Card title="Additional Information">
              <Descriptions column={1} size="small">
                {Object.entries(transaction.metadata).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}

          {/* Refunds */}
          {transaction.refunds && transaction.refunds.length > 0 && (
            <Card title="Refunds">
              {transaction.refunds.map((refund, index) => (
                <Card key={index} size="small" style={{ marginBottom: 8 }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Text strong>Amount:</Text> {formatCurrency(refund.amount, transaction.currency)}
                    </Col>
                    <Col span={8}>
                      <Text strong>Status:</Text> <Tag>{refund.status}</Tag>
                    </Col>
                    <Col span={8}>
                      <Text strong>Date:</Text> {format(new Date(refund.createdAt), 'MMM dd, yyyy')}
                    </Col>
                  </Row>
                </Card>
              ))}
            </Card>
          )}
        </Space>
      </Spin>
    </Drawer>
  );
};

export default TransactionDetailDrawer;