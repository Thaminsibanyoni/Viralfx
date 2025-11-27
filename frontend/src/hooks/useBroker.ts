import { useState, useEffect, useCallback } from 'react';
import { useBrokerStore } from '../stores/brokerStore';
import { Broker, BrokerStats, BrokerClient, BrokerAnalytics } from '../types/broker';
import { brokerApi } from '../services/api/broker.api';

interface UseBrokerReturn {
  broker: Broker | null;
  brokerStats: BrokerStats | null;
  brokerClients: BrokerClient[];
  brokerAnalytics: BrokerAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  linkBroker: (brokerId: string, provider: string) => Promise<void>;
  unlinkBroker: () => Promise<void>;
  updateClientFilters: (filters: any) => void;
  updateAnalyticsDateRange: (dateRange: { start: Date; end: Date }) => void;
}

export const useBroker = (): UseBrokerReturn => {
  const {broker, brokerStats, brokerClients, brokerAnalytics, isLoadingStats, isLoadingClients, isLoadingAnalytics, statsError, clientsError, analyticsError, linkBroker: storeLinkBroker, unlinkBroker: storeUnlinkBroker, fetchBrokerData, fetchBrokerClients, fetchBrokerAnalytics, setClientFilters, setAnalyticsDateRange, } = useBrokerStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await fetchBrokerData();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh broker data');
    } finally {
      setIsLoading(false);
    }
  }, [fetchBrokerData]);

  const linkBroker = useCallback(async (brokerId: string, provider: string) => {
    try {
      setError(null);
      await storeLinkBroker(brokerId, provider);
    } catch (err: any) {
      setError(err.message || 'Failed to link broker');
      throw err;
    }
  }, [storeLinkBroker]);

  const unlinkBroker = useCallback(async () => {
    try {
      setError(null);
      await storeUnlinkBroker();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink broker');
      throw err;
    }
  }, [storeUnlinkBroker]);

  const updateClientFilters = useCallback((filters: any) => {
    setClientFilters(filters);
  }, [setClientFilters]);

  const updateAnalyticsDateRange = useCallback((dateRange: { start: Date; end: Date }) => {
    setAnalyticsDateRange(dateRange);
  }, [setAnalyticsDateRange]);

  // Determine overall loading state
  const isAnyLoading = isLoadingStats || isLoadingClients || isLoadingAnalytics || isLoading;

  // Combine all errors
  const combinedError = error || statsError || clientsError || analyticsError;

  return {
    broker,
    brokerStats,
    brokerClients,
    brokerAnalytics,
    isLoading: isAnyLoading,
    error: combinedError,
    refreshData,
    linkBroker,
    unlinkBroker,
    updateClientFilters,
    updateAnalyticsDateRange,
  };
};