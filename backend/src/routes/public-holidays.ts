import { Router } from 'express';
import { getPublicHolidays } from '../lib/public-holidays.js';

export const publicHolidaysRouter = Router();

// Fixed current-year + next-year window rather than reacting to calendar navigation — good enough for
// any realistic scheduling horizon, and this endpoint is purely cosmetic (calendar highlighting), so it
// always fails soft, unlike the hard scheduling-rule check in jobs.ts.
publicHolidaysRouter.get('/', async (_req, res) => {
  const currentYear = new Date().getFullYear();

  try {
    const [thisYear, nextYear] = await Promise.all([
      getPublicHolidays(currentYear),
      getPublicHolidays(currentYear + 1),
    ]);
    res.json([...thisYear, ...nextYear]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Public holidays lookup failed: ${message}`);
    res.json([]);
  }
});
