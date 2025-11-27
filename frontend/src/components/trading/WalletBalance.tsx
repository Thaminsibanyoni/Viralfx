import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Button, Select, Alert, Modal, Progress, Table } from 'antd';
import {
  WalletOutlined, ArrowUpOutlined, ArrowDownOutlined, SyncOutlined, EyeOutlined, EyeInvisibleOutlined, DollarOutlined, GiftOutlined, HistoryOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';

const {Option} = Select;

interface WalletBalanceProps {
  selectedCurrency?: string;
  onCurrencyChange?: (currency: string) => void;
}

interface WalletData {
  currency: string;
  balance: number;
  availableBalance: number;
  lockedBalance: number;
  dailyLimit: number;
  dailyUsed: number;
  monthlyLimit: number;
  monthlyUsed: number;
}

interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'FEE' | 'TRANSFER';
  amount: number;
  currency: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  description: string;
  createdAt: string;
  fee?: number;
}

const WalletBalance: React.FC<WalletBalanceProps> = ({
  selectedCurrency = 'ZAR',
  onCurrencyChange
}) => {
  const {user} = useAuth();
  const {subscribeToWallets, walletData} = useWebSocket();
  const [showBalance, setShowBalance] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);

  useEffect(() => {
    subscribeToWallets(user?.id || '');
  }, [user?.id]);

  // Mock wallet data (would come from WebSocket)
  const mockWalletData: Record<string, WalletData> = useMemo(() => ({
    'ZAR': {
      currency: 'ZAR',
      balance: 15000.50,
      availableBalance: 12500.50,
      lockedBalance: 2500.00,
      dailyLimit: 50000,
      dailyUsed: 12000.00,
      monthlyLimit: 500000,
      monthlyUsed: 150000.00
    },
    'USD': {
      currency: 'USD',
      balance: 2500.75,
      availableBalance: 2400.75,
      lockedBalance: 100.00,
      dailyLimit: 10000,
      dailyUsed: 500.00,
      monthlyLimit: 50000,
      monthlyUsed: 2500.00
    },
    'BTC': {
      currency: 'BTC',
      balance: 0.045,
      availableBalance: 0.043,
      lockedBalance: 0.002,
      dailyLimit: 1,
      dailyUsed: 0.1,
      monthlyLimit: 10,
      monthlyUsed: 1.5
    },
    'ETH': {
      currency: 'ETH',
      balance: 1.25,
      availableBalance: 1.20,
      lockedBalance: 0.05,
      dailyLimit: 10,
      dailyUsed: 0.5,
      monthlyLimit: 100,
      monthlyUsed: 12.5
    }
  }), []);

  const walletDataToUse = walletData || mockWalletData;
  const currentWallet = walletDataToUse[selectedCurrency];

  // Mock transaction history
  const mockTransactions: Transaction[] = [
    {
      id: '1',
      type: 'DEPOSIT',
      amount: 5000,
      currency: 'ZAR',
      status: 'COMPLETED',
      description: 'Bank deposit via Paystack',
      createdAt: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      type: 'TRADE',
      amount: -250,
      currency: 'ZAR',
      status: 'COMPLETED',
      description: 'Buy VIRAL/SA_MUSIC_001',
      createdAt: '2024-01-15T11:45:00Z',
      fee: 0.50
    },
    {
      id: '3',
      type: 'WITHDRAWAL',
      amount: -1000,
      currency: 'ZAR',
      status: 'PENDING',
      description: 'Withdrawal to bank account',
      createdAt: '2024-01-15T14:20:00Z'
    }
  ];

  const formatCurrency = (amount: number, currency: string) => {
    switch (currency) {
      case 'BTC':
      case 'ETH':
        return amount.toFixed(6);
      default:
        return amount.toFixed(2);
    }
  };

  const getCurrencySymbol = (currency: string) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      default: return 'R';
    }
  };

  const getPercentageUsed = (used: number, limit: number) => {
    return limit > 0 ? (used / limit) * 100 : 0;
  };

  const getLimitColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  const getTotalBalanceInZAR = () => {
    const exchangeRates = {
      'ZAR': 1,
      'USD': 18.5,
      'EUR': 20.2,
      'BTC': 450000,
      'ETH': 25000
    };

    return Object.entries(walletDataToUse).reduce((total, [currency, wallet]) => {
      return total + (wallet.balance * (exchangeRates[currency as keyof typeof exchangeRates] || 1));
    }, 0);
  };

  const transactionColumns = [
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'date',
      render: (date: string) => new Date(date).toLocaleDateString(),
      sorter: (a: Transaction, b: Transaction) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const colors = {
          'DEPOSIT': '#52c41a',
          'WITHDRAWAL': '#ff4d4f',
          'TRADE': '#1890ff',
          'FEE': '#faad14',
          'TRANSFER': '#722ed1'
        };
        return (
          <span style={{ color: colors[type as keyof typeof colors] }}>
            {type}
          </span>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number, record: Transaction) => (
        <span style={{ color: amount >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {amount >= 0 ? '+' : ''}{formatCurrency(amount, record.currency)} {record.currency}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors = {
          'COMPLETED': '#52c41a',
          'PENDING': '#faad14',
          'FAILED': '#ff4d4f'
        };
        return (
          <span style={{ color: colors[status as keyof typeof colors] }}>
            {status}
          </span>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    }
  ];

  return (
    <div className="wallet-balance">
      {/* Header */}
      <Card
        title={
          <div className="wallet-header">
            <div className="title">
              <WalletOutlined />
              <span>Wallet Balance</span>
            </div>
            <div className="actions">
              <Button
                type="text"
                icon={showBalance ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => setShowBalance(!showBalance)}
              />
              <Button
                type="primary"
                icon={<ArrowUpOutlined />}
                onClick={() => setShowDepositModal(true)}
                size="small"
              >
                Deposit
              </Button>
              <Button
                icon={<ArrowDownOutlined />}
                onClick={() => setShowWithdrawModal(true)}
                size="small"
              >
                Withdraw
              </Button>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setShowHistoryModal(true)}
                size="small"
              >
                History
              </Button>
            </div>
          </div>
        }
        size="small"
      >
        {/* Currency Selector */}
        <div className="currency-selector">
          <Select
            value={selectedCurrency}
            onChange={(value) => {
              setSelectedCurrency(walletDataToUse[value]);
              onCurrencyChange?.(value);
            }}
            style={{ width: 120, marginBottom: 16 }}
          >
            {Object.keys(walletDataToUse).map(currency => (
              <Option key={currency} value={currency}>{currency}</Option>
            ))}
          </Select>
        </div>

        {currentWallet && (
          <>
            {/* Current Wallet Balance */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="Total Balance"
                  value={showBalance ? formatCurrency(currentWallet.balance, currentWallet.currency) : '****'}
                  prefix={showBalance ? getCurrencySymbol(currentWallet.currency) : undefined}
                  valueStyle={{ fontSize: '24px', fontWeight: 'bold' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Available"
                  value={showBalance ? formatCurrency(currentWallet.availableBalance, currentWallet.currency) : '****'}
                  prefix={showBalance ? getCurrencySymbol(currentWallet.currency) : undefined}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Locked"
                  value={showBalance ? formatCurrency(currentWallet.lockedBalance, currentWallet.currency) : '****'}
                  prefix={showBalance ? getCurrencySymbol(currentWallet.currency) : undefined}
                  valueStyle={{ color: '#faad14' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="Total (ZAR)"
                  value={showBalance ? formatCurrency(getTotalBalanceInZAR(), 'ZAR') : '****'}
                  prefix="R"
                  valueStyle={{ fontSize: '20px', fontWeight: 'bold' }}
                />
              </Col>
            </Row>

            {/* Limits */}
            <div className="wallet-limits">
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <div className="limit-item">
                    <div className="limit-header">
                      <span>Daily Limit</span>
                      <span>
                        {formatCurrency(currentWallet.dailyUsed, currentWallet.currency)} / {formatCurrency(currentWallet.dailyLimit, currentWallet.currency)}
                      </span>
                    </div>
                    <Progress
                      percent={getPercentageUsed(currentWallet.dailyUsed, currentWallet.dailyLimit)}
                      strokeColor={getLimitColor(getPercentageUsed(currentWallet.dailyUsed, currentWallet.dailyLimit))}
                      size="small"
                      showInfo={false}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="limit-item">
                    <div className="limit-header">
                      <span>Monthly Limit</span>
                      <span>
                        {formatCurrency(currentWallet.monthlyUsed, currentWallet.currency)} / {formatCurrency(currentWallet.monthlyLimit, currentWallet.currency)}
                      </span>
                    </div>
                    <Progress
                      percent={getPercentageUsed(currentWallet.monthlyUsed, currentWallet.monthlyLimit)}
                      strokeColor={getLimitColor(getPercentageUsed(currentWallet.monthlyUsed, currentWallet.monthlyLimit))}
                      size="small"
                      showInfo={false}
                    />
                  </div>
                </Col>
              </Row>
            </div>

            {/* Limit Alerts */}
            {(getPercentageUsed(currentWallet.dailyUsed, currentWallet.dailyLimit) > 80 ||
              getPercentageUsed(currentWallet.monthlyUsed, currentWallet.monthlyLimit) > 80) && (
              <Alert
                message="Limit Warning"
                description="You're approaching your daily or monthly withdrawal limit."
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </>
        )}
      </Card>

      {/* Other Wallets Summary */}
      <Card title="Other Currencies" size="small" style={{ marginTop: 16 }}>
        <Row gutter={[16, 8]}>
          {Object.entries(walletDataToUse)
            .filter(([currency]) => currency !== selectedCurrency)
            .map(([currency, wallet]) => (
              <Col span={8} key={currency}>
                <div className="other-wallet">
                  <div className="wallet-info">
                    <span className="currency">{currency}</span>
                    <span className="balance">
                      {showBalance ? formatCurrency(wallet.balance, currency) : '****'}
                    </span>
                  </div>
                  <Progress
                    percent={getPercentageUsed(wallet.dailyUsed, wallet.dailyLimit)}
                    strokeColor={getLimitColor(getPercentageUsed(wallet.dailyUsed, wallet.dailyLimit))}
                    size="small"
                    showInfo={false}
                  />
                </div>
              </Col>
            ))}
        </Row>
      </Card>

      {/* Deposit Modal */}
      <Modal
        title="Deposit Funds"
        open={showDepositModal}
        onCancel={() => setShowDepositModal(false)}
        footer={null}
      >
        <div className="deposit-modal">
          <Alert
            message="Deposit Methods"
            description="Choose your preferred deposit method. All deposits are processed securely."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div className="deposit-methods">
            <Button block size="large" style={{ marginBottom: 8 }}>
              <GiftOutlined /> Paystack (Card/USSD/Bank Transfer)
            </Button>
            <Button block size="large" style={{ marginBottom: 8 }}>
              <DollarOutlined /> PayFast (EFT/Credit Card)
            </Button>
            <Button block size="large">
              <DollarOutlined /> Ozow (Instant EFT)
            </Button>
          </div>
        </div>
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        title="Withdraw Funds"
        open={showWithdrawModal}
        onCancel={() => setShowWithdrawModal(false)}
        footer={null}
      >
        <div className="withdraw-modal">
          <Alert
            message="Withdrawal Information"
            description="Withdrawals are processed within 24-48 hours. Bank transfer fees may apply."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <div className="withdraw-info">
            <p><strong>Available Balance:</strong> {formatCurrency(currentWallet?.availableBalance || 0, currentWallet?.currency || 'ZAR')} {currentWallet?.currency || 'ZAR'}</p>
            <p><strong>Daily Remaining:</strong> {formatCurrency(currentWallet?.dailyLimit - currentWallet?.dailyUsed || 0, currentWallet?.currency || 'ZAR')} {currentWallet?.currency || 'ZAR'}</p>
          </div>
          <Button type="primary" block size="large">
            Initiate Withdrawal
          </Button>
        </div>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        title="Transaction History"
        open={showHistoryModal}
        onCancel={() => setShowHistoryModal(false)}
        width={800}
        footer={null}
      >
        <Table
          dataSource={mockTransactions}
          columns={transactionColumns}
          pagination={{ pageSize: 10 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};

export default WalletBalance;