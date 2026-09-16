import { useQuery } from '@tanstack/react-query';
import ms from 'ms';
import type { PublicHoliday } from '@sbg/shared';
import { apiClient } from './client';

export function usePublicHolidays() {
  return useQuery({
    queryKey: ['public-holidays'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicHoliday[]>('/public-holidays');
      return data;
    },
    // Fixed calendar data for the sample date range — no point refetching on every mount/window
    // focus, but re-check periodically in case the backend list is updated.
    staleTime: ms('7 days'),
  });
}
