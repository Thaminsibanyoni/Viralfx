import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Form,
  InputNumber,
  Button,
  Radio,
  Space,
  Alert,
  Divider,
  Steps,
  AlertProps,
  message,
  Spin
} from 'antd';
import {
  WalletOutlined,
  CreditCardOutlined,
  BankOutlined,
  LockOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { walletApi } from '../../services/api/wallet.api';

const { Title, Text, Paragraph } = Typography;

interface DepositFormData {
  amount: number;
  currency: string;
  gateway: 'payfast' | 'paystack' | 'ozow';
}

const DepositPage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [depositData, setDepositData] = useState<DepositFormData | null>(null);

  const MINIMUM_AMOUNT = 1000;
  const RECOMMENDED_AMOUNTS = [1000, 2500, 5000, 10000, 25000];

  const depositMutation = useMutation({
    mutationFn: (data: DepositFormData) =>
      walletApi.initiateDeposit(data.amount, data.currency, data.gateway),
    onSuccess: (response) => {
      message.success('Deposit initiated successfully!');
      // Redirect to payment gateway
      if (response.checkoutUrl) {
        window.location.href = response.checkoutUrl;
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to initiate deposit');
    }
  });

  const handleAmountSelect = (amount: number) => {
    form.setFieldValue('amount', amount);
  };

  const onFinish = (values: DepositFormData) => {
    if (values.amount < MINIMUM_AMOUNT) {
      message.error(`Minimum deposit amount is R${MINIMUM_AMOUNT.toLocaleString()}`);
      return;
    }

    setDepositData(values);
    setCurrentStep(1);

    // Auto-submit after review
    setTimeout(() => {
      handleDepositConfirm(values);
    }, 2000);
  };

  const handleDepositConfirm = (values: DepositFormData) => {
    depositMutation.mutate(values);
  };

  const gatewayInfo = {
    payfast: {
      name: 'PayFast',
      icon: '💳',
      description: 'South Africa\'s leading payment gateway',
      features: ['Instant EFT', 'Credit Card', 'Debit Card', 'Instant clearance'],
      color: '#FFB300',
      recommended: true
    },
    paystack: {
      name: 'PayStack',
      icon: '🌍',
      description: 'Pan-African payment processor',
      features: ['Credit Card', 'Debit Card', 'Bank Transfer', 'USSD'],
      color: '#4B0082'
    },
    ozow: {
      name: 'Ozow',
      icon: '🏦',
      description: 'Instant EFT payment provider',
      features: ['Instant EFT', 'No card needed', 'Direct bank transfer'],
      color: '#00A651'
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-purple-50/50 to-amber-50/30 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Title level={2} className="text-purple-900">
            <WalletOutlined className="mr-2" />
            Deposit Funds
          </Title>
          <Paragraph className="text-gray-600 text-lg">
            Add funds to your wallet to start trading. Minimum deposit: <Text strong>R{MINIMUM_AMOUNT.toLocaleString()}</Text>
          </Paragraph>
        </div>

        {/* Security Notice */}
        <Alert
          message="Secure Payment"
          description="All transactions are encrypted and secure. We use industry-leading payment gateways to protect your financial information."
          type="info"
          showIcon
          icon={<LockOutlined />}
          className="mb-6 border-l-4 border-l-purple-600"
        />

        <Row gutter={[24, 24]}>
          {/* Main Form */}
          <Col xs={24} lg={16}>
            <Card className="shadow-lg rounded-xl">
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{
                  currency: 'ZAR',
                  gateway: 'payfast'
                }}
              >
                {/* Amount Section */}
                <Title level={4} className="mb-4">
                  <CreditCardOutlined className="mr-2" />
                  Deposit Amount
                </Title>

                {/* Quick Amount Selection */}
                <div className="mb-4">
                  <Text strong className="block mb-2">Quick Select:</Text>
                  <Space wrap>
                    {RECOMMENDED_AMOUNTS.map((amount) => (
                      <Button
                        key={amount}
                        type={form.getFieldValue('amount') === amount ? 'primary' : 'default'}
                        onClick={() => handleAmountSelect(amount)}
                        className={form.getFieldValue('amount') === amount ? 'bg-purple-600' : ''}
                      >
                        R{amount.toLocaleString()}
                      </Button>
                    ))}
                  </Space>
                </div>

                <Form.Item
                  label="Deposit Amount (ZAR)"
                  name="amount"
                  rules={[
                    { required: true, message: 'Please enter deposit amount' },
                    {
                      type: 'number',
                      min: MINIMUM_AMOUNT,
                      message: `Minimum deposit is R${MINIMUM_AMOUNT.toLocaleString()}`
                    }
                  ]}
                >
                  <InputNumber
                    prefix="R"
                    size="large"
                    min={MINIMUM_AMOUNT}
                    max={1000000}
                    className="w-full"
                    placeholder={`Enter amount (min R${MINIMUM_AMOUNT.toLocaleString()})`}
                    formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value: any) => value?.replace(/R\s?|(,*)/g, '')}
                  />
                </Form.Item>

                <Form.Item
                  label="Currency"
                  name="currency"
                >
                  <Radio.Group size="large" className="w-full">
                    <Radio.Button value="ZAR" className="w-full">
                      ZAR - South African Rand
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Divider />

                {/* Payment Gateway Selection */}
                <Title level={4} className="mb-4">
                  <BankOutlined className="mr-2" />
                  Select Payment Gateway
                </Title>

                <Form.Item
                  name="gateway"
                  label="Payment Method"
                  rules={[{ required: true, message: 'Please select a payment gateway' }]}
                >
                  <Radio.Group className="w-full">
                    <Space direction="vertical" className="w-full" size="middle">
                      {Object.entries(gatewayInfo).map(([key, info]) => (
                        <Card
                          key={key}
                          hoverable
                          className={form.getFieldValue('gateway') === key ? 'border-purple-600 border-2' : ''}
                          onClick={() => form.setFieldValue('gateway', key)}
                        >
                          <Radio value={key} className="w-full">
                            <Row gutter={16} align="middle">
                              <Col span={2}>
                                <span style={{ fontSize: '32px' }}>{info.icon}</span>
                              </Col>
                              <Col span={16}>
                                <div className="flex items-center">
                                  <Text strong className="text-lg mr-2">
                                    {info.name}
                                  </Text>
                                  {info.recommended && (
                                    <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <Text type="secondary" className="text-sm">
                                  {info.description}
                                </Text>
                              </Col>
                              <Col span={6} className="text-right">
                                {info.features.slice(0, 2).map((feature, idx) => (
                                  <div key={idx} className="text-xs text-gray-500">
                                    {feature}
                                  </div>
                                ))}
                              </Col>
                            </Row>
                          </Radio>
                        </Card>
                      ))}
                    </Space>
                  </Radio.Group>
                </Form.Item>

                {/* Submit Button */}
                <Form.Item className="mb-0">
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={depositMutation.isPending}
                    disabled={depositMutation.isPending}
                    block
                    className="h-12 text-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                  >
                    {depositMutation.isPending ? (
                      <>
                        <Spin size="small" className="mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Proceed to Payment
                        <ArrowRightOutlined className="ml-2" />
                      </>
                    )}
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>

          {/* Sidebar Info */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" size="large" className="w-full">
              {/* Minimum Deposit Notice */}
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <InfoCircleOutlined className="text-2xl text-purple-600 mb-2" />
                <Title level={5} className="mb-2">Minimum Deposit</Title>
                <Paragraph className="mb-0">
                  <Text strong className="text-purple-900">R{MINIMUM_AMOUNT.toLocaleString()}</Text>
                  <br />
                  <Text type="secondary" className="text-sm">
                    This minimum ensures you have sufficient funds to actively trade on the platform.
                  </Text>
                </Paragraph>
              </Card>

              {/* Why Deposit */}
              <Card>
                <CheckCircleOutlined className="text-2xl text-green-600 mb-2" />
                <Title level={5} className="mb-3">Why Deposit?</Title>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <CheckCircleOutlined className="text-green-500 mr-2 mt-1" />
                    <span>Start trading immediately</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleOutlined className="text-green-500 mr-2 mt-1" />
                    <span>Access all trading features</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleOutlined className="text-green-500 mr-2 mt-1" />
                    <span>Instant deposits via PayFast</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleOutlined className="text-green-500 mr-2 mt-1" />
                    <span>Secure & encrypted transactions</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircleOutlined className="text-green-500 mr-2 mt-1" />
                    <span>No deposit fees</span>
                  </li>
                </ul>
              </Card>

              {/* Payment Security */}
              <Card className="bg-gray-50">
                <LockOutlined className="text-2xl text-gray-600 mb-2" />
                <Title level={5} className="mb-3">Payment Security</Title>
                <Paragraph className="text-sm text-gray-600 mb-0">
                  Your payment information is encrypted and secure. We comply with PCI DSS standards
                  and never store your complete card details.
                </Paragraph>
              </Card>

              {/* Support */}
              <Card>
                <Title level={5} className="mb-2">Need Help?</Title>
                <Paragraph className="text-sm mb-0">
                  Contact our support team if you have any questions about deposits or payments.
                </Paragraph>
                <Button type="link" className="p-0">
                  Contact Support →
                </Button>
              </Card>
            </Space>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default DepositPage;
