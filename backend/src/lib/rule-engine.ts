import { formatInTimeZone } from 'date-fns-tz';
import { AustralianState } from '../generated/enums.js';
import type { PublicHoliday } from './public-holidays.js';

// See tech-stack.md → Timezone handling for why each state keeps its own zone (not all NSW's).
export const STATE_TIME_ZONES: Record<AustralianState, string> = {
  NSW: 'Australia/Sydney',
  VIC: 'Australia/Melbourne',
  TAS: 'Australia/Hobart',
  ACT: 'Australia/Sydney',
  QLD: 'Australia/Brisbane',
  SA: 'Australia/Adelaide',
  WA: 'Australia/Perth',
  NT: 'Australia/Darwin',
};

export interface RuleEngineInstaller {
  id: string;
  state: AustralianState;
  workingDays: string[];
  shiftStart: string;
  shiftEnd: string;
  leaveStart: Date | null;
  leaveEnd: Date | null;
}

export interface RuleEngineJob {
  id: string;
  state: AustralianState;
  scheduledStart: Date;
  durationBlocks: number;
}

export interface RuleEngineJobInterval {
  id: string;
  scheduledStart: Date;
  durationBlocks: number;
}

export type RuleViolation =
  | { rule: 'STATE_MISMATCH'; message: string }
  | { rule: 'OUTSIDE_SHIFT'; message: string }
  | { rule: 'ON_LEAVE'; message: string }
  | { rule: 'DOUBLE_BOOKING'; message: string; conflictingJobId: string }
  | { rule: 'PUBLIC_HOLIDAY'; message: string; holidayName: string }
  | { rule: 'IN_PAST'; message: string };

function jobIntervalMs(job: RuleEngineJobInterval): { start: number; end: number } {
  const start = job.scheduledStart.getTime();
  return { start, end: start + job.durationBlocks * 60 * 60 * 1000 };
}

export function checkStateMatch(
  installer: RuleEngineInstaller,
  job: RuleEngineJob,
): RuleViolation | null {
  if (installer.state === job.state) return null;
  return {
    rule: 'STATE_MISMATCH',
    message: `Installer ${installer.id} operates in ${installer.state}, but job ${job.id} is in ${job.state} — installers don't cross state lines`,
  };
}

export function checkWithinShift(
  installer: RuleEngineInstaller,
  job: RuleEngineJob,
): RuleViolation | null {
  const timeZone = STATE_TIME_ZONES[installer.state];
  const { start, end } = jobIntervalMs(job);
  const startDate = new Date(start);
  const endDate = new Date(end);

  const startDay = formatInTimeZone(startDate, timeZone, 'EEE');
  if (!installer.workingDays.includes(startDay)) {
    return {
      rule: 'OUTSIDE_SHIFT',
      message: `Installer ${installer.id} doesn't work ${startDay}s (working days: ${installer.workingDays.join(', ')})`,
    };
  }

  const startTime = formatInTimeZone(startDate, timeZone, 'HH:mm');
  const endTime = formatInTimeZone(endDate, timeZone, 'HH:mm');
  const endDay = formatInTimeZone(endDate, timeZone, 'EEE');

  if (endDay !== startDay || startTime < installer.shiftStart || endTime > installer.shiftEnd) {
    return {
      rule: 'OUTSIDE_SHIFT',
      message: `Job runs ${startTime}–${endTime} local time, outside installer ${installer.id}'s shift (${installer.shiftStart}–${installer.shiftEnd})`,
    };
  }

  return null;
}

export function checkNotOnLeave(
  installer: RuleEngineInstaller,
  job: RuleEngineJob,
): RuleViolation | null {
  if (!installer.leaveStart || !installer.leaveEnd) return null;

  const timeZone = STATE_TIME_ZONES[installer.state];
  const jobLocalDate = formatInTimeZone(job.scheduledStart, timeZone, 'yyyy-MM-dd');
  // leaveStart/leaveEnd are plain calendar dates (no time-of-day), so compare directly.
  const leaveStartDate = installer.leaveStart.toISOString().slice(0, 10);
  const leaveEndDate = installer.leaveEnd.toISOString().slice(0, 10);

  if (jobLocalDate < leaveStartDate || jobLocalDate > leaveEndDate) return null;

  return {
    rule: 'ON_LEAVE',
    message: `Installer ${installer.id} is on leave from ${leaveStartDate} to ${leaveEndDate}`,
  };
}

export function checkDoubleBooking(
  job: RuleEngineJobInterval,
  otherInstallerJobs: RuleEngineJobInterval[],
): RuleViolation | null {
  const candidate = jobIntervalMs(job);
  const conflict = otherInstallerJobs.find((other) => {
    if (other.id === job.id) return false;
    const otherInterval = jobIntervalMs(other);
    return candidate.start < otherInterval.end && otherInterval.start < candidate.end;
  });
  if (!conflict) return null;

  return {
    rule: 'DOUBLE_BOOKING',
    message: `Installer already has an overlapping job (${conflict.id}) at this time`,
    conflictingJobId: conflict.id,
  };
}

// Checked against the job's own state/timezone — not the installer's — since that's the state the
// holiday actually applies to (checkStateMatch already guarantees the two are equal by the time an
// installer is eligible to be assigned).
export function checkNotPublicHoliday(
  job: RuleEngineJob,
  holidays: PublicHoliday[],
): RuleViolation | null {
  const timeZone = STATE_TIME_ZONES[job.state];
  const jobLocalDate = formatInTimeZone(job.scheduledStart, timeZone, 'yyyy-MM-dd');

  const match = holidays.find(
    (holiday) =>
      holiday.date === jobLocalDate && (holiday.states === null || holiday.states.includes(job.state)),
  );
  if (!match) return null;

  return {
    rule: 'PUBLIC_HOLIDAY',
    message: `${match.name} is a public holiday in ${job.state} on ${jobLocalDate} — jobs can't be scheduled that day`,
    holidayName: match.name,
  };
}

export function checkNotInPast(job: RuleEngineJob, now: Date): RuleViolation | null {
  if (job.scheduledStart.getTime() >= now.getTime()) return null;

  return {
    rule: 'IN_PAST',
    message: `Job ${job.id} can't be scheduled in the past (${job.scheduledStart.toISOString()})`,
  };
}

export function evaluateSchedulingRules(
  installer: RuleEngineInstaller,
  job: RuleEngineJob,
  otherInstallerJobs: RuleEngineJobInterval[],
  holidays: PublicHoliday[],
  now: Date,
): RuleViolation[] {
  return [
    checkStateMatch(installer, job),
    checkWithinShift(installer, job),
    checkNotOnLeave(installer, job),
    checkDoubleBooking(job, otherInstallerJobs),
    checkNotPublicHoliday(job, holidays),
    checkNotInPast(job, now),
  ].filter((violation): violation is RuleViolation => violation !== null);
}
