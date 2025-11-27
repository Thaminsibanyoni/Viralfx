import React from 'react';
import { Result, Button, Spin } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { ExclamationCircleOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';

export type Role = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'BROKER' | 'SUPPORT_AGENT' | 'SALES_MANAGER';

export type Permission =
  // Ticket permissions
  | 'ticket:read' | 'ticket:create' | 'ticket:update' | 'ticket:delete' | 'ticket:assign' | 'ticket:close'
  // Broker permissions
  | 'broker:read' | 'broker:create' | 'broker:update' | 'broker:delete' | 'broker:approve' | 'broker:suspend'
  // Client permissions
  | 'client:read' | 'client:create' | 'client:update' | 'client:delete'
  // Billing permissions
  | 'billing:read' | 'billing:create' | 'billing:update' | 'billing:export' | 'invoice:generate' | 'payment:process'
  // Deal permissions
  | 'deal:read' | 'deal:create' | 'deal:update' | 'deal:delete' | 'deal:assign' | 'pipeline:manage'
  // CRM Settings permissions
  | 'settings:read' | 'settings:update' | 'settings:manage'
  // System permissions
  | 'system:read' | 'system:manage' | 'logs:read' | 'backup:manage'
  // Analytics permissions
  | 'analytics:read' | 'analytics:export' | 'reports:generate'
  // Communication permissions
  | 'notifications:read' | 'notifications:send' | 'messages:read' | 'messages:send'
  // Import/Export permissions
  | 'import:data' | 'export:data';

export interface ResourceAccess {
  resource: string;
  actions: string[];
}

export interface CRMAccessGuardProps {
  children: React.ReactNode;
  roles?: Role[];
  permissions?: Permission[];
  resources?: ResourceAccess[];
  fallbackType?: 'login' | 'unauthorized' | 'forbidden' | 'loading';
  customFallback?: React.ReactNode;
  showReason?: boolean;
  redirectTo?: string;
}

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  USER: [
    'ticket:read', 'ticket:create',
    'client:read',
    'billing:read',
    'deal:read',
    'notifications:read',
    'messages:read', 'messages:send',
  ],

  BROKER: [
    'ticket:read', 'ticket:create',
    'client:read', 'client:create', 'client:update',
    'billing:read', 'billing:create',
    'deal:read', 'deal:create', 'deal:update',
    'notifications:read', 'notifications:send',
    'messages:read', 'messages:send',
    'analytics:read',
  ],

  SUPPORT_AGENT: [
    'ticket:read', 'ticket:create', 'ticket:update', 'ticket:assign', 'ticket:close',
    'broker:read',
    'client:read', 'client:create', 'client:update',
    'billing:read',
    'deal:read',
    'settings:read',
    'notifications:read', 'notifications:send',
    'messages:read', 'messages:send',
    'analytics:read',
  ],

  SALES_MANAGER: [
    'ticket:read', 'ticket:create', 'ticket:update',
    'broker:read', 'broker:create', 'broker:update',
    'client:read', 'client:create', 'client:update', 'client:delete',
    'billing:read', 'billing:create', 'billing:export',
    'deal:read', 'deal:create', 'deal:update', 'deal:assign', 'pipeline:manage',
    'analytics:read', 'analytics:export', 'reports:generate',
    'notifications:read', 'notifications:send',
    'messages:read', 'messages:send',
    'import:data', 'export:data',
  ],

  ADMIN: [
    'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete', 'ticket:assign', 'ticket:close',
    'broker:read', 'broker:create', 'broker:update', 'broker:approve', 'broker:suspend',
    'client:read', 'client:create', 'client:update', 'client:delete',
    'billing:read', 'billing:create', 'billing:update', 'billing:export', 'invoice:generate',
    'deal:read', 'deal:create', 'deal:update', 'deal:delete', 'deal:assign', 'pipeline:manage',
    'settings:read', 'settings:update',
    'analytics:read', 'analytics:export', 'reports:generate',
    'notifications:read', 'notifications:send',
    'messages:read', 'messages:send',
    'import:data', 'export:data',
  ],

  SUPER_ADMIN: [
    'ticket:read', 'ticket:create', 'ticket:update', 'ticket:delete', 'ticket:assign', 'ticket:close',
    'broker:read', 'broker:create', 'broker:update', 'broker:delete', 'broker:approve', 'broker:suspend',
    'client:read', 'client:create', 'client:update', 'client:delete',
    'billing:read', 'billing:create', 'billing:update', 'billing:export', 'invoice:generate', 'payment:process',
    'deal:read', 'deal:create', 'deal:update', 'deal:delete', 'deal:assign', 'pipeline:manage',
    'settings:read', 'settings:update', 'settings:manage',
    'system:read', 'system:manage', 'logs:read', 'backup:manage',
    'analytics:read', 'analytics:export', 'reports:generate',
    'notifications:read', 'notifications:send',
    'messages:read', 'messages:send',
    'import:data', 'export:data',
  ],
};

