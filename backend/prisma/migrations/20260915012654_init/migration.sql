-- CreateEnum
CREATE TYPE "AustralianState" AS ENUM ('NSW', 'VIC', 'QLD', 'SA', 'WA', 'NT', 'TAS', 'ACT');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('Battery install', 'Solar + battery', 'Battery upgrade');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('unscheduled', 'scheduled', 'confirmed', 'cancelled');

-- CreateTable
CREATE TABLE "installers" (
    "installer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" "AustralianState" NOT NULL,
    "home_base" TEXT NOT NULL,
    "working_days" TEXT[],
    "shift_start" TEXT NOT NULL,
    "shift_end" TEXT NOT NULL,
    "leave_start" DATE,
    "leave_end" DATE,
    "phone" TEXT NOT NULL,

    CONSTRAINT "installers_pkey" PRIMARY KEY ("installer_id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "job_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "site_address" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "state" "AustralianState" NOT NULL,
    "postcode" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "battery_model" TEXT NOT NULL,
    "scheduled_start" TIMESTAMPTZ(3),
    "duration_blocks" INTEGER NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'unscheduled',
    "assigned_installer_id" TEXT,
    "notes" TEXT,
    "created_at" DATE NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("job_id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_assigned_installer_id_scheduled_start_idx" ON "jobs"("assigned_installer_id", "scheduled_start");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assigned_installer_id_fkey" FOREIGN KEY ("assigned_installer_id") REFERENCES "installers"("installer_id") ON DELETE SET NULL ON UPDATE CASCADE;
