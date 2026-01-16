import React, { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAdminStore } from '../../stores/adminStore';
import { LoadingSpinner } from '../shared/LoadingSpinner';

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
  const {isAuthenticated, user, isLoading: userLoading, isInitialized} = useAuthStore();
  const {isAuthenticated: adminAuthenticated, admin, loading: adminLoading, checkPermission} = useAdminStore();

  // Memoize route checks to prevent unnecessary recalculations
  const isSuperAdminRoute = useMemo(() => location.pathname.startsWith('/superadmin'), [location.pathname]);

  // Show loading spinner ONLY during initial hydration, not on every auth state change
  if (!isInitialized || (userLoading && !isAuthenticated)) {
    return <LoadingSpinner fullScreen={true} />;
  }

  // SuperAdmin route protection
  if (isSuperAdminRoute) {
    // Only redirect if we're sure admin is not authenticated (not loading)
    if (!adminAuthenticated && !adminLoading && admin === null) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Check role requirements
    if (requiredRole === 'SUPER_ADMIN' && admin && !admin.isSuperAdmin && admin.role !== 'SUPER_ADMIN') {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Check permission requirements
    if (requiredPermission && admin && !checkPermission(requiredPermission)) {
      return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    // Show loading while admin is being fetched
    if (adminLoading || !admin) {
      return <LoadingSpinner fullScreen={true} />;
    }

    return <>{children}</>;
  }

  // Regular user/admin route protection
  // Only redirect if we're sure user is not authenticated (not loading)
  if (!isAuthenticated && !userLoading && user === null) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Show loading while user is being fetched
  if (userLoading || !user) {
    return <LoadingSpinner fullScreen={true} />;
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

export default React.memo(ProtectedRoute);