// Resource to permissions mapping
export const RESOURCE_PERMISSIONS: Record<string, Permission[]> = {
  'tickets': ['ticket:read'],
  'tickets:create': ['ticket:create'],
  'tickets:edit': ['ticket:update'],
  'tickets:delete': ['ticket:delete'],
  'tickets:assign': ['ticket:assign'],
  'tickets:close': ['ticket:close'],

  'brokers': ['broker:read'],
  'brokers:create': ['broker:create'],
  'brokers:edit': ['broker:update'],
  'brokers:delete': ['broker:delete'],
  'brokers:approve': ['broker:approve'],
  'brokers:suspend': ['broker:suspend'],

  'clients': ['client:read'],
  'clients:create': ['client:create'],
  'clients:edit': ['client:update'],
  'clients:delete': ['client:delete'],

  'billing': ['billing:read'],
  'billing:create': ['billing:create'],
  'billing:edit': ['billing:update'],
  'billing:export': ['billing:export'],
  'billing:invoices': ['invoice:generate'],
  'billing:payments': ['payment:process'],

  'deals': ['deal:read'],
  'deals:create': ['deal:create'],
  'deals:edit': ['deal:update'],
  'deals:delete': ['deal:delete'],
  'deals:assign': ['deal:assign'],
  'pipeline': ['pipeline:manage'],

  'settings': ['settings:read'],
  'settings:edit': ['settings:update'],
  'settings:manage': ['settings:manage'],

  'system': ['system:read'],
  'system:manage': ['system:manage'],
  'logs': ['logs:read'],
  'backup': ['backup:manage'],

  'analytics': ['analytics:read'],
  'analytics:export': ['analytics:export'],
  'reports': ['reports:generate'],

  'notifications': ['notifications:read'],
  'notifications:send': ['notifications:send'],
  'messages': ['messages:read'],
  'messages:send': ['messages:send'],

  'import': ['import:data'],
  'export': ['export:data'],
};

