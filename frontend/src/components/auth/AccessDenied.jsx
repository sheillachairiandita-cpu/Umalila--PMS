import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../ui';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthProvider';
import { getDefaultPageForRole } from '../../auth/permissions';
import { adminPath } from '../../auth/adminPaths';

function AccessDenied({ message }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const homePath = adminPath(getDefaultPageForRole(user?.role));

  return (
    <div className="access-denied-page">
      <div className="access-denied-card">
        <ShieldAlert size={40} className="access-denied-card__icon" />
        <h1 className="access-denied-card__title">Access Denied</h1>
        <p className="access-denied-card__message">
          {message || 'You do not have permission to view this page.'}
        </p>
        <Button variant="primary" onClick={() => navigate(homePath)}>
          Go to Home
        </Button>
      </div>
    </div>
  );
}

export default AccessDenied;
