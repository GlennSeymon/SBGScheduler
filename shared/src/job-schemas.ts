import { z } from 'zod';

export const assignJobSchema = z.object({
  installerId: z.string().min(1, 'Select an installer'),
  scheduledStart: z.iso.datetime({ offset: true }),
});

export type AssignJobInput = z.infer<typeof assignJobSchema>;

export const rescheduleJobSchema = z
  .object({
    installerId: z.string().min(1, 'Select an installer').optional(),
    scheduledStart: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((data) => data.installerId !== undefined || data.scheduledStart !== undefined, {
    message: 'Provide a new installer and/or start time',
  });

export type RescheduleJobInput = z.infer<typeof rescheduleJobSchema>;
