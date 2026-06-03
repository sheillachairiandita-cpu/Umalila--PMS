import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

function BookingTable({ bookings, loading, error, onRefresh }) {
  return (
    <main className="data-section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <Calendar size={18} color="#1e3a8a" /> Live Reservation Ledger
        </span>
        <button onClick={onRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="empty-state">Querying database rows...</div>
      ) : error ? (
        <div className="empty-state" style={{ color: '#ef4444' }}>⚠️ Communication error: {error}</div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">No active reservations found in system logs.</div>
      ) : (
        <table className="pms-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Property Unit</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td style={{ fontWeight: '500' }}>
                  {booking.guests?.full_name || 'Walk-in Guest'}
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '400' }}>{booking.guests?.phone_number}</div>
                </td>
                <td>{booking.villa_names || 'No Units Assigned'}</td>
                <td>{booking.check_in_date}</td>
                <td>{booking.check_out_date}</td>
                <td>
                  <span className={`status-badge ${booking.status || 'confirmed'}`}>
                    {booking.status || 'confirmed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

export default BookingTable;