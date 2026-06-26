import { apiJson, unwrapList } from './client';

export const bookingsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiJson(`/api/bookings${qs ? `?${qs}` : ''}`).then(unwrapList);
  },
};

export const financialApi = {
  income: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiJson(`/api/financial/income${qs ? `?${qs}` : ''}`).then(unwrapList);
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

export const villasApi = {
  list: () => apiJson('/api/villas'),
  availability: (checkIn, checkOut) =>
    apiJson(`/api/villas/availability?check_in=${checkIn}&check_out=${checkOut}`),
  gantt: () => apiJson('/api/villas/gantt'),
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
  bundle: async () => {
    const [villas, bookings, incomeRows, transactions, expenses, profitability, holidays] = await Promise.all([
      villasApi.list(),
      bookingsApi.list({ limit: 500 }),
      financialApi.income({ limit: 500 }),
      financialApi.transactions(),
      financialApi.expenses(),
      financialApi.profitability(),
      catalogApi.holidays(),
    ]);
    return { villas, bookings, incomeRows, transactions, expenses, profitability, pricingHolidays: holidays };
  },
};
