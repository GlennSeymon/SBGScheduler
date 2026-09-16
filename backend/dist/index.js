import { setDefaultAutoSelectFamily } from 'net';
import * as Sentry from '@sentry/node';
import express from 'express';
import { Pool } from 'pg';
import { installersRouter } from './routes/installers.js';
import { jobsRouter } from './routes/jobs.js';
import { publicHolidaysRouter } from './routes/public-holidays.js';
import { notFoundHandler, errorHandler } from './middleware/error-handler.js';
// WSL2's virtual network adapter breaks Node's Happy Eyeballs (RFC 8305) address racing, enabled by
// default since Node 18.3: Node's own IPv4 connect attempt to some dual-stack hosts (confirmed for
// Open-Meteo's geocoding API) times out even though the exact same IP connects instantly via curl. This
// falls back to trying addresses sequentially instead, exactly like Node did before 18.3, which fixes
// the local-dev symptom (weather/geocoding lookups silently failing so no job ever shows as at-risk)
// without affecting production, where the quirk doesn't occur.
setDefaultAutoSelectFamily(false);
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