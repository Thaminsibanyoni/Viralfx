import React, { useState, useEffect } from 'react';
import {
  
  Typography, Grid, Card, CardContent, TextField, Button, FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Chip, Alert, CircularProgress, IconButton, Tooltip, } from '@mui/material';
import {
  Refresh, RiseOutlined, Assessment, Timeline, Warning, Add, Search, } from '@mui/icons-material';
import { VPMXDisplay } from '../../components/vpmx/VPMXDisplay';
import { VPMXChart } from '../../components/vpmx/VPMXChart';
import { VPMXTicker } from '../../components/vpmx/VPMXTicker';
import { VPMXService } from '../../services/VPMXService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vpmx-tabpanel-${index}`}
      aria-labelledby={`vpmx-tab-${index}`}
      {...other}
    >
      {value === index && <div sx={{ p: 3 }}>{children}</div>}
    </div>
  );
}

export const _VPMXDashboard: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('V:US:ENT:BEIBERNEWALBUM');
  const [watchlist, setWatchlist] = useState<string[]>([
    'V:US:ENT:BEIBERNEWALBUM',
    'V:ZA:ENT:ZINHLEXD',
    'V:GLOBAL:SPORT:WORLDCUP',
    'V:US:POL:BIDEN2028',
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketStats, setMarketStats] = useState<any>(null);

  useEffect(() => {
    fetchMarketStats();
  }, []);

  const _fetchMarketStats = async () => {
    try {
      const stats = await VPMXService.getMarketStats();
      setMarketStats(stats);
    } catch (err) {
      console.error('Failed to fetch market stats:', err);
    }
  };

  const handleSymbolSearch = async () => {
    if (!searchSymbol.trim()) return;

    try {
      setLoading(true);
      setError(null);

      const data = await VPMXService.getCurrentVPMX(searchSymbol);
      if (data) {
        setSelectedSymbol(searchSymbol);
        if (!watchlist.includes(searchSymbol)) {
          setWatchlist(prev => [...prev, searchSymbol]);
        }
      } else {
        setError(`No VPMX data found for ${searchSymbol}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch VPMX data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleAddToWatchlist = (symbol: string) => {
    if (!watchlist.includes(symbol)) {
      setWatchlist(prev => [...prev, symbol]);
    }
  };

  const handleRemoveFromWatchlist = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div sx={{ width: '100%' }}>
      {/* Header */}
      <div sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          VPMX - Viral Popularity Market Index
        </Typography>
        <div display="flex" alignItems="center" gap={2}>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={handleRefresh}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Market Ticker */}
      <div sx={{ mb: 3 }}>
        <VPMXTicker />
      </div>

      {/* Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <div display="flex" alignItems="center" gap={2}>
            <TextField
              label="Search VTS Symbol"
              variant="outlined"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSymbolSearch()}
              placeholder="e.g., V:US:ENT:BEIBERNEWALBUM"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />,
              }}
            />
            <Button
              variant="contained"
              onClick={handleSymbolSearch}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <RiseOutlined />}
            >
              Analyze
            </Button>
          </div>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Market Stats Overview */}
      {marketStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <div display="flex" alignItems="center" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom>
                      Active Symbols
                    </Typography>
                    <Typography variant="h4" component="div">
                      {marketStats.activeSymbols || 0}
                    </Typography>
                  </div>
                  <Assessment color="primary" />
                </div>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <div display="flex" alignItems="center" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom>
                      Avg VPMX
                    </Typography>
                    <Typography variant="h4" component="div">
                      {marketStats.averageVPMX?.toFixed(0) || 0}
                    </Typography>
                  </div>
                  <Timeline color="success" />
                </div>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <div display="flex" alignItems="center" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom>
                      24h Volume
                    </Typography>
                    <Typography variant="h4" component="div">
                      {(marketStats.volume24h / 1000000).toFixed(1)}M
                    </Typography>
                  </div>
                  <RiseOutlined color="info" />
                </div>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <div display="flex" alignItems="center" justifyContent="space-between">
                  <div>
                    <Typography color="textSecondary" gutterBottom>
                      Market Cap
                    </Typography>
                    <Typography variant="h4" component="div">
                      ${(marketStats.marketCap / 1000000000).toFixed(1)}B
                    </Typography>
                  </div>
                  <Assessment color="warning" />
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <div sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Watchlist" />
          <Tab label="Analytics" />
          <Tab label="Predictions" />
          <Tab label="Risk Assessment" />
        </Tabs>
      </div>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <VPMXChart vtsSymbol={selectedSymbol} height={400} showComponents />
          </Grid>
          <Grid item xs={12} md={4}>
            <VPMXDisplay vtsSymbol={selectedSymbol} showDetails showComponents />
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {watchlist.map((symbol) => (
            <Grid item xs={12} sm={6} md={4} key={symbol}>
              <div position="relative">
                <VPMXDisplay vtsSymbol={symbol} showDetails={false} />
                <IconButton
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => handleRemoveFromWatchlist(symbol)}
                  size="small"
                >
                  <Warning />
                </IconButton>
              </div>
            </Grid>
          ))}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Add to Watchlist
                </Typography>
                <div display="flex" alignItems="center" gap={2}>
                  <TextField
                    label="VTS Symbol"
                    variant="outlined"
                    size="small"
                    placeholder="V:US:ENT:EXAMPLE"
                  />
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={() => {
                      const input = document.querySelector('input[placeholder="V:US:ENT:EXAMPLE"]') as HTMLInputElement;
                      if (input?.value) {
                        handleAddToWatchlist(input.value);
                        input.value = '';
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Top Performers
                </Typography>
                {/* Add top performers list component here */}
                <Typography color="textSecondary">
                  Analytics dashboard coming soon...
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Trending Topics
                </Typography>
                {/* Add trending topics component here */}
                <Typography color="textSecondary">
                  Trending analysis coming soon...
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              VPMX Predictions
            </Typography>
            <Typography color="textSecondary">
              AI-powered prediction models coming soon...
            </Typography>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Risk Assessment
            </Typography>
            <Typography color="textSecondary">
              Institutional-grade risk metrics coming soon...
            </Typography>
          </CardContent>
        </Card>
      </TabPanel>
    </div>
  );
};