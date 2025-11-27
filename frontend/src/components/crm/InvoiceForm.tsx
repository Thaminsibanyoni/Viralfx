import React from 'react';
import { Form, Input, Select, InputNumber, DatePicker, Button } from 'antd';

const {Option} = Select;

interface InvoiceFormProps {
  initialValues?: any;
  onSubmit: (values: any) => void;
  loading?: boolean;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({
  initialValues,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={initialValues}
    >
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
        label="Subscription Fee"
        name="subscriptionFee"
        rules={[{ required: true, message: 'Please enter subscription fee' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
          min={0}
        />
      </Form.Item>

      <Form.Item
        label="Period Start"
        name="periodStart"
        rules={[{ required: true, message: 'Please select period start date' }]}
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="Period End"
        name="periodEnd"
        rules={[{ required: true, message: 'Please select period end date' }]}
      >
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label="Notes"
        name="notes"
      >
        <Input.TextArea rows={3} placeholder="Enter invoice notes" />
      </Form.Item>

      <div className="flex justify-end space-x-2">
        <Button onClick={() => form.resetFields()}>
          Reset
        </Button>
        <Button type="primary" htmlType="submit" loading={loading}>
          Generate Invoice
        </Button>
      </div>
    </Form>
  );
};

export default InvoiceForm;