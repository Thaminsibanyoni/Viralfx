import React, { useState, useEffect, useRef } from 'react';
import {
  Card, CardContent, Typography, FormControl, Select, MenuItem, IconButton, ToggleButton, ToggleButton.Group, Tooltip, } from '@mui/material';
import {
  Refresh, Download, ZoomIn, ZoomOut, Timeline, CandlestickChart, BarChart, } from '@mui/icons-material';
import { VPMXService } from '../../services/VPMXService';
import { WebSocketService } from '../../services/WebSocketService';

interface ChartDataPoint {
  timestamp: string;
  value: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  close?: number;
}

interface VPMXChartProps {
  vtsSymbol: string;
  height?: number | string;
  showControls?: boolean;
  defaultInterval?: string;
  autoRefresh?: boolean;
}

export const VPMXChart: React.FC<VPMXChartProps> = ({
  vtsSymbol,
  height = 400,
  showControls = true,
  defaultInterval = '1h',
  autoRefresh = true,
}) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState(defaultInterval);
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'volume'>('line');
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await VPMXService.getHistoricalChartData(vtsSymbol, interval, 500);
        setChartData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();

    if (autoRefresh) {
      // Subscribe to real-time updates
      wsService.subscribe('vpmx:update', handleRealTimeUpdate);

      return () => {
        wsService.unsubscribe('vpmx:update', handleRealTimeUpdate);
      };
    }
  }, [vtsSymbol, interval, autoRefresh]);

  useEffect(() => {
    if (chartData.length > 0 && canvasRef.current) {
      drawChart();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [chartData, chartType, zoomLevel]);

  const _handleRealTimeUpdate = (data: any) => {
    if (data.vtsSymbol === vtsSymbol) {
      setChartData(prev => {
        const newPoint: ChartDataPoint = {
          timestamp: data.timestamp,
          value: data.value,
          volume: data.volume || 0,
        };

        // Update the last point or add a new one based on interval
        if (prev.length > 0) {
          const lastPoint = prev[prev.length - 1];
          const timeDiff = new Date(newPoint.timestamp).getTime() - new Date(lastPoint.timestamp).getTime();
          const intervalMs = getIntervalMs(interval);

          if (timeDiff < intervalMs) {
            // Update the last point
            const updated = [...prev];
            updated[updated.length - 1] = newPoint;
            return updated;
          }
        }

        return [...prev.slice(-499), newPoint]; // Keep last 500 points
      });
    }
  };

  const _drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (chartData.length === 0) return;

    switch (chartType) {
      case 'line':
        drawLineChart(ctx, rect.width, rect.height);
        break;
      case 'candlestick':
        drawCandlestickChart(ctx, rect.width, rect.height);
        break;
      case 'volume':
        drawVolumeChart(ctx, rect.width, rect.height);
        break;
    }
  };

  const _drawLineChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate data bounds
    const values = chartData.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Apply zoom
    const visibleData = chartData.slice(-Math.floor(chartData.length / zoomLevel));

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - (valueRange / 5) * i;
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(0), padding.left - 5, y + 4);
    }

    // Draw line chart
    ctx.strokeStyle = '#1976d2';
    ctx.lineWidth = 2;
    ctx.beginPath();

    visibleData.forEach((point, index) => {
      const x = padding.left + (chartWidth / (visibleData.length - 1)) * index;
      const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(25, 118, 210, 0.3)');
    gradient.addColorStop(1, 'rgba(25, 118, 210, 0.0)');

    ctx.fillStyle = gradient;
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // Draw data points
    ctx.fillStyle = '#1976d2';
    visibleData.forEach((point, index) => {
      const x = padding.left + (chartWidth / (visibleData.length - 1)) * index;
      const y = padding.top + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw x-axis labels (timestamps)
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';

    const labelInterval = Math.ceil(visibleData.length / 8);
    visibleData.forEach((point, index) => {
      if (index % labelInterval === 0 || index === visibleData.length - 1) {
        const x = padding.left + (chartWidth / (visibleData.length - 1)) * index;
        const date = new Date(point.timestamp);
        const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(label, x, height - padding.bottom + 20);
      }
    });
  };

  const _drawCandlestickChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Simplified candlestick chart implementation
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const visibleData = chartData.slice(-Math.floor(chartData.length / zoomLevel));
    const candleWidth = Math.max(1, (chartWidth / visibleData.length) * 0.8);

    // Calculate bounds
    const allValues = chartData.flatMap(d => [d.high || d.value, d.low || d.value]);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const valueRange = maxValue - minValue || 1;

    // Draw candlesticks
    visibleData.forEach((point, index) => {
      const x = padding.left + (chartWidth / (visibleData.length - 1)) * index;
      const high = point.high || point.value;
      const low = point.low || point.value;
      const open = point.open || point.value;
      const close = point.close || point.value;

      const yHigh = padding.top + chartHeight - ((high - minValue) / valueRange) * chartHeight;
      const yLow = padding.top + chartHeight - ((low - minValue) / valueRange) * chartHeight;
      const yOpen = padding.top + chartHeight - ((open - minValue) / valueRange) * chartHeight;
      const yClose = padding.top + chartHeight - ((close - minValue) / valueRange) * chartHeight;

      // Draw wick
      ctx.strokeStyle = close >= open ? '#4caf50' : '#f44336';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + candleWidth / 2, yHigh);
      ctx.lineTo(x + candleWidth / 2, yLow);
      ctx.stroke();

      // Draw body
      ctx.fillStyle = close >= open ? '#4caf50' : '#f44336';
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.abs(yClose - yOpen) || 1;
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    });
  };

  const _drawVolumeChart = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const visibleData = chartData.slice(-Math.floor(chartData.length / zoomLevel));
    const barWidth = (chartWidth / visibleData.length) * 0.8;

    // Calculate volume bounds
    const volumes = visibleData.map(d => d.volume || 0);
    const maxVolume = Math.max(...volumes, 1);

    // Draw volume bars
    ctx.fillStyle = '#1976d2';
    visibleData.forEach((point, index) => {
      const x = padding.left + (chartWidth / (visibleData.length - 1)) * index;
      const volume = point.volume || 0;
      const barHeight = (volume / maxVolume) * chartHeight;
      const y = height - padding.bottom - barHeight;

      ctx.fillRect(x, y, barWidth, barHeight);
    });
  };

  const _getIntervalMs = (interval: string): number => {
    switch (interval) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  };

  const handleRefresh = () => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        const data = await VPMXService.getHistoricalChartData(vtsSymbol, interval, 500);
        setChartData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(chartData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);

    const exportFileDefaultName = `vpmx_${vtsSymbol}_${interval}_${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 1));
  };

  return (
    <Card>
      {showControls && (
        <div display="flex" alignItems="center" justifyContent="space-between" p={2}>
          <div display="flex" alignItems="center" gap={1}>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
                displayEmpty
              >
                <MenuItem value="1m">1m</MenuItem>
                <MenuItem value="5m">5m</MenuItem>
                <MenuItem value="15m">15m</MenuItem>
                <MenuItem value="1h">1h</MenuItem>
                <MenuItem value="1d">1d</MenuItem>
              </Select>
            </FormControl>

            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => value && setChartType(value)}
              size="small"
            >
              <ToggleButton value="line">
                <Tooltip title="Line Chart">
                  <Timeline />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="candlestick">
                <Tooltip title="Candlestick">
                  <CandlestickChart />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="volume">
                <Tooltip title="Volume">
                  <BarChart />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </div>

          <div display="flex" alignItems="center" gap={1}>
            <Tooltip title="Zoom In">
              <IconButton size="small" onClick={handleZoomIn}>
                <ZoomIn />
              </IconButton>
            </Tooltip>

            <Tooltip title="Zoom Out">
              <IconButton size="small" onClick={handleZoomOut}>
                <ZoomOut />
              </IconButton>
            </Tooltip>

            <Tooltip title="Refresh">
              <IconButton size="small" onClick={handleRefresh}>
                <Refresh />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export Data">
              <IconButton size="small" onClick={handleExport}>
                <Download />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      )}

      <CardContent sx={{ pt: 0 }}>
        <div height={height} position="relative">
          {loading && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
              bgcolor="rgba(255,255,255,0.8)"
              zIndex={1}
            >
              <Typography>Loading chart data...</Typography>
            </div>
          )}

          {error && (
            <Box
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              display="flex"
              alignItems="center"
              justifyContent="center"
              flexDirection="column"
              gap={2}
            >
              <Typography color="error">{error}</Typography>
              <IconButton onClick={handleRefresh}>
                <Refresh />
              </IconButton>
            </div>
          )}

          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
        </div>

        <div display="flex" justifyContent="space-between" mt={1}>
          <Typography variant="caption" color="text.secondary">
            {vtsSymbol} • {interval} • {chartData.length} points
          </Typography>
          {zoomLevel > 1 && (
            <Typography variant="caption" color="text.secondary">
              Zoom: {zoomLevel.toFixed(1)}x
            </Typography>
          )}
        </div>
      </CardContent>
    </Card>
  );
};