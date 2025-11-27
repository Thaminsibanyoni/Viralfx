import React, { useState } from 'react';
import { Card, Descriptions, Timeline, Button, Form, Input, Avatar, Tag, Space, Typography, Progress, Modal } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined, MessageOutlined } from '@ant-design/icons';

const {TextArea} = Input;
const {Title} = Typography;

interface DealDetailProps {
  deal: any;
  onUpdate?: () => void;
}

const DealDetail: React.FC<DealDetailProps> = ({
  deal,
  onUpdate,
}) => {
  const [form] = Form.useForm();
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAddActivity = async (values: any) => {
    setSubmitting(true);
    try {
      // Mock API call for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      form.resetFields();
      setActivityModalVisible(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add activity:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseWon = () => {
    Modal.confirm({
      title: 'Close Deal as Won',
      content: 'Are you sure you want to close this deal as won?',
      onOk: async () => {
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          onUpdate?.();
        } catch (error) {
          console.error('Failed to close deal:', error);
        }
      },
    });
  };

  const handleCloseLost = () => {
    Modal.confirm({
      title: 'Close Deal as Lost',
      content: (
        <Input.TextArea placeholder="Enter reason for losing the deal..." />
      ),
      onOk: async () => {
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 1000));
          onUpdate?.();
        } catch (error) {
          console.error('Failed to close deal:', error);
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Deal Details */}
      <Card>
        <Title level={4}>Deal Details</Title>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Title">
            {deal.title}
          </Descriptions.Item>
          <Descriptions.Item label="Stage">
            <Tag color={deal.stage?.name === 'CLOSED_WON' ? 'green' : deal.stage?.name === 'CLOSED_LOST' ? 'red' : 'blue'}>
              {deal.stage?.name}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Value">
            ${Number(deal.value).toLocaleString()} {deal.currency}
          </Descriptions.Item>
          <Descriptions.Item label="Probability">
            <Progress percent={deal.probability} size="small" />
          </Descriptions.Item>
          <Descriptions.Item label="Expected Close Date">
            {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Not set'}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(deal.createdAt).toLocaleDateString()}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Contact Information */}
      <Card>
        <Title level={4}>Contact Information</Title>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="Contact Person">
            {deal.contactPerson || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Email">
            {deal.contactEmail || 'Not specified'}
          </Descriptions.Item>
          <Descriptions.Item label="Phone">
            {deal.contactPhone || 'Not specified'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Activities Timeline */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Title level={4}>Activities</Title>
          <Button
            type="primary"
            icon={<MessageOutlined />}
            onClick={() => setActivityModalVisible(true)}
          >
            Add Activity
          </Button>
        </div>
        <Timeline>
          {deal.activities?.map((activity: any, index: number) => (
            <Timeline.Item
              key={activity.id}
              color={activity.type === 'CALL' ? 'green' : activity.type === 'EMAIL' ? 'blue' : 'gray'}
            >
              <div className="space-y-1">
                <div className="font-medium">{activity.title}</div>
                <div className="text-sm text-gray-600">{activity.description}</div>
                <div className="flex items-center space-x-2">
                  <Avatar size="small" icon={<EditOutlined />} />
                  <span className="text-xs text-gray-500">
                    {activity.creator?.firstName} {activity.creator?.lastName} •
                    {new Date(activity.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </Timeline.Item>
          ))}
        </Timeline>
      </Card>

      {/* Actions */}
      {deal.stage?.name !== 'CLOSED_WON' && deal.stage?.name !== 'CLOSED_LOST' && (
        <Card>
          <Title level={4}>Deal Actions</Title>
          <Space>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleCloseWon}
            >
              Close as Won
            </Button>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              onClick={handleCloseLost}
            >
              Close as Lost
            </Button>
          </Space>
        </Card>
      )}

      {/* Add Activity Modal */}
      <Modal
        title="Add Activity"
        open={activityModalVisible}
        onCancel={() => setActivityModalVisible(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddActivity}>
          <Form.Item
            label="Activity Type"
            name="type"
            rules={[{ required: true, message: 'Please select activity type' }]}
          >
            <Select placeholder="Select activity type">
              <Select.Option value="CALL">Phone Call</Select.Option>
              <Select.Option value="EMAIL">Email</Select.Option>
              <Select.Option value="MEETING">Meeting</Select.Option>
              <Select.Option value="NOTE">Note</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Please enter activity title' }]}
          >
            <Input placeholder="Enter activity title" />
          </Form.Item>

          <Form.Item
            label="Description"
            name="description"
          >
            <TextArea rows={4} placeholder="Enter activity description" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Add Activity
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealDetail;