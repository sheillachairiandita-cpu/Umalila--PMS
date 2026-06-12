import React from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { RANGE_PRESETS } from './dashboardUtils';

export default function GlobalFilterBar({
  preset,
  setPreset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  villaFilter,
  setVillaFilter,
  villas,
  loading,
  onRefresh,
}) {
  return (
    <div className="dash-filter-bar">
      <div className="dash-filter-group">
        <label className="dash-filter-label">Timeframe</label>
        <div className="dash-preset-pills">
          {RANGE_PRESETS.filter((r) => r.key !== 'custom').map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setPreset(r.key)}
              className={`dash-pill ${preset === r.key ? 'dash-pill--active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-filter-group">
        <label className="dash-filter-label">Custom Range</label>
        <div className="dash-date-range">
          <input
            type="date"
            className="dash-date-input"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setPreset('custom');
            }}
          />
          <span className="dash-date-sep">→</span>
          <input
            type="date"
            className="dash-date-input"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setPreset('custom');
            }}
          />
        </div>
      </div>

      <div className="dash-filter-group">
        <label className="dash-filter-label">Property</label>
        <div className="dash-select-wrap">
          <select
            className="dash-select"
            value={villaFilter}
            onChange={(e) => setVillaFilter(e.target.value)}
          >
            <option value="all">All Properties</option>
            {(villas || []).map((v) => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
          <ChevronDown size={12} className="dash-select-chevron" />
        </div>
      </div>

      <button type="button" className="dash-refresh-btn" onClick={onRefresh} title="Refresh data">
        <RefreshCw size={14} className={loading ? 'spin-animation' : ''} />
      </button>
    </div>
  );
}
