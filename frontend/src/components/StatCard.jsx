import React from 'react';

function StatCard({ title, value, extraElement }) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      {value && <div className="stat-number">{value}</div>}
      {extraElement}
    </div>
  );
}

export default StatCard;