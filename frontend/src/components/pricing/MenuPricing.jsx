import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertTriangle, UtensilsCrossed, Coffee, ChefHat } from 'lucide-react';

const CATEGORIES = ['food', 'beverage', 'snack', 'dessert', 'other'];

const CATEGORY_META = {
  food:     { label: 'Food',            color: '#b45309', bg: '#fffbeb' },
  beverage: { label: 'Beverage',        color: '#1e40af', bg: '#eff6ff' },
  snack:    { label: 'Snack',           color: '#7c3aed', bg: '#f5f3ff' },
  dessert:  { label: 'Dessert',         color: '#be185d', bg: '#fdf2f8' },
  other:    { label: 'Partner Kitchen', color: '#374151', bg: '#f9fafb' },
};

function MenuModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState({ name: '', category: 'food', price: '', is_available: true });
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitting(true);
    setError(null);
    try {
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
            <UtensilsCrossed size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Menu Item' : 'Create New Menu Item'}</h3>
          </div>
          <button className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        {isEdit && (
          <div className="pricing-lock-notice">
            <AlertTriangle size={13} />
            Price changes apply to <strong>new orders only</strong>. Existing orders are locked.
          </div>
        )}

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          {error && <div className="pricing-form-error">{error}</div>}

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

          <div className="pricing-modal__footer">
            <button type="button" className="pricing-btn pricing-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="pricing-btn pricing-btn--primary" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
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
            <h3>Delete Menu Item</h3>
          </div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-mid)', marginBottom: 16 }}>
            Delete <strong>{itemName}</strong>? Existing orders referencing this item will not be affected.
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

function MenuPricing() {
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
      const res = await fetch('/api/menu-items');
      if (!res.ok) throw new Error('Failed to fetch menu items');
      setItems(await res.json());
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
    try {
      const res = await fetch(`/api/menu-items/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchItems();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter);

  // Group counts
  const counts = CATEGORIES.reduce((acc, c) => {
    acc[c] = items.filter((i) => i.category === c).length;
    return acc;
  }, {});

  return (
    <div className="pricing-pane">
      <div className="pricing-pane__toolbar">
        <div>
          <h4 className="pricing-pane__subtitle">Menu Items</h4>
          <p className="pricing-pane__desc">Manage F&B menu prices. Price edits apply to new orders only.</p>
        </div>
        <button className="pricing-btn pricing-btn--primary" onClick={() => { setEditItem(null); setModalOpen(true); }}>
          <Plus size={14} /> Create New Menu Item
        </button>
      </div>

      {/* Category filter pills */}
      <div className="pricing-filter-pills">
        <button
          className={`pricing-filter-pill ${categoryFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          All <span className="pricing-pill-count">{items.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`pricing-filter-pill ${categoryFilter === c ? 'active' : ''}`}
            onClick={() => setCategoryFilter(c)}
          >
            {CATEGORY_META[c]?.label || c} <span className="pricing-pill-count">{counts[c] || 0}</span>
          </button>
        ))}
      </div>

      {loading && <div className="pricing-loading">Loading menu items…</div>}
      {!loading && error && <div className="pricing-error">{error}</div>}
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
              {filtered.map((item) => {
                const meta = CATEGORY_META[item.category] || CATEGORY_META.other;
                return (
                  <tr key={item.id}>
                    <td>
                      <span
                        className="pricing-badge"
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="pricing-name-cell">{item.name}</td>
                    <td className="text-right pricing-rate-cell">
                      Rp {Number(item.price || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="text-center">
                      {item.is_available ? (
                        <span className="pricing-badge pricing-badge--green">Active</span>
                      ) : (
                        <span className="pricing-badge pricing-badge--slate">Hidden</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="pricing-action-group">
                        <button
                          className="pricing-action-btn pricing-action-btn--edit"
                          title="Edit item"
                          onClick={() => { setEditItem(item); setModalOpen(true); }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="pricing-action-btn pricing-action-btn--delete"
                          title="Delete item"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MenuModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null); }}
        onSaved={fetchItems}
        initialData={editItem}
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

export default MenuPricing;
