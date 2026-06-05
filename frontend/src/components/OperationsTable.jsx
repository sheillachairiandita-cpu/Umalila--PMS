import React, { useState, useMemo } from 'react';
import { RefreshCw, ClipboardList, ArrowUpRight } from 'lucide-react';

// ── Reusable utilities & components ──────────────────────────────────────────
import { filterByDateRange } from '../utils/filterFunction';
import { PHASE_CONFIG, STATUS_CONFIG } from '../utils/statusConfigs';
import Badge from './ui/Badge';
import FilterButtonGroup from './ui/FilterButtonGroup';

// ── Filter options config ─────────────────────────────────────────────────────
const FILTER_OPTIONS = [
  { key: 'today',       label: 'Today'       },
  { key: 'upcoming-7', label: 'Next 7 Days'  },
  { key: 'all-phases', label: 'All'          },
];

// ── Helper: human-readable filter label ──────────────────────────────────────
function filterLabel(key) {
  switch (key) {
    case 'today':       return ' — Today';
    case 'upcoming-7':  return ' — Next Week';
    case 'all-phases':  return ' — All Reservations';
    default:            return '';
  }
}

// ── Main component ────────────────────────────────────────────────────────────
function OperationsTable({ bookings, loading, error, onRefresh }) {
  const [smartFilter, setSmartFilter] = useState('today');

  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // Use the shared filterByDateRange utility from filterFunction.js
  const filtered = useMemo(
    () => filterByDateRange(bookings, smartFilter),
    [bookings, smartFilter]
  );

  return (
    <main className="data-section">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="section-title" style={{ padding: '12px 20px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={16} color="#1e3a8a" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              Reservation{filterLabel(smartFilter)}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 4 }}>
              {today}
            </span>
          </div>

          {/* Right: filters + refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* ↳ FilterButtonGroup replaces the old inline SmartFilter component */}
            <FilterButtonGroup
              options={FILTER_OPTIONS}
              active={smartFilter}
              onChange={setSmartFilter}
              variant="pill"
            />

            <button
              onClick={onRefresh}
              title="Refresh"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="empty-state">Loading reservations…</div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#ef4444' }}>⚠️ {error}</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">No reservations match this filter.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="pms-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Unit</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th style={{ textAlign: 'center' }}>Pax</th>
                <th style={{ textAlign: 'center' }}>Bfast</th>
                <th style={{ textAlign: 'center' }}>Extra Bed</th>
                <th>Status</th>
                <th>Phase</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking) => {
                // Derive phase arrow prefix
                const phaseArrow =
                  booking.stay_phase === 'arrival'   ? '→ ' :
                  booking.stay_phase === 'departure'  ? '← ' : '';

                // Row highlight tint (still driven by phase directly for bg)
                const rowBg =
                  booking.stay_phase === 'arrival'
                    ? 'rgba(224, 242, 254, 0.3)'
                    : booking.stay_phase === 'departure'
                    ? 'rgba(254, 243, 199, 0.3)'
                    : 'transparent';

                return (
                  <tr key={booking.id} style={{ background: rowBg }}>
                    {/* Guest */}
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                        {booking.guests?.full_name || 'Walk-in Guest'}
                      </div>
                    </td>

                    {/* Unit */}
                    <td style={{ fontSize: '0.85rem' }}>
                      {booking.villa_names || '—'}
                    </td>

                    {/* Dates */}
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                      {booking.check_in_date}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>
                      {booking.check_out_date}
                    </td>

                    {/* Pax */}
                    <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                      {booking.total_guests ?? '—'}
                    </td>

                    {/* Breakfast count */}
                    <td style={{ textAlign: 'center' }}>
                      {booking.total_breakfast > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26, height: 26,
                          borderRadius: '50%',
                          background: '#d1fae5',
                          color: '#065f46',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}>
                          {booking.total_breakfast}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    {/* Extra bed count */}
                    <td style={{ textAlign: 'center' }}>
                      {booking.extra_bed_qty > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26, height: 26,
                          borderRadius: '50%',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                        }}>
                          {booking.extra_bed_qty}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    {/* Status badge — uses Badge + STATUS_CONFIG */}
                    <td>
                      <Badge type="status" value={booking.status} />
                    </td>

                    {/* Phase badge — uses Badge + PHASE_CONFIG with arrow prefix */}
                    <td>
                      <Badge
                        type="phase"
                        value={booking.stay_phase}
                        icon={phaseArrow || undefined}
                      />
                    </td>

                    {/* Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        title="Open reservation"
                        onClick={() => alert(`Actions for booking ${booking.id} — TBD`)}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6,
                          padding: '4px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.75rem',
                          color: '#475569',
                          fontWeight: 500,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#1e3a8a';
                          e.currentTarget.style.color = '#fff';
                          e.currentTarget.style.borderColor = '#1e3a8a';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.color = '#475569';
                          e.currentTarget.style.borderColor = '#e2e8f0';
                        }}
                      >
                        <ArrowUpRight size={13} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export default OperationsTable;
