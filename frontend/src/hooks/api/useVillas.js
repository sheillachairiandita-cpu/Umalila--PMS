import { useQuery } from '@tanstack/react-query';
import { villasApi, catalogApi } from '../../api';

export function useVillas() {
  return useQuery({
    queryKey: ['villas'],
    queryFn: villasApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useCatalog() {
  return useQuery({
    queryKey: ['catalog'],
    queryFn: async () => {
      const [addons, discounts, holidays] = await Promise.all([
        catalogApi.addons(),
        catalogApi.discounts(),
        catalogApi.holidays(),
      ]);
      return { addons, discounts, holidays };
    },
    staleTime: 5 * 60_000,
  });
}
