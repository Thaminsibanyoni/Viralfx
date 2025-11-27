import React, { useState, useEffect, useRef } from 'react';
import {
  
  Typography, Chip, useTheme, } from '@mui/material';
import {
  RiseOutlined, FallOutlined, } from '@mui/icons-material';
import { WebSocketService } from '../../services/WebSocketService';
import { VPMXService } from '../../services/VPMXService';

interface TickerItem {
  vtsSymbol: string;
  value: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export const _VPMXTicker: React.FC = () => {
  const theme = useTheme();
  const [tickerData, setTickerData] = useState<TickerItem[]>([]);
  const [position, setPosition] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();

  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    const fetchTickerData = async () => {
      try {
        const trending = await VPMXService.getTopTrending(20);
        const tickerItems: TickerItem[] = trending.map((item: any) => ({
          vtsSymbol: item.vtsSymbol,
          value: item.value,
          change: item.change || 0,
          changePercent: item.changePercent || 0,
          timestamp: item.timestamp,
        }));

        setTickerData(tickerItems);
      } catch (error) {
        console.error('Failed to fetch ticker data:', error);
      }
    };

    fetchTickerData();

    // Subscribe to real-time updates
    wsService.subscribe('vpmx:update', handleTickerUpdate);

    return () => {
      wsService.unsubscribe('vpmx:update', handleTickerUpdate);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const _handleTickerUpdate = (data: any) => {
    setTickerData(prev => {
      const existingIndex = prev.findIndex(item => item.vtsSymbol === data.vtsSymbol);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          value: data.value,
          change: data.change?.oneHour || 0,
          changePercent: data.change?.oneHour || 0,
          timestamp: data.timestamp,
        };
        return updated;
      }

      // Add new item if it's trending
      if (data.value > 600) { // Only add high-value items to ticker
        return [...prev, {
          vtsSymbol: data.vtsSymbol,
          value: data.value,
          change: data.change?.oneHour || 0,
          changePercent: data.change?.oneHour || 0,
          timestamp: data.timestamp,
        }].slice(0, 30); // Keep max 30 items
      }

      return prev;
    });
  };

  useEffect(() => {
    const animate = () => {
      setPosition(prev => {
        const newPosition = prev - 1;
        const tickerWidth = tickerRef.current?.scrollWidth || 0;
        const containerWidth = tickerRef.current?.parentElement?.clientWidth || 0;

        // Reset position when ticker has scrolled completely
        if (Math.abs(newPosition) >= tickerWidth) {
          return containerWidth;
        }

        return newPosition;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    if (tickerData.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [tickerData.length]);

  if (tickerData.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.grey[900],
        color: 'white',
        py: 1,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          whiteSpace: 'nowrap',
          transform: `translateX(${position}px)`,
        }}
        ref={tickerRef}
      >
        {tickerData.map((item, index) => (
          <Box
            key={`${item.vtsSymbol}-${index}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              borderRight: `1px solid ${theme.palette.grey[700]}`,
            }}
          >
            {/* Symbol */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                color: theme.palette.primary.light,
                minWidth: 120,
              }}
            >
              {item.vtsSymbol}
            </Typography>

            {/* Value */}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                minWidth: 60,
                textAlign: 'right',
              }}
            >
              {item.value.toFixed(0)}
            </Typography>

            {/* Change */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 80,
              }}
            >
              {item.change >= 0 ? (
                <RiseOutlined
                  sx={{
                    fontSize: 14,
                    color: theme.palette.success.main,
                  }}
                />
              ) : (
                <FallOutlined
                  sx={{
                    fontSize: 14,
                    color: theme.palette.error.main,
                  }}
                />
              )}

              <Typography
                variant="body2"
                sx={{
                  color: item.change >= 0 ? theme.palette.success.main : theme.palette.error.main,
                  fontWeight: 'bold',
                }}
              >
                {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </Typography>
            </div>

            {/* Status Indicator */}
            <Chip
              size="small"
              label={item.value >= 800 ? 'HOT' : item.value >= 600 ? 'TRENDING' : 'RISING'}
              color={item.value >= 800 ? 'error' : item.value >= 600 ? 'warning' : 'info'}
              sx={{
                height: 20,
                fontSize: '0.6rem',
                fontWeight: 'bold',
              }}
            />
          </div>
        ))}

        {/* Duplicate items for seamless scrolling */}
        {tickerData.map((item, index) => (
          <Box
            key={`duplicate-${item.vtsSymbol}-${index}`}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              borderRight: `1px solid ${theme.palette.grey[700]}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                color: theme.palette.primary.light,
                minWidth: 120,
              }}
            >
              {item.vtsSymbol}
            </Typography>

            <Typography
              variant="body2"
              sx={{
                fontWeight: 'bold',
                minWidth: 60,
                textAlign: 'right',
              }}
            >
              {item.value.toFixed(0)}
            </Typography>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 80,
              }}
            >
              {item.change >= 0 ? (
                <RiseOutlined
                  sx={{
                    fontSize: 14,
                    color: theme.palette.success.main,
                  }}
                />
              ) : (
                <FallOutlined
                  sx={{
                    fontSize: 14,
                    color: theme.palette.error.main,
                  }}
                />
              )}

              <Typography
                variant="body2"
                sx={{
                  color: item.change >= 0 ? theme.palette.success.main : theme.palette.error.main,
                  fontWeight: 'bold',
                }}
              >
                {item.change >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
              </Typography>
            </div>

            <Chip
              size="small"
              label={item.value >= 800 ? 'HOT' : item.value >= 600 ? 'TRENDING' : 'RISING'}
              color={item.value >= 800 ? 'error' : item.value >= 600 ? 'warning' : 'info'}
              sx={{
                height: 20,
                fontSize: '0.6rem',
                fontWeight: 'bold',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};