import { JobStatus } from '../generated/enums.js';
import type { DailyForecast } from './weather.js';

// WMO weather codes (as returned by Open-Meteo) severe enough to plausibly delay outdoor rooftop
// electrical work: rain showers (moderate→violent), heavy/freezing rain, heavy snow, any thunderstorm.
const SEVERE_WEATHER_CODES = new Set([65, 66, 67, 75, 80, 81, 82, 86, 95, 96, 99]);
const WEATHER_CODE_LABELS: Record<number, string> = {
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'heavy freezing rain',
  75: 'heavy snow',
  80: 'rain showers',
  81: 'moderate rain showers',
  82: 'violent rain showers',
  86: 'heavy snow showers',
  95: 'a thunderstorm',
  96: 'a thunderstorm with hail',
  99: 'a severe thunderstorm with hail',
};

const HIGH_PRECIPITATION_PROBABILITY_PERCENT = 70;
const HIGH_WIND_SPEED_KMH = 40;

export const UNASSIGNED_STARTING_SOON_HOURS = 72;

export interface AtRiskJob {
  status: JobStatus;
  scheduledStart: Date | null;
  assignedInstallerId: string | null;
}

export type AtRiskReason =
  | { rule: 'BAD_WEATHER'; message: string }
  | { rule: 'UNASSIGNED_STARTING_SOON'; message: string };

export interface AtRiskResult {
  isAtRisk: boolean;
  reasons: AtRiskReason[];
}

function describeForecast(forecast: DailyForecast): string {
  const parts: string[] = [];
  if (forecast.weatherCode !== null && WEATHER_CODE_LABELS[forecast.weatherCode]) {
    parts.push(WEATHER_CODE_LABELS[forecast.weatherCode]);
  }
  if (
    forecast.precipitationProbabilityMax !== null &&
    forecast.precipitationProbabilityMax >= HIGH_PRECIPITATION_PROBABILITY_PERCENT
  ) {
    parts.push(`${forecast.precipitationProbabilityMax}% chance of rain`);
  }
  if (forecast.windSpeedMaxKmh !== null && forecast.windSpeedMaxKmh >= HIGH_WIND_SPEED_KMH) {
    parts.push(`winds up to ${forecast.windSpeedMaxKmh} km/h`);
  }
  return parts.length > 0 ? parts.join(', ') : 'poor conditions';
}

/**
 * `forecast` is the specific day matching the job's `scheduledStart` — pass `undefined` when there's no
 * forecast for that date yet (Open-Meteo only covers ~16 days out; see weather.ts), which correctly
 * yields no weather violation rather than an error.
 */
export function checkBadWeather(forecast: DailyForecast | undefined): AtRiskReason | null {
  if (!forecast) return null;

  const isSevere = forecast.weatherCode !== null && SEVERE_WEATHER_CODES.has(forecast.weatherCode);
  const isHighRainChance =
    forecast.precipitationProbabilityMax !== null &&
    forecast.precipitationProbabilityMax >= HIGH_PRECIPITATION_PROBABILITY_PERCENT;
  const isHighWind =
    forecast.windSpeedMaxKmh !== null && forecast.windSpeedMaxKmh >= HIGH_WIND_SPEED_KMH;

  if (!isSevere && !isHighRainChance && !isHighWind) return null;

  return {
    rule: 'BAD_WEATHER',
    message: `Forecast for ${forecast.date} shows ${describeForecast(forecast)} — installation may be delayed`,
  };
}

export function checkUnassignedStartingSoon(job: AtRiskJob, now: Date): AtRiskReason | null {
  if (job.status === JobStatus.CANCELLED) return null;
  if (job.assignedInstallerId !== null) return null;
  if (job.scheduledStart === null) return null;

  const hoursUntilStart = (job.scheduledStart.getTime() - now.getTime()) / (60 * 60 * 1000);
  if (hoursUntilStart > UNASSIGNED_STARTING_SOON_HOURS) return null;

  return {
    rule: 'UNASSIGNED_STARTING_SOON',
    message:
      hoursUntilStart < 0
        ? 'Job was due to start but still has no installer assigned'
        : `Job starts within ${UNASSIGNED_STARTING_SOON_HOURS / 24} days and still has no installer assigned`,
  };
}

export function evaluateAtRisk(
  job: AtRiskJob,
  forecast: DailyForecast | undefined,
  now: Date = new Date(),
): AtRiskResult {
  if (job.status === JobStatus.CANCELLED) {
    return { isAtRisk: false, reasons: [] };
  }

  const reasons = [checkBadWeather(forecast), checkUnassignedStartingSoon(job, now)].filter(
    (reason): reason is AtRiskReason => reason !== null,
  );

  return { isAtRisk: reasons.length > 0, reasons };
}
