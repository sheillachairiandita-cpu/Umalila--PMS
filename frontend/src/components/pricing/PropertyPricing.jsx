import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Home, Coffee, CalendarDays, Trash2 } from 'lucide-react';
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
import { apiFetch, apiJson } from '../../api/client';
import TableActionButton from '../TableActionButton';

const PRESET_PROPERTY_CATEGORIES = [
  'Villa',
  'Cabin',
  'Homestay',
];

const CUSTOM_CATEGORY = '__custom__';

const EMPTY_PROPERTY_FORM = {
  name: '',
  base_rate_per_night: '',
  weekend_rate_per_night: '',
  holiday_rate_per_night: '',
  base_breakfast: '',
  capacity: '',
  description: '',
  category: 'Villa',
  categorySelect: 'Villa',
};

function RateCell({ value, fallback, fallbackLabel }) {
  if (value != null && value !== '') {
    return <span className="pricing-rate-cell">{formatRp(value)}</span>;
  }
  if (fallback != null) {
    return (
      <span className="pricing-text-muted" title={fallbackLabel || 'Uses lower tier rate'}>
        {formatRp(fallback)}
      </span>
    );
  }
  return <span className="pricing-text-muted">—</span>;
}

function PropertyModal({ isOpen, onClose, onSaved, initialData, categoryOptions = [] }) {
  const isEdit = !!initialData;
  const { saveItem, isMutating } = usePricingMutation();
  const [form, setForm] = useState(EMPTY_PROPERTY_FORM);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const cat = initialData?.category || 'Villa';
      setForm(
        isEdit
          ? {
              name: initialData.name || '',
              base_rate_per_night: initialData.base_rate_per_night ?? '',
              weekend_rate_per_night: initialData.weekend_rate_per_night ?? '',
              holiday_rate_per_night: initialData.holiday_rate_per_night ?? '',
              base_breakfast: initialData.base_breakfast ?? '',
              capacity: initialData.capacity ?? '',
              description: initialData.description || '',
              category: cat,
              categorySelect: categoryOptions.includes(cat) ? cat : CUSTOM_CATEGORY,
            }
          : EMPTY_PROPERTY_FORM
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData, categoryOptions]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.base_rate_per_night === '') {
      setError('Name and weekday rate are required.');
      return;
    }
    const resolvedCategory = form.categorySelect === CUSTOM_CATEGORY
      ? form.category.trim()
      : form.categorySelect;
    if (!resolvedCategory) {
      setError('Category is required.');
      return;
    }
    await saveItem({
      isEdit,
      entityName: 'Property',
      setError,
      onClose,
      refresh: onSaved,
      execute: async () => {
        const payload = {
          name: form.name.trim(),
          base_rate_per_night: Number(form.base_rate_per_night),
          weekend_rate_per_night: form.weekend_rate_per_night === '' ? null : Number(form.weekend_rate_per_night),
          holiday_rate_per_night: form.holiday_rate_per_night === '' ? null : Number(form.holiday_rate_per_night),
          base_breakfast: Number(form.base_breakfast) || 0,
          capacity: Number(form.capacity) || 1,
          description: form.description.trim(),
          category: resolvedCategory,
        };
        const url = isEdit ? `/api/properties/${initialData.id}` : '/api/properties';
        const method = isEdit ? 'PATCH' : 'POST';
        await apiJson(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return true;
      },
    });
  };

  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <Home size={16} className="pricing-modal__icon" />
            <h3>{isEdit ? 'Edit Property' : 'Create New Property'}</h3>
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
              <label>Property Name *</label>
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
            <div className="pricing-form-group">
              <label>Category *</label>
              <select
                value={form.categorySelect}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm({
                    ...form,
                    categorySelect: value,
                    category: value === CUSTOM_CATEGORY ? '' : value,
                  });
                }}
                required
              >
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value={CUSTOM_CATEGORY}>Add new category…</option>
              </select>
              {form.categorySelect === CUSTOM_CATEGORY && (
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Resort, Campsite"
                  style={{ marginTop: '0.5rem' }}
                  required
                />
              )}
            </div>
          </div>

          <p className="pricing-form-section-label">Nightly Rates (IDR)</p>
          <p className="pricing-form-hint">
            Weekday = Mon–Thu. Weekend = Fri–Sun. If you leave weekend or holiday blank, that tier uses the rate from the tier below it.
          </p>
          <div className="pricing-form-row pricing-form-row--3">
            <div className="pricing-form-group">
              <label>Weekday</label>
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
              <label>Weekend</label>
              <input
                type="number"
                min="0"
                value={form.weekend_rate_per_night}
                onChange={(e) => setForm({ ...form, weekend_rate_per_night: e.target.value })}
                placeholder="Uses weekday rate if blank"
              />
            </div>
            <div className="pricing-form-group">
              <label>Holiday</label>
              <input
                type="number"
                min="0"
                value={form.holiday_rate_per_night}
                onChange={(e) => setForm({ ...form, holiday_rate_per_night: e.target.value })}
                placeholder="Uses weekend rate if blank"
              />
            </div>
          </div>

          <div className="pricing-form-row">
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
              placeholder="Brief description of the property unit…"
            />
          </div>

          <PricingFormFooter
            onCancel={onClose}
            submitting={isMutating}
            submitLabel={isMutating ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Property'}
          />
        </form>
      </div>
    </div>
  );
}

