import React from 'react';
import { Users, LogIn, LogOut, Coffee, CalendarCheck } from 'lucide-react';

function DashboardStats({ stats, loading }) {
  const cards = [
    { key: 'arrivalsToday', label: 'Arriving Today', icon: LogIn },
    { key: 'inHouseCount', label: 'In House', icon: Users },
    { key: 'departuresToday', label: 'Departing Today', icon: LogOut },
    { key: 'breakfastToday', label: 'Breakfast Today', icon: Coffee },
    { key: 'breakfastTomorrow', label: 'Breakfast Tomorrow', icon: CalendarCheck },
  ];

  return (
    <section className="stats-grid">
      {cards.map(({ key, label, icon: Icon }) => (
        <div key={key} className="metric-card">
          <div className="metric-card__icon-bg">
            <Icon color="var(--navy)" />
          </div>
          <div className="metric-card__label-row">
            <Icon color="var(--text-muted)" />
            <span className="metric-card__label">{label}</span>
          </div>
          <div className={loading ? 'metric-card__value--loading' : 'metric-card__value'}>
            {loading ? '—' : (stats?.[key] ?? 0)}
          </div>
        </div>
      ))}
    </section>
  );
}

export default DashboardStats;
