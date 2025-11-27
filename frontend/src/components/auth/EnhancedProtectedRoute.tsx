import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import CRMAccessGuard, { Role, Permission, ResourceAccess } from './CRMAccessGuard';
import LoadingSpinner from '../shared/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';

export interface EnhancedProtectedRouteProps {
  children: React.ReactNode;
  // Role-based access
  requiredRole?: Role;
  requiredRoles?: Role[];
  // Permission-based access
  requiredPermissions?: Permission[];
  // Resource-based access
  requiredResources?: ResourceAccess[];
  // Fallback options
  redirectTo?: string;
  fallbackType?: 'login' | 'unauthorized' | 'forbidden' | 'loading';
  customFallback?: React.ReactNode;
  // Additional options
  showAccessReason?: boolean;
  skipAuthCheck?: boolean;
  companyVerified?: boolean;
  emailVerified?: boolean;
}

const EnhancedProtectedRoute: React.FC<EnhancedProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredRoles = [],
  requiredPermissions = [],
  requiredResources = [],
  redirectTo = '/login',
  fallbackType = 'forbidden',
  customFallback,
  showAccessReason = true,
  skipAuthCheck = false,
  companyVerified = false,
  emailVerified = false,
}) => {
  const location = useLocation();
  const {isAuthenticated, user, isLoading} = useAuthStore();

  // Build roles array from single role or multiple roles
  const roles = requiredRole ? [requiredRole] : requiredRoles;

  // Handle custom access logic for company/email verification
  const handleVerificationCheck = () => {
    if (!user) return false;

    if (companyVerified && !user.companyVerified) {
      return false;
    }

    if (emailVerified && !user.emailVerified) {
      return false;
    }

    return true;
  };

  // Handle loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Handle unauthenticated users
  if (!isAuthenticated && !skipAuthCheck) {
    // Store the attempted location for redirect after login
    const state = { from: location.pathname + location.search };
    return <Navigate to={redirectTo} state={state} replace />;
  }

  // Handle verification requirements
  if (!handleVerificationCheck()) {
    if (customFallback) return customFallback;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Required</h2>
          <p className="text-gray-600 mb-6">
            {companyVerified && !user?.companyVerified && (
              <>Your company needs to be verified before you can access this resource.</>
            )}
            {emailVerified && !user?.emailVerified && (
              <>Please verify your email address before accessing this resource.</>
            )}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/settings'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Complete Verification
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Use CRM Access Guard for role/permission/resource checks
  return (
    <CRMAccessGuard
      roles={roles}
      permissions={requiredPermissions}
      resources={requiredResources}
      fallbackType={fallbackType}
      customFallback={customFallback}
      showReason={showAccessReason}
      redirectTo={redirectTo}
    >
      {children}
    </CRMAccessGuard>
  );
};

export default EnhancedProtectedRoute;