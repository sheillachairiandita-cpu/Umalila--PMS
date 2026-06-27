/**
 * Dashboard.jsx
 * Reporting & Insights — Financial Overview | Hospitality KPI
 */

import React, { useState, useMemo } from 'react';
import { DollarSign, BedDouble } from 'lucide-react';
import PageTabs from '../ui/PageTabs';
import GlobalFilterBar from './GlobalFilterBar';
import FinancialOverviewTab from './FinancialOverviewTab';
import HospitalityKpiTab from './HospitalityKpiTab';
import {
  addDays,
  getISODate,
  getRangeDates,
  processFinancialData,
  processHospitalityData,
  startOf,
} from './dashboardUtils';
import { useInsightsData } from '../../hooks/api/useInsights';

function Dashboard() {
  const [tab, setTab] = useState('financial');
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState(getISODate(startOf('month')));
  const [customEnd, setCustomEnd] = useState(getISODate(new Date()));
  const [propertyFilter, setPropertyFilter] = useState('all');

  const { data, isLoading: loading, refetch } = useInsightsData(tab);
  const properties = data?.properties || [];
  const bookings = data?.bookings || [];
  const incomeRows = data?.incomeRows || [];
  const transactions = data?.transactions || [];
  const expenses = data?.expenses || [];
  const profitability = data?.profitability || [];
  const pricingHolidays = data?.pricingHolidays || [];

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (preset === 'custom') {
      return {
        rangeStart: customStart ? new Date(customStart) : addDays(new Date(), -30),
        rangeEnd: customEnd
          ? (() => {
            const d = new Date(customEnd);
            d.setHours(23, 59, 59, 999);
            return d;
          })()
          : new Date(),
      };
    }
    const { start, end } = getRangeDates(preset);
    return { rangeStart: start, rangeEnd: end };
  }, [preset, customStart, customEnd]);

  const filterCtx = useMemo(
    () => ({
      bookings,
      incomeRows,
      transactions,
      expenses,
      profitability,
      rangeStart,
      rangeEnd,
      propertyFilter,
      properties,
      pricingHolidays,
    }),
    [bookings, incomeRows, transactions, expenses, profitability, rangeStart, rangeEnd, propertyFilter, properties, pricingHolidays],
  );

  const financialData = useMemo(
    () => (tab === 'financial' ? processFinancialData(filterCtx) : null),
    [tab, filterCtx],
  );

  const hospitalityData = useMemo(
    () => (tab === 'hospitality' ? processHospitalityData(filterCtx) : null),
    [tab, filterCtx],
  );

  return (
    <div className="dash-page">
      <GlobalFilterBar
        preset={preset}
        setPreset={setPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        propertyFilter={propertyFilter}
        setPropertyFilter={setPropertyFilter}
        properties={properties}
        loading={loading}
        onRefresh={refetch}
      />

      <PageTabs
        ariaLabel="Insights sections"
        activeTab={tab}
        onChange={setTab}
        tabs={[
          { key: 'financial', label: 'Financial Overview', icon: DollarSign },
          { key: 'hospitality', label: 'Hospitality KPI', icon: BedDouble },
        ]}
      />

      {tab === 'financial' && (
        <FinancialOverviewTab data={financialData} loading={loading} />
      )}
      {tab === 'hospitality' && (
        <HospitalityKpiTab data={hospitalityData} loading={loading} />
      )}
    </div>
  );
}

export default Dashboard;
