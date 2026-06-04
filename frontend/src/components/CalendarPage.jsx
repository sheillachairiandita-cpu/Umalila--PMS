import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

// ── Status → background color (pill fill)
const STATUS_STYLES = {
  pending:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending',     dot: '#eab308' },
  confirmed:   { bg: '#dcfce7', color: '#166534', label: 'Confirmed',   dot: '#22c55e' },
  checked_in:  { bg: '#dbeafe', color: '#1e40af', label: 'Checked In',  dot: '#3b82f6' },
  checked_out: { bg: '#f1f5f9', color: '#475569', label: 'Checked Out', dot: '#94a3b8' },
  cancelled:   { bg: '#fee2e2', color: '#991b1b', label: 'Cancelled',   dot: '#ef4444' },
};

// ── Villa → left border color (assigned dynamically, up to 8 villas)
const VILLA_BORDER_COLORS = [
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#f97316', // orange
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
  '#84cc16', // lime
];

const DAYS_OF_WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ── Date helpers
function ymd(year, month1, day) {
  // month1 is 1-based
  return `${year}-${String(month1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function parseDate(s) { return new Date(s + 'T00:00:00'); }
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function toYMD(date) { return date.toISOString().split('T')[0]; }

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth()); // 0-based
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:5000/api/bookings');
        if (res.ok) setBookings(await res.json());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── Navigation
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  // ── Build villa color map
  const villaNames = [...new Set(
    bookings.flatMap(b => (b.villa_names||'').split(', ').filter(v => v && v !== 'No Units Assigned'))
  )].sort();
  const villaColorMap = {};
  villaNames.forEach((v, i) => { villaColorMap[v] = VILLA_BORDER_COLORS[i % VILLA_BORDER_COLORS.length]; });

  // ── Calendar grid
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const firstWeekday  = new Date(year, month, 1).getDay(); // 0=Sun
  const todayStr      = toYMD(now);
  const month1        = month + 1; // 1-based for ymd()

  // total cells (always 6 rows × 7 cols = 42)
  const TOTAL_CELLS = 42;
  // cells: index → { dateStr | null }
  const cells = Array.from({ length: TOTAL_CELLS }, (_, i) => {
    const dayNum = i - firstWeekday + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return ymd(year, month1, dayNum);
  });

  // ── For each week row, compute spanning bars
  // A booking spans from max(checkIn, rowStart) to min(checkOut-1, rowEnd)
  // check_out_date is exclusive (guest leaves that morning, so last night = checkOut - 1)

  function getWeekRows() {
    const rows = [];
    for (let row = 0; row < 6; row++) {
      const rowCells = cells.slice(row * 7, row * 7 + 7);
      const rowDates = rowCells.map(d => d); // null or dateStr
      // find non-null range
      const validDates = rowDates.filter(Boolean);
      if (validDates.length === 0) { rows.push({ rowDates, bars: [] }); continue; }
      const rowStart = validDates[0];
      const rowEnd   = validDates[validDates.length - 1];

      // find bookings that overlap this row
      // overlap: checkIn <= rowEnd AND checkOut > rowStart
      const overlapping = bookings.filter(b => {
        if (!b.check_in_date || !b.check_out_date) return false;
        return b.check_in_date <= rowEnd && b.check_out_date > rowStart;
      });

      // For each booking, compute col start & span within this row
      // col index: the position in rowCells (0-6)
      const bars = overlapping.map(b => {
        // clamp to row
        const barStart = b.check_in_date > rowStart ? b.check_in_date : rowStart;
        // checkOut is exclusive – last visible day = checkOut - 1 day
        const lastDay  = toYMD(addDays(parseDate(b.check_out_date), -1));
        const barEnd   = lastDay < rowEnd ? lastDay : rowEnd;

        // find column indices
        const colStart = rowDates.indexOf(barStart);
        const colEnd   = rowDates.indexOf(barEnd);
        if (colStart === -1 || colEnd === -1) return null;

        const span = colEnd - colStart + 1;

        // continued from prev row?
        const continuesLeft  = b.check_in_date < rowStart;
        // continues into next row?
        const continuesRight = lastDay > rowEnd;

        // villa color
        const villa = (b.villa_names||'').split(', ')[0];
        const borderColor = villaColorMap[villa] || '#94a3b8';
        const s = STATUS_STYLES[b.status] || STATUS_STYLES.confirmed;

        return { booking: b, colStart, span, continuesLeft, continuesRight, borderColor, style: s };
      }).filter(Boolean);

      // Stack bars so they don't overlap: assign vertical tracks
      // Simple greedy: sort by colStart, assign first free track
      const tracks = []; // tracks[trackIdx] = last colEnd used
      bars.forEach(bar => {
        let t = 0;
        while (tracks[t] !== undefined && tracks[t] >= bar.colStart) t++;
        bar.track = t;
        tracks[t] = bar.colStart + bar.span - 1;
      });

      rows.push({ rowDates, bars });
    }
    return rows;
  }

  const weekRows = getWeekRows();

  // Height per track in the bar area
  const BAR_H     = 22; // px per bar
  const BAR_GAP   = 3;
  const DAY_NUM_H = 28; // px for day number row
  const PADDING   = 4;

  // Compute max tracks per row to set row height
  const rowHeights = weekRows.map(({ bars }) => {
    const maxTrack = bars.length === 0 ? 0 : Math.max(...bars.map(b => b.track)) + 1;
    return DAY_NUM_H + PADDING + maxTrack * (BAR_H + BAR_GAP) + PADDING;
  });

  return (
    <div style={{ padding: '28px 36px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

      {/* ── Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
    
        {/* Month nav + legend row */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={15}/></button>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', minWidth: 150, textAlign: 'center' }}>
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={15}/></button>
          </div>

          {/* Status legend */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(STATUS_STYLES).map(([k, s]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: s.dot }} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Calendar + Unit legend sidebar */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Calendar */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Day-of-week header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {DAYS_OF_WEEK.map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>{d}</div>
            ))}
          </div>

          {/* Rows */}
          {weekRows.map((row, rowIdx) => {
            const rowH = rowHeights[rowIdx];
            return (
              <div key={rowIdx} style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: rowH, borderBottom: rowIdx < 5 ? '1px solid #e2e8f0' : 'none' }}>

                {/* Day cells (background + day numbers) */}
                {row.rowDates.map((dateStr, colIdx) => {
                  const isToday   = dateStr === todayStr;
                  const isOther   = dateStr === null;
                  return (
                    <div key={colIdx} style={{
                      borderRight: colIdx < 6 ? '1px solid #e2e8f0' : 'none',
                      background: isToday ? '#eff6ff' : isOther ? '#fafafa' : '#fff',
                      padding: '6px 8px',
                      minHeight: rowH,
                      boxSizing: 'border-box',
                    }}>
                      {dateStr && (
                        <div style={{
                          width: 24, height: 24,
                          borderRadius: '50%',
                          background: isToday ? '#1e3a8a' : 'transparent',
                          color: isToday ? '#fff' : '#374151',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {parseInt(dateStr.split('-')[2])}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Booking bars — absolutely positioned over the grid */}
                {row.bars.map((bar, bIdx) => {
                  const LEFT_PCT  = (bar.colStart / 7) * 100;
                  const WIDTH_PCT = (bar.span / 7) * 100;
                  const topPx     = DAY_NUM_H + PADDING + bar.track * (BAR_H + BAR_GAP);

                  const rLeft  = bar.continuesLeft  ? 0 : 4;
                  const rRight = bar.continuesRight ? 0 : 4;

                  return (
                    <div
                      key={bIdx}
                      onMouseEnter={e => setTooltip({ booking: bar.booking, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                      style={{
                        position: 'absolute',
                        left:   `calc(${LEFT_PCT}% + ${rLeft}px)`,
                        width:  `calc(${WIDTH_PCT}% - ${rLeft + (bar.continuesRight ? 0 : 4)}px)`,
                        top:    topPx,
                        height: BAR_H,
                        background: bar.style.bg,
                        borderLeft: `3px solid ${bar.borderColor}`,
                        borderRadius: `${bar.continuesLeft ? 0 : 5}px ${bar.continuesRight ? 0 : 5}px ${bar.continuesRight ? 0 : 5}px ${bar.continuesLeft ? 0 : 5}px`,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 6,
                        paddingRight: 4,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        zIndex: 2,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, color: bar.style.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bar.booking.guests?.full_name?.split(' ')[0] || 'Guest'}
                      </span>
                      {bar.span > 1 && (
                        <span style={{ fontSize: '0.62rem', color: bar.style.color, opacity: 0.7, marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          · {(bar.booking.villa_names||'').split(', ')[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ── Unit color legend sidebar */}
        <div style={{ width: 180, flexShrink: 0 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 12 }}>Unit Colors</div>
            {villaNames.length === 0 ? (
              <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>No villas yet</div>
            ) : villaNames.map(v => (
              <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: villaColorMap[v], flexShrink: 0 }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tooltip */}
      {tooltip && (() => {
        const b = tooltip.booking;
        const s = STATUS_STYLES[b.status] || STATUS_STYLES.confirmed;
        const villa = (b.villa_names||'').split(', ')[0];
        const borderColor = villaColorMap[villa] || '#94a3b8';
        return (
          <div style={{
            position: 'fixed', left: tooltip.x + 14, top: tooltip.y + 14,
            background: '#0f172a', color: '#fff', borderRadius: 10,
            padding: '12px 16px', fontSize: '0.78rem', pointerEvents: 'none',
            zIndex: 9999, lineHeight: 1.8, boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            minWidth: 200, borderLeft: `4px solid ${borderColor}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>{b.guests?.full_name}</div>
            <div style={{ opacity: 0.75 }}>{b.villa_names}</div>
            <div style={{ opacity: 0.75 }}>{b.check_in_date} → {b.check_out_date}</div>
            <div style={{ opacity: 0.75 }}>Pax: {b.total_guests} · 🍳 {b.total_breakfast || 0}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ background: s.dot, color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: '0.68rem', fontWeight: 700 }}>
                {s.label}
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const navBtnStyle = {
  width: 32, height: 32, borderRadius: '50%',
  border: '1px solid #e2e8f0', background: '#fff',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#475569', transition: 'all 0.15s',
};
