import React, { useCallback, useState } from 'react';
import { Plus, RefreshCw, TrendingDown, TrendingUp, Calculator } from 'lucide-react';
import { PageTabs } from '../ui';
import FinancialKpiCards from './FinancialKpiCards';
import IncomeTable from './IncomeTable';
import ExpensePendingQueue from './ExpensePendingQueue';
import ExpenseLedgerTable from './ExpenseLedgerTable';
import CogsTab from './COGS/CogsTab';
import CogsProfileModal from './COGS/CogsProfileModal';
import AddExpensePanel from './AddExpensePanel';
import ExpenseProofModal from './ExpenseProofModal';
import EditExpenseModal from './EditExpenseModal';
import SummaryModal from './SummaryModal';
import { useMutation } from '../../context/MutationProvider';
import {
  useFinancialKpis,
  useFinancialIncome,
  useFinancialExpenses,
  useCogsData,
  useInvalidateFinancial,
} from '../../hooks/api/useFinancial';
import { financialApi } from '../../api';
import { apiJson } from '../../api/client';

function FinancialDashboardPage() {
  const { runMutation } = useMutation();
  const invalidateFinancial = useInvalidateFinancial();
  const [activeTab, setActiveTab] = useState('incomes');

  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useFinancialKpis();
  const { data: incomeRows = [], isLoading: incomeLoading, refetch: refetchIncome } = useFinancialIncome({
    enabled: activeTab === 'incomes',
  });
  const { data: expenses = [], isLoading: expensesLoading, refetch: refetchExpenses } = useFinancialExpenses({
    enabled: activeTab === 'incomes' || activeTab === 'expenses',
  });
  const { data: cogsData, isLoading: cogsLoading, refetch: refetchCogs } = useCogsData({
    enabled: activeTab === 'cogs',
  });

  const [cogsModal, setCogsModal] = useState(null);
  const [detailsRow, setDetailsRow] = useState(null);
  const [proofExpense, setProofExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const sortedIncome = [...incomeRows].sort((a, b) => {
    const order = { pending: 0, partial: 1, complete: 2 };
    const diff = (order[a.paymentStatus] ?? 1) - (order[b.paymentStatus] ?? 1);
    if (diff !== 0) return diff;
    return (b.checkIn || '').localeCompare(a.checkIn || '');
  });

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refetchKpis(),
      activeTab === 'incomes' ? refetchIncome() : Promise.resolve(),
      activeTab !== 'cogs' ? refetchExpenses() : Promise.resolve(),
      activeTab === 'cogs' ? refetchCogs() : Promise.resolve(),
    ]);
    await invalidateFinancial();
  }, [activeTab, refetchKpis, refetchIncome, refetchExpenses, refetchCogs, invalidateFinancial]);

  const patchExpense = async (expenseId, body, successMessage) => {
    const result = await runMutation({
      mutation: () => financialApi.patchExpense(expenseId, body),
      refresh: async () => {
        await Promise.all([refetchExpenses(), refetchKpis()]);
      },
      successMessage,
      overlayMessage: 'Updating expense…',
    });

    if (!result.ok) {
      throw result.error || new Error('Failed to update expense.');
    }
  };

  const handleApprove = (expenseId) => patchExpense(expenseId, { status: 'approved' }, 'Expense approved.');
  const handleReject = (expenseId) => patchExpense(expenseId, { status: 'rejected' }, 'Expense rejected.');
  const handleEditSave = (expenseId, payload) => patchExpense(expenseId, payload, 'Expense updated successfully.');

  const handleAddExpense = async (payload) => {
    const result = await runMutation({
      mutation: async () => {
        const proofUrl = await financialApi.uploadExpenseProof(payload.proof);
        return financialApi.createExpense({
          category: payload.category,
          description: payload.description,
          amount: payload.amount,
          transactionDate: payload.transactionDate,
          proofUrl,
        });
      },
      refresh: async () => {
        await Promise.all([refetchExpenses(), refetchKpis()]);
      },
      successMessage: 'Expense submitted successfully.',
      overlayMessage: 'Submitting expense…',
    });

    if (!result.ok) {
      throw result.error || new Error('Failed to create expense.');
    }
  };

  const saveCogsProfile = async (payload) => {
    const isEdit = !!cogsModal?.id;
    const url = isEdit
      ? `/api/financial/cogs/profiles/${cogsModal.id}`
      : '/api/financial/cogs/profiles';

    const result = await runMutation({
      mutation: () => apiJson(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      refresh: refetchCogs,
      successMessage: isEdit ? 'Cost profile updated.' : 'Cost profile created.',
      overlayMessage: 'Saving cost profile…',
    });

    if (!result.ok) {
      throw result.error || new Error('Failed to save cost profile.');
    }
  };

  const deleteCogsProfile = async (profile) => {
    if (!window.confirm(`Delete cost profile for ${profile.villaName}?`)) return;

    const result = await runMutation({
      mutation: () => apiJson(`/api/financial/cogs/profiles/${profile.id}`, { method: 'DELETE' }),
      refresh: refetchCogs,
      successMessage: 'Cost profile deleted.',
      overlayMessage: 'Deleting cost profile…',
    });

    if (!result.ok) {
      throw result.error || new Error('Failed to delete cost profile.');
    }
  };

  const pendingCount = expenses.filter((e) => e.status === 'pending').length;
  const isRefreshing = kpisLoading || incomeLoading || expensesLoading || cogsLoading;

  return (
    <div className="reservation-page financial-dashboard">
      <FinancialKpiCards kpis={kpis} loading={kpisLoading} />

      <div className="financial-dashboard__tab-row">
        <PageTabs
          ariaLabel="Financial sections"
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { key: 'incomes', label: 'Incomes', icon: TrendingUp },
            { key: 'expenses', label: 'Expenses', icon: TrendingDown, badge: pendingCount },
            { key: 'cogs', label: 'COGS', icon: Calculator },
          ]}
        />
        <button
          type="button"
          onClick={refreshAll}
          title="Refresh"
          className="icon-btn-ghost"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin-animation' : ''} />
        </button>
      </div>

      {activeTab === 'incomes' && (
        <>
          <ExpensePendingQueue
            expenses={expenses}
            loading={expensesLoading}
            onApprove={handleApprove}
            onReject={handleReject}
          />
          <IncomeTable
            rows={sortedIncome}
            loading={incomeLoading}
            onViewDetails={setDetailsRow}
          />
        </>
      )}

      {activeTab === 'expenses' && (
        <>
          <div className="section-card__header section-card__header--actions">
            <h2 className="section-card__title">Expense Ledger</h2>
            <button type="button" className="btn btn-primary" onClick={() => setAddPanelOpen(true)}>
              <Plus size={16} />
              Add Expense
            </button>
          </div>
          <ExpenseLedgerTable
            expenses={expenses}
            loading={expensesLoading}
            onViewProof={setProofExpense}
            onEdit={setEditExpense}
          />
        </>
      )}

      {activeTab === 'cogs' && (
        <CogsTab
          profiles={cogsData?.profiles || []}
          villas={cogsData?.villas || []}
          loading={cogsLoading}
          onCreate={() => setCogsModal({})}
          onEdit={setCogsModal}
          onDelete={deleteCogsProfile}
        />
      )}

      <SummaryModal
        isOpen={!!detailsRow}
        bookingId={detailsRow?.bookingId}
        guestName={detailsRow?.guestName}
        displayId={detailsRow?.displayId}
        onClose={() => setDetailsRow(null)}
      />

      {proofExpense && (
        <ExpenseProofModal expense={proofExpense} onClose={() => setProofExpense(null)} />
      )}

      {editExpense && (
        <EditExpenseModal
          expense={editExpense}
          onClose={() => setEditExpense(null)}
          onSave={(payload) => handleEditSave(editExpense.id, payload)}
        />
      )}

      {addPanelOpen && (
        <AddExpensePanel
          onClose={() => setAddPanelOpen(false)}
          onSubmit={handleAddExpense}
        />
      )}

      {cogsModal !== null && (
        <CogsProfileModal
          profile={cogsModal}
          villas={cogsData?.villas || []}
          onClose={() => setCogsModal(null)}
          onSave={saveCogsProfile}
        />
      )}
    </div>
  );
}

export default FinancialDashboardPage;
