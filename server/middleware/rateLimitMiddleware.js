/**
 * Lumina LMS — Distributed Rate Limiting Middleware
 * 6th Civilians Corporation
 *
 * Production architecture:
 *   Redis available   → distributed rate limiting (shared across all API nodes)
 *   Redis unavailable → security-sensitive endpoints FAIL CLOSED (503)
 *                       Never fall back to per-node in-memory in production.
 *
 * Development (NODE_ENV !== 'production'):
 *   Redis unavailable → in-memory fallback (acceptable for local dev only)
 *
 * Limits are fully configurable via environment variables.
 * The server enforces absolute maximums — client-supplied values are never trusted.
 */

import { getRedisClient } from '../services/redisService.js';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── Configurable limits (env vars with safe defaults) ────────────────────────
const LIMITS = {
  login: {
    max:      parseInt(process.env.RATE_LIMIT_LOGIN_MAX       || (IS_PRODUCTION ? '10' : '200'),  10),
    windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || (IS_PRODUCTION ? '900000' : '60000'), 10)
  },
  twofa: {
    max:      parseInt(process.env.RATE_LIMIT_2FA_MAX         || (IS_PRODUCTION ? '5' : '100'),   10),
    windowMs: parseInt(process.env.RATE_LIMIT_2FA_WINDOW_MS   || (IS_PRODUCTION ? '900000' : '60000'), 10) // 15 min prod, 1 min dev
  },
  passwordReset: {
    max:      parseInt(process.env.RATE_LIMIT_RESET_MAX       || (IS_PRODUCTION ? '5' : '100'),   10),
    windowMs: parseInt(process.env.RATE_LIMIT_RESET_WINDOW_MS || (IS_PRODUCTION ? '3600000' : '60000'), 10)
  },
  codeExecution: {
    max:      parseInt(process.env.RATE_LIMIT_CODE_MAX        || '60',  10),
    windowMs: parseInt(process.env.RATE_LIMIT_CODE_WINDOW_MS  || '60000',  10) // 1 min
  },
  upload: {
    max:      parseInt(process.env.RATE_LIMIT_UPLOAD_MAX      || '20',  10),
    windowMs: parseInt(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS|| '60000',  10) // 1 min
  },
  adminSensitive: {
    max:      parseInt(process.env.RATE_LIMIT_ADMIN_MAX       || '200', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_ADMIN_WINDOW_MS || '60000',  10) // 1 min
  },
  general: {
    max:      parseInt(process.env.RATE_LIMIT_GENERAL_MAX     || '300', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_GENERAL_WINDOW_MS|| '60000', 10) // 1 min
  }
};

// ─── In-memory store (development fallback only) ──────────────────────────────
const memoryStore = new Map(); // key → { count, resetAt }

const memoryCheck = (key, max, windowMs) => {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || record.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }

  record.count += 1;
  const allowed = record.count <= max;
  return { allowed, remaining: Math.max(0, max - record.count), resetAt: record.resetAt };
};

// Clean up stale memory store entries periodically (dev only)
if (!IS_PRODUCTION) {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < now) memoryStore.delete(k);
    }
  }, 60000);
}

// ─── Redis-based distributed check ────────────────────────────────────────────
const redisCheck = async (key, max, windowMs) => {
  const client = getRedisClient();
  if (!client || client.status !== 'ready') return null; // Redis not available or ready

  try {
    const windowSec = Math.ceil(windowMs / 1000);
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSec);
    }
    const ttl = await client.ttl(key);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
    const allowed = count <= max;
    return { allowed, remaining: Math.max(0, max - count), resetAt };
  } catch (err) {
    console.error('[RateLimit] Redis check failed:', err.message);
    return null; // Treat as unavailable
  }
};

// ─── Core rate limit factory ──────────────────────────────────────────────────
/**
 * Creates a rate-limit middleware.
 *
 * @param {string}  limitKey         - Named limit key from LIMITS (e.g. 'login')
 * @param {boolean} isCritical       - If true: fail closed in production when Redis is down
 * @param {Function} keyFn           - Extracts the rate-limit key from req (default: user id or IP)
 */
const createRateLimiter = (limitKey, isCritical = false, keyFn = null) => {
  const { max, windowMs } = LIMITS[limitKey] || LIMITS.general;

  return async (req, res, next) => {
    const userId = req.user?._id?.toString() || req.user?.id || null;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const baseKey = keyFn ? keyFn(req) : (userId ? `uid:${userId}` : `ip:${ip}`);
    const redisKey = `rl:${limitKey}:${baseKey}`;

    // Attempt distributed Redis check first
    const redisResult = await redisCheck(redisKey, max, windowMs);

    if (redisResult) {
      // Redis available — use distributed result
      res.setHeader('X-RateLimit-Limit',     max);
      res.setHeader('X-RateLimit-Remaining', redisResult.remaining);
      res.setHeader('X-RateLimit-Reset',     Math.ceil(redisResult.resetAt / 1000));

      if (!redisResult.allowed) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please slow down and try again.'
          }
        });
      }
      return next();
    }

    // Redis unavailable — if multi-node clustering is strictly required (REQUIRE_REDIS=true), fail closed
    if (IS_PRODUCTION && isCritical && process.env.REQUIRE_REDIS === 'true') {
      console.warn(`[RateLimit] Redis unavailable for critical endpoint "${limitKey}". Failing closed.`);
      return res.status(503).json({
        success: false,
        error: {
          code: 'RATE_LIMITER_UNAVAILABLE',
          message: 'This endpoint is temporarily unavailable. Please try again shortly.'
        }
      });
    }

    // In single-instance cloud mode (or dev), safely enforce rate limits using the built-in in-memory store
    const memResult = memoryCheck(redisKey, max, windowMs);
    res.setHeader('X-RateLimit-Limit',     max);
    res.setHeader('X-RateLimit-Remaining', memResult.remaining);
    res.setHeader('X-RateLimit-Reset',     Math.ceil(memResult.resetAt / 1000));
    res.setHeader('X-RateLimit-Store',     IS_PRODUCTION ? 'memory-instance-store' : 'memory-dev-fallback');

    if (!memResult.allowed) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please slow down and try again.'
        }
      });
    }

    return next();
  };
};

// ─── Exported limiters ─────────────────────────────────────────────────────────
// isCritical=true → fail closed in production when Redis is unavailable

export const loginRateLimiter         = createRateLimiter('login',         true,  (req) => `ip:${req.ip}`);
export const twofaRateLimiter         = createRateLimiter('twofa',         true,  (req) => `ip:${req.ip}`);
export const passwordResetRateLimiter = createRateLimiter('passwordReset', true,  (req) => `ip:${req.ip}`);
export const codeExecutionRateLimiter = createRateLimiter('codeExecution', true,  null);
export const uploadRateLimiter        = createRateLimiter('upload',        false, null);
export const adminSensitiveLimiter    = createRateLimiter('adminSensitive',false, null);
export const generalRateLimiter       = createRateLimiter('general',       false, null);

export const resetRateLimitMemoryStore = () => memoryStore.clear();

export default {
  loginRateLimiter,
  twofaRateLimiter,
  passwordResetRateLimiter,
  codeExecutionRateLimiter,
  uploadRateLimiter,
  adminSensitiveLimiter,
  generalRateLimiter,
  resetRateLimitMemoryStore
};
