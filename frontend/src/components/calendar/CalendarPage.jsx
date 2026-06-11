import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter, Plus, Ban, X, CalendarOff } from 'lucide-react';
import PublicReservationForm from '../reservations/PublicReservationForm';
import { Button, Alert } from '../ui';
import { STATUS_CONFIG, getStatusConfig } from '../../utils/statusConfigs';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const BLOCK_REASONS = [
  'Maintenance',
  'Owner Stay',
  'Deep Cleaning',
];

const API = '/api';

/** Parse YYYY-MM-DD as local calendar date (avoids UTC timezone drift). */
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(year, month, day) {
  const y = year;
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const CALENDAR_STATUS_KEYS = ['pending', 'confirmed', 'checked_in', 'checked_out'];

function normalizeStatusKey(status) {
  return status?.toLowerCase().replace(/\s+/g, '_') || 'pending';
}

/** Half-open booking span: [checkIn, checkOut) — checkout day excluded. */
function getBookingSpanStyles(checkIn, checkOut, currentYear, currentMonth, daysInMonth) {
  const start = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  if (!start || !end) return null;

  const viewStart = new Date(currentYear, currentMonth, 1);
  const viewEnd = new Date(currentYear, currentMonth, daysInMonth);

  if (end <= viewStart || start > viewEnd) return null;

  const clampStart = start < viewStart ? 1 : start.getDate();
  const clampEnd = end > viewEnd ? daysInMonth + 1 : end.getDate();
  const durationDays = clampEnd - clampStart;

  if (durationDays <= 0) return null;

  return {
    gridColumnStart: clampStart,
    gridColumnEnd: `span ${durationDays}`,
    gridRowStart: 1,
  };
}

/** Inclusive block span: both start and end dates are blocked. */
function getBlockSpanStyles(startDate, endDate, currentYear, currentMonth, daysInMonth) {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) return null;

  const viewStart = new Date(currentYear, currentMonth, 1);
  const viewEnd = new Date(currentYear, currentMonth, daysInMonth);

  if (end < viewStart || start > viewEnd) return null;

  const clampStart = start < viewStart ? 1 : start.getDate();
  const clampEnd = end > viewEnd ? daysInMonth : end.getDate();
  const durationDays = clampEnd - clampStart + 1;

  return {
    gridColumnStart: clampStart,
    gridColumnEnd: `span ${durationDays}`,
    gridRowStart: 1,
  };
}

function dayOverlapsBooking(booking, year, month, dayNum) {
  const cellDate = new Date(year, month, dayNum);
  const checkIn = parseLocalDate(booking.checkIn);
  const checkOut = parseLocalDate(booking.checkOut);
  return cellDate >= checkIn && cellDate < checkOut;
}

function dayOverlapsBlock(block, year, month, dayNum) {
  const cellDate = new Date(year, month, dayNum);
  const start = parseLocalDate(block.startDate);
  const end = parseLocalDate(block.endDate);
  return cellDate >= start && cellDate <= end;
}

