import { config } from 'dotenv';

// Vercel injects env vars directly in production; locally, `.env.local` (written by
// the Vercel CLI) needs loading explicitly since Node/tsx don't do it automatically.
config({ path: ['../.env.local', '../.env'] });

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client.js';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
