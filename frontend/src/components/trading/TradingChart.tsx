import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode } from 'lightweight-charts';
import { useCandlestickData, useMarketData, useCurrentSymbol } from '../../stores/tradingStore';
import { CandlestickData } from '../../types/trading.types';

interface TradingChartProps {
  height?: number;
}

const TradingChart: React.FC<TradingChartProps> = ({ height = 500 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const currentSymbol = useCurrentSymbol();
  const candlestickData = useCandlestickData();
  const marketData = useMarketData();

  const [isChartReady, setIsChartReady] = useState(false);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
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
      },
      timeScale: {
        borderColor: 'rgba(75, 0, 130, 0.3)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Create candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#4caf50',
      downColor: '#f44336',
      borderUpColor: '#4caf50',
      borderDownColor: '#f44336',
      wickUpColor: '#4caf50',
      wickDownColor: '#f44336',
    });

    candlestickSeriesRef.current = candlestickSeries;

    // Create volume histogram
    const volumeSeries = chart.addHistogramSeries({
      color: '#4B0082',
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

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  useEffect(() => {
    if (!isChartReady || !candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    // Update candlestick data
    if (candlestickData && candlestickData.length > 0) {
      candlestickSeriesRef.current.setData(candlestickData);

      // Update volume data
      const volumeData = candlestickData.map((candle) => ({
        time: candle.time,
        value: candle.volume,
        color: candle.close >= candle.open ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)',
      }));

      volumeSeriesRef.current.setData(volumeData);
    }
  }, [candlestickData, isChartReady]);

  useEffect(() => {
    if (!chartRef.current || !marketData) return;

    // Update chart title with current price
    const priceText = `${currentSymbol}: $${marketData.price.toLocaleString()}`;
    const changeText = `${marketData.changePercent24h >= 0 ? '+' : ''}${marketData.changePercent24h.toFixed(2)}%`;
    const changeColor = marketData.changePercent24h >= 0 ? '#4caf50' : '#f44336';

    // Note: TradingView Lightweight Charts doesn't have built-in title
    // You would need to add a separate HTML element for the title
  }, [marketData, currentSymbol]);

  return (
    <div className="relative">
      {/* Chart Header */}
      {marketData && (
        <div className="absolute top-4 left-4 z-10 bg-dark-900/90 backdrop-blur-xl rounded-lg px-4 py-2 border border-primary-700/30">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-2xl font-bold text-white">
                ${marketData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={`text-sm font-medium ${marketData.changePercent24h >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {marketData.changePercent24h >= 0 ? '+' : ''}{marketData.changePercent24h.toFixed(2)}%
                <span className="text-gray-400 ml-2">
                  24h
                </span>
              </div>
            </div>
            <div className="h-10 w-px bg-primary-700/30" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">High:</span>
                <span className="text-success-400 font-medium">${marketData.high24h.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Low:</span>
                <span className="text-danger-400 font-medium">${marketData.low24h.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div ref={chartContainerRef} className="w-full rounded-xl overflow-hidden border border-primary-700/20" />
    </div>
  );
};

export default TradingChart;
