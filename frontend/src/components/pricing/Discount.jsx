import React, { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign } from 'lucide-react';
import {
  PricingPaneToolbar,
  PricingLockNotice,
  PricingFormError,
  PricingFormFooter,
  PricingDeleteModal,
  PricingActionCell,
} from './pricingShared';

const SCOPE_OPTIONS = [
  { value: 'global', label: 'Global (All Items)' },
  { value: 'villas', label: 'Villas Only' },
  { value: 'addons', label: 'Add-ons Only' },
  { value: 'menu', label: 'Menu Only' },
];

const TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount (IDR)' },
];

const APPLICATION_RULE_OPTIONS = [
  { value: 'all_items', label: 'All eligible items' },
  { value: 'highest_priced_single', label: 'Highest-priced villa only' },
  { value: 'lowest_priced_single', label: 'Lowest-priced villa only' },
];

const EMPTY_FORM = {
  promo_code: '',
  name: '',
  type: 'percentage',
  value: '',
  scope: 'global',
  application_rule: 'all_items',
  is_active: true,
};

function DiscountModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              promo_code: initialData.promo_code || initialData.code || '',
              name: initialData.name || '',
              type: initialData.type || 'percentage',
              value: initialData.value ?? '',
              scope: initialData.scope || 'global',
              application_rule: initialData.application_rule || 'all_items',
              is_active: initialData.is_active !== false && initialData.status !== 'inactive',
            }
          : { ...EMPTY_FORM }
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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
    setError(null);
    try {
      const payload = {
        promo_code: form.promo_code.trim().toUpperCase(),
        name: form.name.trim(),
        type: form.type,
        value: Number(form.value),
        scope: form.scope,
        application_rule: form.application_rule,
        is_active: form.is_active,
      };

      const url = isEdit ? `/api/discounts/${initialData.id}` : '/api/discounts';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save discount');
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
            <Tag size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Discount' : 'Create New Discount'}</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        <PricingLockNotice>
          Discount rules apply to <strong>new bookings only</strong>. Already-confirmed reservations are unaffected.
        </PricingLockNotice>

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          <PricingFormError message={error} />

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
            <div className="pricing-form-group">
              <label>Application Rule *</label>
              <select
                value={form.application_rule}
                onChange={(e) => setForm({ ...form, application_rule: e.target.value })}
              >
                {APPLICATION_RULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
            <label className="pricing-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Discount is active
            </label>
            {form.application_rule === 'highest_priced_single' && form.type === 'percentage' && (
              <p className="pricing-form-hint">
                Percentage will be deducted from the single most expensive villa in each reservation.
              </p>
            )}
          </div>

          <PricingFormFooter
            onCancel={onClose}
            submitting={submitting}
            submitLabel={submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Discount'}
          />
        </form>
      </div>
    </div>
  );
}

function Discount() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discounts');
      if (!res.ok) throw new Error('Failed to fetch discounts');
      setDiscounts(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDiscounts(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/discounts/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete discount');
      await fetchDiscounts();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (discount) => {
    try {
      const res = await fetch(`/api/discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !(discount.is_active !== false && discount.status !== 'inactive') }),
      });
      if (!res.ok) throw new Error('Failed to update discount status');
      await fetchDiscounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const scopeLabel = (scope) => SCOPE_OPTIONS.find((s) => s.value === scope)?.label || scope;
  const ruleLabel = (rule) => APPLICATION_RULE_OPTIONS.find((r) => r.value === rule)?.label || rule;
  const isActive = (d) => d.is_active !== false && d.status !== 'inactive';

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Discounts & Promo Codes"
        description="Manage promotional discounts stored in the database. Active discounts can be applied when editing reservations."
        actionLabel="Create New Discount"
        actionIcon={Plus}
        onAction={() => { setEditDiscount(null); setModalOpen(true); }}
      />

      {loading && <div className="pricing-loading">Loading discounts…</div>}
      {!loading && error && <div className="pricing-error">{error}</div>}

      {!loading && !error && (
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Promo Code</th>
                <th>Discount Name</th>
                <th className="text-center">Type</th>
                <th className="text-center">Value</th>
                <th>Scope</th>
                <th>Application Rule</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="pricing-empty">
                    No discounts yet. Create your first promo code to get started.
                  </td>
                </tr>
              )}
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td><span className="pricing-code-pill">{d.promo_code || d.code}</span></td>
                  <td className="pricing-name-cell">{d.name}</td>
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
                  <td><span className="pricing-badge pricing-badge--slate">{scopeLabel(d.scope)}</span></td>
                  <td><span className="pricing-badge pricing-badge--blue">{ruleLabel(d.application_rule)}</span></td>
                  <td className="text-center">
                    <button
                      type="button"
                      className={`pricing-status-toggle ${isActive(d) ? 'active' : ''}`}
                      onClick={() => toggleActive(d)}
                      title={isActive(d) ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {isActive(d) ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="text-center">
                    <PricingActionCell
                      editTitle="Edit discount"
                      deleteTitle="Delete discount"
                      onEdit={() => { setEditDiscount(d); setModalOpen(true); }}
                      onDelete={() => setDeleteTarget(d)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DiscountModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditDiscount(null); }}
        onSaved={fetchDiscounts}
        initialData={editDiscount}
      />
      <PricingDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Discount"
        itemName={deleteTarget?.promo_code || deleteTarget?.code}
        message={
          deleteTarget ? (
            <>
              Delete discount <strong>{deleteTarget.promo_code || deleteTarget.code}</strong>? This promo code will stop working immediately for new bookings.
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

export default Discount;
