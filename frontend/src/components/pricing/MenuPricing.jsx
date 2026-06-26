import React, { useState, useEffect, useMemo } from 'react';
import { Plus, UtensilsCrossed } from 'lucide-react';
import FilterButtonGroup from '../ui/FilterButtonGroup';
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

const CATEGORIES = ['food', 'beverage', 'snack', 'dessert','partner_kitchen', 'other'];

const CATEGORY_META = {
  food:     { label: 'Food',            color: '#b45309', bg: '#fffbeb' },
  beverage: { label: 'Beverage',        color: '#1e40af', bg: '#eff6ff' },
  snack:    { label: 'Snack',           color: '#7c3aed', bg: '#f5f3ff' },
  dessert:  { label: 'Dessert',         color: '#be185d', bg: '#fdf2f8' },
  partner_kitchen:  { label: 'Partner Kitchen',  color: '#bc6c8d', bg: '#fdf2f8', border: '#fbcfe8' },
  other:    { label: 'Other',           color: '#374151', bg: '#f9fafb' },
};

function MenuModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const { saveItem, isMutating } = usePricingMutation();
  const [form, setForm] = useState({ name: '', category: 'food', price: '', is_available: true });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm(
        isEdit
          ? {
              name: initialData.name || '',
              category: initialData.category || 'food',
              price: initialData.price ?? '',
              is_available: initialData.is_available !== false,
            }
          : { name: '', category: 'food', price: '', is_available: true }
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.price === '') {
      setError('Name and price are required.');
      return;
    }
    await saveItem({
      isEdit,
      entityName: 'Menu item',
      setError,
      onClose,
      refresh: onSaved,
      execute: async () => {
        const payload = {
          name: form.name.trim(),
          category: form.category,
          price: Number(form.price),
          is_available: form.is_available,
        };
        const url = isEdit ? `/api/menu-items/${initialData.id}` : '/api/menu-items';
        const method = isEdit ? 'PATCH' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to save menu item');
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
            <UtensilsCrossed size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Menu Item' : 'Create New Menu Item'}</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        {isEdit && (
          <PricingLockNotice>
            Price changes apply to <strong>new orders only</strong>. Existing orders are locked.
          </PricingLockNotice>
        )}

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          <PricingFormError message={error} />

          <div className="pricing-form-row">
            <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
              <label>Item Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Nasi Goreng Kampung"
                required
              />
            </div>
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_META[c]?.label || c}</option>
                ))}
              </select>
            </div>
            <div className="pricing-form-group">
              <label>Price (IDR) *</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="35000"
                required
              />
            </div>
          </div>

          <div className="pricing-form-group" style={{ gridColumn: '1/-1' }}>
            <label className="pricing-checkbox-label">
              <input
                type="checkbox"
                checked={form.is_available}
                onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
              />
              Item is currently available for ordering
            </label>
          </div>

          <PricingFormFooter
            onCancel={onClose}
            submitting={isMutating}
            submitLabel={isMutating ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          />
        </form>
      </div>
    </div>
  );
}

function MenuPricing() {
  const { deleteItem } = usePricingMutation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/menu-items?all=true');
      if (!res.ok) throw new Error('Failed to fetch menu items');
      setItems(await res.json());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteItem({
      entityName: 'Menu item',
      refresh: fetchItems,
      onDone: () => setDeleteTarget(null),
      execute: async () => {
        const res = await fetch(`/api/menu-items/${deleteTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
      },
    });
    setDeleting(false);
  };

  const filtered = categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter);

  const filterOptions = useMemo(() => {
    const counts = CATEGORIES.reduce((acc, c) => {
      acc[c] = items.filter((i) => i.category === c).length;
      return acc;
    }, {});

    return [
      { key: 'all', label: `All (${items.length})` },
      ...CATEGORIES.map((c) => ({
        key: c,
        label: `${CATEGORY_META[c]?.label || c} (${counts[c] || 0})`,
      })),
    ];
  }, [items]);

  const pagination = usePaginatedRows(filtered);

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Menu Items"
        description="Manage F&B menu prices. Price edits apply to new orders only."
        actionLabel="Create New Menu Item"
        actionIcon={Plus}
        onAction={() => { setEditItem(null); setModalOpen(true); }}
      />

      <FilterButtonGroup
        options={filterOptions}
        active={categoryFilter}
        onChange={setCategoryFilter}
      />

      {loading && <PricingLoadingState message="Loading menu items…" />}
      {!loading && error && <PricingErrorState message={error} />}
      {!loading && !error && (
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Name</th>
                <th className="text-right">Price (IDR)</th>
                <th className="text-center">Available</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="pricing-empty">No menu items in this category.</td></tr>
              )}
              {pagination.paginatedRows.map((item) => {
                const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
                return (
                  <tr key={item.id}>
                    <td>
                      <span className="pricing-badge" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="pricing-name-cell">{item.name}</td>
                    <td className="text-right pricing-rate-cell">{formatRp(item.price)}</td>
                    <td className="text-center">
                      {item.is_available ? (
                        <span className="pricing-badge pricing-badge--green">Active</span>
                      ) : (
                        <span className="pricing-badge pricing-badge--slate">Hidden</span>
                      )}
                    </td>
                    <td className="text-center">
                      <PricingActionCell
                        editTitle="Edit item"
                        deleteTitle="Delete item"
                        onEdit={() => { setEditItem(item); setModalOpen(true); }}
                        onDelete={() => setDeleteTarget(item)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <PricingTablePagination rows={filtered} pagination={pagination} />
        </div>
      )}

      <MenuModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSaved={fetchItems}
        initialData={editItem}
      />
      <PricingDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Menu Item"
        itemName={deleteTarget?.name}
        message={
          deleteTarget ? (
            <>
              Delete <strong>{deleteTarget.name}</strong>? Existing orders referencing this item will not be affected.
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

export default MenuPricing;
