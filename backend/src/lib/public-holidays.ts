import axios from 'axios';
import ms from 'ms';
import { AustralianState } from '../generated/enums.js';
import { TtlCache } from './ttl-cache.js';

export interface PublicHoliday {
  date: string; // yyyy-MM-dd, local to the holiday's jurisdiction
  name: string;
  states: AustralianState[] | null; // null = applies everywhere (national)
}

interface NagerHoliday {
  date: string;
  name: string;
  countryCode: string;
  nationalHoliday: boolean;
  subdivisionCodes: string[] | null;
  holidayTypes: string[];
}

export class PublicHolidayError extends Error {}

const AUSTRALIAN_STATES: readonly AustralianState[] = [
  'NSW',
  'VIC',
  'QLD',
  'SA',
  'WA',
  'NT',
  'TAS',
  'ACT',
];

// A year's public holiday calendar is essentially immutable once published, so a long TTL just avoids
// re-hitting Nager on every request.
const PUBLIC_HOLIDAY_CACHE_TTL_MS = ms('1d');
const cache = new TtlCache<PublicHoliday[]>(PUBLIC_HOLIDAY_CACHE_TTL_MS);

export async function getPublicHolidays(year: number): Promise<PublicHoliday[]> {
  return cache.getOrCompute(String(year), () => fetchHolidays(year));
}

async function fetchHolidays(year: number): Promise<PublicHoliday[]> {
  let response;
  try {
    response = await axios.get<unknown>(`https://nagerholidays.com/api/v4/Holidays/AU/${year}`);
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    throw new PublicHolidayError(`Nager holidays request failed (${status ?? 'network error'}) for AU/${year}`);
  }

  const data = response.data;
  if (!Array.isArray(data)) {
    throw new PublicHolidayError(`Unexpected Nager holidays response shape for AU/${year}`);
  }

  return (data as NagerHoliday[])
    .filter((holiday) => holiday.holidayTypes.includes('Public'))
    .map((holiday) => ({
      date: holiday.date,
      name: holiday.name,
      states: normaliseSubdivisionCodes(holiday.subdivisionCodes),
    }));
}

// Nager subdivision codes are ISO 3166-2 (e.g. "AU-VIC"); strip the country prefix and drop anything
// that isn't one of our recognised states rather than crash on an unexpected code. `null` here means
// "applies everywhere" (only when Nager itself reported no subdivisions) — an empty array (unrecognised
// codes only) deliberately stays distinct from that, so it never matches any real state.
function normaliseSubdivisionCodes(subdivisionCodes: string[] | null): AustralianState[] | null {
  if (!subdivisionCodes) return null;

  return subdivisionCodes
    .map((code) => code.replace(/^AU-/, ''))
    .filter((code): code is AustralianState => AUSTRALIAN_STATES.includes(code as AustralianState));
}
