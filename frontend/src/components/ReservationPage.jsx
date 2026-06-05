import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  Clock,
  Calendar,
  Users,
  DollarSign,
  Filter,
  X,
} from 'lucide-react';

// =====================================================
// 📊 SECTION 1: DASHBOARD STATS CARDS
// =====================================================
function DashboardMetrics({ stats, loading }) {
  const metrics = [
    {
      label: 'Total Bookings',
      value: stats?.totalBookings || 0,
      icon: Calendar,
      color: '#1e3a8a',
      bg: '#eff6ff',
    },
    {
      label: 'Pending Approval',
      value: stats?.pendingApproval || 0,
      icon: Clock,
      color: '#b45309',
      bg: '#fef3c7',
    },
    {
      label: 'Confirmed',
      value: stats?.confirmedBookings || 0,
      icon: CheckCircle,
      color: '#059669',
      bg: '#f0fdf4',
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
      {metrics.map(({ label, value, icon: Icon, color, bg }) => (
        <div
          key={label}
          style={{
            background: bg,
            border: `1px solid ${color}22`,
            padding: '18px 20px',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 10,
            right: 12,
            opacity: 0.1,
          }}>
            <Icon size={42} color={color} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon size={14} color={color} />
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color, fontWeight: 600 }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#0f172a' }}>
            {loading ? '—' : value}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// 📋 SECTION 2: PENDING REQUESTS TABLE
// =====================================================
function PendingRequestsTable({ requests, onApprove, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        Loading pending requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div style={{
        padding: '60px 40px',
        textAlign: 'center',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      }}>
        <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px', opacity: 0.8 }} />
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#0f172a', fontWeight: 600 }}>
          No New Requests
        </h3>
        <p style={{ margin: '0', fontSize: '0.9rem', color: '#64748b' }}>
          All pending reservation requests have been processed. Great job staying on top of it!
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Guest
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Check-In
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Check-Out
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Adults / Children
            </th>

            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>
                {request.guest_full_name}
              </td>
              <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>
                Rp {request.total_price?.toLocaleString() || '0'}
              </td>
              <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569' }}>
                {request.check_in_date}
              </td>
              <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569' }}>
                {request.check_out_date}
              </td>
              <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569', textAlign: 'center' }}>
                {request.adults} / {request.children}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  onClick={() => alert(`Details for ${request.guest_full_name} — TBD`)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: '#475569',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#1e3a8a';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = '#1e3a8a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#475569';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  title="View full details"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => onApprove(request.id)}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: '#fff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  title="Approve this request"
                >
                  <CheckCircle size={14} /> Approve
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// 📅 SECTION 3: ALL RESERVATIONS LIST WITH PAGINATION & FILTERS
// =====================================================
function AllReservationsTable({ reservations, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get today's date for timeframe filtering
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  // Filter logic
  const filtered = useMemo(() => {
    return reservations.filter((res) => {
      // Search filter
      if (
        searchTerm &&
        !res.guest_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.villa_names?.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Payment status filter
      if (paymentFilter !== 'all') {
        if (paymentFilter === 'pending' && res.payment_status !== 'pending') return false;
        if (paymentFilter === 'confirmed' && res.payment_status !== 'confirmed') return false;
        if (paymentFilter === 'completed' && res.payment_status !== 'completed') return false;
      }

      // Reservation status filter
      if (statusFilter !== 'all' && res.status !== statusFilter) return false;

      // Timeframe filter
      if (timeframeFilter !== 'all') {
        const checkInDate = new Date(res.check_in_date);
        if (timeframeFilter === 'today' && checkInDate.toDateString() !== today.toDateString()) return false;
        if (timeframeFilter === 'month' && (checkInDate < startOfMonth || checkInDate > today)) return false;
        if (timeframeFilter === 'year' && (checkInDate < startOfYear || checkInDate > today)) return false;
      }

      return true;
    });
  }, [reservations, searchTerm, paymentFilter, statusFilter, timeframeFilter]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  const getPaymentStatusBadge = (status) => {
    const config = {
      pending: { bg: '#fef3c7', color: '#b45309', label: 'No DP' },
      confirmed: { bg: '#dbeafe', color: '#1e40af', label: 'DP Paid' },
      completed: { bg: '#d1fae5', color: '#065f46', label: 'All Paid' },
    };
    const style = config[status] || config.pending;
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: style.bg,
        color: style.color,
      }}>
        {style.label}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: { bg: '#fef3c7', color: '#b45309' },
      confirmed: { bg: '#d1fae5', color: '#065f46' },
      checked_in: { bg: '#dbeafe', color: '#1e40af' },
      checked_out: { bg: '#f3f4f6', color: '#374151' },
      cancelled: { bg: '#fee2e2', color: '#991b1b' },
    };
    const style = config[status] || config.pending;
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: style.bg,
        color: style.color,
      }}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div>
      {/* Filter Controls */}
      <div style={{
        background: '#ffffff',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        alignItems: 'end',
      }}>
        {/* Search Bar */}
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Guest name or villa…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                paddingLeft: '32px',
                padding: '10px 14px',
                paddingLeft: '32px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1e3a8a';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Payment Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Payment Status
          </label>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              background: '#ffffff',
              color: '#0f172a',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e3a8a';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Payments</option>
            <option value="pending">Pending (No DP)</option>
            <option value="confirmed">Confirmed (DP Paid)</option>
            <option value="completed">Completed (All Paid)</option>
          </select>
        </div>

        {/* Reservation Status Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reservation Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              background: '#ffffff',
              color: '#0f172a',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e3a8a';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="checked_in">Check In</option>
            <option value="checked_out">Check Out</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Timeframe Filter */}
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Timeframe
          </label>
          <select
            value={timeframeFilter}
            onChange={(e) => {
              setTimeframeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              background: '#ffffff',
              color: '#0f172a',
              transition: 'all 0.2s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#1e3a8a';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 58, 138, 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>

        {/* Clear Filters Button */}
        {(searchTerm || paymentFilter !== 'all' || statusFilter !== 'all' || timeframeFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setPaymentFilter('all');
              setStatusFilter('all');
              setTimeframeFilter('all');
              setCurrentPage(1);
            }}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f1f5f9';
            }}
          >
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Results info */}
      <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: '#64748b' }}>
        Showing {paginatedData.length === 0 ? '0' : startIdx + 1}–{Math.min(startIdx + itemsPerPage, filtered.length)} of {filtered.length} reservations
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          Loading reservations...
        </div>
      ) : paginatedData.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
        }}>
          <Filter size={48} color="#cbd5e1" style={{ marginBottom: '16px', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>
            No Reservations Found
          </h3>
          <p style={{ margin: '0', fontSize: '0.9rem', color: '#64748b' }}>
            Try adjusting your filters or search criteria
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Guest
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Villas
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Check-In
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Check-Out
                </th>
                
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Amount
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Payment
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((res) => (
                <tr key={res.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>
                    {res.guest_full_name}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569' }}>
                    {res.villa_names || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569' }}>
                    {res.check_in_date}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: '#475569' }}>
                    {res.check_out_date}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', textAlign: 'right' }}>
                    Rp {res.total_price?.toLocaleString() || '0'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {getPaymentStatusBadge(res.payment_status)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {getStatusBadge(res.status)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => alert(`Actions for ${res.guest_full_name} — TBD`)}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: '#475569',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#1e3a8a';
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.borderColor = '#1e3a8a';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.color = '#475569';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          marginTop: '24px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '12px',
        }}>
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? '#f1f5f9' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '8px 10px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (currentPage !== 1) {
                e.currentTarget.style.background = '#1e3a8a';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = '#1e3a8a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <ChevronLeft size={16} />
          </button>

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => {
                // Show current page and surrounding pages
                return Math.abs(page - currentPage) <= 1 || page === 1 || page === totalPages;
              })
              .map((page, idx, arr) => {
                // Add ellipsis if needed
                if (idx > 0 && arr[idx - 1] !== page - 1) {
                  return (
                    <span key={`ellipsis-${page}`} style={{ color: '#cbd5e1', padding: '0 4px' }}>
                      …
                    </span>
                  );
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? '#1e3a8a' : '#ffffff',
                      color: currentPage === page ? '#ffffff' : '#0f172a',
                      border: `1px solid ${currentPage === page ? '#1e3a8a' : '#cbd5e1'}`,
                      borderRadius: '6px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: currentPage === page ? 600 : 500,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (currentPage !== page) {
                        e.currentTarget.style.borderColor = '#1e3a8a';
                        e.currentTarget.style.color = '#1e3a8a';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentPage !== page) {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#0f172a';
                      }
                    }}
                  >
                    {page}
                  </button>
                );
              })}
          </div>

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? '#f1f5f9' : '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '8px 10px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.5 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              if (currentPage !== totalPages) {
                e.currentTarget.style.background = '#1e3a8a';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.borderColor = '#1e3a8a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = '#0f172a';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <ChevronRight size={16} />
          </button>

          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '16px' }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )}
    </div>
  );
}

