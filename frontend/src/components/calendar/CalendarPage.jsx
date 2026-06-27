import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Filter, Plus, Ban, X, CalendarOff, Unlock } from 'lucide-react';
import SummaryModal from '../financial/SummaryModal';
import { Button, Alert, Modal } from '../ui';
import { STATUS_CONFIG, getStatusConfig } from '../../utils/statusConfigs';
import { useMutation } from '../../context/MutationProvider';
import { usePermission } from '../../auth/usePermission';
import { PERMISSIONS } from '../../auth/permissions';
import RequirePermission from '../auth/RequirePermission';
import {
  findBlockingConflicts,
  formatBlockConflictError,
  formatDisplayDate,
  formatCreatedAt,
  isBlockingBookingStatus,
} from '../../utils/blockUtils';

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
  properties,
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
            <label className="form-label" htmlFor="block-property">Property</label>
            <select
              id="block-property"
              className="form-input"
              value={form.propertyId}
              onChange={(e) => onChange({ ...form, propertyId: e.target.value })}
              required
            >
              <option value="">Select property…</option>
              {properties.map((v) => (
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

function BlockDetailsModal({ block, propertyName, onClose, onUnblock, canUnblock }) {
  if (!block) return null;

  return (
    <Modal isOpen={!!block} onClose={onClose} size="md">
      <Modal.Header
        title="Blocked Date Details"
        icon={CalendarOff}
        subtitle={propertyName}
        onClose={onClose}
      />
      <Modal.Body>
        <div className="block-details-meta">
          <div className="block-details-meta__row">
            <span className="block-details-meta__label">Date Range</span>
            <span className="block-details-meta__value">
              {formatDisplayDate(block.startDate)} — {formatDisplayDate(block.endDate)}
            </span>
          </div>
          <div className="block-details-meta__row">
            <span className="block-details-meta__label">Reason</span>
            <span className="block-details-meta__value">{block.reason || '—'}</span>
          </div>
          <div className="block-details-meta__row">
            <span className="block-details-meta__label">Created</span>
            <span className="block-details-meta__value">{formatCreatedAt(block.createdAt)}</span>
          </div>
          <div className="block-details-meta__row">
            <span className="block-details-meta__label">Created By</span>
            <span className="block-details-meta__value">{block.createdBy || '—'}</span>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {canUnblock && (
          <Button variant="danger" icon={Unlock} onClick={onUnblock}>
            Unblock Date
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}

function UnblockConfirmModal({ block, propertyName, isOpen, onClose, onConfirm, submitting }) {
  if (!block) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header title="Unblock Dates" icon={Ban} onClose={onClose} />
      <Modal.Body>
        <p className="pms-text-muted" style={{ fontSize: '0.88rem', margin: 0 }}>
          Remove the block for <strong>{propertyName}</strong> from{' '}
          <strong>{formatDisplayDate(block.startDate)}</strong> to{' '}
          <strong>{formatDisplayDate(block.endDate)}</strong>?
          These dates will become available for reservation again.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="danger" loading={submitting} onClick={onConfirm}>
          Unblock
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

const CalendarPage = ({ onOpenBookingModal }) => {
  const { runMutation, isMutating } = useMutation();
  const canBlockDates = usePermission(PERMISSIONS.CALENDAR_BLOCK);
  const today = useMemo(() => new Date(), []);

  const [propertiesData, setPropertiesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('All');

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [blockPanelOpen, setBlockPanelOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    propertyId: '',
    startDate: '',
    endDate: '',
    reason: BLOCK_REASONS[0],
  });
  const [blockError, setBlockError] = useState('');
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [unblockConfirmOpen, setUnblockConfirmOpen] = useState(false);

  const yearOptions = useMemo(() => {
    const base = today.getFullYear();
    return Array.from({ length: 7 }, (_, i) => base - 2 + i);
  }, [today]);

  const fetchGanttData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(`${API}/properties/gantt`);
      if (!response.ok) throw new Error('Failed to fetch timeline data.');
      const data = await response.json();
      setPropertiesData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
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

  const registeredCategories = useMemo(
    () => [...new Set(propertiesData.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [propertiesData],
  );

  const categoryFilterOptions = useMemo(() => {
    const counts = registeredCategories.reduce((acc, cat) => {
      acc[cat] = propertiesData.filter((p) => p.category === cat).length;
      return acc;
    }, {});

    return [
      { key: 'all', label: `All (${propertiesData.length})` },
      ...registeredCategories.map((cat) => ({
        key: cat,
        label: `${cat} (${counts[cat] || 0})`,
      })),
    ];
  }, [propertiesData, registeredCategories]);

  const propertiesByCategory = useMemo(() => (
    categoryFilter === 'all'
      ? propertiesData
      : propertiesData.filter((p) => p.category === categoryFilter)
  ), [propertiesData, categoryFilter]);

  const displayedProperties = selectedPropertyFilter === 'All'
    ? propertiesByCategory
    : propertiesByCategory.filter((v) => v.name === selectedPropertyFilter);

  useEffect(() => {
    if (
      selectedPropertyFilter !== 'All'
      && !propertiesByCategory.some((p) => p.name === selectedPropertyFilter)
    ) {
      setSelectedPropertyFilter('All');
    }
  }, [propertiesByCategory, selectedPropertyFilter]);

  const isCellBlocked = useCallback((property, dayNum) => {
    return (property.blocks || []).some((block) => dayOverlapsBlock(block, currentYear, currentMonth, dayNum));
  }, [currentYear, currentMonth]);

  const hasBlockingBookingOnDay = useCallback((property, dayNum) => {
    return (property.bookings || []).some(
      (b) => isBlockingBookingStatus(b.status)
        && dayOverlapsBooking(b, currentYear, currentMonth, dayNum),
    );
  }, [currentYear, currentMonth]);

  const isCellOccupied = useCallback((property, dayNum) => {
    return isCellBlocked(property, dayNum) || hasBlockingBookingOnDay(property, dayNum);
  }, [currentYear, currentMonth, isCellBlocked, hasBlockingBookingOnDay]);

  const openBlockPanel = useCallback((propertyId, startDate, endDate) => {
    setBlockForm({
      propertyId: propertyId || '',
      startDate,
      endDate,
      reason: BLOCK_REASONS[0],
    });
    setBlockError('');
    setBlockPanelOpen(true);
  }, []);

  const handleCellMouseDown = (property, dayNum) => {
    if (!canBlockDates) return;
    if (isCellOccupied(property, dayNum)) return;
    setDragState({
      propertyId: property.id,
      startDay: dayNum,
      endDay: dayNum,
    });
  };

  const handleCellMouseEnter = (property, dayNum) => {
    if (!dragState || dragState.propertyId !== property.id) return;
    if (isCellOccupied(property, dayNum)) return;
    setDragState((prev) => ({ ...prev, endDay: dayNum }));
  };

  useEffect(() => {
    if (!canBlockDates) return undefined;

    const handleMouseUp = () => {
      if (!dragState) return;

      const startDay = Math.min(dragState.startDay, dragState.endDay);
      const endDay = Math.max(dragState.startDay, dragState.endDay);
      openBlockPanel(
        dragState.propertyId,
        toISODate(currentYear, currentMonth, startDay),
        toISODate(currentYear, currentMonth, endDay),
      );
      setDragState(null);
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragState, currentYear, currentMonth, openBlockPanel, canBlockDates]);

  const handleOpenBlockPanel = () => {
    const defaultProperty = displayedProperties[0];
    const now = new Date();
    openBlockPanel(
      defaultProperty?.id || '',
      toISODate(now.getFullYear(), now.getMonth(), now.getDate()),
      toISODate(now.getFullYear(), now.getMonth(), now.getDate()),
    );
  };

  const handleBlockSubmit = async (e) => {
    e.preventDefault();
    setBlockError('');

    if (!blockForm.propertyId || !blockForm.startDate || !blockForm.endDate || !blockForm.reason) {
      setBlockError('All fields are required.');
      return;
    }
    if (blockForm.endDate < blockForm.startDate) {
      setBlockError('End date must be on or after start date.');
      return;
    }

    const property = propertiesData.find((v) => v.id === blockForm.propertyId);
    const conflicts = findBlockingConflicts(property, blockForm.startDate, blockForm.endDate);
    if (conflicts.length > 0) {
      setBlockError(formatBlockConflictError(conflicts));
      return;
    }

    const result = await runMutation({
      mutation: async () => {
        const response = await fetch(`${API}/properties/blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: blockForm.propertyId,
            start_date: blockForm.startDate,
            end_date: blockForm.endDate,
            reason: blockForm.reason,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save date block.');
        }
        return response.json();
      },
      refresh: () => fetchGanttData({ silent: true }),
      successMessage: 'Date block saved successfully.',
      overlayMessage: 'Saving date block…',
    });

    if (result.ok) {
      setBlockPanelOpen(false);
    } else {
      setBlockError(result.error?.message || 'Failed to save date block.');
    }
  };

  const handleBookingClick = (booking) => {
    setSelectedBooking({
      bookingId: booking.id,
      guestName: booking.guest,
      displayId: booking.displayId,
    });
  };

  const handleBlockClick = (block, property) => {
    setSelectedBlock({
      ...block,
      propertyName: property.name,
      propertyId: property.id,
    });
  };

  const handleUnblockRequest = () => {
    setUnblockConfirmOpen(true);
  };

  const handleUnblockConfirm = async () => {
    if (!selectedBlock?.id) return;

    const blockId = selectedBlock.id;
    const result = await runMutation({
      mutation: async () => {
        const response = await fetch(`${API}/properties/blocks/${blockId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to remove date block.');
        }
      },
      refresh: () => fetchGanttData({ silent: true }),
      successMessage: 'Date block removed successfully.',
      overlayMessage: 'Removing date block…',
    });

    if (result.ok) {
      setUnblockConfirmOpen(false);
      setSelectedBlock(null);
    }
  };

  const getDragPreviewStyles = (property) => {
    if (!dragState || dragState.propertyId !== property.id) return null;
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
          <div className="gantt-control-panel__filters">
            <div className="gantt-control-panel__filter">
              <Filter size={14} />
              {registeredCategories.length > 0 && (
                <select
                  className="filter-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  {categoryFilterOptions.map(({ key, label }) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              )}
              <select
                className="filter-select"
                value={selectedPropertyFilter}
                onChange={(e) => setSelectedPropertyFilter(e.target.value)}
                aria-label="Filter by accommodation"
              >
                <option value="All">All Accommodations</option>
                {propertiesByCategory.map((v) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <RequirePermission permission={PERMISSIONS.CALENDAR_BLOCK}>
            <button type="button" className="btn secondary sm" onClick={handleOpenBlockPanel}>
              <Ban size={14} /> Block Dates
            </button>
          </RequirePermission>

          <RequirePermission permission={PERMISSIONS.CALENDAR_BOOK}>
            <Button variant="primary" icon={Plus} onClick={onOpenBookingModal}>
            New Booking
            </Button>
          </RequirePermission>
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
            {displayedProperties.map((property) => (
              <div key={property.id} className="gantt-row">
                <div className="gantt-sidebar-cell label-bold sticky-column">{property.name}</div>

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
                      const blocked = isCellBlocked(property, dayNum);
                      const occupied = !blocked && (property.bookings || []).some(
                        (b) => dayOverlapsBooking(b, currentYear, currentMonth, dayNum),
                      );
                      return (
                        <div
                          key={dayNum}
                          className={`gantt-interaction-cell${blocked ? ' gantt-interaction-cell--blocked' : ''}${occupied ? ' gantt-interaction-cell--occupied' : ''}`}
                          onMouseDown={() => handleCellMouseDown(property, dayNum)}
                          onMouseEnter={() => handleCellMouseEnter(property, dayNum)}
                          aria-hidden="true"
                        />
                      );
                    })}
                  </div>

                  <div className="gantt-bookings-overlay" style={{ gridTemplateColumns: gridColumns }}>
                    {(property.blocks || []).map((block) => {
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
                          role="button"
                          tabIndex={0}
                          className="gantt-block-bar"
                          style={gridSpanStyles}
                          title={`Blocked: ${block.reason} (${block.startDate} – ${block.endDate})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBlockClick(block, property);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleBlockClick(block, property);
                            }
                          }}
                        >
                          {block.reason}
                        </div>
                      );
                    })}

                    {(property.bookings || []).map((booking) => {
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
                          key={`${booking.id}-${property.id}`}
                          role="button"
                          tabIndex={0}
                          className="gantt-booking-bar"
                          style={{ ...gridSpanStyles, backgroundColor: statusBg }}
                          title={`${booking.guest} (${booking.checkIn} → ${booking.checkOut})`}
                          onClick={() => handleBookingClick(booking)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleBookingClick(booking);
                            }
                          }}
                        >
                          <span className="booking-bar-text">{booking.guest}</span>
                        </div>
                      );
                    })}

                    {getDragPreviewStyles(property) && (
                      <div className="gantt-drag-preview" style={getDragPreviewStyles(property)} />
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
        properties={propertiesData}
        form={blockForm}
        onChange={setBlockForm}
        onSubmit={handleBlockSubmit}
        submitting={isMutating}
        error={blockError}
      />

      <BlockDetailsModal
        block={selectedBlock && !unblockConfirmOpen ? selectedBlock : null}
        propertyName={selectedBlock?.propertyName}
        onClose={() => {
          setSelectedBlock(null);
          setUnblockConfirmOpen(false);
        }}
        onUnblock={handleUnblockRequest}
        canUnblock={canBlockDates}
      />

      <UnblockConfirmModal
        block={selectedBlock}
        propertyName={selectedBlock?.propertyName}
        isOpen={unblockConfirmOpen}
        onClose={() => setUnblockConfirmOpen(false)}
        onConfirm={handleUnblockConfirm}
        submitting={isMutating}
      />

      <SummaryModal
        isOpen={!!selectedBooking}
        bookingId={selectedBooking?.bookingId}
        guestName={selectedBooking?.guestName}
        displayId={selectedBooking?.displayId}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
};

export default CalendarPage;
