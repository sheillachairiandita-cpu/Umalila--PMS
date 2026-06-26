import React from 'react';
import { usePermission } from '../../auth/usePermission';

/**
 * Renders children only when the current user has the given permission.
 */
function RequirePermission({ permission, children, fallback = null }) {
  const allowed = usePermission(permission);
  if (!allowed) return fallback;
  return children;
}

export default RequirePermission;
