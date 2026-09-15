import * as Sentry from '@sentry/node';
import express from 'express';
import { Pool } from 'pg';
import { installersRouter } from './routes/installers.js';
import { jobsRouter } from './routes/jobs.js';
import { publicHolidaysRouter } from './routes/public-holidays.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.VERCEL_ENV ?? 'development' });
}
const app = express();
const port = process.env.PORT ?? 3001;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
app.use('/api/installers', installersRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/public-holidays', publicHolidaysRouter);
app.get('/api/health', async (_req, res) => {
    try {
        await pool.query('SELECT 1');
        const body = { status: 'ok', db: 'ok' };
        res.json(body);
    }
    catch (err) {
        console.error('Health check DB query failed:', err);
        const body = { status: 'ok', db: 'error' };
        res.status(503).json(body);
    }
});
app.use(notFoundHandler);
app.use(errorHandler);
app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map