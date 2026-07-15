import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isDbUnavailable } from '../utils/fallbacks';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Endpoint not found' });
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const flattened = err.flatten();
    const firstFieldError = Object.entries(flattened.fieldErrors).flatMap(([field, messages]) => (messages || []).map((message) => `${field}: ${message}`))[0];
    return res.status(400).json({ message: firstFieldError || flattened.formErrors[0] || 'Validation failed', errors: flattened });
  }
  if (isDbUnavailable(err)) {
    return res.status(503).json({
      message: 'Database is not reachable on port 5434. Open Docker Desktop, wait until PostgreSQL is ready, then run START_ALL.bat again.',
      code: 'DATABASE_UNAVAILABLE'
    });
  }
  if (err?.code === '23505') return res.status(409).json({ message: 'A record with the same unique value already exists.' });
  if (err?.code === '23503') return res.status(400).json({ message: 'The selected related record does not exist or is still in use.' });
  if (err?.code === '23514' || err?.code === '22P02') return res.status(400).json({ message: 'The submitted value is not valid for this field.' });
  const status = Number(err.status || 500);
  const message = status >= 500 ? 'Internal server error' : err.message;
  if (status >= 500) console.error(err);
  return res.status(status).json({ message });
}
