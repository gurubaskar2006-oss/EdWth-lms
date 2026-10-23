/**
 * Lumina LMS — Environment & Secret Configuration
 * 6th Civilians Corporation
 *
 * Strict startup validation for production environments.
 * Fails fast if required secrets or connection strings are missing.
 */

export const isProduction = () => process.env.NODE_ENV === 'production';

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (isProduction()) {
    if (!secret || secret.trim().length < 32) {
      const err = new Error('FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters in production mode.');
      console.error(`❌ [Security Startup] ${err.message}`);
      throw err;
    }
    return secret;
  }
  return secret || 'dev-secret-key-32-chars-long-minimum-lumina-dev';
};

export const validateProductionEnv = () => {
  if (!isProduction()) return;

  const missing = [];

  if (!process.env.MONGO_URI) {
    missing.push('MONGO_URI');
  }

  // Redis is mandatory when horizontal multi-node scaling is explicitly requested (REQUIRE_REDIS=true).
  // Single-instance cloud deployments (e.g. Render Web Service) safely utilize the native in-memory Socket.io adapter.
  if (process.env.REQUIRE_REDIS === 'true' && !process.env.REDIS_URL && !process.env.REDIS_HOST) {
    missing.push('REDIS_URL (or REDIS_HOST/REDIS_PORT)');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    missing.push('JWT_SECRET (must be >= 32 characters)');
  }

  if (missing.length > 0) {
    const err = new Error(`FATAL: Production startup halted. Missing required environment variables: ${missing.join(', ')}`);
    console.error(`❌ [Production Configuration] ${err.message}`);
    throw err;
  }
};

export default {
  getJwtSecret,
  validateProductionEnv,
  isProduction
};
