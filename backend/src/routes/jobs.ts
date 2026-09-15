import { Router } from 'express';
import { assignJobSchema } from '@sbg/shared';
import { prisma } from '../lib/prisma.js';
import { JobStatus } from '../generated/enums.js';

export const jobsRouter = Router();

jobsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { id: 'asc' },
    include: { assignedInstaller: true },
  });
  res.json(jobs);
});

jobsRouter.patch('/:id/assign', async (req, res) => {
  const parsed = assignJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }
  const { installerId, scheduledStart } = parsed.data;

  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) {
    res.status(404).json({ error: `Job ${req.params.id} not found` });
    return;
  }

  if (job.status !== JobStatus.UNSCHEDULED) {
    res.status(409).json({
      error: `Job ${job.id} is already ${job.status.toLowerCase()} — use reschedule instead`,
    });
    return;
  }

  const installer = await prisma.installer.findUnique({
    where: { id: installerId },
  });
  if (!installer) {
    res.status(404).json({ error: `Installer ${installerId} not found` });
    return;
  }

  // Rule engine validation (double-booking, shift hours, leave, state match) lands in 3.6/3.7.
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      assignedInstallerId: installerId,
      scheduledStart: new Date(scheduledStart),
      status: JobStatus.SCHEDULED,
    },
    include: { assignedInstaller: true },
  });

  res.json(updated);
});
