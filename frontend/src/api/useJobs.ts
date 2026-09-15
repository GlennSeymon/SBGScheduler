import { useQuery } from '@tanstack/react-query';
import type { JobWithRisk } from '@sbg/shared';
import { apiClient } from './client';

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await apiClient.get<JobWithRisk[]>('/jobs');
      return data;
    },
  });
}
