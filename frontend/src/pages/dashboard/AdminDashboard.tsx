import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Activity,
  MessageSquare,
  Shield,
  Database,
  Server,
  Settings,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Search,
  Filter,
  Download,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { adminApi } from '../../services/api/admin.api';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import Table from '../../components/ui/Table';
import Tabs from '../../components/ui/Tabs';
import Progress from '../../components/ui/Progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// Types
interface AdminStats {
  totalUsers: number;
  activeTraders: number;
  pendingKYC: number;
  flaggedContent: number;
  systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  apiResponseTime: number;
  dbConnections: number;
  queueSize: number;
  errorRate: number;
  totalVolume: number;
  dailyActive: number;
  weeklyActive: number;
  monthlyActive: number;
}

interface ModerationItem {
  id: string;
  type: 'USER' | 'CONTENT' | 'TRADE';
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reportedBy: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface User {
  id: string;
  email: string;
  username: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  registrationDate: string;
  lastLogin: string;
  totalTrades: number;
  totalVolume: number;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
}

interface ActivityItem {
  id: string;
  type: 'USER_REGISTERED' | 'TRADE_EXECUTED' | 'KYC_SUBMITTED' | 'SYSTEM_ALERT';
  title: string;
  description: string;
  timestamp: string;
  userId?: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
}

// Constants
const COLORS = ['#FFB300', '#8B5CF6', '#52C41A', '#FF4D4F', '#1890FF'];

const generateChartData = () => {
  const data = [];
  for (let i = 0; i < 7; i++) {
    data.push({
      name: dayjs().subtract(6 - i, 'day').format('MMM DD'),
      users: Math.floor(Math.random() * 500) + 1000,
      trades: Math.floor(Math.random() * 1000) + 2000,
      volume: Math.floor(Math.random() * 100000) + 500000,
    });
  }
  return data;
};

const chartData = generateChartData();

// Mock data
const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'USER_REGISTERED',
    title: 'New User Registration',
    description: 'User john_doe joined the platform',
    timestamp: new Date(Date.now() - 300000).toISOString(),
    severity: 'INFO',
  },
  {
    id: '2',
    type: 'SYSTEM_ALERT',
    title: 'High API Latency',
    description: 'API response time exceeded 1000ms',
    timestamp: new Date(Date.now() - 600000).toISOString(),
    severity: 'WARNING',
  },
  {
    id: '3',
    type: 'KYC_SUBMITTED',
    title: 'KYC Verification',
    description: 'User jane_smith submitted KYC documents',
    timestamp: new Date(Date.now() - 900000).toISOString(),
    severity: 'INFO',
  },
  {
    id: '4',
    type: 'TRADE_EXECUTED',
    title: 'Large Trade Executed',
    description: 'Trade worth $50,000 completed successfully',
    timestamp: new Date(Date.now() - 1200000).toISOString(),
    severity: 'INFO',
  },
];

const mockModerationItems: ModerationItem[] = [
  {
    id: '1',
    type: 'CONTENT',
    title: 'Inappropriate content reported',
    description: 'User posted prohibited content',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    reportedBy: 'system',
    priority: 'HIGH',
  },
  {
    id: '2',
    type: 'USER',
    title: 'Suspicious activity detected',
    description: 'Unusual trading pattern detected',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    reportedBy: 'automated_monitoring',
    priority: 'MEDIUM',
  },
];

