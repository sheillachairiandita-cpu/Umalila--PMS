// CalendarPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const MONTHS = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

const CalendarPage = () => {
  const today = new Date("2026-06-04"); // System context baseline date
  
  const [villasData, setVillasData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // June (0-indexed)
  const [selectedVillaFilter, setSelectedVillaFilter] = useState("All");

  useEffect(() => {
    const fetchGanttData = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/villas/gantt');
        if (!response.ok) throw new Error('Failed to fetch timeline data.');
        const data = await response.json();
        setVillasData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGanttData();
  }, []);

  // Compute precise days and their day-names for the current selected month
  const daysDataArray = useMemo(() => {
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, i) => {
      const dayNum = i + 1;
      // Generate date object for this specific column
      const dateObj = new Date(currentYear, currentMonth, dayNum);
      // Short day string (e.g., "Mon", "Tue", "Wed")
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      
      return { dayNum, dayName };
    });
  }, [currentYear, currentMonth]);

  const daysInMonth = daysDataArray.length;

  const handleGoToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const displayedVillas = selectedVillaFilter === "All" 
    ? villasData 
    : villasData.filter(v => v.name === selectedVillaFilter);

  const getBookingStyles = (booking) => {
    const start = new Date(booking.checkIn);
    const end = new Date(booking.checkOut);
    
    const viewStart = new Date(currentYear, currentMonth, 1);
    const viewEnd = new Date(currentYear, currentMonth, daysInMonth);

    if (end <= viewStart || start > viewEnd) return null;

    const clampStart = start < viewStart ? 1 : start.getDate();
    const clampEnd = end > viewEnd ? daysInMonth + 1 : end.getDate();
    
    const durationDays = clampEnd - clampStart;

    return {
      gridColumnStart: clampStart,
      gridColumnEnd: `span ${durationDays || 1}`,
      gridRowStart: 1 
    };
  };

  if (loading) return <div className="placeholder-page"><p className="pms-text-muted">Loading timeline view...</p></div>;
  if (error) return <div className="placeholder-page"><p style={{ color: '#b91c1c' }}>Error: {error}</p></div>;

  return (
    <div className="calendar-page">
      {/* Top Filter and Navigation Header Panel */}
      <div className="gantt-control-panel">
        <div className="filter-group-left">
          <button className="today-btn" onClick={handleGoToToday}>Today</button>
          <div className="navigation-controls">
            <button className="cal-nav-btn" onClick={handlePrevMonth}><ChevronLeft size={16} /></button>
            <span className="cal-month-label">{MONTHS[currentMonth]} {currentYear}</span>
            <button className="cal-nav-btn" onClick={handleNextMonth}><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="filter-group-right">
          <div className="select-wrapper">
            <Filter size={14} className="filter-icon" />
            <select 
              value={selectedVillaFilter} 
              onChange={(e) => setSelectedVillaFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All Accommodations</option>
              {villasData.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Matching Reservation Legend Panel */}
      <div className="calendar-legend">
        <div className="legend-item"><span className="legend-dot status-pending" /> Pending</div>
        <div className="legend-item"><span className="legend-dot status-confirmed" /> Confirmed</div>
        <div className="legend-item"><span className="legend-dot status-checkedin" /> Checked In</div>
      </div>

      {/* Main Gantt Scroll Wrapper Frame */}
      <div className="gantt-chart-outer-wrapper">
        <div className="gantt-chart-container">
          
          {/* Header row tracking individual calendar days */}
          <div className="gantt-header-row">
            <div className="gantt-sidebar-cell sticky-column">Accommodations</div>
            <div className="gantt-timeline-grid-header" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(48px, 1fr))` }}>
              {daysDataArray.map(({ dayNum, dayName }) => {
                const isToday = today.getDate() === dayNum && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
                const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                
                return (
                  <div 
                    key={dayNum} 
                    className={`day-header-number ${isToday ? 'current-day' : ''} ${isWeekend ? 'weekend-day' : ''}`}
                  >
                    <span className="day-name-label">{dayName}</span>
                    <span className="day-num-label">{dayNum}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline Row Data Generator */}
          <div className="gantt-body">
            {displayedVillas.map(villa => (
              <div key={villa.id} className="gantt-row">
                <div className="gantt-sidebar-cell label-bold sticky-column">{villa.name}</div>
                
                <div className="gantt-timeline-row-wrapper">
                  {/* Background Columns Track Guide */}
                  <div className="gantt-background-grid" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(48px, 1fr))` }}>
                    {daysDataArray.map(({ dayNum, dayName }) => {
                      const isWeekend = dayName === 'Sat' || dayName === 'Sun';
                      return (
                        <div 
                          key={dayNum} 
                          className={`grid-column-guide ${isWeekend ? 'weekend-column' : ''}`} 
                        />
                      );
                    })}
                  </div>

                  {/* Booking Blocks Overlay Layer */}
                  <div className="gantt-bookings-overlay" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(48px, 1fr))` }}>
                    {villa.bookings.map(booking => {
                      const gridSpanStyles = getBookingStyles(booking);
                      if (!gridSpanStyles) return null;

                      const cleanStatus = booking.status.toLowerCase().replace(/\s+/g, '');

                      return (
                        <div 
                          key={booking.id} 
                          className={`gantt-booking-bar status-${cleanStatus}`} 
                          style={gridSpanStyles}
                          title={`${booking.guest} (${booking.checkIn} to ${booking.checkOut})`}
                        >
                          <span className="booking-bar-text">{booking.guest}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

export default CalendarPage;