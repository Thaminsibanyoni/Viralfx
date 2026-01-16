import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Edit,
  Trash2,
  Pause,
  Play,
  Archive,
  Eye,
  Settings,
  Globe,
  TrendingUp,
  AlertTriangle,
  Save,
  X,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';

interface VPMXMarket {
  id: string;
  symbol: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  category: string;
  vpmxScore: number;
  maxExposure: number;
  regions: string[];
  timeframes: string[];
  createdAt: number;
  createdBy: string;
}

interface MarketFormData {
  symbol: string;
  name: string;
  category: string;
  maxExposure: number;
  regions: string[];
  timeframes: string[];
}

/**
 * VPMX Market Manager
 *
 * Create, edit, pause, archive VPMX markets.
 * This is where admins control what markets exist and how they behave.
 */
const VPMXMarketManager: React.FC = () => {
  const [markets, setMarkets] = useState<VPMXMarket[]>([
    {
      id: '1',
      symbol: 'V:ZA:ENT:ZINHLEXD',
      name: 'Zinhle XD - New Album',
      status: 'active',
      category: 'Entertainment',
      vpmxScore: 95,
      maxExposure: 5000000,
      regions: ['ZA', 'NG', 'KE'],
      timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'],
      createdAt: Date.now() - 86400000 * 7,
      createdBy: 'admin@viralfx.com',
    },
    {
      id: '2',
      symbol: 'V:ZA:TECH:ELONMUSK',
      name: 'Elon Musk Tech Vision',
      status: 'active',
      category: 'Technology',
      vpmxScore: 88,
      maxExposure: 3000000,
      regions: ['ZA', 'GLOBAL'],
      timeframes: ['5m', '15m', '1h', '4h', '1d'],
      createdAt: Date.now() - 86400000 * 3,
      createdBy: 'admin@viralfx.com',
    },
    {
      id: '3',
      symbol: 'V:VE:POL:CRISIS',
      name: 'Venezuela Political Crisis',
      status: 'paused',
      category: 'Politics',
      vpmxScore: 92,
      maxExposure: 2000000,
      regions: ['VE', 'CO', 'BR'],
      timeframes: ['15m', '1h', '1d'],
      createdAt: Date.now() - 86400000 * 14,
      createdBy: 'admin@viralfx.com',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMarket, setEditingMarket] = useState<VPMXMarket | null>(null);
  const [formData, setFormData] = useState<MarketFormData>({
    symbol: '',
    name: '',
    category: '',
    maxExposure: 1000000,
    regions: ['ZA'],
    timeframes: ['1m', '5m', '15m', '1h', '1d'],
  });

  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all');

  const handleCreateMarket = () => {
    const newMarket: VPMXMarket = {
      id: Date.now().toString(),
      symbol: formData.symbol,
      name: formData.name,
      status: 'active',
      category: formData.category,
      vpmxScore: 0,
      maxExposure: formData.maxExposure,
      regions: formData.regions,
      timeframes: formData.timeframes,
      createdAt: Date.now(),
      createdBy: 'admin@viralfx.com',
    };

    setMarkets([newMarket, ...markets]);
    setShowCreateModal(false);
    resetForm();
  };

  const handleUpdateMarket = () => {
    if (!editingMarket) return;

    setMarkets(markets.map(m =>
      m.id === editingMarket.id
        ? { ...m, ...formData }
        : m
    ));
    setEditingMarket(null);
    resetForm();
  };

  const handlePauseMarket = (marketId: string) => {
    setMarkets(markets.map(m =>
      m.id === marketId
        ? { ...m, status: m.status === 'active' ? 'paused' : 'active' }
        : m
    ));
  };

  const handleArchiveMarket = (marketId: string) => {
    if (confirm('Are you sure you want to archive this market?')) {
      setMarkets(markets.map(m =>
        m.id === marketId
          ? { ...m, status: 'archived' }
          : m
      ));
    }
  };

  const handleDeleteMarket = (marketId: string) => {
    if (confirm('Are you sure you want to delete this market? This cannot be undone.')) {
      setMarkets(markets.filter(m => m.id !== marketId));
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      name: '',
      category: '',
      maxExposure: 1000000,
      regions: ['ZA'],
      timeframes: ['1m', '5m', '15m', '1h', '1d'],
    });
  };

  const openEditModal = (market: VPMXMarket) => {
    setEditingMarket(market);
    setFormData({
      symbol: market.symbol,
      name: market.name,
      category: market.category,
      maxExposure: market.maxExposure,
      regions: market.regions,
      timeframes: market.timeframes,
    });
  };

  const toggleRegion = (region: string) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.includes(region)
        ? prev.regions.filter(r => r !== region)
        : [...prev.regions, region]
    }));
  };

  const toggleTimeframe = (timeframe: string) => {
    setFormData(prev => ({
      ...prev,
      timeframes: prev.timeframes.includes(timeframe)
        ? prev.timeframes.filter(t => t !== timeframe)
        : [...prev.timeframes, timeframe]
    }));
  };

  const filteredMarkets = markets.filter(m =>
    filter === 'all' ? true : m.status === filter
  );

  const AVAILABLE_REGIONS = ['ZA', 'NG', 'KE', 'GH', 'EG', 'VE', 'CO', 'BR', 'GLOBAL'];
  const AVAILABLE_TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
  const CATEGORIES = ['Entertainment', 'Technology', 'Politics', 'Sports', 'Music', 'Fashion', 'Business'];

  return (
    <div className="min-h-screen bg-dark-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-viral bg-clip-text text-transparent mb-2">
              VPMX Market Manager
            </h1>
            <p className="text-gray-400">Create, pause, archive VPMX markets</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary-700 to-purple-700 text-white font-bold flex items-center gap-2 hover:shadow-glow transition-all"
          >
            <Plus className="w-5 h-5" />
            Create Market
          </button>
        </div>
      </div>

      {/* Filters */}
      <GlassCard className="mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'all'
                ? 'bg-primary-700 text-white shadow-glow'
                : 'bg-dark-800/50 text-gray-400 hover:bg-primary-700/20'
            }`}
          >
            All ({markets.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'active'
                ? 'bg-success-500 text-white shadow-glow-green'
                : 'bg-dark-800/50 text-gray-400 hover:bg-success-500/20'
            }`}
          >
            Active ({markets.filter(m => m.status === 'active').length})
          </button>
          <button
            onClick={() => setFilter('paused')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'paused'
                ? 'bg-warning-500 text-white shadow-glow-orange'
                : 'bg-dark-800/50 text-gray-400 hover:bg-warning-500/20'
            }`}
          >
            Paused ({markets.filter(m => m.status === 'paused').length})
          </button>
          <button
            onClick={() => setFilter('archived')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === 'archived'
                ? 'bg-gray-500 text-white'
                : 'bg-dark-800/50 text-gray-400 hover:bg-gray-500/20'
            }`}
          >
            Archived ({markets.filter(m => m.status === 'archived').length})
          </button>
        </div>
      </GlassCard>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredMarkets.map((market, index) => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`
              p-6 rounded-2xl border transition-all
              ${market.status === 'active' ? 'bg-success-500/5 border-success-500/30' :
                market.status === 'paused' ? 'bg-warning-500/5 border-warning-500/30' :
                'bg-gray-500/5 border-gray-500/30'}
            `}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">{market.symbol}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    market.status === 'active' ? 'bg-success-500/20 text-success-500 border-success-500/30' :
                    market.status === 'paused' ? 'bg-warning-500/20 text-warning-500 border-warning-500/30' :
                    'bg-gray-500/20 text-gray-500 border-gray-500/30'
                  }`}>
                    {market.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{market.name}</p>
                <p className="text-xs text-gray-500 mt-1">{market.category}</p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black ${market.vpmxScore >= 90 ? 'text-gold-600' : 'text-primary-700'}`}>
                  {market.vpmxScore}
                </div>
                <div className="text-[10px] text-gray-500">VPMX</div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 mb-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Max Exposure</span>
                <span className="font-bold text-white">${(market.maxExposure / 1000000).toFixed(1)}M</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Regions</span>
                <div className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-gray-500" />
                  <span className="font-bold text-white">{market.regions.join(', ')}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Timeframes</span>
                <span className="font-bold text-white">{market.timeframes.length} available</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-bold text-white">{new Date(market.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-4 border-t border-primary-700/20">
              <button
                onClick={() => openEditModal(market)}
                className="flex-1 py-2 rounded-lg bg-primary-700/20 text-primary-700 text-xs font-bold hover:bg-primary-700/30 transition-all flex items-center justify-center gap-1"
              >
                <Edit className="w-3 h-3" />
                Edit
              </button>
              <button
                onClick={() => handlePauseMarket(market.id)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  market.status === 'active'
                    ? 'bg-warning-500/20 text-warning-500 hover:bg-warning-500/30'
                    : 'bg-success-500/20 text-success-500 hover:bg-success-500/30'
                }`}
              >
                {market.status === 'active' ? (
                  <>
                    <Pause className="w-3 h-3" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    Resume
                  </>
                )}
              </button>
              {market.status !== 'archived' && (
                <button
                  onClick={() => handleArchiveMarket(market.id)}
                  className="py-2 px-3 rounded-lg bg-gray-500/20 text-gray-500 text-xs font-bold hover:bg-gray-500/30 transition-all"
                  title="Archive"
                >
                  <Archive className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => handleDeleteMarket(market.id)}
                className="py-2 px-3 rounded-lg bg-danger-500/20 text-danger-500 text-xs font-bold hover:bg-danger-500/30 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingMarket) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-900 border border-primary-700/30 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">
                {editingMarket ? 'Edit Market' : 'Create New Market'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingMarket(null);
                  resetForm();
                }}
                className="p-2 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Symbol */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  VTS Symbol
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData({ ...formData, symbol: e.target.value })}
                  placeholder="V:CC:SEC:TICKER"
                  className="w-full px-4 py-3 rounded-xl bg-dark-800/50 border border-primary-700/30 text-white text-sm focus:outline-none focus:border-primary-700"
                  disabled={!!editingMarket}
                />
                <p className="text-xs text-gray-500 mt-1">Format: V:CC:SEC:TICKER (e.g., V:ZA:ENT:ZINHLEXD)</p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Market Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Zinhle XD - New Album"
                  className="w-full px-4 py-3 rounded-xl bg-dark-800/50 border border-primary-700/30 text-white text-sm focus:outline-none focus:border-primary-700"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-dark-800/50 border border-primary-700/30 text-white text-sm focus:outline-none focus:border-primary-700"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Max Exposure */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Max Exposure ($)
                </label>
                <input
                  type="number"
                  value={formData.maxExposure}
                  onChange={(e) => setFormData({ ...formData, maxExposure: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl bg-dark-800/50 border border-primary-700/30 text-white text-sm focus:outline-none focus:border-primary-700"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum total exposure allowed for this market</p>
              </div>

              {/* Regions */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Available Regions
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_REGIONS.map(region => (
                    <button
                      key={region}
                      onClick={() => toggleRegion(region)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.regions.includes(region)
                          ? 'bg-primary-700 text-white'
                          : 'bg-dark-800/50 text-gray-400 hover:bg-primary-700/20'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframes */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-2">
                  Available Timeframes
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TIMEFRAMES.map(timeframe => (
                    <button
                      key={timeframe}
                      onClick={() => toggleTimeframe(timeframe)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        formData.timeframes.includes(timeframe)
                          ? 'bg-primary-700 text-white'
                          : 'bg-dark-800/50 text-gray-400 hover:bg-primary-700/20'
                      }`}
                    >
                      {timeframe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={editingMarket ? handleUpdateMarket : handleCreateMarket}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary-700 to-purple-700 text-white font-bold flex items-center justify-center gap-2 hover:shadow-glow transition-all"
                >
                  <Save className="w-4 h-4" />
                  {editingMarket ? 'Update Market' : 'Create Market'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingMarket(null);
                    resetForm();
                  }}
                  className="px-6 py-3 rounded-xl bg-dark-800/50 border border-primary-700/30 text-gray-400 font-semibold hover:bg-primary-700/20 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default VPMXMarketManager;
