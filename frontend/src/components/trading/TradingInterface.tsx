import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Button, InputNumber, Select, Radio, Alert, Tabs, Statistic, Modal, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThunderboltOutlined, RiseOutlined, FallOutlined, InfoCircleOutlined, HistoryOutlined, DollarOutlined, PercentageOutlined, ClockCircleOutlined, SafetyOutlined, StarOutlined
} from '@ant-design/icons';
import { TrendCard } from './TrendCard';
import { OrderBook } from './OrderBook';
import { PriceChart } from './PriceChart';
import { TradeHistory } from './TradeHistory';
import { WalletBalance } from './WalletBalance';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { TradingBot } from './TradingBot';

const {Option} = Select;
const {TabPane} = Tabs;

interface TradingInterfaceProps {
  trend: {
    id: string;
    symbol: string;
    name: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    viralityScore: number;
    riskScore: number;
    category: string;
    isActive: boolean;
  };
  onClose?: () => void;
}

interface OrderFormData {
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
}

const TradingInterface: React.FC<TradingInterfaceProps> = ({ trend, onClose }) => {
  const {user} = useAuth();
  const {placeOrder, cancelOrder, subscribeToOrders} = useWebSocket();
  const [activeTab, setActiveTab] = useState('trade');
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    type: 'MARKET',
    side: 'BUY',
    quantity: 0,
    timeInForce: 'GTC'
  });
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [estimatedTotal, setEstimatedTotal] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    subscribeToOrders(user?.id || '');
  }, [user?.id]);

  useEffect(() => {
    // Calculate estimated total when form changes
    if (orderForm.type === 'LIMIT' && orderForm.price) {
      setEstimatedTotal(orderForm.quantity * orderForm.price);
    } else if (orderForm.type === 'MARKET') {
      setEstimatedTotal(orderForm.quantity * trend.currentPrice);
    } else {
      setEstimatedTotal(0);
    }
  }, [orderForm, trend.currentPrice]);

  const handleOrderFormChange = (field: keyof OrderFormData, value: any) => {
    setOrderForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateOrder = () => {
    if (orderForm.quantity <= 0) {
      message.error('Quantity must be greater than 0');
      return false;
    }

    if (orderForm.type === 'LIMIT' && (!orderForm.price || orderForm.price <= 0)) {
      message.error('Price must be greater than 0 for limit orders');
      return false;
    }

    if (orderForm.type === 'STOP_LOSS' && (!orderForm.stopPrice || orderForm.stopPrice <= 0)) {
      message.error('Stop price must be greater than 0 for stop loss orders');
      return false;
    }

    if (estimatedTotal > 100000) { // Example maximum order value
      message.error('Order value exceeds maximum limit');
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateOrder()) return;

    setIsPlacingOrder(true);
    setShowConfirmation(false);

    try {
      const orderData = {
        trendId: trend.id,
        ...orderForm,
        clientOrderId: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      await placeOrder(orderData);

      message.success(`${orderForm.side} order placed successfully!`);

      // Reset form
      setOrderForm({
        type: 'MARKET',
        side: 'BUY',
        quantity: 0,
        timeInForce: 'GTC'
      });

    } catch (error) {
      message.error(`Failed to place order: ${error.message}`);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const getQuickAmounts = () => {
    const amounts = [100, 500, 1000, 5000, 10000];
    return amounts.map(amount => ({
      amount,
      quantity: orderForm.type === 'LIMIT' && orderForm.price ? amount / orderForm.price : amount / trend.currentPrice
    }));
  };

  const getOrderTypeInfo = () => {
    switch (orderForm.type) {
      case 'MARKET':
        return 'Executes immediately at the best available price';
      case 'LIMIT':
        return 'Executes only at your specified price or better';
      case 'STOP_LOSS':
        return 'Become a market order when the price reaches your stop price';
      case 'TAKE_PROFIT':
        return 'Automatically takes profit when the price reaches your target';
      default:
        return '';
    }
  };

  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  return (
    <Modal
      visible={true}
      onCancel={onClose}
      width={1200}
      footer={null}
      className="trading-interface-modal"
      title={
        <div className="trading-header">
          <div className="trend-info">
            <h2>{trend.symbol} - {trend.name}</h2>
            <div className="price-info">
              <span className="current-price">{formatPrice(trend.currentPrice)}</span>
              <span className={`price-change ${trend.priceChange24h >= 0 ? 'positive' : 'negative'}`}>
                {trend.priceChange24h >= 0 ? '+' : ''}{trend.priceChange24h.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="risk-indicators">
            <div className="virality-indicator">
              <ThunderboltOutlined style={{ color: '#ff4d4f' }} />
              <span>{trend.viralityScore.toFixed(0)}</span>
            </div>
            <div className="risk-indicator">
              <SafetyOutlined style={{ color: trend.riskScore > 70 ? '#ff4d4f' : '#52c41a' }} />
              <span>Risk {trend.riskScore > 70 ? 'HIGH' : 'MEDIUM'}</span>
            </div>
          </div>
        </div>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} className="trading-tabs">
        <TabPane tab="Trade" key="trade">
          <Row gutter={[16, 16]}>
            {/* Trading Form */}
            <Col xs={24} lg={10}>
              <Card title="Place Order" className="order-form-card">
                {/* Order Type Selection */}
                <div className="form-section">
                  <label>Order Type</label>
                  <Radio.Group
                    value={orderForm.type}
                    onChange={(e) => handleOrderFormChange('type', e.target.value)}
                    className="order-type-selector"
                  >
                    <Radio.Button value="MARKET">Market</Radio.Button>
                    <Radio.Button value="LIMIT">Limit</Radio.Button>
                    <Radio.Button value="STOP_LOSS">Stop Loss</Radio.Button>
                    <Radio.Button value="TAKE_PROFIT">Take Profit</Radio.Button>
                  </Radio.Group>
                  {orderForm.type !== 'MARKET' && (
                    <div className="order-type-info">
                      <InfoCircleOutlined /> {getOrderTypeInfo()}
                    </div>
                  )}
                </div>

                {/* Buy/Sell Selection */}
                <div className="form-section">
                  <label>Direction</label>
                  <Radio.Group
                    value={orderForm.side}
                    onChange={(e) => handleOrderFormChange('side', e.target.value)}
                    className="side-selector"
                  >
                    <Radio.Button value="BUY" className="buy-button">
                      <RiseOutlined /> Buy
                    </Radio.Button>
                    <Radio.Button value="SELL" className="sell-button">
                      <FallOutlined /> Sell
                    </Radio.Button>
                  </Radio.Group>
                </div>

                {/* Price Input (for non-market orders) */}
                {orderForm.type !== 'MARKET' && (
                  <div className="form-section">
                    <label>Price</label>
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter price"
                      value={orderForm.price}
                      onChange={(value) => handleOrderFormChange('price', value)}
                      precision={6}
                      min={0}
                      prefix={<DollarOutlined />}
                    />
                  </div>
                )}

                {/* Stop Price (for stop orders) */}
                {(orderForm.type === 'STOP_LOSS' || orderForm.type === 'TAKE_PROFIT') && (
                  <div className="form-section">
                    <label>Stop Price</label>
                    <InputNumber
                      style={{ width: '100%' }}
                      placeholder="Enter stop price"
                      value={orderForm.stopPrice}
                      onChange={(value) => handleOrderFormChange('stopPrice', value)}
                      precision={6}
                      min={0}
                      prefix={<DollarOutlined />}
                    />
                  </div>
                )}

                {/* Quantity Input */}
                <div className="form-section">
                  <label>Quantity</label>
                  <InputNumber
                    style={{ width: '100%' }}
                    placeholder="Enter quantity"
                    value={orderForm.quantity}
                    onChange={(value) => handleOrderFormChange('quantity', value)}
                    precision={0}
                    min={1}
                    step={1}
                  />
                </div>

                {/* Quick Amount Selection */}
                <div className="form-section">
                  <label>Quick Amount</label>
                  <div className="quick-amounts">
                    {getQuickAmounts().map(({ amount, quantity }) => (
                      <Button
                        key={amount}
                        size="small"
                        onClick={() => handleOrderFormChange('quantity', Math.floor(quantity))}
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Time in Force */}
                {orderForm.type !== 'MARKET' && (
                  <div className="form-section">
                    <label>Time in Force</label>
                    <Select
                      style={{ width: '100%' }}
                      value={orderForm.timeInForce}
                      onChange={(value) => handleOrderFormChange('timeInForce', value)}
                    >
                      <Option value="GTC">Good Till Canceled</Option>
                      <Option value="IOC">Immediate or Cancel</Option>
                      <Option value="FOK">Fill or Kill</Option>
                      <Option value="DAY">Day</Option>
                    </Select>
                  </div>
                )}

                {/* Order Summary */}
                <div className="order-summary">
                  <div className="summary-row">
                    <span>Estimated Total:</span>
                    <span className="total-amount">${formatPrice(estimatedTotal)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Estimated Fee:</span>
                    <span>${formatPrice(estimatedTotal * 0.002)}</span>
                  </div>
                </div>

                {/* Risk Warning */}
                {trend.riskScore > 70 && (
                  <Alert
                    message="High Risk Warning"
                    description="This trend has a high risk score. Please trade carefully."
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}

                {/* Action Buttons */}
                <div className="form-actions">
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => setShowConfirmation(true)}
                    disabled={!trend.isActive || isPlacingOrder}
                    loading={isPlacingOrder}
                    className={orderForm.side === 'BUY' ? 'buy-action' : 'sell-action'}
                    icon={orderForm.side === 'BUY' ? <RiseOutlined /> : <FallOutlined />}
                  >
                    {isPlacingOrder ? 'Placing Order...' : `${orderForm.side} ${orderForm.type}`}
                  </Button>
                </div>
              </Card>

              {/* Wallet Balance */}
              <WalletBalance />
            </Col>

            {/* Chart and Order Book */}
            <Col xs={24} lg={14}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <PriceChart trendId={trend.id} />
                </Col>
                <Col span={24}>
                  <OrderBook trendId={trend.id} />
                </Col>
              </Row>
            </Col>
          </Row>
        </TabPane>

        <TabPane tab="History" key="history">
          <TradeHistory trendId={trend.id} />
        </TabPane>

        <TabPane tab="Analytics" key="analytics">
          <div className="analytics-content">
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Statistic
                  title="Volume 24h"
                  value={trend.volume24h}
                  prefix={<DollarOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Virality Score"
                  value={trend.viralityScore}
                  suffix="/ 100"
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Risk Score"
                  value={trend.riskScore}
                  suffix="/ 100"
                  prefix={<SafetyOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Category"
                  value={trend.category}
                  prefix={<StarOutlined />}
                />
              </Col>
            </Row>
          </div>
        </TabPane>

        <TabPane tab="Trading Bot" key="bot">
          <TradingBot trendId={trend.id} />
        </TabPane>
      </Tabs>

      {/* Order Confirmation Modal */}
      <Modal
        title="Confirm Order"
        visible={showConfirmation}
        onOk={handlePlaceOrder}
        onCancel={() => setShowConfirmation(false)}
        okText="Place Order"
        cancelText="Cancel"
      >
        <div className="order-confirmation">
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title="Order Type"
                value={orderForm.type}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Side"
                value={orderForm.side}
                valueStyle={{ color: orderForm.side === 'BUY' ? '#52c41a' : '#ff4d4f' }}
              />
            </Col>
            {orderForm.price && (
              <Col span={12}>
                <Statistic
                  title="Price"
                  value={formatPrice(orderForm.price)}
                  prefix={<DollarOutlined />}
                />
              </Col>
            )}
            <Col span={12}>
              <Statistic
                title="Quantity"
                value={orderForm.quantity}
              />
            </Col>
            <Col span={24}>
              <Statistic
                title="Total Value"
                value={formatPrice(estimatedTotal)}
                prefix={<DollarOutlined />}
                valueStyle={{ fontWeight: 'bold', fontSize: '18px' }}
              />
            </Col>
          </Row>
        </div>
      </Modal>
    </Modal>
  );
};

export default TradingInterface;