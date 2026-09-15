import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RescheduleJobInput, Job } from '@sbg/shared';
import { apiClient } from './client';

interface RescheduleJobVariables {
  jobId: string;
  input: RescheduleJobInput;
}

export function useRescheduleJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, input }: RescheduleJobVariables) => {
      const { data } = await apiClient.patch<Job>(`/jobs/${jobId}/reschedule`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
