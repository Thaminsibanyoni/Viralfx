import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Badge, Tooltip } from 'antd';
import { Tag } from 'antd';
import {
  DashboardOutlined, UserOutlined, TeamOutlined, DollarOutlined, TrophyOutlined, AlertOutlined, CloudOutlined, SettingOutlined, NotificationOutlined, FileSearchOutlined, CrownOutlined, BellOutlined, ExclamationCircleOutlined, } from '@ant-design/icons';
import { useAdminStore } from '../../stores/adminStore';
import CollapsibleSection from '../common/CollapsibleSection';

interface CollapsibleSidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path?: string;
  badge?: React.ReactNode;
  permission?: string;
  superAdminOnly?: boolean;
  children?: MenuItem[];
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  collapsed,
  onCollapse,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {checkPermission, hasRole} = useAdminStore();

  // Navigation sections with collapsible groups
  const navigationSections = [
    {
      key: 'main',
      title: 'Main',
      items: [
        {
          key: '/superadmin',
          icon: <DashboardOutlined />,
          label: 'Overview',
          path: '/superadmin',
          permission: 'dashboard:read',
        },
      ],
    },
    {
      key: 'user-management',
      title: 'User Management',
      icon: <UserOutlined />,
      items: [
        {
          key: '/superadmin/users',
          icon: <UserOutlined />,
          label: 'Users',
          path: '/superadmin/users',
          permission: 'users:read',
        },
        {
          key: '/superadmin/users/kyc',
          icon: <ExclamationCircleOutlined />,
          label: 'KYC Reviews',
          path: '/superadmin/users/kyc',
          permission: 'kyc:read',
          badge: <Badge size="small" count={5} />,
        },
        {
          key: '/superadmin/users/suspensions',
          icon: <AlertOutlined />,
          label: 'Suspensions',
          path: '/superadmin/users/suspensions',
          permission: 'suspensions:read',
        },
      ],
    },
    {
      key: 'broker-management',
      title: 'Broker Management',
      icon: <TeamOutlined />,
      items: [
        {
          key: '/superadmin/brokers',
          icon: <TeamOutlined />,
          label: 'Brokers',
          path: '/superadmin/brokers',
          permission: 'brokers:read',
        },
        {
          key: '/superadmin/brokers/applications',
          icon: <FileSearchOutlined />,
          label: 'Applications',
          path: '/superadmin/brokers/applications',
          permission: 'brokers:read',
          badge: <Badge size="small" count={3} />,
        },
        {
          key: '/superadmin/brokers/compliance',
          icon: <SettingOutlined />,
          label: 'Compliance',
          path: '/superadmin/brokers/compliance',
          permission: 'compliance:read',
        },
      ],
    },
    {
      key: 'finance-operations',
      title: 'Finance Operations',
      icon: <DollarOutlined />,
      items: [
        {
          key: '/superadmin/finance',
          icon: <DollarOutlined />,
          label: 'Transactions',
          path: '/superadmin/finance',
          permission: 'finance:read',
        },
        {
          key: '/superadmin/finance/invoices',
          icon: <FileSearchOutlined />,
          label: 'Invoices',
          path: '/superadmin/finance/invoices',
          permission: 'invoices:read',
        },
        {
          key: '/superadmin/finance/payouts',
          icon: <DollarOutlined />,
          label: 'Payouts',
          path: '/superadmin/finance/payouts',
          permission: 'payouts:read',
          badge: <Badge size="small" count={2} />,
        },
      ],
    },
    {
      key: 'trend-operations',
      title: 'Trend Operations',
      icon: <TrophyOutlined />,
      items: [
        {
          key: '/superadmin/trends',
          icon: <TrophyOutlined />,
          label: 'Trends',
          path: '/superadmin/trends',
          permission: 'trends:read',
        },
        {
          key: '/superadmin/vts',
          icon: <CrownOutlined />,
          label: 'VTS Registry',
          path: '/superadmin/vts',
          permission: 'vts:read',
        },
        {
          key: '/superadmin/trends/disputes',
          icon: <AlertOutlined />,
          label: 'Disputes',
          path: '/superadmin/trends/disputes',
          permission: 'disputes:read',
        },
      ],
    },
    {
      key: 'risk-management',
      title: 'Risk Management',
      icon: <AlertOutlined />,
      items: [
        {
          key: '/superadmin/risk',
          icon: <AlertOutlined />,
          label: 'Risk Alerts',
          path: '/superadmin/risk',
          permission: 'risk:read',
          badge: <Badge size="small" count={8} />,
        },
        {
          key: '/superadmin/risk/content',
          icon: <FileSearchOutlined />,
          label: 'Content Moderation',
          path: '/superadmin/risk/content',
          permission: 'content:read',
        },
        {
          key: '/superadmin/risk/abuse',
          icon: <ExclamationCircleOutlined />,
          label: 'Abuse Detection',
          path: '/superadmin/risk/abuse',
          permission: 'abuse:read',
        },
      ],
    },
    {
      key: 'technical-operations',
      title: 'Technical Operations',
      icon: <CloudOutlined />,
      items: [
        {
          key: '/superadmin/oracle',
          icon: <CloudOutlined />,
          label: 'Oracle Network',
          path: '/superadmin/oracle',
          permission: 'oracle:read',
        },
        {
          key: '/superadmin/system/health',
          icon: <BellOutlined />,
          label: 'System Health',
          path: '/superadmin/system/health',
          permission: 'system:read',
        },
        {
          key: '/superadmin/system/logs',
          icon: <FileSearchOutlined />,
          label: 'System Logs',
          path: '/superadmin/system/logs',
          permission: 'logs:read',
        },
        {
          key: '/superadmin/system/resilience',
          icon: <SettingOutlined />,
          label: 'System Resilience',
          path: '/superadmin/system/resilience',
          permission: 'resilience:read',
        },
      ],
    },
    {
      key: 'platform-management',
      title: 'Platform Management',
      icon: <SettingOutlined />,
      items: [
        {
          key: '/superadmin/platform',
          icon: <SettingOutlined />,
          label: 'Platform Settings',
          path: '/superadmin/platform',
          permission: 'platform:read',
          superAdminOnly: true,
        },
        {
          key: '/superadmin/notifications',
          icon: <NotificationOutlined />,
          label: 'Notifications',
          path: '/superadmin/notifications',
          permission: 'notifications:read',
        },
        {
          key: '/superadmin/admins',
          icon: <UserOutlined />,
          label: 'Admin Management',
          path: '/superadmin/admins',
          permission: 'admins:read',
          superAdminOnly: true,
        },
      ],
    },
    {
      key: 'audit',
      title: 'Audit & Compliance',
      icon: <FileSearchOutlined />,
      items: [
        {
          key: '/superadmin/audit',
          icon: <FileSearchOutlined />,
          label: 'Audit Logs',
          path: '/superadmin/audit',
          permission: 'audit:read',
        },
      ],
    },
  ];

  // Filter navigation sections based on permissions
  const filteredSections = navigationSections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      // Check if item is for SuperAdmin only and user is not SuperAdmin
      if (item.superAdminOnly && !hasRole('SUPER_ADMIN')) {
        return false;
      }
      // Check if user has required permission
      if (item.permission && !checkPermission(item.permission)) {
        return false;
      }
      return true;
    }),
  })).filter(section => section.items.length > 0);

  // Handle navigation
  const handleNavigation = (path: string) => {
    navigate(path);
  };

  // Check if a path is currently active
  const isPathActive = (path: string) => {
    return location.pathname === path;
  };

  // Get default expanded sections based on current path
  const getDefaultExpandedSections = () => {
    const currentPath = location.pathname;
    const expandedSections: string[] = [];

    filteredSections.forEach(section => {
      const hasActiveItem = section.items.some(item =>
        item.path === currentPath || currentPath.startsWith(item.path + '/')
      );
      if (hasActiveItem) {
        expandedSections.push(section.key);
      }
    });

    return expandedSections;
  };

  // Render menu item
  const renderMenuItem = (item: any) => {
    const isActive = isPathActive(item.path);

    return (
      <button
        key={item.key}
        onClick={() => item.path && handleNavigation(item.path)}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-purple-700 text-white'
            : 'text-purple-100 hover:bg-purple-600 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0">{item.icon}</span>
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge && <span className="flex-shrink-0">{item.badge}</span>}
      </button>
    );
  };

  if (collapsed) {
    // Collapsed state - show only icons
    return (
      <div className="flex flex-col items-center py-4 space-y-2">
        <Tooltip title="Overview" placement="right">
          <button
            onClick={() => handleNavigation('/superadmin')}
            className={`p-3 rounded-lg transition-all duration-200 ${
              isPathActive('/superadmin')
                ? 'bg-purple-700 text-white'
                : 'text-purple-100 hover:bg-purple-600 hover:text-white'
            }`}
          >
            <DashboardOutlined className="text-xl" />
          </button>
        </Tooltip>

        {filteredSections.map(section =>
          section.items.slice(0, 1).map(item => (
            <Tooltip key={item.key} title={item.label} placement="right">
              <button
                onClick={() => item.path && handleNavigation(item.path)}
                className={`p-3 rounded-lg transition-all duration-200 relative ${
                  isPathActive(item.path)
                    ? 'bg-purple-700 text-white'
                    : 'text-purple-100 hover:bg-purple-600 hover:text-white'
                }`}
              >
                {item.icon}
                {item.badge && (
                  <span className="absolute -top-1 -right-1">
                    {item.badge}
                  </span>
                )}
              </button>
            </Tooltip>
          ))
        )}
      </div>
    );
  }

  // Expanded state - show full navigation with collapsible sections
  return (
    <div className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
      {filteredSections.map(section => (
        <CollapsibleSection
          key={section.key}
          title={section.title}
          icon={section.icon}
          variant="sidebar"
          defaultExpanded={getDefaultExpandedSections().includes(section.key)}
          persistState={true}
          storageKey={`sidebar-section-${section.key}`}
        >
          <div className="space-y-1">
            {section.items.map(renderMenuItem)}
          </div>
        </CollapsibleSection>
      ))}
    </div>
  );
};

export default CollapsibleSidebar;