import React, { useState, useEffect, useMemo } from 'react';
import { Users as UsersIcon, Plus, Search, Pencil, UserCheck, UserX } from 'lucide-react';
import Badge from '../ui/Badge';
import TableActionButton from '../TableActionButton';
import TablePagination from '../ui/TablePagination';
import { Button, Modal, Alert, Input, Select, PasswordInput } from '../ui';
import { useMutation } from '../../context/MutationProvider';


const ROLE_OPTIONS = [
  { value: 'staff', label: 'Staff' },
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'deactivated', label: 'Deactivated' },
];

const PAGE_SIZE = 10;

function formatRole(role) {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label || role;
}

function formatCreatedAt(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function UserModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const { runMutation, isMutating } = useMutation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'staff',
    password: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              name: initialData.name || '',
              email: initialData.email || '',
              role: initialData.role || 'staff',
              password: '',
            }
          : { name: '', email: '', role: 'staff', password: '' }
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }

    if (!isEdit && !form.password.trim()) {
      setError('Password is required for new users.');
      return;
    }

    setError(null);

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
    };

    if (form.password.trim()) {
      payload.password = form.password;
    }

    const result = await runMutation({
      mutation: async () => {
        const url = isEdit ? `/api/users/${initialData.id}` : '/api/users';
        const method = isEdit ? 'PATCH' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save user');
        }
        return res.json();
      },
      refresh: onSaved,
      successMessage: isEdit ? 'User updated successfully.' : 'User created successfully.',
      overlayMessage: isEdit ? 'Saving changes…' : 'Creating user…',
    });

    if (result.ok) {
      onClose();
    } else {
      setError(result.error?.message || 'Failed to save user.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <Modal.Header
        title={isEdit ? 'Edit User' : 'Create New User'}
        icon={UsersIcon}
        subtitle={isEdit ? initialData.display_id : undefined}
        onClose={onClose}
      />
      <form onSubmit={handleSubmit}>
        <Modal.Body>
          {error && <Alert type="error" message={error} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Jane Doe"
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@example.com"
              required
            />
            <Select
              label="Role"
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              placeholder="Select role…"
            />
            <PasswordInput
              label={isEdit ? 'New Password' : 'Password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
              required={!isEdit}
              autoComplete={isEdit ? 'new-password' : 'new-password'}
              helpText={isEdit ? 'Only fill in to reset the password.' : undefined}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose} disabled={isMutating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isMutating}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

function UsersTable({ users, loading, onEdit, onToggleStatus, togglingId }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    return users.filter((user) => {
      const term = searchTerm.toLowerCase();
      if (
        term &&
        !user.name?.toLowerCase().includes(term) &&
        !user.email?.toLowerCase().includes(term) &&
        !user.display_id?.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      return true;
    });
  }, [users, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const paginatedData = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, users.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div>
      <div className="filter-bar">
        <div>
          <label className="filter-bar__label">Search</label>
          <div className="filter-bar__search-wrap">
            <Search size={13} className="filter-bar__search-icon" />
            <input
              type="text"
              className="filter-bar__input filter-bar__input--search"
              placeholder="Name, email, or user ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="filter-bar__label">Status</label>
          <select
            className="filter-bar__select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>

        <div />
      </div>

      <div className="table-result-count">
        {filtered.length === 0
          ? 'No results'
          : `Showing ${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} of ${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {loading ? (
        <div className="empty-state">Loading users…</div>
      ) : paginatedData.length === 0 ? (
        <div className="empty-state empty-state--dashed">
          <UsersIcon size={30} color="var(--text-light)" style={{ marginBottom: 10 }} />
          <h3 className="section-card__title" style={{ marginBottom: 6 }}>No users found</h3>
          <p className="text-muted" style={{ fontSize: '0.8rem' }}>
            {users.length === 0 ? 'Create the first system user to get started.' : 'Try adjusting your filters or search term.'}
          </p>
        </div>
      ) : (
        <div className="table-scroll-wrap">
          <table className="pms-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Role</th>
                <th className="text-center">Status</th>
                <th>Created</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((user) => {
                const isActive = user.status === 'active';
                return (
                  <tr key={user.id}>
                    <td>
                      <span className="cell-booking-id">{user.display_id || '—'}</span>
                    </td>
                    <td className="cell-guest">{user.name}</td>
                    <td>{formatRole(user.role)}</td>
                    <td className="text-center">
                      <Badge type="user" value={user.status || 'active'} />
                    </td>
                    <td>{formatCreatedAt(user.created_at)}</td>
                    <td className="text-center">
                      <div className="table-action-group">
                        <TableActionButton
                          title="Edit user"
                          variant="default"
                          onClick={() => onEdit(user)}
                        >
                          <Pencil size={13} />
                        </TableActionButton>
                        <TableActionButton
                          title={isActive ? 'Deactivate user' : 'Activate user'}
                          variant={isActive ? 'warning' : 'success'}
                          onClick={() => onToggleStatus(user)}
                          loading={togglingId === user.id}
                          disabled={togglingId === user.id}
                        >
                          {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
                        </TableActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const { runMutation } = useMutation();

  const fetchUsers = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      setUsers(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user) => {
    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    setTogglingId(user.id);

    await runMutation({
      mutation: async () => {
        const res = await fetch(`/api/users/${user.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update user status');
        }
        return res.json();
      },
      refresh: () => fetchUsers({ silent: true }),
      successMessage: nextStatus === 'active' ? 'User activated.' : 'User deactivated.',
      overlayMessage: nextStatus === 'active' ? 'Activating user…' : 'Deactivating user…',
    });

    setTogglingId(null);
  };

  const openCreateModal = () => {
    setEditUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditUser(user);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditUser(null);
  };

  return (
    <div className="reservation-page">
      <div className="section-card">
        <div className="section-card__header">
          <UsersIcon size={15} color="var(--navy)" />
          <h3 className="section-card__title">System Users</h3>
          <div className="section-header-row__actions" style={{ marginLeft: 'auto' }}>
            <span className="section-card__count" style={{ marginLeft: 0 }}>{users.length} total</span>
            <Button variant="primary" size="sm" icon={Plus} onClick={openCreateModal}>
              Create New User
            </Button>
          </div>
        </div>
        <div className="section-card__body">
          {error && !loading && <Alert type="error" message={error} className="pricing-alert" />}
          <UsersTable
            users={users}
            loading={loading}
            onEdit={openEditModal}
            onToggleStatus={handleToggleStatus}
            togglingId={togglingId}
          />
        </div>
      </div>

      <UserModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSaved={() => fetchUsers({ silent: true })}
        initialData={editUser}
      />
    </div>
  );
}

export default Users;
