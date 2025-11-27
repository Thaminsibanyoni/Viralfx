import React, { useState, useEffect } from 'react';
import {
  Tabs, Card, Row, Col, Statistic, Typography, Table, Button, Space, Form, Input, Select, InputNumber, Modal, Tag, DatePicker, Tooltip, Alert, message, Progress, QRCode, Spin, } from 'antd';
import {
  WalletOutlined, DownloadOutlined, UploadOutlined, BankOutlined, CreditCardOutlined, QrcodeOutlined, EyeOutlined, EyeInvisibleOutlined, HistoryOutlined, FilterOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { walletApi } from '../../services/api/wallet.api';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';

const {Title, Text} = Typography;
const {TabPane} = Tabs;
const {Option} = Select;
const {RangePicker} = DatePicker;

interface WalletBalance {
  currency: string;
  balance: number;
  available: number;
  frozen: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'TRANSFER' | 'FEE';
  currency: string;
  amount: number;
  fee: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description: string;
  createdAt: string;
  completedAt?: string;
  paymentMethod?: string;
  reference?: string;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
}

interface PaymentMethod {
  id: string;
  type: 'BANK' | 'CARD' | 'CRYPTO';
  name: string;
  details: string;
  isDefault: boolean;
  isVerified: boolean;
  currency: string;
}

const WalletPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [depositModalVisible, setDepositModalVisible] = useState(false);
  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [showAmount, setShowAmount] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('ZAR');
  const [transactionFilter, setTransactionFilter] = useState({
    type: 'ALL',
    status: 'ALL',
    dateRange: null,
    search: '',
  });

  const queryClient = useQueryClient();

  // Fetch wallet balances
  const {data: balances, isLoading: balancesLoading} = useQuery(
    'walletBalances',
    () => walletApi.getBalances(),
    {
      refetchInterval: 30000,
    }
  );

  // Fetch transactions
  const {data: transactions, isLoading: transactionsLoading} = useQuery(
    ['walletTransactions', transactionFilter],
    () => walletApi.getTransactions(transactionFilter),
    {
      refetchInterval: 15000,
    }
  );

  // Fetch payment methods
  const {data: paymentMethods} = useQuery(
    'paymentMethods',
    () => walletApi.getPaymentMethods(),
    {
      refetchInterval: 60000,
    }
  );

  // Deposit mutation
  const depositMutation = useMutation(
    (depositData: any) => walletApi.createDeposit(depositData),
    {
      onSuccess: () => {
        message.success('Deposit request submitted successfully');
        setDepositModalVisible(false);
        queryClient.invalidateQueries('walletBalances');
        queryClient.invalidateQueries('walletTransactions');
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to create deposit request');
      },
    }
  );

  // Withdraw mutation
  const withdrawMutation = useMutation(
    (withdrawData: any) => walletApi.createWithdrawal(withdrawData),
    {
      onSuccess: () => {
        message.success('Withdrawal request submitted successfully');
        setWithdrawModalVisible(false);
        queryClient.invalidateQueries('walletBalances');
        queryClient.invalidateQueries('walletTransactions');
      },
      onError: (error: any) => {
        message.error(error.message || 'Failed to create withdrawal request');
      },
    }
  );

  const currencyOptions = [
    { key: 'ZAR', label: 'ZAR - South African Rand', symbol: 'R' },
    { key: 'USD', label: 'USD - US Dollar', symbol: '$' },
    { key: 'EUR', label: 'EUR - Euro', symbol: '€' },
    { key: 'BTC', label: 'BTC - Bitcoin', symbol: '₿' },
    { key: 'ETH', label: 'ETH - Ethereum', symbol: 'Ξ' },
  ];

  const getCurrencySymbol = (currency: string) => {
    const currencyOption = currencyOptions.find(c => c.key === currency);
    return currencyOption?.symbol || currency;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#52C41A';
      case 'PROCESSING': return '#1890FF';
      case 'PENDING': return '#FFB300';
      case 'FAILED': return '#FF4D4F';
      case 'CANCELLED': return '#8C8C8C';
      default: return '#B8BCC8';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircleOutlined style={{ color: getStatusColor(status) }} />;
      case 'PROCESSING': return <ClockCircleOutlined style={{ color: getStatusColor(status) }} />;
      case 'PENDING': return <ClockCircleOutlined style={{ color: getStatusColor(status) }} />;
      case 'FAILED': return <ExclamationCircleOutlined style={{ color: getStatusColor(status) }} />;
      case 'CANCELLED': return <ExclamationCircleOutlined style={{ color: getStatusColor(status) }} />;
      default: return null;
    }
  };

  const transactionColumns: ColumnsType<Transaction> = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <div>
          <Text style={{ color: '#B8BCC8' }}>
            {dayjs(date).format('YYYY-MM-DD')}
          </Text>
          <br />
          <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
            {dayjs(date).format('HH:mm:ss')}
          </Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: Transaction) => (
        <div>
          <Tag color={type === 'DEPOSIT' ? 'green' : type === 'WITHDRAWAL' ? 'red' : type === 'TRADE' ? 'blue' : 'default'}>
            {type}
          </Tag>
          <br />
          {record.paymentMethod && (
            <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
              {record.paymentMethod}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      render: (currency: string) => (
        <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>
          {currency}
        </Text>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: Transaction) => (
        <div>
          <Text
            style={{
              color: record.type === 'DEPOSIT' ? '#52C41A' : record.type === 'WITHDRAWAL' ? '#FF4D4F' : '#B8BCC8',
              fontWeight: 'bold'
            }}
          >
            {record.type === 'DEPOSIT' ? '+' : record.type === 'WITHDRAWAL' ? '-' : ''}
            {getCurrencySymbol(record.currency)}{Math.abs(amount).toLocaleString()}
          </Text>
          {record.fee > 0 && (
            <div>
              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                Fee: {getCurrencySymbol(record.currency)}{record.fee}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getStatusIcon(status)}
          <Tag color={getStatusColor(status)}>
            {status}
          </Tag>
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string, record: Transaction) => (
        <div>
          <Text style={{ color: '#B8BCC8' }}>{description}</Text>
          {record.reference && (
            <div>
              <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>
                Ref: {record.reference}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Transaction) => (
        <Space>
          {record.txHash && (
            <Tooltip title="View Transaction">
              <Button
                type="link"
                icon={<EyeOutlined />}
                size="small"
                onClick={() => {
                  if (record.txHash) {
                    window.open(`https://blockchain.info/tx/${record.txHash}`, '_blank');
                  }
                }}
                style={{ color: '#FFB300' }}
              />
            </Tooltip>
          )}
          {record.status === 'COMPLETED' && (
            <Tooltip title="Download Receipt">
              <Button
                type="link"
                icon={<FileTextOutlined />}
                size="small"
                onClick={() => message.info('Receipt download coming soon')}
                style={{ color: '#FFB300' }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const totalPortfolioValue = balances?.reduce((sum, balance) => {
    // Convert all to ZAR (in real app, this would use current exchange rates)
    const zarValue = balance.currency === 'ZAR' ? balance.balance :
                    balance.currency === 'USD' ? balance.balance * 18.5 :
                    balance.currency === 'EUR' ? balance.balance * 20.2 :
                    balance.currency === 'BTC' ? balance.balance * 850000 :
                    balance.currency === 'ETH' ? balance.balance * 45000 :
                    balance.balance;
    return sum + zarValue;
  }, 0) || 0;

  return (
    <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: '32px' }}>
        <Col>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Wallet
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Manage your funds and view transaction history
          </Text>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setDepositModalVisible(true)}
              style={{
                borderColor: '#52C41A',
                color: '#52C41A',
              }}
            >
              Deposit
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setWithdrawModalVisible(true)}
              style={{
                borderColor: '#FF4D4F',
                color: '#FF4D4F',
              }}
            >
              Withdraw
            </Button>
          </Space>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          '.ant-tabs-tab': {
            color: '#B8BCC8 !important',
          },
          '.ant-tabs-tab-active': {
            color: '#FFB300 !important',
          },
        }}
      >
        <TabPane tab="Overview" key="overview">
          {/* Balance Overview */}
          <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  background: '#1A1A1C',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Statistic
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#B8BCC8' }}>Portfolio Value</Text>
                      <Button
                        type="link"
                        icon={showAmount ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        onClick={() => setShowAmount(!showAmount)}
                        style={{ color: '#FFB300', padding: 0 }}
                      />
                    </div>
                  }
                  value={showAmount ? totalPortfolioValue : 0}
                  prefix={<WalletOutlined />}
                  precision={2}
                  valueStyle={{ color: '#FFB300', fontSize: '24px' }}
                  formatter={(value) => `R${Number(value).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  background: '#1A1A1C',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Statistic
                  title={<Text style={{ color: '#B8BCC8' }}>Available Balance</Text>}
                  value={showAmount ? balances?.find(b => b.currency === selectedCurrency)?.available || 0 : 0}
                  precision={2}
                  valueStyle={{ color: '#52C41A', fontSize: '24px' }}
                  formatter={(value) => `${getCurrencySymbol(selectedCurrency)}${Number(value).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  background: '#1A1A1C',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Statistic
                  title={<Text style={{ color: '#B8BCC8' }}>Pending Deposits</Text>}
                  value={showAmount ? balances?.find(b => b.currency === selectedCurrency)?.pendingDeposits || 0 : 0}
                  precision={2}
                  valueStyle={{ color: '#1890FF', fontSize: '24px' }}
                  formatter={(value) => `${getCurrencySymbol(selectedCurrency)}${Number(value).toLocaleString()}`}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  background: '#1A1A1C',
                  border: '1px solid rgba(255, 179, 0, 0.2)',
                  borderRadius: '12px',
                }}
              >
                <Statistic
                  title={<Text style={{ color: '#B8BCC8' }}>Pending Withdrawals</Text>}
                  value={showAmount ? balances?.find(b => b.currency === selectedCurrency)?.pendingWithdrawals || 0 : 0}
                  precision={2}
                  valueStyle={{ color: '#FF4D4F', fontSize: '24px' }}
                  formatter={(value) => `${getCurrencySymbol(selectedCurrency)}${Number(value).toLocaleString()}`}
                />
              </Card>
            </Col>
          </Row>

          {/* Currency Balances */}
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>Currency Balances</Text>
                <Select
                  value={selectedCurrency}
                  onChange={setSelectedCurrency}
                  style={{ width: 150 }}
                >
                  {currencyOptions.map(currency => (
                    <Option key={currency.key} value={currency.key}>
                      {currency.label}
                    </Option>
                  ))}
                </Select>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Row gutter={[16, 16]}>
              {balances?.map((balance) => (
                <Col xs={24} sm={12} lg={8} key={balance.currency}>
                  <div
                    style={{
                      background: 'rgba(255, 179, 0, 0.05)',
                      border: '1px solid rgba(255, 179, 0, 0.1)',
                      borderRadius: '8px',
                      padding: '16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <Text style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold' }}>
                        {balance.currency}
                      </Text>
                      <Tag color={balance.currency === selectedCurrency ? 'gold' : 'default'}>
                        {balance.currency === selectedCurrency ? 'Primary' : 'Secondary'}
                      </Tag>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <Text style={{ color: '#8C8C8C', fontSize: '12px' }}>Total Balance</Text>
                      <div style={{ color: '#B8BCC8', fontSize: '16px', fontWeight: 'bold' }}>
                        {showAmount ? `${getCurrencySymbol(balance.currency)}${balance.balance.toLocaleString()}` : '***'}
                      </div>
                    </div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <Text style={{ color: '#8C8C8C', fontSize: '11px' }}>Available</Text>
                        <div style={{ color: '#52C41A', fontSize: '14px' }}>
                          {showAmount ? `${getCurrencySymbol(balance.currency)}${balance.available.toLocaleString()}` : '***'}
                        </div>
                      </Col>
                      <Col span={12}>
                        <Text style={{ color: '#8C8C8C', fontSize: '11px' }}>Frozen</Text>
                        <div style={{ color: '#FF4D4F', fontSize: '14px' }}>
                          {showAmount ? `${getCurrencySymbol(balance.currency)}${balance.frozen.toLocaleString()}` : '***'}
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </TabPane>

        <TabPane tab="Transactions" key="transactions">
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#FFB300' }}>Transaction History</Text>
                <Space>
                  <Input
                    placeholder="Search transactions..."
                    prefix={<SearchOutlined />}
                    value={transactionFilter.search}
                    onChange={(e) => setTransactionFilter(prev => ({ ...prev, search: e.target.value }))}
                    style={{ width: 200 }}
                  />
                  <RangePicker
                    value={transactionFilter.dateRange}
                    onChange={(dates) => setTransactionFilter(prev => ({ ...prev, dateRange: dates }))}
                    style={{ width: 240 }}
                  />
                </Space>
              </div>
            }
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Table
              dataSource={transactions || []}
              columns={transactionColumns}
              loading={transactionsLoading}
              pagination={{
                total: transactions?.length || 0,
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} transactions`,
              }}
              rowKey="id"
              scroll={{ x: 1000 }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Deposit" key="deposit">
          <Card
            title={<Text style={{ color: '#FFB300' }}>Deposit Funds</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Alert
              message="Deposit Information"
              description="Deposits are processed within 1-2 business days for bank transfers and instantly for crypto deposits. Minimum deposit amount is R100 or equivalent."
              type="info"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Row gutter={[24, 24]}>
              <Col xs={24} lg={12}>
                <Form
                  layout="vertical"
                  onFinish={(values) => {
                    depositMutation.mutate(values);
                  }}
                >
                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Currency</Text>}
                    name="currency"
                    rules={[{ required: true, message: 'Please select a currency' }]}
                    initialValue="ZAR"
                  >
                    <Select placeholder="Select currency">
                      {currencyOptions.map(currency => (
                        <Option key={currency.key} value={currency.key}>
                          {currency.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Payment Method</Text>}
                    name="paymentMethod"
                    rules={[{ required: true, message: 'Please select a payment method' }]}
                  >
                    <Select placeholder="Select payment method">
                      <Option value="bank">Bank Transfer (EFT)</Option>
                      <Option value="card">Credit/Debit Card</Option>
                      <Option value="crypto">Cryptocurrency</Option>
                    </Select>
                  </Form.Item>

                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Amount</Text>}
                    name="amount"
                    rules={[
                      { required: true, message: 'Please enter deposit amount' },
                      { type: 'number', min: 100, message: 'Minimum deposit is R100' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter amount"
                      formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/R\s?|(,*)/g, '')}
                    />
                  </Form.Item>

                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Reference (Optional)</Text>}
                    name="reference"
                  >
                    <Input placeholder="Enter reference" />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={depositMutation.isLoading}
                      block
                      style={{
                        background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                        border: 'none',
                        height: '48px',
                      }}
                    >
                      Submit Deposit Request
                    </Button>
                  </Form.Item>
                </Form>
              </Col>

              <Col xs={24} lg={12}>
                <div
                  style={{
                    background: 'rgba(255, 179, 0, 0.05)',
                    border: '1px solid rgba(255, 179, 0, 0.1)',
                    borderRadius: '8px',
                    padding: '24px',
                    textAlign: 'center',
                  }}
                >
                  <QrcodeOutlined style={{ fontSize: '48px', color: '#FFB300', marginBottom: '16px' }} />
                  <Title level={4} style={{ color: '#FFB300', marginBottom: '16px' }}>
                    Quick Deposit
                  </Title>
                  <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '24px' }}>
                    Scan the QR code with your banking app to deposit quickly
                  </Text>
                  <div style={{ background: 'white', padding: '20px', borderRadius: '8px', display: 'inline-block' }}>
                    <QRCode value="viralfx-deposit-example" size={200} />
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </TabPane>

        <TabPane tab="Withdraw" key="withdraw">
          <Card
            title={<Text style={{ color: '#FFB300' }}>Withdraw Funds</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
          >
            <Alert
              message="Withdrawal Information"
              description="Withdrawals are processed within 24-48 hours. 2FA verification is required for security. Minimum withdrawal is R500 or equivalent."
              type="warning"
              showIcon
              style={{ marginBottom: '24px' }}
            />

            <Form
              layout="vertical"
              onFinish={(values) => {
                withdrawMutation.mutate(values);
              }}
            >
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Currency</Text>}
                    name="currency"
                    rules={[{ required: true, message: 'Please select a currency' }]}
                    initialValue="ZAR"
                  >
                    <Select placeholder="Select currency">
                      {currencyOptions.map(currency => (
                        <Option key={currency.key} value={currency.key}>
                          {currency.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12}>
                  <Form.Item
                    label={<Text style={{ color: '#B8BCC8' }}>Amount</Text>}
                    name="amount"
                    rules={[
                      { required: true, message: 'Please enter withdrawal amount' },
                      { type: 'number', min: 500, message: 'Minimum withdrawal is R500' },
                    ]}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter amount"
                      formatter={(value) => `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(value) => value!.replace(/R\s?|(,*)/g, '')}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={<Text style={{ color: '#B8BCC8' }}>Destination</Text>}
                name="destination"
                rules={[{ required: true, message: 'Please enter destination address' }]}
              >
                <Input placeholder="Enter bank account number or crypto address" />
              </Form.Item>

              <Form.Item
                label={<Text style={{ color: '#B8BCC8' }}>Payment Method</Text>}
                name="withdrawalMethod"
                rules={[{ required: true, message: 'Please select a withdrawal method' }]}
              >
                <Select placeholder="Select withdrawal method">
                  <Option value="bank">Bank Transfer (EFT)</Option>
                  <Option value="crypto">Cryptocurrency</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label={<Text style={{ color: '#B8BCC8' }}>2FA Code</Text>}
                name="twoFactorCode"
                rules={[{ required: true, message: 'Please enter your 2FA code' }]}
              >
                <Input placeholder="Enter 6-digit 2FA code" maxLength={6} />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={withdrawMutation.isLoading}
                  block
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                    height: '48px',
                  }}
                >
                  Submit Withdrawal Request
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Payment Methods" key="paymentMethods">
          <Card
            title={<Text style={{ color: '#FFB300' }}>Payment Methods</Text>}
            style={{
              background: '#1A1A1C',
              border: '1px solid rgba(255, 179, 0, 0.2)',
              borderRadius: '12px',
            }}
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => message.info('Add payment method coming soon')}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                }}
              >
                Add Method
              </Button>
            }
          >
            <List
              dataSource={paymentMethods || []}
              renderItem={(method: PaymentMethod) => (
                <List.Item
                  style={{
                    borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
                    padding: '20px 0',
                  }}
                  actions={[
                    method.isDefault ? (
                      <Tag color="gold">Default</Tag>
                    ) : (
                      <Button type="link" style={{ color: '#FFB300' }}>
                        Set as Default
                      </Button>
                    ),
                    <Button type="link" danger>
                      Remove
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          background: 'rgba(255, 179, 0, 0.1)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {method.type === 'BANK' ? <BankOutlined style={{ color: '#FFB300' }} /> :
                         method.type === 'CARD' ? <CreditCardOutlined style={{ color: '#FFB300' }} /> :
                         <QrcodeOutlined style={{ color: '#FFB300' }} />}
                      </div>
                    }
                    title={
                      <div>
                        <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>{method.name}</Text>
                        <Space style={{ marginLeft: '8px' }}>
                          {method.isVerified && <Tag color="green">Verified</Tag>}
                          <Tag color="blue">{method.currency}</Tag>
                        </Space>
                      </div>
                    }
                    description={<Text style={{ color: '#B8BCC8' }}>{method.details}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Deposit Modal */}
      <Modal
        title="Deposit Funds"
        open={depositModalVisible}
        onCancel={() => setDepositModalVisible(false)}
        footer={null}
        width={600}
        style={{ background: '#1A1A1C' }}
      >
        {/* Deposit form is handled in the Deposit tab */}
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        title="Withdraw Funds"
        open={withdrawModalVisible}
        onCancel={() => setWithdrawModalVisible(false)}
        footer={null}
        width={600}
        style={{ background: '#1A1A1C' }}
      >
        {/* Withdraw form is handled in the Withdraw tab */}
      </Modal>
    </div>
  );
};

export default WalletPage;