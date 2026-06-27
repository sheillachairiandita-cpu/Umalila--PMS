import React from 'react';
import { formatRp } from '../../utils/formatCurrency';
import { isBalanceSettled, computeIncomeTotals } from '../../utils/financialUtils';

/**
 * Balance-due column cell for income / ledger tables.
 */
function BalanceDueCell({ row }) {
  const { balanceDue } = computeIncomeTotals(row);

  if (balanceDue > 0) {
    return <span className="cell-balance-due">{formatRp(balanceDue)}</span>;
  }

  if (isBalanceSettled(row)) {
    return '—';
  }

  return '—';
}

export default BalanceDueCell;