function HolidayModal({ isOpen, onClose, onSaved }) {
  const { saveItem, isMutating } = usePricingMutation();
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', start_date: '', end_date: '' });
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.start_date || !form.end_date) {
      setError('Name and date range are required.');
      return;
    }
    if (form.end_date < form.start_date) {
      setError('End date must be on or after start date.');
      return;
    }
    await saveItem({
      isEdit: false,
      entityName: 'Holiday period',
      setError,
      onClose,
      refresh: onSaved,
      overlayMessage: 'Adding holiday period…',
      successMessage: 'Holiday period added successfully.',
      execute: async () => {
        const res = await apiFetch('/api/pricing/holidays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to save holiday period');
        }
        return res.json();
      },
    });
  };

  return (
    <div className="pricing-modal-overlay">
      <div className="pricing-modal pricing-modal--sm">
        <div className="pricing-modal__header">
          <div className="pricing-modal__title-group">
            <CalendarDays size={16} className="pricing-modal__icon" />
            <h3>Add Holiday Period</h3>
          </div>
          <button type="button" className="pricing-modal__close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="pricing-modal__form">
          <PricingFormError message={error} />

          <div className="pricing-form-group">
            <label>Holiday Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Lebaran, New Year"
              required
            />
          </div>

          <div className="pricing-form-row">
            <div className="pricing-form-group">
              <label>Start Date *</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                required
              />
            </div>
            <div className="pricing-form-group">
              <label>End Date *</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                required
              />
            </div>
          </div>

          <PricingFormFooter
            onCancel={onClose}
            submitting={isMutating}
            submitLabel={isMutating ? 'Saving…' : 'Add Holiday'}
          />
        </form>
      </div>
    </div>
  );
}

