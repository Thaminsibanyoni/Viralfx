import React, { useEffect } from 'react';
import {
  Form, Input, Select, Switch, Button, Space, Row, Col, Typography, Card, } from 'antd';
import { ClientRecord } from '../../services/api/crm.api';

const {Title} = Typography;
const {Option} = Select;

interface ClientFormProps {
  initialValues?: Partial<ClientRecord>;
  onSubmit: (values: Partial<ClientRecord>) => void;
  loading?: boolean;
}

const ClientForm: React.FC<ClientFormProps> = ({
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
        segment: 'STANDARD',
        preferredContact: 'EMAIL',
        marketingConsent: false,
        newsletterConsent: true,
      }}
    >
      <div className="space-y-6">
        {/* Client Information */}
        <Card>
          <Title level={4}>Client Information</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="First Name"
                name={['user', 'firstName']}
                rules={[{ required: true, message: 'Please enter first name' }]}
              >
                <Input placeholder="Enter first name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Last Name"
                name={['user', 'lastName']}
                rules={[{ required: true, message: 'Please enter last name' }]}
              >
                <Input placeholder="Enter last name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name={['user', 'email']}
                rules={[
                  { required: true, message: 'Please enter email' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Phone"
                name={['user', 'phone']}
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Country"
                name={['user', 'country']}
              >
                <Select placeholder="Select country">
                  <Option value="US">United States</Option>
                  <Option value="GB">United Kingdom</Option>
                  <Option value="ZA">South Africa</Option>
                  <Option value="NG">Nigeria</Option>
                  <Option value="KE">Kenya</Option>
                  <Option value="CA">Canada</Option>
                  <Option value="AU">Australia</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Segment"
                name="segment"
                rules={[{ required: true, message: 'Please select segment' }]}
              >
                <Select placeholder="Select segment">
                  <Option value="STANDARD">Standard</Option>
                  <Option value="ACTIVE">Active</Option>
                  <Option value="VIP">VIP</Option>
                  <Option value="DORMANT">Dormant</Option>
                  <Option value="HIGH_RISK">High Risk</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Acquisition Information */}
        <Card>
          <Title level={4}>Acquisition Information</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Source"
                name="source"
              >
                <Select placeholder="Select source">
                  <Option value="ORGANIC">Organic</Option>
                  <Option value="REFERRAL">Referral</Option>
                  <Option value="ADVERTISING">Advertising</Option>
                  <Option value="PARTNER">Partner</Option>
                  <Option value="BROKER">Broker</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Campaign"
                name="campaign"
              >
                <Input placeholder="Enter campaign name" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Communication Preferences */}
        <Card>
          <Title level={4}>Communication Preferences</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                label="Preferred Contact"
                name="preferredContact"
                rules={[{ required: true, message: 'Please select preferred contact' }]}
              >
                <Select placeholder="Select preferred contact">
                  <Option value="EMAIL">Email</Option>
                  <Option value="SMS">SMS</Option>
                  <Option value="PHONE">Phone</Option>
                  <Option value="WHATSAPP">WhatsApp</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Marketing Consent"
                name="marketingConsent"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                label="Newsletter Consent"
                name="newsletterConsent"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <Title level={4}>Risk Assessment</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Risk Score"
                name="riskScore"
              >
                <Select placeholder="Select risk score">
                  <Option value={1}>Low (1.0)</Option>
                  <Option value={2}>Medium-Low (2.0)</Option>
                  <Option value={3}>Medium (3.0)</Option>
                  <Option value={3.5}>Medium-High (3.5)</Option>
                  <Option value={4}>High (4.0)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Risk Factors"
                name="riskFactors"
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Describe risk factors (e.g., high volatility trading, large positions, etc.)"
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Custom Fields */}
        <Card>
          <Title level={4}>Additional Information</Title>
          <Form.Item
            label="Custom Fields"
            name="customFields"
          >
            <Input.TextArea
              rows={4}
              placeholder="Enter any additional client information or custom field data (JSON format)"
            />
          </Form.Item>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2">
          <Button onClick={() => form.resetFields()}>
            Reset
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialValues ? 'Update Client' : 'Create Client'}
          </Button>
        </div>
      </div>
    </Form>
  );
};

export default ClientForm;