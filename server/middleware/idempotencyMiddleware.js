/**
 * Lumina LMS — Distributed Redis & Resilient In-Memory Idempotency Middleware
 * 6th Civilians Corporation
 *
 * Guarantees:
 * 1. Distributed Atomic Locks:
 *    - Uses Redis SET key payload PX ttlMs NX for true multi-instance synchronization.
 *    - When two API instances receive the identical request simultaneously, only one acquires the lock.
 * 2. Deterministic SHA-256 Payload Hash:
 *    - Replays original response (2xx, 4xx) on identical payload retry.
 *    - Rejects modified payload with HTTP 409 IDEMPOTENCY_PAYLOAD_MISMATCH.
 * 3. Scope Isolation:
 *    - Keys are scoped by Tenant and User (idem:tenant:user:method:path:key) preventing cross-tenant leakage.
 * 4. Stalled / Expired Lock Recovery:
 *    - In-flight locks expire after inFlightTimeoutMs (default 30s) if a server crashes mid-flight.
 * 5. Failed Request Cleanup:
 *    - If an endpoint throws an unhandled error or yields 5xx, the lock is evicted immediately so clients can retry.
 * 6. Cluster Safety:
 *    - If REQUIRE_REDIS_IDEMPOTENCY=true and Redis is disconnected, fails safely (HTTP 503) rather than
 *      falsely claiming distributed safety on independent single-node memory maps.
 */

import crypto from 'crypto';
import { getRedisClient } from '../services/redisService.js';

// In-memory fallback map for single-instance dev/test execution
const memoryIdempotencyStore = new Map();

// Periodic memory store cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryIdempotencyStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryIdempotencyStore.delete(key);
    }
  }
}, 30000).unref();

/**
 * Computes deterministic SHA-256 hash of the request payload
 * Recursively sorts object keys so { a: 1, b: 2 } produces the exact same hash as { b: 2, a: 1 }.
 */
export const computePayloadHash = (payload) => {
  const sortKeys = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = sortKeys(obj[key]);
        return sorted;
      }, {});
  };

  const canonicalString = JSON.stringify(sortKeys(payload || {}));
  return crypto.createHash('sha256').update(canonicalString).digest('hex');
};

/**
 * Idempotency Storage Adapter
 */
