import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssignJobInput, Job } from '@sbg/shared';
import { apiClient } from './client';

interface AssignJobVariables {
  jobId: string;
  input: AssignJobInput;
}

export function useAssignJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, input }: AssignJobVariables) => {
      const { data } = await apiClient.patch<Job>(`/jobs/${jobId}/assign`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
