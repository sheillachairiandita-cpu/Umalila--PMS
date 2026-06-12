import React, { useState, useEffect } from 'react';
import { Plus, Home, Coffee, CalendarDays, Trash2 } from 'lucide-react';
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
import { Button } from '../ui';
import TableActionButton from '../TableActionButton';

const EMPTY_VILLA_FORM = {
  name: '',
  base_rate_per_night: '',
  weekend_rate_per_night: '',
  holiday_rate_per_night: '',
  base_breakfast: '',
  capacity: '',
  description: '',
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

function VillaModal({ isOpen, onClose, onSaved, initialData }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(EMPTY_VILLA_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
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
            }
          : EMPTY_VILLA_FORM
      );
      setError(null);
    }
  }, [isOpen, isEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.base_rate_per_night === '') {
      setError('Name and weekday rate are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        base_rate_per_night: Number(form.base_rate_per_night),
        weekend_rate_per_night: form.weekend_rate_per_night === '' ? null : Number(form.weekend_rate_per_night),
        holiday_rate_per_night: form.holiday_rate_per_night === '' ? null : Number(form.holiday_rate_per_night),
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

          <p className="pricing-form-section-label">Nightly Rates (IDR)</p>
          <p className="pricing-form-hint">
            Weekday = Mon–Thu. Weekend = Fri–Sun. If you leave weekend or holiday blank, that tier uses the rate from the tier below it.
          </p>
          <div className="pricing-form-row pricing-form-row--3">
            <div className="pricing-form-group">
              <label>Weekday (Mon–Thu) *</label>
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
              <label>Weekend (Fri–Sun)</label>
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

function HolidayModal({ isOpen, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '' });
  const [submitting, setSubmitting] = useState(false);
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
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/pricing/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save holiday period');
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
            submitting={submitting}
            submitLabel={submitting ? 'Saving…' : 'Add Holiday'}
          />
        </form>
      </div>
    </div>
  );
}

function VillaPricing() {
  const [villas, setVillas] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [editVilla, setEditVilla] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteHolidayTarget, setDeleteHolidayTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [villasRes, holidaysRes] = await Promise.all([
        fetch('/api/villas'),
        fetch('/api/pricing/holidays'),
      ]);
      if (!villasRes.ok) throw new Error('Failed to fetch villas');
      setVillas(await villasRes.json());
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
    try {
      const res = await fetch(`/api/villas/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchData();
      setDeleteTarget(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deleteHolidayTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/pricing/holidays/${deleteHolidayTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete holiday period');
      await fetchData();
      setDeleteHolidayTarget(null);
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
        description="Set weekday, weekend, and holiday rates per villa. Holiday dates apply the holiday rate across all units."
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
              {villas.length === 0 && (
                <tr><td colSpan={9} className="pricing-empty">No villas found. Create one to get started.</td></tr>
              )}
              {villas.map((v) => (
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

      <div className="pricing-pane pricing-pane--nested">
        <div className="pricing-pane__toolbar">
          <div>
            <h4 className="pricing-pane__subtitle">Holiday Periods</h4>
            <p className="pricing-pane__desc">
              Dates within these ranges use the holiday rate. Fri–Sun otherwise use the weekend rate; Mon–Thu use weekday.
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => setHolidayModalOpen(true)}>
            Add Holiday Period
          </Button>
        </div>

        {!loading && !error && (
          <div className="pricing-table-wrap">
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
                {holidays.map((h) => (
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
          </div>
        )}
      </div>

      <VillaModal isOpen={modalOpen} onClose={closeModal} onSaved={fetchData} initialData={editVilla} />
      <HolidayModal
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
        onSaved={fetchData}
      />
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

export default VillaPricing;
