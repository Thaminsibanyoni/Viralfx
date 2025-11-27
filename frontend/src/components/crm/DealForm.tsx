import React from 'react';
import { Form, Input, Select, InputNumber, DatePicker, Button, Card, Typography } from 'antd';

const {Option} = Select;
const {Title} = Typography;

interface DealFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  loading?: boolean;
  stages?: any[];
}

const DealForm: React.FC<DealFormProps> = ({
  initialValues,
  onSubmit,
  loading = false,
  stages = [],
}) => {
  const [form] = Form.useForm();

  return (
    <Card>
      <Title level={4}>
        {initialValues ? 'Edit Deal' : 'Create New Deal'}
      </Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onSubmit}
        initialValues={initialValues}
      >
        <Form.Item
          label="Deal Title"
          name="title"
          rules={[{ required: true, message: 'Please enter deal title' }]}
        >
          <Input placeholder="Enter deal title" />
        </Form.Item>

        <Form.Item
          label="Description"
          name="description"
        >
          <Input.TextArea rows={3} placeholder="Enter deal description" />
        </Form.Item>

        <Form.Item
          label="Broker"
          name="brokerId"
          rules={[{ required: true, message: 'Please select a broker' }]}
        >
          <Select placeholder="Select broker">
            <Option value="1">Sample Broker 1</Option>
            <Option value="2">Sample Broker 2</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Deal Value"
          name="value"
          rules={[{ required: true, message: 'Please enter deal value' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
            min={0}
          />
        </Form.Item>

        <Form.Item
          label="Currency"
          name="currency"
          initialValue="USD"
        >
          <Select>
            <Option value="USD">USD</Option>
            <Option value="EUR">EUR</Option>
            <Option value="GBP">GBP</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Stage"
          name="stageId"
          rules={[{ required: true, message: 'Please select a stage' }]}
        >
          <Select placeholder="Select stage">
            {stages.map((stage) => (
              <Option key={stage.id} value={stage.id}>
                {stage.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Probability"
          name="probability"
          rules={[{ required: true, message: 'Please enter probability' }]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0}
            max={100}
            formatter={(value) => `${value}%`}
            parser={(value) => value!.replace('%', '')}
          />
        </Form.Item>

        <Form.Item
          label="Expected Close Date"
          name="expectedCloseDate"
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          label="Contact Person"
          name="contactPerson"
        >
          <Input placeholder="Enter contact person name" />
        </Form.Item>

        <Form.Item
          label="Contact Email"
          name="contactEmail"
          rules={[{ type: 'email', message: 'Please enter a valid email' }]}
        >
          <Input placeholder="Enter contact email" />
        </Form.Item>

        <Form.Item
          label="Contact Phone"
          name="contactPhone"
        >
          <Input placeholder="Enter contact phone" />
        </Form.Item>

        <div className="flex justify-end space-x-2">
          <Button onClick={() => form.resetFields()}>
            Reset
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? 'Update Deal' : 'Create Deal'}
          </Button>
        </div>
      </Form>
    </Card>
  );
};

export default DealForm;