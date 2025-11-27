import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Table, Tag, Space, Modal, Form, Input, InputNumber, Select, message, Divider, Alert, QRCode, Descriptions, Tooltip, Progress, Statistic, } from 'antd';
import {
  WalletOutlined, CreditCardOutlined, BankOutlined, QrcodeOutlined, PlusOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CopyOutlined, DownloadOutlined, EyeOutlined, EyeInvisibleOutlined, SyncOutlined, } from '@ant-design/icons';
import { User } from '../../types/user.types';
import { walletApi, WalletBalance, Transaction, PaymentMethod } from '../../services/api/wallet.api';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';

interface WalletTabProps {
  user: User;
  onUpdateUser: (userData: Partial<User>) => void;
}

const WalletTab: React.FC<WalletTabProps> = ({ user, onUpdateUser }) => {
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [addPaymentMethodModalVisible, setAddPaymentMethodModalVisible] = useState(false);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    infoBlue: '#2196f3',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  const [depositForm] = Form.useForm();
  const [withdrawForm] = Form.useForm();
  const [paymentMethodForm] = Form.useForm();

  useEffect(() => {
    loadWalletData();
  }, []);

  const loadWalletData = async () => {
    setLoading(true);
    try {
      // Load wallet balance, transactions, and payment methods
      const [balanceRes, transactionsRes, paymentMethodsRes] = await Promise.all([
        walletApi.getBalance(),
        walletApi.getTransactions({ limit: 10 }),
        walletApi.getPaymentMethods(),
      ]);

      setBalance(balanceRes.data);
      setTransactions(transactionsRes.data.transactions || []);
      setPaymentMethods(paymentMethodsRes.data || []);
    } catch (error) {
      toast.error('Failed to load wallet data', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async (values: any) => {
    try {
      const response = await walletApi.deposit({
        amount: values.amount,
        currency: values.currency,
        paymentMethod: values.paymentMethod,
      });

      if (response.data.paymentUrl) {
        // Redirect to payment gateway
        window.open(response.data.paymentUrl, '_blank');
        toast.success('Redirecting to payment gateway...', {
          style: {
            background: viralFxColors.infoBlue,
            color: 'white',
          },
        });
      }

      setDepositModalVisible(false);
      depositForm.resetFields();
      loadWalletData();
    } catch (error) {
      toast.error('Failed to initiate deposit', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleWithdraw = async (values: any) => {
    try {
      const response = await walletApi.withdraw({
        amount: values.amount,
        currency: values.currency,
        destination: values.destination,
        method: values.method,
      });

      toast.success('Withdrawal request submitted successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });

      setWithdrawModalVisible(false);
      withdrawForm.resetFields();
      loadWalletData();
    } catch (error) {
      toast.error('Failed to submit withdrawal request', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleAddPaymentMethod = async (values: any) => {
    try {
      await walletApi.addPaymentMethod({
        type: values.type,
        provider: values.provider,
        data: values.data,
        isDefault: values.isDefault || false,
      });

      toast.success('Payment method added successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });

      setAddPaymentMethodModalVisible(false);
      paymentMethodForm.resetFields();
      loadWalletData();
    } catch (error) {
      toast.error('Failed to add payment method', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleRemovePaymentMethod = async (methodId: string) => {
    try {
      await walletApi.removePaymentMethod(methodId);

      toast.success('Payment method removed successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });

      loadWalletData();
    } catch (error) {
      toast.error('Failed to remove payment method', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleSetDefaultPaymentMethod = async (methodId: string) => {
    try {
      await walletApi.setDefaultPaymentMethod(methodId);

      toast.success('Default payment method updated!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });

      loadWalletData();
    } catch (error) {
      toast.error('Failed to update default payment method', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard!', {
      style: {
        background: viralFxColors.infoBlue,
        color: 'white',
      },
    });
  };

  const transactionColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors = {
          DEPOSIT: viralFxColors.successGreen,
          WITHDRAWAL: viralFxColors.errorRed,
          TRADE: viralFxColors.infoBlue,
          FEE: viralFxColors.warningOrange,
        };
        return (
          <Tag color={colors[type as keyof typeof colors]} style={{ textTransform: 'capitalize' }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: Transaction) => {
        const isPositive = record.type === 'DEPOSIT';
        return (
          <span style={{ color: isPositive ? viralFxColors.successGreen : viralFxColors.errorRed }}>
            {isPositive ? '+' : '-'}{record.currency} {amount.toLocaleString()}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          PENDING: viralFxColors.warningOrange,
          PROCESSING: viralFxColors.infoBlue,
          COMPLETED: viralFxColors.successGreen,
          FAILED: viralFxColors.errorRed,
          CANCELLED: viralFxColors.textSecondary,
        };
        return (
          <Tag color={colors[status as keyof typeof colors]} style={{ textTransform: 'capitalize' }}>
            {status}
          </Tag>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
  ];

  const paymentMethodColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const icons = {
          card: <CreditCardOutlined />,
          bank: <BankOutlined />,
          crypto: <QrcodeOutlined />,
        };
        return (
          <Space>
            {icons[type as keyof typeof icons]}
            <span style={{ textTransform: 'capitalize' }}>{type}</span>
          </Space>
        );
      },
    },
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (provider: string) => provider.toUpperCase(),
    },
    {
      title: 'Details',
      dataIndex: 'identifier',
      key: 'identifier',
      render: (identifier: string, record: PaymentMethod) => {
        if (record.type === 'card') {
          return `**** **** **** ${identifier}`;
        }
        return identifier;
      },
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: PaymentMethod) => (
        <Space>
          <Tag color={isActive ? 'success' : 'default'}>
            {isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isDefault && (
            <Tag color="primary">Default</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: PaymentMethod) => (
        <Space>
          {!record.isDefault && (
            <Button
              type="link"
              size="small"
              onClick={() => handleSetDefaultPaymentMethod(record.id)}
              style={{
                color: viralFxColors.primaryPurple,
              }}
            >
              Set Default
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemovePaymentMethod(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Wallet Balance Overview */}
      {balance && (
        <Row gutter={24} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={8}>
            <Card
              style={{
                border: `1px solid ${viralFxColors.borderDefault}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Statistic
                title="Available Balance"
                value={balance.available}
                precision={2}
                prefix="R"
                valueStyle={{
                  color: viralFxColors.textPrimary,
                  fontSize: '24px',
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              style={{
                border: `1px solid ${viralFxColors.borderDefault}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Statistic
                title="Locked Balance"
                value={balance.locked}
                precision={2}
                prefix="R"
                valueStyle={{
                  color: viralFxColors.textSecondary,
                  fontSize: '24px',
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              style={{
                border: `1px solid ${viralFxColors.borderDefault}`,
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              }}
            >
              <Statistic
                title="Total Balance"
                value={balance.total}
                precision={2}
                prefix="R"
                valueStyle={{
                  color: viralFxColors.accentGold,
                  fontSize: '28px',
                  fontWeight: 'bold',
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick Actions */}
      <Card
        title="Quick Actions"
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDepositModalVisible(true)}
              style={{
                width: '100%',
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
                borderRadius: '6px',
                height: '48px',
                fontSize: '16px',
                boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
              }}
            >
              Deposit Funds
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              icon={<WalletOutlined />}
              onClick={() => setWithdrawModalVisible(true)}
              style={{
                width: '100%',
                borderColor: viralFxColors.borderDefault,
                borderRadius: '6px',
                height: '48px',
                fontSize: '16px',
              }}
            >
              Withdraw Funds
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setAddPaymentMethodModalVisible(true)}
              style={{
                width: '100%',
                borderColor: viralFxColors.borderDefault,
                borderRadius: '6px',
                height: '48px',
                fontSize: '16px',
              }}
            >
              Add Payment Method
            </Button>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => loadWalletData()}
              loading={loading}
              style={{
                width: '100%',
                borderColor: viralFxColors.borderDefault,
                borderRadius: '6px',
                height: '48px',
                fontSize: '16px',
              }}
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Payment Methods */}
      <Card
        title="Payment Methods"
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Table
          columns={paymentMethodColumns}
          dataSource={paymentMethods}
          rowKey="id"
          pagination={false}
          locale={{ emptyText: 'No payment methods added yet' }}
        />
      </Card>

      {/* Recent Transactions */}
      <Card
        title="Recent Transactions"
        extra={
          <Button
            type="link"
            icon={<EyeOutlined />}
            style={{
              color: viralFxColors.primaryPurple,
            }}
          >
            View All
          </Button>
        }
        style={{
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Table
          columns={transactionColumns}
          dataSource={transactions}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          loading={transactionLoading}
        />
      </Card>

      {/* Crypto Addresses */}
      <Card
        title="Cryptocurrency Addresses"
        style={{
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        <Alert
          message="Secure Crypto Storage"
          description="Generate unique addresses for different cryptocurrencies to receive funds directly to your wallet."
          type="info"
          showIcon
          style={{
            marginBottom: '16px',
            backgroundColor: '#e6f7ff',
            borderColor: '#91d5ff',
          }}
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card
              size="small"
              style={{ textAlign: 'center' }}
            >
              <QrcodeOutlined
                style={{
                  fontSize: '24px',
                  color: viralFxColors.warningOrange,
                  marginBottom: '8px',
                }}
              />
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Bitcoin (BTC)</div>
              <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                bc1qxy2kgdygjrsqtzq2n0yrf2493pkkkkursjxh
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493pkkkkursjxh')}
                style={{
                  marginTop: '8px',
                  borderColor: viralFxColors.primaryPurple,
                  color: viralFxColors.primaryPurple,
                }}
              >
                Copy
              </Button>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card
              size="small"
              style={{ textAlign: 'center' }}
            >
              <QrcodeOutlined
                style={{
                  fontSize: '24px',
                  color: viralFxColors.successGreen,
                  marginBottom: '8px',
                }}
              />
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Ethereum (ETH)</div>
              <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                0x742d35Cc6634C0532925a3b844Bc454e4438f44e6
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e6')}
                style={{
                  marginTop: '8px',
                  borderColor: viralFxColors.primaryPurple,
                  color: viralFxColors.primaryPurple,
                }}
              >
                Copy
              </Button>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card
              size="small"
              style={{ textAlign: 'center' }}
            >
              <QrcodeOutlined
                style={{
                  fontSize: '24px',
                  color: viralFxColors.primaryPurple,
                  marginBottom: '8px',
                }}
              />
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>USDT (Tether)</div>
              <div style={{ color: viralFxColors.textSecondary, fontSize: '12px' }}>
                TMdBkrcs3a6e9j1WxVMdBJSWYhTmQ
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => handleCopyAddress('TMdBkrcs3a6e9j1WxVMdBJSWYhTmQ')}
                style={{
                  marginTop: '8px',
                  borderColor: viralFxColors.primaryPurple,
                  color: viralFxColors.primaryPurple,
                }}
              >
                Copy
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Deposit Modal */}
      <Modal
        title="Deposit Funds"
        open={depositModalVisible}
        onCancel={() => setDepositModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={depositForm}
          layout="vertical"
          onFinish={handleDeposit}
        >
          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              { required: true, message: 'Please enter deposit amount' },
              { type: 'number', min: 100, message: 'Minimum deposit is R100' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter amount (R)"
              min={100}
              formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="Currency"
            name="currency"
            initialValue="ZAR"
            rules={[{ required: true, message: 'Please select currency' }]}
          >
            <Select style={{ width: '100%' }}>
              <Option value="ZAR">South African Rand (ZAR)</Option>
              <Option value="USD">US Dollar (USD)</Option>
              <Option value="EUR">Euro (EUR)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Payment Method"
            name="paymentMethod"
            rules={[{ required: true, message: 'Please select payment method' }]}
          >
            <Select style={{ width: '100%' }}>
              {paymentMethods
                .filter(method => method.isActive)
                .map(method => (
                  <Option key={method.id} value={method.id}>
                    <Space>
                      {method.type === 'card' && <CreditCardOutlined />}
                      {method.type === 'bank' && <BankOutlined />}
                      {method.provider.toUpperCase()} - {method.identifier}
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setDepositModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: viralFxColors.primaryPurple, borderColor: viralFxColors.primaryPurple }}>
                Continue to Payment
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        title="Withdraw Funds"
        open={withdrawModalVisible}
        onCancel={() => setWithdrawModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={withdrawForm}
          layout="vertical"
          onFinish={handleWithdraw}
        >
          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              { required: true, message: 'Please enter withdrawal amount' },
              { type: 'number', min: 500, message: 'Minimum withdrawal is R500' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Enter amount (R)"
              min={500}
              formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            />
          </Form.Item>

          <Form.Item
            label="Currency"
            name="currency"
            initialValue="ZAR"
            rules={[{ required: true, message: 'Please select currency' }]}
          >
            <Select style={{ width: '100%' }}>
              <Option value="ZAR">South African Rand (ZAR)</Option>
              <Option value="USD">US Dollar (USD)</Option>
              <Option value="EUR">Euro (EUR)</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Destination"
            name="destination"
            rules={[
              { required: true, message: 'Please enter destination address/account' },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Enter destination bank account or crypto address"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="Withdrawal Method"
            name="method"
            rules={[{ required: true, message: 'Please select withdrawal method' }]}
          >
            <Select style={{ width: '100%' }}>
              {paymentMethods
                .filter(method => method.isActive)
                .map(method => (
                  <Option key={method.id} value={method.id}>
                    <Space>
                      {method.type === 'card' && <CreditCardOutlined />}
                      {method.type === 'bank' && <BankOutlined />}
                      {method.provider.toUpperCase()} - {method.identifier}
                    </Space>
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setWithdrawModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: viralFxColors.primaryPurple, borderColor: viralFxColors.primaryPurple }}>
                Submit Withdrawal
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Payment Method Modal */}
      <Modal
        title="Add Payment Method"
        open={addPaymentMethodModalVisible}
        onCancel={() => setAddPaymentMethodModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={paymentMethodForm}
          layout="vertical"
          onFinish={handleAddPaymentMethod}
        >
          <Form.Item
            label="Payment Type"
            name="type"
            rules={[{ required: true, message: 'Please select payment type' }]}
          >
            <Select style={{ width: '100%' }}>
              <Option value="card">Credit/Debit Card</Option>
              <Option value="bank">Bank Account</Option>
              <Option value="crypto">Crypto Wallet</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Payment Provider"
            name="provider"
            rules={[{ required: true, message: 'Please select payment provider' }]}
            dependencies={['type']}
          >
            <Select style={{ width: '100%' }}>
              <Option value="paystack">Paystack</Option>
              <Option value="payfast">PayFast</Option>
              <Option value="ozow">Ozow</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Set as Default"
            name="isDefault"
            valuePropName="checked"
          >
            <Switch defaultChecked={false} />
          </Form.Item>

          <Form.Item style={{ textAlign: 'center', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setAddPaymentMethodModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: viralFxColors.primaryPurple, borderColor: viralFxColors.primaryPurple }}>
                Add Payment Method
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WalletTab;