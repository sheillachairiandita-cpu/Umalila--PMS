import React, { useState, useEffect } from 'react';
import { Plus, Tag, Percent, DollarSign } from 'lucide-react';
import {
  PricingPaneToolbar,
  PricingLockNotice,
  PricingFormError,
  PricingFormFooter,
  PricingDeleteModal,
  PricingActionCell,
  formatRp,
} from './pricingShared';

const SCOPE_OPTIONS = [
  { value: 'all_items', label: 'All Items' },
  { value: 'villas', label: 'Villas Only' },
  { value: 'addons', label: 'Add-ons Only' },
  { value: 'menu', label: 'Menu Only' },
];

const TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount (IDR)' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

const APPLICABLE_VILLAS_OPTIONS = [
  { value: 'all', label: 'All Villas' },
  { value: 'selected', label: 'Selected Villas' },
];

const APPLICATION_RULE_OPTIONS = [
  { value: 'all_items', label: 'Apply to all eligible items' },
  { value: 'highest_priced_single', label: 'Apply to highest priced villa only' },
  { value: 'lowest_priced_single', label: 'Apply to lowest priced villa only' },
];

const EMPTY_FORM = {
  promo_code: '',
  name: '',
  description: '',
  status: 'draft',
  type: 'percentage',
  value: '',
  max_discount_amount: '',
  booking_start_date: '',
  booking_end_date: '',
  stay_start_date: '',
  stay_end_date: '',
  scope: 'all_items',
  applicable_villas: 'all',
  villa_ids: [],
  application_rule: 'all_items',
  min_booking_amount: '',
  min_nights: '',
  total_usage_limit: '',
  per_guest_limit: '',
  stackable: false,
  priority: 0,
};

function mapInitialForm(data) {
  return {
    promo_code: data.promo_code || data.code || '',
    name: data.name || '',
    description: data.description || '',
    status: data.status || (data.is_active === false ? 'archived' : 'active'),
    type: data.type || 'percentage',
    value: data.value ?? '',
    max_discount_amount: data.max_discount_amount ?? '',
    booking_start_date: data.booking_start_date || '',
    booking_end_date: data.booking_end_date || '',
    stay_start_date: data.stay_start_date || '',
    stay_end_date: data.stay_end_date || '',
    scope: data.scope === 'global' ? 'all_items' : (data.scope || 'all_items'),
    applicable_villas: data.applicable_villas || 'all',
    villa_ids: data.villa_ids || (data.villa_id ? [data.villa_id] : []),
    application_rule: data.application_rule || 'all_items',
    min_booking_amount: data.min_booking_amount ?? '',
    min_nights: data.min_nights ?? '',
    total_usage_limit: data.total_usage_limit ?? '',
    per_guest_limit: data.per_guest_limit ?? '',
    stackable: !!data.stackable,
    priority: data.priority ?? 0,
  };
}

function validateForm(form) {
  if (!form.promo_code.trim() || !form.name.trim() || form.value === '') {
    return 'Promo code, name, and value are required.';
  }

  const value = Number(form.value);
  if (Number.isNaN(value) || value <= 0) {
    return 'Discount value must be greater than zero.';
  }

  if (form.type === 'percentage' && value > 100) {
    return 'Percentage discounts cannot exceed 100%.';
  }

  if (form.booking_start_date && form.booking_end_date && form.booking_end_date <= form.booking_start_date) {
    return 'Booking end date must be later than start date.';
  }

  if (form.stay_start_date && form.stay_end_date && form.stay_end_date <= form.stay_start_date) {
    return 'Stay end date must be later than start date.';
  }

  if (form.total_usage_limit !== '' && Number(form.total_usage_limit) < 0) {
    return 'Total usage limit cannot be negative.';
  }

  if (form.per_guest_limit !== '' && Number(form.per_guest_limit) < 0) {
    return 'Per guest limit cannot be negative.';
  }

  if (form.scope === 'villas' && form.applicable_villas === 'selected' && form.villa_ids.length === 0) {
    return 'Select at least one villa when scope is Villas Only and applicable villas is Selected Villas.';
  }

  return null;
}

function buildPayload(form) {
  const optionalNumber = (val) => (val === '' || val === null || val === undefined ? null : Number(val));
  const optionalInt = (val) => (val === '' || val === null || val === undefined ? null : Math.trunc(Number(val)));

  return {
    promo_code: form.promo_code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim() || null,
    status: form.status,
    type: form.type,
    value: Number(form.value),
    max_discount_amount: optionalNumber(form.max_discount_amount),
    booking_start_date: form.booking_start_date || null,
    booking_end_date: form.booking_end_date || null,
    stay_start_date: form.stay_start_date || null,
    stay_end_date: form.stay_end_date || null,
    scope: form.scope,
    applicable_villas: form.applicable_villas,
    villa_ids: form.villa_ids,
    application_rule: form.application_rule,
    min_booking_amount: optionalNumber(form.min_booking_amount),
    min_nights: optionalInt(form.min_nights),
    total_usage_limit: optionalInt(form.total_usage_limit),
    per_guest_limit: optionalInt(form.per_guest_limit),
    stackable: form.stackable,
    priority: optionalInt(form.priority) ?? 0,
  };
}

