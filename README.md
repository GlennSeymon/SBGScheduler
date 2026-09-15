# SBGScheduler

An installer job scheduler for Solar Battery Group, replacing a spreadsheet-based workflow with a single
view of job status, installer availability, and weather-driven scheduling risk. Built as part of an
interview take-home. See [clientBrief.md](./clientBrief.md) for the original client brief.

> **Status:** in active development ahead of an interview deadline (2026-09-16). The deployment skeleton,
> repo tooling, data layer (Prisma schema, migrations, CSV seeding), and backend API/scheduling rule
> engine are done; the frontend UI is in progress — see the commit history for current progress. Features
> and API below describe the target scope, not all of which is built yet.

## Features

- **Jobs data grid** — dense table of all jobs with column sorting, pagination, and a status filter
- **Assign / reschedule workflow** — dialogs (React Hook Form + shared Zod validation) to assign an
  unscheduled job to an installer and time, or reassign/reschedule an already-scheduled job
- **Scheduling rule engine** — rejects invalid assignments: double-booking, installer/job state mismatch,
  outside the installer's shift hours or working days (timezone-aware), or during installer leave
- **At-risk flagging** — flags jobs with a bad weather forecast or unassigned jobs starting soon, with a
  filter and a tooltip explaining why
- **Live weather + geocoding** — Open-Meteo forecast (BOM ACCESS-G model) and geocoding, no API key
  required, cached to avoid hammering the API on every request
- **Dashboard** *(polish)* — summary cards and charts for jobs-by-status and installer utilization
- **SBG branding** — palette derived from the Solar Battery Group logo, light/dark theme toggle
- **Snackbar notifications** — success/error feedback for assign and reschedule actions
- **Skeleton loaders** *(polish)* — loading states across the UI
- **Unit tests** — React Testing Library coverage for the rule engine and at-risk calculation;
  Playwright e2e tests as time allows *(polish)*
- **Error tracking** *(polish)* — Sentry for frontend and backend

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + TypeScript, Material UI + MUI X DataGrid/Charts, Tanstack Query, React Hook Form, Axios |
| Backend | Node.js + Express + TypeScript |
| Shared | Zod schemas + inferred TS types, imported by both frontend and backend so validation is written once |
| Database | PostgreSQL (Neon), Prisma ORM |
| Weather & geocoding | [Open-Meteo](https://open-meteo.com/) forecast + geocoding APIs — free, keyless |
| Testing | React Testing Library (unit), Playwright (e2e) |
| Error tracking | Sentry |
| Hosting | Vercel — frontend static build + backend as serverless functions under `/api` |
| Tooling | npm workspaces, ESLint (flat config, typescript-eslint), Prettier |

## Prerequisites

- Node.js 24+ and npm
- A [Neon](https://neon.tech) Postgres project (or any Postgres connection string)
- No API keys needed — Open-Meteo's weather and geocoding APIs are free and keyless

## Getting Started

**1. Clone and install dependencies**

```bash
git clone https://github.com/GlennSeymon/SBGScheduler.git
cd SBGScheduler
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your Neon connection strings (both the pooled and direct/unpooled variants —
Prisma Migrate needs the direct one, since Neon's pooled connection doesn't support the advisory locks it
uses):

```
DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://.../neondb?sslmode=require"
PORT=3001
```

**3. Set up the database**

```bash
npm run db:migrate --workspace=backend   # apply Prisma migrations to Neon
npm run db:seed --workspace=backend      # seed from candidatepack_SBG/candidate/*.csv
```

**4. Run the dev servers**

```bash
npm run dev   # shared (watch build), backend, and frontend concurrently
```

Frontend: http://localhost:5173 (proxies `/api/*` to the backend)
Backend: http://localhost:3001

**5. Build / lint**

```bash
npm run build # build shared, then backend, then frontend, in that order
npm run lint  # lint all three workspaces
```

## Project Structure

```
SBGScheduler/
├── shared/            # Zod schemas + inferred types (@sbg/shared), used by frontend and backend
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma  # Installer/Job models, migrations against Neon
│   │   └── seed.ts        # Seeds Neon from candidatepack_SBG/candidate/*.csv
│   └── src/
│       ├── index.ts    # Express entry point
│       ├── lib/         # Prisma client, rule engine, Open-Meteo geocoding/weather, at-risk calc
│       ├── middleware/  # Centralized error handling
│       └── routes/      # installers, jobs (list, assign, reschedule)
├── frontend/
│   └── src/           # Vite + React app
├── candidatepack_SBG/ # Sample jobs.csv / installers.csv + data dictionary for seeding
├── vercel.json        # Vercel Services config — backend under /api, frontend serves everything else
└── .env.example
```

## Job Lifecycle

```
Unscheduled job
        │
        ▼
  Agent assigns installer + start time
        │
        ▼
  Rule engine checks: no double-booking, shift hours/working days,
  installer leave, installer/job state match
        │
        ├─── Violates a rule → rejected, reason shown inline
        │
        └─── Passes → status: Scheduled
                │
                ▼
          Status: Confirmed (or Cancelled)
                │
                ▼
          "At risk" flag applied if: bad weather forecast for the site,
          OR job is unassigned and starting soon
```

## API

All endpoints are prefixed `/api/`. The Vite dev server proxies `/api/*` to the backend, so no CORS
configuration is required in development.

| Method | Path | Description | Status |
|---|---|---|---|
| `GET` | `/api/health` | Health check — confirms the API and Neon DB are reachable | Live |
| `GET` | `/api/installers` | List installers | Live |
| `GET` | `/api/jobs` | List jobs (all fields, including at-risk flag once Phase 6 lands) | Live |
| `PATCH` | `/api/jobs/:id/assign` | Assign an unscheduled job to an installer + start time, enforcing scheduling rules | Live |
| `PATCH` | `/api/jobs/:id/reschedule` | Change time and/or installer on a scheduled job, enforcing scheduling rules | Live |

## Deployed link

https://sbg-scheduler-theta.vercel.app

## Repo

https://github.com/GlennSeymon/SBGScheduler

## License

This project is licensed under the [MIT License](LICENSE).
