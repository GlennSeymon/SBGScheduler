import { describe, it, expect } from 'vitest';
import {
  checkStateMatch,
  checkWithinShift,
  checkNotOnLeave,
  checkDoubleBooking,
  evaluateSchedulingRules,
  type RuleEngineInstaller,
  type RuleEngineJob,
  type RuleEngineJobInterval,
} from './rule-engine.js';

function makeInstaller(overrides: Partial<RuleEngineInstaller> = {}): RuleEngineInstaller {
  return {
    id: 'INS-01',
    state: 'VIC',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    shiftStart: '07:00',
    shiftEnd: '17:00',
    leaveStart: null,
    leaveEnd: null,
    ...overrides,
  };
}

function makeJob(overrides: Partial<RuleEngineJob> = {}): RuleEngineJob {
  return {
    id: 'J-1001',
    state: 'VIC',
    // Mon 2026-09-21 09:00 AEST (UTC+10, before DST starts)
    scheduledStart: new Date('2026-09-21T09:00:00+10:00'),
    durationBlocks: 2,
    ...overrides,
  };
}

describe('checkStateMatch', () => {
  it('passes when installer and job states match', () => {
    expect(checkStateMatch(makeInstaller({ state: 'VIC' }), makeJob({ state: 'VIC' }))).toBeNull();
  });

  it('flags a violation when installer and job states differ', () => {
    const violation = checkStateMatch(makeInstaller({ state: 'VIC' }), makeJob({ state: 'NSW' }));
    expect(violation).toEqual({
      rule: 'STATE_MISMATCH',
      message: expect.stringContaining('VIC'),
    });
  });
});

describe('checkWithinShift', () => {
  it('passes for a job fully inside the installer shift on a working day', () => {
    expect(checkWithinShift(makeInstaller(), makeJob())).toBeNull();
  });

  it('flags a job on a non-working day', () => {
    // Sat 2026-09-19 is not in the default Mon-Fri working days.
    const job = makeJob({ scheduledStart: new Date('2026-09-19T09:00:00+10:00') });
    const violation = checkWithinShift(makeInstaller(), job);
    expect(violation?.rule).toBe('OUTSIDE_SHIFT');
  });

  it('flags a job that starts before the shift start', () => {
    const job = makeJob({ scheduledStart: new Date('2026-09-21T06:00:00+10:00') });
    const violation = checkWithinShift(makeInstaller(), job);
    expect(violation?.rule).toBe('OUTSIDE_SHIFT');
  });

  it('flags a job that ends after the shift end', () => {
    const job = makeJob({
      scheduledStart: new Date('2026-09-21T16:00:00+10:00'),
      durationBlocks: 2,
    });
    const violation = checkWithinShift(makeInstaller(), job);
    expect(violation?.rule).toBe('OUTSIDE_SHIFT');
  });

  it('resolves the same local 07:00-09:00 shift window correctly across the AEDT DST transition', () => {
    const installer = makeInstaller({ state: 'NSW' });

    // Sat 2026-10-03 is the last day of AEST (UTC+10) before DST starts at 2am Sun 2026-10-04.
    const beforeDst = makeJob({
      id: 'J-BEFORE-DST',
      state: 'NSW',
      scheduledStart: new Date('2026-10-02T07:00:00+10:00'), // Fri, still AEST
      durationBlocks: 2,
    });
    // Mon 2026-10-05 is the first working day fully inside AEDT (UTC+11).
    const afterDst = makeJob({
      id: 'J-AFTER-DST',
      state: 'NSW',
      scheduledStart: new Date('2026-10-05T07:00:00+11:00'), // Mon, now AEDT
      durationBlocks: 2,
    });

    expect(checkWithinShift(installer, beforeDst)).toBeNull();
    expect(checkWithinShift(installer, afterDst)).toBeNull();
  });
});

describe('checkNotOnLeave', () => {
  it('passes when the installer has no leave dates set', () => {
    expect(checkNotOnLeave(makeInstaller(), makeJob())).toBeNull();
  });

  it('passes when the job falls outside the leave window', () => {
    const installer = makeInstaller({
      leaveStart: new Date('2026-11-01T00:00:00Z'),
      leaveEnd: new Date('2026-11-10T00:00:00Z'),
    });
    expect(checkNotOnLeave(installer, makeJob())).toBeNull();
  });

  it('flags a job that falls inside the leave window', () => {
    const installer = makeInstaller({
      leaveStart: new Date('2026-09-20T00:00:00Z'),
      leaveEnd: new Date('2026-09-25T00:00:00Z'),
    });
    const violation = checkNotOnLeave(installer, makeJob());
    expect(violation?.rule).toBe('ON_LEAVE');
  });

  it('flags a job on the leave start/end boundary dates (inclusive)', () => {
    const installer = makeInstaller({
      leaveStart: new Date('2026-09-21T00:00:00Z'),
      leaveEnd: new Date('2026-09-21T00:00:00Z'),
    });
    const violation = checkNotOnLeave(installer, makeJob());
    expect(violation?.rule).toBe('ON_LEAVE');
  });
});

describe('checkDoubleBooking', () => {
  const job: RuleEngineJobInterval = {
    id: 'J-1001',
    scheduledStart: new Date('2026-09-21T09:00:00+10:00'),
    durationBlocks: 2,
  };

  it('passes when there are no other jobs', () => {
    expect(checkDoubleBooking(job, [])).toBeNull();
  });

  it('passes when other jobs do not overlap', () => {
    const other: RuleEngineJobInterval = {
      id: 'J-1002',
      scheduledStart: new Date('2026-09-21T11:00:00+10:00'),
      durationBlocks: 2,
    };
    expect(checkDoubleBooking(job, [other])).toBeNull();
  });

  it('flags an overlapping job', () => {
    const other: RuleEngineJobInterval = {
      id: 'J-1002',
      scheduledStart: new Date('2026-09-21T10:00:00+10:00'),
      durationBlocks: 2,
    };
    const violation = checkDoubleBooking(job, [other]);
    expect(violation).toEqual({
      rule: 'DOUBLE_BOOKING',
      message: expect.stringContaining('J-1002'),
      conflictingJobId: 'J-1002',
    });
  });

  it('excludes the job itself from the conflict search', () => {
    expect(checkDoubleBooking(job, [job])).toBeNull();
  });
});

describe('evaluateSchedulingRules', () => {
  it('returns no violations for a fully valid assignment', () => {
    expect(evaluateSchedulingRules(makeInstaller(), makeJob(), [])).toEqual([]);
  });

  it('returns all applicable violations at once, not just the first', () => {
    const installer = makeInstaller({
      state: 'NSW',
      leaveStart: new Date('2026-09-19T00:00:00Z'),
      leaveEnd: new Date('2026-09-26T00:00:00Z'),
    });
    // Different state from the installer, on a non-working day, and inside the leave window.
    const job = makeJob({ state: 'VIC', scheduledStart: new Date('2026-09-19T09:00:00+10:00') });

    const violations = evaluateSchedulingRules(installer, job, []);
    const rules = violations.map((v) => v.rule);
    expect(rules).toContain('STATE_MISMATCH');
    expect(rules).toContain('OUTSIDE_SHIFT');
    expect(rules).toContain('ON_LEAVE');
  });
});
