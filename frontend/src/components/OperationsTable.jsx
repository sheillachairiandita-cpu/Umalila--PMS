import React, { useState } from 'react';
import { RefreshCw, ClipboardList, ArrowUpRight } from 'lucide-react';

const PHASE_CONFIG = {
  arrival: {
    label: 'Arriving',
    color: '#0369a1',
    bg: '#e0f2fe',
  },
  'in-house': {
    label: 'In House',
    color: '#6d28d9',
    bg: '#ede9fe',
  },
  departure: {
    label: 'Departing',
    color: '#b45309',
    bg: '#fef3c7',
  },
  upcoming: {
    label: 'Upcoming',
    color: '#374151',
    bg: '#f3f4f6',
  },
};

const STATUS_CONFIG = {
  confirmed: { label: 'Confirmed', color: '#065f46', bg: '#d1fae5' },
  pending: { label: 'Pending', color: '#92400e', bg: '#fef3c7' },
  checked_in: { label: 'Checked In', color: '#1e40af', bg: '#dbeafe' },
  checked_out: { label: 'Checked Out', color: '#374151', bg: '#f3f4f6' },
  cancelled: { label: 'Cancelled', color: '#991b1b', bg: '#fee2e2' },
};

function PhaseFilter({ active, onChange }) {
  const phases = ['all', 'arrival', 'in-house', 'departure', 'upcoming'];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {phases.map(p => (
        <button
          key={p}
          onClick={() => onChange(p)}
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            border: '1px solid',
            borderColor: active === p ? '#1e3a8a' : '#e2e8f0',
            background: active === p ? '#1e3a8a' : 'transparent',
            color: active === p ? '#fff' : '#64748b',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            textTransform: 'capitalize',
            transition: 'all 0.15s',
          }}
        >
          {p === 'all' ? 'All' : PHASE_CONFIG[p]?.label || p}
        </button>
      ))}
    </div>
  );
}

function OperationsTable({ bookings, loading, error, onRefresh }) {
  const [phaseFilter, setPhaseFilter] = useState('all');

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const filtered = phaseFilter === 'all'
    ? bookings
    : bookings.filter(b => b.stay_phase === phaseFilter);

  return (
    <main className="data-section">
      <div className="section-title" style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={16} color="#1e3a8a" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Reservation Ledger</span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 4 }}>{today}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PhaseFilter active={phaseFilter} onChange={setPhaseFilter} />
            <button
              onClick={onRefresh}
              title="Refresh"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
            >
              <RefreshCw size={15} className={loading ? 'spin-animation' : ''} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Loading reservations...</div>
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
                const phase = PHASE_CONFIG[booking.stay_phase] || PHASE_CONFIG['upcoming'];
                const status = STATUS_CONFIG[booking.status] || STATUS_CONFIG['confirmed'];
                return (
                  <tr key={booking.id} style={{
                    background: booking.stay_phase === 'arrival'
                      ? 'rgba(224, 242, 254, 0.3)'
                      : booking.stay_phase === 'departure'
                      ? 'rgba(254, 243, 199, 0.3)'
                      : 'transparent'
                  }}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                        {booking.guests?.full_name || 'Walk-in Guest'}
                      </div>
                      {booking.guests?.phone_number && (
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {booking.guests.phone_number}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{booking.villa_names || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{booking.check_in_date}</td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{booking.check_out_date}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.85rem' }}>
                      {booking.total_guests ?? '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {booking.total_breakfast > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
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
                    <td style={{ textAlign: 'center' }}>
                      {booking.extra_bed_qty > 0 ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 26,
                          height: 26,
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
                    <td>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: status.bg,
                        color: status.color,
                      }}>
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        background: phase.bg,
                        color: phase.color,
                      }}>
                        {booking.stay_phase === 'arrival' && '→ '}
                        {booking.stay_phase === 'departure' && '← '}
                        {phase.label}
                      </span>
                    </td>
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
