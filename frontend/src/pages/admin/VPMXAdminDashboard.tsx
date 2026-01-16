import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Database,
  TrendingUp,
  Shield,
  Zap,
  Eye,
  Settings,
  Pause,
  Play,
  RotateCw,
  Download,
  BarChart3,
  Plus,
} from 'lucide-react';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';

interface VPMXMarketStatus {
  id: string;
  symbol: string;
  name: string;
  status: 'active' | 'paused' | 'frozen' | 'archived';
  vpmxScore: number;
  exposure: number;
  longShortRatio: number;
  liquidity: number;
  volatility: number;
  region: string[];
  lastUpdate: number;
}

interface OracleHealth {
  source: string;
  status: 'active' | 'degraded' | 'offline';
  confidence: number;
  deceptionRisk: number;
  signalsToday: number;
  lastSignal: number;
}

interface SystemAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  severity: 'high' | 'medium' | 'low';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

/**
 * VPMX Admin Dashboard
 *
 * Central command center for VPMX market governance.
 * Think of this as the "Federal Reserve" dashboard for ViralFX.
 *
 * Features:
 * - Live market status across all VPMX markets
 * - Total exposure and risk overview
 * - Oracle health monitoring
 * - Circuit breaker status
 * - Real-time alerts
 */
const VPMXAdminDashboard: React.FC = () => {
  const [markets, setMarkets] = useState<VPMXMarketStatus[]>([]);
  const [oracleHealth, setOracleHealth] = useState<OracleHealth[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [systemStatus, setSystemStatus] = useState({
    totalExposure: 0,
    activeMarkets: 0,
    pausedMarkets: 0,
    frozenMarkets: 0,
    circuitBreakersActive: 0,
    avgConfidence: 0,
  });

  // Mock data - in production, fetch from APIs
  useEffect(() => {
    // Mock markets
    const mockMarkets: VPMXMarketStatus[] = [
      {
        id: '1',
        symbol: 'V:ZA:ENT:ZINHLEXD',
        name: 'Zinhle XD - New Album',
        status: 'active',
        vpmxScore: 95,
        exposure: 2500000,
        longShortRatio: 1.8,
        liquidity: 85,
        volatility: 12.5,
        region: ['ZA', 'NG', 'KE'],
        lastUpdate: Date.now(),
      },
      {
        id: '2',
        symbol: 'V:ZA:TECH:ELONMUSK',
        name: 'Elon Musk Tech Vision',
        status: 'active',
        vpmxScore: 88,
        exposure: 1800000,
        longShortRatio: 1.2,
        liquidity: 72,
        volatility: 8.3,
        region: ['ZA', 'GLOBAL'],
        lastUpdate: Date.now() - 30000,
      },
      {
        id: '3',
        symbol: 'V:VE:POL:CRISIS',
        name: 'Venezuela Political Crisis',
        status: 'frozen',
        vpmxScore: 92,
        exposure: 950000,
        longShortRatio: 0.6,
        liquidity: 45,
        volatility: 35.7,
        region: ['VE', 'CO', 'BR'],
        lastUpdate: Date.now() - 120000,
      },
    ];

    // Mock oracle health
    const mockOracleHealth: OracleHealth[] = [
      {
        source: 'Twitter API',
        status: 'active',
        confidence: 94,
        deceptionRisk: 8,
        signalsToday: 15420,
        lastSignal: Date.now() - 5000,
      },
      {
        source: 'TikTok API',
        status: 'active',
        confidence: 89,
        deceptionRisk: 15,
        signalsToday: 28750,
        lastSignal: Date.now() - 3000,
      },
      {
        source: 'Instagram API',
        status: 'degraded',
        confidence: 76,
        deceptionRisk: 22,
        signalsToday: 8900,
        lastSignal: Date.now() - 45000,
      },
      {
        source: 'Reddit API',
        status: 'active',
        confidence: 91,
        deceptionRisk: 12,
        signalsToday: 12300,
        lastSignal: Date.now() - 12000,
      },
    ];

    // Mock alerts
    const mockAlerts: SystemAlert[] = [
      {
        id: '1',
        type: 'critical',
        severity: 'high',
        message: 'V:VE:POL:CRISIS - Volatility exceeded 35%, auto-frozen',
        timestamp: Date.now() - 300000,
        acknowledged: false,
      },
      {
        id: '2',
        type: 'warning',
        severity: 'medium',
        message: 'Instagram API degraded - confidence score dropped to 76%',
        timestamp: Date.now() - 600000,
        acknowledged: false,
      },
      {
        id: '3',
        type: 'info',
        severity: 'low',
        message: 'New VPMX market created: V:ZA:MUSIC:TIWA',
        timestamp: Date.now() - 900000,
        acknowledged: true,
      },
    ];

    setMarkets(mockMarkets);
    setOracleHealth(mockOracleHealth);
    setAlerts(mockAlerts);
    setSystemStatus({
      totalExposure: 5250000,
      activeMarkets: 2,
      pausedMarkets: 0,
      frozenMarkets: 1,
      circuitBreakersActive: 1,
      avgConfidence: 87.5,
    });
  }, []);

  const handleMarketAction = (marketId: string, action: 'pause' | 'resume' | 'freeze') => {
    console.log(`Market ${marketId}: ${action}`);
    // API call to update market status
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(alerts.map(a =>
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success-500 bg-success-500/20 border-success-500/30';
      case 'paused': return 'text-warning-500 bg-warning-500/20 border-warning-500/30';
      case 'frozen': return 'text-danger-500 bg-danger-500/20 border-danger-500/30';
      case 'archived': return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
      default: return 'text-gray-500';
    }
  };

  const getOracleStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-success-500';
      case 'degraded': return 'text-warning-500';
      case 'offline': return 'text-danger-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-viral bg-clip-text text-transparent mb-2">
              VPMX Admin Dashboard
            </h1>
            <p className="text-gray-400">Market governance & risk control center</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary-700 to-purple-700 text-white font-semibold flex items-center gap-2 hover:shadow-glow transition-all">
              <Settings className="w-4 h-4" />
              System Settings
            </button>
            <button className="px-4 py-2 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 font-semibold flex items-center gap-2 hover:bg-primary-700/20 transition-all">
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Total Exposure"
          value={`$${(systemStatus.totalExposure / 1000000).toFixed(1)}M`}
          trend="up"
          trendValue="+12.5%"
          variant="purple"
          delay={0}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Active Markets"
          value={systemStatus.activeMarkets}
          trend={systemStatus.pausedMarkets > 0 ? 'down' : 'up'}
          trendValue={systemStatus.pausedMarkets > 0 ? `${systemStatus.pausedMarkets} paused` : 'All running'}
          variant="gold"
          delay={1}
        />
        <StatCard
          icon={<Shield className="w-6 h-6" />}
          label="Circuit Breakers"
          value={systemStatus.circuitBreakersActive}
          trend={systemStatus.circuitBreakersActive > 0 ? 'down' : 'up'}
          trendValue={systemStatus.circuitBreakersActive > 0 ? 'Active' : 'Clear'}
          variant={systemStatus.circuitBreakersActive > 0 ? 'default' : 'purple'}
          delay={2}
        />
        <StatCard
          icon={<Database className="w-6 h-6" />}
          label="Oracle Confidence"
          value={`${systemStatus.avgConfidence}%`}
          trend="up"
          trendValue="+2.3%"
          variant="gold"
          delay={3}
        />
      </div>

      {/* Critical Alerts */}
      {alerts.filter(a => !a.acknowledged).length > 0 && (
        <GlassCard title="Critical Alerts" className="mb-8 !border-danger-500/50">
          <div className="space-y-3">
            {alerts.filter(a => !a.acknowledged).map((alert) => (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`
                  p-4 rounded-lg border-l-4 flex items-start justify-between
                  ${alert.type === 'critical' ? 'bg-danger-500/10 border-danger-500' :
                    alert.type === 'warning' ? 'bg-warning-500/10 border-warning-500' :
                    'bg-info-500/10 border-info-500'}
                `}
              >
                <div className="flex items-start gap-3">
                  {alert.type === 'critical' && <AlertTriangle className="w-5 h-5 text-danger-500 flex-shrink-0" />}
                  {alert.type === 'warning' && <Zap className="w-5 h-5 text-warning-500 flex-shrink-0" />}
                  {alert.type === 'info' && <Activity className="w-5 h-5 text-info-500 flex-shrink-0" />}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase text-gray-400">
                        {alert.severity} Priority
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-white font-medium">{alert.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="px-3 py-1 rounded-lg bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-all"
                >
                  Acknowledge
                </button>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Markets & Oracle Health (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* VPMX Markets */}
          <GlassCard
            title="VPMX Markets"
            className="!border-primary-700/30"
            extra={
              <button className="text-primary-700 text-sm font-semibold hover:text-primary-600 transition-all flex items-center gap-1">
                <Eye className="w-4 h-4" />
                Manage Markets
              </button>
            }
          >
            <div className="space-y-3">
              {markets.map((market, index) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 rounded-xl bg-dark-900/50 border border-primary-700/20 hover:border-primary-700/40 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-white">{market.symbol}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(market.status)}`}>
                          {market.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{market.name}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-black ${market.vpmxScore >= 90 ? 'text-gold-600' : 'text-primary-700'}`}>
                        {market.vpmxScore}
                      </div>
                      <div className="text-[10px] text-gray-500">VPMX</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-3 text-[10px]">
                    <div className="text-center p-2 rounded-lg bg-dark-800/50">
                      <div className="text-gray-500 mb-1">Exposure</div>
                      <div className="font-bold text-white">${(market.exposure / 1000000).toFixed(1)}M</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-dark-800/50">
                      <div className="text-gray-500 mb-1">L/S Ratio</div>
                      <div className="font-bold text-white">{market.longShortRatio.toFixed(1)}</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-dark-800/50">
                      <div className="text-gray-500 mb-1">Liquidity</div>
                      <div className={`font-bold ${market.liquidity >= 70 ? 'text-success-500' : market.liquidity >= 50 ? 'text-warning-500' : 'text-danger-500'}`}>
                        {market.liquidity}%
                      </div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-dark-800/50">
                      <div className="text-gray-500 mb-1">Volatility</div>
                      <div className={`font-bold ${market.volatility <= 10 ? 'text-success-500' : market.volatility <= 25 ? 'text-warning-500' : 'text-danger-500'}`}>
                        {market.volatility}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {market.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleMarketAction(market.id, 'pause')}
                          className="flex-1 py-2 rounded-lg bg-warning-500/20 text-warning-500 text-xs font-bold hover:bg-warning-500/30 transition-all flex items-center justify-center gap-1"
                        >
                          <Pause className="w-3 h-3" />
                          Pause
                        </button>
                        <button
                          onClick={() => handleMarketAction(market.id, 'freeze')}
                          className="flex-1 py-2 rounded-lg bg-danger-500/20 text-danger-500 text-xs font-bold hover:bg-danger-500/30 transition-all flex items-center justify-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Freeze
                        </button>
                      </>
                    )}
                    {market.status === 'paused' && (
                      <button
                        onClick={() => handleMarketAction(market.id, 'resume')}
                        className="flex-1 py-2 rounded-lg bg-success-500/20 text-success-500 text-xs font-bold hover:bg-success-500/30 transition-all flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        Resume
                      </button>
                    )}
                    {market.status === 'frozen' && (
                      <button
                        onClick={() => handleMarketAction(market.id, 'resume')}
                        className="flex-1 py-2 rounded-lg bg-primary-700/20 text-primary-700 text-xs font-bold hover:bg-primary-700/30 transition-all flex items-center justify-center gap-1"
                      >
                        <Shield className="w-3 h-3" />
                        Review & Thaw
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Oracle Health */}
          <GlassCard
            title="Oracle Health"
            className="!border-primary-700/30"
            extra={
              <button className="text-primary-700 text-sm font-semibold hover:text-primary-600 transition-all flex items-center gap-1">
                <Settings className="w-4 h-4" />
                Configure
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {oracleHealth.map((oracle, index) => (
                <motion.div
                  key={oracle.source}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 rounded-xl border ${
                    oracle.status === 'active' ? 'bg-success-500/10 border-success-500/30' :
                    oracle.status === 'degraded' ? 'bg-warning-500/10 border-warning-500/30' :
                    'bg-danger-500/10 border-danger-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{oracle.source}</h4>
                      <span className={`text-xs font-bold uppercase ${getOracleStatusColor(oracle.status)}`}>
                        {oracle.status}
                      </span>
                    </div>
                    <Activity className={`w-4 h-4 ${getOracleStatusColor(oracle.status)}`} />
                  </div>

                  <div className="space-y-2 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Confidence</span>
                      <span className={`font-bold ${oracle.confidence >= 90 ? 'text-success-500' : oracle.confidence >= 70 ? 'text-warning-500' : 'text-danger-500'}`}>
                        {oracle.confidence}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Deception Risk</span>
                      <span className={`font-bold ${oracle.deceptionRisk <= 10 ? 'text-success-500' : oracle.deceptionRisk <= 20 ? 'text-warning-500' : 'text-danger-500'}`}>
                        {oracle.deceptionRisk}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Signals Today</span>
                      <span className="font-bold text-white">{oracle.signalsToday.toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right Column - Quick Actions & System Info (1/3) */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <GlassCard title="Quick Actions" className="!border-gold-600/30">
            <div className="space-y-2">
              <button className="w-full py-3 rounded-lg bg-gradient-to-r from-primary-700 to-purple-700 text-white text-sm font-bold hover:shadow-glow transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                Create New Market
              </button>
              <button className="w-full py-3 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 text-sm font-semibold hover:bg-primary-700/20 transition-all flex items-center justify-center gap-2">
                <RotateCw className="w-4 h-4" />
                Rebuild Candles
              </button>
              <button className="w-full py-3 rounded-lg bg-dark-800/50 border border-warning-500/30 text-warning-500 text-sm font-semibold hover:bg-warning-500/20 transition-all flex items-center justify-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Trigger Circuit Breaker
              </button>
              <button className="w-full py-3 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 text-sm font-semibold hover:bg-primary-700/20 transition-all flex items-center justify-center gap-2">
                <BarChart3 className="w-4 h-4" />
                View Risk Report
              </button>
            </div>
          </GlassCard>

          {/* System Status */}
          <GlassCard title="System Status" className="!border-primary-700/30">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-dark-900/50">
                <span className="text-sm text-gray-400">Candle Engine</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-success-500">Running</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-dark-900/50">
                <span className="text-sm text-gray-400">Oracle Aggregator</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-success-500">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-dark-900/50">
                <span className="text-sm text-gray-400">Risk Engine</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-success-500">Monitoring</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-dark-900/50">
                <span className="text-sm text-gray-400">Audit Log</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success-500"></div>
                  <span className="text-xs font-bold text-success-500">Recording</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Recent Audit Log */}
          <GlassCard
            title="Recent Actions"
            className="!border-primary-700/30"
            extra={
              <button className="text-primary-700 text-xs font-semibold hover:text-primary-600 transition-all">
                View All
              </button>
            }
          >
            <div className="space-y-2 text-[10px]">
              <div className="p-2 rounded-lg bg-dark-900/50 border-l-2 border-success-500">
                <div className="text-gray-400 mb-1">{new Date().toLocaleTimeString()}</div>
                <div className="text-white">Market V:VE:POL:CRISIS auto-frozen (volatility alert)</div>
              </div>
              <div className="p-2 rounded-lg bg-dark-900/50 border-l-2 border-warning-500">
                <div className="text-gray-400 mb-1">{new Date(Date.now() - 300000).toLocaleTimeString()}</div>
                <div className="text-white">Instagram API downgraded to degraded status</div>
              </div>
              <div className="p-2 rounded-lg bg-dark-900/50 border-l-2 border-primary-500">
                <div className="text-gray-400 mb-1">{new Date(Date.now() - 600000).toLocaleTimeString()}</div>
                <div className="text-white">Admin manually paused V:ZA:SPORTS:RUGBY</div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default VPMXAdminDashboard;
