import axios from 'axios';
import ms from 'ms';
import type { Coordinates } from './geocoding.js';
import { TtlCache } from './ttl-cache.js';

export interface DailyForecast {
  /** Local date (yyyy-mm-dd) in the forecast location's own timezone. */
  date: string;
  weatherCode: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSumMm: number | null;
  windSpeedMaxKmh: number | null;
  /** Which model actually supplied this data — see the BOM fallback note below. */
  source: 'bom_access_global' | 'best_match';
}

interface OpenMeteoDaily {
  time: string[];
  weather_code: (number | null)[];
  precipitation_probability_max: (number | null)[];
  precipitation_sum: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}

interface OpenMeteoForecastResponse {
  daily?: OpenMeteoDaily;
}

// Open-Meteo's own forecast_days cap — 16 days out from today, in the location's local timezone.
const FORECAST_DAYS = 16;

const DAILY_VARIABLES = [
  'weather_code',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
].join(',');

export class WeatherError extends Error {}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = ms('500ms');
const RETRY_MAX_DELAY_MS = ms('5s');

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

// Open-Meteo's 429s are transient (burst throttling, not a daily cap), so a short retry with backoff
// clears most of them. Honours `Retry-After` when the server sends one, otherwise backs off on our own.
function retryDelayMs(error: unknown, attempt: number): number {
  if (axios.isAxiosError(error)) {
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const retryAfterSeconds = Number(retryAfterHeader);
    if (retryAfterHeader && !Number.isNaN(retryAfterSeconds)) {
      return Math.min(retryAfterSeconds * 1000, RETRY_MAX_DELAY_MS);
    }
  }
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
}

async function withRetryOn429<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 429 || attempt >= RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(retryDelayMs(error, attempt));
    }
  }
}

/**
 * Fetches daily forecasts for one or more locations in a single request — Open-Meteo accepts
 * comma-separated `latitude`/`longitude` lists and returns one result per location, in the same
 * order. Batching like this (rather than one request per suburb) is what keeps `/api/jobs` from
 * bursting dozens of concurrent requests at Open-Meteo and tripping its rate limit.
 */
async function fetchDailyBatch(
  coordinatesList: Coordinates[],
  model?: 'bom_access_global',
): Promise<(OpenMeteoDaily | undefined)[]> {
  if (coordinatesList.length === 0) return [];

  let response;
  try {
    response = await withRetryOn429(() =>
      axios.get<OpenMeteoForecastResponse | OpenMeteoForecastResponse[]>(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude: coordinatesList.map((c) => c.latitude).join(','),
            longitude: coordinatesList.map((c) => c.longitude).join(','),
            daily: DAILY_VARIABLES,
            forecast_days: FORECAST_DAYS,
            timezone: 'auto',
            ...(model ? { models: model } : {}),
          },
        },
      ),
    );
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new WeatherError(`Open-Meteo forecast request failed (${status ?? 'network error'})`);
  }

  // A single location comes back as one object rather than a one-element array.
  const results = Array.isArray(response.data) ? response.data : [response.data];
  return coordinatesList.map((_, i) => results[i]?.daily);
}

function isAllNull(daily: OpenMeteoDaily | undefined): boolean {
  if (!daily) return true;
  return [
    daily.weather_code,
    daily.precipitation_probability_max,
    daily.precipitation_sum,
    daily.wind_speed_10m_max,
  ].every((series) => series.every((value) => value === null));
}

function toDailyForecasts(daily: OpenMeteoDaily, source: DailyForecast['source']): DailyForecast[] {
  return daily.time.map((date, i) => ({
    date,
    weatherCode: daily.weather_code[i] ?? null,
    precipitationProbabilityMax: daily.precipitation_probability_max[i] ?? null,
    precipitationSumMm: daily.precipitation_sum[i] ?? null,
    windSpeedMaxKmh: daily.wind_speed_10m_max[i] ?? null,
    source,
  }));
}

const FORECAST_CACHE_TTL_MS = ms('30m');
const cache = new TtlCache<DailyForecast[]>(FORECAST_CACHE_TTL_MS);

// Round to ~11m precision so trivially-different floats for the same location share a cache entry.
// Exported so callers building a coordinate -> forecast lookup (e.g. jobs.ts) use the same key format.
export function coordinateKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`;
}

/**
 * lat/lon -> up to 16 days of daily forecast, for every coordinate given, cached for 30 minutes each
 * (see `ttl-cache.ts`). Only coordinates without a fresh cache entry are actually fetched, and all of
 * those are fetched in one batched Open-Meteo request (see `fetchDailyBatch`) rather than one per
 * location.
 *
 * Requests the `bom_access_global` model first (see tech-stack.md's rationale — genuinely BOM/ACCESS-G
 * sourced) but falls back to Open-Meteo's default best-match model for whichever locations come back
 * empty, which all of them currently do: BOM's open-data delivery is suspended for platform upgrades as
 * of 2026-09-15 (confirmed live — every field null for every day), and this can't be allowed to break
 * the demo if it's still down. Each entry's `source` records which model actually answered it.
 *
 * Returns a map keyed by `coordinateKey` — a coordinate with no entry means its lookup failed
 * (network error, rate limit exhausted after retries, etc.); callers should treat that as "no forecast
 * data" rather than fail the whole request.
 */
export async function getForecasts(coordinatesList: Coordinates[]): Promise<Map<string, DailyForecast[]>> {
  const uniqueByKey = new Map<string, Coordinates>();
  for (const coordinates of coordinatesList) {
    uniqueByKey.set(coordinateKey(coordinates), coordinates);
  }

  const missing: Coordinates[] = [];
  const pending = new Map<string, Promise<DailyForecast[]>>();

  for (const [key, coordinates] of uniqueByKey) {
    const fresh = cache.getIfFresh(key);
    if (fresh) {
      pending.set(key, fresh);
    } else {
      missing.push(coordinates);
    }
  }

  if (missing.length > 0) {
    const batch = fetchForecastBatch(missing);
    missing.forEach((coordinates, i) => {
      const key = coordinateKey(coordinates);
      const value = batch.then((all) => all[i]);
      cache.set(key, value);
      pending.set(key, value);
    });
  }

  const resolved = new Map<string, DailyForecast[]>();
  await Promise.all(
    Array.from(pending.entries()).map(async ([key, value]) => {
      try {
        resolved.set(key, await value);
      } catch {
        // Left out of the map — caller treats a missing key as "no forecast data".
      }
    }),
  );
  return resolved;
}

async function fetchForecastBatch(coordinatesList: Coordinates[]): Promise<DailyForecast[][]> {
  const bomDaily = await fetchDailyBatch(coordinatesList, 'bom_access_global');
  const results: DailyForecast[][] = bomDaily.map((daily) =>
    daily && !isAllNull(daily) ? toDailyForecasts(daily, 'bom_access_global') : [],
  );

  const fallbackIndices = bomDaily
    .map((daily, i) => (isAllNull(daily) ? i : -1))
    .filter((i) => i !== -1);

  if (fallbackIndices.length > 0) {
    const fallbackDaily = await fetchDailyBatch(fallbackIndices.map((i) => coordinatesList[i]));
    fallbackIndices.forEach((originalIndex, j) => {
      const daily = fallbackDaily[j];
      results[originalIndex] = daily ? toDailyForecasts(daily, 'best_match') : [];
    });
  }

  return results;
}
