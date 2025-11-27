import React from 'react';
import {
  Modal, Form, Input, DatePicker, Select, InputNumber, message, Space, Typography, Alert, } from 'antd';
import {
  StopOutlined, ClockCircleOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {TextArea} = Input;
const {Option} = Select;
const {Title, Text} = Typography;

interface SuspenseModalProps {
  visible: boolean;
  user: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const SuspenseModal: React.FC<SuspenseModalProps> = ({
  visible,
  user,
  onOk,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();

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
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          <StopOutlined style={{ color: '#faad14' }} />
          <Title level={4} style={{ margin: 0 }}>
            Suspend User Account
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Suspend User"
      okButtonProps={{ danger: true }}
      cancelText="Cancel"
      width={600}
    >
      <Alert
        message="Suspension Warning"
        description="Suspending a user will restrict their access to the platform. They will not be able to trade, withdraw funds, or access most features until the suspension is lifted."
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {user && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fafafa', borderRadius: 8 }}>
          <Text strong>User Information:</Text>
          <div style={{ marginTop: 8 }}>
            <Text>Username: {user.username}</Text><br />
            <Text>Email: {user.email}</Text><br />
            <Text>Current Status: <span style={{ color: '#52c41a' }}>{user.status}</span></Text>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          suspensionType: 'temporary',
          suspensionDuration: 7,
          reason: '',
          notes: '',
          notifyUser: true,
        }}
      >
        <Form.Item
          label="Suspension Type"
          name="suspensionType"
          rules={[{ required: true, message: 'Please select suspension type' }]}
        >
          <Select placeholder="Select suspension type">
            <Option value="temporary">Temporary Suspension</Option>
            <Option value="indefinite">Indefinite Suspension</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.suspensionType !== currentValues.suspensionType
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('suspensionType') === 'temporary' ? (
              <Form.Item
                label="Suspension Duration"
                name="suspensionDuration"
                rules={[{ required: true, message: 'Please select suspension duration' }]}
              >
                <Select placeholder="Select duration">
                  <Option value={1}>1 Day</Option>
                  <Option value={3}>3 Days</Option>
                  <Option value={7}>1 Week</Option>
                  <Option value={14}>2 Weeks</Option>
                  <Option value={30}>1 Month</Option>
                  <Option value={90}>3 Months</Option>
                  <Option value={180}>6 Months</Option>
                </Select>
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Form.Item
          label="Suspension Reason"
          name="reason"
          rules={[{ required: true, message: 'Please provide suspension reason' }]}
        >
          <Select placeholder="Select suspension reason">
            <Option value="fraud">Fraudulent Activity</Option>
            <Option value="violations">Terms of Service Violations</Option>
            <Option value="suspicious">Suspicious Activity</Option>
            <Option value="compliance">Compliance Requirements</Option>
            <Option value="investigation">Under Investigation</Option>
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Detailed Reason"
          name="notes"
          rules={[
            { required: true, message: 'Please provide detailed reason for suspension' },
            { min: 20, message: 'Please provide at least 20 characters' }
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Please provide a detailed explanation for the suspension..."
            showCount
            maxLength={1000}
          />
        </Form.Item>

        <Form.Item
          label="Evidence Reference"
          name="evidenceReference"
        >
          <Input
            placeholder="Reference to evidence files or case numbers"
          />
        </Form.Item>

        <Form.Item
          label="Reviewed By"
          name="reviewedBy"
          initialValue="System Administrator"
        >
          <Input disabled />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default SuspenseModal;