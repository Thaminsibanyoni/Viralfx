import React, { useState } from 'react';
import {
  Card, Avatar, Tag, Statistic, Row, Col, Button, Space, Descriptions, Progress, Badge, Typography, Divider, List, Tooltip, } from 'antd';
import {
  UserOutlined, BankOutlined, DollarOutlined, FileTextOutlined, EditOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined, ExclamationCircleOutlined, StarOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BrokerAccount } from '../../services/api/crm.api';

const {Title, Text} = Typography;

interface BrokerCardProps {
  broker: BrokerAccount;
  onEdit?: () => void;
  compact?: boolean;
}

const BrokerCard: React.FC<BrokerCardProps> = ({
  broker,
  onEdit,
  compact = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

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

  const getRiskColor = (risk: string) => {
    const colors: Record<string, string> = {
      LOW: 'green',
      MEDIUM: 'orange',
      HIGH: 'red',
    };
    return colors[risk] || 'default';
  };

  const getComplianceColor = (status: string) => {
    const colors: Record<string, string> = {
      APPROVED: 'green',
      PENDING: 'orange',
      SUSPENDED: 'red',
    };
    return colors[status] || 'default';
  };

  const getDocumentStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      APPROVED: <CheckOutlined />,
      REJECTED: <CloseOutlined />,
      PENDING: <ClockCircleOutlined />,
      EXPIRED: <ExclamationCircleOutlined />,
    };
    return icons[status] || <ClockCircleOutlined />;
  };

  if (compact) {
    return (
      <Card
        size="small"
        className="hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => setShowDetails(true)}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Avatar size="small" icon={<UserOutlined />} />
            <div>
              <div className="font-medium">{broker.broker?.companyName}</div>
              <div className="text-sm text-gray-500">{broker.broker?.email}</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Tag color={getTierColor(broker.broker?.tier || '')}>
              {broker.broker?.tier}
            </Tag>
            <Tag color={getStatusColor(broker.status)}>
              {broker.status}
            </Tag>
          </div>
        </div>
      </Card>
    );
  }

  const totalDocuments = broker.documents?.length || 0;
  const verifiedDocuments = broker.documents?.filter(doc => doc.status === 'APPROVED').length || 0;
  const pendingDocuments = broker.documents?.filter(doc => doc.status === 'PENDING').length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex items-center space-x-4">
            <Avatar size={64} icon={<UserOutlined />} />
            <div>
              <Title level={4} className="!mb-1">
                {broker.broker?.companyName}
              </Title>
              <Text type="secondary">{broker.broker?.email}</Text>
              <div className="mt-2 space-x-2">
                <Tag color={getTierColor(broker.broker?.tier || '')}>
                  {broker.broker?.tier}
                </Tag>
                <Tag color={getStatusColor(broker.status)}>
                  {broker.status}
                </Tag>
                <Tag color={getComplianceColor(broker.complianceStatus)}>
                  {broker.complianceStatus}
                </Tag>
                <Tag color={getRiskColor(broker.riskRating)}>
                  Risk: {broker.riskRating}
                </Tag>
                {broker.fscaVerified && (
                  <Tag color="green" icon={<CheckOutlined />}>
                    FSCA Verified
                  </Tag>
                )}
              </div>
            </div>
          </div>
          <Space>
            {onEdit && (
              <Button icon={<EditOutlined />} onClick={onEdit}>
                Edit
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Quick Stats */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Credit Limit"
              value={Number(broker.creditLimit)}
              prefix={<DollarOutlined />}
              formatter={(value) => `$${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Payment Terms"
              value={broker.paymentTerms}
              suffix="days"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Documents"
              value={totalDocuments}
              suffix={`/ ${verifiedDocuments} verified`}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div className="text-center">
              <div className="text-sm text-gray-500 mb-2">Document Completion</div>
              <Progress
                percent={totalDocuments > 0 ? Math.round((verifiedDocuments / totalDocuments) * 100) : 0}
                size="small"
                status={pendingDocuments > 0 ? 'active' : 'success'}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Account Details */}
      <Card title={<><BankOutlined /> Account Details</>}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Account Type">
            {broker.accountType}
          </Descriptions.Item>
          <Descriptions.Item label="Business Number">
            {broker.businessNumber || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Tax Number">
            {broker.taxNumber || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="VAT Registered">
            {broker.vatRegistered ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="VAT Number">
            {broker.vatNumber || 'N/A'}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {dayjs(broker.createdAt).format('YYYY-MM-DD')}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Banking Information */}
      <Card title={<><BankOutlined /> Banking Information</>}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Bank Name">
            {broker.bankName || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Account Type">
            {broker.bankAccountType || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Account Number">
            {broker.bankAccountNumber ? `****${broker.bankAccountNumber.slice(-4)}` : 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="Branch Code">
            {broker.bankBranchCode || 'Not provided'}
          </Descriptions.Item>
          <Descriptions.Item label="SWIFT Code">
            {broker.swiftCode || 'Not provided'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Recent Documents */}
      <Card
        title={<><FileTextOutlined /> Recent Documents</>}
        extra={
          <Badge count={pendingDocuments} showZero>
            <Tag color="orange">Pending</Tag>
          </Badge>
        }
      >
        {broker.documents && broker.documents.length > 0 ? (
          <List
            dataSource={broker.documents.slice(0, 5)}
            renderItem={(doc) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <Avatar
                      size="small"
                      icon={getDocumentStatusIcon(doc.status)}
                      style={{
                        backgroundColor: doc.status === 'APPROVED' ? '#52c41a' :
                                       doc.status === 'REJECTED' ? '#ff4d4f' :
                                       doc.status === 'EXPIRED' ? '#fa8c16' : '#1890ff'
                      }}
                    />
                  }
                  title={
                    <div className="flex justify-between items-center">
                      <span>{doc.title}</span>
                      <Tag color={doc.status === 'APPROVED' ? 'green' :
                                   doc.status === 'REJECTED' ? 'red' :
                                   doc.status === 'EXPIRED' ? 'orange' : 'blue'}>
                        {doc.status}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div className="text-sm text-gray-500">
                        {doc.documentType} • {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                      </div>
                      {doc.expiryDate && (
                        <div className="text-sm text-gray-500">
                          Expires: {dayjs(doc.expiryDate).format('YYYY-MM-DD')}
                        </div>
                      )}
                      {doc.verifiedAt && (
                        <div className="text-sm text-gray-500">
                          Verified: {dayjs(doc.verifiedAt).format('YYYY-MM-DD')}
                        </div>
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <div className="text-center py-4 text-gray-500">
            No documents uploaded
          </div>
        )}
      </Card>

      {/* Recent Notes */}
      {broker.notes && broker.notes.length > 0 && (
        <Card title="Recent Notes">
          <List
            dataSource={broker.notes.slice(0, 3)}
            renderItem={(note) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <div className="flex justify-between items-center">
                      <span>{note.title}</span>
                      <Tag color={note.priority === 'URGENT' ? 'red' :
                                   note.priority === 'HIGH' ? 'orange' :
                                   note.priority === 'LOW' ? 'green' : 'blue'}>
                        {note.priority}
                      </Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div className="text-sm mb-1">{note.content}</div>
                      <div className="text-xs text-gray-500">
                        By {note.author?.firstName} {note.author?.lastName} •
                        {dayjs(note.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default BrokerCard;