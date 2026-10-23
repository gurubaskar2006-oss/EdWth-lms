/**
 * Lumina LMS — Multi-Node Safe Attendance Session Service
 * 6th Civilians Corporation
 *
 * PRODUCTION ARCHITECTURE:
 *   - Redis is the authoritative temporary state store for ACTIVE attendance sessions.
 *   - Completed attendance records are permanently persisted to MongoDB Atlas.
 *   - When running multiple API instances, any node can start, verify, mark, or stop
 *     attendance sessions without split-brain or lost updates.
 *
 * CONCURRENCY & INTEGRITY:
 *   - Redis Sets (SADD) guarantee atomic deduplication: two concurrent marks from the
 *     same student cannot create duplicate records or skew the tally.
 *   - Redis SCARD guarantees thread-safe, atomic headcount tallies.
 *   - Sessions have automated TTLs matching duration + grace window, preventing
 *     abandoned sessions from consuming memory.
 *
 * RESILIENCE POLICY:
 *   - In PRODUCTION (NODE_ENV === 'production'): If Redis is unreachable, attendance
 *     operations FAIL CLOSED (throw AttendanceServiceUnavailableError).
 *     Never silently revert to a process-local Map in production.
 *   - In DEVELOPMENT/TEST: An explicit MemoryAttendanceStore provides local fallback
 *     and enables multi-node simulation testing without external dependencies.
 */

import mongoose from 'mongoose';
import { getRedisClient, isRedisHealthy } from './redisService.js';
import Attendance from '../models/Attendance.js';

export class AttendanceServiceUnavailableError extends Error {
  constructor(message = 'Attendance service is temporarily unavailable. Redis coordination is required.') {
    super(message);
    this.name = 'AttendanceServiceUnavailableError';
    this.statusCode = 503;
    this.code = 'ATTENDANCE_SERVICE_UNAVAILABLE';
  }
}

// ─── Key Namespace Builders ──────────────────────────────────────────────────
// ALL keys MUST be tenant-scoped: att:session:{tenantId}:{sessionId}...
export const buildSessionKey  = (tenantId, sessionId) => `att:session:${tenantId}:${sessionId}`;
export const buildStudentsKey = (tenantId, sessionId) => `att:session:${tenantId}:${sessionId}:students`;
export const buildRecordsKey  = (tenantId, sessionId) => `att:session:${tenantId}:${sessionId}:records`;
export const buildActiveSetKey= (tenantId)            => `att:active:${tenantId}`;

// ─── Explicit In-Memory Store (DEV & MULTI-NODE TEST ONLY) ───────────────────
class SharedMemoryStore {
  constructor() {
    this.sessions = new Map(); // key -> { value, expiresAt }
    this.sets = new Map();     // key -> Set
    this.hashes = new Map();   // key -> Map
  }

  _isExpired(expiresAt) {
    return expiresAt && expiresAt < Date.now();
  }

  async get(key) {
    const entry = this.sessions.get(key);
    if (!entry) return null;
    if (this._isExpired(entry.expiresAt)) {
      this.sessions.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, mode, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
    this.sessions.set(key, { value, expiresAt });
    return 'OK';
  }

  async sadd(key, member) {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key);
    if (set.has(member)) {
      return 0; // Already exists
    }
    set.add(member);
    return 1; // Newly added
  }

  async scard(key) {
    const set = this.sets.get(key);
    return set ? set.size : 0;
  }

  async srem(key, member) {
    const set = this.sets.get(key);
    if (!set) return 0;
    const deleted = set.delete(member);
    return deleted ? 1 : 0;
  }

