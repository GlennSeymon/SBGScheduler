import * as Sentry from '@sentry/node';
import type { NextFunction, Request, Response } from 'express';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// Express 5 forwards thrown errors and rejected promises from async handlers here automatically.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  console.error('Unhandled error:', err);
  Sentry.captureException(err);
  res.status(500).json({ error: 'Internal server error' });
}
