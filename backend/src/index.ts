import express from 'express';
import { Pool } from 'pg';
import type { HealthResponse } from '@sbg/shared';
import { installersRouter } from './routes/installers.js';
import { jobsRouter } from './routes/jobs.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';

const app = express();
const port = process.env.PORT ?? 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());

app.use('/api/installers', installersRouter);
app.use('/api/jobs', jobsRouter);

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    const body: HealthResponse = { status: 'ok', db: 'ok' };
    res.json(body);
  } catch (err) {
    console.error('Health check DB query failed:', err);
    const body: HealthResponse = { status: 'ok', db: 'error' };
    res.status(503).json(body);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
