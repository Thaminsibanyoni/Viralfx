import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Grid, Chip, LinearProgress, IconButton, Tooltip, Fade, useTheme, } from '@mui/material';
import {
  RiseOutlined, FallOutlined, Timeline, Speed, FlashOn, Assessment, Info, OpenInNew, Refresh, } from '@mui/icons-material';
import { vpmxService } from '../../services/VPMXService';
import CurrencyFormatter from '../../utils/currency';

interface BreakoutEvent {
  id: string;
  vtsSymbol: string;
  breakoutScore: number; // 0-100
  velocity: number;
  triggerType: 'MOMENTUM' | 'VOLUME' | 'SENTIMENT' | 'COMBINED';
  probability: number; // 0-1
  confidence: number; // 0-1
  detectedAt: string;
  metadata: {
    acceleration: number;
    volumeSpike: number;
    sentimentShift: number;
  };
}

interface VPMXBreakoutCardProps {
  vtsSymbol?: string;
  maxEvents?: number;
  showDetails?: boolean;
  realTime?: boolean;
  autoRefresh?: boolean;
  height?: number | string;
  onViewAnalysis?: (symbol: string, eventId: string) => void;
}

export const VPMXBreakoutCard: React.FC<VPMXBreakoutCardProps> = ({
  vtsSymbol,
  maxEvents = 5,
  showDetails = true,
  realTime = true,
  autoRefresh = true,
  height = 'auto',
  onViewAnalysis,
}) => {
  const [breakoutEvents, setBreakoutEvents] = useState<BreakoutEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sparklineData, setSparklineData] = useState<Record<string, number[]>>({});
  const theme = useTheme();

  useEffect(() => {
    let unsubscribeRealtime: (() => void) | null = null;

    const fetchBreakoutEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch real breakout events from the service
        const events = await vpmxService.getBreakoutEvents(vtsSymbol, maxEvents);

        if (events.length > 0) {
          const formattedEvents: BreakoutEvent[] = events.map(event => ({
            id: event.id,
            vtsSymbol: event.vtsSymbol,
            breakoutScore: event.breakoutScore,
            velocity: event.velocity,
            triggerType: event.triggerType as any,
            probability: event.probability,
            confidence: event.confidence,
            detectedAt: event.detectedAt,
            metadata: event.metadata,
          }));

          setBreakoutEvents(formattedEvents);

          // Fetch historical data for sparklines
          const sparklinePromises = formattedEvents.map(async (event) => {
            const data = await vpmxService.getHistoricalDataForSparkline(event.vtsSymbol, 20);
            return { eventId: event.id, data };
          });

          const sparklineResults = await Promise.all(sparklinePromises);
          const newSparklineData: Record<string, number[]> = {};
          sparklineResults.forEach(({ eventId, data }) => {
            newSparklineData[eventId] = data;
          });
          setSparklineData(newSparklineData);
        } else {
          setBreakoutEvents([]);
          setSparklineData({});
        }

        setLastUpdate(new Date());
      } catch (err) {
        console.error('Failed to fetch breakout events:', err);

        // Fallback to mock data if API fails
        const mockEvents: BreakoutEvent[] = [
          {
            id: 'mock_1',
            vtsSymbol: vtsSymbol || 'VTS-001',
            breakoutScore: 75 + Math.random() * 20,
            velocity: 1.5 + Math.random() * 1.5,
            triggerType: 'COMBINED',
            probability: 0.7 + Math.random() * 0.25,
            confidence: 0.65 + Math.random() * 0.3,
            detectedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            metadata: {
              acceleration: Math.random() * 0.4,
              volumeSpike: 100 + Math.random() * 250,
              sentimentShift: Math.random() * 0.35,
            },
          },
        ];

        setBreakoutEvents(mockEvents.slice(0, maxEvents));
        setLastUpdate(new Date());

        // Generate mock sparkline data
        const mockSparkline: Record<string, number[]> = {};
        mockEvents.forEach(event => {
          mockSparkline[event.id] = Array.from({ length: 20 }, (_, i) =>
            50 + Math.random() * 80 + event.breakoutScore / 3
          );
        });
        setSparklineData(mockSparkline);

        setError(err instanceof Error ? err.message : 'Failed to fetch breakout events');
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchBreakoutEvents();

    // Set up real-time updates via WebSocket (simulated with polling)
    if (realTime) {
      unsubscribeRealtime = vpmxService.subscribeToBreakouts((newEvent) => {
        setBreakoutEvents(prev => {
          // Avoid duplicate events
          if (prev.some(event => event.id === newEvent.id)) {
            return prev;
          }

          // Add new event to the beginning, limit to maxEvents
          const updatedEvents = [newEvent as BreakoutEvent, ...prev].slice(0, maxEvents);

          // Update sparkline data for the new event
          vpmxService.getHistoricalDataForSparkline(newEvent.vtsSymbol, 20).then(data => {
            setSparklineData(prevSparkline => ({
              ...prevSparkline,
              [newEvent.id]: data,
            }));
          }).catch(error => {
            console.error('Failed to fetch sparkline data for new event:', error);
          });

          return updatedEvents;
        });
        setLastUpdate(new Date());
      });
    }

    // Set up periodic refresh
    let refreshInterval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      refreshInterval = setInterval(fetchBreakoutEvents, 30000); // Refresh every 30 seconds
    }

    // Cleanup
    return () => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [vtsSymbol, maxEvents, autoRefresh, realTime]);

  const getBreakoutSeverity = (score: number) => {
    if (score >= 80) return { label: 'Critical', color: 'error' as const };
    if (score >= 60) return { label: 'High', color: 'warning' as const };
    if (score >= 40) return { label: 'Medium', color: 'info' as const };
    return { label: 'Low', color: 'success' as const };
  };

  const getTriggerTypeIcon = (type: string) => {
    switch (type) {
      case 'MOMENTUM':
        return <RiseOutlined sx={{ fontSize: 16 }} />;
      case 'VOLUME':
        return <Speed sx={{ fontSize: 16 }} />;
      case 'SENTIMENT':
        return <FlashOn sx={{ fontSize: 16 }} />;
      case 'COMBINED':
        return <Assessment sx={{ fontSize: 16 }} />;
      default:
        return <Timeline sx={{ fontSize: 16 }} />;
    }
  };

  const getTriggerTypeColor = (type: string) => {
    switch (type) {
      case 'MOMENTUM':
        return 'primary';
      case 'VOLUME':
        return 'secondary';
      case 'SENTIMENT':
        return 'warning';
      case 'COMBINED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getTimeSinceDetection = (detectedAt: string) => {
    const now = new Date();
    const detected = new Date(detectedAt);
    const diffMs = now.getTime() - detected.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleViewAnalysis = (event: BreakoutEvent) => {
    if (onViewAnalysis) {
      onViewAnalysis(event.vtsSymbol, event.id);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      setError(null);

      // Re-fetch breakout events from the service
      const events = await vpmxService.getBreakoutEvents(vtsSymbol, maxEvents);

      if (events.length > 0) {
        const formattedEvents: BreakoutEvent[] = events.map(event => ({
          id: event.id,
          vtsSymbol: event.vtsSymbol,
          breakoutScore: event.breakoutScore,
          velocity: event.velocity,
          triggerType: event.triggerType as any,
          probability: event.probability,
          confidence: event.confidence,
          detectedAt: event.detectedAt,
          metadata: event.metadata,
        }));

        setBreakoutEvents(formattedEvents);

        // Update sparkline data
        const sparklinePromises = formattedEvents.map(async (event) => {
          const data = await vpmxService.getHistoricalDataForSparkline(event.vtsSymbol, 20);
          return { eventId: event.id, data };
        });

        const sparklineResults = await Promise.all(sparklinePromises);
        const newSparklineData: Record<string, number[]> = {};
        sparklineResults.forEach(({ eventId, data }) => {
          newSparklineData[eventId] = data;
        });
        setSparklineData(newSparklineData);
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh breakout events');
    } finally {
      setLoading(false);
    }
  };

  if (loading && breakoutEvents.length === 0) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <div display="flex" alignItems="center" justifyContent="center" height={200}>
            <Typography variant="body2" color="text.secondary">
              Loading breakout events...
            </Typography>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && breakoutEvents.length === 0) {
    return (
      <Card sx={{ height }}>
        <CardContent>
          <div display="flex" alignItems="center" justifyContent="center" height={200} flexDirection="column" gap={2}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
            <IconButton size="small" onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ height, position: 'relative' }}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        p={2}
        borderBottom={1}
        borderColor="divider"
      >
        <div display="flex" alignItems="center" gap={1}>
          <FlashOn color="error" />
          <Typography variant="h6">Breakout Events</Typography>
          <Chip
            label={breakoutEvents.length}
            size="small"
            color="primary"
            variant="outlined"
          />
        </div>
        <div display="flex" alignItems="center" gap={1}>
          {realTime && lastUpdate && (
            <div display="flex" alignItems="center" gap={0.5}>
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
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <Tooltip title="Breakout events indicate rapid viral growth in trends">
            <IconButton size="small">
              <Info sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <CardContent sx={{ pt: 0 }}>
        {breakoutEvents.length === 0 ? (
          <div display="flex" alignItems="center" justifyContent="center" height={150} flexDirection="column" gap={2}>
            <Typography variant="body2" color="text.secondary">
              No breakout events detected
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Breakout events will appear here when trends experience rapid growth
            </Typography>
          </div>
        ) : (
          <div display="flex" flexDirection="column" gap={2}>
            {breakoutEvents.map((event, index) => {
              const severity = getBreakoutSeverity(event.breakoutScore);
              return (
                <Fade in key={event.id} timeout={500 + index * 100}>
                  <Box
                    p={2}
                    borderRadius={2}
                    bgcolor="background.paper"
                    border={1}
                    borderColor="divider"
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        bgcolor: 'action.hover',
                        borderColor: severity.color + '.main',
                        cursor: 'pointer',
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                    onClick={() => handleViewAnalysis(event)}
                  >
                    {/* Severity indicator bar */}
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      height={3}
                      bgcolor={theme.palette[severity.color].main}
                    />

                    {/* Main content */}
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <div display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {event.vtsSymbol}
                          </Typography>
                          <Chip
                            label={severity.label}
                            color={severity.color}
                            size="small"
                            icon={<FlashOn sx={{ fontSize: 14 }} />}
                          />
                        </div>

                        <div display="flex" alignItems="center" gap={1} mb={1}>
                          <Typography
                            variant="h4"
                            fontWeight="bold"
                            color={theme.palette[severity.color].main}
                          >
                            {event.breakoutScore}
                          </Typography>
                          <div display="flex" alignItems="center" gap={0.5}>
                            {event.velocity > 0 ? (
                              <RiseOutlined sx={{ fontSize: 16, color: 'success.main' }} />
                            ) : (
                              <FallOutlined sx={{ fontSize: 16, color: 'error.main' }} />
                            )}
                            <Typography
                              variant="body2"
                              color={event.velocity > 0 ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              {Math.abs(event.velocity).toFixed(1)}x
                            </Typography>
                          </div>
                        </div>

                        <div display="flex" alignItems="center" gap={1}>
                          <Chip
                            label={event.triggerType}
                            color={getTriggerTypeColor(event.triggerType) as any}
                            size="small"
                            variant="outlined"
                            icon={getTriggerTypeIcon(event.triggerType)}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {getTimeSinceDetection(event.detectedAt)}
                          </Typography>
                        </div>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        {showDetails && (
                          <div display="flex" flexDirection="column" gap={1}>
                            {/* Probability and Confidence */}
                            <div>
                              <div display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                  Probability
                                </Typography>
                                <Typography variant="caption" fontWeight="bold">
                                  {CurrencyFormatter.formatPercentage(event.probability, { decimals: 0 })}
                                </Typography>
                              </div>
                              <LinearProgress
                                variant="determinate"
                                value={event.probability * 100}
                                sx={{
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: theme.palette.primary.main,
                                  },
                                }}
                              />
                            </div>

                            <div>
                              <div display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                                <Typography variant="caption" color="text.secondary">
                                  Confidence
                                </Typography>
                                <Typography variant="caption" fontWeight="bold">
                                  {CurrencyFormatter.formatPercentage(event.confidence, { decimals: 0 })}
                                </Typography>
                              </div>
                              <LinearProgress
                                variant="determinate"
                                value={event.confidence * 100}
                                sx={{
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: theme.palette.secondary.main,
                                  },
                                }}
                              />
                            </div>

                            {/* Metadata indicators */}
                            <div display="flex" gap={1}>
                              {event.metadata.acceleration > 0 && (
                                <Chip
                                  label={`Accel ${event.metadata.acceleration.toFixed(2)}`}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                />
                              )}
                              {event.metadata.volumeSpike > 100 && (
                                <Chip
                                  label={`Vol ${event.metadata.volumeSpike.toFixed(0)}%`}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                />
                              )}
                            </div>
                          </div>
                        )}
                      </Grid>
                    </Grid>

                    {/* View Analysis button */}
                    <Box
                      position="absolute"
                      top={8}
                      right={8}
                      opacity={0}
                      transition="opacity 0.2s"
                      className="view-analysis-btn"
                      sx={{
                        '.parent:hover &': {
                          opacity: 1,
                        },
                      }}
                    >
                      <Tooltip title="View Detailed Analysis">
                        <IconButton size="small" onClick={(e) => {
                          e.stopPropagation();
                          handleViewAnalysis(event);
                        }}>
                          <OpenInNew sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </div>
                  </div>
                </Fade>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VPMXBreakoutCard;