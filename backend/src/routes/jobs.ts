import { Router } from 'express';
import { formatInTimeZone } from 'date-fns-tz';
import { assignJobSchema, rescheduleJobSchema } from '@sbg/shared';
import { prisma } from '../lib/prisma.js';
import { evaluateSchedulingRules, STATE_TIME_ZONES } from '../lib/rule-engine.js';
import { JobStatus, AustralianState } from '../generated/enums.js';
import { geocodeSuburb } from '../lib/geocoding.js';
import { getForecast, type DailyForecast } from '../lib/weather.js';
import { evaluateAtRisk } from '../lib/at-risk.js';

const ACTIVE_STATUSES = [JobStatus.SCHEDULED, JobStatus.CONFIRMED];

export const jobsRouter = Router();

// Geocoding + weather aren't cached yet (that's 6.5) — for now, just dedupe within a single request so
// jobs sharing a suburb (common in the seeded data) don't trigger repeat lookups.
//
// Any failure here (geocoding down, weather API down, a network blip) is caught unconditionally, not
// just our own GeocodingError/WeatherError — /api/jobs is the app's core data endpoint and must keep
// working even when the weather enrichment can't. A job that hits this just gets no weather reason.
async function forecastForSuburb(
  suburb: string,
  state: AustralianState,
  cache: Map<string, Promise<DailyForecast[] | null>>,
): Promise<DailyForecast[] | null> {
  const key = `${suburb}|${state}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const coordinates = await geocodeSuburb(suburb, state);
        return await getForecast(coordinates);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`At-risk: weather lookup failed for ${suburb}, ${state}: ${message}`);
        return null;
      }
    })();
    cache.set(key, pending);
  }
  return pending;
}

jobsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { id: 'asc' },
    include: { assignedInstaller: true },
  });

  const now = new Date();
  const forecastCache = new Map<string, Promise<DailyForecast[] | null>>();

  const jobsWithRisk = await Promise.all(
    jobs.map(async (job) => {
      let forecastForDate: DailyForecast | undefined;

      if (job.scheduledStart) {
        const forecasts = await forecastForSuburb(job.suburb, job.state, forecastCache);
        if (forecasts) {
          const localDate = formatInTimeZone(
            job.scheduledStart,
            STATE_TIME_ZONES[job.state],
            'yyyy-MM-dd',
          );
          forecastForDate = forecasts.find((forecast) => forecast.date === localDate);
        }
      }

      const { isAtRisk, reasons } = evaluateAtRisk(job, forecastForDate, now);
      return { ...job, isAtRisk, atRiskReasons: reasons };
    }),
  );

  res.json(jobsWithRisk);
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

  const candidateStart = new Date(scheduledStart);
  const otherJobs = await prisma.job.findMany({
    where: { assignedInstallerId: installerId, status: { in: ACTIVE_STATUSES } },
  });

  const violations = evaluateSchedulingRules(
    installer,
    { id: job.id, state: job.state, scheduledStart: candidateStart, durationBlocks: job.durationBlocks },
    otherJobs.map((j) => ({ id: j.id, scheduledStart: j.scheduledStart!, durationBlocks: j.durationBlocks })),
  );
  if (violations.length > 0) {
    res.status(409).json({ error: 'Scheduling rule violation', violations });
    return;
  }

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      assignedInstallerId: installerId,
      scheduledStart: candidateStart,
      status: JobStatus.SCHEDULED,
    },
    include: { assignedInstaller: true },
  });

  res.json(updated);
});

jobsRouter.patch('/:id/reschedule', async (req, res) => {
  const parsed = rescheduleJobSchema.safeParse(req.body);
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

  if (job.status === JobStatus.UNSCHEDULED) {
    res.status(409).json({
      error: `Job ${job.id} is unscheduled — use assign instead`,
    });
    return;
  }

  if (job.status === JobStatus.CANCELLED) {
    res.status(409).json({
      error: `Job ${job.id} is cancelled and cannot be rescheduled`,
    });
    return;
  }

  const effectiveInstallerId = installerId ?? job.assignedInstallerId!;
  const installer = await prisma.installer.findUnique({
    where: { id: effectiveInstallerId },
  });
  if (!installer) {
    res.status(404).json({ error: `Installer ${effectiveInstallerId} not found` });
    return;
  }

  const effectiveScheduledStart = scheduledStart ? new Date(scheduledStart) : job.scheduledStart!;
  const otherJobs = await prisma.job.findMany({
    where: {
      assignedInstallerId: effectiveInstallerId,
      status: { in: ACTIVE_STATUSES },
      id: { not: job.id },
    },
  });

  const violations = evaluateSchedulingRules(
    installer,
    { id: job.id, state: job.state, scheduledStart: effectiveScheduledStart, durationBlocks: job.durationBlocks },
    otherJobs.map((j) => ({ id: j.id, scheduledStart: j.scheduledStart!, durationBlocks: j.durationBlocks })),
  );
  if (violations.length > 0) {
    res.status(409).json({ error: 'Scheduling rule violation', violations });
    return;
  }

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: {
      ...(installerId && { assignedInstallerId: installerId }),
      ...(scheduledStart && { scheduledStart: effectiveScheduledStart }),
      // A changed time/installer un-confirms a CONFIRMED job — it needs re-confirming.
      status: job.status === JobStatus.CONFIRMED ? JobStatus.SCHEDULED : job.status,
    },
    include: { assignedInstaller: true },
  });

  res.json(updated);
});
