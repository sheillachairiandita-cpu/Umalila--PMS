import { useQuery } from '@tanstack/react-query';
import { propertiesApi, catalogApi } from '../../api';

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: propertiesApi.list,
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
