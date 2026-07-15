import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
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
import { auditLogsRouter } from './routes/auditLogs';
import { healthRouter } from './routes/health';
import { dashboardRouter } from './routes/dashboard';
import { devicesRouter } from './routes/devices';
import { notificationsRouter } from './routes/notifications';

export function createApp() {
  const app = express();
  // Trust only the immediate hosting proxy so req.ip reflects the client address.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean), credentials: true }));
  app.use(rateLimit({ windowMs: 60_000, limit: 200 }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use('/api', healthRouter);
  app.use('/api', authRouter);
  app.use('/api/admin', requireAdmin, requireAdminAreaAccess);
  app.use('/api', operatorsRouter);
  app.use('/api', teamRouter);
  app.use('/api', migrationRulesRouter);
  app.use('/api', transitionSettingsRouter);
  app.use('/api', appConfigRouter);
  app.use('/api', paymentsRouter);
  app.use('/api', devicesRouter);
  app.use('/api', notificationsRouter);
  app.use('/api', auditLogsRouter);
  app.use('/api', dashboardRouter);
  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}
