import { config } from 'dotenv';

config({ path: ['../.env.local', '../.env'] });

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/client.js';
import { AustralianState, JobType, JobStatus } from '../src/generated/enums.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../candidatepack_SBG/candidate');

const JOB_TYPE_BY_CSV_VALUE: Record<string, JobType> = {
  'Battery install': JobType.BATTERY_INSTALL,
  'Solar + battery': JobType.SOLAR_BATTERY,
  'Battery upgrade': JobType.BATTERY_UPGRADE,
};

const JOB_STATUS_BY_CSV_VALUE: Record<string, JobStatus> = {
  unscheduled: JobStatus.UNSCHEDULED,
  scheduled: JobStatus.SCHEDULED,
  confirmed: JobStatus.CONFIRMED,
  cancelled: JobStatus.CANCELLED,
};

interface InstallerRow {
  installer_id: string;
  name: string;
  state: string;
  home_base: string;
  working_days: string;
  shift_start: string;
  shift_end: string;
  leave_start: string;
  leave_end: string;
  phone: string;
}

interface JobRow {
  job_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  site_address: string;
  suburb: string;
  state: string;
  postcode: string;
  job_type: string;
  battery_model: string;
  scheduled_start: string;
  duration_blocks: string;
  status: string;
  assigned_installer_id: string;
  notes: string;
  created_at: string;
}

function parseCsv<T>(filename: string): T[] {
  const raw = readFileSync(path.join(dataDir, filename), 'utf-8');
  return parse(raw, { columns: true, skip_empty_lines: true }) as T[];
}

async function main() {
  const installerRows = parseCsv<InstallerRow>('installers.csv');
  const jobRows = parseCsv<JobRow>('jobs.csv');

  // Children first to satisfy the Job -> Installer foreign key on the way out.
  await prisma.job.deleteMany();
  await prisma.installer.deleteMany();

  await prisma.installer.createMany({
    data: installerRows.map((row) => ({
      id: row.installer_id,
      name: row.name,
      state: row.state as AustralianState,
      homeBase: row.home_base,
      workingDays: row.working_days.split(','),
      shiftStart: row.shift_start,
      shiftEnd: row.shift_end,
      leaveStart: row.leave_start ? new Date(row.leave_start) : null,
      leaveEnd: row.leave_end ? new Date(row.leave_end) : null,
      phone: row.phone,
    })),
  });

  await prisma.job.createMany({
    data: jobRows.map((row) => ({
      id: row.job_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      customerEmail: row.customer_email,
      siteAddress: row.site_address,
      suburb: row.suburb,
      state: row.state as AustralianState,
      postcode: row.postcode,
      jobType: JOB_TYPE_BY_CSV_VALUE[row.job_type],
      batteryModel: row.battery_model,
      scheduledStart: row.scheduled_start ? new Date(row.scheduled_start) : null,
      durationBlocks: Number(row.duration_blocks),
      status: JOB_STATUS_BY_CSV_VALUE[row.status],
      assignedInstallerId: row.assigned_installer_id || null,
      notes: row.notes || null,
      createdAt: new Date(row.created_at),
    })),
  });

  const installerCount = await prisma.installer.count();
  const jobCount = await prisma.job.count();
  console.log(`Seeded ${installerCount} installers and ${jobCount} jobs.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
