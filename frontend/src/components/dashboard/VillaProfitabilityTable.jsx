import React from 'react';
import { formatRp } from './dashboardUtils';

export default function VillaProfitabilityTable({ rows, loading }) {
  if (loading) {
    return <div className="dash-loading">Loading villa profitability…</div>;
  }

  if (!rows?.length) {
    return (
      <div className="empty-state empty-state--dashed">
        <p className="text-muted" style={{ fontSize: '0.85rem' }}>
          No villa profitability data in the selected period.
        </p>
      </div>
    );
  }

  return (
    <div className="table-scroll-wrap">
      <table className="pms-table pms-table--financial">
        <thead>
          <tr>
            <th>Villa</th>
            <th className="text-right">Revenue</th>
            <th className="text-right">COGS</th>
            <th className="text-right">Gross Profit</th>
            <th className="text-right">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.villaId}>
              <td className="font-medium">{row.villaName}</td>
              <td className="text-right font-mono">{formatRp(row.revenue)}</td>
              <td className="text-right font-mono">{formatRp(row.cogs)}</td>
              <td className="text-right font-mono">{formatRp(row.grossProfit)}</td>
              <td className={`text-right font-mono ${row.netProfit < 0 ? 'text-danger' : ''}`}>
                {formatRp(row.netProfit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
