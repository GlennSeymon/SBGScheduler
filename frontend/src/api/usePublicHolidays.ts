import { useQuery } from '@tanstack/react-query';
import type { PublicHoliday } from '@sbg/shared';
import { apiClient } from './client';

export function usePublicHolidays() {
  return useQuery({
    queryKey: ['public-holidays'],
    queryFn: async () => {
      const { data } = await apiClient.get<PublicHoliday[]>('/public-holidays');
      return data;
    },
  });
}
