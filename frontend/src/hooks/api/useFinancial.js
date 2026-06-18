import { useQuery, useQueryClient } from '@tanstack/react-query';
import { financialApi, villasApi } from '../../api';

export function useFinancialIncome(options = {}) {
  const { enabled = true, limit = 500 } = options;
  return useQuery({
    queryKey: ['financial', 'income', { limit }],
    queryFn: () => financialApi.income({ limit }),
    staleTime: 30_000,
    enabled,
  });
}

export function useFinancialExpenses(options = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['financial', 'expenses'],
    queryFn: financialApi.expenses,
    staleTime: 30_000,
    enabled,
  });
}

export function useFinancialKpis(options = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['financial', 'kpis'],
    queryFn: financialApi.kpis,
    staleTime: 60_000,
    enabled,
  });
}

export function useCogsData(options = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['financial', 'cogs'],
    queryFn: async () => {
      const [profiles, villas] = await Promise.all([
        financialApi.cogsProfiles(),
        villasApi.list(),
      ]);
      return { profiles, villas };
    },
    staleTime: 60_000,
    enabled,
  });
}

export function useInvalidateFinancial() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['financial'] });
}
