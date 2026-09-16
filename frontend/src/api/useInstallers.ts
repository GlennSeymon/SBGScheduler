import { useQuery } from '@tanstack/react-query';
import ms from 'ms';
import type { Installer } from '@sbg/shared';
import { apiClient } from './client';

export function useInstallers() {
  return useQuery({
    queryKey: ['installers'],
    queryFn: async () => {
      const { data } = await apiClient.get<Installer[]>('/installers');
      return data;
    },
    // Nothing in the app mutates the installer roster, so avoid refetching on every mount/window
    staleTime: ms('5 minutes'),
  });
}
