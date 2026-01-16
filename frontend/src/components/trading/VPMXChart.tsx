import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, PriceScaleMode } from 'lightweight-charts';
import { useCurrentSymbol, useTradingStore } from '../../stores/tradingStore';
import { CandlestickData, VPMXData } from '../../types/trading.types';

interface VPMXChartProps {
  height?: number;
  vpmxData?: VPMXData;
}

/**
 * VPMX/Social Momentum Candlestick Chart
 *
 * This chart displays VIRALITY as tradable momentum, NOT traditional prices.
 *
 * Candle meanings:
 * - Open: VPMX score at interval start
 * - High: Peak viral momentum during interval
 * - Low: Dip in viral momentum during interval
 * - Close: Final VPMX score at interval end
 * - Volume: Social engagement volume (mentions, shares, likes)
 *
 * This is revolutionary - ViralFX shows social virality as momentum!
 */
const VPMXChart: React.FC<VPMXChartProps> = ({ height = 500, vpmxData }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const currentSymbol = useCurrentSymbol();
  const { candlestickData, setCandlestickData } = useTradingStore();

  const [isChartReady, setIsChartReady] = useState(false);

  // Generate mock VPMX candlestick data
  // In production, this would come from: GET /vpmx/market/:symbol/candles?tf=5m
  useEffect(() => {
    const generateVPMXCandles = (): CandlestickData[] => {
      const data: CandlestickData[] = [];
      const now = Date.now();
      const interval = 5 * 60 * 1000; // 5-minute intervals

      // Start from current VPMX score or default
      let baseScore = vpmxData?.score || 75;

      for (let i = 100; i >= 0; i--) {
        const time = now - i * interval;

        // Simulate VPMX movement (social momentum)
        const volatility = 0.08; // 8% volatility for viral trends
        const open = baseScore;
        const change = (Math.random() - 0.45) * 2 * volatility * baseScore; // Slight upward bias
        const close = Math.max(0, Math.min(100, open + change));

        // High is peak momentum during interval
        const highSpike = Math.random() * volatility * baseScore * 0.5;
        const high = Math.max(100, Math.max(open, close) + highSpike);

        // Low is dip in momentum during interval
        const lowDip = Math.random() * volatility * baseScore * 0.3;
        const low = Math.max(0, Math.min(open, close) - lowDip);

        // Volume is social engagement (mentions, shares, likes)
        // Higher VPMX = higher volume
        const baseVolume = 50000 + (close / 100) * 200000;
        const volumeVariation = Math.random() * 100000;
        const volume = Math.floor(baseVolume + volumeVariation);

        data.push({
          time: Math.floor(time / 1000),
          open,
          high,
          low,
          close,
          volume,
        });

        baseScore = close;
      }

      return data;
    };

    // Set VPMX candlestick data
    setCandlestickData(currentSymbol, generateVPMXCandles());
  }, [currentSymbol, vpmxData]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart with VPMX-specific styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0f' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: 'rgba(75, 0, 130, 0.1)' },
        horzLines: { color: 'rgba(75, 0, 130, 0.1)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#4B0082',
        },
        horzLine: {
          color: '#758696',
          width: 1,
          style: 3,
          labelBackgroundColor: '#4B0082',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(75, 0, 130, 0.3)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2,
        },
      },
      timeScale: {
        borderColor: 'rgba(75, 0, 130, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create VPMX candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4caf50',    // Green for bullish momentum
      downColor: '#f44336',  // Red for bearish momentum
      borderUpColor: '#4caf50',
      borderDownColor: '#f44336',
      wickUpColor: '#4caf50',
      wickDownColor: '#f44336',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Create social engagement volume histogram
    const volumeSeries = chart.addHistogramSeries({
      color: '#4B0082', // Purple for social volume
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    volumeSeriesRef.current = volumeSeries;

    // Position volume histogram at bottom
    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.85,
        bottom: 0,
      },
    });

    // Add VPMX score title
    const titleElement = document.createElement('div');
    titleElement.style.cssText = `
      position: absolute;
      left: 10px;
      top: 10px;
      z-index: 1000;
      font-size: 14px;
      font-weight: bold;
      color: #FFB300;
      text-shadow: 0 0 10px rgba(255, 179, 0, 0.5);
      pointer-events: none;
    `;
    titleElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 8px; height: 8px; background: linear-gradient(135deg, #4B0082, #FFB300); border-radius: 50%;"></div>
        <span>VPMX Score</span>
        ${vpmxData ? `<span style="margin-left: 8px; padding: 2px 8px; background: linear-gradient(135deg, rgba(255, 179, 0, 0.2), rgba(255, 179, 0, 0.1)); border-radius: 8px; font-size: 12px;">${vpmxData.score}</span>` : ''}
      </div>
    `;
    chartContainerRef.current.appendChild(titleElement);

    setIsChartReady(true);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartContainerRef.current && titleElement.parentNode) {
        titleElement.parentNode.removeChild(titleElement);
      }
      if (chartRef.current) {
        chartRef.current.remove();
      }
    };
  }, [height, vpmxData]);

  // Update data when candlestickData changes
  useEffect(() => {
    if (!isChartReady || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    const data = candlestickData[currentSymbol];
    if (!data || data.length === 0) return;

    // Update VPMX candlestick series
    candlestickSeriesRef.current.setData(data);

    // Update volume series (social engagement)
    const volumeData = data.map((candle) => ({
      time: candle.time,
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)',
    }));
    volumeSeriesRef.current.setData(volumeData);

    // Fit content
    chartRef.current?.timeScale().fitContent();
  }, [isChartReady, candlestickData, currentSymbol]);

  // Simulate real-time VPMX updates (WebSocket would replace this)
  useEffect(() => {
    if (!isChartReady || !candlestickSeriesRef.current) return;

    const interval = setInterval(() => {
      const data = candlestickData[currentSymbol];
      if (!data || data.length === 0) return;

      const lastCandle = data[data.length - 1];
      const volatility = 0.02;
      const priceChange = (Math.random() - 0.5) * 2 * volatility * lastCandle.close;
      const newClose = Math.max(0, Math.min(100, lastCandle.close + priceChange));

      // Update last candle or create new one
      const updatedCandle: CandlestickData = {
        ...lastCandle,
        close: newClose,
        high: Math.max(lastCandle.high, newClose),
        low: Math.min(lastCandle.low, newClose),
        volume: lastCandle.volume + Math.floor(Math.random() * 1000),
      };

      candlestickSeriesRef.current?.update(updatedCandle);
    }, 1000); // Update every second (would be WebSocket in production)

    return () => clearInterval(interval);
  }, [isChartReady, candlestickData, currentSymbol]);

  return (
    <div className="relative">
      {/* VPMX Legend */}
      <div className="absolute top-4 left-4 z-10 bg-dark-900/80 backdrop-blur-xl rounded-lg p-3 border border-primary-700/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-3 h-3 rounded-full bg-gradient-glow animate-pulse"></div>
          <span className="text-xs font-bold text-gold-600 uppercase tracking-wider">VPMX Momentum</span>
        </div>
        <div className="space-y-1 text-[10px] text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-success-500"></div>
            <span>Bullish: Social momentum increasing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-danger-500"></div>
            <span>Bearish: Social momentum decreasing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm bg-primary-700 opacity-50"></div>
            <span>Bars: Social engagement volume</span>
          </div>
        </div>
        {vpmxData && (
          <div className="mt-3 pt-2 border-t border-primary-700/20">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Current VPMX</span>
              <span className={`font-black text-lg ${vpmxData.score >= 90 ? 'text-gold-600' : 'text-primary-700'}`}>
                {vpmxData.score}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1">
              <span className="text-gray-500">Rank</span>
              <span className="font-bold text-white">#{vpmxData.rank}</span>
            </div>
            <div className="flex items-center justify-between text-[10px] mt-1">
              <span className="text-gray-500">Momentum</span>
              <span className={`font-bold uppercase ${
                vpmxData.momentum === 'accelerating' ? 'text-success-500' :
                vpmxData.momentum === 'stable' ? 'text-blue-500' : 'text-orange-500'
              }`}>
                {vpmxData.momentum}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div
        ref={chartContainerRef}
        className="rounded-xl overflow-hidden border border-primary-700/30"
        style={{ height }}
      />
    </div>
  );
};

export default VPMXChart;
