import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Button, Space, Typography, Row, Col, Card, Table, Alert, message, Descriptions, Tag, Statistic, Progress, Divider, Upload, UploadProps, List, Avatar, Tooltip, Badge
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, DollarOutlined, UserOutlined, BankOutlined, CalendarOutlined, FileTextOutlined, UploadOutlined, EyeOutlined, DownloadOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';
import billingApi from '../../services/api/billing.api';
import brokerApi from '../../services/api/broker.api';

const {Title, Text} = Typography;
const {Option} = Select;
const {TextArea} = Input;

interface PayoutApprovalModalProps {
  visible: boolean;
  payoutId: string | null;
  onApprove: (payoutId: string, data: any) => void;
  onReject: (payoutId: string, reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

interface Payout {
  id: string;
  brokerId: string;
  broker: {
    id: string;
    companyName: string;
    email: string;
    tier: string;
    bankAccount?: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
  };
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  period: {
    start: string;
    end: string;
  };
  description: string;
  transactions: Array<{
    id: string;
    amount: number;
    description: string;
    date: string;
  }>;
  fees: {
    processing: number;
    gateway: number;
    total: number;
  };
  netAmount: number;
  requestedAt: string;
  processedAt?: string;
  completedAt?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
  documents?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
  }>;
}

const PayoutApprovalModal: React.FC<PayoutApprovalModalProps> = ({
  visible,
  payoutId,
  onApprove,
  onReject,
  onCancel,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loadingPayout, setLoadingPayout] = useState(false);
  const [rejectForm] = Form.useForm();
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (visible && payoutId) {
      loadPayout();
    }
  }, [visible, payoutId]);

  const _loadPayout = async () => {
    if (!payoutId) return;

    setLoadingPayout(true);
    try {
      const response = await billingApi.getPayout(payoutId);
      setPayout(response.data);
    } catch (error) {
      message.error('Failed to load payout details');
    } finally {
      setLoadingPayout(false);
    }
  };

  const handleApprove = async () => {
    try {
      const values = await form.validateFields();
      onApprove(payoutId!, {
        ...values,
        approvedAmount: values.approvedAmount || payout?.amount,
        notes: values.notes,
        documents: selectedDocuments
      });
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleReject = async () => {
    try {
      const values = await rejectForm.validateFields();
      onReject(payoutId!, values.reason);
      setRejectModalVisible(false);
      rejectForm.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'PROCESSING':
        return 'processing';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'error';
      case 'REJECTED':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  };

  const transactionColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (date: string) => format(new Date(date), 'MMM dd, yyyy')
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => formatCurrency(amount, payout?.currency || 'USD')
    }
  ];

  const documentColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <Space>
          <FileTextOutlined />
          <span>{name}</span>
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color="blue">{type}</Tag>
      )
    },
    {
      title: 'Uploaded',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      render: (date: string) => format(new Date(date), 'MMM dd, yyyy')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: any) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => window.open(record.url, '_blank')}
          >
            View
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => {
              const link = document.createElement('a');
              link.href = record.url;
              link.download = record.name;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Download
          </Button>
        </Space>
      )
    }
  ];

  if (!payout) {
    return (
      <Modal
        title="Payout Approval"
        open={visible}
        onCancel={onCancel}
        width={1000}
        footer={null}
      >
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Text>Loading payout details...</Text>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal
        title={
          <Space>
            <DollarOutlined />
            <span>Payout Approval</span>
            <Badge status={getStatusColor(payout.status)} text={payout.status} />
          </Space>
        }
        open={visible}
        onCancel={onCancel}
        width={1000}
        footer={
          <Space>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              danger
              onClick={() => setRejectModalVisible(true)}
              disabled={payout.status !== 'PENDING'}
            >
              Reject
            </Button>
            <Button
              type="primary"
              onClick={handleApprove}
              loading={loading}
              disabled={payout.status !== 'PENDING'}
              icon={<CheckCircleOutlined />}
            >
              Approve Payout
            </Button>
          </Space>
        }
      >
        <Spin spinning={loadingPayout}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Payout Summary */}
            <Card>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="Gross Amount"
                    value={payout.amount}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    prefix={<DollarOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Total Fees"
                    value={payout.fees.total}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Net Amount"
                    value={payout.netAmount}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    prefix={<CheckCircleOutlined />}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Transactions"
                    value={payout.transactions.length}
                    prefix={<FileTextOutlined />}
                  />
                </Col>
              </Row>
            </Card>

            {/* Broker Information */}
            <Card title="Broker Information">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Company Name">
                  <Space>
                    <UserOutlined />
                    <Text strong>{payout.broker.companyName}</Text>
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Tier">
                  <Tag color="blue">{payout.broker.tier}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {payout.broker.email}
                </Descriptions.Item>
                <Descriptions.Item label="Period">
                  {format(new Date(payout.period.start), 'MMM dd, yyyy')} - {format(new Date(payout.period.end), 'MMM dd, yyyy')}
                </Descriptions.Item>
                {payout.broker.bankAccount && (
                  <>
                    <Descriptions.Item label="Bank">
                      {payout.broker.bankAccount.bankName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Account Number">
                      ****{payout.broker.bankAccount.accountNumber.slice(-4)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Account Holder" span={2}>
                      {payout.broker.bankAccount.accountHolder}
                    </Descriptions.Item>
                  </>
                )}
              </Descriptions>
            </Card>

            {/* Fee Breakdown */}
            <Card title="Fee Breakdown">
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="Processing Fee"
                    value={payout.fees.processing}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    precision={2}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Gateway Fee"
                    value={payout.fees.gateway}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    precision={2}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="Total Fees"
                    value={payout.fees.total}
                    formatter={(value) => formatCurrency(Number(value), payout.currency)}
                    precision={2}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* Transactions */}
            <Card title="Transactions in this Payout">
              <Table
                columns={transactionColumns}
                dataSource={payout.transactions}
                rowKey="id"
                pagination={false}
                size="small"
                summary={(data) => {
                  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <Text strong>{formatCurrency(totalAmount, payout.currency)}</Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />
            </Card>

            {/* Supporting Documents */}
            {payout.documents && payout.documents.length > 0 && (
              <Card title="Supporting Documents">
                <Table
                  columns={documentColumns}
                  dataSource={payout.documents}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </Card>
            )}

            {/* Additional Information */}
            <Card title="Additional Information">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Description">
                  {payout.description}
                </Descriptions.Item>
                <Descriptions.Item label="Requested At">
                  {format(new Date(payout.requestedAt), 'MMM dd, yyyy HH:mm')}
                </Descriptions.Item>
                {payout.processedAt && (
                  <Descriptions.Item label="Processed At">
                    {format(new Date(payout.processedAt), 'MMM dd, yyyy HH:mm')}
                  </Descriptions.Item>
                )}
                {payout.completedAt && (
                  <Descriptions.Item label="Completed At">
                    {format(new Date(payout.completedAt), 'MMM dd, yyyy HH:mm')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Approval Form */}
            {payout.status === 'PENDING' && (
              <Card title="Approval Details">
                <Form form={form} layout="vertical">
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="approvedAmount"
                        label="Approved Amount"
                        initialValue={payout.netAmount}
                        rules={[
                          { required: true, message: 'Please enter approved amount' },
                          { type: 'number', min: 0, message: 'Amount must be positive' }
                        ]}
                      >
                        <InputNumber
                          style={{ width: '100%' }}
                          formatter={(value) => formatCurrency(Number(value), payout.currency)}
                          parser={(value) => value!.replace(/[^0-9.-]/g, '')}
                          precision={2}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="priority"
                        label="Processing Priority"
                        initialValue="NORMAL"
                      >
                        <Select>
                          <Option value="LOW">Low</Option>
                          <Option value="NORMAL">Normal</Option>
                          <Option value="HIGH">High</Option>
                          <Option value="URGENT">Urgent</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="notes"
                    label="Approval Notes"
                  >
                    <TextArea
                      rows={3}
                      placeholder="Add any notes or instructions for this payout..."
                    />
                  </Form.Item>
                  <Form.Item
                    name="documents"
                    label="Additional Documents"
                  >
                    <Upload
                      multiple
                      beforeUpload={() => false} // Prevent auto upload
                      onChange={(info) => {
                        setSelectedDocuments(info.fileList);
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Upload Documents</Button>
                    </Upload>
                  </Form.Item>
                </Form>
              </Card>
            )}
          </Space>
        </Spin>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        title="Reject Payout"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={handleReject}
        okText="Reject Payout"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="Confirm Rejection"
          description="Please provide a reason for rejecting this payout. This will be communicated to the broker."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Rejection Reason"
            rules={[{ required: true, message: 'Please provide a rejection reason' }]}
          >
            <TextArea
              rows={4}
              placeholder="Explain why this payout is being rejected..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default PayoutApprovalModal;