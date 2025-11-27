import React, { useState, useEffect } from 'react';
import {
  
  Grid, Card, CardContent, Typography, TextField, Button, Tab, Tabs, Chip, Alert, CircularProgress, Accordion, AccordionSummary, AccordionDetails, } from '@mui/material';
import {
  Search, RiseOutlined, Timeline, Public, Assessment, ExpandMore, Add, Remove, } from '@mui/icons-material';
import { VPMXDisplay } from '../../components/vpmx/VPMXDisplay';
import { VPMXChart } from '../../components/vpmx/VPMXChart';
import { VPMXTicker } from '../../components/vpmx/VPMXTicker';
import { VPMXService } from '../../services/VPMXService';
import { WebSocketService } from '../../services/WebSocketService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vpmx-tabpanel-${index}`}
      aria-labelledby={`vpmx-tab-${index}`}
    >
      {value === index && <div>{children}</div>}
    </div>
  );
};

export const _VPMXPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState('V:US:ENT:BEIBERNEWALBUM');
  const [searchInput, setSearchInput] = useState('');
  const [trendingSymbols, setTrendingSymbols] = useState<string[]>([]);
  const [regionalData, setRegionalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(['V:US:ENT:BEIBERNEWALBUM', 'V:ZA:ENT:ZINHLEXD']);

  const wsService = WebSocketService.getInstance();

  useEffect(() => {
    const initializeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch trending symbols
        const trending = await VPMXService.getTopTrending(20);
        setTrendingSymbols(trending.map((t: any) => t.vtsSymbol));

        // Fetch regional data
        const regional = await VPMXService.getRegionalVPMXData();
        setRegionalData(regional);

        // Connect to WebSocket for real-time updates
        wsService.connect();

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize VPMX data');
      } finally {
        setLoading(false);
      }
    };

    initializeData();

    return () => {
      // Cleanup WebSocket connections
      wsService.unsubscribeAll();
    };
  }, []);

  const handleSearch = () => {
    if (searchInput.trim()) {
      setSelectedSymbol(searchInput.trim().toUpperCase());
    }
  };

  const _handleSymbolSelect = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSearchInput('');
  };

  const addToWatchlist = (symbol: string) => {
    if (!watchlist.includes(symbol)) {
      setWatchlist([...watchlist, symbol]);
    }
  };

  const removeFromWatchlist = (symbol: string) => {
    setWatchlist(watchlist.filter(s => s !== symbol));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <div display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading VPMX Dashboard...
        </Typography>
      </div>
    );
  }

  if (error) {
    return (
      <div p={3}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <div mb={3}>
        <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
          VPMX - Viral Popularity Market Index
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={2}>
          Real-time prediction market index for social trends, celebrity events, and viral content
        </Typography>

        {/* Live Ticker */}
        <VPMXTicker />

        {/* Search Bar */}
        <div display="flex" gap={2} mb={2}>
          <TextField
            fullWidth
            placeholder="Search VTS symbols (e.g., V:US:ENT:BEIBERNEWALBUM)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1 }} />,
            }}
          />
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Dashboard" icon={<Assessment />} />
          <Tab label="Markets" icon={<RiseOutlined />} />
          <Tab label="Regional" icon={<Public />} />
          <Tab label="Analysis" icon={<Timeline />} />
        </Tabs>
      </div>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        {/* Main Dashboard Tab */}
        <Grid container spacing={3}>
          {/* Current Symbol Display */}
          <Grid item xs={12} md={4}>
            <VPMXDisplay
              vtsSymbol={selectedSymbol}
              showDetails={true}
              showComponents={true}
              realTime={true}
            />
          </Grid>

          {/* Chart */}
          <Grid item xs={12} md={8}>
            <VPMXChart
              vtsSymbol={selectedSymbol}
              height={400}
              showControls={true}
              autoRefresh={true}
            />
          </Grid>

          {/* Watchlist */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Watchlist
                </Typography>
                <div display="flex" flexDirection="column" gap={2}>
                  {watchlist.map((symbol) => (
                    <div key={symbol} display="flex" alignItems="center" justifyContent="space-between">
                      <Typography
                        variant="body2"
                        sx={{ cursor: 'pointer' }}
                        onClick={() => setSelectedSymbol(symbol)}
                      >
                        {symbol}
                      </Typography>
                      <div display="flex" alignItems="center" gap={1}>
                        <VPMXDisplay vtsSymbol={symbol} height={80} showDetails={false} />
                        <Button
                          size="small"
                          onClick={() => removeFromWatchlist(symbol)}
                          color="error"
                        >
                          <Remove />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Grid>

          {/* Trending Symbols */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Trending Now
                </Typography>
                <div display="flex" flexDirection="column" gap={2}>
                  {trendingSymbols.slice(0, 10).map((symbol, index) => (
                    <div key={symbol} display="flex" alignItems="center" justifyContent="space-between">
                      <div display="flex" alignItems="center" gap={1}>
                        <Chip
                          label={`#${index + 1}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Typography
                          variant="body2"
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setSelectedSymbol(symbol)}
                        >
                          {symbol}
                        </Typography>
                      </div>
                      <div display="flex" alignItems="center" gap={1}>
                        <VPMXDisplay vtsSymbol={symbol} height={60} showDetails={false} />
                        {!watchlist.includes(symbol) && (
                          <Button
                            size="small"
                            onClick={() => addToWatchlist(symbol)}
                            color="primary"
                          >
                            <Add />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {/* Markets Tab */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Active Prediction Markets
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prediction markets will be displayed here. Users can bet on future VPMX outcomes.
                </Typography>
                {/* Market list would go here */}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* Regional Tab */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Regional VPMX Data
                </Typography>
                {regionalData && (
                  <Grid container spacing={2}>
                    {Object.entries(regionalData).map(([region, data]: [string, any]) => (
                      <Grid item xs={12} sm={6} md={4} key={region}>
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="h6" gutterBottom>
                              {region.toUpperCase()}
                            </Typography>
                            <Typography variant="h4" color="primary">
                              {data.value?.toFixed(0) || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Regional VPMX Index
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* Analysis Tab */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  VPMX Analysis & Insights
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Advanced analytics and pattern recognition for VPMX data.
                </Typography>

                {/* Analysis Accordion */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Component Analysis</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography>
                      Detailed breakdown of VPMX components including sentiment analysis,
                      viral momentum, and trend velocity factors.
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Pattern Recognition</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography>
                      AI-powered pattern detection for predicting future VPMX movements.
                    </Typography>
                  </AccordionDetails>
                </Accordion>

                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography>Risk Assessment</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Typography>
                      Comprehensive risk analysis including volatility, deception risk, and
                      trend stability metrics.
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </div>
  );
};