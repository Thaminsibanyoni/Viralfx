import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Broker, BrokerStats, BrokerClient, BrokerAnalytics, AttributionType, OAuthProvider } from '../types/broker';
import { brokerApi } from '../services/api/broker.api';

interface BrokerState {
  // Broker state
  broker: Broker | null;
  linkedBroker: boolean;
  isLinking: boolean;
  linkingError: string | null;

  // Broker stats
  brokerStats: BrokerStats | null;
  isLoadingStats: boolean;
  statsError: string | null;

  // Broker clients
  brokerClients: BrokerClient[];
  isLoadingClients: boolean;
  clientsError: string | null;
  clientFilters: {
    status?: string;
    attributionType?: AttributionType;
    search?: string;
    page: number;
    limit: number;
  };

  // Broker analytics
  brokerAnalytics: BrokerAnalytics | null;
  isLoadingAnalytics: boolean;
  analyticsError: string | null;
  analyticsDateRange: {
    start: Date;
    end: Date;
  };

  // Available brokers for linking
  availableBrokers: Broker[];
  isLoadingBrokers: boolean;
  brokersError: string | null;
  brokerFilters: {
    search?: string;
    tier?: string[];
    status?: string[];
    minRating?: number;
  };

  // OAuth linking state
  oauthState: {
    provider: OAuthProvider | null;
    brokerId: string | null;
    state: string | null;
    isProcessing: boolean;
  };

  // Actions
  setBroker: (broker: Broker | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Linking actions
  linkBroker: (brokerId: string, provider: string) => Promise<void>;
  unlinkBroker: () => Promise<void>;
  handleOAuthCallback: (code: string, state: string) => Promise<void>;

  // Stats actions
  fetchBrokerStats: (brokerId: string) => Promise<void>;
  fetchBrokerClients: (brokerId: string, filters?: any) => Promise<void>;
  setClientFilters: (filters: Partial<BrokerState['clientFilters']>) => void;

  // Analytics actions
  fetchBrokerAnalytics: (dateRange?: { start: string; end: string }) => Promise<void>;
  setAnalyticsDateRange: (dateRange: { start: Date; end: Date }) => void;

  // Fetch all broker data for dashboard
  fetchBrokerData: () => Promise<void>;

  // Available brokers actions
  fetchAvailableBrokers: (filters?: any) => Promise<void>;
  setBrokerFilters: (filters: Partial<BrokerState['brokerFilters']>) => void;

  // Clear state
  clearBrokerState: () => void;
}

export const _useBrokerStore = create<BrokerState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        broker: null,
        linkedBroker: false,
        isLinking: false,
        linkingError: null,

        brokerStats: null,
        isLoadingStats: false,
        statsError: null,

        brokerClients: [],
        isLoadingClients: false,
        clientsError: null,
        clientFilters: {
          page: 1,
          limit: 20,
        },

