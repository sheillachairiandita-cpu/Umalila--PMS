import React from 'react';
import { Users, LogIn, LogOut, Coffee, CalendarCheck } from 'lucide-react';

function DashboardStats({ stats, loading }) {
  const cards = [
    {
      key: 'arrivalsToday',
      label: 'Arriving Today',
      icon: LogIn,
      color: '#0ea5e9',
      bg: '#f0f9ff',
      border: '#bae6fd',
    },
    {
      key: 'inHouseCount',
      label: 'In House',
      icon: Users,
      color: '#8b5cf6',
      bg: '#f5f3ff',
      border: '#ddd6fe',
    },
    {
      key: 'departuresToday',
      label: 'Departing Today',
      icon: LogOut,
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a',
    },
    {
      key: 'breakfastToday',
      label: 'Breakfast Today',
      icon: Coffee,
      color: '#10b981',
      bg: '#f0fdf4',
      border: '#bbf7d0',
    },
    {
      key: 'breakfastTomorrow',
      label: 'Breakfast Tomorrow',
      icon: CalendarCheck,
      color: '#6366f1',
      bg: '#eef2ff',
      border: '#c7d2fe',
    },
  ];

  return (
    <section className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      {cards.map(({ key, label, icon: Icon, color, bg, border }) => (
        <div
          key={key}
          className="stat-card"
          style={{
            background: bg,
            borderColor: border,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 10,
            right: 12,
            opacity: 0.15,
          }}>
            <Icon size={38} color={color} />
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
          }}>
            <Icon size={13} color={color} />
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color, fontWeight: 600 }}>
              {label}
            </span>
          </div>
          <div className="stat-number" style={{ color: '#0f172a', fontSize: '1.75rem' }}>
            {loading ? (
              <span style={{ fontSize: '1rem', color: '#94a3b8' }}>—</span>
            ) : (
              stats?.[key] ?? 0
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export default DashboardStats;