const CRMAccessGuard: React.FC<CRMAccessGuardProps> = ({
  children,
  roles = [],
  permissions = [],
  resources = [],
  fallbackType = 'forbidden',
  customFallback,
  showReason = true,
  redirectTo,
}) => {
  const {isAuthenticated, user, isLoading} = useAuthStore();

  // Check if user is authenticated
  if (!isAuthenticated) {
    if (customFallback) return customFallback;

    switch (fallbackType) {
      case 'login':
        return (
          <Result
            icon={<LockOutlined />}
            title="Authentication Required"
            subTitle="Please log in to access this resource."
            extra={
              <Button type="primary" href="/login">
                Go to Login
              </Button>
            }
          />
        );

      case 'loading':
        return <Spin size="large" />;

      default:
        return (
          <Result
            status="403"
            title="Authentication Required"
            subTitle="You must be logged in to access this resource."
          />
        );
    }
  }

  // Show loading spinner while checking auth
  if (isLoading) {
    return <Spin size="large" />;
  }

  // Get user permissions based on role
  const userPermissions = user?.role ? ROLE_PERMISSIONS[user.role] || [] : [];

  // Check role-based access
  if (roles.length > 0 && user?.role && !roles.includes(user.role)) {
    if (customFallback) return customFallback;

    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle={
          showReason ? (
            <>
              This resource requires one of the following roles: <strong>{roles.join(', ')}</strong>.
              <br />
              Your current role is: <strong>{user.role}</strong>.
            </>
          ) : undefined
        }
        icon={<LockOutlined />}
        extra={
          redirectTo && (
            <Button type="primary" href={redirectTo}>
              Go Back
            </Button>
          )
        }
      />
    );
  }

  // Check permission-based access
  if (permissions.length > 0) {
    const hasAllPermissions = permissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      if (customFallback) return customFallback;

      const missingPermissions = permissions.filter(permission =>
        !userPermissions.includes(permission)
      );

      return (
        <Result
          status="403"
          title="Insufficient Permissions"
          subTitle={
            showReason ? (
              <>
                You need the following permissions to access this resource:
                <ul style={{ textAlign: 'left', marginTop: 8 }}>
                  {missingPermissions.map(permission => (
                    <li key={permission}>
                      <code>{permission}</code>
                    </li>
                  ))}
                </ul>
              </>
            ) : undefined
          }
          icon={<SafetyOutlined />}
          extra={
            redirectTo && (
              <Button type="primary" href={redirectTo}>
                Go Back
              </Button>
            )
          }
        />
      );
    }
  }

  // Check resource-based access
  if (resources.length > 0) {
    const requiredPermissions = resources.flatMap(resource => {
      const resourcePerms = RESOURCE_PERMISSIONS[resource.resource] || [];
      return resource.actions.length > 0
        ? resource.actions.map(action => `${resource.resource}:${action}` as Permission)
        : resourcePerms;
    });

    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      if (customFallback) return customFallback;

      return (
        <Result
          status="403"
          title="Resource Access Denied"
          subTitle={
            showReason ? (
              <>
                You don't have permission to access the following resources:
                <ul style={{ textAlign: 'left', marginTop: 8 }}>
                  {resources.map(resource => (
                    <li key={resource.resource}>
                      <strong>{resource.resource}</strong>
                      {resource.actions.length > 0 && (
                        <> ({resource.actions.join(', ')})</>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : undefined
          }
          icon={<ExclamationCircleOutlined />}
          extra={
            redirectTo && (
              <Button type="primary" href={redirectTo}>
                Go Back
              </Button>
            )
          }
        />
      );
    }
  }

  // User has access, render children
  return <>{children}</>;
};

export default CRMAccessGuard;

// Utility hooks for checking permissions
export const _usePermissions = () => {
  const {user} = useAuthStore();

  const userPermissions = user?.role ? ROLE_PERMISSIONS[user.role] || [] : [];

  const hasPermission = (permission: Permission): boolean => {
    return userPermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => userPermissions.includes(permission));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => userPermissions.includes(permission));
  };

  const canAccessResource = (resource: string, actions: string[] = []): boolean => {
    const requiredPermissions = actions.length > 0
      ? actions.map(action => `${resource}:${action}` as Permission)
      : RESOURCE_PERMISSIONS[resource] || [];

    return requiredPermissions.every(permission => userPermissions.includes(permission));
  };

  const hasRole = (role: Role): boolean => {
    return user?.role === role;
  };

  const hasAnyRole = (roles: Role[]): boolean => {
    return roles.some(role => user?.role === role);
  };

  const getAccessibleResources = (): string[] => {
    return Object.entries(RESOURCE_PERMISSIONS)
      .filter(([_, requiredPermissions]) =>
        requiredPermissions.some(permission => userPermissions.includes(permission))
      )
      .map(([resource]) => resource);
  };

  return {
    permissions: userPermissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessResource,
    hasRole,
    hasAnyRole,
    getAccessibleResources,
  };
};

// Higher-order component for protecting routes
export const _withCRMAccess = (
  WrappedComponent: React.ComponentType<any>,
  accessProps: Omit<CRMAccessGuardProps, 'children'>
) => {
  return (props: any) => (
    <CRMAccessGuard {...accessProps}>
      <WrappedComponent {...props} />
    </CRMAccessGuard>
  );
};