# Data dictionary

Export from our scheduling system covering 2026-09-28 to 2026-10-11.
Treat it as you would real operational data. All names and addresses are fictional.

## jobs.csv
| Column | Meaning |
|---|---|
| job_id | Unique job reference |
| customer_name, customer_phone, customer_email | Customer contact details |
| site_address, suburb, state, postcode | Installation address |
| job_type | Battery install / Solar + battery / Battery upgrade |
| battery_model | Battery capacity being installed |
| scheduled_start | Scheduled start of the job, ISO 8601. Blank if not yet scheduled |
| duration_blocks | Expected duration in blocks. One block = one hour |
| status | unscheduled / scheduled / confirmed / cancelled |
| assigned_installer_id | Links to installers.csv. Blank if unassigned |
| notes | Free-text notes from the scheduling team |
| created_at | Date the job was created in the CRM |

## installers.csv
| Column | Meaning |
|---|---|
| installer_id | Unique installer reference |
| name, phone | Contact details |
| state | State they operate in. Installers do not cross state lines |
| home_base | Suburb they start each day from |
| working_days | Days they are available to work |
| shift_start, shift_end | Working hours, local time |
| leave_start, leave_end | Approved leave (inclusive). Blank if none in this period |

An installer can only be on one job at a time.
