import React, { useState, useMemo } from 'react';
import {
  Card, Row, Col, Select, Space, Typography, Button, Tooltip, Switch, Divider, } from 'antd';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ComposedChart, ReferenceLine, Treemap, } from 'recharts';
import {
  LineChartOutlined, BarChartOutlined, PieChartOutlined, AreaChartOutlined, RadarChartOutlined, DotChartOutlined, DownloadOutlined, SettingOutlined, FullscreenOutlined, } from '@ant-design/icons';

const {Title, Text} = Typography;
const {Option} = Select;

export interface PerformanceMetric {
  timestamp: Date;
  providerId: string;
  providerName: string;
  latency: number;
  throughput: number;
  successRate: number;
  errorRate: number;
  cost: number;
  region: string;
}

export interface ProviderComparison {
  providerName: string;
  healthScore: number;
  responseTime: number;
  successRate: number;
  cost: number;
  throughput: number;
  uptime: number;
}

export interface GeographicData {
  region: string;
  [key: string]: any; // provider data
}

export interface PerformanceChartsProps {
  data: PerformanceMetric[];
  providerComparisons: ProviderComparison[];
  geographicData: GeographicData[];
  loading?: boolean;
  timeRange?: '1h' | '24h' | '7d' | '30d';
  onTimeRangeChange?: (range: string) => void;
  onExport?: (chartType: string) => void;
  className?: string;
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  data,
  providerComparisons,
  geographicData,
  loading = false,
  timeRange = '24h',
  onTimeRangeChange,
  onExport,
  className = '',
}) => {
  const [selectedChartType, setSelectedChartType] = useState<string>('line');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [animated, setAnimated] = useState(true);

  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1',
    '#13c2c2', '#eb2f96', '#fa541c', '#a0d911', '#2f54eb'
  ];

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter(metric => {
      const providerMatch = selectedProviders.length === 0 || selectedProviders.includes(metric.providerId);
      const regionMatch = selectedRegions.length === 0 || selectedRegions.includes(metric.region);
      return providerMatch && regionMatch;
    });
  }, [data, selectedProviders, selectedRegions]);

  // Process data for different chart types
  const timeSeriesData = useMemo(() => {
    const grouped = filteredData.reduce((acc, metric) => {
      const timeKey = metric.timestamp.toLocaleTimeString();
      if (!acc[timeKey]) {
        acc[timeKey] = { time: timeKey };
      }
      acc[timeKey][metric.providerName] = metric.latency;
      acc[timeKey][`${metric.providerName}_successRate`] = metric.successRate;
      acc[timeKey][`${metric.providerName}_throughput`] = metric.throughput;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }, [filteredData]);

  const costDistributionData = useMemo(() => {
    const costs = providerComparisons.map(provider => ({
      name: provider.providerName,
      cost: provider.cost,
      fill: colors[providerComparisons.indexOf(provider) % colors.length],
    }));
    return costs;
  }, [providerComparisons]);

  const radarData = useMemo(() => {
    return providerComparisons.map(provider => ({
      provider: provider.providerName,
      health: provider.healthScore,
      speed: 100 - (provider.responseTime / 10), // Normalize response time
      reliability: provider.successRate,
      efficiency: (provider.throughput / 100) * 100, // Normalize throughput
      uptime: provider.uptime,
    }));
  }, [providerComparisons]);

  const errorRateData = useMemo(() => {
    return filteredData.slice(-50).map(metric => ({
      time: metric.timestamp.toLocaleTimeString(),
      [metric.providerName]: metric.errorRate,
    }));
  }, [filteredData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip" style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{`Time: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ margin: '4px 0', color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)}${entry.name.includes('Rate') ? '%' : entry.name.includes('Time') ? 'ms' : ''}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (selectedChartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={timeSeriesData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="time" />
              <YAxis />
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              {Array.from(new Set(filteredData.map(m => m.providerName))).map((provider, index) => (
                <Line
                  key={provider}
                  type="monotone"
                  dataKey={provider}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={animated ? 1000 : 0}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={timeSeriesData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="time" />
              <YAxis />
              <RechartsTooltip content={<CustomTooltip />} />
              {showLegend && <Legend />}
              {Array.from(new Set(filteredData.map(m => m.providerName))).map((provider, index) => (
                <Area
                  key={provider}
                  type="monotone"
                  dataKey={provider}
                  stackId="1"
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                  animationDuration={animated ? 1000 : 0}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={providerComparisons}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="providerName" />
              <YAxis />
              <RechartsTooltip />
              {showLegend && <Legend />}
              <Bar dataKey="responseTime" fill="#8884d8" name="Response Time (ms)" />
              <Bar dataKey="successRate" fill="#82ca9d" name="Success Rate (%)" />
              <Bar dataKey="throughput" fill="#ffc658" name="Throughput (msg/min)" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={costDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="cost"
                animationDuration={animated ? 1000 : 0}
              >
                {costDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <RechartsTooltip />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="provider" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Health Score"
                dataKey="health"
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.3}
                animationDuration={animated ? 1000 : 0}
              />
              <Radar
                name="Success Rate"
                dataKey="reliability"
                stroke={colors[1]}
                fill={colors[1]}
                fillOpacity={0.3}
                animationDuration={animated ? 1000 : 0}
              />
              <Radar
                name="Uptime"
                dataKey="uptime"
                stroke={colors[2]}
                fill={colors[2]}
                fillOpacity={0.3}
                animationDuration={animated ? 1000 : 0}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'heatmap':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={geographicData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="region" type="category" width={100} />
              <RechartsTooltip />
              {showLegend && <Legend />}
              {Object.keys(geographicData[0] || {}).filter(key => key !== 'region').map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId="a"
                  fill={colors[index % colors.length]}
                  animationDuration={animated ? 1000 : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'composition':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={timeSeriesData}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" />}
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <RechartsTooltip />
              {showLegend && <Legend />}
              {Array.from(new Set(filteredData.map(m => m.providerName))).slice(0, 2).map((provider, index) => (
                <Line
                  key={provider}
                  yAxisId="left"
                  type="monotone"
                  dataKey={`${provider}_successRate`}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  animationDuration={animated ? 1000 : 0}
                />
              ))}
              {Array.from(new Set(filteredData.map(m => m.providerName))).slice(0, 2).map((provider, index) => (
                <Bar
                  key={`${provider}_throughput`}
                  yAxisId="right"
                  dataKey={`${provider}_throughput`}
                  fill={colors[(index + 2) % colors.length]}
                  animationDuration={animated ? 1000 : 0}
                />
              ))}
              <ReferenceLine yAxisId="left" y={95} stroke="red" strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Select a chart type</div>;
    }
  };

  const uniqueProviders = useMemo(() => {
    return Array.from(new Set(data.map(m => ({ id: m.providerId, name: m.providerName }))));
  }, [data]);

  const uniqueRegions = useMemo(() => {
    return Array.from(new Set(data.map(m => m.region)));
  }, [data]);

  return (
    <div className={`performance-charts ${className}`}>
      {/* Controls */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Chart Type</Text>
              <Select
                value={selectedChartType}
                onChange={setSelectedChartType}
                style={{ width: '100%' }}
              >
                <Option value="line">
                  <Space><LineChartOutlined /> Line Chart</Space>
                </Option>
                <Option value="area">
                  <Space><AreaChartOutlined /> Area Chart</Space>
                </Option>
                <Option value="bar">
                  <Space><BarChartOutlined /> Bar Chart</Space>
                </Option>
                <Option value="pie">
                  <Space><PieChartOutlined /> Pie Chart</Space>
                </Option>
                <Option value="radar">
                  <Space><RadarChartOutlined /> Radar Chart</Space>
                </Option>
                <Option value="heatmap">
                  <Space><DotChartOutlined /> Geographic Heatmap</Space>
                </Option>
                <Option value="composition">
                  <Space><LineChartOutlined /> Composition</Space>
                </Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} sm={6}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Time Range</Text>
              <Select
                value={timeRange}
                onChange={onTimeRangeChange}
                style={{ width: '100%' }}
              >
                <Option value="1h">Last Hour</Option>
                <Option value="24h">Last 24 Hours</Option>
                <Option value="7d">Last 7 Days</Option>
                <Option value="30d">Last 30 Days</Option>
              </Select>
            </Space>
          </Col>

          <Col xs={24} sm={10}>
            <Space wrap>
              <Space>
                <Text strong>Grid:</Text>
                <Switch checked={showGrid} onChange={setShowGrid} size="small" />
              </Space>
              <Space>
                <Text strong>Legend:</Text>
                <Switch checked={showLegend} onChange={setShowLegend} size="small" />
              </Space>
              <Space>
                <Text strong>Animated:</Text>
                <Switch checked={animated} onChange={setAnimated} size="small" />
              </Space>
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={[16, 8]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Providers</Text>
              <Select
                mode="multiple"
                placeholder="Select providers"
                value={selectedProviders}
                onChange={setSelectedProviders}
                style={{ width: '100%' }}
                allowClear
              >
                {uniqueProviders.map(provider => (
                  <Option key={provider.id} value={provider.id}>
                    {provider.name}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>

          <Col xs={24} sm={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Regions</Text>
              <Select
                mode="multiple"
                placeholder="Select regions"
                value={selectedRegions}
                onChange={setSelectedRegions}
                style={{ width: '100%' }}
                allowClear
              >
                {uniqueRegions.map(region => (
                  <Option key={region} value={region}>
                    {region.replace('-', ' ').toUpperCase()}
                  </Option>
                ))}
              </Select>
            </Space>
          </Col>
        </Row>

        {/* Actions */}
        <Divider style={{ margin: '12px 0' }} />
        <Space>
          <Tooltip title="Export Chart">
            <Button
              icon={<DownloadOutlined />}
              onClick={() => onExport?.(selectedChartType)}
              size="small"
            >
              Export
            </Button>
          </Tooltip>
          <Tooltip title="Chart Settings">
            <Button icon={<SettingOutlined />} size="small">
              Settings
            </Button>
          </Tooltip>
          <Tooltip title="Fullscreen">
            <Button icon={<FullscreenOutlined />} size="small">
              Fullscreen
            </Button>
          </Tooltip>
        </Space>
      </Card>

      {/* Main Chart */}
      <Card loading={loading} title="Performance Metrics">
        {renderChart()}
      </Card>

      {/* Additional Charts */}
      {(selectedChartType === 'line' || selectedChartType === 'area') && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Card title="Error Rate Trends" size="small">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={errorRateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <RechartsTooltip />
                  {Array.from(new Set(filteredData.map(m => m.providerName))).map((provider, index) => (
                    <Area
                      key={provider}
                      type="monotone"
                      dataKey={provider}
                      stackId="1"
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.3}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>

          <Col span={12}>
            <Card title="Cost Distribution" size="small">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={costDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="cost"
                  >
                    {costDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default PerformanceCharts;