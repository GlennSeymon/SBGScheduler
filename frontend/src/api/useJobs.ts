import { useQuery } from '@tanstack/react-query';
import type { Job } from '@sbg/shared';
import { apiClient } from './client';

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await apiClient.get<Job[]>('/jobs');
      return data;
    },
  });
}
