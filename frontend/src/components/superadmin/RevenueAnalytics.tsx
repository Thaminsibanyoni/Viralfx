import React from 'react';
import { Row, Col, Card, Statistic, Typography, Select, DatePicker, Space } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const {Title} = Typography;
const {RangePicker} = DatePicker;
const {Option} = Select;

interface RevenueAnalyticsProps {
  data?: {
    mrr: number;
    nrr: number;
    totalRevenue: number;
    growth: {
      monthly: number;
      yearly: number;
    };
    revenueByRegion: Array<{
      region: string;
      totalRevenue: number;
      percentage: number;
    }>;
    revenueByTier: Array<{
      tier: string;
      totalRevenue: number;
      percentage: number;
    }>;
    revenueTrend: Array<{
      period: string;
      revenue: number;
      growth: number;
    }>;
  };
  onDateRangeChange: (dates: any) => void;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const RevenueAnalytics: React.FC<RevenueAnalyticsProps> = ({
  data,
  onDateRangeChange,
}) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const renderGrowthIndicator = (value: number) => {
    if (value > 0) {
      return (
        <span style={{ color: '#52c41a' }}>
          <ArrowUpOutlined /> {value.toFixed(1)}%
        </span>
      );
    } else if (value < 0) {
      return (
        <span style={{ color: '#ff4d4f' }}>
          <ArrowDownOutlined /> {Math.abs(value).toFixed(1)}%
        </span>
      );
    }
    return <span style={{ color: '#8c8c8c' }}>0.0%</span>;
  };

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={4}>Loading revenue analytics...</Title>
      </div>
    );
  }

  return (
    <div>
      {/* Filters */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            Revenue Analytics
          </Title>
        </Col>
        <Col>
          <Space>
            <RangePicker
              onChange={onDateRangeChange}
              defaultValue={[dayjs().subtract(6, 'month'), dayjs()]}
              format="YYYY-MM-DD"
            />
          </Space>
        </Col>
      </Row>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="MRR"
              value={data.mrr}
              formatter={(value) => formatCurrency(Number(value))}
              prefix={<span style={{ color: '#8b5cf6' }}>📈</span>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="NRR"
              value={data.nrr}
              suffix="%"
              prefix={<span style={{ color: '#10b981' }}>🔄</span>}
              valueStyle={{
                color: data.nrr > 100 ? '#52c41a' : data.nrr < 100 ? '#ff4d4f' : '#8c8c8c',
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={data.totalRevenue}
              formatter={(value) => formatCurrency(Number(value))}
              prefix={<span style={{ color: '#3b82f6' }}>💰</span>}
              suffix={renderGrowthIndicator(data.growth.monthly)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="YoY Growth"
              value={data.growth.yearly}
              suffix="%"
              prefix={<span style={{ color: '#f59e0b' }}>📊</span>}
              valueStyle={{
                color: data.growth.yearly > 0 ? '#52c41a' : '#ff4d4f',
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]}>
        {/* Revenue Trend */}
        <Col xs={24} lg={12}>
          <Card title="Revenue Trend" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={data.revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={(label) => `Period: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Revenue by Region */}
        <Col xs={24} lg={12}>
          <Card title="Revenue by Region" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={data.revenueByRegion}
                  dataKey="totalRevenue"
                  nameKey="region"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ region, percentage }) => `${region} (${percentage.toFixed(1)}%)`}
                >
                  {data.revenueByRegion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Revenue by Tier */}
        <Col xs={24} lg={12}>
          <Card title="Revenue by Tier" style={{ height: 400 }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={data.revenueByTier}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis tickFormatter={(value) => `R${(value / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Bar dataKey="totalRevenue" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* Revenue Distribution */}
        <Col xs={24} lg={12}>
          <Card title="Revenue Distribution" style={{ height: 400 }}>
            <div style={{ padding: '20px 0' }}>
              {data.revenueByTier.map((tier, index) => (
                <div key={tier.tier} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>{tier.tier} Tier</span>
                    <span>{tier.percentage.toFixed(1)}%</span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      backgroundColor: '#f0f0f0',
                      borderRadius: 4,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: COLORS[index % COLORS.length],
                        width: `${tier.percentage}%`,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default RevenueAnalytics;