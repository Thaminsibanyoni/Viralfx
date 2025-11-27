import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Grid, Chip, LinearProgress, Tooltip, IconButton, } from '@mui/material';
import {
  RiseOutlined, FallOutlined, Info, Timeline, Assessment, Public, } from '@mui/icons-material';
import { WebSocketService } from '../../services/WebSocketService';
import { VPMXService } from '../../services/VPMXService';
import { formatNumber, formatPercentage } from '../../utils/formatters';

interface VPMXData {
  vtsSymbol: string;
  value: number;
  timestamp: string;
  components: {
    globalSentimentScore: number;
    viralMomentumIndex: number;
    trendVelocity: number;
    mentionVolumeNormalized: number;
    engagementQualityScore: number;
    trendStability: number;
    deceptionRiskInverse: number;
    regionalWeighting: number;
  };
  metadata: {
    breakoutProbability: number;
    smiCorrelation: number;
    volatilityIndex: number;
    confidenceScore: number;
  };
  change?: {
    oneHour: number;
    twentyFourHours: number;
    sevenDays: number;
  };
}

interface VPMXDisplayProps {
  vtsSymbol: string;
  showDetails?: boolean;
  showComponents?: boolean;
  realTime?: boolean;
  height?: number | string;
}

export const VPMXDisplay: React.FC<VPMXDisplayProps> = ({
  vtsSymbol,
  showDetails = true,
  showComponents = false,
  realTime = true,
  height = 200,
}) => {
  const [vpmxData, setVpmxData] = useState<VPMXData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await VPMXService.getCurrentVPMX(vtsSymbol);
        if (data) {
          setVpmxData(data);
          setLastUpdate(new Date());
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch VPMX data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    if (realTime) {
      // Subscribe to real-time updates
      const topic = `vpmx:${vtsSymbol}`;
      wsService.subscribe(topic, handleVPMXUpdate);

      // Also subscribe to general VPMX updates
      wsService.subscribe('vpmx:update', handleGeneralVPMXUpdate);

      return () => {
        wsService.unsubscribe(topic, handleVPMXUpdate);
        wsService.unsubscribe('vpmx:update', handleGeneralVPMXUpdate);
      };
    }
  }, [vtsSymbol, realTime]);

  const _handleVPMXUpdate = (data: any) => {
    if (data.vtsSymbol === vtsSymbol) {
      setVpmxData(data);
      setLastUpdate(new Date());
    }
  };

  const _handleGeneralVPMXUpdate = (data: any) => {
    if (data.vtsSymbol === vtsSymbol) {
      setVpmxData(data);
      setLastUpdate(new Date());
    }
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'success.main';
    if (change < 0) return 'error.main';
    return 'text.secondary';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <RiseOutlined sx={{ fontSize: 16 }} />;
    if (change < 0) return <FallOutlined sx={{ fontSize: 16 }} />;
    return null;
  };

  const getVPMXColor = (value: number) => {
    if (value >= 800) return 'success.main';
    if (value >= 600) return 'warning.main';
    if (value >= 400) return 'info.main';
    return 'error.main';
  };

  const getRiskLevel = (value: number) => {
    if (value >= 800) return { label: 'Very High', color: 'success' };
    if (value >= 600) return { label: 'High', color: 'warning' };
    if (value >= 400) return { label: 'Medium', color: 'info' };
    return { label: 'Low', color: 'error' };
  };

  const getComponentColor = (value: number) => {
    const intensity = Math.floor(value * 255);
    return `rgb(${255 - intensity}, ${intensity}, 100)`;
  };

  if (loading) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <div display="flex" alignItems="center" justifyContent="center" height={120}>
            <Typography variant="body2" color="text.secondary">
              Loading VPMX data...
            </Typography>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !vpmxData) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <div display="flex" alignItems="center" justifyContent="center" height={120}>
            <Typography variant="body2" color="error">
              {error || 'No VPMX data available'}
            </Typography>
          </div>
        </CardContent>
      </Card>
    );
  }

  const riskLevel = getRiskLevel(vpmxData.value);

  return (
    <Card sx={{ height, position: 'relative' }}>
      {realTime && lastUpdate && (
        <Box
          position="absolute"
          top={8}
          right={8}
          display="flex"
          alignItems="center"
          gap={0.5}
        >
          <Box
            width={8}
            height={8}
            borderRadius="50%"
            bgcolor="success.main"
            sx={{
              animation: 'pulse 2s infinite',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {lastUpdate.toLocaleTimeString()}
          </Typography>
        </div>
      )}

      <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="div">
            VPMX
          </Typography>
          <Chip
            label={riskLevel.label}
            color={riskLevel.color as any}
            size="small"
            icon={<Assessment />}
          />
        </div>

        {/* Main VPMX Value */}
        <div textAlign="center" mb={2}>
          <Typography
            variant="h3"
            component="div"
            fontWeight="bold"
            color={getVPMXColor(vpmxData.value)}
          >
            {formatNumber(vpmxData.value, 0)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {vtsSymbol}
          </Typography>
        </div>

        {/* Progress Bar */}
        <div mb={2}>
          <LinearProgress
            variant="determinate"
            value={(vpmxData.value / 1000) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                backgroundColor: getVPMXColor(vpmxData.value),
              },
            }}
          />
        </div>

        {/* Change Indicators */}
        {vpmxData.change && (
          <Grid container spacing={1} mb={2}>
            <Grid item xs={4}>
              <div textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  1H
                </Typography>
                <div display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                  {getChangeIcon(vpmxData.change.oneHour)}
                  <Typography
                    variant="body2"
                    color={getChangeColor(vpmxData.change.oneHour)}
                    fontWeight="bold"
                  >
                    {formatPercentage(vpmxData.change.oneHour)}
                  </Typography>
                </div>
              </div>
            </Grid>
            <Grid item xs={4}>
              <div textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  24H
                </Typography>
                <div display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                  {getChangeIcon(vpmxData.change.twentyFourHours)}
                  <Typography
                    variant="body2"
                    color={getChangeColor(vpmxData.change.twentyFourHours)}
                    fontWeight="bold"
                  >
                    {formatPercentage(vpmxData.change.twentyFourHours)}
                  </Typography>
                </div>
              </div>
            </Grid>
            <Grid item xs={4}>
              <div textAlign="center">
                <Typography variant="caption" color="text.secondary">
                  7D
                </Typography>
                <div display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                  {getChangeIcon(vpmxData.change.sevenDays)}
                  <Typography
                    variant="body2"
                    color={getChangeColor(vpmxData.change.sevenDays)}
                    fontWeight="bold"
                  >
                    {formatPercentage(vpmxData.change.sevenDays)}
                  </Typography>
                </div>
              </div>
            </Grid>
          </Grid>
        )}

        {/* Components Breakdown */}
        {showComponents && vpmxData.components && (
          <div mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              Components
            </Typography>
            <Grid container spacing={1}>
              {Object.entries(vpmxData.components).map(([key, value]) => (
                <Grid item xs={6} key={key}>
                  <Tooltip title={key.replace(/([A-Z])/g, ' $1').trim()}>
                    <div>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={value * 100}
                        sx={{
                          height: 4,
                          backgroundColor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            backgroundColor: getComponentColor(value),
                          },
                        }}
                      />
                    </div>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </div>
        )}

        {/* Metadata */}
        {showDetails && vpmxData.metadata && (
          <div mt="auto">
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <div display="flex" alignItems="center" gap={0.5}>
                  <Timeline sx={{ fontSize: 16 }} />
                  <Typography variant="caption" color="text.secondary">
                    Breakout: {formatPercentage(vpmxData.metadata.breakoutProbability)}
                  </Typography>
                </div>
              </Grid>
              <Grid item xs={6}>
                <div display="flex" alignItems="center" gap={0.5}>
                  <Public sx={{ fontSize: 16 }} />
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {formatPercentage(vpmxData.metadata.confidenceScore)}
                  </Typography>
                </div>
              </Grid>
            </Grid>
          </div>
        )}

        {/* Info Icon */}
        <Tooltip title="VPMX = Viral Popularity Market Index. A composite score (0-1000) measuring trend virality, sentiment, and momentum.">
          <IconButton
            size="small"
            sx={{ position: 'absolute', top: 8, left: 8 }}
          >
            <Info sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </CardContent>
    </Card>
  );
};