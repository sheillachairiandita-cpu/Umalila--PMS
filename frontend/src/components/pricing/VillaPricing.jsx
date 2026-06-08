import React, { useState, useEffect } from 'react';
import { Plus, Home, Coffee } from 'lucide-react';
import {
  PricingPaneToolbar,
  PricingLockNotice,
  PricingFormError,
  PricingFormFooter,
  PricingDeleteModal,
  PricingActionCell,
  PricingLoadingState,
  PricingErrorState,
  formatRp,
} from './pricingShared';

function VillaModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    name: '',
    base_rate_per_night: '',
    base_breakfast: '',
    capacity: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              name: initialData.name || '',
              base_rate_per_night: initialData.base_rate_per_night ?? '',
              base_breakfast: initialData.base_breakfast ?? '',
              capacity: initialData.capacity ?? '',
              description: initialData.description || '',
            }
          : { name: '', base_rate_per_night: '', base_breakfast: '', capacity: '', description: '' }
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.base_rate_per_night === '') {
      setError('Name and base rate are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        base_rate_per_night: Number(form.base_rate_per_night),
        base_breakfast: Number(form.base_breakfast) || 0,
        capacity: Number(form.capacity) || 1,
        description: form.description.trim(),
      };
      const url = isEdit ? `/api/villas/${initialData.id}` : '/api/villas';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save villa');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Home size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Villa' : 'Create New Villa'}</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        {isEdit && (
          <PricingLockNotice>
            Rate changes apply to <strong>future reservations only</strong>. Existing bookings are locked.
          </PricingLockNotice>
        )}

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          <PricingFormError message={error} />

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Villa Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Lembah Suite"
                required
              />
            </div>
            <div className="pricing-form-group">
              <label>Capacity (Guests)</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                placeholder="2"
              />
            </div>
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Base Rate / Night (IDR) *</label>
              <input
                type="number"
                min="0"
                value={form.base_rate_per_night}
                onChange={(e) => setForm({ ...form, base_rate_per_night: e.target.value })}
                placeholder="750000"
                required
              />
            </div>
            <div className="pricing-form-group">
              <label>Base Breakfast (portions)</label>
              <input
                type="number"
                min="0"
                value={form.base_breakfast}
                onChange={(e) => setForm({ ...form, base_breakfast: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
            <label>Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of the villa unit…"
            />
          </div>

          <PricingFormFooter
            onCancel={onClose}
            submitting={submitting}
            submitLabel={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Villa'}
          />
        </form>
      </div>
    </div>
  );
}

function VillaPricing() {
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editVilla, setEditVilla] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchVillas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/villas');
      if (!res.ok) throw new Error('Failed to fetch villas');
      setVillas(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVillas(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/villas/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchVillas();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const openCreate = () => { setEditVilla(null); setModalOpen(true); };
  const openEdit = (villa) => { setEditVilla(villa); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditVilla(null); };

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Property Units"
        description="Manage villa rates and breakfast allocations. Changes apply to future reservations only."
        actionLabel="Create New Villa"
        actionIcon={Plus}
        onAction={openCreate}
      />

      {loading && <PricingLoadingState message="Loading villas…" />}
      {!loading && error && <PricingErrorState message={error} />}
      {!loading && !error && (
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Display ID</th>
                <th>Name</th>
                <th className="text-right">Base Rate / Night</th>
                <th className="text-center">Base Breakfast</th>
                <th className="text-center">Capacity</th>
                <th>Description</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {villas.length === 0 && (
                <tr><td colSpan={7} className="pricing-empty">No villas found. Create one to get started.</td></tr>
              )}
              {villas.map((v) => (
                <tr key={v.id}>
                  <td><span className="pricing-id-pill">{v.display_id || v.id?.slice(0, 8)}</span></td>
                  <td className="pricing-name-cell">{v.name}</td>
                  <td className="text-right pricing-rate-cell">{formatRp(v.base_rate_per_night)}</td>
                  <td className="text-center">
                    {v.base_breakfast > 0 ? (
                      <span className="pricing-badge pricing-badge--green">
                        <Coffee size={10} /> {v.base_breakfast}
                      </span>
                    ) : (
                      <span className="pricing-text-muted">—</span>
                    )}
                  </td>
                  <td className="text-center">{v.capacity ?? '—'}</td>
                  <td className="pricing-desc-cell">{v.description || <span className="pricing-text-muted">—</span>}</td>
                  <td className="text-center">
                    <PricingActionCell
                      editTitle="Edit villa"
                      deleteTitle="Delete villa"
                      onEdit={() => openEdit(v)}
                      onDelete={() => setDeleteTarget(v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VillaModal isOpen={modalOpen} onClose={closeModal} onSaved={fetchVillas} initialData={editVilla} />
      <PricingDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Villa"
        itemName={deleteTarget?.name}
        message={
          deleteTarget ? (
            <>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.
              Existing bookings will not be affected.
            </>
          ) : null
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

export default VillaPricing;
