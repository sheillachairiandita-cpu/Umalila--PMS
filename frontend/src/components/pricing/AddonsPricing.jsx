import React, { useState, useEffect } from 'react';
import { Plus, Coffee, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  PricingPaneToolbar,
  PricingLockNotice,
  PricingFormError,
  PricingFormFooter,
  PricingDeleteModal,
  PricingActionCell,
  PricingLoadingState,
  PricingErrorState,
  usePaginatedRows,
  PricingTablePagination,
  usePricingMutation,
  formatRp,
} from './pricingShared';
import { apiFetch } from '../../api/client';
import { toTitleCaseName } from '../../utils/stringUtils';

function AddonModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const { saveItem, isMutating } = usePricingMutation();
  const [form, setForm] = useState({
    name: '',
    price_per_night: '',
    base_breakfast: '',
    is_per_night: true,
  });
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
    await saveItem({
      isEdit,
      entityName: 'Add-on',
      setError,
      onClose,
      refresh: onSaved,
      execute: async () => {
        const payload = {
          name: toTitleCaseName(form.name),
          price_per_night: Number(form.price_per_night),
          price: Number(form.price_per_night),
          base_breakfast: Number(form.base_breakfast) || 0,
          is_per_night: form.is_per_night,
        };
        const url = isEdit ? `/api/addons/${initialData.id}` : '/api/addons';
        const method = isEdit ? 'PATCH' : 'POST';
        const res = await apiFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to save add-on');
        }
        return res.json();
      },
    });
  };

  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Plus size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Add-on' : 'Create New Add-on'}</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        {isEdit && (
          <PricingLockNotice>
            Price changes apply to <strong>future reservations only</strong>. Existing bookings are locked.
          </PricingLockNotice>
        )}

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          <PricingFormError message={error} />

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

          <PricingFormFooter
            onCancel={onClose}
            submitting={isMutating}
            submitLabel={isMutating ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Add-on'}
          />
        </form>
      </div>
    </div>
  );
}

function AddonsPricing() {
  const { deleteItem } = usePricingMutation();
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
      const res = await apiFetch('/api/addons');
      if (!res.ok) throw new Error('Failed to fetch add-ons');
      setAddons(await res.json());
      setError(null);
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
    await deleteItem({
      entityName: 'Add-on',
      refresh: fetchAddons,
      onDone: () => setDeleteTarget(null),
      execute: async () => {
        const res = await apiFetch(`/api/addons/${deleteTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
      },
    });
    setDeleting(false);
  };

  const pagination = usePaginatedRows(addons);

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Add-ons & Services"
        description="Configure extra services available during booking. Rate changes affect future reservations only."
        actionLabel="Create New Add-on"
        actionIcon={Plus}
        onAction={() => { setEditAddon(null); setModalOpen(true); }}
      />

      {loading && <PricingLoadingState message="Loading add-ons…" />}
      {!loading && error && <PricingErrorState message={error} />}
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
              {pagination.paginatedRows.map((a) => (
                <tr key={a.id}>
                  <td className="pricing-name-cell">{a.name}</td>
                  <td className="text-right pricing-rate-cell">{formatRp(a.price_per_night)}</td>
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
                    <PricingActionCell
                      editTitle="Edit add-on"
                      deleteTitle="Delete add-on"
                      onEdit={() => { setEditAddon(a); setModalOpen(true); }}
                      onDelete={() => setDeleteTarget(a)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PricingTablePagination rows={addons} pagination={pagination} />
        </div>
      )}

      <AddonModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditAddon(null); }}
        onSaved={fetchAddons}
        initialData={editAddon}
      />
      <PricingDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Add-on"
        itemName={deleteTarget?.name}
        message={
          deleteTarget ? (
            <>
              Delete <strong>{deleteTarget.name}</strong>? Existing bookings will not be affected.
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

export default AddonsPricing;
