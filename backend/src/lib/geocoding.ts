import { AustralianState } from '../generated/enums.js';

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

export async function geocodeSuburb(
  suburb: string,
  state: AustralianState,
): Promise<Coordinates> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', suburb);
  url.searchParams.set('count', '20');
  url.searchParams.set('countryCode', 'AU');

  const response = await fetch(url);
  if (!response.ok) {
    throw new GeocodingError(
      `Open-Meteo geocoding request failed (${response.status}) for "${suburb}, ${state}"`,
    );
  }

  const data = (await response.json()) as OpenMeteoGeocodingResponse;
  const results = data.results ?? [];
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
