/**
 * Lumina LMS — Audit Logging Utility
 * 6th Civilians Corporation
 *
 * Distinguishes between:
 *   CRITICAL security events  → logged synchronously (awaited), errors are surfaced
 *   STANDARD operational events → logged asynchronously (fire-and-forget)
 *
 * Critical events that must never silently fail:
 *   - Failed login
 *   - 2FA failure
 *   - Password reset
 *   - Role change
 *   - User suspension
 *   - Grade modification
 *   - Admin action
 *   - Cross-tenant access attempt
 *
 * Standard events (OK to be async):
 *   - Successful login
 *   - Course viewed
 *   - Resource downloaded
 *   - Assignment submitted
 *   - Note created/deleted
 */

import AuditLog from '../models/AuditLog.js';
import mongoose from 'mongoose';

/**
 * Shared internal write function.
 * Returns { success, error, logId } so callers decide how to handle failures.
 * Supports both tenant-scoped events and legitimate company-wide/platform events (tenantId: null, isPlatform: true).
 */
export const writeAuditLog = async ({ tenantId, actor, action, targetRecord, targetModel, details } = {}) => {
  if (mongoose.connection.readyState !== 1) {
    console.error(`[AuditLog] MongoDB not connected. Lost audit event: action="${action}", actor=${actor?.userId}`);
    return { success: false, error: 'MongoDB unavailable' };
  }

  let cleanTenantId = null;
  let isPlatform = false;

  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId) && String(tenantId) !== '000000000000000000000000') {
    cleanTenantId = new mongoose.Types.ObjectId(tenantId);
    isPlatform = false;
  } else if (!tenantId || tenantId === null || String(tenantId) === '000000000000000000000000') {
    // Legitimate company-wide / superadmin action: persisted with null tenantId and isPlatform: true
    cleanTenantId = null;
    isPlatform = true;
  } else {
    console.warn(`[AuditLog] Malformed tenantId for action "${action}": ${tenantId}`);
    return { success: false, error: 'Malformed tenantId' };
  }

  try {
    const doc = await AuditLog.create({
      tenantId: cleanTenantId,
      isPlatform,
      actor: {
        userId: actor?.userId || undefined,
        role:   actor?.role   || 'unknown',
        email:  actor?.email  || ''
      },
      action,
      targetRecord: targetRecord || undefined,
      targetModel:  targetModel  || undefined,
      details:      details      || {},
      timestamp:    new Date()
    });

    return { success: true, logId: doc._id };
  } catch (err) {
    console.error(`[AuditLog] Write error for action "${action}":`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * createCriticalAuditLog
 *
 * For security-critical events. Awaited by the caller.
 * Errors are thrown so the caller can abort/rollback the operation.
 * Use this for: failed login, 2FA failure, password reset, role change,
 *               user suspension, grade modification, admin operations,
 *               cross-tenant access attempts.
 *
 * @throws {Error} if the write fails (caller must handle and fail closed)
 */
export const createCriticalAuditLog = async (payload) => {
  const result = await writeAuditLog(payload);
  if (!result.success) {
    console.error(`[AuditLog] CRITICAL WRITE FAILED: action="${payload?.action}"`, result.error);
    throw new Error(`Critical audit log failed: ${result.error}`);
  }
  return result;
};

/**
 * createAuditLog
 *
 * For standard non-critical events. Fire-and-forget.
 * Errors are caught and logged but never propagated.
 * Use this for: successful login, note created, assignment submitted, etc.
 */
export const createAuditLog = (payload) => {
  writeAuditLog(payload).catch((err) => {
    console.warn(`[AuditLog] Non-critical write failed for action="${payload?.action}":`, err.message);
  });
};

/**
 * Convenience: build actor object from req.user
 */
export const actorFromRequest = (req) => ({
  userId: req.user?._id || req.user?.id,
  role:   req.user?.role  || 'unknown',
  email:  req.user?.email || ''
});

export default {
  writeAuditLog,
  createAuditLog,
  createCriticalAuditLog,
  actorFromRequest
};