export const idempotencyStorage = {
  getStoreType: () => (getRedisClient() ? 'redis' : 'memory'),

  async get(key) {
    const redis = getRedisClient();
    if (redis) {
      const raw = await redis.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const entry = memoryIdempotencyStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryIdempotencyStore.delete(key);
      return null;
    }
    return entry;
  },

  async acquireLock(key, payloadHash, ttlMs, inFlightTimeoutMs) {
    const redis = getRedisClient();
    const now = Date.now();
    const inFlightEntry = {
      status: 'in_flight',
      payloadHash,
      createdAt: now,
      expiresAt: now + ttlMs,
      inFlightExpiresAt: now + inFlightTimeoutMs
    };

    if (redis) {
      // Atomic SET key value PX inFlightTimeoutMs NX
      const res = await redis.set(key, JSON.stringify(inFlightEntry), 'PX', inFlightTimeoutMs, 'NX');
      if (res === 'OK') {
        return { acquired: true };
      }
      // Lock already exists in Redis; fetch and inspect
      const existing = await this.get(key);
      return { acquired: false, existing };
    }

    // In-memory fallback lock logic
    const existing = memoryIdempotencyStore.get(key);
    if (existing && existing.expiresAt > now) {
      // Check if in-flight lock has expired (stalled request recovery)
      if (existing.status === 'in_flight' && existing.inFlightExpiresAt && existing.inFlightExpiresAt <= now) {
        // Recover stalled lock
        memoryIdempotencyStore.set(key, inFlightEntry);
        return { acquired: true };
      }
      return { acquired: false, existing };
    }

    memoryIdempotencyStore.set(key, inFlightEntry);
    return { acquired: true };
  },

  async complete(key, payloadHash, statusCode, body, ttlMs) {
    const redis = getRedisClient();
    const now = Date.now();
    const completedEntry = {
      status: 'completed',
      payloadHash,
      statusCode,
      body,
      completedAt: now,
      expiresAt: now + ttlMs
    };

    if (redis) {
      await redis.set(key, JSON.stringify(completedEntry), 'PX', ttlMs);
    } else {
      memoryIdempotencyStore.set(key, completedEntry);
    }
  },

  async delete(key) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(key);
    } else {
      memoryIdempotencyStore.delete(key);
    }
  },

  async clear() {
    const redis = getRedisClient();
    if (redis) {
      const keys = await redis.keys('idem:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
    memoryIdempotencyStore.clear();
  }
};

/**
 * Creates the Idempotency Middleware.
 * @param {object} options Configuration options
 * @param {number} options.ttlMs Cache lifetime for completed responses (default 120,000ms = 2 min)
 * @param {number} options.inFlightTimeoutMs Maximum lock duration for in-flight requests (default 30,000ms)
 */
export const requireIdempotency = (options = {}) => {
  const ttlMs = options.ttlMs || 120000;
  const inFlightTimeoutMs = options.inFlightTimeoutMs || 30000;

  return async (req, res, next) => {
    // Only apply to state-modifying requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const rawKey = req.headers['x-idempotency-key'] ||
                   req.headers['idempotency-key'] ||
                   req.body?.idempotencyKey;

    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return next();
    }

    // Fail safe if cluster deployment requires Redis but Redis is unreachable
    if (process.env.REQUIRE_REDIS_IDEMPOTENCY === 'true' && !getRedisClient()) {
      return res.status(503).json({
        success: false,
        code: 'DISTRIBUTED_IDEMPOTENCY_UNAVAILABLE',
        message: 'Distributed coordination service (Redis) is currently unavailable. Request blocked for idempotency safety.'
      });
    }

    const tenantScope = req.tenantId ? String(req.tenantId) : (req.user?.tenantId ? String(req.user.tenantId) : 'global');
    const userScope = req.user?._id ? String(req.user._id) : (req.user?.id ? String(req.user.id) : (req.ip || 'anon'));
    const cleanKey = `idem:${tenantScope}:${userScope}:${req.method}:${req.baseUrl || ''}${req.path}:${rawKey.trim()}`;

    const currentPayloadHash = computePayloadHash(req.body);

    try {
      const lockResult = await idempotencyStorage.acquireLock(cleanKey, currentPayloadHash, ttlMs, inFlightTimeoutMs);

      if (!lockResult.acquired) {
        const existing = lockResult.existing;

        if (existing) {
          // 1. Same key but different payload -> Reject with 409
          if (existing.payloadHash && existing.payloadHash !== currentPayloadHash) {
            return res.status(409).json({
              success: false,
              code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
              message: 'An identical idempotency key was previously submitted with a different request payload.'
            });
          }

          // 2. In-flight request currently running
          if (existing.status === 'in_flight') {
            return res.status(409).json({
              success: false,
              code: 'CONCURRENT_REQUEST_IN_FLIGHT',
              message: 'An identical request with this idempotency key is currently processing. Please wait.'
            });
          }

          // 3. Replay completed cached response
          if (existing.status === 'completed') {
            res.set('X-Cache-Lookup', `HIT-IDEMPOTENT-${idempotencyStorage.getStoreType().toUpperCase()}`);
            res.set('X-Idempotent-Replay', 'true');
            return res.status(existing.statusCode).json(existing.body);
          }
        }
      }

      // Intercept response to store completion or release on failure
      const originalJson = res.json.bind(res);
      let finalized = false;

      res.json = async (body) => {
        if (!finalized) {
          finalized = true;
          try {
            if (res.statusCode < 500) {
              await idempotencyStorage.complete(cleanKey, currentPayloadHash, res.statusCode, body, ttlMs);
            } else {
              // Server error: release lock so client can retry safely
              await idempotencyStorage.delete(cleanKey);
            }
          } catch (storageErr) {
            console.error(`[Idempotency] Failed to finalize key "${cleanKey}": ${storageErr.message}`);
          }
        }
        return originalJson(body);
      };

      // Handle stream / connection closure before response completed (e.g. client aborted)
      res.on('close', async () => {
        if (!finalized && !res.writableEnded) {
          finalized = true;
          try {
            await idempotencyStorage.delete(cleanKey);
          } catch {}
        }
      });

      next();
    } catch (err) {
      console.error(`[Idempotency] Middleware exception for key "${cleanKey}":`, err);
      // Fail open for unexpected middleware crashes to avoid breaking API unless strictly required
      next();
    }
  };
};

export const clearIdempotencyCache = async () => {
  await idempotencyStorage.clear();
};

export default requireIdempotency;
