import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Tabs, Button, Space, Typography, Descriptions, Table, Tag, Modal, Form, Input, Select, Upload, message, Tooltip, Avatar, Timeline, Badge, Popconfirm, Drawer, List, Progress, } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, UploadOutlined, CheckOutlined, CloseOutlined, EyeOutlined, DeleteOutlined, PlusOutlined, FileTextOutlined, MessageOutlined, BankOutlined, SafetyCertificateOutlined, ExclamationCircleOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { crmApi, BrokerAccount, BrokerInvoice, BrokerNote, BrokerDocument } from '../../../services/api/crm.api';
import BrokerForm from '../../../components/crm/BrokerForm';
import DocumentUpload from '../../../components/crm/DocumentUpload';

const {Title, Text} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;
const {TextArea} = Input;

const BrokerDetailPage: React.FC = () => {
  const {id} = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteForm] = Form.useForm();
  const [editingBroker, setEditingBroker] = useState<BrokerAccount | null>(null);

  const queryClient = useQueryClient();

  // Fetch broker details
  const {data: brokerData, isLoading, refetch} = useQuery({
    queryKey: ['broker', id],
    queryFn: () => crmApi.getBrokerAccount(id!),
    enabled: !!id,
  });

  const broker = brokerData?.data;

  // Mutations
  const updateBrokerMutation = useMutation({
    mutationFn: (data: Partial<BrokerAccount>) => crmApi.updateBrokerAccount(id!, data),
    onSuccess: () => {
      message.success('Broker updated successfully');
      setEditModalVisible(false);
      setEditingBroker(null);
      queryClient.invalidateQueries({ queryKey: ['broker', id] });
    },
    onError: () => {
      message.error('Failed to update broker');
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { title: string; content: string; category: string }) =>
      crmApi.addBrokerNote(id!, data),
    onSuccess: () => {
      message.success('Note added successfully');
      setNoteModalVisible(false);
      noteForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['broker', id] });
    },
    onError: () => {
      message.error('Failed to add note');
    },
  });

  const verifyDocumentMutation = useMutation({
    mutationFn: ({ docId, status, notes }: { docId: string; status: string; notes?: string }) =>
      crmApi.verifyBrokerDocument(id!, docId, status as 'APPROVED' | 'REJECTED', notes),
    onSuccess: () => {
      message.success('Document verification updated');
      queryClient.invalidateQueries({ queryKey: ['broker', id] });
    },
    onError: () => {
      message.error('Failed to update document verification');
    },
  });

  const updateComplianceMutation = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      crmApi.updateBrokerComplianceStatus(id!, status, reason),
    onSuccess: () => {
      message.success('Compliance status updated');
      queryClient.invalidateQueries({ queryKey: ['broker', id] });
    },
    onError: () => {
      message.error('Failed to update compliance status');
    },
  });

  const handleEditBroker = () => {
    setEditingBroker(broker);
    setEditModalVisible(true);
  };

  const handleFormSubmit = (values: Partial<BrokerAccount>) => {
    updateBrokerMutation.mutate(values);
  };

  const handleAddNote = (values: any) => {
    addNoteMutation.mutate(values);
  };

  const handleVerifyDocument = (docId: string, status: 'APPROVED' | 'REJECTED', notes?: string) => {
    verifyDocumentMutation.mutate({ docId, status, notes });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      ACTIVE: 'green',
      INACTIVE: 'default',
      PENDING: 'orange',
      SUSPENDED: 'red',
    };
    return colors[status] || 'default';
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      STARTER: 'default',
      VERIFIED: 'blue',
      PARTNER: 'purple',
      ENTERPRISE: 'gold',
    };
    return colors[tier] || 'default';
  };

  const getDocumentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'orange',
      APPROVED: 'green',
      REJECTED: 'red',
      EXPIRED: 'red',
    };
    return colors[status] || 'default';
  };

  const invoiceColumns: ColumnsType<BrokerInvoice> = [
    {
      title: 'Invoice #',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      render: (invoiceNumber) => (
        <Button type="link">{invoiceNumber}</Button>
      ),
    },
    {
      title: 'Issue Date',
      dataIndex: 'issueDate',
      key: 'issueDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Total Amount',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => `$${Number(amount).toLocaleString()}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getDocumentStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Payment Status',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (status) => (
        <Tag color={status === 'PAID' ? 'green' : 'orange'}>{status}</Tag>
      ),
    },
  ];

  const noteColumns: ColumnsType<BrokerNote> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category) => <Tag>{category}</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag color={priority === 'URGENT' ? 'red' : priority === 'HIGH' ? 'orange' : 'blue'}>
          {priority}
        </Tag>
      ),
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      render: (author) => `${author?.firstName} ${author?.lastName}`,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const documentColumns: ColumnsType<BrokerDocument> = [
    {
      title: 'Document',
      key: 'document',
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.title}</div>
          <div className="text-sm text-gray-500">{record.fileName}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (type) => <Tag>{type.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getDocumentStatusColor(status)} icon={
          status === 'APPROVED' ? <CheckOutlined /> :
          status === 'REJECTED' ? <CloseOutlined /> :
          <ClockCircleOutlined />
        }>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Document">
            <Button type="text" icon={<EyeOutlined />} onClick={() => window.open(record.fileUrl, '_blank')} />
          </Tooltip>
          {record.status === 'PENDING' && (
            <>
              <Tooltip title="Approve">
                <Button type="text" icon={<CheckOutlined />} onClick={() => handleVerifyDocument(record.id, 'APPROVED')} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" icon={<CloseOutlined />} onClick={() => {
                  Modal.confirm({
                    title: 'Reject Document',
                    content: (
                      <Input.TextArea placeholder="Enter rejection reason" />
                    ),
                    onOk: ({ reason }: any) => handleVerifyDocument(record.id, 'REJECTED', reason),
                  });
                }} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!broker) {
    return <div>Broker not found</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/crm/brokers')}>
            Back to Brokers
          </Button>
          <Button icon={<EditOutlined />} onClick={handleEditBroker}>
            Edit Broker
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Profile" key="profile">
          <Card>
            <Descriptions title="Broker Information" bordered column={2}>
              <Descriptions.Item label="Company Name">
                {broker.broker?.companyName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {broker.broker?.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {broker.broker?.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Tier">
                <Tag color={getTierColor(broker.broker?.tier || '')}>
                  {broker.broker?.tier}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(broker.status)}>
                  {broker.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Account Type">
                {broker.accountType}
              </Descriptions.Item>
              <Descriptions.Item label="Credit Limit">
                ${Number(broker.creditLimit).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Payment Terms">
                {broker.paymentTerms} days
              </Descriptions.Item>
              <Descriptions.Item label="FSCA Verified">
                {broker.fscaVerified ? (
                  <Tag color="green" icon={<CheckOutlined />}>Verified</Tag>
                ) : (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>Not Verified</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Risk Rating">
                <Tag color={broker.riskRating === 'LOW' ? 'green' : broker.riskRating === 'HIGH' ? 'red' : 'orange'}>
                  {broker.riskRating}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Compliance Status">
                <Tag color={broker.complianceStatus === 'APPROVED' ? 'green' : 'orange'}>
                  {broker.complianceStatus}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <div className="mt-6">
              <Space>
                {broker.complianceStatus !== 'APPROVED' && (
                  <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => {
                    updateComplianceMutation.mutate({ status: 'APPROVED' });
                  }}>
                    Approve Compliance
                  </Button>
                )}
                <Button icon={<PlusOutlined />} onClick={() => setNoteModalVisible(true)}>
                  Add Note
                </Button>
              </Space>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="Documents" key="documents">
          <Card
            title="Documents"
            extra={
              <DocumentUpload
                brokerId={id!}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['broker', id] })}
              />
            }
          >
            <Table
              columns={documentColumns}
              dataSource={broker.documents}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>

        <TabPane tab="Invoices" key="invoices">
          <Card title="Billing History">
            <Table
              columns={invoiceColumns}
              dataSource={broker.invoices}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Notes" key="notes">
          <Card
            title="Internal Notes"
            extra={
              <Button icon={<PlusOutlined />} onClick={() => setNoteModalVisible(true)}>
                Add Note
              </Button>
            }
          >
            <Table
              columns={noteColumns}
              dataSource={broker.notes?.sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt)))}
              rowKey="id"
              pagination={false}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Edit Modal */}
      <Modal
        title="Edit Broker"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingBroker(null);
        }}
        footer={null}
        width={800}
      >
        <BrokerForm
          initialValues={editingBroker}
          onSubmit={handleFormSubmit}
          loading={updateBrokerMutation.isPending}
        />
      </Modal>

      {/* Add Note Modal */}
      <Modal
        title="Add Note"
        open={noteModalVisible}
        onCancel={() => {
          setNoteModalVisible(false);
          noteForm.resetFields();
        }}
        footer={null}
      >
        <Form form={noteForm} layout="vertical" onFinish={handleAddNote}>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="Enter note title" />
          </Form.Item>

          <Form.Item
            label="Category"
            name="category"
            rules={[{ required: true, message: 'Please select category' }]}
          >
            <Select placeholder="Select category">
              <Option value="GENERAL">General</Option>
              <Option value="COMPLIANCE">Compliance</Option>
              <Option value="BILLING">Billing</Option>
              <Option value="SUPPORT">Support</Option>
              <Option value="PERFORMANCE">Performance</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Priority"
            name="priority"
            initialValue="NORMAL"
          >
            <Select placeholder="Select priority">
              <Option value="LOW">Low</Option>
              <Option value="NORMAL">Normal</Option>
              <Option value="HIGH">High</Option>
              <Option value="URGENT">Urgent</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Content"
            name="content"
            rules={[{ required: true, message: 'Please enter content' }]}
          >
            <TextArea rows={4} placeholder="Enter note content" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={addNoteMutation.isPending}>
              Add Note
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BrokerDetailPage;