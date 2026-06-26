import { useAuth } from '../context/AuthProvider';
import { hasPermission, hasAnyPermission } from './permissions';

export function usePermission(permission) {
  const { user } = useAuth();
  return hasPermission(user?.role, permission);
}

export function useAnyPermission(permissions) {
  const { user } = useAuth();
  return hasAnyPermission(user?.role, permissions);
}

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    role,
    can: (permission) => hasPermission(role, permission),
    canAny: (permissions) => hasAnyPermission(role, permissions),
  };
}
