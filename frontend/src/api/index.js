import { apiJson, unwrapList } from './client';
import { enrichIncomeRow } from '../utils/financialUtils';

export const bookingsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiJson(`/api/bookings${qs ? `?${qs}` : ''}`).then(unwrapList);
  },
};

export const financialApi = {
  income: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiJson(`/api/financial/income${qs ? `?${qs}` : ''}`)
      .then(unwrapList)
      .then((rows) => rows.map(enrichIncomeRow));
  },
  expenses: () => apiJson('/api/financial/expenses').then(unwrapList),
  kpis: () => apiJson('/api/financial/kpis'),
  transactions: () => apiJson('/api/financial/transactions').then(unwrapList),
  profitability: () => apiJson('/api/financial/profitability').then(unwrapList),
  cogsProfiles: () => apiJson('/api/financial/cogs/profiles').then(unwrapList),
  uploadExpenseProof: async (proof) => {
    if (!proof?.dataUrl) return null;
    const data = await apiJson('/api/financial/expenses/upload-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileData: proof.dataUrl,
        fileName: proof.name,
        fileType: proof.type,
      }),
    });
    return data.publicUrl;
  },
  patchExpense: (expenseId, body) => apiJson(`/api/financial/expenses/${expenseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
  createExpense: (payload) => apiJson('/api/financial/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
};

export const propertiesApi = {
  list: () => apiJson('/api/properties'),
  availability: (checkIn, checkOut) =>
    apiJson(`/api/properties/availability?check_in=${checkIn}&check_out=${checkOut}`),
  gantt: () => apiJson('/api/properties/gantt'),
};

export const catalogApi = {
  addons: () => apiJson('/api/addons'),
  discounts: () => apiJson('/api/discounts'),
  holidays: () => apiJson('/api/pricing/holidays'),
  menuItems: () => apiJson('/api/menu-items'),
};

export const dashboardApi = {
  kpis: () => apiJson('/api/dashboard'),
};

export const insightsApi = {
  /** Properties + bookings shared by both tabs */
  async base() {
    const [properties, bookings] = await Promise.all([
      propertiesApi.list(),
      bookingsApi.list({ limit: 500 }),
    ]);
    return { properties, bookings };
  },

  async financialBundle() {
    const [base, incomeRows, transactions, expenses, profitability, holidays] = await Promise.all([
      this.base(),
      financialApi.income({ limit: 500 }),
      financialApi.transactions(),
      financialApi.expenses(),
      financialApi.profitability(),
      catalogApi.holidays(),
    ]);
    return {
      ...base,
      incomeRows,
      transactions,
      expenses,
      profitability,
      pricingHolidays: holidays,
    };
  },

  async hospitalityBundle() {
    const [base, incomeRows, holidays] = await Promise.all([
      this.base(),
      financialApi.income({ limit: 500 }),
      catalogApi.holidays(),
    ]);
    return {
      ...base,
      incomeRows,
      pricingHolidays: holidays,
      transactions: [],
      expenses: [],
      profitability: [],
    };
  },

  /** @deprecated Use financialBundle or hospitalityBundle */
  bundle: async () => insightsApi.financialBundle(),
};