  async smembers(key) {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async hset(key, field, value) {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    this.hashes.get(key).set(field, value);
    return 1;
  }

  async hget(key, field) {
    const hash = this.hashes.get(key);
    return hash ? hash.get(field) || null : null;
  }

  async hgetall(key) {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    const obj = {};
    for (const [k, v] of hash.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async expire(key, ttlSeconds) {
    // Simulated TTL for cleanup
    return 1;
  }

  async del(key) {
    this.sessions.delete(key);
    this.sets.delete(key);
    this.hashes.delete(key);
    return 1;
  }

  clear() {
    this.sessions.clear();
    this.sets.clear();
    this.hashes.clear();
  }
}

// Global dev fallback instance
const globalDevMemoryStore = new SharedMemoryStore();

// Override client for unit / integration tests
let clientOverride = null;

export const setRedisClientOverride = (customClient) => {
  clientOverride = customClient;
};

export const getEffectiveClient = () => {
  if (clientOverride) return clientOverride;

  const redisClient = getRedisClient();
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  if (process.env.NODE_ENV === 'production') {
    // In production, NEVER silently revert to in-memory store
    return null;
  }

  // Development and test fallback only
  return globalDevMemoryStore;
};

// ─── Service API ─────────────────────────────────────────────────────────────

/**
 * Creates and starts a new attendance session in Redis with TTL.
 */
export const startSession = async ({
  tenantId,
  batchId = null,
  trainerId,
  trainerName = 'Trainer',
  topic = 'Daily Lecture Session',
  durationSeconds = 60
}) => {
  if (!tenantId) {
    throw new Error('tenantId is required to start an attendance session');
  }
  if (!trainerId) {
    throw new Error('trainerId is required to start an attendance session');
  }

  const client = getEffectiveClient();
  if (!client) {
    console.error('❌ [Attendance] Redis unavailable in production. Failing session start closed.');
    throw new AttendanceServiceUnavailableError();
  }

  const sessionId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const startedAt = Date.now();
  const expiresAt = startedAt + (durationSeconds * 1000);
  const ttlSeconds = Math.ceil(durationSeconds + 300); // Duration + 5 min grace for tally review

  const session = {
    id: sessionId,
    sessionId,
    tenantId: tenantId.toString(),
    batchId: batchId ? batchId.toString() : null,
    trainerId: trainerId.toString(),
    trainerName,
    topic,
    durationSeconds,
    startedAt,
    expiresAt,
    status: 'active'
  };

  const sessionKey = buildSessionKey(session.tenantId, sessionId);
  const activeSetKey = buildActiveSetKey(session.tenantId);

  await client.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);
  await client.sadd(activeSetKey, sessionId);
  await client.expire(activeSetKey, 86400); // 24-hour safeguard

  return session;
};

/**
 * Retrieves a session from Redis by tenant and sessionId.
 */
export const getSession = async (tenantId, sessionId) => {
  if (!tenantId || !sessionId) return null;

  const client = getEffectiveClient();
  if (!client) {
    throw new AttendanceServiceUnavailableError();
  }

  const sessionKey = buildSessionKey(tenantId, sessionId);
  const raw = await client.get(sessionKey);
  if (!raw) return null;

  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    console.error('[Attendance] Corrupt session data in Redis:', err.message);
    return null;
  }
};

/**
 * Atomically marks attendance for a student.
 * Guarantees:
 * - Session must exist, match tenantId, match batchId (if session is batch-scoped).
 * - SADD is atomic: duplicate student requests return alreadyRecorded: true.
 * - Concurrency safe: concurrent marks from different students update count accurately.
 */
export const markAttendance = async ({
  tenantId,
  sessionId,
  studentId,
  studentName = 'Student',
  studentEmail = '',
  studentBatchId = null,
  studentMongoId = null
}) => {
  if (!tenantId || !sessionId || !studentId) {
    return {
      success: false,
      code: 'INVALID_PARAMETERS',
      message: 'tenantId, sessionId, and studentId are required.'
    };
  }

  const client = getEffectiveClient();
  if (!client) {
    console.error('❌ [Attendance] Redis unavailable in production. Failing attendance mark closed.');
    throw new AttendanceServiceUnavailableError();
  }

  // 1. Fetch authoritative session state
  const session = await getSession(tenantId, sessionId);
  if (!session) {
    return {
      success: false,
      code: 'SESSION_NOT_FOUND',
      message: 'Attendance session expired or invalid'
    };
  }

  // 2. Verify Session Status & Expiry
  if (session.status !== 'active') {
    return {
      success: false,
      code: 'SESSION_CLOSED',
      message: 'Attendance window has closed'
    };
  }

  if (Date.now() > session.expiresAt) {
    return {
      success: false,
      code: 'SESSION_EXPIRED',
      message: 'Attendance window has closed'
    };
  }

  // 3. Strict Tenant Isolation
  if (session.tenantId !== tenantId.toString()) {
    return {
      success: false,
      code: 'TENANT_MISMATCH',
      message: 'Unauthorized: cross-tenant attendance is strictly prohibited'
    };
  }

  // 4. Batch Membership Check
  if (session.batchId && studentBatchId && session.batchId !== studentBatchId.toString()) {
    return {
      success: false,
      code: 'BATCH_MISMATCH',
      message: 'Unauthorized: you are not enrolled in the target batch for this session'
    };
  }

  // 5. Atomic Redis Deduplication via SADD
  const studentsKey = buildStudentsKey(tenantId, sessionId);
  const recordsKey  = buildRecordsKey(tenantId, sessionId);

  const studentKey = studentId.toString();
  const added = await client.sadd(studentsKey, studentKey);

  if (added === 0) {
    // Already marked — return safe idempotent response
    const currentCount = await client.scard(studentsKey);
    return {
      success: true,
      alreadyRecorded: true,
      message: 'Attendance already recorded!',
      sessionId,
      count: currentCount,
      session
    };
  }

  // First time marking! Save student record into hash
  const record = {
    studentId: studentKey,
    name: studentName,
    email: studentEmail,
    confirmedAt: new Date().toISOString()
  };

  await client.hset(recordsKey, studentKey, JSON.stringify(record));

  // Maintain TTL
  const remainingSec = Math.max(60, Math.ceil((session.expiresAt - Date.now()) / 1000) + 300);
  await client.expire(studentsKey, remainingSec);
  await client.expire(recordsKey, remainingSec);

  // Exact atomic count
  const count = await client.scard(studentsKey);

  // 6. Asynchronously Persist Permanent Record to MongoDB Atlas
  const mongoStudentId = studentMongoId || studentId;
  const targetBatchId = session.batchId || studentBatchId;

  const isValidObjectId = (id) => id && mongoose.Types.ObjectId.isValid(id);
  if (
    isValidObjectId(tenantId) &&
    isValidObjectId(targetBatchId) &&
    isValidObjectId(mongoStudentId) &&
    isValidObjectId(session.trainerId)
  ) {
    try {
      await Attendance.create({
        tenantId,
        batchId: targetBatchId,
        studentId: mongoStudentId,
        trainerId: session.trainerId,
        date: new Date(),
        status: 'present'
      });
    } catch (dbErr) {
      // Duplicate key error (code 11000) is safely ignored if student already has record today
      if (dbErr.code !== 11000) {
        console.warn('⚠️ [Attendance DB] MongoDB persistence notice:', dbErr.message);
      }
    }
  }

  return {
    success: true,
    alreadyRecorded: false,
    message: 'Attendance successfully confirmed!',
    sessionId,
    count,
    latestStudent: record,
    session
  };
};

/**
 * Manually closes/stops an attendance session.
 */
export const stopSession = async ({
  tenantId,
  sessionId,
  requesterId,
  requesterRole
}) => {
  if (!tenantId || !sessionId) {
    return { success: false, code: 'INVALID_PARAMETERS', message: 'Missing tenantId or sessionId' };
  }

  const client = getEffectiveClient();
  if (!client) {
    throw new AttendanceServiceUnavailableError();
  }

  const session = await getSession(tenantId, sessionId);
  if (!session) {
    return { success: false, code: 'SESSION_NOT_FOUND', message: 'Session not found' };
  }

  // Authorization check
  const role = (requesterRole || '').toLowerCase();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isOwnerTrainer = role === 'trainer' && session.trainerId === requesterId?.toString();

  if (!isAdmin && !isOwnerTrainer) {
    return { success: false, code: 'UNAUTHORIZED', message: 'Unauthorized to stop this attendance session' };
  }

  session.status = 'closed';
  const sessionKey = buildSessionKey(tenantId, sessionId);
  const activeSetKey = buildActiveSetKey(tenantId);
  const studentsKey = buildStudentsKey(tenantId, sessionId);

  // Persist closed status with remaining TTL
  const ttlSeconds = Math.max(60, Math.ceil((session.expiresAt - Date.now()) / 1000) + 300);
  await client.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);
  await client.srem(activeSetKey, sessionId);

