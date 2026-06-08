import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, Coffee, ToggleLeft, ToggleRight } from 'lucide-react';

function AddonModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({
    name: '',
    price_per_night: '',
    base_breakfast: '',
    is_per_night: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              name: initialData.name || '',
              price_per_night: initialData.price_per_night ?? '',
              base_breakfast: initialData.base_breakfast ?? '',
              is_per_night: initialData.is_per_night !== false,
            }
          : { name: '', price_per_night: '', base_breakfast: '', is_per_night: true }
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price_per_night === '') {
      setError('Name and price are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        price_per_night: Number(form.price_per_night),
        price: Number(form.price_per_night),
        base_breakfast: Number(form.base_breakfast) || 0,
        is_per_night: form.is_per_night,
      };
      const url = isEdit ? `/api/addons/${initialData.id}` : '/api/addons';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save add-on');
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
            <Plus size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Add-on' : 'Create New Add-on'}</h3>
          </div>
          <button className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        {isEdit && (
          <div className="pricing-lock-notice">
            <AlertTriangle size={13} />
            Price changes apply to <strong>future reservations only</strong>. Existing bookings are locked.
          </div>
        )}

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          {error && <div className="pricing-form-error">{error}</div>}

          <div className="pricing-form-row">
            <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
              <label>Add-on Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Extra Bed, Breakfast Upgrade"
                required
              />
            </div>
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Price (IDR) *</label>
              <input
                type="number"
                min="0"
                value={form.price_per_night}
                onChange={(e) => setForm({ ...form, price_per_night: e.target.value })}
                placeholder="150000"
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
            <label>Billing Unit</label>
            <div className="pricing-toggle-row">
              <button
                type="button"
                className={`pricing-toggle-btn ${form.is_per_night ? 'active' : ''}`}
                onClick={() => setForm({ ...form, is_per_night: true })}
              >
                <ToggleRight size={14} /> Per Night
              </button>
              <button
                type="button"
                className={`pricing-toggle-btn ${!form.is_per_night ? 'active' : ''}`}
                onClick={() => setForm({ ...form, is_per_night: false })}
              >
                <ToggleLeft size={14} /> One-time Fee
              </button>
            </div>
            <p className="pricing-form-hint">
              {form.is_per_night
                ? 'Price will be multiplied by the number of nights.'
                : 'Price is charged once per booking, regardless of stay length.'}
            </p>
          </div>

          <div className="pricing-modal__footer">
            <button type="button" className="pricing-btn pricing-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pricing-btn pricing-btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Add-on'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, itemName, onClose, onConfirm, deleting }) {
  if (!isOpen) return null;
  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal pricing-modal--sm">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Trash2 size={15} style={{ color: 'var(--red)' }} />
            <h3>Delete Add-on</h3>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', marginBottom: 16 }}>
            Delete <strong>{itemName}</strong>? Existing bookings will not be affected.
          </p>
          <div className="pricing-modal__footer">
            <button className="pricing-btn pricing-btn--ghost" onClick={onClose} disabled={deleting}>Cancel</button>
            <button className="pricing-btn pricing-btn--danger" onClick={onConfirm} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddonsPricing() {
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAddon, setEditAddon] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAddons = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/addons');
      if (!res.ok) throw new Error('Failed to fetch add-ons');
      setAddons(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAddons(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/addons/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchAddons();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="pricing-pane">
      <div className="pricing-pane__toolbar">
        <div>
          <h4 className="pricing-pane__subtitle">Add-ons & Services</h4>
          <p className="pricing-pane__desc">Configure extra services available during booking. Rate changes affect future reservations only.</p>
        </div>
        <button className="pricing-btn pricing-btn--primary" onClick={() => { setEditAddon(null); setModalOpen(true); }}>
          <Plus size={14} /> Create New Add-on
        </button>
      </div>

      {loading && <div className="pricing-loading">Loading add-ons…</div>}
      {!loading && error && <div className="pricing-error">{error}</div>}
      {!loading && !error && (
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-right">Price (IDR)</th>
                <th className="text-center">Base Breakfast</th>
                <th className="text-center">Billing Unit</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {addons.length === 0 && (
                <tr><td colSpan={5} className="pricing-empty">No add-ons found. Create one to get started.</td></tr>
              )}
              {addons.map((a) => (
                <tr key={a.id}>
                  <td className="pricing-name-cell">{a.name}</td>
                  <td className="text-right pricing-rate-cell">
                    Rp {Number(a.price_per_night || 0).toLocaleString('id-ID')}
                  </td>
                  <td className="text-center">
                    {a.base_breakfast > 0 ? (
                      <span className="pricing-badge pricing-badge--green">
                        <Coffee size={10} /> {a.base_breakfast}
                      </span>
                    ) : (
                      <span className="pricing-text-muted">—</span>
                    )}
                  </td>
                  <td className="text-center">
                    <span className={`pricing-badge ${a.is_per_night !== false ? 'pricing-badge--blue' : 'pricing-badge--slate'}`}>
                      {a.is_per_night !== false ? 'Per Night' : 'One-time'}
                    </span>
                  </td>
                  <td className="text-center">
                    <div className="pricing-action-group">
                      <button
                        className="pricing-action-btn pricing-action-btn--edit"
                        title="Edit add-on"
                        onClick={() => { setEditAddon(a); setModalOpen(true); }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="pricing-action-btn pricing-action-btn--delete"
                        title="Delete add-on"
                        onClick={() => setDeleteTarget(a)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddonModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditAddon(null); }}
        onSaved={fetchAddons}
        initialData={editAddon}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}

export default AddonsPricing;
