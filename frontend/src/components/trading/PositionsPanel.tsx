import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { usePositions, useTradingStore } from '../../stores/tradingStore';
import { Position } from '../../types/trading.types';
import GlassCard from '../ui/GlassCard';
import { toast } from 'react-hot-toast';
import Table from '../ui/Table';

const PositionsPanel: React.FC = () => {
  const positions = usePositions();
  const { closePosition, calculatePnL } = useTradingStore();
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const handleClosePosition = async (positionId: string) => {
    try {
      await closePosition(positionId);
      toast.success('Position closed successfully');
    } catch (error) {
      toast.error('Failed to close position');
    }
  };

  const columns = [
    {
      title: 'Symbol',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (symbol: string, record: Position) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{symbol}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              record.side === 'long'
                ? 'bg-success-500/20 text-success-400'
                : 'bg-danger-500/20 text-danger-400'
            }`}
          >
            {record.side.toUpperCase()}
          </span>
        </div>
      ),
    },
    {
      title: 'Size',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (quantity: number) => <span className="text-sm text-gray-300">{quantity.toFixed(4)}</span>,
    },
    {
      title: 'Entry Price',
      dataIndex: 'entryPrice',
      key: 'entryPrice',
      render: (price: number) => <span className="text-sm text-gray-300">${price.toFixed(2)}</span>,
    },
    {
      title: 'Current Price',
      dataIndex: 'currentPrice',
      key: 'currentPrice',
      render: (price: number) => <span className="text-sm text-gray-300">${price.toFixed(2)}</span>,
    },
    {
      title: 'Unrealized PnL',
      dataIndex: 'unrealizedPnl',
      key: 'unrealizedPnl',
      render: (pnl: number, record: Position) => (
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${
              pnl >= 0 ? 'text-success-500' : 'text-danger-500'
            }`}
          >
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
          <span
            className={`text-xs ${
              record.unrealizedPnlPercent >= 0 ? 'text-success-500' : 'text-danger-500'
            }`}
          >
            ({record.unrealizedPnlPercent >= 0 ? '+' : ''}{record.unrealizedPnlPercent.toFixed(2)}%)
          </span>
        </div>
      ),
    },
    {
      title: 'Margin',
      dataIndex: 'marginUsed',
      key: 'marginUsed',
      render: (margin: number) => <span className="text-sm text-gray-300">${margin.toFixed(2)}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Position) => (
        <button
          onClick={() => handleClosePosition(record.id)}
          className="px-3 py-1.5 rounded-lg bg-danger-500/20 text-danger-500 hover:bg-danger-500/30 transition-colors text-sm font-medium flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Close
        </button>
      ),
    },
  ];

  const totalPnL = positions.reduce((acc, pos) => acc + pos.unrealizedPnl, 0);
  const totalMargin = positions.reduce((acc, pos) => acc + pos.marginUsed, 0);

  return (
    <GlassCard
      title={
        <div className="flex items-center justify-between">
          <span>Open Positions ({positions.length})</span>
          {positions.length > 0 && (
            <div className="flex items-center gap-4">
              <div className={`text-sm font-semibold ${totalPnL >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                PnL: {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      }
      className="h-full"
    >
      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-dark-800/50 flex items-center justify-center mb-4">
            <TrendingUp className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No Open Positions</h3>
          <p className="text-gray-400 max-w-md">
            You don't have any open positions. Place an order to start trading.
          </p>
        </div>
      ) : (
        <Table
          columns={columns}
          data={positions}
          loading={false}
          pagination={{
            current: 1,
            pageSize: 10,
            total: positions.length,
            onChange: () => {},
          }}
          onRowClick={(position) => setSelectedPosition(position)}
        />
      )}
    </GlassCard>
  );
};

export default PositionsPanel;