        brokerAnalytics: null,
        isLoadingAnalytics: false,
        analyticsError: null,
        analyticsDateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          end: new Date(),
        },

        availableBrokers: [],
        isLoadingBrokers: false,
        brokersError: null,
        brokerFilters: {},

        oauthState: {
          provider: null,
          brokerId: null,
          state: null,
          isProcessing: false,
        },

        // Basic setters
        setBroker: (broker) =>
          set((state) => {
            state.broker = broker;
            state.linkedBroker = !!broker;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLinking = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.linkingError = error;
          }),

        // Linking actions
        linkBroker: async (brokerId: string, provider: string) => {
          set((state) => {
            state.isLinking = true;
            state.linkingError = null;
            state.oauthState.isProcessing = true;
          });

          try {
            const response = await brokerApi.linkBrokerOAuth(brokerId, provider);

            // Store OAuth state for callback handling
            set((state) => {
              state.oauthState = {
                provider: { id: provider } as OAuthProvider,
                brokerId,
                state: response.data.state,
                isProcessing: true,
              };
            });

            // Open OAuth popup or redirect
            if (response.data.authorizationUrl) {
              window.open(response.data.authorizationUrl, '_blank', 'width=500,height=600,scrollbars=yes,resizable=yes');
            }

          } catch (error: any) {
            set((state) => {
              state.isLinking = false;
              state.linkingError = error.message || 'Failed to link broker';
              state.oauthState.isProcessing = false;
            });
          }
        },

        unlinkBroker: async () => {
          set((state) => {
            state.isLinking = true;
            state.linkingError = null;
          });

          try {
            await brokerApi.unlinkBroker();

            set((state) => {
              state.broker = null;
              state.linkedBroker = false;
              state.brokerStats = null;
              state.brokerClients = [];
              state.brokerAnalytics = null;
            });

          } catch (error: any) {
            set((state) => {
              state.linkingError = error.message || 'Failed to unlink broker';
            });
          } finally {
            set((state) => {
              state.isLinking = false;
            });
          }
        },

        handleOAuthCallback: async (code: string, state: string) => {
          const currentState = get();

          if (!currentState.oauthState.state || currentState.oauthState.state !== state) {
            set((state) => {
              state.linkingError = 'Invalid OAuth state';
              state.oauthState.isProcessing = false;
            });
            return;
          }

          try {
            const response = await brokerApi.handleOAuthCallback(code, state);

            set((state) => {
              state.broker = response.data.broker;
              state.linkedBroker = true;
              state.linkingError = null;
              state.oauthState = {
                provider: null,
                brokerId: null,
                state: null,
                isProcessing: false,
              };
            });

          } catch (error: any) {
            set((state) => {
              state.linkingError = error.message || 'Failed to complete OAuth linking';
              state.oauthState.isProcessing = false;
            });
          }
        },

        // Stats actions
        fetchBrokerStats: async (brokerId: string) => {
          set((state) => {
            state.isLoadingStats = true;
            state.statsError = null;
          });

          try {
            const response = await brokerApi.getBrokerStats(brokerId);

            set((state) => {
              state.brokerStats = response.data;
            });

          } catch (error: any) {
            set((state) => {
              state.statsError = error.message || 'Failed to fetch broker stats';
            });
          } finally {
            set((state) => {
              state.isLoadingStats = false;
            });
          }
        },

        fetchBrokerClients: async (brokerId: string, filters?: any) => {
          set((state) => {
            state.isLoadingClients = true;
            state.clientsError = null;
            if (filters) {
              state.clientFilters = { ...state.clientFilters, ...filters };
            }
          });

          try {
            const response = await brokerApi.getBrokerClients(
              brokerId,
              get().clientFilters
            );

            set((state) => {
              state.brokerClients = response.data.clients;
              // Update pagination if provided
              if (response.data.pagination) {
                state.clientFilters.page = response.data.pagination.page;
              }
            });

          } catch (error: any) {
            set((state) => {
              state.clientsError = error.message || 'Failed to fetch broker clients';
            });
          } finally {
            set((state) => {
              state.isLoadingClients = false;
            });
          }
        },

        setClientFilters: (filters) =>
          set((state) => {
            state.clientFilters = { ...state.clientFilters, ...filters };
          }),

        // Analytics actions
        fetchBrokerAnalytics: async (dateRange?: { start: string; end: string }) => {
          const {broker} = get();

          if (!broker) {
            set((state) => {
              state.analyticsError = 'No broker available';
            });
            return;
          }

          set((state) => {
            state.isLoadingAnalytics = true;
            state.analyticsError = null;
          });

          try {
            const response = await brokerApi.getBrokerAnalytics(
              broker.id,
              dateRange || {
                start: get().analyticsDateRange.start.toISOString(),
                end: get().analyticsDateRange.end.toISOString()
              }
            );

            set((state) => {
              state.brokerAnalytics = response.data;
            });

          } catch (error: any) {
            set((state) => {
              state.analyticsError = error.message || 'Failed to fetch broker analytics';
            });
          } finally {
            set((state) => {
              state.isLoadingAnalytics = false;
            });
          }
        },

        // Fetch all broker data for dashboard
        fetchBrokerData: async () => {
          const {broker} = get();

          if (!broker) return;

          try {
            await Promise.all([
              get().fetchBrokerStats(broker.id),
              get().fetchBrokerClients(broker.id),
              get().fetchBrokerAnalytics(),
            ]);
          } catch (error) {
            // Errors are handled by individual methods
          }
        },

        setAnalyticsDateRange: (dateRange) =>
          set((state) => {
            state.analyticsDateRange = dateRange;
          }),

        // Available brokers actions
        fetchAvailableBrokers: async (filters?: any) => {
          set((state) => {
            state.isLoadingBrokers = true;
            state.brokersError = null;
            if (filters) {
              state.brokerFilters = { ...state.brokerFilters, ...filters };
            }
          });

          try {
            const response = await brokerApi.getBrokers(get().brokerFilters);

            set((state) => {
              state.availableBrokers = response.data.brokers;
            });

          } catch (error: any) {
            set((state) => {
              state.brokersError = error.message || 'Failed to fetch available brokers';
            });
          } finally {
            set((state) => {
              state.isLoadingBrokers = false;
            });
          }
        },

        setBrokerFilters: (filters) =>
          set((state) => {
            state.brokerFilters = { ...state.brokerFilters, ...filters };
          }),

        // Clear state
        clearBrokerState: () =>
          set((state) => {
            state.broker = null;
            state.linkedBroker = false;
            state.brokerStats = null;
            state.brokerClients = [];
            state.brokerAnalytics = null;
            state.linkingError = null;
            state.clientsError = null;
            state.analyticsError = null;
            state.brokersError = null;
            state.oauthState = {
              provider: null,
              brokerId: null,
              state: null,
              isProcessing: false,
            };
          }),
      })),
      {
        name: 'broker-store',
        partialize: (state) => ({
          broker: state.broker,
          linkedBroker: state.linkedBroker,
          clientFilters: state.clientFilters,
          analyticsDateRange: state.analyticsDateRange,
          brokerFilters: state.brokerFilters,
        }),
      }
    ),
    {
      name: 'broker-store',
    }
  )
);

// Re-export with original name for compatibility
export const useBrokerStore = _useBrokerStore;