function BlockDatesPanel({
  isOpen,
  onClose,
  villas,
  form,
  onChange,
  onSubmit,
  submitting,
  error,
}) {
  if (!isOpen) return null;

  return (
    <>
      <div className="slide-over-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="slide-over-panel" role="dialog" aria-labelledby="block-dates-title">
        <div className="slide-over-panel__header">
          <div className="slide-over-panel__title-wrap">
            <CalendarOff size={18} />
            <h2 id="block-dates-title" className="slide-over-panel__title">Block Dates</h2>
          </div>
          <button type="button" className="icon-btn-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="slide-over-panel__body expense-edit-form" onSubmit={onSubmit}>
          {error && <Alert type="error" message={error} />}

          <div className="form-group">
            <label className="form-label" htmlFor="block-villa">Villa</label>
            <select
              id="block-villa"
              className="form-input"
              value={form.villaId}
              onChange={(e) => onChange({ ...form, villaId: e.target.value })}
              required
            >
              <option value="">Select villa…</option>
              {villas.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="block-start">Start Date</label>
              <input
                id="block-start"
                type="date"
                className="form-input"
                value={form.startDate}
                onChange={(e) => onChange({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="block-end">End Date</label>
              <input
                id="block-end"
                type="date"
                className="form-input"
                value={form.endDate}
                min={form.startDate || undefined}
                onChange={(e) => onChange({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="block-reason">Reason</label>
            <select
              id="block-reason"
              className="form-input"
              value={form.reason}
              onChange={(e) => onChange({ ...form, reason: e.target.value })}
              required
            >
              {BLOCK_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="slide-over-panel__footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              Save Block
            </Button>
          </div>
        </form>
      </aside>
    </>
  );
}

const CalendarPage = ({ onOpenBookingModal }) => {
  const today = useMemo(() => new Date(), []);

  const [villasData, setVillasData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [selectedVillaFilter, setSelectedVillaFilter] = useState('All');

  const [editBooking, setEditBooking] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [blockPanelOpen, setBlockPanelOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    villaId: '',
    startDate: '',
    endDate: '',
    reason: BLOCK_REASONS[0],
  });
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const [blockError, setBlockError] = useState('');

  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    return Array.from({ length: 7 }, (_, i) => base - 2 + i);
  }, [today]);

  const fetchGanttData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/villas/gantt`);
      if (!response.ok) throw new Error('Failed to fetch timeline data.');
      const data = await response.json();
      setVillasData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGanttData();
  }, [fetchGanttData]);

  const daysDataArray = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      const dateObj = new Date(currentYear, currentMonth, dayNum);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      return { dayNum, dayName };
    });
  }, [currentYear, currentMonth]);

  const daysInMonth = daysDataArray.length;
  const gridColumns = `repeat(${daysInMonth}, minmax(48px, 1fr))`;

  const handleGoToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const displayedVillas = selectedVillaFilter === 'All'
    ? villasData
    : villasData.filter((v) => v.name === selectedVillaFilter);

  const isCellBlocked = useCallback((villa, dayNum) => {
    return (villa.blocks || []).some((block) => dayOverlapsBlock(block, currentYear, currentMonth, dayNum));
  }, [currentYear, currentMonth]);

  const isCellOccupied = useCallback((villa, dayNum) => {
    const hasBooking = (villa.bookings || []).some((b) => dayOverlapsBooking(b, currentYear, currentMonth, dayNum));
    return hasBooking || isCellBlocked(villa, dayNum);
  }, [currentYear, currentMonth, isCellBlocked]);

  const openBlockPanel = useCallback((villaId, startDate, endDate) => {
    setBlockForm({
      villaId: villaId || '',
      startDate,
      endDate,
      reason: BLOCK_REASONS[0],
    });
    setBlockError('');
    setBlockPanelOpen(true);
  }, []);

  const handleCellMouseDown = (villa, dayNum) => {
    if (isCellOccupied(villa, dayNum)) return;
    setDragState({
      villaId: villa.id,
      startDay: dayNum,
      endDay: dayNum,
    });
  };

  const handleCellMouseEnter = (villa, dayNum) => {
    if (!dragState || dragState.villaId !== villa.id) return;
    if (isCellOccupied(villa, dayNum)) return;
    setDragState((prev) => ({ ...prev, endDay: dayNum }));
  };

  useEffect(() => {
    const handleMouseUp = () => {
      if (!dragState) return;

      const startDay = Math.min(dragState.startDay, dragState.endDay);
      const endDay = Math.max(dragState.startDay, dragState.endDay);
      openBlockPanel(
        dragState.villaId,
        toISODate(currentYear, currentMonth, startDay),
        toISODate(currentYear, currentMonth, endDay),
      );
      setDragState(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, currentYear, currentMonth, openBlockPanel]);

  const handleOpenBlockPanel = () => {
    const defaultVilla = displayedVillas[0];
    const now = new Date();
    openBlockPanel(
      defaultVilla?.id || '',
      toISODate(now.getFullYear(), now.getMonth(), now.getDate()),
      toISODate(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  };

  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    setBlockError('');

    if (!blockForm.villaId || !blockForm.startDate || !blockForm.endDate || !blockForm.reason) {
      setBlockError('All fields are required.');
      return;
    }
    if (blockForm.endDate < blockForm.startDate) {
      setBlockError('End date must be on or after start date.');
      return;
    }

    setBlockSubmitting(true);
    try {
      const response = await fetch(`${API}/villas/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          villa_id: blockForm.villaId,
          start_date: blockForm.startDate,
          end_date: blockForm.endDate,
          reason: blockForm.reason,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save date block.');
      }
      setBlockPanelOpen(false);
      await fetchGanttData();
    } catch (err) {
      setBlockError(err.message);
    } finally {
      setBlockSubmitting(false);
    }
  };

  const handleBookingClick = async (bookingId) => {
    try {
      const response = await fetch(`${API}/bookings`);
      if (!response.ok) throw new Error('Failed to load booking details.');
      const bookings = await response.json();
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking) setEditBooking(booking);
    } catch (err) {
      console.error(err.message);
    }
  };

  const getDragPreviewStyles = (villa) => {
    if (!dragState || dragState.villaId !== villa.id) return null;
    const startDay = Math.min(dragState.startDay, dragState.endDay);
    const endDay = Math.max(dragState.startDay, dragState.endDay);
    return {
      gridColumnStart: startDay,
      gridColumnEnd: `span ${endDay - startDay + 1}`,
      gridRowStart: 1,
    };
  };

  if (loading) {
    return (
      <div className="calendar-page">
        <div className="placeholder-page">
          <p className="text-muted">Loading timeline view…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-page">
        <div className="placeholder-page">
          <p className="text-error">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="gantt-control-panel">
        <div className="gantt-control-panel__group">
          <button type="button" className="today-btn" onClick={handleGoToToday}>
            Today
          </button>

          <div className="gantt-control-panel__nav">
            <button type="button" className="cal-nav-btn" onClick={handlePrevMonth} title="Previous month">
              <ChevronLeft size={16} />
            </button>
            <span className="cal-month-label">{MONTHS[currentMonth]} {currentYear}</span>
            <button type="button" className="cal-nav-btn" onClick={handleNextMonth} title="Next month">
              <ChevronRight size={16} />
            </button>
          </div>

          <select
            className="filter-select"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
            aria-label="Select month"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={currentYear}
            onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
            aria-label="Select year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="gantt-control-panel__actions">
          <div className="gantt-control-panel__filter">
            <Filter size={14} />
            <select
              className="filter-select"
              value={selectedVillaFilter}
              onChange={(e) => setSelectedVillaFilter(e.target.value)}
              aria-label="Filter by accommodation"
            >
              <option value="All">All Accommodations</option>
              {villasData.map((v) => (
                <option key={v.id} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          <button type="button" className="btn secondary sm" onClick={handleOpenBlockPanel}>
            <Ban size={14} /> Block Dates
          </button>

          <button type="button" className="btn primary sm" onClick={onOpenBookingModal}>
            <Plus size={14} /> New Booking
          </button>
        </div>
      </div>

      <div className="calendar-legend">
        {CALENDAR_STATUS_KEYS.map((key) => (
          <div className="legend-item" key={key}>
            <span
              className="legend-dot"
              style={{ backgroundColor: STATUS_CONFIG[key].bg }}
            />
            {STATUS_CONFIG[key].label}
          </div>
        ))}
        <div className="legend-item">
          <span className="legend-dot status-blocked" /> Blocked
        </div>
      </div>

      <div className="gantt-chart-outer-wrapper">
        <div className="gantt-chart-container">
          <div className="gantt-header-row">
            <div className="gantt-sidebar-cell sticky-column">Accommodations</div>
            <div className="gantt-timeline-grid-header" style={{ gridTemplateColumns: gridColumns }}>
              {daysDataArray.map(({ dayNum, dayName }) => {
                const now = new Date();
                const isTodayCol = now.getDate() === dayNum
                  && now.getMonth() === currentMonth
                  && now.getFullYear() === currentYear;
                const isWeekend = dayName === 'Sat' || dayName === 'Sun';

                return (
                  <div
                    key={dayNum}
                    className={`day-header-number${isTodayCol ? ' current-day' : ''}${isWeekend ? ' weekend-day' : ''}`}
                  >
                    <span className="day-name-label">{dayName}</span>
                    <span className="day-num-label">{dayNum}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="gantt-body">
            {displayedVillas.map((villa) => (
              <div key={villa.id} className="gantt-row">
                <div className="gantt-sidebar-cell label-bold sticky-column">{villa.name}</div>

                <div className="gantt-timeline-row-wrapper">
                  <div className="gantt-background-grid" style={{ gridTemplateColumns: gridColumns }}>
                    {daysDataArray.map(({ dayNum, dayName }) => {
                      const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                      return (
                        <div
                          key={dayNum}
                          className={`grid-column-guide${isWeekend ? ' weekend-column' : ''}`}
                        />
                      );
                    })}
                  </div>

                  <div className="gantt-interaction-grid" style={{ gridTemplateColumns: gridColumns }}>
                    {daysDataArray.map(({ dayNum }) => {
                      const blocked = isCellBlocked(villa, dayNum);
                      const occupied = !blocked && (villa.bookings || []).some(
                        (b) => dayOverlapsBooking(b, currentYear, currentMonth, dayNum),
                      );
                      return (
                        <div
                          key={dayNum}
                          className={`gantt-interaction-cell${blocked ? ' gantt-interaction-cell--blocked' : ''}${occupied ? ' gantt-interaction-cell--occupied' : ''}`}
                          onMouseDown={() => handleCellMouseDown(villa, dayNum)}
                          onMouseEnter={() => handleCellMouseEnter(villa, dayNum)}
                          aria-hidden="true"
                        />
                      );
                    })}
                  </div>

                  <div className="gantt-bookings-overlay" style={{ gridTemplateColumns: gridColumns }}>
                    {(villa.blocks || []).map((block) => {
                      const gridSpanStyles = getBlockSpanStyles(
                        block.startDate,
                        block.endDate,
                        currentYear,
                        currentMonth,
                        daysInMonth,
                      );
                      if (!gridSpanStyles) return null;

                      return (
                        <div
                          key={block.id}
                          className="gantt-block-bar"
                          style={gridSpanStyles}
                          title={`Blocked: ${block.reason} (${block.startDate} – ${block.endDate})`}
                        >
                          {block.reason}
                        </div>
                      );
                    })}

                    {(villa.bookings || []).map((booking) => {
                      const gridSpanStyles = getBookingSpanStyles(
                        booking.checkIn,
                        booking.checkOut,
                        currentYear,
                        currentMonth,
                        daysInMonth,
                      );
                      if (!gridSpanStyles) return null;

                      const statusKey = normalizeStatusKey(booking.status);
                      const statusBg = getStatusConfig(statusKey).bg;

                      return (
                        <div
                          key={`${booking.id}-${villa.id}`}
                          role="button"
                          tabIndex={0}
                          className="gantt-booking-bar"
                          style={{ ...gridSpanStyles, backgroundColor: statusBg }}
                          title={`${booking.guest} (${booking.checkIn} → ${booking.checkOut})`}
                          onClick={() => handleBookingClick(booking.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleBookingClick(booking.id);
                            }
                          }}
                        >
                          <span className="booking-bar-text">{booking.guest}</span>
                        </div>
                      );
                    })}

                    {getDragPreviewStyles(villa) && (
                      <div className="gantt-drag-preview" style={getDragPreviewStyles(villa)} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <BlockDatesPanel
        isOpen={blockPanelOpen}
        onClose={() => setBlockPanelOpen(false)}
        villas={villasData}
        form={blockForm}
        onChange={setBlockForm}
        onSubmit={handleBlockSubmit}
        submitting={blockSubmitting}
        error={blockError}
      />

      <PublicReservationForm
        variant="modal"
        isOpen={!!editBooking}
        booking={editBooking}
        onClose={() => setEditBooking(null)}
        onSaved={fetchGanttData}
      />
    </div>
  );
};

export default CalendarPage;