function PropertyPricing() {
  const { deleteItem } = usePricingMutation();
  const [properties, setProperties] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editProperty, setEditProperty] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteHolidayTarget, setDeleteHolidayTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propertiesRes, holidaysRes] = await Promise.all([
        apiFetch('/api/properties'),
        apiFetch('/api/pricing/holidays'),
      ]);
      if (!propertiesRes.ok) throw new Error('Failed to fetch properties');
      setProperties(await propertiesRes.json());
      if (holidaysRes.ok) {
        setHolidays(await holidaysRes.json());
      } else {
        setHolidays([]);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await deleteItem({
      entityName: 'Property',
      refresh: fetchData,
      onDone: () => setDeleteTarget(null),
      execute: async () => {
        const res = await apiFetch(`/api/properties/${deleteTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
      },
    });
    setDeleting(false);
  };

  const handleDeleteHoliday = async () => {
    if (!deleteHolidayTarget) return;
    setDeleting(true);
    await deleteItem({
      entityName: 'Holiday period',
      refresh: fetchData,
      onDone: () => setDeleteHolidayTarget(null),
      execute: async () => {
        const res = await apiFetch(`/api/pricing/holidays/${deleteHolidayTarget.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete holiday period');
      },
    });
    setDeleting(false);
  };

  const openCreate = () => { setEditProperty(null); setModalOpen(true); };
  const openEdit = (property) => { setEditProperty(property); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditProperty(null); };

  const categoryOptions = useMemo(() => [...new Set([
    ...PRESET_PROPERTY_CATEGORIES,
    ...properties.map((p) => p.category).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b)), [properties]);

  const filterOptions = useMemo(() => {
    const counts = categoryOptions.reduce((acc, cat) => {
      acc[cat] = properties.filter((p) => (p.category || 'Villa') === cat).length;
      return acc;
    }, {});

    return [
      { key: 'all', label: `All (${properties.length})` },
      ...categoryOptions.map((cat) => ({
        key: cat,
        label: `${cat} (${counts[cat] || 0})`,
      })),
    ];
  }, [properties, categoryOptions]);

  const filteredProperties = categoryFilter === 'all'
    ? properties
    : properties.filter((p) => (p.category || 'Villa') === categoryFilter);

  const propertyPagination = usePaginatedRows(filteredProperties);
  const holidayPagination = usePaginatedRows(holidays);

  return (
    <div className="pricing-pane">
      <PricingPaneToolbar
        title="Property Units"
        description="Set weekday, weekend, and holiday rates per property. Holiday dates apply the holiday rate across all units."
        actionLabel="Create New Property"
        actionIcon={Plus}
        onAction={openCreate}
      />

      <FilterButtonGroup
        options={filterOptions}
        active={categoryFilter}
        onChange={setCategoryFilter}
      />

      {loading && <PricingLoadingState message="Loading properties…" />}
      {!loading && error && <PricingErrorState message={error} />}
      {!loading && !error && (
        <div className="pricing-table-wrap pricing-table-wrap--aligned">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Property ID</th>
                <th>Name</th>
                <th className="text-right">Weekday</th>
                <th className="text-right">Weekend</th>
                <th className="text-right">Holiday</th>
                <th className="text-center">Base Breakfast</th>
                <th className="text-center">Capacity</th>
                <th>Description</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.length === 0 && (
                <tr>
                  <td colSpan={9} className="pricing-empty">
                    {categoryFilter === 'all'
                      ? 'No properties found. Create one to get started.'
                      : 'No properties in this category.'}
                  </td>
                </tr>
              )}
              {propertyPagination.paginatedRows.map((v) => (
                <tr key={v.id}>
                  <td><span className="pricing-id-pill">{v.display_id || v.id?.slice(0, 8)}</span></td>
                  <td className="pricing-name-cell">{v.name}</td>
                  <td className="text-right"><RateCell value={v.base_rate_per_night} /></td>
                  <td className="text-right">
                    <RateCell
                      value={v.weekend_rate_per_night}
                      fallback={v.base_rate_per_night}
                      fallbackLabel="No weekend rate set — uses weekday rate on Fri–Sun"
                    />
                  </td>
                  <td className="text-right">
                    <RateCell
                      value={v.holiday_rate_per_night}
                      fallback={v.weekend_rate_per_night ?? v.base_rate_per_night}
                      fallbackLabel="No holiday rate set — uses weekend rate (or weekday if weekend is also unset)"
                    />
                  </td>
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
                      editTitle="Edit property"
                      deleteTitle="Delete property"
                      onEdit={() => openEdit(v)}
                      onDelete={() => setDeleteTarget(v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <PricingTablePagination rows={filteredProperties} pagination={propertyPagination} />
        </div>
      )}

      <div className="pricing-pane--nested">
        <PricingPaneToolbar
          title="Holiday Periods"
          description="Dates within these ranges use the holiday rate. Fri–Sun otherwise use the weekend rate; Mon–Thu use weekday."
          actionLabel="Add Holiday Period"
          actionIcon={Plus}
          actionVariant="secondary"
          onAction={() => setHolidayModalOpen(true)}
        />

        {!loading && !error && (
          <div className="pricing-table-wrap pricing-table-wrap--aligned">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays.length === 0 && (
                  <tr>
                    <td colSpan={4} className="pricing-empty">
                      No holiday periods defined. Add dates when holiday rates should apply.
                    </td>
                  </tr>
                )}
                {holidayPagination.paginatedRows.map((h) => (
                  <tr key={h.id}>
                    <td className="pricing-name-cell">{h.name}</td>
                    <td>{h.start_date}</td>
                    <td>{h.end_date}</td>
                    <td className="text-center">
                      <TableActionButton
                        title="Delete holiday period"
                        variant="danger"
                        onClick={() => setDeleteHolidayTarget(h)}
                      >
                        <Trash2 size={12} />
                      </TableActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PricingTablePagination rows={holidays} pagination={holidayPagination} />
          </div>
        )}
      </div>

      <PropertyModal isOpen={modalOpen} onClose={closeModal} onSaved={fetchData} initialData={editProperty} categoryOptions={categoryOptions} />
      <HolidayModal
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        onSaved={fetchData}
      />
      <PricingDeleteModal
        isOpen={!!deleteTarget}
        title="Delete Property"
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
      <PricingDeleteModal
        isOpen={!!deleteHolidayTarget}
        title="Delete Holiday Period"
        itemName={deleteHolidayTarget?.name}
        message={
          deleteHolidayTarget ? (
            <>
              Remove holiday period <strong>{deleteHolidayTarget.name}</strong>?
              Future bookings will no longer use holiday rates for these dates.
            </>
          ) : null
        }
        onClose={() => setDeleteHolidayTarget(null)}
        onConfirm={handleDeleteHoliday}
        deleting={deleting}
      />
    </div>
  );
}

export default PropertyPricing;