// =====================================================
// 🎯 MAIN COMPONENT: RESERVATION PAGE
// =====================================================
function ReservationPage() {
  const [pendingRequests, setPendingRequests] = useState([]);
  const [allReservations, setAllReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch data from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch all bookings
        const bookingsRes = await fetch('http://localhost:5000/api/bookings');
        if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');
        const bookingsData = await bookingsRes.json();

        // Separate pending and approved
        const pending = bookingsData.filter((b) => b.status === 'pending').map((b) => ({
          ...b,
          adults: parseInt(b.notes?.match(/Adults:\s*(\d+)/)?.[1] || '0'),
          children: parseInt(b.notes?.match(/Children:\s*(\d+)/)?.[1] || '0'),
        }));

        const approved = bookingsData.filter((b) => b.status !== 'pending').map((b) => ({
          ...b,
          payment_status: b.payment_status || 'pending', // Default to pending
        }));

        setPendingRequests(pending);
        setAllReservations(approved);

    
        setStats({
          totalBookings: bookingsData.length,
          pendingApproval: pending.length,
          confirmedBookings: approved.filter((b) => b.status === 'confirmed').length,

        });
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle approve request
  const handleApproveRequest = async (requestId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/bookings/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      if (!response.ok) throw new Error('Failed to approve request');

      // Update local state
      const approvedRequest = pendingRequests.find((r) => r.id === requestId);
      if (approvedRequest) {
        setPendingRequests(pendingRequests.filter((r) => r.id !== requestId));
        setAllReservations([...allReservations, { ...approvedRequest, status: 'confirmed', payment_status: 'pending' }]);

        // Update stats
        setStats((prev) => ({
          ...prev,
          pendingApproval: prev.pendingApproval - 1,
          confirmedBookings: prev.confirmedBookings + 1,
        }));
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request');
    }
  };

  return (
    <div style={{ padding: '28px 36px', boxSizing: 'border-box', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Section 1: Dashboard Stats */}
      <div style={{ marginBottom: '36px' }}>
    
        <DashboardMetrics stats={stats} loading={statsLoading} />
      </div>

      {/* Section 2: Pending Requests */}
      <div style={{
        background: '#ffffff',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '36px',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={20} color="#b45309" />
          Pending Requests ({pendingRequests.length})
        </h3>
        <PendingRequestsTable requests={pendingRequests} onApprove={handleApproveRequest} loading={loading} />
      </div>

      {/* Section 3: All Reservations */}
      <div style={{
        background: '#ffffff',
        padding: '24px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="#1e3a8a" />
          All Reservations ({allReservations.length})
        </h3>
        <AllReservationsTable reservations={allReservations} loading={loading} />
      </div>
    </div>
  );
}

export default ReservationPage;
