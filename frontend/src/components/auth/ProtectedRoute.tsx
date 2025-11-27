import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { useAdminStore } from '../../stores/adminStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  requiredPermission?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermission,
}) => {
  const location = useLocation();
  const {isAuthenticated, user, loading: userLoading} = useAuthStore();
  const {isAuthenticated: adminAuthenticated, admin, loading: adminLoading, checkPermission} = useAdminStore();

  // Check if this is a SuperAdmin route
  const isSuperAdminRoute = location.pathname.startsWith('/superadmin');

  // Show loading spinner while checking authentication
  if (userLoading || adminLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // SuperAdmin route protection
  if (isSuperAdminRoute) {
    if (!adminAuthenticated || !admin) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Check role requirements
    if (requiredRole === 'SUPER_ADMIN' && !admin.isSuperAdmin && admin.role !== 'SUPER_ADMIN') {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Check permission requirements
    if (requiredPermission && !checkPermission(requiredPermission)) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
  }

  // Regular user/admin route protection
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements for regular routes
  if (requiredRole) {
    switch (requiredRole) {
      case 'ADMIN':
        if (user.role !== 'ADMIN') {
          return <Navigate to="/dashboard" replace />;
        }
        break;
      case 'SUPER_ADMIN':
        // SuperAdmin should go to SuperAdmin portal
        return <Navigate to="/superadmin" replace />;
      default:
        break;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;