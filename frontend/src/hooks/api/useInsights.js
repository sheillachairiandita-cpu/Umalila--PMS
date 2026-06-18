import { useQuery } from '@tanstack/react-query';
import { insightsApi } from '../../api';

export function useInsightsData(options = {}) {
  const { enabled = true } = options;
  return useQuery({
    queryKey: ['insights', 'bundle'],
    queryFn: insightsApi.bundle,
    staleTime: 60_000,
    enabled,
  });
}
