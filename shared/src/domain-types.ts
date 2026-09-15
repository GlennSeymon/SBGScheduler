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
