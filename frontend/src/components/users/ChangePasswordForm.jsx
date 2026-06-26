import React, { useState } from 'react';
import { Button, Alert, PasswordInput } from '../ui';
import { useMutation } from '../../context/MutationProvider';

function ChangePasswordForm() {
  const { runMutation, isMutating } = useMutation();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    const result = await runMutation({
      mutation: async () => {
        const res = await fetch('/api/auth/change-password', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: form.currentPassword,
            new_password: form.newPassword,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to change password.');
        return data;
      },
      successMessage: 'Password changed successfully.',
      overlayMessage: 'Updating password…',
    });

    if (result.ok) {
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      setError(result.error?.message || 'Failed to change password.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-card__form">
      {error && <Alert type="error" message={error} />}
      <PasswordInput
        label="Current Password"
        value={form.currentPassword}
        onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
        autoComplete="current-password"
        required
      />
      <PasswordInput
        label="New Password"
        value={form.newPassword}
        onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        placeholder="Minimum 6 characters"
        autoComplete="new-password"
        required
      />
      <PasswordInput
        label="Confirm New Password"
        value={form.confirmPassword}
        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
        autoComplete="new-password"
        required
      />
      <Button type="submit" variant="primary" loading={isMutating}>
        Update Password
      </Button>
    </form>
  );
}

export default ChangePasswordForm;
