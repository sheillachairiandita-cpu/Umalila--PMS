import React from 'react';
import { User, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import ChangePasswordForm from './ChangePasswordForm';

function Profile() {
  const { user } = useAuth();

  return (
    <div className="dashboard-container">
      <div className="profile-page">
        <div className="section-card">
          <div className="section-card__header">
            <User size={15} color="var(--navy)" />
            <h3 className="section-card__title">Profile</h3>
          </div>
          <div className="section-card__body">
            <div className="profile-info">
              <div className="profile-info__row">
                <span className="profile-info__label">Name</span>
                <span className="profile-info__value">{user?.name || '—'}</span>
              </div>
              <div className="profile-info__row">
                <span className="profile-info__label">Email</span>
                <span className="profile-info__value">{user?.email || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="section-card section-card--spaced">
          <div className="section-card__header">
            <KeyRound size={15} color="var(--navy)" />
            <h3 className="section-card__title">Change Password</h3>
          </div>
          <div className="section-card__body">
            <p className="pms-text-muted profile-password-desc">
              Update your account password. You will remain signed in after the change.
            </p>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
