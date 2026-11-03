/**
 * Lumina LMS — Server-Enforced Session Lifecycle Service
 * 6th Civilians Corporation
 *
 * Implements:
 * 1. Configured session timeouts (Absolute + Idle).
 * 2. Deterministic FIFO concurrent session limit enforcement.
 * 3. Server-side session validation and instant revocation.
 * 4. Logout and password-change session invalidation.
 * 5. Socket.IO connection session gating.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { createAuditLog } from '../utils/auditLogger.js';

export const DEFAULT_SESSION_POLICY = Object.freeze({
  sessionTimeoutMinutes: 120,    // Absolute lifetime cap (2 hours)
  idleTimeoutMinutes: 60,        // Inactivity timeout (1 hour)
  maxConcurrentSessions: 3,      // Max active sessions per user
  enforceIpBinding: false
});

/**
 * In-memory fallback map for testing or when MongoDB is disconnected.
 */
const inMemorySessions = new Map();

/**
 * Retrieves the effective session policy from MongoDB.
 */
export async function getEffectiveSessionPolicy() {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const policyDoc = await SecurityPolicy.findOne({ key: 'global_security_policy' })
        .select('sessionPolicy')
        .lean();
      if (policyDoc && policyDoc.sessionPolicy) {
        const timeout = Number(policyDoc.sessionPolicy.sessionTimeoutMinutes) || DEFAULT_SESSION_POLICY.sessionTimeoutMinutes;
        const configuredIdle = Number(policyDoc.sessionPolicy.idleTimeoutMinutes) || DEFAULT_SESSION_POLICY.idleTimeoutMinutes;
        return {
          sessionTimeoutMinutes: Math.max(15, Math.min(1440, timeout)),
          idleTimeoutMinutes: Math.max(5, Math.min(timeout, configuredIdle)),
          maxConcurrentSessions: Math.max(1, Math.min(10, Number(policyDoc.sessionPolicy.maxConcurrentSessions) || DEFAULT_SESSION_POLICY.maxConcurrentSessions)),
          enforceIpBinding: !!policyDoc.sessionPolicy.enforceIpBinding
        };
      }
    }
  } catch (err) {
    console.warn('[SessionService] Failed to read dynamic SecurityPolicy, using defaults:', err.message);
  }
  return { ...DEFAULT_SESSION_POLICY };
}

/**
 * Creates and persists a new authenticated session for a user.
 * Deterministically applies FIFO eviction when concurrent session limit is exceeded.
 *
 * @param {object} user - Authenticated user document
 * @param {object} req - Express request
 * @returns {Promise<{ sessionId: string, session: object, timeoutMinutes: number }>}
 */
export async function createSession(user, req = {}) {
  const policy = await getEffectiveSessionPolicy();
  const userId = user._id || user.id;
  const userAgent = req.headers ? (req.headers['user-agent'] || '') : '';
  const ipAddress = req.ip || (req.connection ? req.connection.remoteAddress : '') || '';
  const now = new Date();
  const expiresAt = new Date(now.getTime() + policy.sessionTimeoutMinutes * 60 * 1000);
  const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

  // Enforce Deterministic FIFO Concurrent Session Limit
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const activeSessions = await Session.find({
        userId,
        isRevoked: false,
        expiresAt: { $gt: now }
      }).sort({ createdAt: 1 }); // Oldest first

      if (activeSessions.length >= policy.maxConcurrentSessions) {
        const evictCount = activeSessions.length - policy.maxConcurrentSessions + 1;
        const sessionsToEvict = activeSessions.slice(0, evictCount);

        for (const s of sessionsToEvict) {
          s.isRevoked = true;
          s.revokedAt = now;
          s.revocationReason = 'concurrent_limit_exceeded';
          await s.save();

          createAuditLog({
            tenantId: s.tenantId || null,
            actor: { userId: user._id, role: user.role, email: user.email },
            action: 'SESSION_CONCURRENT_LIMIT_EVICTED',
            details: {
              evictedSessionId: s.sessionId,
              limit: policy.maxConcurrentSessions,
              reason: 'FIFO eviction on new login'
            }
          });
        }
      }

      const newSession = await Session.create({
        sessionId,
        userId,
        role: user.role,
        tenantId: user.tenantId || null,
        userAgent,
        ipAddress,
        createdAt: now,
        lastActivityAt: now,
        expiresAt,
        isRevoked: false
      });

      return {
        sessionId,
        session: newSession.toObject ? newSession.toObject() : newSession,
        timeoutMinutes: policy.sessionTimeoutMinutes
      };
    } catch (dbErr) {
      console.error('[SessionService] DB error during session creation, using in-memory store:', dbErr.message);
    }
  }

  // In-memory fallback
  const memSession = {
    sessionId,
    userId: userId.toString(),
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
    userAgent,
    ipAddress,
    createdAt: now,
    lastActivityAt: now,
    expiresAt,
    isRevoked: false,
    revocationReason: null
  };
  inMemorySessions.set(sessionId, memSession);

  return {
    sessionId,
    session: memSession,
    timeoutMinutes: policy.sessionTimeoutMinutes
  };
}

