import { Navigate } from 'react-router-dom';
import { adminPath } from '../../auth/adminPaths';

function ChangePasswordPage() {
  return <Navigate to={adminPath('profile')} replace />;
}

export default ChangePasswordPage;
