import axios from 'axios';
import ms from 'ms';
import { AustralianState } from '../generated/enums.js';
import { TtlCache } from './ttl-cache.js';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface OpenMeteoGeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoGeocodingResult[];
}

// GeoNames admin1 names, as returned by Open-Meteo's geocoding API, keyed by our state abbreviation —
// needed to disambiguate suburb names that recur across states (e.g. Richmond in both NSW and VIC).
const STATE_ADMIN1_NAMES: Record<AustralianState, string> = {
  NSW: 'New South Wales',
  VIC: 'Victoria',
  QLD: 'Queensland',
  SA: 'South Australia',
  WA: 'Western Australia',
  TAS: 'Tasmania',
  NT: 'Northern Territory',
  ACT: 'Australian Capital Territory',
};

export class GeocodingError extends Error {}

// A suburb's coordinates don't change, so a long TTL is fine — this just avoids re-hitting Open-Meteo's
// geocoding API for the same suburb on every request.
const GEOCODING_CACHE_TTL_MS = ms('1d');
const cache = new TtlCache<Coordinates>(GEOCODING_CACHE_TTL_MS);

export async function geocodeSuburb(suburb: string, state: AustralianState): Promise<Coordinates> {
  return cache.getOrCompute(`${suburb}|${state}`, () => fetchCoordinates(suburb, state));
}

async function fetchCoordinates(suburb: string, state: AustralianState): Promise<Coordinates> {
  let response;
  try {
    response = await axios.get<OpenMeteoGeocodingResponse>(
      'https://geocoding-api.open-meteo.com/v1/search',
      { params: { name: suburb, count: 20, countryCode: 'AU' } },
    );
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new GeocodingError(
      `Open-Meteo geocoding request failed (${status ?? 'network error'}) for "${suburb}, ${state}"`,
    );
  }

  const results = response.data.results ?? [];
  if (results.length === 0) {
    throw new GeocodingError(`No geocoding results for "${suburb}, ${state}"`);
  }

  // Open-Meteo's `name` search also returns prefix matches (e.g. "Richmond Hill" for "Richmond") —
  // prefer an exact name match, since a wrong nearby suburb would silently skew the weather lookup.
  const exactMatches = results.filter(
    (result) => result.name.toLowerCase() === suburb.toLowerCase(),
  );
  const candidates = exactMatches.length > 0 ? exactMatches : results;

  const expectedAdmin1 = STATE_ADMIN1_NAMES[state];
  const match = candidates.find((result) => result.admin1 === expectedAdmin1) ?? candidates[0];

  return { latitude: match.latitude, longitude: match.longitude };
}
