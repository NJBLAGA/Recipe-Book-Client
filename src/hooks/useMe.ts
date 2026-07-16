import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface UserProfile {
  id: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  handle: string | null;
  image: string | null;
  bio: string | null;
  theme: 'light' | 'dark' | null;
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => api.get<UserProfile>('/api/users/me'),
  });
}
