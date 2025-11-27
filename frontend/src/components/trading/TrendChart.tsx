import React, { useState, useEffect, useRef } from 'react';
import { Card, Select, Button, Space, Tooltip, Switch, Typography } from 'antd';
import {
  LineChartOutlined, BarChartOutlined, AreaChartOutlined, SettingOutlined, ZoomInOutlined, ZoomOutOutlined, SyncOutlined, FullscreenOutlined
} from '@ant-design/icons';
import { useWebSocket } from '../../hooks/useWebSocket';

const {Option} = Select;
const {Text} = Typography;

interface TrendChartProps {
  trendId: string;
  height?: number;
  showControls?: boolean;
  currency?: string;
}

interface PriceData {
  timestamp: string;
  price: number;
  volume: number;
  viralityScore: number;
}

const TrendChart: React.FC<TrendChartProps> = ({
  trendId,
  height = 400,
  showControls = true,
  currency = 'ZAR'
}) => {
  const {marketData} = useWebSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'area'>('line');
  const [timeframe, setTimeframe] = useState('1h');
  const [showVolume, setShowVolume] = useState(true);
  const [showVirality, setShowVirality] = useState(false);
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    generateMockData();
  }, [trendId, timeframe]);

  useEffect(() => {
    if (priceData.length > 0) {
      drawChart();
    }
  }, [priceData, chartType, showVolume, showVirality, currency]);

  const generateMockData = () => {
    setLoading(true);

    // Generate realistic-looking price data based on timeframe
    const dataPoints = {
      '1m': 60,
      '5m': 48,
      '15m': 32,
      '1h': 24,
      '4h': 24,
      '1D': 30,
      '1W': 12
    };

    const points = dataPoints[timeframe as keyof typeof dataPoints] || 24;
    const basePrice = 100 + Math.random() * 100;
    const data: PriceData[] = [];
    const now = Date.now();
    const intervalMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000
    }[timeframe] || 60 * 60 * 1000;

    let currentPrice = basePrice;
    let currentVirality = 5 + Math.random() * 5;

    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now - i * intervalMs).toISOString();

      // Generate price movement with realistic patterns
      const priceChange = (Math.random() - 0.5) * 10;
      currentPrice = Math.max(currentPrice + priceChange, 10);

      // Generate virality score
      const viralityChange = (Math.random() - 0.5) * 2;
      currentVirality = Math.max(0, Math.min(10, currentVirality + viralityChange));

      // Generate volume (higher during price movements)
      const volume = Math.floor(Math.random() * 1000000 + Math.abs(priceChange) * 50000);

      data.push({
        timestamp,
        price: currentPrice,
        volume,
        viralityScore: currentVirality
      });
    }

    setPriceData(data);
    setLoading(false);
  };

  const _drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const container = containerRef.current;
    if (!container) return;

    const {width, height} = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(0, 0, width, height);

    if (priceData.length === 0) return;

    const padding = { top: 20, right: 60, bottom: 60, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const prices = priceData.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const volumes = priceData.map(d => d.volume);
    const maxVolume = Math.max(...volumes);

    const viralityScores = priceData.map(d => d.viralityScore);
    const maxVirality = Math.max(...viralityScores);

    // Draw grid
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 0.5;

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = padding.left + (chartWidth / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // Draw volume bars (if enabled)
    if (showVolume) {
      const volumeHeight = chartHeight * 0.2;
      const volumeY = height - padding.bottom - volumeHeight;

      priceData.forEach((data, index) => {
        const x = padding.left + (chartWidth / (priceData.length - 1)) * index;
        const barWidth = chartWidth / priceData.length * 0.8;
        const barHeight = (data.volume / maxVolume) * volumeHeight;

        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.fillRect(x - barWidth / 2, volumeY + volumeHeight - barHeight, barWidth, barHeight);
      });
    }

    // Draw price line
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 2;
    ctx.beginPath();

    priceData.forEach((data, index) => {
      const x = padding.left + (chartWidth / (priceData.length - 1)) * index;
      const y = padding.top + (1 - (data.price - minPrice) / priceRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw virality line (if enabled)
    if (showVirality) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();

      priceData.forEach((data, index) => {
        const x = padding.left + (chartWidth / (priceData.length - 1)) * index;
        const y = padding.top + (1 - data.viralityScore / maxVirality) * chartHeight;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // Draw price labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (priceRange / 5) * (5 - i);
      const y = padding.top + (chartHeight / 5) * i;
      ctx.fillText(formatCurrency(price), padding.left - 10, y + 4);
    }

    // Draw time labels
    ctx.textAlign = 'center';
    const timeStep = Math.max(1, Math.floor(priceData.length / 6));

    for (let i = 0; i < priceData.length; i += timeStep) {
      const data = priceData[i];
      const x = padding.left + (chartWidth / (priceData.length - 1)) * i;
      const time = new Date(data.timestamp);
      const timeStr = formatTime(time, timeframe);
      ctx.fillText(timeStr, x, height - padding.bottom + 20);
    }
  };

  const _formatCurrency = (amount: number) => {
    const symbols = {
      'ZAR': 'R',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'BTC': '₿',
      'ETH': 'Ξ'
    };
    const symbol = symbols[currency as keyof typeof symbols] || currency;
    return `${symbol}${amount.toFixed(2)}`;
  };

  const _formatTime = (date: Date, timeframe: string) => {
    switch (timeframe) {
      case '1m':
      case '5m':
      case '15m':
        return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      case '1h':
      case '4h':
        return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
      case '1D':
        return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
      case '1W':
        return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleRefresh = () => {
    generateMockData();
  };

  const handleZoomIn = () => {
    // Implement zoom in functionality
    console.log('Zoom in');
  };

  const handleZoomOut = () => {
    // Implement zoom out functionality
    console.log('Zoom out');
  };

  return (
    <div className="trend-chart" style={{ position: 'relative' }}>
      {showControls && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#1a1f2e',
          borderBottom: '1px solid #2d3748'
        }}>
          <Space>
            <Select
              value={chartType}
              onChange={setChartType}
              size="small"
              style={{ width: 100 }}
            >
              <Option value="line">
                <LineChartOutlined /> Line
              </Option>
              <Option value="candlestick">
                <BarChartOutlined /> Candle
              </Option>
              <Option value="area">
                <AreaChartOutlined /> Area
              </Option>
            </Select>

            <Select
              value={timeframe}
              onChange={setTimeframe}
              size="small"
              style={{ width: 80 }}
            >
              <Option value="1m">1m</Option>
              <Option value="5m">5m</Option>
              <Option value="15m">15m</Option>
              <Option value="1h">1H</Option>
              <Option value="4h">4H</Option>
              <Option value="1D">1D</Option>
              <Option value="1W">1W</Option>
            </Select>

            <Space size="small">
              <Tooltip title="Show Volume">
                <Switch
                  checked={showVolume}
                  onChange={setShowVolume}
                  size="small"
                />
              </Tooltip>
              <Text style={{ color: '#9ca3af' }}>Vol</Text>
            </Space>

            <Space size="small">
              <Tooltip title="Show Virality">
                <Switch
                  checked={showVirality}
                  onChange={setShowVirality}
                  size="small"
                />
              </Tooltip>
              <Text style={{ color: '#9ca3af' }}>Virality</Text>
            </Space>
          </Space>

          <Space>
            <Tooltip title="Zoom In">
              <Button
                icon={<ZoomInOutlined />}
                size="small"
                type="text"
                onClick={handleZoomIn}
              />
            </Tooltip>
            <Tooltip title="Zoom Out">
              <Button
                icon={<ZoomOutOutlined />}
                size="small"
                type="text"
                onClick={handleZoomOut}
              />
            </Tooltip>
            <Tooltip title="Refresh">
              <Button
                icon={<SyncOutlined />}
                size="small"
                type="text"
                onClick={handleRefresh}
                loading={loading}
              />
            </Tooltip>
            <Tooltip title="Fullscreen">
              <Button
                icon={<FullscreenOutlined />}
                size="small"
                type="text"
                onClick={toggleFullscreen}
              />
            </Tooltip>
            <Tooltip title="Chart Settings">
              <Button
                icon={<SettingOutlined />}
                size="small"
                type="text"
              />
            </Tooltip>
          </Space>
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: showControls ? height - 57 : height,
          background: '#0a0e1a'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};

export default TrendChart;