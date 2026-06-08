import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Tag, Percent, DollarSign, AlertTriangle } from 'lucide-react';

const SCOPE_OPTIONS = [
  { value: 'global',    label: 'Global (All Items)' },
  { value: 'villas',    label: 'Villas Only' },
  { value: 'addons',    label: 'Add-ons Only' },
  { value: 'menu',      label: 'Menu Only' },
];

const TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed',      label: 'Fixed Amount (IDR)' },
];

const EMPTY_FORM = {
  promo_code: '',
  name: '',
  type: 'percentage',
  value: '',
  scope: 'global',
  is_active: true,
  description: '',
};

// ─── Local storage key (swap with API calls when backend is ready) ───────────
const LS_KEY = 'umalila_discounts_v1';

function loadDiscounts() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDiscounts(discounts) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(discounts));
  } catch {}
}

function generateId() {
  return `disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function DiscountModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(isEdit ? { ...EMPTY_FORM, ...initialData } : { ...EMPTY_FORM });
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.promo_code.trim() || !form.name.trim() || form.value === '') {
      setError('Promo code, name, and value are required.');
      return;
    }
    if (form.type === 'percentage' && (Number(form.value) <= 0 || Number(form.value) > 100)) {
      setError('Percentage discount must be between 1 and 100.');
      return;
    }
    if (Number(form.value) < 0) {
      setError('Value must be a positive number.');
      return;
    }
    setSubmitting(true);

    // Simulate async save — replace with real API call when backend is ready
    setTimeout(() => {
      const discounts = loadDiscounts();
      if (isEdit) {
        const idx = discounts.findIndex((d) => d.id === initialData.id);
        if (idx !== -1) {
          discounts[idx] = { ...form, id: initialData.id, value: Number(form.value) };
        }
      } else {
        const code = form.promo_code.trim().toUpperCase();
        if (discounts.some((d) => d.promo_code === code)) {
          setError('A discount with this promo code already exists.');
          setSubmitting(false);
          return;
        }
        discounts.push({ ...form, promo_code: code, id: generateId(), value: Number(form.value) });
      }
      saveDiscounts(discounts);
      setSubmitting(false);
      onSaved();
      onClose();
    }, 300);
  };

  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Tag size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Discount' : 'Create New Discount'}</h3>
          </div>
          <button className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="pricing-lock-notice">
          <AlertTriangle size={13} />
          Discount rules apply to <strong>new bookings only</strong>. Already-confirmed reservations are unaffected.
        </div>

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          {error && <div className="pricing-form-error">{error}</div>}

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Promo Code *</label>
              <input
                type="text"
                value={form.promo_code}
                onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })}
                placeholder="STAY3GET10"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                required
              />
            </div>
            <div className="pricing-form-group">
              <label>Discount Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Low Season Markdown"
                required
              />
            </div>
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="pricing-form-group">
              <label>Value * {form.type === 'percentage' ? '(%)' : '(IDR)'}</label>
              <input
                type="number"
                min="0"
                max={form.type === 'percentage' ? 100 : undefined}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === 'percentage' ? '15' : '50000'}
                required
              />
            </div>
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Scope *</label>
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
                {SCOPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="pricing-form-group" style={{ justifyContent: 'flex-end' }}>
              <label className="pricing-checkbox-label" style={{ marginTop: 'auto', paddingBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Discount is active
              </label>
            </div>
          </div>

          <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
            <label>Description / Notes</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Internal note about this discount…"
            />
          </div>

          <div className="pricing-modal__footer">
            <button type="button" className="pricing-btn pricing-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pricing-btn pricing-btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Discount'}
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
            <h3>Delete Discount</h3>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', marginBottom: 16 }}>
            Delete discount <strong>{itemName}</strong>? This promo code will stop working immediately for new bookings.
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

function Discount() {
  const [discounts, setDiscounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = () => setDiscounts(loadDiscounts());

  useEffect(() => { refresh(); }, []);

  const handleDelete = () => {
    if (!deleteTarget) return;
    const updated = loadDiscounts().filter((d) => d.id !== deleteTarget.id);
    saveDiscounts(updated);
    refresh();
    setDeleteTarget(null);
  };

  const toggleActive = (id) => {
    const updated = loadDiscounts().map((d) =>
      d.id === id ? { ...d, is_active: !d.is_active } : d
    );
    saveDiscounts(updated);
    refresh();
  };

  const scopeLabel = (scope) => SCOPE_OPTIONS.find((s) => s.value === scope)?.label || scope;

  return (
    <div className="pricing-pane">
      <div className="pricing-pane__toolbar">
        <div>
          <h4 className="pricing-pane__subtitle">Discounts & Promo Codes</h4>
          <p className="pricing-pane__desc">
            Manage promotional discounts. Active discounts are applied at booking. Changes never affect confirmed reservations.
          </p>
        </div>
        <button className="pricing-btn pricing-btn--primary" onClick={() => { setEditDiscount(null); setModalOpen(true); }}>
          <Plus size={14} /> Create New Discount
        </button>
      </div>

      {/* Info banner — backend hookup note */}
      <div className="pricing-info-banner">
        <Tag size={13} />
        Discounts are currently stored locally and managed in the UI. Connect <code>/api/discounts</code> to persist across sessions and integrate with booking calculations.
      </div>

      <div className="pricing-table-wrap">
        <table className="pricing-table">
          <thead>
            <tr>
              <th>Promo Code</th>
              <th>Discount Name</th>
              <th className="text-center">Type</th>
              <th className="text-center">Value</th>
              <th>Scope</th>
              <th className="text-center">Status</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 && (
              <tr>
                <td colSpan={7} className="pricing-empty">
                  No discounts yet. Create your first promo code to get started.
                </td>
              </tr>
            )}
            {discounts.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className="pricing-code-pill">{d.promo_code}</span>
                </td>
                <td className="pricing-name-cell">
                  {d.name}
                  {d.description && (
                    <span className="pricing-subtext">{d.description}</span>
                  )}
                </td>
                <td className="text-center">
                  {d.type === 'percentage' ? (
                    <span className="pricing-badge pricing-badge--blue">
                      <Percent size={9} /> Percentage
                    </span>
                  ) : (
                    <span className="pricing-badge pricing-badge--slate">
                      <DollarSign size={9} /> Fixed
                    </span>
                  )}
                </td>
                <td className="text-center pricing-rate-cell">
                  {d.type === 'percentage'
                    ? `${d.value}%`
                    : `Rp ${Number(d.value).toLocaleString('id-ID')}`}
                </td>
                <td>
                  <span className="pricing-badge pricing-badge--slate">{scopeLabel(d.scope)}</span>
                </td>
                <td className="text-center">
                  <button
                    className={`pricing-status-toggle ${d.is_active ? 'active' : ''}`}
                    onClick={() => toggleActive(d.id)}
                    title={d.is_active ? 'Click to deactivate' : 'Click to activate'}
                  >
                    {d.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="text-center">
                  <div className="pricing-action-group">
                    <button
                      className="pricing-action-btn pricing-action-btn--edit"
                      title="Edit discount"
                      onClick={() => { setEditDiscount(d); setModalOpen(true); }}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="pricing-action-btn pricing-action-btn--delete"
                      title="Delete discount"
                      onClick={() => setDeleteTarget(d)}
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

      <DiscountModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditDiscount(null); }}
        onSaved={refresh}
        initialData={editDiscount}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.promo_code}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        deleting={false}
      />
    </div>
  );
}

export default Discount;