const mockUsers: User[] = [
  {
    id: '1',
    email: 'john@example.com',
    username: 'john_doe',
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    registrationDate: '2024-01-01',
    lastLogin: new Date().toISOString(),
    totalTrades: 150,
    totalVolume: 50000,
    role: 'USER',
  },
  {
    id: '2',
    email: 'jane@example.com',
    username: 'jane_smith',
    status: 'ACTIVE',
    kycStatus: 'PENDING',
    registrationDate: '2024-01-05',
    lastLogin: new Date(Date.now() - 86400000).toISOString(),
    totalTrades: 75,
    totalVolume: 25000,
    role: 'USER',
  },
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [collapsedWidgets, setCollapsedWidgets] = useState<Set<string>>(new Set());

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ['adminStats'],
    queryFn: async () => {
      // Mock data for now - replace with actual API call
      return {
        totalUsers: 5432,
        activeTraders: 3210,
        pendingKYC: 45,
        flaggedContent: 12,
        systemHealth: 'HEALTHY',
        apiResponseTime: 120,
        dbConnections: 85,
        queueSize: 23,
        errorRate: 0.2,
        totalVolume: 12500000,
        dailyActive: 1250,
        weeklyActive: 2890,
        monthlyActive: 4100,
      };
    },
  });

  const toggleWidgetCollapse = (widgetId: string) => {
    setCollapsedWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) {
        next.delete(widgetId);
      } else {
        next.add(widgetId);
      }
      return next;
    });
  };

  const renderStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        icon={<Users className="w-6 h-6" />}
        label="Total Users"
        value={stats?.totalUsers || 0}
        trend="up"
        trendValue="+12.5%"
        variant="purple"
        delay={0}
      />
      <StatCard
        icon={<TrendingUp className="w-6 h-6" />}
        label="Active Traders"
        value={stats?.activeTraders || 0}
        trend="up"
        trendValue="+8.3%"
        variant="success"
        delay={100}
      />
      <StatCard
        icon={<AlertTriangle className="w-6 h-6" />}
        label="Pending KYC"
        value={stats?.pendingKYC || 0}
        trend="down"
        trendValue="-3.2%"
        variant="warning"
        delay={200}
      />
      <StatCard
        icon={<Shield className="w-6 h-6" />}
        label="Flagged Content"
        value={stats?.flaggedContent || 0}
        trend="neutral"
        trendValue="0%"
        variant="default"
        delay={300}
      />
    </div>
  );

  const renderActivityFeed = () => (
    <GlassCard title="Activity Feed" className="mb-6" hoverable>
      <div className="space-y-4">
        {mockActivities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-primary-700/10 transition-colors border-l-2"
            style={{
              borderColor:
                activity.severity === 'ERROR'
                  ? 'rgb(239, 68, 68)'
                  : activity.severity === 'WARNING'
                  ? 'rgb(251, 191, 36)'
                  : 'rgb(139, 92, 246)',
            }}
          >
            <div
              className={`p-2 rounded-full ${
                activity.severity === 'ERROR'
                  ? 'bg-danger-500/20 text-danger-500'
                  : activity.severity === 'WARNING'
                  ? 'bg-warning-500/20 text-warning-500'
                  : 'bg-primary-700/20 text-primary-700'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gold-600">
                {activity.title}
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">
                {activity.description}
              </p>
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {dayjs(activity.timestamp).fromNow()}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </GlassCard>
  );

  const renderModerationQueue = () => {
    const columns = [
      {
        title: 'Type',
        dataIndex: 'type',
        key: 'type',
        render: (type: string) => (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              type === 'USER'
                ? 'bg-blue-500/20 text-blue-400'
                : type === 'CONTENT'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-orange-500/20 text-orange-400'
            }`}
          >
            {type}
          </span>
        ),
      },
      {
        title: 'Title',
        dataIndex: 'title',
        key: 'title',
        render: (title: string) => <span className="text-gold-600">{title}</span>,
      },
      {
        title: 'Priority',
        dataIndex: 'priority',
        key: 'priority',
        render: (priority: string) => (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              priority === 'HIGH'
                ? 'bg-danger-500/20 text-danger-400'
                : priority === 'MEDIUM'
                ? 'bg-warning-500/20 text-warning-400'
                : 'bg-primary-700/20 text-primary-700'
            }`}
          >
            {priority}
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
              status === 'PENDING'
                ? 'bg-warning-500/20 text-warning-400'
                : status === 'APPROVED'
                ? 'bg-success-500/20 text-success-400'
                : 'bg-danger-500/20 text-danger-400'
            }`}
          >
            {status}
          </span>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: any, record: ModerationItem) => (
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg bg-success-500/20 text-success-500 hover:bg-success-500/30 transition-colors"
              aria-label="Approve"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg bg-danger-500/20 text-danger-500 hover:bg-danger-500/30 transition-colors"
              aria-label="Reject"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ];

    return (
      <GlassCard title="Moderation Queue" className="mb-6" hoverable>
        <Table
          columns={columns}
          data={mockModerationItems}
          loading={false}
          pagination={undefined}
          onRowClick={(record) => console.log('Clicked:', record)}
        />
      </GlassCard>
    );
  };

  const renderSystemHealth = () => (
    <GlassCard title="System Health" className="mb-6" hoverable>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">System Status</span>
            <div
              className={`w-3 h-3 rounded-full ${
                stats?.systemHealth === 'HEALTHY'
                  ? 'bg-success-500 animate-pulse'
                  : stats?.systemHealth === 'WARNING'
                  ? 'bg-warning-500 animate-pulse'
                  : 'bg-danger-500 animate-pulse'
              }`}
            />
          </div>
          <span
            className={`text-sm font-bold ${
              stats?.systemHealth === 'HEALTHY'
                ? 'text-success-500'
                : stats?.systemHealth === 'WARNING'
                ? 'text-warning-500'
                : 'text-danger-500'
            }`}
          >
            {stats?.systemHealth || 'UNKNOWN'}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">API Response</span>
            <Server className="w-4 h-4 text-primary-700" />
          </div>
          <span className="text-sm font-bold text-gold-600">
            {stats?.apiResponseTime || 0}ms
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Error Rate</span>
            <AlertCircle className="w-4 h-4 text-primary-700" />
          </div>
          <span className="text-sm font-bold text-gold-600">
            {stats?.errorRate || 0}%
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">DB Connections</span>
            <Database className="w-4 h-4 text-primary-700" />
          </div>
          <span className="text-sm font-bold text-gold-600">
            {stats?.dbConnections || 0}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Queue Size</span>
            <Activity className="w-4 h-4 text-primary-700" />
          </div>
          <span className="text-sm font-bold text-gold-600">
            {stats?.queueSize || 0}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-lg bg-dark-900/50 border border-primary-700/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400">Total Volume</span>
            <TrendingUp className="w-4 h-4 text-primary-700" />
          </div>
          <span className="text-sm font-bold text-gold-600">
            ${((stats?.totalVolume || 0) / 1000000).toFixed(1)}M
          </span>
        </motion.div>
      </div>
    </GlassCard>
  );

  const renderUserManagement = () => {
    const columns = [
      {
        title: 'User',
        dataIndex: 'username',
        key: 'username',
        render: (_: any, record: User) => (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-purple flex items-center justify-center text-white font-semibold">
              {record.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{record.username}</p>
              <p className="text-xs text-gray-400">{record.email}</p>
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
                : 'bg-danger-500/20 text-danger-400'
            }`}
          >
            {status}
          </span>
        ),
      },
      {
        title: 'KYC Status',
        dataIndex: 'kycStatus',
        key: 'kycStatus',
        render: (kycStatus: string) => (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              kycStatus === 'VERIFIED'
                ? 'bg-success-500/20 text-success-400'
                : 'bg-warning-500/20 text-warning-400'
            }`}
          >
            {kycStatus}
          </span>
        ),
      },
      {
        title: 'Trades',
        dataIndex: 'totalTrades',
        key: 'totalTrades',
        render: (trades: number) => (
          <span className="text-sm text-gray-300">{trades}</span>
        ),
      },
      {
        title: 'Volume',
        dataIndex: 'totalVolume',
        key: 'totalVolume',
        render: (volume: number) => (
          <span className="text-sm text-success-500 font-semibold">
            ${volume.toLocaleString()}
          </span>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (_: any, record: User) => (
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg text-primary-700 hover:bg-primary-700/20 transition-colors"
              aria-label="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg text-warning-500 hover:bg-warning-500/20 transition-colors"
              aria-label="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-lg text-danger-500 hover:bg-danger-500/20 transition-colors"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ];

    return (
      <GlassCard title="User Management" className="mb-6" hoverable>
        <Table
          columns={columns}
          data={mockUsers}
          loading={false}
          pagination={{
            current: 1,
            pageSize: 10,
            total: mockUsers.length,
            onChange: () => {},
          }}
          onRowClick={(user) => console.log('User clicked:', user)}
        />
      </GlassCard>
    );
  };

  const renderCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <GlassCard title="User Growth" hoverable>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="#8B5CF6"
              fillOpacity={1}
              fill="url(#colorUsers)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>

      <GlassCard title="Trading Volume" hoverable>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(251, 191, 36, 0.1)" />
            <XAxis dataKey="name" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="volume" fill="#FFB300" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  );

  const renderOverview = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {renderStats()}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">{renderCharts()}</div>
        <div>{renderActivityFeed()}</div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderModerationQueue()}
        {renderSystemHealth()}
      </div>
      {renderUserManagement()}
    </motion.div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'users':
        return renderUserManagement();
      case 'moderation':
        return renderModerationQueue();
      case 'health':
        return renderSystemHealth();
      default:
        return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-viral bg-clip-text text-transparent mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-400">
            Welcome back, {user?.firstName} {user?.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="p-2.5 rounded-lg bg-primary-700/20 text-primary-700 hover:bg-primary-700/40 transition-all hover:scale-105"
            aria-label="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            className="p-2.5 rounded-lg bg-primary-700/20 text-primary-700 hover:bg-primary-700/40 transition-all hover:scale-105"
            aria-label="Export"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        items={[
          { key: 'overview', label: 'Overview' },
          { key: 'users', label: 'Users' },
          { key: 'moderation', label: 'Moderation' },
          { key: 'health', label: 'System Health' },
        ]}
        activeKey={activeTab}
        onChange={setActiveTab}
      />

      {/* Content */}
      <div className="mt-6">{renderTabContent()}</div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-gradient-viral text-white shadow-glow flex items-center justify-center z-30 hover:shadow-glow-gold transition-all"
        aria-label="Quick actions"
      >
        <Settings className="w-6 h-6" />
      </motion.button>
    </div>
  );
};

export default AdminDashboard;
