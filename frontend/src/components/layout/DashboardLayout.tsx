import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  LineChart,
  Wallet,
  MessageSquare,
  Flame,
  Settings,
  Bell,
  User,
  LogOut,
  Menu,
  X,
  Crown,
  Users,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBrokerStore } from '../../stores/brokerStore';
import NotificationCenter from '../notifications/NotificationCenter';
import { useNotifications } from '../../hooks/useNotifications';

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: MenuItem[];
  divider?: boolean;
}

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { broker } = useBrokerStore();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      setCollapsed(mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Memoize menu items to prevent unnecessary re-renders
  const menuItems: MenuItem[] = useMemo(() => [
    {
      key: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      label: 'Dashboard',
    },
    {
      key: '/markets',
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Markets',
    },
    {
      key: '/trade',
      icon: <BarChart3 className="w-5 h-5" />,
      label: 'Trading',
    },
    {
      key: '/topics',
      icon: <Flame className="w-5 h-5" />,
      label: 'Viral Trends',
    },
    {
      key: '/analytics',
      icon: <LineChart className="w-5 h-5" />,
      label: 'Analytics',
    },
    {
      key: '/wallet',
      icon: <Wallet className="w-5 h-5" />,
      label: 'Wallet',
    },
    {
      key: '/chat',
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'Chat',
    },
    {
      key: '/settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      children: [
        {
          key: '/settings/profile',
          icon: <User className="w-4 h-4" />,
          label: 'Profile',
        },
        {
          key: '/settings/broker',
          icon: <Crown className="w-4 h-4" />,
          label: 'Broker',
        },
        {
          key: '/settings/security',
          icon: <Settings className="w-4 h-4" />,
          label: 'Security',
        },
      ],
    },
    ...(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'super_admin'
      ? [
          {
            key: 'admin-section',
            label: 'Admin Tools',
            divider: true as const,
            icon: null,
          } as MenuItem,
          {
            key: '/admin/vpmx',
            icon: <Shield className="w-5 h-5" />,
            label: 'VPMX Control',
          },
        ]
      : []),
    ...(broker
      ? [
          {
            key: 'broker-section',
            label: 'Broker Tools',
            divider: true as const,
            icon: null,
          } as MenuItem,
          {
            key: '/broker/dashboard',
            icon: <Crown className="w-5 h-5" />,
            label: 'Broker Dashboard',
          },
          {
            key: '/broker/clients',
            icon: <Users className="w-5 h-5" />,
            label: 'Client Management',
          },
        ]
      : []),
  ], [user?.role, broker]); // Only recalculate when user role or broker changes

  const handleMenuClick = useCallback((key: string) => {
    navigate(key);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, navigate]);

  const isActive = useCallback((key: string) => {
    return location.pathname === key || location.pathname.startsWith(key + '/');
  }, [location.pathname]);

  const renderHeader = useCallback(() => (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 backdrop-blur-xl bg-dark-900/80 border-b border-primary-700/20">
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left: Logo and Mobile Menu */}
        <div className="flex items-center gap-4">
          {isMobile && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-primary-700/20 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}

          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-8 h-8 bg-gradient-viral rounded-lg flex items-center justify-center shadow-glow">
              <span className="text-white font-bold text-sm">VX</span>
            </div>
            <span className="text-xl font-bold bg-gradient-viral bg-clip-text text-transparent">
              ViralFX
            </span>
          </div>

          {/* Broker Tier Badge */}
          {broker && (
            <div className="hidden sm:flex items-center px-3 py-1.5 bg-gradient-gold rounded-lg shadow-glow-gold border border-gold-600/30">
              <Crown className="w-4 h-4 text-gold-800 mr-1.5" />
              <span className="text-xs font-semibold text-gold-900">
                {broker.tier}
              </span>
            </div>
          )}
        </div>

        {/* Right: Notifications and User Menu */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <button
            onClick={() => setNotificationDrawerOpen(true)}
            className="relative p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-primary-700/20 transition-all hover:scale-105"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-danger-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-glow">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-3 p-2 pr-3 rounded-lg hover:bg-primary-700/20 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-purple flex items-center justify-center text-white font-semibold text-sm shadow-glow">
                {user?.firstName?.[0] || 'U'}
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-gray-400 capitalize">
                  {user?.role?.toLowerCase()}
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  userDropdownOpen ? 'rotate-90' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-56 rounded-xl backdrop-blur-xl bg-dark-800/95 border border-primary-700/30 shadow-2xl z-20"
                  >
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/settings/profile');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-primary-700/20 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span className="text-sm font-medium">Profile</span>
                      </button>

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:text-white hover:bg-primary-700/20 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span className="text-sm font-medium">Settings</span>
                      </button>

                      <div className="my-2 border-t border-primary-700/20" />

                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-danger-400 hover:text-danger-300 hover:bg-danger-500/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  ), [navigate, user, broker, unreadCount, notificationDrawerOpen, userDropdownOpen, isMobile]);

  // Prevent re-renders of sidebar
  const renderSidebar = useCallback(() => (
    <>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside
          className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-dark-900/80 backdrop-blur-xl border-r border-primary-700/20 transition-all duration-300 z-40 ${
            collapsed ? 'w-20' : 'w-64'
          }`}
        >
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              if (item.divider) {
                return (
                  <div
                    key={item.key}
                    className="px-3 py-2 mt-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                  >
                    {collapsed ? '' : item.label}
                  </div>
                );
              }

              const hasChildren = item.children && item.children.length > 0;

              return (
                <div key={item.key}>
                  <button
                    onClick={() => handleMenuClick(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group ${
                      isActive(item.key)
                        ? 'bg-gradient-purple text-white border-l-2 border-gold-600'
                        : 'text-gray-400 hover:text-white hover:bg-primary-700/20'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    {item.icon && (
                      <span
                        className={`${
                          isActive(item.key) ? 'text-gold-600' : ''
                        } flex-shrink-0`}
                      >
                        {item.icon}
                      </span>
                    )}
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    {!collapsed && hasChildren && (
                      <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                    )}
                    {collapsed && hasChildren && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-gold-600 rounded-full" />
                    )}
                  </button>

                  {/* Submenu */}
                  {!collapsed &&
                    hasChildren &&
                    isActive(item.key) &&
                    item.children && (
                      <div className="ml-8 mt-1 space-y-1">
                        {item.children.map((child) => (
                          <button
                            key={child.key}
                            onClick={() => handleMenuClick(child.key)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive(child.key)
                                ? 'text-gold-600 bg-gold-600/10'
                                : 'text-gray-400 hover:text-white hover:bg-primary-700/20'
                            }`}
                          >
                            {child.icon}
                            <span>{child.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </nav>

          {/* Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute bottom-4 right-4 p-2 rounded-lg bg-primary-700/20 text-gray-400 hover:text-white hover:bg-primary-700/40 transition-all"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${
                collapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </aside>
      )}

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobile && mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Mobile Drawer */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-72 bg-dark-900/95 backdrop-blur-xl border-r border-primary-700/20 z-50 overflow-y-auto"
            >
              <nav className="p-4 space-y-1">
                {menuItems.map((item) => {
                  if (item.divider) {
                    return (
                      <div
                        key={item.key}
                        className="px-3 py-2 mt-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {item.label}
                      </div>
                    );
                  }

                  const hasChildren = item.children && item.children.length > 0;

                  return (
                    <div key={item.key}>
                      <button
                        onClick={() => handleMenuClick(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                          isActive(item.key)
                            ? 'bg-gradient-purple text-white border-l-2 border-gold-600'
                            : 'text-gray-400 hover:text-white hover:bg-primary-700/20'
                        }`}
                      >
                        {item.icon && (
                          <span
                            className={isActive(item.key) ? 'text-gold-600' : ''}
                          >
                            {item.icon}
                          </span>
                        )}
                        <span className="text-sm font-medium">{item.label}</span>
                        {hasChildren && (
                          <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
                        )}
                      </button>

                      {/* Submenu */}
                      {hasChildren &&
                        isActive(item.key) &&
                        item.children && (
                          <div className="ml-8 mt-1 space-y-1">
                            {item.children.map((child) => (
                              <button
                                key={child.key}
                                onClick={() => handleMenuClick(child.key)}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                                  isActive(child.key)
                                    ? 'text-gold-600 bg-gold-600/10'
                                    : 'text-gray-400 hover:text-white hover:bg-primary-700/20'
                                }`}
                              >
                                {child.icon}
                                <span>{child.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  ), [collapsed, isMobile, mobileMenuOpen, menuItems, isActive, handleMenuClick, navigate, location.pathname]);

  // Prevent re-renders of notifications
  const renderNotifications = useCallback(() => (
    <AnimatePresence>
      {notificationDrawerOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => setNotificationDrawerOpen(false)}
          />

          {/* Notification Drawer */}
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-full max-w-md bg-dark-900/95 backdrop-blur-xl border-l border-primary-700/20 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-primary-700/20">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-primary-700" />
                <h2 className="text-lg font-semibold text-white">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-1 bg-danger-500 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotificationDrawerOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-primary-700/20 transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <NotificationCenter compact={true} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  ), [notificationDrawerOpen, unreadCount]);

  return (
    <div className="min-h-screen bg-dark-950">
      {renderHeader()}
      <div className="flex">
        {renderSidebar()}

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            isMobile ? 'ml-0' : collapsed ? 'ml-20' : 'ml-64'
          }`}
        >
          <div className="pt-16 min-h-screen">
            <Outlet />
          </div>
        </main>
      </div>
      {renderNotifications()}
    </div>
  );
};

export default DashboardLayout;
