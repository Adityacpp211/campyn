import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const databaseUrl = process.env.DATABASE_URL || '';
const jwtSecret = process.env.JWT_SECRET || (isProduction ? '' : 'campus-os-enterprise-secret-key-2026-secure-token');
const auditSalt = process.env.AUDIT_SALT || (isProduction ? '' : 'campus_os_cryptographic_audit_ledger_v1');

if (isProduction) {
  if (!databaseUrl) {
    throw new Error('[FATAL CONFIG] Production environment requires a valid DATABASE_URL. Embedded PGlite fallback is disabled in production.');
  }
  if (!jwtSecret || jwtSecret === 'campus-os-enterprise-secret-key-2026-secure-token') {
    throw new Error('[FATAL CONFIG] Production environment requires a dedicated, secure JWT_SECRET.');
  }
  if (!auditSalt || auditSalt === 'campus_os_cryptographic_audit_ledger_v1') {
    throw new Error('[FATAL CONFIG] Production environment requires a dedicated, secure AUDIT_SALT.');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv,
  isProduction,
  databaseUrl,
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  auditSalt,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
