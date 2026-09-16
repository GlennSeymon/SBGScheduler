import { Router } from 'express';
import { formatInTimeZone } from 'date-fns-tz';
import { assignJobSchema, rescheduleJobSchema } from '@sbg/shared';
import { prisma } from '../lib/prisma.js';
import { evaluateSchedulingRules, STATE_TIME_ZONES } from '../lib/rule-engine.js';
import { JobStatus, AustralianState } from '../generated/enums.js';
import { geocodeSuburb, type Coordinates } from '../lib/geocoding.js';
import { getForecasts, coordinateKey, type DailyForecast } from '../lib/weather.js';
import { evaluateAtRisk } from '../lib/at-risk.js';
import { getPublicHolidays, type PublicHoliday } from '../lib/public-holidays.js';

const ACTIVE_STATUSES = [JobStatus.SCHEDULED, JobStatus.CONFIRMED];

export const jobsRouter = Router();

// geocodeSuburb caches its own results (see ttl-cache.ts) — including deduping concurrent calls for the
// same key — so no request-level dedup is needed for it. Forecasts are different: rather than one
// Open-Meteo call per suburb, every distinct suburb's coordinates are gathered up-front and looked up in
// a single batched call via getForecasts (see weather.ts) — otherwise a job list spanning a few dozen
// suburbs fires that many concurrent requests at once and trips Open-Meteo's rate limit.
//
// Any failure here (geocoding down, weather API down, a network blip) is caught unconditionally, not
// just our own GeocodingError/WeatherError — /api/jobs is the app's core data endpoint and must keep
// working even when the weather enrichment can't. A job that hits this just gets no weather reason.
async function forecastsBySuburb(
  suburbs: { suburb: string; state: AustralianState }[],
): Promise<Map<string, DailyForecast[]>> {
  const coordinatesBySuburbKey = new Map<string, Coordinates>();
  await Promise.all(
    suburbs.map(async ({ suburb, state }) => {
      try {
        coordinatesBySuburbKey.set(`${suburb}|${state}`, await geocodeSuburb(suburb, state));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`At-risk: geocoding failed for ${suburb}, ${state}: ${message}`);
      }
    }),
  );

  let forecastsByCoordinateKey = new Map<string, DailyForecast[]>();
  if (coordinatesBySuburbKey.size > 0) {
    try {
      forecastsByCoordinateKey = await getForecasts([...coordinatesBySuburbKey.values()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`At-risk: weather lookup failed for ${coordinatesBySuburbKey.size} location(s): ${message}`);
    }
  }

  const result = new Map<string, DailyForecast[]>();
  for (const [suburbKey, coordinates] of coordinatesBySuburbKey) {
    const forecasts = forecastsByCoordinateKey.get(coordinateKey(coordinates));
    if (forecasts) {
      result.set(suburbKey, forecasts);
    }
  }
  return result;
}

// Unlike forecastsBySuburb, a failure here is NOT swallowed — checkNotPublicHoliday is a hard "disallow"
// rule (not an informational one like weather/at-risk), so callers should fail the request rather than
// silently let a holiday booking through during an outage.
async function holidaysForCandidate(
  candidateStart: Date,
  state: AustralianState,
): Promise<PublicHoliday[]> {
  const year = Number(formatInTimeZone(candidateStart, STATE_TIME_ZONES[state], 'yyyy'));
  return getPublicHolidays(year);
}

jobsRouter.get('/', async (_req, res) => {
  const jobs = await prisma.job.findMany({
    orderBy: { id: 'asc' },
    include: { assignedInstaller: true },
  });

  const now = new Date();

  const scheduledJobs = jobs.filter((job) => job.scheduledStart);
  const uniqueSuburbs = new Map(
    scheduledJobs.map((job) => [`${job.suburb}|${job.state}`, { suburb: job.suburb, state: job.state }]),
  );
  const forecastsBySuburbKey = await forecastsBySuburb([...uniqueSuburbs.values()]);

  const jobsWithRisk = jobs.map((job) => {
    let forecastForDate: DailyForecast | undefined;

    if (job.scheduledStart) {
      const forecasts = forecastsBySuburbKey.get(`${job.suburb}|${job.state}`);
      if (forecasts) {
        const localDate = formatInTimeZone(job.scheduledStart, STATE_TIME_ZONES[job.state], 'yyyy-MM-dd');
        forecastForDate = forecasts.find((forecast) => forecast.date === localDate);
      }
    }

    const { isAtRisk, reasons } = evaluateAtRisk(job, forecastForDate, now);
    return { ...job, isAtRisk, atRiskReasons: reasons };
  });

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

  let holidays: PublicHoliday[];
  try {
    holidays = await holidaysForCandidate(candidateStart, job.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Assign: public holiday lookup failed for job ${job.id}: ${message}`);
    res.status(503).json({ error: 'Unable to verify public holidays right now — try again shortly' });
    return;
  }

  const violations = evaluateSchedulingRules(
    installer,
    { id: job.id, state: job.state, scheduledStart: candidateStart, durationBlocks: job.durationBlocks },
    otherJobs.map((j) => ({ id: j.id, scheduledStart: j.scheduledStart!, durationBlocks: j.durationBlocks })),
    holidays,
    new Date(),
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

  let holidays: PublicHoliday[];
  try {
    holidays = await holidaysForCandidate(effectiveScheduledStart, job.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Reschedule: public holiday lookup failed for job ${job.id}: ${message}`);
    res.status(503).json({ error: 'Unable to verify public holidays right now — try again shortly' });
    return;
  }

  const violations = evaluateSchedulingRules(
    installer,
    { id: job.id, state: job.state, scheduledStart: effectiveScheduledStart, durationBlocks: job.durationBlocks },
    otherJobs.map((j) => ({ id: j.id, scheduledStart: j.scheduledStart!, durationBlocks: j.durationBlocks })),
    holidays,
    new Date(),
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
