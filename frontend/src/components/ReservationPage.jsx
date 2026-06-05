import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  Clock,
  Calendar,
  Filter,
  X,
  TrendingUp,
} from 'lucide-react';
import Badge from './ui/Badge';
import FilterButtonGroup from './ui/FilterButtonGroup';

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
      border: '#bfdbfe',
    },
    {
      label: 'Pending Approval',
      value: stats?.pendingApproval || 0,
      icon: Clock,
      color: '#b45309',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      label: 'Confirmed',
      value: stats?.confirmedBookings || 0,
      icon: CheckCircle,
      color: '#059669',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      {metrics.map(({ label, value, icon: Icon, color, bg, border }) => (
        <div
          key={label}
          style={{
            background: bg,
            border: `1px solid ${border}`,
            padding: '20px 24px',
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background icon */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 14,
              opacity: 0.12,
            }}
          >
            <Icon size={44} color={color} />
          </div>

          {/* Label row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '10px',
            }}
          >
            <Icon size={13} color={color} />
            <span
              style={{
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color,
                fontWeight: 700,
              }}
            >
              {label}
            </span>
          </div>

          {/* Value */}
          <div
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1,
            }}
          >
            {loading ? (
              <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>—</span>
            ) : (
              value
            )}
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
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          color: '#94a3b8',
          fontSize: '0.9rem',
        }}
      >
        Loading pending requests…
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div
        style={{
          padding: '48px 40px',
          textAlign: 'center',
          background: '#f8fafc',
          borderRadius: '10px',
          border: '1px dashed #e2e8f0',
        }}
      >
        <CheckCircle
          size={40}
          color="#10b981"
          style={{ marginBottom: '12px', opacity: 0.7 }}
        />
        <h3
          style={{
            margin: '0 0 6px 0',
            fontSize: '0.95rem',
            color: '#0f172a',
            fontWeight: 600,
          }}
        >
          All clear — no pending requests
        </h3>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
          All reservation requests have been processed.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.85rem',
        }}
      >
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
            {['Guest', 'Check-In', 'Check-Out', 'Adults / Children', 'Actions'].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 16px',
                    textAlign: h === 'Actions' ? 'center' : 'left',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr
              key={request.id}
              style={{ borderBottom: '1px solid #f1f5f9' }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#fafafa')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <td
                style={{
                  padding: '13px 16px',
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                {request.guest_full_name}
              </td>
              <td style={{ padding: '13px 16px', color: '#475569' }}>
                {request.check_in_date}
              </td>
              <td style={{ padding: '13px 16px', color: '#475569' }}>
                {request.check_out_date}
              </td>
              <td
                style={{
                  padding: '13px 16px',
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                {request.adults} / {request.children}
              </td>
              <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'center',
                  }}
                >
                  {/* View */}
                  <button
                    onClick={() =>
                      alert(`Details for ${request.guest_full_name} — TBD`)
                    }
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: '#475569',
                      transition: 'all 0.15s',
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
                    <Eye size={13} />
                  </button>

                  {/* Approve */}
                  <button
                    onClick={() => onApprove(request.id)}
                    style={{
                      background: '#10b981',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: '#fff',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#059669';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#10b981';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <CheckCircle size={13} /> Approve
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// 📅 SECTION 3: ALL RESERVATIONS LIST
// =====================================================

const PAYMENT_FILTER_OPTIONS = [
  { key: 'all', label: 'All Payments' },
  { key: 'pending', label: 'No DP' },
  { key: 'confirmed', label: 'DP Paid' },
  { key: 'completed', label: 'All Paid' },
];

const STATUS_FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked In' },
  { key: 'checked_out', label: 'Checked Out' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TIMEFRAME_FILTER_OPTIONS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

const PAYMENT_CONFIG = {
  pending: { bg: '#fef3c7', color: '#b45309', label: 'No DP' },
  confirmed: { bg: '#dbeafe', color: '#1e40af', label: 'DP Paid' },
  completed: { bg: '#d1fae5', color: '#065f46', label: 'All Paid' },
};

function AllReservationsTable({ reservations, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);

  const filtered = useMemo(() => {
    return reservations.filter((res) => {
      if (
        searchTerm &&
        !res.guest_full_name?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !res.villa_names?.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (paymentFilter !== 'all' && res.payment_status !== paymentFilter)
        return false;
      if (statusFilter !== 'all' && res.status !== statusFilter) return false;

      if (timeframeFilter !== 'all') {
        const checkInDate = new Date(res.check_in_date);
        if (
          timeframeFilter === 'today' &&
          checkInDate.toDateString() !== today.toDateString()
        )
          return false;
        if (
          timeframeFilter === 'month' &&
          (checkInDate < startOfMonth || checkInDate > today)
        )
          return false;
        if (
          timeframeFilter === 'year' &&
          (checkInDate < startOfYear || checkInDate > today)
        )
          return false;
      }
      return true;
    });
  }, [reservations, searchTerm, paymentFilter, statusFilter, timeframeFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

  const hasActiveFilters =
    searchTerm ||
    paymentFilter !== 'all' ||
    statusFilter !== 'all' ||
    timeframeFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setPaymentFilter('all');
    setStatusFilter('all');
    setTimeframeFilter('all');
    setCurrentPage(1);
  };

  const inputBase = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '0.85rem',
    background: '#fff',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'inherit',
  };

  const focusHandlers = {
    onFocus: (e) => {
      e.currentTarget.style.borderColor = '#1e3a8a';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30,58,138,0.08)';
    },
    onBlur: (e) => {
      e.currentTarget.style.borderColor = '#e2e8f0';
      e.currentTarget.style.boxShadow = 'none';
    },
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: '5px',
  };

  return (
    <div>
      {/* ── Filter Bar ──────────────────────────────────────── */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
          gap: '12px',
          alignItems: 'end',
        }}
      >
        {/* Search */}
        <div>
          <label style={labelStyle}>Search</label>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#cbd5e1',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Guest name or villa…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ ...inputBase, paddingLeft: '32px' }}
              {...focusHandlers}
            />
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <label style={labelStyle}>Payment</label>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ ...inputBase, cursor: 'pointer' }}
            {...focusHandlers}
          >
            {PAYMENT_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reservation Status */}
        <div>
          <label style={labelStyle}>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ ...inputBase, cursor: 'pointer' }}
            {...focusHandlers}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label style={labelStyle}>Timeframe</label>
          <select
            value={timeframeFilter}
            onChange={(e) => {
              setTimeframeFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ ...inputBase, cursor: 'pointer' }}
            {...focusHandlers}
          >
            {TIMEFRAME_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Clear */}
        {hasActiveFilters ? (
          <button
            onClick={clearFilters}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2';
              e.currentTarget.style.color = '#991b1b';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.color = '#64748b';
              e.currentTarget.style.borderColor = '#e2e8f0';
            }}
          >
            <X size={12} /> Clear
          </button>
        ) : (
          <div /> /* placeholder to keep grid columns */
        )}
      </div>

      {/* Result count */}
      <div
        style={{
          marginBottom: '10px',
          fontSize: '0.78rem',
          color: '#94a3b8',
          paddingLeft: '2px',
        }}
      >
        {filtered.length === 0
          ? 'No results'
          : `Showing ${startIdx + 1}–${Math.min(
              startIdx + itemsPerPage,
              filtered.length
            )} of ${filtered.length} reservation${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '0.9rem',
          }}
        >
          Loading reservations…
        </div>
      ) : paginatedData.length === 0 ? (
        <div
          style={{
            padding: '48px 40px',
            textAlign: 'center',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px dashed #e2e8f0',
          }}
        >
          <Filter
            size={36}
            color="#cbd5e1"
            style={{ marginBottom: '12px' }}
          />
          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '0.95rem',
              color: '#0f172a',
              fontWeight: 600,
            }}
          >
            No reservations found
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            Try adjusting your filters or search term.
          </p>
        </div>
      ) : (
        <div
          style={{
            overflowX: 'auto',
            background: '#fff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0',
                }}
              >
                {[
                  { label: 'Guest', align: 'left' },
                  { label: 'Villas', align: 'left' },
                  { label: 'Check-In', align: 'left' },
                  { label: 'Check-Out', align: 'left' },
                  { label: 'Amount', align: 'right' },
                  { label: 'Payment', align: 'center' },
                  { label: 'Status', align: 'center' },
                  { label: 'Action', align: 'center' },
                ].map(({ label, align }) => (
                  <th
                    key={label}
                    style={{
                      padding: '10px 16px',
                      textAlign: align,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((res) => {
                const pmtCfg =
                  PAYMENT_CONFIG[res.payment_status] || PAYMENT_CONFIG.pending;
                return (
                  <tr
                    key={res.id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = '#fafafa')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <td
                      style={{
                        padding: '13px 16px',
                        fontWeight: 600,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {res.guest_full_name}
                    </td>
                    <td
                      style={{
                        padding: '13px 16px',
                        color: '#475569',
                        maxWidth: '160px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {res.villa_names || '—'}
                    </td>
                    <td
                      style={{
                        padding: '13px 16px',
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {res.check_in_date}
                    </td>
                    <td
                      style={{
                        padding: '13px 16px',
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {res.check_out_date}
                    </td>
                    <td
                      style={{
                        padding: '13px 16px',
                        fontWeight: 600,
                        color: '#0f172a',
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Rp {res.total_price?.toLocaleString() || '0'}
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          background: pmtCfg.bg,
                          color: pmtCfg.color,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pmtCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <Badge type="status" value={res.status} />
                    </td>
                    <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() =>
                          alert(`Actions for ${res.guest_full_name} — TBD`)
                        }
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: '#475569',
                          transition: 'all 0.15s',
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
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            marginTop: '20px',
          }}
        >
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              opacity: currentPage === 1 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={15} />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(
              (p) =>
                Math.abs(p - currentPage) <= 1 ||
                p === 1 ||
                p === totalPages
            )
            .map((page, idx, arr) => {
              const showEllipsis = idx > 0 && arr[idx - 1] !== page - 1;
              return (
                <React.Fragment key={page}>
                  {showEllipsis && (
                    <span style={{ color: '#cbd5e1', fontSize: '0.85rem', padding: '0 2px' }}>
                      …
                    </span>
                  )}
                  <button
                    onClick={() => setCurrentPage(page)}
                    style={{
                      background: currentPage === page ? '#1e3a8a' : '#fff',
                      color: currentPage === page ? '#fff' : '#475569',
                      border: `1px solid ${currentPage === page ? '#1e3a8a' : '#e2e8f0'}`,
                      borderRadius: '6px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: currentPage === page ? 700 : 500,
                      minWidth: '32px',
                    }}
                  >
                    {page}
                  </button>
                </React.Fragment>
              );
            })}

          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '6px 8px',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              opacity: currentPage === totalPages ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={15} />
          </button>

          <span
            style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              marginLeft: '8px',
            }}
          >
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const bookingsRes = await fetch('http://localhost:5000/api/bookings');
        if (!bookingsRes.ok) throw new Error('Failed to fetch bookings');
        const bookingsData = await bookingsRes.json();

        const pending = bookingsData
          .filter((b) => b.status === 'pending')
          .map((b) => ({
            ...b,
            guest_full_name: b.guests?.full_name || 'Unknown Guest',
            adults: parseInt(
              b.notes?.match(/Adults:\s*(\d+)/)?.[1] || '0'
            ),
            children: parseInt(
              b.notes?.match(/Children:\s*(\d+)/)?.[1] || '0'
            ),
          }));

        const approved = bookingsData
          .filter((b) => b.status !== 'pending')
          .map((b) => ({
            ...b,
            guest_full_name: b.guests?.full_name || 'Unknown Guest',
            payment_status: b.payment_status || 'pending',
          }));

        setPendingRequests(pending);
        setAllReservations(approved);
        setStats({
          totalBookings: bookingsData.length,
          pendingApproval: pending.length,
          confirmedBookings: approved.filter((b) => b.status === 'confirmed')
            .length,
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

  const handleApproveRequest = async (requestId) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/bookings/${requestId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        }
      );
      if (!response.ok) throw new Error('Failed to approve request');

      const approvedRequest = pendingRequests.find((r) => r.id === requestId);
      if (approvedRequest) {
        setPendingRequests(pendingRequests.filter((r) => r.id !== requestId));
        setAllReservations([
          ...allReservations,
          {
            ...approvedRequest,
            status: 'confirmed',
            payment_status: 'pending',
          },
        ]);
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

  const sectionCard = {
    background: '#fff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
  };

  const sectionHeader = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px 20px',
    borderBottom: '1px solid #f1f5f9',
    background: '#fafafa',
  };

  const sectionTitle = {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#0f172a',
  };

  const sectionCount = {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8',
    background: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '20px',
  };

  return (
    <div
      style={{
        padding: '28px 32px',
        boxSizing: 'border-box',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
     

      {/* Stats */}
      <DashboardMetrics stats={stats} loading={statsLoading} />

      {/* Pending Requests */}
      <div style={{ ...sectionCard, marginBottom: '20px' }}>
        <div style={sectionHeader}>
          <Clock size={16} color="#b45309" />
          <h3 style={sectionTitle}>Pending Requests</h3>
          {pendingRequests.length > 0 && (
            <span
              style={{
                ...sectionCount,
                background: '#fef3c7',
                color: '#b45309',
              }}
            >
              {pendingRequests.length} awaiting
            </span>
          )}
        </div>
        <div style={{ padding: '0' }}>
          <PendingRequestsTable
            requests={pendingRequests}
            onApprove={handleApproveRequest}
            loading={loading}
          />
        </div>
      </div>

      {/* All Reservations */}
      <div style={sectionCard}>
        <div style={sectionHeader}>
          <Calendar size={16} color="#1e3a8a" />
          <h3 style={sectionTitle}>All Reservations</h3>
          <span style={sectionCount}>{allReservations.length} total</span>
        </div>
        <div style={{ padding: '20px' }}>
          <AllReservationsTable
            reservations={allReservations}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

export default ReservationPage;
