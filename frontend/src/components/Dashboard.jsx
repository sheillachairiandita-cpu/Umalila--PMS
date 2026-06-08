/**
 * Dashboard.jsx
 * Reporting & Insights Dashboard — Umalila PMS
 * Tabs: Financial Overview | Hospitality KPIs
 * Global filters: date range + villa selector (fixed header)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, Users, BedDouble,
  Coffee, Calendar, ArrowUpRight, ArrowDownRight, BarChart2,
  Activity, Percent, Moon, ChevronDown, RefreshCw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function formatRp(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  return `Rp ${n.toLocaleString('id-ID')}`;
}
function formatPct(v) { return `${(Number(v) || 0).toFixed(1)}%`; }
function formatNum(v) { return (Number(v) || 0).toLocaleString(); }

function pct(a, b) { return b ? ((a / b) * 100).toFixed(1) : '0.0'; }

function getISODate(d) { return d.toISOString().split('T')[0]; }

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOf(unit, ref = new Date()) {
  const d = new Date(ref);
  if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); }
  if (unit === 'month') { d.setDate(1); d.setHours(0,0,0,0); }
  if (unit === 'year') { d.setMonth(0,1); d.setHours(0,0,0,0); }
  return d;
}

const RANGE_PRESETS = [
  { key: '7d',   label: 'Last 7 Days',   days: 7  },
  { key: '30d',  label: 'Last 30 Days',  days: 30 },
  { key: '90d',  label: 'Last 90 Days',  days: 90 },
  { key: 'mtd',  label: 'Month-to-Date', days: null },
  { key: 'ytd',  label: 'Year-to-Date',  days: null },
  { key: 'custom', label: 'Custom Range', days: null },
];

function getRangeDates(preset) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let start;
  if (preset === 'mtd') start = startOf('month');
  else if (preset === 'ytd') start = startOf('year');
  else {
    const p = RANGE_PRESETS.find(r => r.key === preset);
    start = addDays(new Date(), -(p?.days || 30));
    start.setHours(0,0,0,0);
  }
  return { start, end: today };
}

// ─────────────────────────────────────────────────────────────
// DATA PROCESSING
// ─────────────────────────────────────────────────────────────
function processFinancialData(incomeRows, bookings, rangeStart, rangeEnd, villaFilter) {
  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= rangeStart && d <= rangeEnd;
  };

  let rows = incomeRows || [];
  if (villaFilter !== 'all') {
    rows = rows.filter(r => (r.villaNames || '').includes(villaFilter));
  }
  const filtered = rows.filter(r => inRange(r.checkIn));

  const totalRevenue = filtered.reduce((s, r) => s + (r.total || 0), 0);
  const totalCollected = filtered.reduce((s, r) => s + (r.amountPaid || 0), 0);
  const totalBalance = filtered.reduce((s, r) => s + (r.balanceDue || 0), 0);
  const totalAccom = filtered.reduce((s, r) => s + (r.totalAccommodation || 0), 0);
  const totalFB = filtered.reduce((s, r) => s + (r.totalMenuItems || 0), 0);
  const totalAddons = filtered.reduce((s, r) => s + (r.totalAddons || 0), 0);

  // Daily revenue trend
  const dayMap = {};
  filtered.forEach(r => {
    const day = (r.checkIn || '').slice(0, 10);
    if (!day) return;
    dayMap[day] = (dayMap[day] || 0) + (r.total || 0);
  });

  const days = [];
  const cur = new Date(rangeStart);
  const end = new Date(rangeEnd);
  while (cur <= end) {
    const key = getISODate(cur);
    days.push({ date: key, value: dayMap[key] || 0 });
    cur.setDate(cur.getDate() + 1);
  }

  const maxDayVal = Math.max(...days.map(d => d.value), 1);

  // Payment status breakdown
  const paid = filtered.filter(r => r.paymentStatus === 'complete').length;
  const partial = filtered.filter(r => r.paymentStatus === 'partial').length;
  const pending = filtered.filter(r => r.paymentStatus === 'pending').length;

  return {
    totalRevenue, totalCollected, totalBalance,
    totalAccom, totalFB, totalAddons,
    bookingCount: filtered.length,
    days, maxDayVal,
    payBreakdown: { paid, partial, pending, total: filtered.length },
    collectionRate: totalRevenue ? (totalCollected / totalRevenue) * 100 : 0,
  };
}

function processHospitalityData(bookings, incomeRows, rangeStart, rangeEnd, villaFilter, allVillas) {
  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= rangeStart && d <= rangeEnd;
  };

  let bks = (bookings || []).filter(b => b.status !== 'cancelled');
  if (villaFilter !== 'all') {
    bks = bks.filter(b => (b.villa_names || '').includes(villaFilter));
  }
  const filtered = bks.filter(b => inRange(b.check_in_date));

  const nights = filtered.reduce((s, b) => {
    const cin = new Date(b.check_in_date);
    const cout = new Date(b.check_out_date);
    return s + Math.max(0, Math.ceil((cout - cin) / 86400000));
  }, 0);

  const guests = filtered.reduce((s, b) => s + (b.total_guests || 0), 0);
  const breakfast = filtered.reduce((s, b) => s + (b.total_breakfast || 0), 0);

  // OCC: nights booked / total possible nights
  const rangeDays = Math.max(1, Math.ceil((rangeEnd - rangeStart) / 86400000));
  const villaCount = villaFilter === 'all'
    ? (allVillas?.length || 1)
    : 1;
  const maxPossibleNights = rangeDays * villaCount;
  const occupancyRate = maxPossibleNights ? (nights / maxPossibleNights) * 100 : 0;

  // ADR: average daily rate
  const totalRevenue = incomeRows
    ?.filter(r => inRange(r.checkIn) && (villaFilter === 'all' || (r.villaNames || '').includes(villaFilter)))
    ?.reduce((s, r) => s + (r.totalAccommodation || 0), 0) || 0;
  const adr = nights ? totalRevenue / nights : 0;
  const revpar = maxPossibleNights ? totalRevenue / maxPossibleNights : 0;

  // Stay duration distribution
  const durationMap = { '1n': 0, '2-3n': 0, '4-7n': 0, '7n+': 0 };
  filtered.forEach(b => {
    const n = Math.max(0, Math.ceil((new Date(b.check_out_date) - new Date(b.check_in_date)) / 86400000));
    if (n <= 1) durationMap['1n']++;
    else if (n <= 3) durationMap['2-3n']++;
    else if (n <= 7) durationMap['4-7n']++;
    else durationMap['7n+']++;
  });

  // Monthly booking trend
  const monthMap = {};
  filtered.forEach(b => {
    const m = (b.check_in_date || '').slice(0, 7);
    if (!m) return;
    monthMap[m] = (monthMap[m] || 0) + 1;
  });

  const months = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const maxMonth = Math.max(...months.map(m => m.count), 1);

  // Status breakdown
  const confirmed = bks.filter(b => inRange(b.check_in_date) && b.status === 'confirmed').length;
  const checkedIn = bks.filter(b => inRange(b.check_in_date) && b.status === 'checked_in').length;
  const checkedOut = bks.filter(b => inRange(b.check_in_date) && b.status === 'checked_out').length;

  // Avg guests per booking
  const avgGuests = filtered.length ? (guests / filtered.length).toFixed(1) : '0';
  const avgStay = filtered.length ? (nights / filtered.length).toFixed(1) : '0';

  return {
    totalBookings: filtered.length,
    totalNights: nights,
    totalGuests: guests,
    totalBreakfast: breakfast,
    occupancyRate,
    adr, revpar,
    durationMap,
    months, maxMonth,
    statusBreakdown: { confirmed, checkedIn, checkedOut },
    avgGuests, avgStay,
  };
}

// ─────────────────────────────────────────────────────────────
// MICRO CHART COMPONENTS
// ─────────────────────────────────────────────────────────────

// Sparkline bar chart (inline)
function SparkBars({ data, maxVal, color = '#1e3a8a', height = 40 }) {
  if (!data?.length) return null;
  const display = data.slice(-30); // last 30 points
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height, width: '100%' }}>
      {display.map((d, i) => {
        const h = maxVal ? Math.max(2, (d.value / maxVal) * height) : 2;
        return (
          <div
            key={i}
            title={`${d.date}: ${formatRp(d.value)}`}
            style={{
              flex: 1,
              height: `${h}px`,
              background: d.value > 0 ? color : '#e2e8f0',
              borderRadius: '1px 1px 0 0',
              transition: 'height 0.4s ease',
              cursor: 'pointer',
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

// Donut chart (SVG)
function DonutChart({ segments, size = 80, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  const total = segments.reduce((s, sg) => s + sg.value, 0) || 1;

  let offset = 0;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {segments.map((sg, i) => {
        const dash = (sg.value / total) * circ;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={sg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset * circ / total}
            style={{ transition: 'all 0.6s ease' }}
          />
        );
        offset += sg.value;
        return el;
      })}
    </svg>
  );
}

// Horizontal bar (progress-style)
function HBar({ label, value, max, color, formatFn }) {
  const pct = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {formatFn ? formatFn(value) : value}
        </span>
      </div>
      <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: '3px',
            transition: 'width 0.7s ease',
          }}
        />
      </div>
    </div>
  );
}

// Month bar chart
function MonthBars({ months, maxMonth }) {
  if (!months?.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: 'var(--text-light)', fontSize: '0.78rem' }}>
      No data in range
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: 80, paddingTop: '8px' }}>
      {months.map((m, i) => {
        const h = maxMonth ? Math.max(4, (m.count / maxMonth) * 72) : 4;
        const shortMonth = m.month.slice(5); // MM
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const label = monthNames[parseInt(shortMonth, 10) - 1] || shortMonth;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              title={`${m.month}: ${m.count} bookings`}
              style={{
                width: '100%',
                height: `${h}px`,
                background: 'var(--navy)',
                borderRadius: '3px 3px 0 0',
                opacity: 0.75,
                transition: 'height 0.5s ease',
              }}
            />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-light)', fontWeight: 600 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, trend, color = 'var(--navy)', mono = false }) {
  const up = trend > 0;
  return (
    <div className="dash-kpi-card">
      <div className="dash-kpi-icon" style={{ background: `${color}12`, color }}>
        <Icon size={16} />
      </div>
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-value" style={{ fontFamily: mono ? 'var(--font-mono)' : undefined }}>
        {value}
      </div>
      {(sub || trend !== undefined) && (
        <div className="dash-kpi-sub">
          {trend !== undefined && (
            <span style={{ color: up ? 'var(--green)' : 'var(--red)', display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', fontWeight: 700 }}>
              {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <span>{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GLOBAL FILTER BAR
// ─────────────────────────────────────────────────────────────
function GlobalFilterBar({ preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, villaFilter, setVillaFilter, villas, loading, onRefresh }) {
  return (
    <div className="dash-filter-bar">
      <div className="dash-filter-group">
        <label className="dash-filter-label">TIMEFRAME</label>
        <div className="dash-preset-pills">
          {RANGE_PRESETS.filter(r => r.key !== 'custom').map(r => (
            <button
              key={r.key}
              onClick={() => setPreset(r.key)}
              className={`dash-pill ${preset === r.key ? 'dash-pill--active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-filter-group">
        <label className="dash-filter-label">CUSTOM RANGE</label>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            type="date"
            className="dash-date-input"
            value={customStart}
            onChange={e => { setCustomStart(e.target.value); setPreset('custom'); }}
          />
          <span style={{ color: 'var(--text-light)', fontSize: '0.72rem' }}>→</span>
          <input
            type="date"
            className="dash-date-input"
            value={customEnd}
            onChange={e => { setCustomEnd(e.target.value); setPreset('custom'); }}
          />
        </div>
      </div>

      <div className="dash-filter-group">
        <label className="dash-filter-label">PROPERTY</label>
        <div className="dash-select-wrap">
          <select
            className="dash-select"
            value={villaFilter}
            onChange={e => setVillaFilter(e.target.value)}
          >
            <option value="all">All Properties</option>
            {(villas || []).map(v => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="dash-select-chevron" />
        </div>
      </div>

      <button
        className="dash-refresh-btn"
        onClick={onRefresh}
        title="Refresh data"
      >
        <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FINANCIAL TAB
// ─────────────────────────────────────────────────────────────
function FinancialTab({ data, loading }) {
  if (loading) return <div className="dash-loading">Loading financial data…</div>;
  if (!data) return null;

  const { totalRevenue, totalCollected, totalBalance, totalAccom, totalFB, totalAddons,
    bookingCount, days, maxDayVal, payBreakdown, collectionRate } = data;

  const revenueSegments = [
    { label: 'Accommodation', value: totalAccom, color: 'var(--navy)' },
    { label: 'F&B', value: totalFB, color: '#059669' },
    { label: 'Add-ons', value: totalAddons, color: '#7c3aed' },
  ].filter(s => s.value > 0);

  const paySegments = [
    { label: 'Paid', value: payBreakdown.paid, color: '#059669' },
    { label: 'Partial', value: payBreakdown.partial, color: '#d97706' },
    { label: 'Pending', value: payBreakdown.pending, color: '#94a3b8' },
  ].filter(s => s.value > 0);

  return (
    <div className="dash-tab-content">
      {/* Row 1: Primary KPIs */}
      <div className="dash-kpi-grid">
        <KpiCard icon={DollarSign} label="Gross Revenue" value={formatRp(totalRevenue)} color="var(--navy)" mono />
        <KpiCard icon={TrendingUp} label="Amount Collected" value={formatRp(totalCollected)} color="#059669" mono />
        <KpiCard icon={TrendingDown} label="Outstanding" value={formatRp(totalBalance)} color="#dc2626" mono />
        <KpiCard icon={Percent} label="Collection Rate" value={formatPct(collectionRate)} color="#7c3aed" sub="of gross revenue" />
        <KpiCard icon={Calendar} label="Bookings in Period" value={formatNum(bookingCount)} color="var(--navy)" />
        <KpiCard icon={DollarSign} label="Avg. Revenue / Booking" value={bookingCount ? formatRp(totalRevenue / bookingCount) : 'Rp 0'} color="#d97706" mono />
      </div>

      {/* Row 2: Charts */}
      <div className="dash-chart-row">
        {/* Revenue trend */}
        <div className="dash-chart-card dash-chart-card--wide">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Revenue Trend</span>
            <span className="dash-chart-sub">{days.length} day window</span>
          </div>
          <div className="dash-sparkline-wrap">
            <SparkBars data={days} maxVal={maxDayVal} color="var(--navy)" height={72} />
          </div>
          <div className="dash-sparkline-labels">
            <span>{days[0]?.date}</span>
            <span>{days[days.length - 1]?.date}</span>
          </div>
        </div>

        {/* Revenue mix donut */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Revenue Mix</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
            <DonutChart segments={revenueSegments.length ? revenueSegments : [{ value: 1, color: '#e2e8f0' }]} size={90} strokeWidth={12} />
            <div style={{ flex: 1 }}>
              {revenueSegments.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                    {pct(s.value, totalRevenue)}%
                  </span>
                </div>
              ))}
              {revenueSegments.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>No revenue data</span>
              )}
            </div>
          </div>
        </div>

        {/* Payment status donut */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Payment Status</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '8px' }}>
            <DonutChart segments={paySegments.length ? paySegments : [{ value: 1, color: '#e2e8f0' }]} size={90} strokeWidth={12} />
            <div style={{ flex: 1 }}>
              {[
                { label: 'Fully Paid', value: payBreakdown.paid, color: '#059669' },
                { label: 'Partial (DP)', value: payBreakdown.partial, color: '#d97706' },
                { label: 'Unpaid', value: payBreakdown.pending, color: '#94a3b8' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: 1 }}>{s.label}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Revenue breakdown bars */}
      <div className="dash-chart-card" style={{ gridColumn: '1 / -1' }}>
        <div className="dash-chart-header">
          <span className="dash-chart-title">Revenue Breakdown</span>
        </div>
        <div style={{ paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
          <HBar label="Accommodation" value={totalAccom} max={totalRevenue} color="var(--navy)" formatFn={formatRp} />
          <HBar label="Food & Beverage" value={totalFB} max={totalRevenue} color="#059669" formatFn={formatRp} />
          <HBar label="Add-ons & Services" value={totalAddons} max={totalRevenue} color="#7c3aed" formatFn={formatRp} />
          <HBar label="Collection Rate" value={collectionRate} max={100} color="#d97706" formatFn={v => `${v.toFixed(1)}%`} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HOSPITALITY KPI TAB
// ─────────────────────────────────────────────────────────────
function HospitalityTab({ data, loading }) {
  if (loading) return <div className="dash-loading">Loading hospitality data…</div>;
  if (!data) return null;

  const {
    totalBookings, totalNights, totalGuests, totalBreakfast,
    occupancyRate, adr, revpar, durationMap, months, maxMonth,
    statusBreakdown, avgGuests, avgStay,
  } = data;

  const durationLabels = { '1n': '1 Night', '2-3n': '2–3 Nights', '4-7n': '4–7 Nights', '7n+': '7+ Nights' };
  const maxDur = Math.max(...Object.values(durationMap), 1);

  const occColor = occupancyRate >= 80 ? '#059669' : occupancyRate >= 50 ? '#d97706' : '#dc2626';

  return (
    <div className="dash-tab-content">
      {/* Row 1: Core hospitality KPIs */}
      <div className="dash-kpi-grid">
        <KpiCard icon={BedDouble} label="Occupancy Rate" value={formatPct(occupancyRate)} color={occColor} sub="of available room-nights" />
        <KpiCard icon={DollarSign} label="ADR" value={formatRp(adr)} color="var(--navy)" sub="Avg. Daily Rate" mono />
        <KpiCard icon={BarChart2} label="RevPAR" value={formatRp(revpar)} color="#7c3aed" sub="Rev. per Available Room" mono />
        <KpiCard icon={Calendar} label="Total Bookings" value={formatNum(totalBookings)} color="var(--navy)" />
        <KpiCard icon={Moon} label="Total Room Nights" value={formatNum(totalNights)} color="#d97706" sub={`avg ${avgStay}n/stay`} />
        <KpiCard icon={Users} label="Total Guests" value={formatNum(totalGuests)} color="#059669" sub={`avg ${avgGuests} guests/booking`} />
      </div>

      {/* Row 2: Booking trend + Occupancy gauge */}
      <div className="dash-chart-row">
        {/* Monthly bookings bar chart */}
        <div className="dash-chart-card dash-chart-card--wide">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Booking Volume by Month</span>
            <span className="dash-chart-sub">{totalBookings} total bookings</span>
          </div>
          <MonthBars months={months} maxMonth={maxMonth} />
        </div>

        {/* Occupancy gauge */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Occupancy</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '8px', gap: '8px' }}>
            <div style={{ position: 'relative', width: 90, height: 90 }}>
              <DonutChart
                segments={[
                  { value: Math.min(occupancyRate, 100), color: occColor },
                  { value: Math.max(0, 100 - occupancyRate), color: '#f1f5f9' },
                ]}
                size={90}
                strokeWidth={12}
              />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: occColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                  {occupancyRate.toFixed(0)}%
                </span>
                <span style={{ fontSize: '0.55rem', color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase' }}>OCC</span>
              </div>
            </div>
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Booked Nights</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{totalNights}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>Avg Stay</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text)' }}>{avgStay}n</span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking status */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Booking Status</span>
          </div>
          <div style={{ paddingTop: '8px' }}>
            {[
              { label: 'Confirmed', value: statusBreakdown.confirmed, color: '#059669' },
              { label: 'Checked In', value: statusBreakdown.checkedIn, color: 'var(--navy)' },
              { label: 'Checked Out', value: statusBreakdown.checkedOut, color: '#64748b' },
            ].map((s, i) => (
              <HBar key={i} label={s.label} value={s.value} max={totalBookings} color={s.color} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Stay duration + Breakfast */}
      <div className="dash-chart-row">
        <div className="dash-chart-card dash-chart-card--wide">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Stay Duration Distribution</span>
          </div>
          <div style={{ paddingTop: '12px' }}>
            {Object.entries(durationMap).map(([key, val]) => (
              <HBar
                key={key}
                label={durationLabels[key]}
                value={val}
                max={maxDur}
                color="var(--navy)"
              />
            ))}
          </div>
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Guest Services</span>
          </div>
          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="dash-stat-pill" style={{ background: '#ecfdf5' }}>
              <Coffee size={16} color="#059669" />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{formatNum(totalBreakfast)}</div>
                <div style={{ fontSize: '0.65rem', color: '#047857', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Breakfasts</div>
              </div>
            </div>
            <div className="dash-stat-pill" style={{ background: '#f0f9ff' }}>
              <Users size={16} color="var(--navy)" />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{avgGuests}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--navy)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Guests / Stay</div>
              </div>
            </div>
            <div className="dash-stat-pill" style={{ background: '#fdf4ff' }}>
              <Activity size={16} color="#7c3aed" />
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{totalBookings}</div>
                <div style={{ fontSize: '0.65rem', color: '#6d28d9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Reservations</div>
              </div>
            </div>
          </div>
        </div>

        {/* ADR / RevPAR summary */}
        <div className="dash-chart-card">
          <div className="dash-chart-header">
            <span className="dash-chart-title">Rate Intelligence</span>
          </div>
          <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>ADR (Avg. Daily Rate)</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--navy)', fontFamily: 'var(--font-mono)' }}>{formatRp(adr)}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>per occupied room night</div>
            </div>
            <div style={{ height: '1px', background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>RevPAR</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#7c3aed', fontFamily: 'var(--font-mono)' }}>{formatRp(revpar)}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-light)' }}>per available room night</div>
            </div>
            <div style={{ height: '1px', background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>Room Nights Sold</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706', fontFamily: 'var(--font-mono)' }}>{formatNum(totalNights)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────
function Dashboard() {
  const [tab, setTab] = useState('financial');
  const [preset, setPreset] = useState('30d');
  const [customStart, setCustomStart] = useState(getISODate(addDays(new Date(), -30)));
  const [customEnd, setCustomEnd] = useState(getISODate(new Date()));
  const [villaFilter, setVillaFilter] = useState('all');

  const [villas, setVillas] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [villasRes, bookingsRes, incomeRes] = await Promise.all([
        fetch('/api/villas'),
        fetch('/api/bookings'),
        fetch('/api/financial/income'),
      ]);
      if (villasRes.ok)   setVillas(await villasRes.json());
      if (bookingsRes.ok) setBookings(await bookingsRes.json());
      if (incomeRes.ok)   setIncomeRows(await incomeRes.json());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Resolve date range
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (preset === 'custom') {
      return {
        rangeStart: customStart ? new Date(customStart) : addDays(new Date(), -30),
        rangeEnd:   customEnd   ? (() => { const d = new Date(customEnd); d.setHours(23,59,59,999); return d; })() : new Date(),
      };
    }
    const { start, end } = getRangeDates(preset);
    return { rangeStart: start, rangeEnd: end };
  }, [preset, customStart, customEnd]);

  const financialData = useMemo(
    () => processFinancialData(incomeRows, bookings, rangeStart, rangeEnd, villaFilter),
    [incomeRows, bookings, rangeStart, rangeEnd, villaFilter]
  );

  const hospitalityData = useMemo(
    () => processHospitalityData(bookings, incomeRows, rangeStart, rangeEnd, villaFilter, villas),
    [bookings, incomeRows, rangeStart, rangeEnd, villaFilter, villas]
  );

  return (
    <div className="dash-page">
      {/* Embedded CSS */}
      <style>{`
        .dash-page {
          padding: var(--page-pad-y) var(--page-pad-x);
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 100vh;
          background: var(--bg);
        }

        .dash-page-header {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin-bottom: 2px;
        }

        .dash-page-title {
          font-size: 1.2rem;
          font-weight: 800;
          color: var(--navy-dark);
          letter-spacing: -0.025em;
          margin: 0;
        }

        .dash-page-sub {
          font-size: 0.72rem;
          color: var(--text-light);
          font-weight: 500;
        }

        /* Filter bar */
        .dash-filter-bar {
          display: flex;
          align-items: flex-end;
          gap: 16px;
          flex-wrap: wrap;
          background: var(--bg-white);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 12px 16px;
          position: sticky;
          top: 0;
          z-index: 40;
          box-shadow: var(--shadow-sm);
        }

        .dash-filter-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dash-filter-label {
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: var(--text-light);
          text-transform: uppercase;
        }

        .dash-preset-pills {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .dash-pill {
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--font-sans);
          white-space: nowrap;
        }

        .dash-pill:hover { border-color: var(--navy); color: var(--navy); }
        .dash-pill--active {
          background: var(--navy);
          color: #fff;
          border-color: var(--navy);
        }

        .dash-date-input {
          padding: 5px 8px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          color: var(--text);
          background: var(--bg-white);
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.15s;
        }
        .dash-date-input:focus { border-color: var(--navy); }

        .dash-select-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .dash-select {
          padding: 5px 28px 5px 10px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 0.78rem;
          color: var(--text);
          background: var(--bg-white);
          font-family: var(--font-sans);
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          min-width: 140px;
        }
        .dash-select:focus { border-color: var(--navy); }

        .dash-select-chevron {
          position: absolute;
          right: 8px;
          color: var(--text-light);
          pointer-events: none;
        }

        .dash-refresh-btn {
          margin-left: auto;
          background: none;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 6px 8px;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          font-family: var(--font-sans);
        }
        .dash-refresh-btn:hover { background: var(--bg-subtle); color: var(--text); }

        /* Tabs */
        .dash-tabs {
          display: flex;
          gap: 2px;
          background: var(--bg-white);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 4px;
          width: fit-content;
        }

        .dash-tab-btn {
          padding: 6px 16px;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
          font-family: var(--font-sans);
          white-space: nowrap;
        }
        .dash-tab-btn:hover { color: var(--text); }
        .dash-tab-btn--active {
          background: var(--navy);
          color: #fff;
        }

        /* KPI Grid */
        .dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 10px;
        }

        .dash-kpi-card {
          background: var(--bg-white);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 12px 14px;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .dash-kpi-icon {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
          flex-shrink: 0;
        }

        .dash-kpi-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-light);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dash-kpi-value {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .dash-kpi-sub {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.65rem;
          color: var(--text-light);
          font-weight: 500;
          margin-top: 1px;
        }

        /* Chart row */
        .dash-chart-row {
          display: grid;
          grid-template-columns: 1fr 200px 200px;
          gap: 10px;
          align-items: stretch;
        }

        .dash-chart-card {
          background: var(--bg-white);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 14px 16px;
          box-shadow: var(--shadow-sm);
        }

        .dash-chart-card--wide {
          grid-column: span 1;
        }

        .dash-chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }

        .dash-chart-title {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.01em;
        }

        .dash-chart-sub {
          font-size: 0.65rem;
          color: var(--text-light);
          font-weight: 500;
        }

        .dash-sparkline-wrap {
          padding: 12px 0 4px;
        }

        .dash-sparkline-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.6rem;
          color: var(--text-light);
          font-family: var(--font-mono);
          font-weight: 500;
          margin-top: 4px;
        }

        .dash-tab-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .dash-loading {
          padding: 48px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .dash-stat-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .dash-chart-row {
            grid-template-columns: 1fr 1fr;
          }
          .dash-chart-card--wide {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 768px) {
          .dash-chart-row {
            grid-template-columns: 1fr;
          }
          .dash-filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .dash-refresh-btn {
            margin-left: 0;
            align-self: flex-start;
          }
        }
      `}</style>

      {/* Global filter bar — sticky */}
      <GlobalFilterBar
        preset={preset}
        setPreset={setPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        villaFilter={villaFilter}
        setVillaFilter={setVillaFilter}
        villas={villas}
        loading={loading}
        onRefresh={fetchAll}
      />

      {/* Tab switcher */}
      <div className="dash-tabs">
        <button
          className={`dash-tab-btn ${tab === 'financial' ? 'dash-tab-btn--active' : ''}`}
          onClick={() => setTab('financial')}
        >
          <DollarSign size={13} />
          Financial Overview
        </button>
        <button
          className={`dash-tab-btn ${tab === 'hospitality' ? 'dash-tab-btn--active' : ''}`}
          onClick={() => setTab('hospitality')}
        >
          <BedDouble size={13} />
          Hospitality KPIs
        </button>
      </div>

      {/* Tab content */}
      {tab === 'financial' && (
        <FinancialTab data={financialData} loading={loading} />
      )}
      {tab === 'hospitality' && (
        <HospitalityTab data={hospitalityData} loading={loading} />
      )}
    </div>
  );
}

export default Dashboard;
