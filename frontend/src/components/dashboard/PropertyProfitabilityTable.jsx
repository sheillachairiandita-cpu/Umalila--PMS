import React from 'react';
import { formatRpCompact } from './dashboardUtils';

export default function PropertyProfitabilityTable({ rows, loading }) {
  if (loading) {
    return <div className="dash-loading">Loading property profitability…</div>;
  }

  if (!rows?.length) {
    return (
      <div className="empty-state empty-state--dashed">
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          No property profitability data in the selected period.
        </p>
      </div>
    );
  }

  return (
    <div className="table-scroll-wrap">
      <table className="pms-table pms-table--financial">
        <thead>
          <tr>
            <th>Property</th>
            <th className="text-right">Revenue</th>
            <th className="text-right">COGS</th>
            <th className="text-right">Gross Profit</th>
            <th className="text-right">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.propertyId}>
              <td className="font-medium">{row.propertyName}</td>
              <td className="text-right font-mono">{formatRpCompact(row.revenue)}</td>
              <td className="text-right font-mono">{formatRpCompact(row.cogs)}</td>
              <td className="text-right font-mono">{formatRpCompact(row.grossProfit)}</td>
              <td className={`text-right font-mono ${row.netProfit < 0 ? 'text-danger' : ''}`}>
                {formatRpCompact(row.netProfit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
