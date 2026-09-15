// Wire shapes for the /api/installers and /api/jobs responses — mirrors the Prisma models in
// backend/prisma/schema.prisma, but with dates as ISO strings (JSON, not Prisma's Date objects).

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'SA' | 'WA' | 'NT' | 'TAS' | 'ACT';

export type JobType = 'BATTERY_INSTALL' | 'SOLAR_BATTERY' | 'BATTERY_UPGRADE';

export type JobStatus = 'UNSCHEDULED' | 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED';

export interface Installer {
  id: string;
  name: string;
  state: AustralianState;
  homeBase: string;
  workingDays: string[];
  shiftStart: string;
  shiftEnd: string;
  leaveStart: string | null;
  leaveEnd: string | null;
  phone: string;
}

export interface Job {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  siteAddress: string;
  suburb: string;
  state: AustralianState;
  postcode: string;
  jobType: JobType;
  batteryModel: string;
  scheduledStart: string | null;
  durationBlocks: number;
  status: JobStatus;
  assignedInstallerId: string | null;
  assignedInstaller: Installer | null;
  notes: string | null;
  createdAt: string;
}

export type AtRiskRule = 'BAD_WEATHER' | 'UNASSIGNED_STARTING_SOON';

export interface AtRiskReason {
  rule: AtRiskRule;
  message: string;
}

// GET /api/jobs enriches each job with at-risk info (see Phase 6); the assign/reschedule PATCH
// responses don't, so they stay typed as plain `Job`.
export interface JobWithRisk extends Job {
  isAtRisk: boolean;
  atRiskReasons: AtRiskReason[];
}
