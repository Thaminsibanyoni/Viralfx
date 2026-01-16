import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Settings, DollarSign, Percent } from 'lucide-react';
import { useTradingStore, useCurrentSymbol, useMarketData, useAccountInfo } from '../../stores/tradingStore';
import { OrderSide, OrderType } from '../../types/trading.types';
import GlassCard from '../ui/GlassCard';
import { toast } from 'react-hot-toast';

const OrderEntryPanel: React.FC = () => {
  const currentSymbol = useCurrentSymbol();
  const marketData = useMarketData();
  const accountInfo = useAccountInfo();

  const {
    selectedOrderSide,
    selectedOrderType,
    setSelectedOrderSide,
    setSelectedOrderType,
    placeOrder,
  } = useTradingStore();

  const [quantity, setQuantity] = useState(0.1);
  const [price, setPrice] = useState(marketData?.price || 0);
  const [stopPrice, setStopPrice] = useState(0);
  const [leverage, setLeverage] = useState(1);
  const [slippage, setSlippage] = useState(0.5);

  const handlePlaceOrder = async () => {
    if (!marketData) {
      toast.error('Market data not available');
      return;
    }

    const executionPrice = selectedOrderType === 'market' ? marketData.price : price;

    // Validate
    if (quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (selectedOrderType === 'limit' || selectedOrderType === 'stop_limit') {
      if (price <= 0) {
        toast.error('Please enter a valid price');
        return;
      }
    }

    if (selectedOrderType === 'stop' || selectedOrderType === 'stop_limit') {
      if (stopPrice <= 0) {
        toast.error('Please enter a valid stop price');
        return;
      }
    }

    // Calculate margin required
    const marginRequired = (executionPrice * quantity) / leverage;

    if (marginRequired > accountInfo.freeMargin) {
      toast.error(`Insufficient margin. Required: $${marginRequired.toFixed(2)}, Available: $${accountInfo.freeMargin.toFixed(2)}`);
      return;
    }

    try {
      await placeOrder({
        symbol: currentSymbol,
        side: selectedOrderSide,
        type: selectedOrderType,
        price: executionPrice,
        stopPrice: selectedOrderType.includes('stop') ? stopPrice : undefined,
        quantity,
      });

      toast.success(`Order placed: ${selectedOrderSide.toUpperCase()} ${quantity} ${currentSymbol} @ $${executionPrice}`);
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  const calculateOrderValue = () => {
    if (!marketData) return 0;
    const executionPrice = selectedOrderType === 'market' ? marketData.price : price;
    return executionPrice * quantity;
  };

  const calculateMargin = () => {
    return calculateOrderValue() / leverage;
  };

  const isBuy = selectedOrderSide === 'buy';
  const isMarketOrder = selectedOrderType === 'market';

  return (
    <GlassCard title="Place Order" className="h-full">
      <div className="space-y-4">
        {/* Order Side Selection */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedOrderSide('buy')}
            className={`
              py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2
              ${isBuy
                ? 'bg-success-500 text-white shadow-glow'
                : 'bg-dark-800/50 text-gray-400 hover:bg-success-500/20 border border-primary-700/30'
              }
            `}
          >
            <TrendingUp className="w-4 h-4" />
            Buy / Long
          </button>
          <button
            onClick={() => setSelectedOrderSide('sell')}
            className={`
              py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2
              ${!isBuy
                ? 'bg-danger-500 text-white shadow-glow'
                : 'bg-dark-800/50 text-gray-400 hover:bg-danger-500/20 border border-primary-700/30'
              }
            `}
          >
            <TrendingDown className="w-4 h-4" />
            Sell / Short
          </button>
        </div>

        {/* Order Type */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Order Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['market', 'limit', 'stop', 'stop_limit'] as OrderType[]).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedOrderType(type)}
                className={`
                  py-2 px-3 rounded-lg text-sm font-medium transition-all
                  ${selectedOrderType === type
                    ? 'bg-primary-700 text-white border border-primary-700'
                    : 'bg-dark-800/50 text-gray-400 hover:bg-primary-700/20 border border-primary-700/30'
                  }
                `}
              >
                {type.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Price Input (for non-market orders) */}
        {!isMarketOrder && (
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Price</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-white focus:outline-none focus:border-primary-700"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
        )}

        {/* Stop Price Input (for stop orders) */}
        {selectedOrderType.includes('stop') && (
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Stop Price</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="number"
                value={stopPrice}
                onChange={(e) => setStopPrice(parseFloat(e.target.value) || 0)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-white focus:outline-none focus:border-primary-700"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">Quantity (Lots)</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-white focus:outline-none focus:border-primary-700"
            placeholder="0.00"
            step="0.01"
            min="0.01"
          />
        </div>

        {/* Leverage Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">Leverage</label>
            <span className="text-sm font-medium text-gold-600">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="125"
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full h-2 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-primary-700"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1x</span>
            <span>25x</span>
            <span>50x</span>
            <span>75x</span>
            <span>100x</span>
            <span>125x</span>
          </div>
        </div>

        {/* Order Summary */}
        <div className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Order Value</span>
            <span className="text-white font-medium">${calculateOrderValue().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Margin Required</span>
            <span className="text-primary-700 font-medium">${calculateMargin().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Free Margin</span>
            <span className="text-white font-medium">${accountInfo.freeMargin.toFixed(2)}</span>
          </div>
        </div>

        {/* Place Order Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handlePlaceOrder}
          className={`
            w-full py-4 rounded-lg font-bold text-white shadow-glow transition-all
            ${isBuy
              ? 'bg-gradient-to-r from-success-600 to-success-500 hover:shadow-glow-green'
              : 'bg-gradient-to-r from-danger-600 to-danger-500 hover:shadow-glow-red'
            }
          `}
        >
          {isBuy ? 'BUY' : 'SELL'} {quantity} {currentSymbol.split('/')[0]}
        </motion.button>

        {/* Settings Button */}
        <button className="w-full py-2 rounded-lg border border-primary-700/30 text-gray-400 hover:text-white hover:bg-primary-700/20 transition-all flex items-center justify-center gap-2">
          <Settings className="w-4 h-4" />
          Advanced Settings
        </button>
      </div>
    </GlassCard>
  );
};

export default OrderEntryPanel;
