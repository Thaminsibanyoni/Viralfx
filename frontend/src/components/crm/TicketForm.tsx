import React from 'react';
import { Form, Input, Select, Button, Card, Typography, Space } from 'antd';

const {TextArea} = Input;
const {Option} = Select;
const {Title} = Typography;

interface TicketFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  loading?: boolean;
}

const TicketForm: React.FC<TicketFormProps> = ({
  initialValues,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();

  return (
    <Card>
      <Title level={4}>
        {initialValues ? 'Edit Ticket' : 'Create New Ticket'}
      </Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={initialValues}
      >
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true, message: 'Please enter ticket title' }]}
        >
          <Input placeholder="Enter ticket title" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
          rules={[{ required: true, message: 'Please enter ticket description' }]}
        >
          <TextArea rows={4} placeholder="Describe the issue in detail" />
        </Form.Item>

        <Form.Item
          label="Category"
          name="category"
          rules={[{ required: true, message: 'Please select a category' }]}
        >
          <Select placeholder="Select category">
            <Option value="BILLING">Billing</Option>
            <Option value="TECHNICAL">Technical</Option>
            <Option value="ACCOUNT">Account</Option>
            <Option value="COMPLIANCE">Compliance</Option>
            <Option value="GENERAL">General</Option>
            <Option value="FEATURE_REQUEST">Feature Request</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Priority"
          name="priority"
          rules={[{ required: true, message: 'Please select priority' }]}
        >
          <Select placeholder="Select priority">
            <Option value="LOW">Low</Option>
            <Option value="NORMAL">Normal</Option>
            <Option value="HIGH">High</Option>
            <Option value="URGENT">Urgent</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Client Type"
          name="clientType"
          rules={[{ required: true, message: 'Please select client type' }]}
        >
          <Select placeholder="Select client type">
            <Option value="BROKER">Broker</Option>
            <Option value="CLIENT">Client</Option>
            <Option value="USER">User</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Client ID"
          name="clientId"
          rules={[{ required: true, message: 'Please enter client ID' }]}
        >
          <Input placeholder="Enter client ID" />
        </Form.Item>

        <div className="flex justify-end space-x-2">
          <Button onClick={() => form.resetFields()}>
            Reset
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? 'Update Ticket' : 'Create Ticket'}
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default TicketForm;