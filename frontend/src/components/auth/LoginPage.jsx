import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthProvider';
import { getDefaultPageForRole } from '../../auth/permissions';
import { Button, Alert, Input, PasswordInput } from '../ui';

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p className="pms-text-muted" style={{ textAlign: 'center' }}>Restoring session…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={`/admin/${getDefaultPageForRole(user.role)}`} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(`/admin/${getDefaultPageForRole(loggedIn.role)}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <LogIn size={22} />
          <h1>Sign in to Umalila PMS</h1>
          <p className="pms-text-muted">Enter your staff credentials to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-card__form">
          {error && <Alert type="error" message={error} />}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            autoComplete="username"
            disabled={submitting}
          />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
          />
          <Button type="submit" variant="primary" fullWidth loading={submitting}>
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
