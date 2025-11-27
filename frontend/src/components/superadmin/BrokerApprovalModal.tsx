import React from 'react';
import {
  Modal, Form, Input, Select, InputNumber, message, Space, Typography, Alert, Checkbox, Row, Col, Card, } from 'antd';
import {
  CheckCircleOutlined, ExclamationCircleOutlined, TeamOutlined, } from '@ant-design/icons';

const {TextArea} = Input;
const {Option} = Select;
const {Title, Text} = Typography;

interface BrokerApprovalModalProps {
  visible: boolean;
  broker: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const BrokerApprovalModal: React.FC<BrokerApprovalModalProps> = ({
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
          <TeamOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Broker Application Review
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Submit Decision"
      cancelText="Cancel"
      width={700}
    >
      {broker && (
        <div style={{ marginBottom: 24, padding: 16, backgroundColor: '#f6ffed', borderRadius: 8, border: '1px solid #b7eb8f' }}>
          <Text strong>Broker Application:</Text>
          <div style={{ marginTop: 8 }}>
            <Text>Company: {broker.companyName}</Text><br />
            <Text>Contact: {broker.email}</Text><br />
            <Text>Application Date: {new Date(broker.createdAt).toLocaleDateString()}</Text>
          </div>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          decision: 'approved',
          tier: 'bronze',
          commissionRate: 15,
        }}
      >
        <Form.Item
          label="Application Decision"
          name="decision"
          rules={[{ required: true, message: 'Please select decision' }]}
        >
          <Select placeholder="Select decision">
            <Option value="approved">✅ Approve Application</Option>
            <Option value="rejected">❌ Reject Application</Option>
            <Option value="more_info">📋 Request More Information</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.decision !== currentValues.decision
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('decision') === 'approved' ? (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label="Initial Tier"
                      name="tier"
                      rules={[{ required: true, message: 'Please select tier' }]}
                    >
                      <Select placeholder="Select tier">
                        <Option value="bronze">Bronze Tier</Option>
                        <Option value="silver">Silver Tier</Option>
                        <Option value="gold">Gold Tier</Option>
                        <Option value="platinum">Platinum Tier</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="Commission Rate (%)"
                      name="commissionRate"
                      rules={[{ required: true, message: 'Please set commission rate' }]}
                    >
                      <InputNumber
                        min={5}
                        max={50}
                        formatter={(value) => `${value}%`}
                        parser={(value) => value!.replace('%', '')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label="Initial Credit Limit"
                  name="creditLimit"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                    placeholder="0.00"
                  />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        <Form.Item
          label="Review Comments"
          name="comments"
          rules={[
            { required: true, message: 'Please provide review comments' },
            { min: 20, message: 'Please provide at least 20 characters' }
          ]}
        >
          <TextArea
            rows={4}
            placeholder="Detailed comments about the approval decision..."
            showCount
            maxLength={1000}
          />
        </Form.Item>

        <Form.Item
          label="Internal Notes"
          name="internalNotes"
        >
          <TextArea
            rows={3}
            placeholder="Internal notes for future reference..."
            maxLength={500}
          />
        </Form.Item>

        <Form.Item
          name="notifyEmail"
          valuePropName="checked"
          initialValue={true}
        >
          <Checkbox>
            Send email notification to broker about this decision
          </Checkbox>
        </Form.Item>

        <Form.Item
          label="Reviewed By"
          name="reviewedBy"
          initialValue="System Administrator"
        >
          <Input disabled />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default BrokerApprovalModal;