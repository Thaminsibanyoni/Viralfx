import React, { useEffect } from 'react';
import {
  Form, Input, Select, InputNumber, Switch, Button, Space, Row, Col, Divider, Typography, Card, message, } from 'antd';
import {
  BankOutlined, SafetyCertificateOutlined, DollarOutlined, } from '@ant-design/icons';
import { BrokerAccount } from '../../services/api/crm.api';

const {Title} = Typography;
const {Option} = Select;

interface BrokerFormProps {
  initialValues?: Partial<BrokerAccount>;
  onSubmit: (values: Partial<BrokerAccount>) => void;
  loading?: boolean;
}

const BrokerForm: React.FC<BrokerFormProps> = ({
  initialValues,
  onSubmit,
  loading = false,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  const handleSubmit = (values: any) => {
    onSubmit(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        accountType: 'INDIVIDUAL',
        fscaVerified: false,
        vatRegistered: false,
        status: 'ACTIVE',
        riskRating: 'MEDIUM',
        complianceStatus: 'PENDING',
        creditLimit: 0,
        paymentTerms: 30,
      }}
    >
      <div className="space-y-6">
        {/* Account Information */}
        <Card>
          <Title level={4}>
            <BankOutlined /> Account Information
          </Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Account Type"
                name="accountType"
                rules={[{ required: true, message: 'Please select account type' }]}
              >
                <Select placeholder="Select account type">
                  <Option value="INDIVIDUAL">Individual</Option>
                  <Option value="CORPORATE">Corporate</Option>
                  <Option value="PARTNERSHIP">Partnership</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Status"
                name="status"
                rules={[{ required: true, message: 'Please select status' }]}
              >
                <Select placeholder="Select status">
                  <Option value="ACTIVE">Active</Option>
                  <Option value="INACTIVE">Inactive</Option>
                  <Option value="PENDING">Pending</Option>
                  <Option value="SUSPENDED">Suspended</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Business Number"
                name="businessNumber"
              >
                <Input placeholder="Enter business registration number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Tax Number"
                name="taxNumber"
              >
                <Input placeholder="Enter tax identification number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="VAT Registered"
                name="vatRegistered"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="VAT Number"
            name="vatNumber"
          >
            <Input placeholder="Enter VAT number" />
          </Form.Item>
        </Card>

        {/* Banking Information */}
        <Card>
          <Title level={4}>
            <BankOutlined /> Banking Information
          </Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Bank Name"
                name="bankName"
              >
                <Input placeholder="Enter bank name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Account Type"
                name="bankAccountType"
              >
                <Select placeholder="Select account type">
                  <Option value="CHEQUE">Cheque</Option>
                  <Option value="SAVINGS">Savings</Option>
                  <Option value="BUSINESS">Business</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Account Number"
                name="bankAccountNumber"
              >
                <Input placeholder="Enter account number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Branch Code"
                name="bankBranchCode"
              >
                <Input placeholder="Enter branch code" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="SWIFT Code"
                name="swiftCode"
              >
                <Input placeholder="Enter SWIFT code" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Compliance Information */}
        <Card>
          <Title level={4}>
            <SafetyCertificateOutlined /> Compliance Information
          </Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="FSCA Verified"
                name="fscaVerified"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Risk Rating"
                name="riskRating"
                rules={[{ required: true, message: 'Please select risk rating' }]}
              >
                <Select placeholder="Select risk rating">
                  <Option value="LOW">Low</Option>
                  <Option value="MEDIUM">Medium</Option>
                  <Option value="HIGH">High</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Compliance Status"
                name="complianceStatus"
                rules={[{ required: true, message: 'Please select compliance status' }]}
              >
                <Select placeholder="Select compliance status">
                  <Option value="PENDING">Pending</Option>
                  <Option value="APPROVED">Approved</Option>
                  <Option value="SUSPENDED">Suspended</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Financial Information */}
        <Card>
          <Title level={4}>
            <DollarOutlined /> Financial Information
          </Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Credit Limit"
                name="creditLimit"
                rules={[{ required: true, message: 'Please enter credit limit' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                  min={0}
                  step={1000}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Payment Terms (Days)"
                name="paymentTerms"
                rules={[{ required: true, message: 'Please enter payment terms' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={365}
                  placeholder="Enter payment terms in days"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2">
          <Button onClick={() => form.resetFields()}>
            Reset
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? 'Update Broker' : 'Create Broker'}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default BrokerForm;