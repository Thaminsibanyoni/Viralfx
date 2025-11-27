import React, { useState, useEffect, useRef } from 'react';
import { Card, Select, Button, Tooltip, Switch } from 'antd';
import { Line, Area, Column } from '@ant-design/plots';
import {
  LineChartOutlined, AreaChartOutlined, BarChartOutlined, ReloadOutlined, SettingOutlined, FullscreenOutlined, ZoomInOutlined, ZoomOutOutlined, UndoOutlined, RedoOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';

const {Option} = Select;

interface PriceChartProps {
  trendId: string;
  height?: number;
}

interface ChartData {
  time: string;
  price: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ trendId, height = 400 }) => {
  const {subscribeToTrend, marketData, priceHistory} = useWebSocket();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'candlestick' | 'volume'>('area');
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [indicators, setIndicators] = useState<string[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showTooltip, setShowTooltip] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const chartRef = useRef(null);

  useEffect(() => {
    subscribeToTrend(trendId);
  }, [trendId]);

  useEffect(() => {
    // Update chart data when market data or price history changes
    if (priceHistory[trendId]) {
      const newData = priceHistory[trendId].map((item, index) => ({
        time: new Date(item.timestamp).toLocaleTimeString(),
        price: item.price,
        volume: item.volume,
        high: item.price, // Would be calculated from real OHLC data
        low: item.price,
        open: index > 0 ? priceHistory[trendId][index - 1].price : item.price,
        close: item.price
      }));

      setChartData(newData.slice(-100)); // Keep last 100 data points
    }
  }, [priceHistory, trendId]);

  const _getTimeframeSeconds = (tf: string) => {
    const timeframes = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    };
    return timeframes[tf as keyof typeof timeframes] || 3600;
  };

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as any);
    // Would fetch historical data for the new timeframe
  };

  const handleIndicatorToggle = (indicator: string) => {
    setIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset') => {
    if (direction === 'reset') {
      setZoomLevel(1);
    } else {
      setZoomLevel(prev => direction === 'in' ? Math.min(prev * 1.2, 3) : Math.max(prev / 1.2, 0.5));
    }
  };

  const refreshChart = () => {
    // Would trigger a refresh of chart data
    console.log('Refreshing chart data...');
  };

  // Line Chart Configuration
  const lineConfig = {
    data: chartData,
    xField: 'time',
    yField: 'price',
    height,
    smooth: true,
    autoFit: true,
    color: '#1890ff',
    point: {
      size: 0,
    },
    tooltip: showTooltip ? {
      formatter: (datum: any) => ({
        name: 'Price',
        value: `$${datum.price.toFixed(6)}`,
      }),
    } : false,
    xAxis: {
      type: 'category',
      grid: showGrid ? {
        line: {
          style: {
            stroke: '#f0f0f0',
            lineWidth: 1,
          },
        },
      } : null,
    },
    yAxis: {
      grid: showGrid ? {
        line: {
          style: {
            stroke: '#f0f0f0',
            lineWidth: 1,
          },
        },
      } : null,
    },
    annotations: indicators.includes('current') ? [
      {
        type: 'line',
        start: ['min', chartData[chartData.length - 1]?.price],
        end: ['max', chartData[chartData.length - 1]?.price],
        style: {
          stroke: '#ff4d4f',
          lineWidth: 2,
          lineDash: [4, 4],
        },
      },
    ] : [],
    interactions: [
      {
        type: 'brush',
        enable: true,
      },
    ],
  };

  // Area Chart Configuration
  const areaConfig = {
    ...lineConfig,
    areaStyle: {
      fill: 'gradient',
      fillOpacity: 0.6,
    },
  };

  // Volume Chart Configuration
  const volumeConfig = {
    data: chartData,
    xField: 'time',
    yField: 'volume',
    height,
    autoFit: true,
    color: '#52c41a',
    columnStyle: {
      radius: [2, 2, 0, 0],
    },
    tooltip: showTooltip ? {
      formatter: (datum: any) => ({
        name: 'Volume',
        value: datum.volume ? datum.volume.toLocaleString() : 'N/A',
      }),
    } : false,
  };

  // Candlestick Chart Configuration (simplified)
  const candlestickConfig = {
    data: chartData,
    xField: 'time',
    seriesField: 'type',
    yField: 'value',
    height,
    smooth: false,
    color: ({ type }: any) => (type === 'up' ? '#52c41a' : '#ff4d4f'),
    tooltip: showTooltip ? {
      formatter: (datum: any) => ({
        name: 'OHLC',
        value: `O: ${datum.open?.toFixed(6)} H: ${datum.high?.toFixed(6)} L: ${datum.low?.toFixed(6)} C: ${datum.close?.toFixed(6)}`,
      }),
    } : false,
  };

  const renderChart = () => {
    switch (chartType) {
      case 'line':
        return <Line {...lineConfig} />;
      case 'area':
        return <Area {...areaConfig} />;
      case 'volume':
        return <Column {...volumeConfig} />;
      case 'candlestick':
        return <Line {...candlestickConfig} />;
      default:
        return <Area {...areaConfig} />;
    }
  };

  const getCurrentPrice = () => {
    return chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  };

  const getPriceChange = () => {
    if (chartData.length < 2) return 0;
    const current = chartData[chartData.length - 1].price;
    const previous = chartData[chartData.length - 2].price;
    return ((current - previous) / previous) * 100;
  };

  const getHighPrice = () => {
    return chartData.length > 0 ? Math.max(...chartData.map(d => d.high || d.price)) : 0;
  };

  const getLowPrice = () => {
    return chartData.length > 0 ? Math.min(...chartData.map(d => d.low || d.price)) : 0;
  };

  return (
    <Card
      className="price-chart-card"
      title={
        <div className="chart-header">
          <div className="chart-title">
            <span>Price Chart</span>
            <div className="current-price-info">
              <span className="current-price">${getCurrentPrice().toFixed(6)}</span>
              <span className={`price-change ${getPriceChange() >= 0 ? 'positive' : 'negative'}`}>
                {getPriceChange() >= 0 ? '+' : ''}{getPriceChange().toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="chart-controls">
            <Select
              value={chartType}
              onChange={setChartType}
              size="small"
              style={{ width: 120, marginRight: 8 }}
            >
              <Option value="line"><LineChartOutlined /> Line</Option>
              <Option value="area"><AreaChartOutlined /> Area</Option>
              <Option value="candlestick"><BarChartOutlined /> Candlestick</Option>
              <Option value="volume"><BarChartOutlined /> Volume</Option>
            </Select>

            <Select
              value={timeframe}
              onChange={handleTimeframeChange}
              size="small"
              style={{ width: 80, marginRight: 8 }}
            >
              <Option value="1m">1m</Option>
              <Option value="5m">5m</Option>
              <Option value="15m">15m</Option>
              <Option value="1h">1h</Option>
              <Option value="4h">4h</Option>
              <Option value="1d">1d</Option>
            </Select>

            <Tooltip title="Refresh">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={refreshChart}
              />
            </Tooltip>

            <Tooltip title="Settings">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
              />
            </Tooltip>

            <Tooltip title="Fullscreen">
              <Button
                type="text"
                size="small"
                icon={<FullscreenOutlined />}
              />
            </Tooltip>
          </div>
        </div>
      }
      extra={
        <div className="chart-stats">
          <div className="stat-item">
            <span className="label">High:</span>
            <span className="value">${getHighPrice().toFixed(6)}</span>
          </div>
          <div className="stat-item">
            <span className="label">Low:</span>
            <span className="value">${getLowPrice().toFixed(6)}</span>
          </div>
          <div className="stat-item">
            <span className="label">Volume:</span>
            <span className="value">
              {chartData.reduce((sum, d) => sum + (d.volume || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      }
    >
      <div className="chart-container" ref={chartRef} style={{ transform: `scale(${zoomLevel})` }}>
        {chartData.length > 0 ? renderChart() : (
          <div className="chart-placeholder">
            <p>Loading chart data...</p>
          </div>
        )}
      </div>

      {/* Chart Toolbar */}
      <div className="chart-toolbar">
        <div className="toolbar-section">
          <span className="section-title">Indicators:</span>
          <div className="indicator-toggles">
            <Switch
              size="small"
              checked={indicators.includes('current')}
              onChange={() => handleIndicatorToggle('current')}
            />
            <span>Current Price</span>
            <Switch
              size="small"
              checked={indicators.includes('moving-avg')}
              onChange={() => handleIndicatorToggle('moving-avg')}
            />
            <span>MA</span>
            <Switch
              size="small"
              checked={indicators.includes('bollinger')}
              onChange={() => handleIndicatorToggle('bollinger')}
            />
            <span>Bollinger</span>
            <Switch
              size="small"
              checked={indicators.includes('volume')}
              onChange={() => handleIndicatorToggle('volume')}
            />
            <span>Volume</span>
          </div>
        </div>

        <div className="toolbar-section">
          <span className="section-title">Display:</span>
          <div className="display-toggles">
            <Switch
              size="small"
              checked={showGrid}
              onChange={setShowGrid}
            />
            <span>Grid</span>
            <Switch
              size="small"
              checked={showTooltip}
              onChange={setShowTooltip}
            />
            <span>Tooltip</span>
          </div>
        </div>

        <div className="toolbar-section">
          <span className="section-title">Zoom:</span>
          <Button.Group size="small">
            <Button
              icon={<ZoomOutOutlined />}
              onClick={() => handleZoom('out')}
            />
            <Button
              onClick={() => handleZoom('reset')}
            >
              {Math.round(zoomLevel * 100)}%
            </Button>
            <Button
              icon={<ZoomInOutlined />}
              onClick={() => handleZoom('in')}
            />
          </Button.Group>
        </div>
      </div>
    </Card>
  );
};

export default PriceChart;