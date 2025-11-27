import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, DatePicker, message, Space, Typography, Alert, Checkbox, Upload, Button, } from 'antd';
import {
  StopOutlined, ExclamationCircleOutlined, UploadOutlined, DeleteOutlined, } from '@ant-design/icons';
import dayjs from 'dayjs';

const {TextArea} = Input;
const {Option} = Select;
const {Title, Text} = Typography;

interface BanModalProps {
  visible: boolean;
  user: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const BanModal: React.FC<BanModalProps> = ({
  visible,
  user,
  onOk,
  onCancel,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const submitValues = {
        ...values,
        evidenceFiles: evidenceFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      };
      onOk(submitValues);
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setEvidenceFiles([]);
    onCancel();
  };

  const uploadProps = {
    beforeUpload: (file: any) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'application/pdf';
      if (!isJpgOrPng) {
        message.error('You can only upload JPG/PNG images or PDF files!');
        return false;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('File must be smaller than 10MB!');
        return false;
      }
      setEvidenceFiles([...evidenceFiles, file]);
      return false; // Prevent automatic upload
    },
    onRemove: (file: any) => {
      setEvidenceFiles(evidenceFiles.filter(f => f.uid !== file.uid));
    },
    fileList: evidenceFiles,
  };

  return (
    <Modal
      title={
        <Space>
          <StopOutlined style={{ color: '#ff4d4f' }} />
          <Title level={4} style={{ margin: 0 }}>
            Permanently Ban User
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Ban User Permanently"
      okButtonProps={{ danger: true }}
      cancelText="Cancel"
      width={700}
    >
      <Alert
        message="⚠️ Permanent Ban Action"
        description="This action will permanently ban the user from the platform. All access will be revoked, funds will be frozen pending investigation, and this action cannot be undone. Please ensure you have sufficient evidence before proceeding."
        type="error"
        showIcon
        style={{ marginBottom: 24 }}
      />

      {user && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#fff2f0', borderRadius: 8, border: '1px solid #ffccc7' }}>
          <Text strong style={{ color: '#cf1322' }}>User to Ban:</Text>
          <div style={{ marginTop: 8 }}>
            <Text>Username: {user.username}</Text><br />
            <Text>Email: {user.email}</Text><br />
            <Text>Member Since: {dayjs(user.createdAt).format('MMMM DD, YYYY')}</Text><br />
            <Text>Current Status: <span style={{ color: '#52c41a' }}>{user.status}</span></Text>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          banType: 'permanent',
          banReason: 'other',
          notifyUser: false,
          confiscateFunds: false,
          deleteUserData: false,
        }}
      >
        <Form.Item
          label="Ban Reason Category"
          name="banReason"
          rules={[{ required: true, message: 'Please select ban reason category' }]}
        >
          <Select placeholder="Select ban reason">
            <Option value="fraud">Fraudulent Activity</Option>
            <Option value="money_laundering">Money Laundering</Option>
            <Option value="market_manipulation">Market Manipulation</Option>
            <Option value="illegal_activities">Illegal Activities</Option>
            <Option value="terrorism">Terrorism Financing</Option>
            <Option value="identity_theft">Identity Theft</Option>
            <Option value="multiple_accounts">Multiple Accounts</Option>
            <Option value="abuse">Harassment or Abuse</Option>
            <Option value="security_breach">Security Breach</Option>
            <Option value="regulatory_violation">Regulatory Violations</Option>
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Detailed Reason for Ban"
          name="reason"
          rules={[
            { required: true, message: 'Please provide detailed reason for the ban' },
            { min: 50, message: 'Please provide at least 50 characters explaining the reason' }
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Provide a comprehensive explanation for the permanent ban, including specific violations, evidence, and any relevant case numbers..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          label="Evidence Files"
          name="evidence"
        >
          <Upload {...uploadProps} multiple>
            <Button icon={<UploadOutlined />}>Upload Evidence (Images/PDF)</Button>
          </Upload>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Upload supporting evidence such as screenshots, documents, or PDF reports. Max 10MB per file.
          </Text>
        </Form.Item>

        <Form.Item
          label="Case Reference"
          name="caseReference"
        >
          <Input
            placeholder="Internal case number or reference ID"
          />
        </Form.Item>

        <Form.Item
          label="Legal/Regulatory Reference"
          name="legalReference"
        >
          <Input
            placeholder="Relevant laws, regulations, or compliance requirements"
          />
        </Form.Item>

        <Form.Item
          label="Additional Actions"
          name="additionalActions"
        >
          <Checkbox.Group>
            <Space direction="vertical">
              <Checkbox value="confiscateFunds">
                <Text strong>Confiscate All Funds</Text>
                <Text type="secondary"> - Freeze and seize user balance</Text>
              </Checkbox>
              <Checkbox value="deleteUserData">
                <Text strong>Delete User Data</Text>
                <Text type="secondary"> - Remove all personal information</Text>
              </Checkbox>
              <Checkbox value="reportAuthorities">
                <Text strong>Report to Authorities</Text>
                <Text type="secondary"> - Notify law enforcement agencies</Text>
              </Checkbox>
              <Checkbox value="blacklist">
                <Text strong>Blacklist Identity</Text>
                <Text type="secondary"> - Prevent future account creation</Text>
              </Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item
          label="Notification Settings"
          name="notificationSettings"
        >
          <Checkbox.Group>
            <Space direction="vertical">
              <Checkbox value="notifyUser">
                Notify user via email about the ban
              </Checkbox>
              <Checkbox value="notifyAffectedUsers">
                Notify users who had transactions with this user
              </Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item
          label="Reviewed By"
          name="reviewedBy"
          initialValue="System Administrator"
        >
          <Input disabled />
        </Form.Item>

        <Form.Item
          label="Final Confirmation"
          name="confirmBan"
          valuePropName="checked"
          rules={[
            {
              validator: (_, value) =>
                value ? Promise.resolve() : Promise.reject(new Error('You must confirm the ban action')),
            },
          ]}
        >
          <Checkbox>
            I confirm that I have reviewed all evidence and this permanent ban is justified and necessary.
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BanModal;