import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const jobsRouter = Router();

jobsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { id: 'asc' },
    include: { assignedInstaller: true },
  });
  res.json(jobs);
});
