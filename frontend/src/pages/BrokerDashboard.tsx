import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  UserPlus,
  BarChart3,
  MessageSquare,
  Crown,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBrokerStore } from '../stores/brokerStore';
import { BrokerClient } from '../types/broker';
import { toast } from 'react-hot-toast';
import dayjs from 'dayjs';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import Table from '../components/ui/Table';
import Tabs from '../components/ui/Tabs';
import Progress from '../components/ui/Progress';

const BrokerDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const {
    broker,
    brokerStats,
    brokerClients,
    brokerAnalytics,
    fetchBrokerData,
    fetchBrokerAnalytics,
  } = useBrokerStore();

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'days'),
    dayjs(),
  ]);
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        await fetchBrokerData();
      } catch (error) {
        toast.error('Failed to load broker data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchBrokerData]);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (dateRange) {
        try {
          setAnalyticsLoading(true);
          await fetchBrokerAnalytics({
            startDate: dateRange[0].toISOString(),
            endDate: dateRange[1].toISOString(),
          });
        } catch (error) {
          toast.error('Failed to load analytics data');
        } finally {
          setAnalyticsLoading(false);
        }
      }
    };

    loadAnalytics();
  }, [dateRange, fetchBrokerAnalytics]);

  const getCommissionProgress = () => {
    if (!brokerStats) return 0;
    const monthlyTarget = 50000;
    return Math.min((brokerStats.totalCommission / monthlyTarget) * 100, 100);
  };

  const getTierProgress = () => {
    if (!broker) return 0;
    const currentTierIndex = ['STARTER', 'VERIFIED', 'PREMIUM', 'ENTERPRISE'].indexOf(
      broker.tier
    );
    const maxTierIndex = 3;
    return ((currentTierIndex + 1) / (maxTierIndex + 1)) * 100;
  };

  // Client table columns
  const clientColumns = [
    {
      title: 'Client',
      dataIndex: 'client',
      key: 'client',
      render: (_: any, record: BrokerClient) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-purple flex items-center justify-center text-white font-semibold shadow-glow">
            {record.client?.firstName?.[0] || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {record.client?.firstName} {record.client?.lastName}
            </p>
            <p className="text-xs text-gray-400">{record.client?.email}</p>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'ACTIVE'
              ? 'bg-success-500/20 text-success-400'
              : status === 'PENDING'
              ? 'bg-warning-500/20 text-warning-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      title: 'Total Volume',
      dataIndex: 'totalVolume',
      key: 'totalVolume',
      render: (volume: number) => (
        <span className="text-sm text-gray-300">
          R{volume.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Commission',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      render: (commission: number) => (
        <span className="text-sm font-semibold text-success-500">
          R{commission.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span className="text-sm text-gray-400">
          {dayjs(date).format('MMM DD, YYYY')}
        </span>
      ),
    },
  ];

  // Bills table columns
  const billColumns = [
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      render: (period: string) => (
        <span className="text-sm font-medium text-gray-300">{period}</span>
      ),
    },
    {
      title: 'Commission',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      render: (amount: number) => (
        <span className="text-sm text-gray-300">R{amount.toLocaleString()}</span>
      ),
    },
    {
      title: 'Bonus',
      dataIndex: 'bonusAmount',
      key: 'bonusAmount',
      render: (amount: number) => (
        <span className="text-sm font-semibold text-gold-600">
          +R{amount.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount: number) => (
        <span className="text-sm font-bold text-primary-700">
          R{amount.toLocaleString()}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            status === 'PAID'
              ? 'bg-success-500/20 text-success-400'
              : status === 'PENDING'
              ? 'bg-warning-500/20 text-warning-400'
              : 'bg-gray-500/20 text-gray-400'
          }`}
        >
          {status}
        </span>
      ),
    },
  ];

  const renderOverview = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Total Clients"
          value={brokerStats?.totalClients || 0}
          trend="up"
          trendValue="+12.5%"
          variant="purple"
          delay={0}
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6" />}
          label="Total Commission"
          value={brokerStats?.totalCommission || 0}
          prefix="R"
          trend="up"
          trendValue="+18.2%"
          variant="success"
          delay={100}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="Monthly Volume"
          value={brokerStats?.monthlyVolume || 0}
          prefix="R"
          trend="up"
          trendValue="+8.7%"
          variant="gold"
          delay={200}
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Active Now"
          value={brokerStats?.activeClients || 0}
          trend="neutral"
          trendValue="Live"
          variant="warning"
          delay={300}
        />
      </div>

      {/* Progress Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <GlassCard title="Monthly Commission Target" className="h-full">
          <div className="space-y-4">
            <Progress
              percent={getCommissionProgress()}
              format={(percent) => `${percent?.toFixed(1)}%`}
            />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">
                Current: R{(brokerStats?.totalCommission || 0).toLocaleString()}
              </span>
              <span className="text-gray-400">Target: R50,000</span>
            </div>
          </div>
        </GlassCard>

        <GlassCard title="Tier Progress" className="h-full">
          <div className="space-y-4">
            <Progress
              percent={getTierProgress()}
              format={(percent) => `${percent?.toFixed(0)}%`}
            />
            <div className="flex justify-between items-center">
              <span className="px-3 py-1 rounded-full bg-primary-700/20 text-primary-700 text-sm font-medium">
                {broker?.tier || 'STARTER'}
              </span>
              <span className="text-gray-400 text-sm">Next: Premium</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard title="Recent Client Activity" hoverable>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-success-500/20 text-success-500 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="absolute top-12 left-1/2 w-0.5 h-16 bg-primary-700/30 -translate-x-1/2" />
                </div>
                <div className="flex-1 pb-6">
                  <p className="text-sm font-semibold text-white">New client registered</p>
                  <p className="text-sm text-gray-400 mt-1">John Doe joined 2 hours ago</p>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    2 hours ago
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gold-600/20 text-gold-600 flex items-center justify-center">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="absolute top-12 left-1/2 w-0.5 h-16 bg-primary-700/30 -translate-x-1/2" />
                </div>
                <div className="flex-1 pb-6">
                  <p className="text-sm font-semibold text-white">Commission earned</p>
                  <p className="text-sm text-gray-400 mt-1">R250 from client trades</p>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    5 hours ago
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div>
                  <div className="w-10 h-10 rounded-full bg-primary-700/20 text-primary-700 flex items-center justify-center">
                    <Crown className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">Tier upgrade achieved</p>
                  <p className="text-sm text-gray-400 mt-1">Moved to Verified tier</p>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    1 day ago
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        <div>
          <GlassCard title="Quick Actions" className="h-full">
            <div className="space-y-3">
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-viral text-white font-medium shadow-glow hover:shadow-glow-gold transition-all hover:scale-105">
                <UserPlus className="w-4 h-4" />
                Invite New Client
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-primary-700/30 text-gray-300 font-medium hover:bg-primary-700/20 transition-all">
                <BarChart3 className="w-4 h-4" />
                View Analytics
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-primary-700/30 text-gray-300 font-medium hover:bg-primary-700/20 transition-all">
                <MessageSquare className="w-4 h-4" />
                Contact Support
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );

  const renderClients = () => (
    <GlassCard
      title="Client Management"
      extra={
        <button className="px-4 py-2 rounded-lg bg-gradient-viral text-white font-medium shadow-glow hover:shadow-glow-gold transition-all hover:scale-105 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Invite Client
        </button>
      }
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <select
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 focus:outline-none focus:border-primary-700 appearance-none cursor-pointer"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <select
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 focus:outline-none focus:border-primary-700 appearance-none cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="createdAt">Sort by Join Date</option>
              <option value="totalVolume">Sort by Volume</option>
              <option value="totalCommission">Sort by Commission</option>
            </select>
            <ArrowUpRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <Table
        columns={clientColumns}
        data={brokerClients || []}
        loading={loading}
        pagination={{
          current: 1,
          pageSize: 10,
          total: brokerClients?.length || 0,
          onChange: () => {},
        }}
        onRowClick={(client) => console.log('Client clicked:', client)}
      />
    </GlassCard>
  );

  const renderAnalytics = () => (
    <GlassCard title="Analytics Dashboard">
      {/* Date Range and Metric Selectors */}
      <div className="flex flex-wrap gap-3 mb-8">
        <div className="flex-1 min-w-[300px]">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-300">
              {dateRange[0].format('MMM DD, YYYY')} - {dateRange[1].format('MMM DD, YYYY')}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <select
            className="w-full px-4 py-2.5 rounded-lg bg-dark-800/50 border border-primary-700/30 text-gray-300 focus:outline-none focus:border-primary-700 appearance-none cursor-pointer"
            defaultValue="revenue"
          >
            <option value="revenue">Revenue</option>
            <option value="clients">Clients</option>
            <option value="volume">Volume</option>
          </select>
        </div>
      </div>

      {/* Placeholder for Analytics Charts */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-gradient-purple flex items-center justify-center mb-6 shadow-glow">
          <BarChart3 className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Analytics Charts Coming Soon</h3>
        <p className="text-gray-400 max-w-md">
          Detailed analytics and reporting dashboard will be available here, including
          revenue trends, client growth, and performance metrics.
        </p>
      </div>
    </GlassCard>
  );

  const renderBills = () => (
    <GlassCard title="Commission Bills">
      <Table
        columns={billColumns}
        data={[]} // Would come from brokerBills
        loading={loading}
        pagination={{
          current: 1,
          pageSize: 10,
          total: 0,
          onChange: () => {},
        }}
        onRowClick={(bill) => console.log('Bill clicked:', bill)}
      />
    </GlassCard>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'clients':
        return renderClients();
      case 'analytics':
        return renderAnalytics();
      case 'bills':
        return renderBills();
      default:
        return renderOverview();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-purple flex items-center justify-center mx-auto mb-4 shadow-glow animate-pulse">
            <BarChart3 className="w-10 h-10 text-white" />
          </div>
          <p className="text-gray-400 text-lg">Loading broker dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-viral bg-clip-text text-transparent mb-2">
            Broker Dashboard
          </h1>
          <p className="text-gray-400">
            Manage your brokerage business and track performance
          </p>
        </div>
        {broker && (
          <div className="flex items-center gap-4 px-6 py-4 bg-gradient-gold rounded-xl shadow-glow-gold border border-gold-600/30">
            <Crown className="w-6 h-6 text-gold-800" />
            <div>
              <div className="text-sm font-bold text-gold-900">{broker.tier}</div>
              <div className="text-xs text-gold-800">{broker.companyName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'clients', label: 'Clients' },
          { key: 'analytics', label: 'Analytics' },
          { key: 'bills', label: 'Bills' },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
};

export default BrokerDashboard;
