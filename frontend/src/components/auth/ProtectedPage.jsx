import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { canAccessPage, getPagePermission } from '../../auth/permissions';
import { adminLoginPath } from '../../auth/adminPaths';
import AccessDenied from './AccessDenied';

function ProtectedPage({ page, permission, children }) {
  const { user, loading } = useAuth();
  const pageSlug = page;
  const requiredPermission = permission || (pageSlug ? getPagePermission(pageSlug) : null);

  if (loading) {
    return <div className="empty-state">Loading…</div>;
  }

  if (!user) {
    return <Navigate to={adminLoginPath()} replace />;
  }

  if (requiredPermission && !canAccessPage(user.role, pageSlug)) {
    return <AccessDenied />;
  }

  return children;
}

export default ProtectedPage;
