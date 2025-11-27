import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, Button, Space, Typography, Alert, Upload, Image, Card, Row, Col, Tag, Divider, Timeline, } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, UploadOutlined, FileImageOutlined, FileTextOutlined, UserOutlined, IdcardOutlined, HomeOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {TextArea} = Input;
const {Option} = Select;
const {Title, Text} = Typography;

interface KYCReviewModalProps {
  visible: boolean;
  user: any;
  kycData: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const KYCReviewModal: React.FC<KYCReviewModalProps> = ({
  visible,
  user,
  kycData,
  onOk,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedDocument(null);
    onCancel();
  };

  const getDocumentTypeIcon = (type: string) => {
    switch (type) {
      case 'passport':
        return <IdcardOutlined />;
      case 'id_card':
        return <IdcardOutlined />;
      case 'driver_license':
        return <IdcardOutlined />;
      case 'utility_bill':
        return <HomeOutlined />;
      case 'bank_statement':
        return <FileTextOutlined />;
      default:
        return <FileImageOutlined />;
    }
  };

  const getVerificationStatus = (status: string) => {
    switch (status) {
      case 'approved':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Approved</Tag>;
      case 'rejected':
        return <Tag color="red" icon={<CloseCircleOutlined />}>Rejected</Tag>;
      case 'pending':
        return <Tag color="orange">Pending Review</Tag>;
      case 'submitted':
        return <Tag color="blue">Submitted</Tag>;
      default:
        return <Tag color="default">Unknown</Tag>;
    }
  };

  if (!kycData) return null;

  return (
    <Modal
      title={
        <Space>
          <UserOutlined />
          <Title level={4} style={{ margin: 0 }}>
            KYC Verification Review - {user?.username}
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Submit Review"
      cancelText="Cancel"
      width={1000}
      bodyStyle={{ padding: 0 }}
    >
      <div style={{ display: 'flex', height: '600px' }}>
        {/* Left Panel - Documents */}
        <div style={{ width: '40%', borderRight: '1px solid #f0f0f0', overflowY: 'auto', padding: '16px' }}>
          <Title level={5}>Submitted Documents</Title>

          {kycData.documents?.map((doc: any, index: number) => (
            <Card
              key={index}
              size="small"
              style={{ marginBottom: 12, cursor: 'pointer', border: selectedDocument === doc.id ? '2px solid #1890ff' : undefined }}
              onClick={() => setSelectedDocument(doc.id)}
            >
              <Space>
                {getDocumentTypeIcon(doc.type)}
                <div>
                  <Text strong>{doc.type?.replace('_', ' ').toUpperCase()}</Text>
                  <br />
                  <Text type="secondary">{doc.fileName}</Text>
                  <br />
                  {getVerificationStatus(doc.status)}
                </div>
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle document preview
                  }}
                />
              </Space>
            </Card>
          ))}

          <Divider />

          {/* Document Preview */}
          {selectedDocument && (
            <div>
              <Title level={5}>Document Preview</Title>
              {kycData.documents.find((doc: any) => doc.id === selectedDocument)?.fileUrl && (
                <Image
                  width="100%"
                  src={kycData.documents.find((doc: any) => doc.id === selectedDocument)?.fileUrl}
                  alt="Document preview"
                />
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Review Form */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* User Information */}
          <Card title="Personal Information" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Full Name:</Text><br />
                <Text>{kycData.personalInfo?.firstName} {kycData.personalInfo?.lastName}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Date of Birth:</Text><br />
                <Text>{kycData.personalInfo?.dateOfBirth ? dayjs(kycData.personalInfo.dateOfBirth).format('MMMM DD, YYYY') : 'Not provided'}</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}>
                <Text strong>Nationality:</Text><br />
                <Text>{kycData.personalInfo?.nationality || 'Not provided'}</Text>
              </Col>
              <Col span={12}>
                <Text strong>ID Number:</Text><br />
                <Text>{kycData.personalInfo?.idNumber || 'Not provided'}</Text>
              </Col>
            </Row>
          </Card>

          {/* Address Information */}
          <Card title="Address Information" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>Address:</Text><br />
                <Text>{kycData.address?.street || 'Not provided'}</Text>
              </Col>
              <Col span={12}>
                <Text strong>City:</Text><br />
                <Text>{kycData.address?.city || 'Not provided'}</Text>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}>
                <Text strong>Country:</Text><br />
                <Text>{kycData.address?.country || 'Not provided'}</Text>
              </Col>
              <Col span={12}>
                <Text strong>Postal Code:</Text><br />
                <Text>{kycData.address?.postalCode || 'Not provided'}</Text>
              </Col>
            </Row>
          </Card>

          {/* Review History */}
          {kycData.reviewHistory && kycData.reviewHistory.length > 0 && (
            <Card title="Review History" size="small" style={{ marginBottom: 16 }}>
              <Timeline>
                {kycData.reviewHistory.map((history: any, index: number) => (
                  <Timeline.Item key={index}>
                    <Text strong>{history.reviewer}</Text>
                    <br />
                    <Text>{history.action} - {dayjs(history.timestamp).format('YYYY-MM-DD HH:mm')}</Text>
                    <br />
                    <Text type="secondary">{history.comments}</Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          )}

          {/* Review Form */}
          <Card title="Review Decision" size="small">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                decision: 'approved',
                comments: '',
                level: 'tier1',
              }}
            >
              <Form.Item
                label="Verification Decision"
                name="decision"
                rules={[{ required: true, message: 'Please select verification decision' }]}
              >
                <Select placeholder="Select decision">
                  <Option value="approved">✅ Approve Verification</Option>
                  <Option value="rejected">❌ Reject Verification</Option>
                  <Option value="request_more_info">📋 Request More Information</Option>
                </Select>
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.decision !== currentValues.decision
                }
              >
                {({ getFieldValue }) =>
                  getFieldValue('decision') === 'approved' ? (
                    <Form.Item
                      label="Verification Level"
                      name="level"
                      rules={[{ required: true, message: 'Please select verification level' }]}
                    >
                      <Select placeholder="Select verification level">
                        <Option value="tier1">Tier 1 - Basic Verification</Option>
                        <Option value="tier2">Tier 2 - Enhanced Verification</Option>
                        <Option value="tier3">Tier 3 - Full Verification</Option>
                      </Select>
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Form.Item
                label="Review Comments"
                name="comments"
                rules={[
                  { required: true, message: 'Please provide review comments' },
                  { min: 10, message: 'Please provide at least 10 characters' }
                ]}
              >
                <TextArea
                  rows={4}
                  placeholder="Detailed comments about the verification decision..."
                  showCount
                  maxLength={1000}
                />
              </Form.Item>

              {form.getFieldValue('decision') === 'request_more_info' && (
                <Form.Item
                  label="Information Requested"
                  name="requestedInfo"
                  rules={[{ required: true, message: 'Please specify what information is needed' }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="Specify what additional documents or information are required..."
                    maxLength={500}
                  />
                </Form.Item>
              )}

              <Form.Item
                label="Reviewed By"
                name="reviewedBy"
                initialValue="System Administrator"
              >
                <Input disabled />
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </Modal>
  );
};

export default KYCReviewModal;