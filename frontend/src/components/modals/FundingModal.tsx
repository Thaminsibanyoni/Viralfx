import React, { useState } from 'react';
import {
  Modal, Form, Input, Select, InputNumber, Button, Radio, Space, Typography, Alert, Steps, Row, Col, Card, Divider, Tag, Tooltip, } from 'antd';
import {
  BankOutlined, CreditCardOutlined, MobileOutlined, QrcodeOutlined, WalletOutlined, CheckCircleOutlined, InfoCircleOutlined, ArrowRightOutlined, } from '@ant-design/icons';
import { toast } from 'react-hot-toast';

const {Title, Text} = Typography;
const {Option} = Select;
const {Step} = Steps;

interface FundingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (transaction: any) => void;
  type: 'deposit' | 'withdrawal';
}

const FundingModal: React.FC<FundingModalProps> = ({
  visible,
  onClose,
  onSuccess,
  type,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [transactionData, setTransactionData] = useState<any>(null);

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  const paymentMethods = [
    {
      key: 'bank_transfer',
      name: 'Bank Transfer (EFT)',
      icon: <BankOutlined style={{ fontSize: '24px' }} />,
      description: 'Direct bank transfer from your South African bank account',
      processingTime: '1-2 business days',
      minAmount: 100,
      maxAmount: 500000,
      fees: 'Free',
    },
    {
      key: 'card_payment',
      name: 'Credit/Debit Card',
      icon: <CreditCardOutlined style={{ fontSize: '24px' }} />,
      description: 'Instant payment using Visa or Mastercard',
      processingTime: 'Instant',
      minAmount: 50,
      maxAmount: 100000,
      fees: '2.5%',
    },
    {
      key: 'ozow',
      name: 'OZOW Instant EFT',
      icon: <MobileOutlined style={{ fontSize: '24px' }} />,
      description: 'Instant EFT payment through OZOW',
      processingTime: 'Instant',
      minAmount: 50,
      maxAmount: 200000,
      fees: '1.5%',
    },
    {
      key: 'crypto',
      name: 'Cryptocurrency',
      icon: <QrcodeOutlined style={{ fontSize: '24px' }} />,
      description: 'Deposit using Bitcoin or Ethereum',
      processingTime: '10-30 minutes',
      minAmount: 500,
      maxAmount: 1000000,
      fees: 'Network fees',
    },
  ];

  const currencies = [
    { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BTC', symbol: '₿', name: 'Bitcoin' },
    { code: 'ETH', symbol: 'Ξ', name: 'Ethereum' },
  ];

  const withdrawalMethods = [
    {
      key: 'bank_transfer',
      name: 'Bank Transfer (EFT)',
      icon: <BankOutlined style={{ fontSize: '24px' }} />,
      description: 'Withdraw directly to your South African bank account',
      processingTime: '1-2 business days',
      minAmount: 500,
      maxAmount: 500000,
      fees: 'R50 + 1%',
    },
    {
      key: 'crypto',
      name: 'Cryptocurrency',
      icon: <QrcodeOutlined style={{ fontSize: '24px' }} />,
      description: 'Withdraw to your crypto wallet',
      processingTime: '10-30 minutes',
      minAmount: 1000,
      maxAmount: 1000000,
      fees: 'Network fees',
    },
  ];

  const methods = type === 'deposit' ? paymentMethods : withdrawalMethods;

  const handleMethodSelect = (methodKey: string) => {
    setSelectedMethod(methodKey);
    setCurrentStep(1);
  };

  const handleFormSubmit = async (values: any) => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const transaction = {
        id: `TXN${Date.now()}`,
        type,
        method: selectedMethod,
        amount: values.amount,
        currency: values.currency,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      setTransactionData(transaction);
      setCurrentStep(2);
      toast.success(`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} request submitted successfully!`);
    } catch (error) {
      toast.error('Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    onSuccess(transactionData);
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(0);
    setSelectedMethod('');
    setTransactionData(null);
    form.resetFields();
    onClose();
  };

  const renderMethodSelection = () => (
    <div>
      <Title level={4} style={{ marginBottom: '24px', color: viralFxColors.textPrimary }}>
        Choose {type === 'deposit' ? 'Deposit' : 'Withdrawal'} Method
      </Title>
      <Row gutter={[16, 16]}>
        {methods.map((method) => (
          <Col xs={24} sm={12} key={method.key}>
            <Card
              hoverable
              onClick={() => handleMethodSelect(method.key)}
              style={{
                border: `2px solid ${viralFxColors.borderDefault}`,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: viralFxColors.primaryPurple, marginBottom: '12px' }}>
                  {method.icon}
                </div>
                <Title level={5} style={{ margin: '8px 0', color: viralFxColors.textPrimary }}>
                  {method.name}
                </Title>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {method.description}
                </Text>
                <div style={{ marginTop: '12px' }}>
                  <Space direction="vertical" size="small">
                    <div>
                      <Tag color="blue">{method.processingTime}</Tag>
                    </div>
                    <div style={{ fontSize: '12px', color: viralFxColors.textSecondary }}>
                      Min: R{method.minAmount.toLocaleString()} | Max: R{method.maxAmount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: viralFxColors.textSecondary }}>
                      Fees: {method.fees}
                    </div>
                  </Space>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  const renderTransactionForm = () => {
    const selectedMethodData = methods.find(m => m.key === selectedMethod);

    return (
      <div>
        <Title level={4} style={{ marginBottom: '24px', color: viralFxColors.textPrimary }}>
          Enter {type === 'deposit' ? 'Deposit' : 'Withdrawal'} Details
        </Title>

        <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: `${viralFxColors.primaryPurple}10`, borderRadius: '8px' }}>
          <Space>
            <div style={{ color: viralFxColors.primaryPurple, fontSize: '20px' }}>
              {selectedMethodData?.icon}
            </div>
            <div>
              <Text strong style={{ color: viralFxColors.textPrimary }}>
                {selectedMethodData?.name}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '14px' }}>
                {selectedMethodData?.description}
              </Text>
            </div>
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{ currency: 'ZAR' }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Currency"
                name="currency"
                rules={[{ required: true, message: 'Please select currency' }]}
              >
                <Select>
                  {currencies.map((currency) => (
                    <Option key={currency.code} value={currency.code}>
                      <Space>
                        <span>{currency.symbol}</span>
                        <span>{currency.code} - {currency.name}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Amount"
                name="amount"
                rules={[
                  { required: true, message: 'Please enter amount' },
                  { type: 'number', min: selectedMethodData?.minAmount, message: `Minimum amount is R${selectedMethodData?.minAmount}` },
                  { type: 'number', max: selectedMethodData?.maxAmount, message: `Maximum amount is R${selectedMethodData?.maxAmount}` },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={selectedMethodData?.minAmount}
                  max={selectedMethodData?.maxAmount}
                  formatter={value => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value!.replace(/R\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          {type === 'withdrawal' && selectedMethod === 'bank_transfer' && (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Bank Name"
                  name="bankName"
                  rules={[{ required: true, message: 'Please enter bank name' }]}
                >
                  <Select placeholder="Select your bank">
                    <Option value="fnb">First National Bank (FNB)</Option>
                    <Option value="standard">Standard Bank</Option>
                    <Option value="absa">ABSA Bank</Option>
                    <Option value="nedbank">Nedbank</Option>
                    <Option value="capitec">Capitec Bank</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Account Number"
                  name="accountNumber"
                  rules={[{ required: true, message: 'Please enter account number' }]}
                >
                  <Input placeholder="Enter your account number" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Alert
            message={`${type === 'deposit' ? 'Deposit' : 'Withdrawal'} Information`}
            description={
              <div>
                <p>• Processing time: {selectedMethodData?.processingTime}</p>
                <p>• Fees: {selectedMethodData?.fees}</p>
                {type === 'deposit' && (
                  <p>• Funds will be available immediately after confirmation for most methods</p>
                )}
                {type === 'withdrawal' && (
                  <p>• Withdrawals will be processed within 24 hours during business days</p>
                )}
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: '24px', backgroundColor: `${viralFxColors.primaryPurple}10`, borderColor: viralFxColors.primaryPurple }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={handleClose}>
              Cancel
            </Button>
            <Space>
              <Button onClick={() => setCurrentStep(0)}>
                Back
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{
                  backgroundColor: viralFxColors.primaryPurple,
                  borderColor: viralFxColors.primaryPurple,
                }}
              >
                {type === 'deposit' ? 'Deposit' : 'Withdraw'} R{form.getFieldValue('amount') || '0'}
              </Button>
            </Space>
          </div>
        </Form>
      </div>
    );
  };

  const renderConfirmation = () => (
    <div style={{ textAlign: 'center' }}>
      <CheckCircleOutlined style={{ fontSize: '64px', color: viralFxColors.successGreen, marginBottom: '24px' }} />

      <Title level={4} style={{ color: viralFxColors.textPrimary, marginBottom: '16px' }}>
        {type === 'deposit' ? 'Deposit' : 'Withdrawal'} Request Submitted!
      </Title>

      <Text type="secondary" style={{ fontSize: '16px', marginBottom: '32px', display: 'block' }}>
        Your transaction has been submitted and is being processed.
      </Text>

      {transactionData && (
        <Card
          style={{
            maxWidth: '400px',
            margin: '0 auto',
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '8px',
          }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Transaction ID:</Text>
              <Text strong>{transactionData.id}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Type:</Text>
              <Tag color={type === 'deposit' ? 'green' : 'orange'}>
                {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </Tag>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Amount:</Text>
              <Text strong style={{ color: viralFxColors.successGreen }}>
                {transactionData.currency} {transactionData.amount.toLocaleString()}
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Status:</Text>
              <Tag color="blue">Pending</Tag>
            </div>
          </Space>
        </Card>
      )}

      <div style={{ marginTop: '32px' }}>
        <Button
          type="primary"
          size="large"
          onClick={handleFinalize}
          style={{
            backgroundColor: viralFxColors.primaryPurple,
            borderColor: viralFxColors.primaryPurple,
            minWidth: '150px',
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      title={
        <Space>
          <WalletOutlined style={{ color: viralFxColors.accentGold }} />
          <span>{type === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={800}
      style={{ top: 20 }}
    >
      <Steps current={currentStep} style={{ marginBottom: '32px' }}>
        <Step title="Select Method" icon={<BankOutlined />} />
        <Step title="Enter Details" icon={<WalletOutlined />} />
        <Step title="Confirmation" icon={<CheckCircleOutlined />} />
      </Steps>

      {currentStep === 0 && renderMethodSelection()}
      {currentStep === 1 && renderTransactionForm()}
      {currentStep === 2 && renderConfirmation()}
    </Modal>
  );
};

export default FundingModal;