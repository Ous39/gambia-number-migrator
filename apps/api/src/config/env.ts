import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  //port: Number(process.env.API_PORT || 8089),
  port: Number(process.env.PORT || process.env.API_PORT || 8089),
  databaseUrl: process.env.DATABASE_URL || 'postgres://gnm_user:gnm_password@localhost:5434/gambia_number_migrator',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  paymentTestMode: process.env.PAYMENT_TEST_MODE === 'true',
  waveWebhookSecret: process.env.WAVE_WEBHOOK_SECRET || '',
  apsWebhookSecret: process.env.APS_WEBHOOK_SECRET || '',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  adminBaseUrl: process.env.ADMIN_BASE_URL || 'http://localhost:5173'
};

if (env.nodeEnv === 'production') {
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required');
  if (!process.env.JWT_SECRET || env.jwtSecret.length < 32 || env.jwtSecret === 'dev-only-change-me') problems.push('JWT_SECRET must be a random value of at least 32 characters');
  if (env.paymentTestMode) problems.push('PAYMENT_TEST_MODE must be false');
  if (/localhost|127\.0\.0\.1/.test(env.corsOrigin)) problems.push('CORS_ORIGIN must contain the production admin origin');
  if (problems.length) throw new Error(`Invalid production configuration: ${problems.join('; ')}`);
}
