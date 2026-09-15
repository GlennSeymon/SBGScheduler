import { useQuery } from '@tanstack/react-query';
import type { Installer } from '@sbg/shared';
import { apiClient } from './client';

export function useInstallers() {
  return useQuery({
    queryKey: ['installers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Installer[]>('/installers');
      return data;
    },
  });
}
