/**
 * Dashboard.jsx
 * Reporting & Insights — Financial Overview | Hospitality KPI
 * Global filters: date range + villa selector
 */

import React, { useState, useEffect, useMemo } from 'react';
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

function Dashboard() {
  const [tab, setTab] = useState('financial');
  const [preset, setPreset] = useState('month');
  const [customStart, setCustomStart] = useState(getISODate(startOf('month')));
  const [customEnd, setCustomEnd] = useState(getISODate(new Date()));
  const [villaFilter, setVillaFilter] = useState('all');

  const [villas, setVillas] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [incomeRows, setIncomeRows] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [pricingHolidays, setPricingHolidays] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [villasRes, bookingsRes, incomeRes, txRes, expRes, holidaysRes] = await Promise.all([
        fetch('/api/villas'),
        fetch('/api/bookings'),
        fetch('/api/financial/income'),
        fetch('/api/financial/transactions'),
        fetch('/api/financial/expenses'),
        fetch('/api/pricing/holidays'),
      ]);
      if (villasRes.ok) setVillas(await villasRes.json());
      if (bookingsRes.ok) setBookings(await bookingsRes.json());
      if (incomeRes.ok) setIncomeRows(await incomeRes.json());
      if (txRes.ok) setTransactions(await txRes.json());
      if (expRes.ok) setExpenses(await expRes.json());
      if (holidaysRes.ok) setPricingHolidays(await holidaysRes.json());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

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
      rangeStart,
      rangeEnd,
      villaFilter,
      villas,
      pricingHolidays,
    }),
    [bookings, incomeRows, transactions, expenses, rangeStart, rangeEnd, villaFilter, villas, pricingHolidays],
  );

  const financialData = useMemo(
    () => processFinancialData(filterCtx),
    [filterCtx],
  );

  const hospitalityData = useMemo(
    () => processHospitalityData(filterCtx),
    [filterCtx],
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
        villaFilter={villaFilter}
        setVillaFilter={setVillaFilter}
        villas={villas}
        loading={loading}
        onRefresh={fetchAll}
      />

      <PageTabs
        ariaLabel="Dashboard sections"
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
