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

async function fetchDaily(
  coordinates: Coordinates,
  model?: 'bom_access_global',
): Promise<OpenMeteoDaily | undefined> {
  let response;
  try {
    response = await axios.get<OpenMeteoForecastResponse>('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        daily: DAILY_VARIABLES,
        forecast_days: FORECAST_DAYS,
        timezone: 'auto',
        ...(model ? { models: model } : {}),
      },
    });
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new WeatherError(`Open-Meteo forecast request failed (${status ?? 'network error'})`);
  }

  return response.data.daily;
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

const FORECAST_CACHE_TTL_MS = ms('30m');
const cache = new TtlCache<DailyForecast[]>(FORECAST_CACHE_TTL_MS);

/**
 * lat/lon -> up to 16 days of daily forecast. Requests the `bom_access_global` model first (see
 * tech-stack.md's rationale — genuinely BOM/ACCESS-G sourced) but falls back to Open-Meteo's
 * default best-match model when BOM's feed comes back empty, which it currently does: BOM's
 * open-data delivery is suspended for platform upgrades as of 2026-09-15 (confirmed live — every
 * field null for every day), and this can't be allowed to break the demo if it's still down
 * tomorrow. `source` on each entry records which model actually answered.
 *
 * Cached for 30 minutes per coordinate — long enough to avoid re-hitting Open-Meteo on every
 * `/api/jobs` poll, short enough that the forecast doesn't go stale for long.
 */
export async function getForecast(coordinates: Coordinates): Promise<DailyForecast[]> {
  // Round to ~11m precision so trivially-different floats for the same location share a cache entry.
  const key = `${coordinates.latitude.toFixed(4)},${coordinates.longitude.toFixed(4)}`;
  return cache.getOrCompute(key, () => fetchForecast(coordinates));
}

async function fetchForecast(coordinates: Coordinates): Promise<DailyForecast[]> {
  let daily = await fetchDaily(coordinates, 'bom_access_global');
  let source: DailyForecast['source'] = 'bom_access_global';

  if (isAllNull(daily)) {
    daily = await fetchDaily(coordinates);
    source = 'best_match';
  }

  if (!daily) {
    throw new WeatherError('Open-Meteo returned no forecast data');
  }

  return daily.time.map((date, i) => ({
    date,
    weatherCode: daily.weather_code[i] ?? null,
    precipitationProbabilityMax: daily.precipitation_probability_max[i] ?? null,
    precipitationSumMm: daily.precipitation_sum[i] ?? null,
    windSpeedMaxKmh: daily.wind_speed_10m_max[i] ?? null,
    source,
  }));
}
