import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Helmet } from 'react-helmet-async';

// Layouts
const MainLayout = lazy(() => import('./components/layout/MainLayout'));
const DashboardLayout = lazy(() => import('./components/layout/DashboardLayout'));

// Auth pages
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

// SuperAdmin pages
const SuperAdminLayout = lazy(() => import('./components/superadmin/SuperAdminLayout'));
const SuperAdminLogin = lazy(() => import('./pages/superadmin/SuperAdminLogin'));
const SuperAdminOverview = lazy(() => import('./pages/superadmin/Overview'));
const SuperAdminUsers = lazy(() => import('./pages/superadmin/Users'));
const SuperAdminBrokers = lazy(() => import('./pages/superadmin/Brokers'));
const SuperAdminFinance = lazy(() => import('./pages/superadmin/Finance'));
const SuperAdminTrends = lazy(() => import('./pages/superadmin/Trends'));
const SuperAdminRisk = lazy(() => import('./pages/superadmin/Risk'));
const SuperAdminVTS = lazy(() => import('./pages/superadmin/VTS'));
const SuperAdminOracle = lazy(() => import('./pages/superadmin/Oracle'));
const SuperAdminPlatform = lazy(() => import('./pages/superadmin/Platform'));
const SuperAdminNotifications = lazy(() => import('./pages/superadmin/Notifications'));
const SuperAdminAudit = lazy(() => import('./pages/superadmin/Audit'));
const SuperAdminAdmins = lazy(() => import('./pages/superadmin/Admins'));
const SuperAdminSystemResilience = lazy(() => import('./pages/superadmin/SystemResilience'));
const SuperAdminProviderHealth = lazy(() => import('./pages/superadmin/ProviderHealth'));
const SuperAdminCRM = lazy(() => import('./pages/superadmin/CRM'));
const SuperAdminSupport = lazy(() => import('./pages/superadmin/Support'));
const SuperAdminFinancialReports = lazy(() => import('./pages/superadmin/FinancialReports'));
const SuperAdminApiMarketplace = lazy(() => import('./pages/superadmin/ApiMarketplace'));

// Main pages
const Home = lazy(() => import('./pages/Home'));
const UserDashboard = lazy(() => import('./pages/dashboard/UserDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboard/AdminDashboard'));
const MarketsPage = lazy(() => import('./pages/markets/MarketsPage'));
const MarketDetailPage = lazy(() => import('./pages/markets/MarketDetailPage'));
const TopicsPage = lazy(() => import('./pages/topics/TopicsPage'));
const TopicDetailPage = lazy(() => import('./pages/topics/TopicDetailPage'));
const WalletPage = lazy(() => import('./pages/wallet/WalletPage'));
const ChatPage = lazy(() => import('./pages/chat/ChatPage'));
const Settings = lazy(() => import('./pages/Settings'));
const BrokerDashboard = lazy(() => import('./pages/BrokerDashboard'));

// CRM pages
const CRMDashboard = lazy(() => import('./pages/crm/CRMDashboard'));
const CRMAdminPage = lazy(() => import('./pages/admin/crm'));
const BrokersPage = lazy(() => import('./pages/admin/crm/BrokersPage'));
const BrokerDetailPage = lazy(() => import('./pages/admin/crm/BrokerDetailPage'));
const BillingPage = lazy(() => import('./pages/admin/crm/BillingPage'));
const TicketsPage = lazy(() => import('./pages/admin/crm/TicketsPage'));
const DealsPage = lazy(() => import('./pages/admin/crm/DealsPage'));
const ClientsPage = lazy(() => import('./pages/admin/crm/ClientsPage'));
const CRMSettings = lazy(() => import('./pages/admin/crm/CRMSettings'));
const InvoiceView = lazy(() => import('./pages/admin/crm/InvoiceView'));

// Additional pages
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const ReferralDashboard = lazy(() => import('./pages/referral/ReferralDashboard'));

// Developer Portal pages
const DevelopersOverview = lazy(() => import('./pages/developers/Overview'));
const DevelopersDocs = lazy(() => import('./pages/developers/Docs'));
const DevelopersKeys = lazy(() => import('./pages/developers/Keys'));
const DevelopersBilling = lazy(() => import('./pages/developers/Billing'));
const DevelopersApiExplorer = lazy(() => import('./pages/developers/ApiExplorer'));
const DevelopersWebhooks = lazy(() => import('./pages/developers/Webhooks'));

// Legal pages
const TermsPage = lazy(() => import('./pages/legal/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'));
const DisclaimerPage = lazy(() => import('./pages/legal/DisclaimerPage'));

// Components
const LoadingSpinner = lazy(() => import('./components/shared/LoadingSpinner'));
const ProtectedRoute = lazy(() => import('./components/auth/ProtectedRoute'));
const EnhancedProtectedRoute = lazy(() => import('./components/auth/EnhancedProtectedRoute'));

// Store
import { useAuthStore } from './stores/authStore';

