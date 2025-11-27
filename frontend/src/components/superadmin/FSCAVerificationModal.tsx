import React from 'react';
import {
  Modal, Form, Input, Select, DatePicker, message, Space, Typography, Alert, Upload, Button, } from 'antd';
import {
  SafetyOutlined, UploadOutlined, CheckCircleOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {TextArea} = Input;
const {Option} = Select;
const {Title, Text} = Typography;

interface FSCAVerificationModalProps {
  visible: boolean;
  broker: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const FSCAVerificationModal: React.FC<FSCAVerificationModalProps> = ({
  visible,
  broker,
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
          <SafetyOutlined />
          <Title level={4} style={{ margin: 0 }}>
            FSCA License Verification
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Verify License"
      cancelText="Cancel"
      width={600}
    >
      {broker && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f0f7ff', borderRadius: 8 }}>
          <Text strong>Broker:</Text>
          <div style={{ marginTop: 8 }}>
            <Text>Company: {broker.companyName}</Text><br />
            <Text>Email: {broker.email}</Text>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          verificationStatus: 'verified',
        }}
      >
        <Form.Item
          label="License Number"
          name="licenseNumber"
          rules={[{ required: true, message: 'Please enter license number' }]}
        >
          <Input placeholder="FSCA license number" />
        </Form.Item>

        <Form.Item
          label="Verification Status"
          name="verificationStatus"
          rules={[{ required: true, message: 'Please select verification status' }]}
        >
          <Select placeholder="Select status">
            <Option value="verified">✅ Verified</Option>
            <Option value="pending">⏳ Pending</Option>
            <Option value="rejected">❌ Rejected</Option>
            <Option value="expired">⚠️ Expired</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="License Expiry Date"
          name="expiryDate"
          rules={[{ required: true, message: 'Please select expiry date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Verification Notes"
          name="notes"
          rules={[{ required: true, message: 'Please provide verification notes' }]}
        >
          <TextArea rows={4} placeholder="FSCA verification details..." />
        </Form.Item>

        <Form.Item
          label="License Document"
          name="document"
        >
          <Upload>
            <Button icon={<UploadOutlined />}>Upload License Document</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default FSCAVerificationModal;