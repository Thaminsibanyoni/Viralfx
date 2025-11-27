import React, { useState, useEffect } from 'react';
import {
  Modal, Tabs, Form, Input, InputNumber, Select, Button, Space, Alert, Card, Typography, Divider, Row, Col, Steps, Result, QRCode, Spin, Badge, } from 'antd';
import {
  WalletOutlined, ArrowDownOutlined, ArrowUpOutlined, BankOutlined, CreditCardOutlined, MobileOutlined, QrcodeOutlined, CheckCircleOutlined, InfoCircleOutlined, CopyOutlined, } from '@ant-design/icons';
import { walletApi } from '../../services/api/wallet.api';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

const {Title, Text, Paragraph} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;
const {Step} = Steps;

interface FundingModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTab?: 'deposit' | 'withdraw';
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  minAmount: number;
  maxAmount: number;
  fee: number;
  processingTime: string;
}

const FundingModal: React.FC<FundingModalProps> = ({
  visible,
  onClose,
  defaultTab = 'deposit',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [depositStep, setDepositStep] = useState(0);
  const [withdrawStep, setWithdrawStep] = useState(0);
  const [transactionResult, setTransactionResult] = useState<any>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

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

  const depositMethods: PaymentMethod[] = [
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: <BankOutlined />,
      description: 'Direct bank deposit',
      minAmount: 100,
      maxAmount: 100000,
      fee: 0,
      processingTime: '1-2 business days',
    },
    {
      id: 'card_payment',
      name: 'Credit/Debit Card',
      icon: <CreditCardOutlined />,
      description: 'Instant card payment',
      minAmount: 50,
      maxAmount: 50000,
      fee: 2.5,
      processingTime: 'Instant',
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency',
      icon: <QrcodeOutlined />,
      description: 'Bitcoin, Ethereum, USDT',
      minAmount: 20,
      maxAmount: 200000,
      fee: 1,
      processingTime: '15-30 minutes',
    },
    {
      id: 'mobile_money',
      name: 'Mobile Money',
      icon: <MobileOutlined />,
      description: 'M-Pesa, Orange Money',
      minAmount: 10,
      maxAmount: 25000,
      fee: 3,
      processingTime: 'Instant',
    },
  ];

  const withdrawMethods: PaymentMethod[] = [
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      icon: <BankOutlined />,
      description: 'Direct bank withdrawal',
      minAmount: 100,
      maxAmount: 100000,
      fee: 0,
      processingTime: '2-3 business days',
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency',
      icon: <QrcodeOutlined />,
      description: 'Bitcoin, Ethereum, USDT',
      minAmount: 20,
      maxAmount: 200000,
      fee: 1,
      processingTime: '15-30 minutes',
    },
  ];

  useEffect(() => {
    if (visible) {
      setActiveTab(defaultTab);
      setDepositStep(0);
      setWithdrawStep(0);
      setTransactionResult(null);
      setQrCodeData(null);
      form.resetFields();
      loadGatewayStatus();
    }
  }, [visible, defaultTab, form]);

  const _loadGatewayStatus = async () => {
    try {
      const response = await walletApi.getGatewayStatus();
      setGatewayStatus(response.data);
    } catch (error) {
      console.error('Failed to load gateway status:', error);
    }
  };

  const handleDeposit = async (values: any) => {
    setLoading(true);
    try {
      const response = await walletApi.deposit(values);

      if (values.method === 'crypto') {
        // Generate QR code for crypto deposit
        setQrCodeData(response.data.paymentAddress);
        setDepositStep(2);
      } else if (values.method === 'card_payment') {
        // Redirect to payment gateway
        window.open(response.data.paymentUrl, '_blank');
        setDepositStep(2);
      } else {
        // Bank transfer or other methods
        setTransactionResult(response.data);
        setDepositStep(3);
      }

      toast.success('Deposit request submitted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to process deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (values: any) => {
    setLoading(true);
    try {
      const response = await walletApi.withdraw(values);
      setTransactionResult(response.data);
      setWithdrawStep(3);
      toast.success('Withdrawal request submitted successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const renderDepositSteps = () => {
    const steps = [
      {
        title: 'Select Method',
        description: 'Choose deposit method',
      },
      {
        title: 'Enter Amount',
        description: 'Specify deposit amount',
      },
      {
        title: 'Complete Payment',
        description: 'Follow payment instructions',
      },
      {
        title: 'Confirmation',
        description: 'Deposit confirmed',
      },
    ];

    return (
      <Steps current={depositStep} size="small" style={{ marginBottom: '24px' }}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} />
        ))}
      </Steps>
    );
  };

  const renderWithdrawSteps = () => {
    const steps = [
      {
        title: 'Select Method',
        description: 'Choose withdrawal method',
      },
      {
        title: 'Enter Details',
        description: 'Specify withdrawal details',
      },
      {
        title: 'Confirm',
        description: 'Review and confirm',
      },
      {
        title: 'Processing',
        description: 'Withdrawal processing',
      },
    ];

    return (
      <Steps current={withdrawStep} size="small" style={{ marginBottom: '24px' }}>
        {steps.map((step, index) => (
          <Step key={index} title={step.title} description={step.description} />
        ))}
      </Steps>
    );
  };

  const renderDepositContent = () => {
    if (depositStep === 3 && transactionResult) {
      return (
        <Result
          status="success"
          title="Deposit Request Submitted!"
          subTitle={
            <div>
              <p>Transaction ID: {transactionResult.transactionId}</p>
              <p>Amount: R{transactionResult.amount}</p>
              <p>Expected completion: {transactionResult.estimatedCompletion}</p>
            </div>
          }
          extra={[
            <Button key="view" onClick={() => window.open('/wallet/history', '_blank')}>
              View Transaction
            </Button>,
            <Button key="new" type="primary" onClick={() => setDepositStep(0)}>
              New Deposit
            </Button>,
          ]}
        />
      );
    }

    if (depositStep === 2 && qrCodeData) {
      return (
        <div style={{ textAlign: 'center' }}>
          <Title level={4}>Scan QR Code to Complete Deposit</Title>
          <Paragraph type="secondary">
            Send the exact amount to the address below
          </Paragraph>

          <div style={{ margin: '24px 0' }}>
            <QRCode value={qrCodeData} size={200} />
          </div>

          <div style={{
            background: viralFxColors.backgroundSecondary,
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            <Text code style={{ wordBreak: 'break-all' }}>{qrCodeData}</Text>
            <Button
              type="link"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(qrCodeData)}
            >
              Copy Address
            </Button>
          </div>

          <Alert
            message="Important"
            description="Please send the exact amount specified. Transactions may take 15-30 minutes to confirm."
            type="info"
            icon={<InfoCircleOutlined />}
          />
        </div>
      );
    }

    return (
      <Form form={form} onFinish={handleDeposit} layout="vertical">
        <Form.Item
          name="method"
          label="Deposit Method"
          rules={[{ required: true, message: 'Please select a deposit method' }]}
        >
          <Row gutter={[16, 16]}>
            {depositMethods.map((method) => (
              <Col xs={24} sm={12} key={method.id}>
                <Card
                  hoverable
                  onClick={() => form.setFieldsValue({ method: method.id })}
                  style={{
                    border: form.getFieldValue('method') === method.id
                      ? `2px solid ${viralFxColors.primaryPurple}`
                      : `1px solid ${viralFxColors.borderDefault}`,
                    backgroundColor: form.getFieldValue('method') === method.id
                      ? `${viralFxColors.primaryPurple}10`
                      : viralFxColors.backgroundPrimary,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {method.icon}
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      {method.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {method.description}
                    </Text>
                    <div style={{ marginTop: '8px' }}>
                      <Badge
                        count={`${method.processingTime}`}
                        style={{ backgroundColor: viralFxColors.successGreen }}
                      />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Deposit Amount (R)"
          rules={[
            { required: true, message: 'Please enter deposit amount' },
            { type: 'number', min: 1, message: 'Amount must be greater than 0' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            size="large"
            placeholder="Enter amount"
            formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value!.replace(/R\s?|(,*)/g, '')}
          />
        </Form.Item>

        {form.getFieldValue('method') && (
          <Alert
            message="Fee Information"
            description={
              <div>
                <p>Processing fee: {depositMethods.find(m => m.id === form.getFieldValue('method'))?.fee}%</p>
                <p>Total amount you'll pay: R{form.getFieldValue('amount') * (1 + (depositMethods.find(m => m.id === form.getFieldValue('method'))?.fee || 0) / 100)}</p>
              </div>
            }
            type="info"
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
              }}
            >
              Continue
            </Button>
            <Button size="large" onClick={onClose}>
              Cancel
            </Button>
          </Space>
        </Form.Item>
      </Form>
    );
  };

  const renderWithdrawContent = () => {
    if (withdrawStep === 3 && transactionResult) {
      return (
        <Result
          status="success"
          title="Withdrawal Request Submitted!"
          subTitle={
            <div>
              <p>Transaction ID: {transactionResult.transactionId}</p>
              <p>Amount: R{transactionResult.amount}</p>
              <p>Processing time: {transactionResult.processingTime}</p>
              <p>Status: {transactionResult.status}</p>
            </div>
          }
          extra={[
            <Button key="view" onClick={() => window.open('/wallet/history', '_blank')}>
              View Transaction
            </Button>,
            <Button key="new" type="primary" onClick={() => setWithdrawStep(0)}>
              New Withdrawal
            </Button>,
          ]}
        />
      );
    }

    return (
      <Form form={form} onFinish={handleWithdraw} layout="vertical">
        <Form.Item
          name="method"
          label="Withdrawal Method"
          rules={[{ required: true, message: 'Please select a withdrawal method' }]}
        >
          <Row gutter={[16, 16]}>
            {withdrawMethods.map((method) => (
              <Col xs={24} sm={12} key={method.id}>
                <Card
                  hoverable
                  onClick={() => form.setFieldsValue({ method: method.id })}
                  style={{
                    border: form.getFieldValue('method') === method.id
                      ? `2px solid ${viralFxColors.primaryPurple}`
                      : `1px solid ${viralFxColors.borderDefault}`,
                    backgroundColor: form.getFieldValue('method') === method.id
                      ? `${viralFxColors.primaryPurple}10`
                      : viralFxColors.backgroundPrimary,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                      {method.icon}
                    </div>
                    <Title level={5} style={{ margin: 0 }}>
                      {method.name}
                    </Title>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {method.description}
                    </Text>
                    <div style={{ marginTop: '8px' }}>
                      <Badge
                        count={`${method.processingTime}`}
                        style={{ backgroundColor: viralFxColors.warningOrange }}
                      />
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Form.Item>

        <Form.Item
          name="amount"
          label="Withdrawal Amount (R)"
          rules={[
            { required: true, message: 'Please enter withdrawal amount' },
            { type: 'number', min: 1, message: 'Amount must be greater than 0' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            size="large"
            placeholder="Enter amount"
            formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value!.replace(/R\s?|(,*)/g, '')}
          />
        </Form.Item>

        {form.getFieldValue('method') === 'bank_transfer' && (
          <>
            <Form.Item
              name="bankName"
              label="Bank Name"
              rules={[{ required: true, message: 'Please enter bank name' }]}
            >
              <Input placeholder="Enter bank name" />
            </Form.Item>
            <Form.Item
              name="accountNumber"
              label="Account Number"
              rules={[{ required: true, message: 'Please enter account number' }]}
            >
              <Input placeholder="Enter account number" />
            </Form.Item>
            <Form.Item
              name="accountHolder"
              label="Account Holder Name"
              rules={[{ required: true, message: 'Please enter account holder name' }]}
            >
              <Input placeholder="Enter account holder name" />
            </Form.Item>
          </>
        )}

        {form.getFieldValue('method') === 'crypto' && (
          <>
            <Form.Item
              name="cryptoAddress"
              label="Cryptocurrency Address"
              rules={[{ required: true, message: 'Please enter crypto address' }]}
            >
              <Input placeholder="Enter crypto address" />
            </Form.Item>
            <Form.Item
              name="cryptoType"
              label="Cryptocurrency"
              rules={[{ required: true, message: 'Please select cryptocurrency' }]}
            >
              <Select placeholder="Select cryptocurrency">
                <Option value="BTC">Bitcoin (BTC)</Option>
                <Option value="ETH">Ethereum (ETH)</Option>
                <Option value="USDT">Tether (USDT)</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {form.getFieldValue('method') && form.getFieldValue('amount') && (
          <Alert
            message="Withdrawal Summary"
            description={
              <div>
                <p>Withdrawal amount: R{form.getFieldValue('amount')}</p>
                <p>Processing fee: {withdrawMethods.find(m => m.id === form.getFieldValue('method'))?.fee}%</p>
                <p>You'll receive: R{form.getFieldValue('amount') * (1 - (withdrawMethods.find(m => m.id === form.getFieldValue('method'))?.fee || 0) / 100)}</p>
              </div>
            }
            type="warning"
            style={{ marginBottom: '16px' }}
          />
        )}

        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              size="large"
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
              }}
            >
              Continue
            </Button>
            <Button size="large" onClick={onClose}>
              Cancel
            </Button>
          </Space>
        </Form.Item>
      </Form>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <WalletOutlined style={{ marginRight: '8px', color: viralFxColors.primaryPurple }} />
          Funding
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} centered>
        <TabPane
          tab={
            <span>
              <ArrowDownOutlined />
              Deposit
            </span>
          }
          key="deposit"
        >
          {renderDepositSteps()}
          {renderDepositContent()}
        </TabPane>
        <TabPane
          tab={
            <span>
              <ArrowUpOutlined />
              Withdraw
            </span>
          }
          key="withdraw"
        >
          {renderWithdrawSteps()}
          {renderWithdrawContent()}
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default FundingModal;