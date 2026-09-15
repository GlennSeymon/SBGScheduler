import { describe, it, expect } from 'vitest';
import { checkBadWeather, checkUnassignedStartingSoon, evaluateAtRisk } from './at-risk.js';
import { JobStatus } from '../generated/enums.js';
import type { AtRiskJob } from './at-risk.js';
import type { DailyForecast } from './weather.js';

function makeForecast(overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date: '2026-09-21',
    weatherCode: 0,
    precipitationProbabilityMax: 10,
    precipitationSumMm: 0,
    windSpeedMaxKmh: 10,
    source: 'bom_access_global',
    ...overrides,
  };
}

function makeJob(overrides: Partial<AtRiskJob> = {}): AtRiskJob {
  return {
    status: JobStatus.SCHEDULED,
    scheduledStart: new Date('2026-09-21T09:00:00+10:00'),
    assignedInstallerId: 'INS-01',
    ...overrides,
  };
}

describe('checkBadWeather', () => {
  it('passes when there is no forecast for the date yet', () => {
    expect(checkBadWeather(undefined)).toBeNull();
  });

  it('passes for calm, dry, low-wind conditions', () => {
    expect(checkBadWeather(makeForecast())).toBeNull();
  });

  it('flags a severe weather code (e.g. thunderstorm)', () => {
    const violation = checkBadWeather(makeForecast({ weatherCode: 95 }));
    expect(violation?.rule).toBe('BAD_WEATHER');
    expect(violation?.message).toContain('thunderstorm');
  });

  it('does not flag a mild weather code below the severe set', () => {
    // 61 = slight rain, not in SEVERE_WEATHER_CODES
    expect(checkBadWeather(makeForecast({ weatherCode: 61 }))).toBeNull();
  });

  it('flags a high precipitation probability even with a calm weather code', () => {
    const violation = checkBadWeather(
      makeForecast({ weatherCode: 0, precipitationProbabilityMax: 70 }),
    );
    expect(violation?.rule).toBe('BAD_WEATHER');
    expect(violation?.message).toContain('70%');
  });

  it('does not flag a precipitation probability just below the threshold', () => {
    expect(checkBadWeather(makeForecast({ precipitationProbabilityMax: 69 }))).toBeNull();
  });

  it('flags high wind speed even with a calm weather code', () => {
    const violation = checkBadWeather(makeForecast({ windSpeedMaxKmh: 40 }));
    expect(violation?.rule).toBe('BAD_WEATHER');
    expect(violation?.message).toContain('40');
  });

  it('does not flag a wind speed just below the threshold', () => {
    expect(checkBadWeather(makeForecast({ windSpeedMaxKmh: 39 }))).toBeNull();
  });
});

describe('checkUnassignedStartingSoon', () => {
  const now = new Date('2026-09-21T00:00:00Z');

  it('passes when the job already has an installer assigned', () => {
    const job = makeJob({ assignedInstallerId: 'INS-01', scheduledStart: now });
    expect(checkUnassignedStartingSoon(job, now)).toBeNull();
  });

  it('passes when the job has no scheduled start (unscheduled)', () => {
    const job = makeJob({ assignedInstallerId: null, scheduledStart: null });
    expect(checkUnassignedStartingSoon(job, now)).toBeNull();
  });

  it('passes when the job is cancelled, regardless of assignment/timing', () => {
    const job = makeJob({
      status: JobStatus.CANCELLED,
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() - 1000),
    });
    expect(checkUnassignedStartingSoon(job, now)).toBeNull();
  });

  it('passes when unassigned but starting well beyond the 3-day window', () => {
    const job = makeJob({
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    });
    expect(checkUnassignedStartingSoon(job, now)).toBeNull();
  });

  it('flags an unassigned job starting within the 3-day window', () => {
    const job = makeJob({
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    const violation = checkUnassignedStartingSoon(job, now);
    expect(violation?.rule).toBe('UNASSIGNED_STARTING_SOON');
    expect(violation?.message).toContain('starts within');
  });

  it('flags an unassigned job whose start time has already passed', () => {
    const job = makeJob({
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    });
    const violation = checkUnassignedStartingSoon(job, now);
    expect(violation?.rule).toBe('UNASSIGNED_STARTING_SOON');
    expect(violation?.message).toBe('Job was due to start but still has no installer assigned');
  });
});

describe('evaluateAtRisk', () => {
  const now = new Date('2026-09-21T00:00:00Z');

  it('is not at risk when neither check fires', () => {
    const result = evaluateAtRisk(makeJob(), makeForecast(), now);
    expect(result).toEqual({ isAtRisk: false, reasons: [] });
  });

  it('is at risk with a single reason when only weather is bad', () => {
    const result = evaluateAtRisk(makeJob(), makeForecast({ weatherCode: 95 }), now);
    expect(result.isAtRisk).toBe(true);
    expect(result.reasons.map((r) => r.rule)).toEqual(['BAD_WEATHER']);
  });

  it('is at risk with both reasons when weather is bad and the job is unassigned-and-soon', () => {
    const job = makeJob({
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    const result = evaluateAtRisk(job, makeForecast({ weatherCode: 95 }), now);
    expect(result.isAtRisk).toBe(true);
    expect(result.reasons.map((r) => r.rule).sort()).toEqual(
      ['BAD_WEATHER', 'UNASSIGNED_STARTING_SOON'].sort(),
    );
  });

  it('is never at risk for a cancelled job, even with bad weather and no installer', () => {
    const job = makeJob({
      status: JobStatus.CANCELLED,
      assignedInstallerId: null,
      scheduledStart: new Date(now.getTime() + 1000),
    });
    const result = evaluateAtRisk(job, makeForecast({ weatherCode: 95 }), now);
    expect(result).toEqual({ isAtRisk: false, reasons: [] });
  });

  it('defaults `now` to the current time when not provided', () => {
    const result = evaluateAtRisk(makeJob(), undefined);
    expect(result).toEqual({ isAtRisk: false, reasons: [] });
  });
});
