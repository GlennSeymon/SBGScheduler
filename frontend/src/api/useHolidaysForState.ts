import { useMemo } from 'react';
import type { AustralianState } from '@sbg/shared';
import { usePublicHolidays } from './usePublicHolidays';

// A national holiday (states: null) applies everywhere; otherwise only to the listed states. Returns a
// Map (not a Set) so the calendar can show each holiday's name, not just flag the date.
export function useHolidaysForState(state: AustralianState) {
  const { data: holidays } = usePublicHolidays();

  return useMemo(() => {
    const applicable = (holidays ?? []).filter(
      (holiday) => holiday.states === null || holiday.states.includes(state),
    );
    return new Map(applicable.map((holiday) => [holiday.date, holiday.name]));
  }, [holidays, state]);
}
