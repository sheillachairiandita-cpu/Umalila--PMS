import React from 'react';
import { Users, LogIn, LogOut, Coffee, CalendarCheck } from 'lucide-react';
import { KpiCard, KpiCardGrid } from './ui/KpiCard';

function DashboardStats({ stats, loading }) {
  const cards = [
    { key: 'arrivalsToday', label: 'Arriving Today', icon: LogIn },
    { key: 'inHouseCount', label: 'In House', icon: Users },
    { key: 'departuresToday', label: 'Departing Today', icon: LogOut },
    { key: 'breakfastToday', label: 'Breakfast Today', icon: Coffee },
    { key: 'breakfastTomorrow', label: 'Breakfast Tomorrow', icon: CalendarCheck },
  ];

  return (
    <KpiCardGrid>
      {cards.map(({ key, label, icon }) => (
        <KpiCard
          key={key}
          icon={icon}
          label={label}
          value={stats?.[key] ?? 0}
          loading={loading}
        />
      ))}
    </KpiCardGrid>
  );
}

export default DashboardStats;
