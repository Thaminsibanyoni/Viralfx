import React from 'react';
import { Menu, Button, Badge, Tooltip } from 'antd';
import {
  HomeOutlined, UserOutlined, TeamOutlined, FileTextOutlined, DollarOutlined, CustomerServiceOutlined, WechatOutlined, SettingOutlined, BarChartOutlined, DownloadOutlined, UploadOutlined, SafetyOutlined, BellOutlined, MessageOutlined, CrownOutlined, PlusOutlined, } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../auth/CRMAccessGuard';
import NotificationCenter from '../crm/NotificationCenter';
import LiveUserStatus from '../crm/LiveUserStatus';

interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  badge?: number | string;
  children?: NavItem[];
}

interface PermissionAwareNavProps {
  className?: string;
  mode?: 'horizontal' | 'inline' | 'vertical';
  collapsed?: boolean;
  showNotifications?: boolean;
  showUserStatus?: boolean;
}

const PermissionAwareNav: React.FC<PermissionAwareNavProps> = ({
  className,
  mode = 'inline',
  collapsed = false,
  showNotifications = true,
  showUserStatus = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {canAccessResource, hasPermission} = usePermissions();

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      icon: <HomeOutlined />,
      path: '/admin',
      requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
    },
    {
      key: 'brokers',
      label: 'Brokers',
      icon: <TeamOutlined />,
      path: '/admin/crm/brokers',
      requiredPermissions: ['broker:read'],
      children: [
        {
          key: 'brokers-list',
          label: 'All Brokers',
          icon: <TeamOutlined />,
          path: '/admin/crm/brokers',
          requiredPermissions: ['broker:read'],
        },
        {
          key: 'brokers-create',
          label: 'Add New Broker',
          icon: <PlusOutlined />,
          path: '/admin/crm/brokers/create',
          requiredPermissions: ['broker:create'],
        },
      ],
    },
    {
      key: 'clients',
      label: 'Clients',
      icon: <UserOutlined />,
      path: '/admin/crm/clients',
      requiredPermissions: ['client:read'],
      children: [
        {
          key: 'clients-list',
          label: 'All Clients',
          icon: <UserOutlined />,
          path: '/admin/crm/clients',
          requiredPermissions: ['client:read'],
        },
        {
          key: 'clients-create',
          label: 'Add New Client',
          icon: <PlusOutlined />,
          path: '/admin/crm/clients/create',
          requiredPermissions: ['client:create'],
        },
      ],
    },
    {
      key: 'tickets',
      label: 'Support Tickets',
      icon: <CustomerServiceOutlined />,
      path: '/admin/crm/tickets',
      requiredPermissions: ['ticket:read'],
      badge: 'new', // This would come from a real-time count
      children: [
        {
          key: 'tickets-list',
          label: 'All Tickets',
          icon: <FileTextOutlined />,
          path: '/admin/crm/tickets',
          requiredPermissions: ['ticket:read'],
        },
        {
          key: 'tickets-create',
          label: 'Create Ticket',
          icon: <PlusOutlined />,
          path: '/admin/crm/tickets/create',
          requiredPermissions: ['ticket:create'],
        },
      ],
    },
    {
      key: 'billing',
      label: 'Billing & Invoices',
      icon: <DollarOutlined />,
      path: '/admin/crm/billing',
      requiredPermissions: ['billing:read'],
      children: [
        {
          key: 'billing-overview',
          label: 'Billing Overview',
          icon: <BarChartOutlined />,
          path: '/admin/crm/billing',
          requiredPermissions: ['billing:read'],
        },
        {
          key: 'billing-invoices',
          label: 'Invoices',
          icon: <FileTextOutlined />,
          path: '/admin/crm/billing/invoices',
          requiredPermissions: ['billing:read'],
        },
        {
          key: 'billing-payments',
          label: 'Payments',
          icon: <DollarOutlined />,
          path: '/admin/crm/billing/payments',
          requiredPermissions: ['payment:process'],
        },
        {
          key: 'billing-create-invoice',
          label: 'Create Invoice',
          icon: <PlusOutlined />,
          path: '/admin/crm/billing/invoices/create',
          requiredPermissions: ['invoice:generate'],
        },
      ],
    },
    {
      key: 'deals',
      label: 'Sales Pipeline',
      icon: <WechatOutlined />,
      path: '/admin/crm/deals',
      requiredPermissions: ['deal:read'],
      children: [
        {
          key: 'deals-list',
          label: 'All Deals',
          icon: <WechatOutlined />,
          path: '/admin/crm/deals',
          requiredPermissions: ['deal:read'],
        },
        {
          key: 'deals-pipeline',
          label: 'Pipeline View',
          icon: <BarChartOutlined />,
          path: '/admin/crm/deals/pipeline',
          requiredPermissions: ['pipeline:manage'],
        },
        {
          key: 'deals-create',
          label: 'Create Deal',
          icon: <PlusOutlined />,
          path: '/admin/crm/deals/create',
          requiredPermissions: ['deal:create'],
        },
      ],
    },
    {
      key: 'analytics',
      label: 'Analytics & Reports',
      icon: <BarChartOutlined />,
      path: '/admin/crm/analytics',
      requiredPermissions: ['analytics:read'],
      children: [
        {
          key: 'analytics-overview',
          label: 'Analytics Dashboard',
          icon: <BarChartOutlined />,
          path: '/admin/crm/analytics',
          requiredPermissions: ['analytics:read'],
        },
        {
          key: 'analytics-reports',
          label: 'Reports',
          icon: <FileTextOutlined />,
          path: '/admin/crm/analytics/reports',
          requiredPermissions: ['reports:generate'],
        },
        {
          key: 'analytics-export',
          label: 'Export Data',
          icon: <DownloadOutlined />,
          path: '/admin/crm/analytics/export',
          requiredPermissions: ['export:data'],
        },
      ],
    },
    {
      key: 'import-export',
      label: 'Import/Export',
      icon: <UploadOutlined />,
      requiredPermissions: ['import:data'],
      children: [
        {
          key: 'import-data',
          label: 'Import Data',
          icon: <UploadOutlined />,
          path: '/admin/crm/import',
          requiredPermissions: ['import:data'],
        },
        {
          key: 'export-data',
          label: 'Export Data',
          icon: <DownloadOutlined />,
          path: '/admin/crm/export',
          requiredPermissions: ['export:data'],
        },
      ],
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      path: '/admin/crm/settings',
      requiredPermissions: ['settings:read'],
      children: [
        {
          key: 'settings-general',
          label: 'General Settings',
          icon: <SettingOutlined />,
          path: '/admin/crm/settings',
          requiredPermissions: ['settings:read'],
        },
        {
          key: 'settings-system',
          label: 'System Settings',
          icon: <SafetyOutlined />,
          path: '/admin/crm/settings/system',
          requiredPermissions: ['system:manage'],
          requiredRoles: ['ADMIN', 'SUPER_ADMIN'],
        },
      ],
    },
    {
      key: 'system',
      label: 'System Administration',
      icon: <SafetyOutlined />,
      requiredRoles: ['SUPER_ADMIN'],
      children: [
        {
          key: 'system-overview',
          label: 'System Overview',
          icon: <BarChartOutlined />,
          path: '/admin/crm/system',
          requiredPermissions: ['system:read'],
        },
        {
          key: 'system-logs',
          label: 'System Logs',
          icon: <FileTextOutlined />,
          path: '/admin/crm/system/logs',
          requiredPermissions: ['logs:read'],
        },
        {
          key: 'system-backup',
          label: 'Backup & Restore',
          icon: <DownloadOutlined />,
          path: '/admin/crm/system/backup',
          requiredPermissions: ['backup:manage'],
        },
        {
          key: 'system-maintenance',
          label: 'Maintenance',
          icon: <SettingOutlined />,
          path: '/admin/crm/system/maintenance',
          requiredPermissions: ['system:manage'],
        },
      ],
    },
  ];

  // Filter navigation items based on user permissions
  const filterNavItems = (items: NavItem[]): NavItem[] => {
    return items.filter(item => {
      // Check if user has access to this item
      const hasAccess =
        // Check required permissions
        (!item.requiredPermissions || item.requiredPermissions.every(permission => hasPermission(permission as any))) &&
        // Check required roles
        (!item.requiredRoles || item.requiredRoles.some(role => hasPermission(role as any))) &&
        // Check resource access
        (canAccessResource(item.path.replace('/admin/crm/', '')) || canAccessResource(item.path.replace('/admin/', '')));

      if (!hasAccess) return false;

      // Filter children if they exist
      if (item.children) {
        item.children = filterNavItems(item.children);
        // If no children are accessible, hide the parent
        return item.children.length > 0;
      }

      return true;
    });
  };

  const accessibleNavItems = filterNavItems(navItems);

  // Convert to Ant Design Menu items format
  const menuItems = accessibleNavItems.map(item => ({
    key: item.key,
    icon: item.icon,
    label: (
      <span>
        {item.badge && (
          <Badge count={item.badge} size="small" className="mr-2">
            {item.label}
          </Badge>
        )}
        {!item.badge && item.label}
      </span>
    ),
    children: item.children?.map(child => ({
      key: child.key,
      icon: child.icon,
      label: child.label,
    })),
  }));

  const handleMenuClick = ({ key }: { key: string }) => {
    // Find the menu item and navigate to its path
    const findItem = (items: NavItem[], targetKey: string): NavItem | null => {
      for (const item of items) {
        if (item.key === targetKey) {
          return item;
        }
        if (item.children) {
          const found = findItem(item.children, targetKey);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findItem(navItems, key);
    if (item) {
      navigate(item.path);
    }
  };

  // Get current selected keys based on location
  const getSelectedKeys = (): string[] => {
    const currentPath = location.pathname;

    // Exact match first
    for (const item of navItems) {
      if (item.path === currentPath) {
        return [item.key];
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.path === currentPath) {
            return [item.key, child.key];
          }
        }
      }
    }

    // Then check for partial matches
    for (const item of navItems) {
      if (currentPath.startsWith(item.path + '/') || currentPath === item.path) {
        return [item.key];
      }
    }

    return [];
  };

  return (
    <div className={`permission-aware-nav ${className}`}>
      <Menu
        mode={mode}
        selectedKeys={getSelectedKeys()}
        items={menuItems}
        onClick={handleMenuClick}
        inlineCollapsed={collapsed}
        className="border-none"
      />

      {/* Additional controls for horizontal mode */}
      {mode === 'horizontal' && (
        <div className="flex items-center ml-auto space-x-4">
          {showNotifications && (
            <NotificationCenter />
          )}

          {showUserStatus && (
            <LiveUserStatus showStatusText={false} />
          )}

          <Tooltip title="Super Admin Panel">
            <Button
              type="text"
              icon={<CrownOutlined />}
              href="/superadmin"
              className="flex items-center"
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default PermissionAwareNav;