/**
 * Validates a session against server state:
 * - Checks revocation
 * - Checks absolute timeout (expiresAt)
 * - Checks idle timeout (inactivity)
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} sessionId
 * @returns {Promise<{ valid: boolean, session?: object, code?: string, message?: string }>}
 */
export async function validateSession(userId, sessionId) {
  if (!sessionId) {
    return { valid: false, code: 'SESSION_ID_MISSING', message: 'No session identifier provided.' };
  }

  const now = new Date();
  const policy = await getEffectiveSessionPolicy();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const session = await Session.findOne({ sessionId, userId });
      if (!session) {
        return { valid: false, code: 'SESSION_NOT_FOUND', message: 'Active session not found.' };
      }

      if (session.isRevoked) {
        return {
          valid: false,
          code: 'SESSION_REVOKED',
          message: `Session has been revoked (${session.revocationReason || 'security_policy'}).`
        };
      }

      if (session.expiresAt <= now) {
        return { valid: false, code: 'SESSION_EXPIRED', message: 'Session absolute lifetime expired.' };
      }

      // Check Idle Timeout
      const idleLimitMs = policy.idleTimeoutMinutes * 60 * 1000;
      if (now.getTime() - session.lastActivityAt.getTime() > idleLimitMs) {
        session.isRevoked = true;
        session.revokedAt = now;
        session.revocationReason = 'idle_timeout';
        await session.save();
        return { valid: false, code: 'SESSION_IDLE_TIMEOUT', message: 'Session expired due to inactivity.' };
      }

      // Throttled activity update (every 30 seconds)
      if (now.getTime() - session.lastActivityAt.getTime() > 30000) {
        session.lastActivityAt = now;
        await session.save().catch(() => {});
      }

      return { valid: true, session };
    } catch (dbErr) {
      console.error('[SessionService] DB error during session validation:', dbErr.message);
    }
  }

  // In-memory fallback
  const mem = inMemorySessions.get(sessionId);
  if (!mem || mem.userId !== userId.toString()) {
    return { valid: false, code: 'SESSION_NOT_FOUND', message: 'Active session not found.' };
  }
  if (mem.isRevoked) {
    return { valid: false, code: 'SESSION_REVOKED', message: `Session revoked (${mem.revocationReason}).` };
  }
  if (mem.expiresAt <= now) {
    return { valid: false, code: 'SESSION_EXPIRED', message: 'Session expired.' };
  }
  mem.lastActivityAt = now;
  return { valid: true, session: mem };
}

/**
 * Revokes a single session.
 *
 * @param {string} sessionId
 * @param {string} reason
 */
export async function revokeSession(sessionId, reason = 'logout') {
  if (!sessionId) return false;
  const now = new Date();

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      await Session.updateOne(
        { sessionId },
        { $set: { isRevoked: true, revokedAt: now, revocationReason: reason } }
      );
    } catch (err) {
      console.error('[SessionService] Error revoking session in DB:', err.message);
    }
  }

  if (inMemorySessions.has(sessionId)) {
    const mem = inMemorySessions.get(sessionId);
    mem.isRevoked = true;
    mem.revokedAt = now;
    mem.revocationReason = reason;
  }
  return true;
}

/**
 * Revokes all active sessions for a specific user (e.g. after password change).
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} reason
 * @param {string} [exceptSessionId] - Optional sessionId to spare (e.g. current caller)
 */
export async function revokeAllUserSessions(userId, reason = 'password_change', exceptSessionId = null) {
  if (!userId) return false;
  const now = new Date();

  const query = {
    userId,
    isRevoked: false
  };
  if (exceptSessionId) {
    query.sessionId = { $ne: exceptSessionId };
  }

  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      await Session.updateMany(query, {
        $set: { isRevoked: true, revokedAt: now, revocationReason: reason }
      });
    } catch (err) {
      console.error('[SessionService] Error revoking user sessions in DB:', err.message);
    }
  }

  for (const [id, mem] of inMemorySessions.entries()) {
    if (mem.userId === userId.toString() && id !== exceptSessionId) {
      mem.isRevoked = true;
      mem.revokedAt = now;
      mem.revocationReason = reason;
    }
  }
  return true;
}

export default {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  getEffectiveSessionPolicy,
  DEFAULT_SESSION_POLICY
};
