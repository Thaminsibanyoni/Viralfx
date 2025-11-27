import React from 'react';
import {
  Form, Select, Input, Button, Space, Typography, Card, DatePicker, } from 'antd';
import { MessageOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const {Title} = Typography;
const {TextArea} = Input;
const {Option} = Select;
const {DateTimePicker} = DatePicker;

interface ClientInteractionFormProps {
  form: any;
  onSubmit: (values: any) => void;
  loading?: boolean;
}

const ClientInteractionForm: React.FC<ClientInteractionFormProps> = ({
  form,
  onSubmit,
  loading = false,
}) => {
  const handleSubmit = (values: any) => {
    const formattedValues = {
      ...values,
      scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : undefined,
    };
    onSubmit(formattedValues);
  };

  return (
    <Card>
      <Title level={4}>Add Client Interaction</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          direction: 'OUTBOUND',
          channel: 'EMAIL',
          type: 'GENERAL',
        }}
      >
        <Form.Item
          label="Interaction Type"
          name="type"
          rules={[{ required: true, message: 'Please select interaction type' }]}
        >
          <Select placeholder="Select interaction type">
            <Option value="GENERAL">General Communication</Option>
            <Option value="SALES">Sales Call</Option>
            <Option value="SUPPORT">Support Follow-up</Option>
            <Option value="ONBOARDING">Onboarding</Option>
            <Option value="RETENTION">Retention Call</Option>
            <Option value="COMPLIANCE">Compliance Check</Option>
            <Option value="RISK_REVIEW">Risk Review</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Direction"
          name="direction"
          rules={[{ required: true, message: 'Please select direction' }]}
        >
          <Select placeholder="Select direction">
            <Option value="INBOUND">Inbound (Client initiated)</Option>
            <Option value="OUTBOUND">Outbound (We initiated)</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Channel"
          name="channel"
          rules={[{ required: true, message: 'Please select channel' }]}
        >
          <Select placeholder="Select communication channel">
            <Option value="EMAIL">Email</Option>
            <Option value="PHONE">Phone Call</Option>
            <Option value="SMS">SMS</Option>
            <Option value="WHATSAPP">WhatsApp</Option>
            <Option value="VIDEO">Video Call</Option>
            <Option value="IN_PERSON">In Person</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Subject"
          name="subject"
        >
          <Input placeholder="Enter interaction subject" />
        </Form.Item>

        <Form.Item
          label="Content"
          name="content"
          rules={[{ required: true, message: 'Please enter interaction content' }]}
        >
          <TextArea
            rows={6}
            placeholder="Describe the interaction details, key points discussed, outcomes, etc."
          />
        </Form.Item>

        <Form.Item
          label="Scheduled For"
          name="scheduledAt"
        >
          <DateTimePicker
            showTime
            placeholder="Select date and time (optional)"
            style={{ width: '100%' }}
            disabledDate={(current) => current && current.isBefore(dayjs(), 'day')}
          />
        </Form.Item>

        <div className="flex justify-end space-x-2">
          <Button onClick={() => form.resetFields()}>
            Reset
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Add Interaction
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default ClientInteractionForm;