function App() {
  const {isAuthenticated, _user, isLoading} = useAuthStore();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <>
      <Helmet
        defaultTitle="ViralFX - Trade Social Momentum"
        titleTemplate="%s | ViralFX"
      >
        <meta name="description" content="Real-time trading platform for social momentum and viral trends" />
        <meta name="keywords" content="trading, social media, viral, trends, markets, cryptocurrency" />
        <meta name="author" content="ViralFX" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ViralFX - Trade Social Momentum" />
        <meta property="og:description" content="Real-time trading platform for social momentum and viral trends" />
        <meta property="og:image" content="/og-image.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="ViralFX - Trade Social Momentum" />
        <meta property="twitter:description" content="Real-time trading platform for social momentum and viral trends" />
        <meta property="twitter:image" content="/og-image.png" />

        {/* Additional meta tags */}
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ViralFX" />
        <meta name="application-name" content="ViralFX" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </Helmet>

      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
            } />
            <Route path="/register" element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />
            } />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Legal routes */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/disclaimer" element={<DisclaimerPage />} />

            {/* Maintenance page */}
            <Route path="/maintenance" element={<MaintenancePage />} />

            {/* SuperAdmin Login */}
            <Route path="/admin/login" element={<SuperAdminLogin />} />
          </Route>

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<UserDashboard />} />
          </Route>

          <Route
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/markets" element={<MarketsPage />} />
            <Route path="/markets/:id" element={<MarketDetailPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/topics/:id" element={<TopicDetailPage />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings/*" element={<Settings />} />
            <Route path="/referral" element={<ReferralDashboard />} />
            <Route path="/broker/dashboard" element={<BrokerDashboard />} />
            <Route path="/crm" element={<CRMDashboard />} />

            {/* Developer Portal routes */}
            <Route path="/developers" element={<DashboardLayout />}>
              <Route index element={<DevelopersOverview />} />
              <Route path="docs" element={<DevelopersDocs />} />
              <Route path="keys" element={<DevelopersKeys />} />
              <Route path="billing" element={<DevelopersBilling />} />
              <Route path="explorer" element={<DevelopersApiExplorer />} />
              <Route path="webhooks" element={<DevelopersWebhooks />} />
            </Route>
          </Route>

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <EnhancedProtectedRoute
                requiredRoles={['ADMIN', 'SUPER_ADMIN']}
                redirectTo="/login"
                fallbackType="forbidden"
              >
                <DashboardLayout />
              </EnhancedProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="crm" element={
              <EnhancedProtectedRoute
                requiredPermissions={['broker:read', 'ticket:read', 'billing:read']}
                fallbackType="forbidden"
              >
                <CRMAdminPage />
              </EnhancedProtectedRoute>
            }>
              <Route index element={
                <EnhancedProtectedRoute
                  requiredPermissions={['broker:read']}
                  fallbackType="forbidden"
                >
                  <BrokersPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="brokers" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['broker:read']}
                  fallbackType="forbidden"
                >
                  <BrokersPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="brokers/:id" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['broker:read']}
                  fallbackType="forbidden"
                >
                  <BrokerDetailPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="billing" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['billing:read']}
                  fallbackType="forbidden"
                >
                  <BillingPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="billing/invoices/:invoiceId" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['billing:read']}
                  fallbackType="forbidden"
                >
                  <InvoiceView />
                </EnhancedProtectedRoute>
              } />
              <Route path="tickets" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['ticket:read']}
                  fallbackType="forbidden"
                >
                  <TicketsPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="deals" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['deal:read']}
                  fallbackType="forbidden"
                >
                  <DealsPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="clients" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['client:read']}
                  fallbackType="forbidden"
                >
                  <ClientsPage />
                </EnhancedProtectedRoute>
              } />
              <Route path="settings" element={
                <EnhancedProtectedRoute
                  requiredPermissions={['settings:read']}
                  fallbackType="forbidden"
                >
                  <CRMSettings />
                </EnhancedProtectedRoute>
              } />
            </Route>
          </Route>

          {/* SuperAdmin routes */}
          <Route
            path="/superadmin"
            element={
              <ProtectedRoute requiredRole="SUPER_ADMIN">
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SuperAdminOverview />} />
            <Route path="users" element={<SuperAdminUsers />} />
            <Route path="brokers" element={<SuperAdminBrokers />} />
            <Route path="finance" element={<SuperAdminFinance />} />
            <Route path="trends" element={<SuperAdminTrends />} />
            <Route path="risk" element={<SuperAdminRisk />} />
            <Route path="vts" element={<SuperAdminVTS />} />
            <Route path="oracle" element={<SuperAdminOracle />} />
            <Route path="platform" element={<SuperAdminPlatform />} />
            <Route path="notifications" element={<SuperAdminNotifications />} />
            <Route path="audit" element={<SuperAdminAudit />} />
            <Route path="admins" element={<SuperAdminAdmins />} />
            <Route path="system/resilience" element={<SuperAdminSystemResilience />} />
            <Route path="system/provider-health" element={<SuperAdminProviderHealth />} />
            <Route path="crm" element={<SuperAdminCRM />} />
            <Route path="support" element={<SuperAdminSupport />} />
            <Route path="financial-reports" element={<SuperAdminFinancialReports />} />
            <Route path="api-marketplace" element={<SuperAdminApiMarketplace />} />
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;