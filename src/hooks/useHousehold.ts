import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface Household {
  id: string;
  name: string;
  role: 'OWNER' | 'USER';
}

async function fetchHousehold(): Promise<Household | null> {
  try {
    return await api.get<Household>('/api/households/mine');
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export function useHousehold(enabled = true) {
  const { data: household = null, isPending } = useQuery({
    queryKey: queryKeys.household.mine(),
    queryFn: fetchHousehold,
    retry: false,
    enabled,
  });
  return { household, isLoading: enabled ? isPending : false };
}
