import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Button, PageTabs } from '../ui';
import FinancialKpiCards from './FinancialKpiCards';
import IncomeTable from './IncomeTable';
import ExpensePendingQueue from './ExpensePendingQueue';
import ExpenseLedgerTable from './ExpenseLedgerTable';
import AddExpensePanel from './AddExpensePanel';
import ExpenseProofModal from './ExpenseProofModal';
import EditExpenseModal from './EditExpenseModal';
import FinancialDetailsModal from './FinancialDetailsModal';

async function uploadExpenseProof(proof) {
  if (!proof?.dataUrl) return null;

  const res = await fetch('/api/financial/expenses/upload-proof', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileData: proof.dataUrl,
      fileName: proof.name,
      fileType: proof.type,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload proof of payment.');
  }

  const data = await res.json();
  return data.publicUrl;
}

function FinancialDashboardPage() {
  const [activeTab, setActiveTab] = useState('incomes');

  const [kpis, setKpis] = useState(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const [incomeRows, setIncomeRows] = useState([]);
  const [incomeLoading, setIncomeLoading] = useState(true);

  const [expenses, setExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(true);

  const [detailsRow, setDetailsRow] = useState(null);
  const [proofExpense, setProofExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true);
    try {
      const res = await fetch('/api/financial/kpis');
      if (!res.ok) throw new Error('Failed to load KPI metrics');
      setKpis(await res.json());
    } catch (err) {
      console.error(err);
      setKpis({ totalRevenue: 0, upcomingRevenue: 0, pendingDeposits: 0, totalExpenses: 0 });
    } finally {
      setKpisLoading(false);
    }
  }, []);

  const fetchIncome = useCallback(async () => {
    setIncomeLoading(true);
    try {
      const res = await fetch('/api/financial/income');
      if (!res.ok) throw new Error('Failed to load income data');
      const data = await res.json();
      const sorted = [...data].sort((a, b) => {
        const order = { pending: 0, partial: 1, complete: 2 };
        const diff = (order[a.paymentStatus] ?? 1) - (order[b.paymentStatus] ?? 1);
        if (diff !== 0) return diff;
        return (b.checkIn || '').localeCompare(a.checkIn || '');
      });
      setIncomeRows(sorted);
    } catch (err) {
      console.error(err);
      setIncomeRows([]);
    } finally {
      setIncomeLoading(false);
    }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setExpensesLoading(true);
    try {
      const res = await fetch('/api/financial/expenses');
      if (!res.ok) throw new Error('Failed to load expenses');
      setExpenses(await res.json());
    } catch (err) {
      console.error(err);
      setExpenses([]);
    } finally {
      setExpensesLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchKpis(), fetchIncome(), fetchExpenses()]);
  }, [fetchKpis, fetchIncome, fetchExpenses]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const patchExpense = async (expenseId, body) => {
    const res = await fetch(`/api/financial/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update expense.');
    }
    const updated = await res.json();
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    await fetchKpis();
    return updated;
  };

  const handleApprove = (expenseId) => patchExpense(expenseId, { status: 'approved' });
  const handleReject = (expenseId) => patchExpense(expenseId, { status: 'rejected' });

  const handleEditSave = (expenseId, payload) => patchExpense(expenseId, payload);

  const handleAddExpense = async ({ category, description, amount, transactionDate, proof }) => {
    const proofUrl = await uploadExpenseProof(proof);

    const res = await fetch('/api/financial/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        description,
        amount,
        transactionDate,
        proofUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create expense.');
    }

    const created = await res.json();
    setExpenses((prev) => [created, ...prev]);
    await fetchKpis();
  };

  const pendingCount = expenses.filter((e) => e.status === 'pending').length;

  return (
    <div className="reservation-page financial-dashboard">
      <div className="financial-dashboard__header">
        <div>
          <h2 className="financial-dashboard__title">Financial Overview</h2>
          <p className="financial-dashboard__subtitle">Revenue, deposits, and expense workflows</p>
        </div>
        <div className="financial-dashboard__actions">
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh"
            className="icon-btn-ghost"
          >
            <RefreshCw size={14} className={kpisLoading || incomeLoading || expensesLoading ? 'spin-animation' : ''} />
          </button>
          <Button variant="primary" icon={Plus} onClick={() => setAddPanelOpen(true)}>
            Add New Expense
          </Button>
        </div>
      </div>

      <FinancialKpiCards kpis={kpis} loading={kpisLoading} />

      <PageTabs
        ariaLabel="Financial sections"
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'incomes', label: 'Incomes', icon: TrendingUp },
          { key: 'expenses', label: 'Expenses', icon: TrendingDown, badge: pendingCount },
        ]}
      />

      <div className="financial-tab-content">
        {activeTab === 'incomes' && (
          <div className="section-card">
            <div className="section-card__header">
              <TrendingUp size={15} color="var(--green)" />
              <h3 className="section-card__title">Income Ledger</h3>
              <span className="section-card__count">{incomeRows.length} records</span>
            </div>
            <div className="section-card__body">
              <IncomeTable
                rows={incomeRows}
                loading={incomeLoading}
                onViewDetails={setDetailsRow}
              />
            </div>
          </div>
        )}

        {activeTab === 'expenses' && (
          <div className="financial-expenses-stack">
            <div className="section-card">
              <div className="section-card__header">
                <TrendingDown size={15} color="var(--text-muted)" />
                <h3 className="section-card__title">Pending Approvals</h3>
                {pendingCount > 0 && (
                  <span className="section-card__count section-card__count--accent">
                    {pendingCount} pending
                  </span>
                )}
              </div>
              <div className="section-card__body">
                <ExpensePendingQueue
                  expenses={expenses}
                  loading={expensesLoading}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            </div>

            <div className="section-card">
              <div className="section-card__header">
                <TrendingDown size={15} color="var(--text-muted)" />
                <h3 className="section-card__title">Expense Historical Ledger</h3>
                <span className="section-card__count">{expenses.length} records</span>
              </div>
              <div className="section-card__body">
                <ExpenseLedgerTable
                  expenses={expenses}
                  loading={expensesLoading}
                  onEdit={setEditExpense}
                  onViewProof={setProofExpense}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <AddExpensePanel
        isOpen={addPanelOpen}
        onClose={() => setAddPanelOpen(false)}
        onSubmit={handleAddExpense}
      />

      <ExpenseProofModal
        expense={proofExpense}
        onClose={() => setProofExpense(null)}
      />

      <EditExpenseModal
        expense={editExpense}
        onClose={() => setEditExpense(null)}
        onSave={handleEditSave}
      />

      <FinancialDetailsModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        displayId={detailsRow?.displayId}
        onClose={() => setDetailsRow(null)}
      />
    </div>
  );
}

export default FinancialDashboardPage;