function FormSection({ title, children }) {
  return (
    <fieldset className="discount-form-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function DiscountModal({ isOpen, onClose, onSaved, initialData, villas }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm(isEdit ? mapInitialForm(initialData) : { ...EMPTY_FORM });
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const toggleVilla = (villaId) => {
    setForm((prev) => {
      const ids = prev.villa_ids.includes(villaId)
        ? prev.villa_ids.filter((id) => id !== villaId)
        : [...prev.villa_ids, villaId];
      return { ...prev, villa_ids: ids };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = buildPayload(form);
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
      <div className="pricing-modal pricing-modal--wide">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Tag size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Discount' : 'Create New Discount'}</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        <PricingLockNotice>
          Discount rules apply to <strong>new bookings only</strong>. Archived discounts cannot be applied to new bookings.
        </PricingLockNotice>

        <form onSubmit={handleSubmit} className="pricing-modal__form discount-modal__form">
          <PricingFormError message={error} />

          <FormSection title="Basic Information">
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
                <label>Status *</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pricing-form-row">
              <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
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
              <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
                <label>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional internal or guest-facing description"
                  rows={2}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Discount Value">
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
                  step={form.type === 'percentage' ? '0.01' : '1'}
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'percentage' ? '15' : '50000'}
                  required
                />
              </div>
              <div className="pricing-form-group">
                <label>Maximum Discount Amount</label>
                <input
                  type="number"
                  min="0"
                  value={form.max_discount_amount}
                  onChange={(e) => setForm({ ...form, max_discount_amount: e.target.value })}
                  placeholder="Optional cap"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Validity">
            <div className="pricing-form-row">
              <div className="pricing-form-group">
                <label>Booking Start Date</label>
                <input
                  type="date"
                  value={form.booking_start_date}
                  onChange={(e) => setForm({ ...form, booking_start_date: e.target.value })}
                />
              </div>
              <div className="pricing-form-group">
                <label>Booking End Date</label>
                <input
                  type="date"
                  value={form.booking_end_date}
                  onChange={(e) => setForm({ ...form, booking_end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="pricing-form-row">
              <div className="pricing-form-group">
                <label>Stay Start Date</label>
                <input
                  type="date"
                  value={form.stay_start_date}
                  onChange={(e) => setForm({ ...form, stay_start_date: e.target.value })}
                />
              </div>
              <div className="pricing-form-group">
                <label>Stay End Date</label>
                <input
                  type="date"
                  value={form.stay_end_date}
                  onChange={(e) => setForm({ ...form, stay_end_date: e.target.value })}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Scope & Application">
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

            <div className="pricing-form-row">
              <div className="pricing-form-group">
                <label>Applicable Villas</label>
                <select
                  value={form.applicable_villas}
                  onChange={(e) => setForm({ ...form, applicable_villas: e.target.value })}
                >
                  {APPLICABLE_VILLAS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="pricing-form-group">
                <label>Priority Number</label>
                <input
                  type="number"
                  min="0"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
                <p className="pricing-form-hint">Higher priority wins when discounts compete.</p>
              </div>
            </div>

            {form.applicable_villas === 'selected' && (
              <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
                <label>Select Villas {form.scope === 'villas' ? '*' : ''}</label>
                <div className="discount-villa-picker">
                  {villas.length === 0 && <p className="pricing-form-hint">No villas available.</p>}
                  {villas.map((villa) => (
                    <label key={villa.id} className="pricing-checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.villa_ids.includes(villa.id)}
                        onChange={() => toggleVilla(villa.id)}
                      />
                      {villa.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </FormSection>

          <FormSection title="Conditions">
            <div className="pricing-form-row">
              <div className="pricing-form-group">
                <label>Minimum Booking Amount</label>
                <input
                  type="number"
                  min="0"
                  value={form.min_booking_amount}
                  onChange={(e) => setForm({ ...form, min_booking_amount: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="pricing-form-group">
                <label>Minimum Nights</label>
                <input
                  type="number"
                  min="0"
                  value={form.min_nights}
                  onChange={(e) => setForm({ ...form, min_nights: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Usage Limits">
            <div className="pricing-form-row">
              <div className="pricing-form-group">
                <label>Total Usage Limit</label>
                <input
                  type="number"
                  min="0"
                  value={form.total_usage_limit}
                  onChange={(e) => setForm({ ...form, total_usage_limit: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="pricing-form-group">
                <label>Per Guest Limit</label>
                <input
                  type="number"
                  min="0"
                  value={form.per_guest_limit}
                  onChange={(e) => setForm({ ...form, per_guest_limit: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Discount Combination">
            <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
              <label className="pricing-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.stackable}
                  onChange={(e) => setForm({ ...form, stackable: e.target.checked })}
                />
                Stackable with other eligible discounts
              </label>
              {form.application_rule !== 'all_items' && (
                <p className="pricing-form-hint">
                  Application rule targets a single villa when multiple villas are booked.
                </p>
              )}
            </div>
          </FormSection>

          {isEdit && initialData?.updated_at && (
            <p className="pricing-form-hint" style={{ marginTop: 0 }}>
              Last updated {new Date(initialData.updated_at).toLocaleString()}
              {initialData.created_at ? ` · Created ${new Date(initialData.created_at).toLocaleString()}` : ''}
            </p>
          )}

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

function statusMeta(status) {
  if (status === 'active') return { label: 'Active', className: 'active' };
  if (status === 'archived') return { label: 'Archived', className: 'archived' };
  return { label: 'Draft', className: 'draft' };
}

function Discount() {
  const [discounts, setDiscounts] = useState([]);
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editDiscount, setEditDiscount] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);

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

  const fetchVillas = async () => {
    try {
      const res = await fetch('/api/villas');
      if (res.ok) setVillas(await res.json());
    } catch {
      setVillas([]);
    }
  };

  useEffect(() => {
    fetchDiscounts();
    fetchVillas();
  }, []);

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await fetch(`/api/discounts/${archiveTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to archive discount');
      await fetchDiscounts();
      setArchiveTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setArchiving(false);
    }
  };

  const scopeLabel = (scope) => SCOPE_OPTIONS.find((s) => s.value === (scope === 'global' ? 'all_items' : scope))?.label || scope;
  const ruleLabel = (rule) => APPLICATION_RULE_OPTIONS.find((r) => r.value === rule)?.label || rule;

  const formatValidity = (d) => {
    if (d.booking_start_date || d.booking_end_date) {
      return `${d.booking_start_date || '…'} → ${d.booking_end_date || '…'}`;
    }
    return 'Always';
  };

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Discounts & Promo Codes"
        description="Configure promotional discounts with validity windows, scope rules, and usage limits. Discounts are soft-deleted via archive."
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
                <th>Name</th>
                <th className="text-center">Type</th>
                <th className="text-center">Value</th>
                <th>Scope</th>
                <th>Validity</th>
                <th className="text-center">Priority</th>
                <th className="text-center">Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.length === 0 && (
                <tr>
                  <td colSpan={9} className="pricing-empty">
                    No discounts yet. Create your first promo code to get started.
                  </td>
                </tr>
              )}
              {discounts.map((d) => {
                const status = statusMeta(d.status);
                return (
                  <tr key={d.id}>
                    <td><span className="pricing-code-pill">{d.promo_code || d.code}</span></td>
                    <td className="pricing-name-cell">
                      <div>{d.name}</div>
                      {d.description && <div className="pricing-form-hint">{d.description}</div>}
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
                        : formatRp(d.value)}
                      {d.max_discount_amount ? (
                        <div className="pricing-form-hint">Max {formatRp(d.max_discount_amount)}</div>
                      ) : null}
                    </td>
                    <td>
                      <span className="pricing-badge pricing-badge--slate">{scopeLabel(d.scope)}</span>
                      <div className="pricing-form-hint">{ruleLabel(d.application_rule)}</div>
                    </td>
                    <td>{formatValidity(d)}</td>
                    <td className="text-center">{d.priority ?? 0}</td>
                    <td className="text-center">
                      <span className={`pricing-status-badge pricing-status-badge--${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="text-center">
                      <PricingActionCell
                        editTitle="Edit discount"
                        deleteTitle="Archive discount"
                        onEdit={() => { setEditDiscount(d); setModalOpen(true); }}
                        onDelete={d.status === 'archived' ? undefined : () => setArchiveTarget(d)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DiscountModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditDiscount(null); }}
        onSaved={fetchDiscounts}
        initialData={editDiscount}
        villas={villas}
      />

      <PricingDeleteModal
        isOpen={!!archiveTarget}
        title="Archive Discount"
        itemName={archiveTarget?.promo_code || archiveTarget?.code}
        message={
          archiveTarget ? (
            <>
              Archive discount <strong>{archiveTarget.promo_code || archiveTarget.code}</strong>? It will remain in the system for auditing but cannot be applied to new bookings.
            </>
          ) : null
        }
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        deleting={archiving}
      />
    </div>
  );
}

export default Discount;
