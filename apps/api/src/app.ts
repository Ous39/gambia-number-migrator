import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import crypto from 'node:crypto';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { operatorsRouter } from './routes/operators';
import { teamRouter } from './routes/team';
import { requireAdmin, requireAdminAreaAccess } from './middleware/auth';
import { migrationRulesRouter } from './routes/migrationRules';
import { transitionSettingsRouter } from './routes/transitionSettings';
import { appConfigRouter } from './routes/appConfig';
import { paymentsRouter } from './routes/payments';
import { accessCodesRouter } from './routes/accessCodes';
import { auditLogsRouter } from './routes/auditLogs';
import { healthRouter } from './routes/health';
import { dashboardRouter } from './routes/dashboard';
import { devicesRouter } from './routes/devices';
import { notificationsRouter } from './routes/notifications';
import { websiteContentRouter } from './routes/websiteContent';
import { publicRouter } from './routes/public';
import { inquiriesRouter } from './routes/inquiries';
import { uploadsRouter, UPLOAD_DIR } from './routes/uploads';

export function createApp() {
  const app = express();
  // Trust only the immediate hosting proxy so req.ip reflects the client address.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use((req, res, next) => {
    const requestId = String(req.header('x-request-id') || crypto.randomUUID()).slice(0, 128);
    res.setHeader('x-request-id', requestId);
    res.locals.requestId = requestId;
    next();
  });
  const allowedOrigins = env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(Object.assign(new Error('Origin is not allowed'), { status: 403 }));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Provider webhooks are server-to-server (no browser, no CORS). Only the
    // headers the Admin/mobile browsers actually send are advertised here.
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Device-Secret', 'X-Request-Id'],
  }));
  app.use(rateLimit({ windowMs: 60_000, limit: 200, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use(express.json({
    limit: '1mb',
    verify: (req: any, _res, buffer) => { req.rawBody = Buffer.from(buffer); }
  }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  // Uploaded team photos are public assets once published, served without the
  // /api prefix so both Admin and the public website resolve one plain URL.
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
  app.use('/api', healthRouter);
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please wait 15 minutes and try again.' },
  }));
  app.use('/api', authRouter);
  app.use('/api/admin', requireAdmin, requireAdminAreaAccess);
  app.use('/api', operatorsRouter);
  app.use('/api', teamRouter);
  app.use('/api', migrationRulesRouter);
  app.use('/api', transitionSettingsRouter);
  app.use('/api', appConfigRouter);
  app.use('/api', paymentsRouter);
  app.use('/api/access/redeem', rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many code attempts. Please wait a minute and try again.' },
  }));
  app.use('/api', accessCodesRouter);
  // TODO: Stronger registration abuse protection requires Apple App Attest or Google Play Integrity device attestation.
  app.use('/api/devices/register', rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many registration attempts. Please wait a minute and try again.' },
  }));
  app.use('/api/devices/:fingerprint/status', rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }));
  app.use('/api', devicesRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', auditLogsRouter);
  app.use('/api', dashboardRouter);
  app.use('/api/admin/uploads', rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many uploads. Please wait a minute and try again.' },
  }));
  app.use('/api', uploadsRouter);
  app.use('/api', websiteContentRouter);
  app.use('/api', publicRouter);
  app.use('/api/inquiries', rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many enquiries submitted. Please wait a minute and try again.' },
  }));
  app.use('/api', inquiriesRouter);
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
