export interface HealthResponse {
  status: 'ok';
  db: 'ok' | 'error';
}

export * from './job-schemas.js';
