import React from 'react';
import {
  Modal, Form, Select, InputNumber, message, Space, Typography, Alert, Row, Col, Card, Statistic, } from 'antd';
import {
  TrophyOutlined, CheckCircleOutlined, ArrowUpOutlined, } from '@ant-design/icons';

const {Option} = Select;
const {Title, Text} = Typography;

interface TierUpgradeModalProps {
  visible: boolean;
  broker: any;
  onOk: (values: any) => void;
  onCancel: () => void;
  loading?: boolean;
}

const TierUpgradeModal: React.FC<TierUpgradeModalProps> = ({
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

  const tierBenefits = {
    bronze: { clients: 50, volume: 1000000, commission: 15 },
    silver: { clients: 200, volume: 5000000, commission: 20 },
    gold: { clients: 500, volume: 15000000, commission: 25 },
    platinum: { clients: 1000, volume: 50000000, commission: 30 },
  };

  const getCurrentTier = () => tierBenefits[broker.tier as keyof typeof tierBenefits] || tierBenefits.bronze;

  return (
    <Modal
      title={
        <Space>
          <TrophyOutlined />
          <Title level={4} style={{ margin: 0 }}>
            Tier Upgrade Request
          </Title>
        </Space>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="Upgrade Tier"
      cancelText="Cancel"
      width={800}
    >
      {broker && (
        <div style={{ marginBottom: 24 }}>
          <Alert
            message={`Current Tier: ${broker.tier.toUpperCase()}`}
            description={`Review broker performance and criteria for tier upgrade`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Current Clients"
                  value={broker.totalClients}
                  suffix={`/ ${getCurrentTier().clients}+`}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Monthly Volume"
                  value={broker.monthlyVolume}
                  formatter={(value) => `$${(Number(value) / 1000000).toFixed(2)}M`}
                  suffix={`/ $${(getCurrentTier().volume / 1000000).toFixed(1)}M+`}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Success Rate"
                  value={broker.successRate}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          newTier: broker.tier === 'bronze' ? 'silver' :
                  broker.tier === 'silver' ? 'gold' :
                  broker.tier === 'gold' ? 'platinum' : 'platinum',
          newCommissionRate: broker.commissionRate + 5,
        }}
      >
        <Form.Item
          label="New Tier"
          name="newTier"
          rules={[{ required: true, message: 'Please select new tier' }]}
        >
          <Select placeholder="Select new tier">
            <Option value="silver">Silver Tier</Option>
            <Option value="gold">Gold Tier</Option>
            <Option value="platinum">Platinum Tier</Option>
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.newTier !== currentValues.newTier
          }
        >
          {({ getFieldValue }) => {
            const newTier = getFieldValue('newTier');
            const benefits = tierBenefits[newTier as keyof typeof tierBenefits];

            return benefits ? (
              <Alert
                message="New Tier Benefits"
                description={
                  <div>
                    <p>• Minimum Clients: {benefits.clients}</p>
                    <p>• Required Monthly Volume: ${(benefits.volume / 1000000).toFixed(1)}M</p>
                    <p>• Commission Rate: {benefits.commission}%</p>
                  </div>
                }
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
              />
            ) : null;
          }}
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="New Commission Rate (%)"
              name="newCommissionRate"
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
          <Col span={12}>
            <Form.Item
              label="New Credit Limit"
              name="newCreditLimit"
            >
              <InputNumber
                style={{ width: '100%' }}
                formatter={(value) => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/\$\s?|(,*)/g, '')}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Upgrade Reason"
          name="reason"
          rules={[{ required: true, message: 'Please provide upgrade reason' }]}
        >
          <Select placeholder="Select reason for upgrade">
            <Option value="performance_consistent">Consistent Performance</Option>
            <Option value="client_growth">Significant Client Growth</Option>
            <Option value="volume_increase">High Volume Achievement</Option>
            <Option value="compliance_excellent">Excellent Compliance Record</Option>
            <Option value="special_request">Special Request</Option>
            <Option value="other">Other</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Additional Notes"
          name="notes"
        >
          <Select placeholder="Additional benefits or notes">
            <Option value="priority_support">Priority Customer Support</Option>
            <Option value="marketing_budget">Increased Marketing Budget</Option>
            <Option value="dedicated_manager">Dedicated Account Manager</Option>
            <Option value="advanced_analytics">Advanced Analytics Access</Option>
            <Option value="custom_branding">Custom Branding Options</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Effective Date"
          name="effectiveDate"
          initialValue="immediate"
        >
          <Select placeholder="When should upgrade take effect?">
            <Option value="immediate">Immediate</Option>
            <Option value="next_month">Start of Next Month</Option>
            <Option value="quarter_start">Start of Next Quarter</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="notifyBroker"
          valuePropName="checked"
          initialValue={true}
        >
          <Select>
            <Option value="true">Notify broker about upgrade</Option>
            <Option value="false">Keep upgrade confidential</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TierUpgradeModal;