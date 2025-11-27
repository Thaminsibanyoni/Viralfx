import React, { useState } from 'react';
import { Card, Descriptions, Timeline, Button, Form, Input, Avatar, Tag, Space, Typography } from 'antd';
import { UserOutlined } from '@ant-design/icons';

const {TextArea} = Input;
const {Title} = Typography;

interface TicketDetailProps {
  ticket: any;
  onUpdate?: () => void;
}

const TicketDetail: React.FC<TicketDetailProps> = ({
  ticket,
  onUpdate,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleAddMessage = async (values: any) => {
    setSubmitting(true);
    try {
      // Mock API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      form.resetFields();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add message:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Ticket Details */}
      <Card>
        <Title level={4}>Ticket Details</Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Ticket Number">
            {ticket.ticketNumber}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={ticket.status === 'OPEN' ? 'red' : ticket.status === 'RESOLVED' ? 'green' : 'blue'}>
              {ticket.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={ticket.priority === 'URGENT' ? 'red' : ticket.priority === 'HIGH' ? 'orange' : 'blue'}>
              {ticket.priority}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Category">
            {ticket.category}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(ticket.createdAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Assigned To">
            {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : 'Unassigned'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Messages Timeline */}
      <Card>
        <Title level={4}>Conversation</Title>
        <Timeline>
          {ticket.messages?.map((message: any, index: number) => (
            <Timeline.Item
              key={message.id}
              color={message.isInternal ? 'gray' : 'blue'}
            >
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span className="font-medium">
                    {message.isInternal ? 'Internal Note' : `${message.sender?.firstName} ${message.sender?.lastName}`}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  {message.content}
                </div>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* Add Message */}
      {ticket.status !== 'CLOSED' && (
        <Card>
          <Title level={4}>Add Response</Title>
          <Form form={form} layout="vertical" onFinish={handleAddMessage}>
            <Form.Item
              label="Message"
              name="content"
              rules={[{ required: true, message: 'Please enter a message' }]}
            >
              <TextArea rows={4} placeholder="Enter your response..." />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  Send Response
                </Button>
                <Button>Internal Note</Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      )}
    </div>
  );
};

export default TicketDetail;