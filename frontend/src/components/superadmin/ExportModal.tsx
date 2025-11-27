import React, { useState } from 'react';
import {
  Modal, Form, Select, DatePicker, Checkbox, Button, Space, Typography, Alert, Progress, Card, Divider, Upload, message, } from 'antd';
import {
  DownloadOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined, UploadOutlined, CloudDownloadOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {Option} = Select;
const {RangePicker} = DatePicker;
const {Title, Text} = Typography;

interface ExportModalProps {
  visible: boolean;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
  exportProgress?: number;
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onOk,
  onCancel,
  loading = false,
  exportProgress = 0,
}) => {
  const [form] = Form.useForm();
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customFilters, setCustomFilters] = useState<any[]>([]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const exportData = {
        ...values,
        selectedFields,
        customFilters,
      };
      onOk(exportData);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setSelectedFields([]);
    setCustomFilters([]);
    onCancel();
  };

  const availableFields = {
    users: [
      { key: 'id', label: 'User ID', category: 'Basic Info' },
      { key: 'username', label: 'Username', category: 'Basic Info' },
      { key: 'email', label: 'Email', category: 'Basic Info' },
      { key: 'firstName', label: 'First Name', category: 'Basic Info' },
      { key: 'lastName', label: 'Last Name', category: 'Basic Info' },
      { key: 'phone', label: 'Phone', category: 'Basic Info' },
      { key: 'status', label: 'Status', category: 'Account' },
      { key: 'accountType', label: 'Account Type', category: 'Account' },
      { key: 'balance', label: 'Balance', category: 'Financial' },
      { key: 'totalDeposits', label: 'Total Deposits', category: 'Financial' },
      { key: 'totalWithdrawals', label: 'Total Withdrawals', category: 'Financial' },
      { key: 'createdAt', label: 'Registration Date', category: 'Timestamps' },
      { key: 'lastLogin', label: 'Last Login', category: 'Timestamps' },
    ],
    transactions: [
      { key: 'id', label: 'Transaction ID', category: 'Basic Info' },
      { key: 'userId', label: 'User ID', category: 'Basic Info' },
      { key: 'type', label: 'Transaction Type', category: 'Details' },
      { key: 'amount', label: 'Amount', category: 'Financial' },
      { key: 'currency', label: 'Currency', category: 'Financial' },
      { key: 'status', label: 'Status', category: 'Details' },
      { key: 'createdAt', label: 'Created Date', category: 'Timestamps' },
      { key: 'completedAt', label: 'Completed Date', category: 'Timestamps' },
    ],
    trades: [
      { key: 'id', label: 'Trade ID', category: 'Basic Info' },
      { key: 'userId', label: 'User ID', category: 'Basic Info' },
      { key: 'symbol', label: 'Symbol', category: 'Details' },
      { key: 'type', label: 'Trade Type', category: 'Details' },
      { key: 'volume', label: 'Volume', category: 'Details' },
      { key: 'openPrice', label: 'Open Price', category: 'Financial' },
      { key: 'closePrice', label: 'Close Price', category: 'Financial' },
      { key: 'profit', label: 'Profit/Loss', category: 'Financial' },
      { key: 'openTime', label: 'Open Time', category: 'Timestamps' },
      { key: 'closeTime', label: 'Close Time', category: 'Timestamps' },
    ],
  };

  const exportFormats = [
    { value: 'excel', label: 'Excel (.xlsx)', icon: <FileExcelOutlined /> },
    { value: 'csv', label: 'CSV (.csv)', icon: <FileTextOutlined /> },
    { value: 'pdf', label: 'PDF Report (.pdf)', icon: <FilePdfOutlined /> },
    { value: 'json', label: 'JSON (.json)', icon: <FileTextOutlined /> },
  ];

  const dataTypes = [
    { value: 'users', label: 'Users', description: 'User accounts and profiles' },
    { value: 'transactions', label: 'Transactions', description: 'Financial transactions' },
    { value: 'trades', label: 'Trades', description: 'Trading history and positions' },
    { value: 'kyc', label: 'KYC Documents', description: 'Verification documents' },
    { value: 'audit_logs', label: 'Audit Logs', description: 'System activity logs' },
    { value: 'reports', label: 'Custom Reports', description: 'Generated reports' },
  ];

  const handleFieldSelection = (checkedValues: string[]) => {
    setSelectedFields(checkedValues);
  };

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Export Data
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Start Export"
      cancelText="Cancel"
      width={800}
    >
      {exportProgress > 0 && exportProgress < 100 && (
        <Alert
          message="Export in Progress"
          description={
            <div>
              <Progress percent={exportProgress} status="active" />
              <Text type="secondary">Please wait while we prepare your export file...</Text>
            </div>
          }
          type="info"
          style={{ marginBottom: 24 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          dataType: 'users',
          format: 'excel',
          dateRange: [dayjs().subtract(30, 'day'), dayjs()],
          includeHeaders: true,
          compressFile: false,
        }}
      >
        <Form.Item
          label="Data Type"
          name="dataType"
          rules={[{ required: true, message: 'Please select data type to export' }]}
        >
          <Select placeholder="Select data type">
            {dataTypes.map(type => (
              <Option key={type.value} value={type.value}>
                <div>
                  <Text strong>{type.label}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{type.description}</Text>
                </div>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Export Format"
          name="format"
          rules={[{ required: true, message: 'Please select export format' }]}
        >
          <Select placeholder="Select export format">
            {exportFormats.map(format => (
              <Option key={format.value} value={format.value}>
                <Space>
                  {format.icon}
                  {format.label}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Date Range"
          name="dateRange"
          rules={[{ required: true, message: 'Please select date range' }]}
        >
          <RangePicker
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
            placeholder={['Start Date', 'End Date']}
          />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.dataType !== currentValues.dataType
          }
        >
          {({ getFieldValue }) => {
            const dataType = getFieldValue('dataType');
            const fields = availableFields[dataType as keyof typeof availableFields] || [];

            return fields.length > 0 ? (
              <Form.Item label="Select Fields to Export">
                <Checkbox.Group
                  style={{ width: '100%' }}
                  onChange={handleFieldSelection}
                >
                  {Object.entries(
                    fields.reduce((acc: any, field) => {
                      if (!acc[field.category]) acc[field.category] = [];
                      acc[field.category].push(field);
                      return acc;
                    }, {})
                  ).map(([category, categoryFields]: [string, any]) => (
                    <div key={category} style={{ marginBottom: 16 }}>
                      <Text strong style={{ color: '#1890ff' }}>{category}</Text>
                      <div style={{ marginTop: 8 }}>
                        {categoryFields.map((field: any) => (
                          <Checkbox key={field.key} value={field.key} style={{ display: 'block', marginBottom: 4 }}>
                            {field.label}
                          </Checkbox>
                        ))}
                      </div>
                    </div>
                  ))}
                </Checkbox.Group>
              </Form.Item>
            ) : null;
          }}
        </Form.Item>

        <Form.Item label="Export Options">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox name="includeHeaders" defaultChecked>
              Include headers and metadata
            </Checkbox>
            <Checkbox name="compressFile">
              Compress export file (ZIP)
            </Checkbox>
            <Checkbox name="includeTimestamps">
              Include export timestamps
            </Checkbox>
            <Checkbox name="passwordProtect">
              Password protect export file
            </Checkbox>
          </Space>
        </Form.Item>

        <Form.Item label="Filter Options">
          <Card size="small" title="Additional Filters">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Status Filter:</Text>
                <Select
                  mode="multiple"
                  placeholder="Select statuses"
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Option value="active">Active</Option>
                  <Option value="suspended">Suspended</Option>
                  <Option value="banned">Banned</Option>
                  <Option value="pending">Pending</Option>
                </Select>
              </div>

              <div>
                <Text strong>Account Type:</Text>
                <Select
                  mode="multiple"
                  placeholder="Select account types"
                  style={{ width: '100%', marginTop: 8 }}
                >
                  <Option value="standard">Standard</Option>
                  <Option value="premium">Premium</Option>
                  <Option value="vip">VIP</Option>
                  <Option value="institutional">Institutional</Option>
                </Select>
              </div>
            </Space>
          </Card>
        </Form.Item>

        <Divider />

        <Alert
          message="Export Information"
          description={
            <div>
              <p>• Large exports may take several minutes to process</p>
              <p>• Exports are available for download for 24 hours</p>
              <p>• Sensitive data is encrypted in export files</p>
              <p>• All export activities are logged for audit purposes</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Form>
    </Modal>
  );
};

export default ExportModal;