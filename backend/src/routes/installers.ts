import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const installersRouter = Router();

installersRouter.get('/', async (_req, res) => {
  const installers = await prisma.installer.findMany({ orderBy: { name: 'asc' } });
  res.json(installers);
});