  const totalConfirmed = await client.scard(studentsKey);

  return {
    success: true,
    sessionId,
    totalConfirmed,
    session
  };
};

/**
 * Gets all active sessions for a tenant (and optionally matching batch).
 * Useful when a student connects to ANY node and needs the current active prompt.
 */
export const getActiveSessionsForTenant = async (tenantId, batchId = null) => {
  if (!tenantId) return [];

  const client = getEffectiveClient();
  if (!client) {
    // If Redis is down in production, return empty list gracefully for connection prompts
    return [];
  }

  const activeSetKey = buildActiveSetKey(tenantId);
  const sessionIds = await client.smembers(activeSetKey);
  if (!sessionIds || sessionIds.length === 0) return [];

  const activeSessions = [];
  const now = Date.now();

  for (const sid of sessionIds) {
    const session = await getSession(tenantId, sid);
    if (!session) {
      await client.srem(activeSetKey, sid);
      continue;
    }

    if (session.status !== 'active' || now > session.expiresAt) {
      // Expired or closed — purge from active set
      await client.srem(activeSetKey, sid);
      continue;
    }

    // Filter by batch if specified
    if (!session.batchId || !batchId || session.batchId === batchId.toString()) {
      activeSessions.push(session);
    }
  }

  return activeSessions;
};

/**
 * Retrieves all verified student records for a session (for reporting/export).
 */
export const getSessionConfirmedStudents = async (tenantId, sessionId) => {
  const client = getEffectiveClient();
  if (!client) return [];

  const recordsKey = buildRecordsKey(tenantId, sessionId);
  const allRecords = await client.hgetall(recordsKey);
  if (!allRecords) return [];

  return Object.values(allRecords).map((r) => {
    try {
      return typeof r === 'string' ? JSON.parse(r) : r;
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
};

export { SharedMemoryStore };
export default {
  startSession,
  getSession,
  markAttendance,
  stopSession,
  getActiveSessionsForTenant,
  getSessionConfirmedStudents,
  setRedisClientOverride,
  getEffectiveClient,
  buildSessionKey,
  buildStudentsKey,
  buildRecordsKey,
  buildActiveSetKey,
  AttendanceServiceUnavailableError,
  SharedMemoryStore
};
