import { config } from 'dotenv';

// Prisma ORM 7 doesn't load .env files automatically, and the Vercel CLI writes
// `.env.local` (not `.env`) at the repo root.
config({ path: ['../.env.local', '../.env'] });

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Migrations/introspection need a direct connection — Neon's pooled (pgbouncer)
  // connection doesn't support the advisory locks Prisma Migrate uses.
  datasource: {
    url: env('DATABASE_URL_UNPOOLED'),
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
