import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '../../api';

/**
 * Loads dashboard data for the active insights tab only.
 * @param {'financial'|'hospitality'} tab
 */
export function useInsightsData(tab = 'financial', options = {}) {
  const { enabled = true } = options;
  const isFinancial = tab === 'financial';

  return useQuery({
    queryKey: ['insights', tab],
    queryFn: () => (isFinancial ? insightsApi.financialBundle() : insightsApi.hospitalityBundle()),
    staleTime: 60_000,
    enabled,
  });
}
