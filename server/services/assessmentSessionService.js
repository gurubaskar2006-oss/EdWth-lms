import mongoose from 'mongoose';
import { getRedisClient, isRedisHealthy } from './redisService.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Assessment from '../models/Assessment.js';

/**
 * Resilient In-Memory Key-Value & Set Store
 * Used when Redis is not running (local development without Redis or unit tests).
 * Exactly mirrors ioredis string, hash, and set APIs.
 */
export class SharedMemoryStore {
  constructor() {
    this.store = new Map();
    this.sets = new Map();
  }

  _isExpired(expiresAt) {
    return expiresAt && expiresAt < Date.now();
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry.expiresAt)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, mode, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async sadd(key, member) {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key);
    if (set.has(member)) return 0;
    set.add(member);
    return 1;
  }

  async srem(key, member) {
    const set = this.sets.get(key);
    if (!set) return 0;
    return set.delete(member) ? 1 : 0;
  }

  async smembers(key) {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async del(key) {
    this.store.delete(key);
    this.sets.delete(key);
    return 1;
  }

  clear() {
    this.store.clear();
    this.sets.clear();
  }
}

// Global fallback instance for development
const globalDevMemoryStore = new SharedMemoryStore();

// Override client for multi-node simulation in tests
let clientOverride = null;

export const setAssessmentRedisClientOverride = (customClient) => {
  clientOverride = customClient;
};

export const getEffectiveClient = () => {
  if (clientOverride) return clientOverride;

  const redisClient = getRedisClient();
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  return globalDevMemoryStore;
};

// ─── Key Helpers ─────────────────────────────────────────────────────────────
export const getSessionKey = (tenantId, userId, assessmentId, attemptNumber = 1) =>
  Number(attemptNumber) > 1
    ? `assessment:session:${tenantId}:${userId}:${assessmentId}:${attemptNumber}`
    : `assessment:session:${tenantId}:${userId}:${assessmentId}`;

export const getTenantActiveSetKey = (tenantId) =>
  `assessment:active:${tenantId}`;

export const getSeenEventsSetKey = (tenantId, assessmentId) =>
  `assessment:events_seen:${tenantId}:${assessmentId}`;

// 3-second correlation window to prevent multiple strikes from 1 user action (Alt+Tab)
export const CORRELATION_WINDOW_MS = 3000;

// Maximum proctoring warnings before auto-termination
export const MAX_WARNINGS_THRESHOLD = 3;

/**
 * Creates or retrieves a distributed assessment session in Redis.
 */
export const createOrGetAssessmentSession = async ({
  tenantId,
  userId,
  studentId,
  studentName,
  className,
  assessmentId,
  assessmentTitle,
  durationMinutes = 45,
  attemptNumber = 1
}) => {
  const targetAttemptNumber = Number(attemptNumber) || 1;
  const client = getEffectiveClient();
  const sessionKey = getSessionKey(tenantId, userId, assessmentId, targetAttemptNumber);
  const activeSetKey = getTenantActiveSetKey(tenantId);

  const raw = await client.get(sessionKey);
  if (raw) {
    try {
      const existing = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (existing && existing.sessionId) {
        return existing;
      }
    } catch (_) {}
  }

  const now = Date.now();
  const durationSec = (Number(durationMinutes) || 45) * 60;
  const expiresAt = now + durationSec * 1000;

  const newSession = {
    sessionId: `sess_${now}_${Math.random().toString(36).substring(2, 7)}`,
    tenantId: String(tenantId),
    userId: String(userId),
    studentId: String(studentId || userId),
    studentName: String(studentName || 'Student'),
    className: String(className || 'Class 10-A'),
    assessmentId: String(assessmentId),
    assessmentTitle: String(assessmentTitle || 'Assessment'),
    durationMinutes: Number(durationMinutes) || 45,
    attemptNumber: targetAttemptNumber,
    startedAt: now,
    expiresAt,
    status: 'in_progress',
    violationCount: 0,
    lastWarningAt: 0,
    lastWarningEvent: null,
    terminatedAt: null,
    terminationReason: null,
    submittedAt: null,
    isSubmittedLate: false,
    code: '',
    answers: []
  };

  // Buffer TTL: duration + 2 hours
  const ttlSeconds = durationSec + 7200;
  await client.set(sessionKey, JSON.stringify(newSession), 'EX', ttlSeconds);
  await client.sadd(activeSetKey, `${userId}:${assessmentId}`);

  return newSession;
};

/**
 * Retrieves an active assessment session from Redis.
 */
export const getAssessmentSession = async (tenantId, userId, assessmentId, attemptNumber = 1) => {
  const client = getEffectiveClient();
  const sessionKey = getSessionKey(tenantId, userId, assessmentId, attemptNumber);
  const raw = await client.get(sessionKey);
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) {
    return null;
  }
};

/**
 * Core Server-Authoritative Proctoring Event Ingestion & Warning Deduplication
 */
export const processAssessmentEvent = async ({
  tenantId,
  userId,
  studentId,
  studentName,
  className,
  assessmentId,
  assessmentTitle,
  attemptNumber = 1,
  eventType,
  severity = 'low',
  metadata = {},
  eventId,
  io
}) => {
  const targetAttemptNumber = Number(attemptNumber) || 1;
  const client = getEffectiveClient();
  const sessionKey = getSessionKey(tenantId, userId, assessmentId, targetAttemptNumber);
  const seenEventsKey = getSeenEventsSetKey(tenantId, assessmentId);

  // 1. Verify / Retrieve distributed session
  let session = await getAssessmentSession(tenantId, userId, assessmentId, targetAttemptNumber);
  if (!session) {
    session = await createOrGetAssessmentSession({
      tenantId,
      userId,
      studentId,
      studentName,
      className,
      assessmentId,
      assessmentTitle,
      attemptNumber: targetAttemptNumber
    });
  }

  // 2. If session is already terminated or completed, reject new action
  if (session.status === 'terminated_violations') {
    return {
      success: false,
      isTerminated: true,
      status: 'terminated_violations',
      violationCount: session.violationCount,
      message: 'Assessment session has already been terminated due to proctoring violations.'
    };
  }

  if (session.status === 'completed' || session.status === 'submitted_late') {
    return {
      success: false,
      isSubmitted: true,
      status: session.status,
      message: 'Assessment session has already been submitted.'
    };
  }

  // 3. Idempotency Check: Prevent duplicate event deliveries from counting multiple strikes
  const finalEventId = eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const isNewEvent = await client.sadd(seenEventsKey, finalEventId);
  if (isNewEvent === 0) {
    // Duplicate delivery: ignore strike, return current state
    return {
      success: true,
      duplicateIgnored: true,
      isTerminated: false,
      violationCount: session.violationCount,
      data: session
    };
  }

  const now = Date.now();
  const isViolationTrigger =
    eventType === 'FULLSCREEN_EXIT' ||
    eventType === 'TAB_OR_WINDOW_HIDDEN' ||
    eventType === 'WINDOW_BLUR' ||
    eventType === 'MAX_WARNINGS_EXCEEDED';

  let isStrike = false;
  let deduplicated = false;

  if (isViolationTrigger) {
    const elapsedSinceLastWarning = now - (session.lastWarningAt || 0);

    // Warning Deduplication Correlation Window
    if (session.lastWarningAt && elapsedSinceLastWarning < CORRELATION_WINDOW_MS) {
      // Correlated with previous physical exit action: log telemetry without new strike
      deduplicated = true;
    } else {
      // Genuine distinct warning strike
      isStrike = true;
      session.violationCount = (session.violationCount || 0) + 1;
      session.lastWarningAt = now;
      session.lastWarningEvent = eventType;
    }
  }

  // Check 3-warning termination threshold
  const isCrossedWarnings =
    eventType === 'MAX_WARNINGS_EXCEEDED' ||
    session.violationCount >= MAX_WARNINGS_THRESHOLD;

  if (isCrossedWarnings) {
    session.status = 'terminated_violations';
    session.terminatedAt = now;
    session.terminationReason = 'Exceeded maximum allowable proctoring warnings (3 strikes)';
  }

  // 4. Save updated session to Redis
  const remainingSec = Math.max(0, Math.round((session.expiresAt - now) / 1000));
  const ttlSeconds = remainingSec + 7200;
  await client.set(sessionKey, JSON.stringify(session), 'EX', ttlSeconds);

  // 5. Persist permanent AssessmentEvent record to MongoDB
  const eventPayload = {
    eventId: finalEventId,
    tenantId: String(tenantId),
    studentId: String(userId),
    studentName: session.studentName,
    studentIdentifier: session.studentId,
    className: session.className,
    assessmentId: String(assessmentId),
    assessmentTitle: session.assessmentTitle,
    assessmentSessionId: session.sessionId,
    attemptNumber: session.attemptNumber || targetAttemptNumber || 1,
    eventType: isCrossedWarnings ? 'MAX_WARNINGS_EXCEEDED' : eventType,
    severity: isCrossedWarnings ? 'critical' : severity,
    isTerminated: isCrossedWarnings,
    timestamp: new Date(now),
    metadata: {
      ...metadata,
      violationCount: session.violationCount,
      isStrike,
      deduplicated,
      isTerminated: isCrossedWarnings
    }
  };

  if (
    mongoose.connection.readyState === 1 &&
    mongoose.Types.ObjectId.isValid(userId) &&
    mongoose.Types.ObjectId.isValid(tenantId)
  ) {
    try {
      await AssessmentEvent.create(eventPayload);
    } catch (dbErr) {
      console.warn('⚠️ [AssessmentEvent] DB save fallback:', dbErr.message);
    }
  }

  // 6. Cross-Node Real-Time Socket.IO Alert Delivery with Strict Tenant Isolation
  if (io && (isStrike || isCrossedWarnings || severity === 'medium' || severity === 'high')) {
    try {
      const alertData = {
        ...eventPayload,
        isTerminated: isCrossedWarnings,
        violationCount: session.violationCount,
        timestamp: eventPayload.timestamp.toISOString()
      };

      // Strict Tenant Isolation: only emit to authenticated rooms for this tenant
      io.to(`tenant:${tenantId}:role:trainer`).emit('assessment:alert', alertData);
      io.to(`tenant:${tenantId}:role:teacher`).emit('assessment:alert', alertData);

      // If terminated, immediately inform the student socket/room
      if (isCrossedWarnings) {
        io.to(`tenant:${tenantId}:user:${userId}`).emit('assessment:terminated', alertData);
      }
    } catch (socketErr) {
      console.warn('⚠️ [AssessmentEvent] Socket notice:', socketErr.message);
    }
  }

  return {
    success: true,
    eventId: finalEventId,
    timestamp: eventPayload.timestamp,
    violationCount: session.violationCount,
    isStrike,
    deduplicated,
    isTerminated: isCrossedWarnings,
    status: session.status,
    data: eventPayload
  };
};

/**
 * Server-Authoritative Final Submission Finalization
 */
export const finalizeAssessmentSubmission = async ({
  tenantId,
  userId,
  assessmentId,
  attemptNumber = 1,
  code,
  answers = [],
  questionResults = [],
  isTerminated = false,
  submissionReason = 'NORMAL',
  io
}) => {
  if (!tenantId || !userId) {
    return {
      success: false,
      status: 'failed',
      message: 'Tenant and student identity context are required for assessment submission.'
    };
  }

  const targetAttemptNumber = Number(attemptNumber) || 1;
  const client = getEffectiveClient();
  const sessionKey = getSessionKey(tenantId, userId, assessmentId, targetAttemptNumber);
  const activeSetKey = getTenantActiveSetKey(tenantId);

  let session = await getAssessmentSession(tenantId, userId, assessmentId, targetAttemptNumber);
  const now = Date.now();

  // If already terminated due to 3 warnings, prevent student from overriding status to normal
  const wasAlreadyTerminated = session?.status === 'terminated_violations';
  if (wasAlreadyTerminated && submissionReason !== 'TERMINATED_MAX_WARNINGS') {
    return {
      success: false,
      isTerminated: true,
      message: 'Assessment has already been terminated due to proctoring policy violations. Further submissions or modifications are rejected.',
      status: 'terminated_violations',
      data: session
    };
  }

  const isAutoTerminated = Boolean(
    wasAlreadyTerminated ||
    isTerminated ||
    submissionReason === 'TERMINATED_MAX_WARNINGS' ||
    (session && session.violationCount >= MAX_WARNINGS_THRESHOLD)
  );

  const GRACE_PERIOD_MS = 5000;
  const isSubmittedLate = session ? now > session.expiresAt + GRACE_PERIOD_MS : false;

  const finalStatus = isAutoTerminated
    ? 'terminated_violations'
    : isSubmittedLate
    ? 'submitted_late'
    : 'completed';

  // Sanitize answers preserving legitimate question responses while strictly stripping untrusted grading claims
  const UNTRUSTED_KEYS = new Set([
    'score',
    'percentage',
    'marks',
    'passed',
    'grade',
    'questionResults',
    'evalResults',
    'isCorrect',
    'correct',
    'points',
    'maxScore',
    'marksObtained'
  ]);

  let sanitizedAnswers = [];
  if (Array.isArray(answers) && answers.length > 0) {
    sanitizedAnswers = answers.map((ans) => {
      if (typeof ans === 'object' && ans !== null) {
        const clean = {};
        for (const [k, v] of Object.entries(ans)) {
          if (!UNTRUSTED_KEYS.has(k)) {
            clean[k] = v;
          }
        }
        return clean;
      }
      return ans;
    });
  } else if (code) {
    sanitizedAnswers = [{ code: String(code) }];
  }

  // Preserve recoverable state in Redis session cache (does NOT constitute durable persistence)
  const updatedSession = {
    ...(session || {}),
    tenantId: String(tenantId),
    userId: String(userId),
    assessmentId: String(assessmentId),
    status: finalStatus,
    submittedAt: now,
    code: code || session?.code || '',
    answers: sanitizedAnswers.length ? sanitizedAnswers : session?.answers || [],
    questionResults: [],
    isSubmittedLate: !isAutoTerminated && isSubmittedLate,
    isTerminated: isAutoTerminated,
    submissionReason: isAutoTerminated ? 'TERMINATED_MAX_WARNINGS' : isSubmittedLate ? 'LATE' : 'ON_TIME'
  };

  await client.set(sessionKey, JSON.stringify(updatedSession), 'EX', 86400); // 24h retention

  // Verify permanent database storage is available before claiming durable success
  if (mongoose.connection.readyState !== 1) {
    return {
      success: false,
      status: 'failed',
      message: 'Permanent database storage is unavailable. Assessment submission cannot be durably recorded.'
    };
  }

  // Look up authoritative assessment document in MongoDB (distinguish DB error from not-found)
  let assessmentDoc = null;
  const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const orConditions = [{ id: String(assessmentId) }];
  if (mongoose.Types.ObjectId.isValid(assessmentId)) {
    orConditions.push({ _id: new mongoose.Types.ObjectId(assessmentId) });
  }

  try {
    assessmentDoc = await Assessment.findOne({
      tenantId: tenantObjId,
      $or: orConditions
    }).lean();
  } catch (lookupErr) {
    console.error('⚠️ [Assessment] Lookup database error:', lookupErr.message);
    return {
      success: false,
      status: 'failed',
      message: 'Database error occurred while verifying assessment configuration.'
    };
  }

  if (!assessmentDoc) {
    return {
      success: false,
      status: 'failed',
      message: 'Assessment configuration not found or unauthorized for this tenant.'
    };
  }

  // Authoritative scoring values (never fabricate marks for un-evaluated submissions)
  const totalMarks = assessmentDoc?.totalMarks != null ? Number(assessmentDoc.totalMarks) : (session?.maxScore || 20);
  const targetScore = isAutoTerminated ? 0 : null;
  const targetPercentage = isAutoTerminated ? 0 : null;
  const targetStatus = isAutoTerminated ? 'disqualified' : 'submitted';

  // Persist permanent AssessmentAttempt record to MongoDB with fail-closed error handling
  try {
    const durationMs = Math.max(1000, now - (session?.startedAt || now));
    const timeUsedMinutes = Math.max(1, Math.round(durationMs / 60000));
    const violationCount = session?.violationCount || (isAutoTerminated ? 3 : 0);
    const integrityStatus = isAutoTerminated || violationCount >= 2 ? 'review_required' : violationCount > 0 ? 'attention_required' : 'normal';

    const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const effectiveAttemptNumber = Number(session?.attemptNumber || targetAttemptNumber || 1);

    const existingQuery = {
      tenantId: tenantObjId,
      assessmentId: String(assessmentId),
      studentId: userObjId
    };
    if (effectiveAttemptNumber > 1) {
      existingQuery.attemptNumber = effectiveAttemptNumber;
    } else {
      existingQuery.$or = [{ attemptNumber: 1 }, { attemptNumber: { $exists: false } }];
    }

    const findQuery = AssessmentAttempt.findOne(existingQuery);
    const existing = typeof findQuery?.sort === 'function'
      ? await findQuery.sort({ attemptNumber: -1, startedAt: -1 }).lean()
      : await findQuery.lean();

    if (existing) {
      if (existing.status === 'disqualified') {
        return {
          success: false,
          isTerminated: true,
          status: 'terminated_violations',
          message: 'Assessment has already been terminated due to proctoring policy violations. Further submissions or modifications are rejected.',
          data: session
        };
      }
      if (['submitted', 'evaluated', 'result_published'].includes(existing.status)) {
        return {
          success: true,
          isDuplicate: true,
          isTerminated: false,
          status: existing.status,
          submittedAt: existing.submittedAt ? new Date(existing.submittedAt).getTime() : now,
          message: 'Assessment submission has already been received and recorded.'
        };
      }

      // Atomically transition from in_progress/scheduled to submitted/disqualified
      const updatedAttempt = await AssessmentAttempt.findOneAndUpdate(
        {
          _id: existing._id,
          status: { $in: ['scheduled', 'in_progress'] }
        },
        {
          $set: {
            assessmentTitle: session?.assessmentTitle || assessmentDoc?.title || existing.assessmentTitle,
            subject: session?.subject || assessmentDoc?.subject || existing.subject,
            studentIdentifier: session?.studentId || existing.studentIdentifier || String(userId),
            studentName: session?.studentName || existing.studentName || 'Student',
            className: session?.className || existing.className || 'Class 10 - Section A',
            submittedAt: new Date(now),
            status: targetStatus,
            timeUsedMinutes,
            violationCount,
            integrityStatus,
            score: targetScore,
            maxScore: totalMarks,
            percentage: targetPercentage,
            answers: sanitizedAnswers
          }
        },
        { returnDocument: 'after' }
      );

      if (!updatedAttempt) {
        const currentWinner = await AssessmentAttempt.findById(existing._id).lean();
        if (currentWinner && ['submitted', 'evaluated', 'result_published'].includes(currentWinner.status)) {
          return {
            success: true,
            isDuplicate: true,
            isTerminated: currentWinner.status === 'disqualified',
            status: currentWinner.status,
            message: 'Assessment submission has already been received and recorded.'
          };
        }
        return {
          success: false,
          status: 'failed',
          message: 'Concurrent submission conflict. Please retry.'
        };
      }

      if (effectiveAttemptNumber > 1 && mongoose.connection.readyState === 1) {
        try {
          const RetakeAuthorization = (await import('../models/RetakeAuthorization.js')).default;
          await RetakeAuthorization.findOneAndUpdate(
            {
              tenantId: tenantObjId,
              assessmentId: String(assessmentId),
              studentId: userObjId,
              targetAttemptNumber: effectiveAttemptNumber,
              status: 'in_progress'
            },
            { $set: { status: 'completed' } }
          );
        } catch (_) {}
      }
    } else {
      try {
        await AssessmentAttempt.create({
          tenantId: tenantObjId,
          assessmentId: String(assessmentId),
          attemptNumber: effectiveAttemptNumber,
          assessmentTitle: session?.assessmentTitle || assessmentDoc?.title || 'Assessment',
          subject: session?.subject || assessmentDoc?.subject || 'Python Programming',
          studentId: userObjId,
          studentIdentifier: session?.studentId || String(userId),
          studentName: session?.studentName || 'Student',
          className: session?.className || 'Class 10 - Section A',
          startedAt: session?.startedAt ? new Date(session.startedAt) : new Date(now - durationMs),
          submittedAt: new Date(now),
          status: targetStatus,
          timeUsedMinutes,
          violationCount,
          integrityStatus,
          score: targetScore,
          maxScore: totalMarks,
          percentage: targetPercentage,
          answers: sanitizedAnswers
        });

        if (effectiveAttemptNumber > 1 && mongoose.connection.readyState === 1) {
          try {
            const RetakeAuthorization = (await import('../models/RetakeAuthorization.js')).default;
            await RetakeAuthorization.findOneAndUpdate(
              {
                tenantId: tenantObjId,
                assessmentId: String(assessmentId),
                studentId: userObjId,
                targetAttemptNumber: effectiveAttemptNumber,
                status: 'in_progress'
              },
              { $set: { status: 'completed' } }
            );
          } catch (_) {}
        }
      } catch (insertErr) {
        if (insertErr.code === 11000 || insertErr.message?.includes('duplicate key') || insertErr.message?.includes('E11000')) {
          const createdWinner = await AssessmentAttempt.findOne(existingQuery).lean();
          if (createdWinner) {
            if (createdWinner.status === 'disqualified') {
              return {
                success: false,
                isTerminated: true,
                status: 'terminated_violations',
                message: 'Assessment has already been terminated due to proctoring policy violations. Further submissions or modifications are rejected.'
              };
            }
            if (['submitted', 'evaluated', 'result_published'].includes(createdWinner.status)) {
              return {
                success: true,
                isDuplicate: true,
                isTerminated: false,
                status: createdWinner.status,
                message: 'Assessment submission has already been received and recorded.'
              };
            }
          }
        }
        throw insertErr;
      }
    }
  } catch (dbErr) {
    console.error('⚠️ [AssessmentAttempt] DB save error:', dbErr.message);
    return {
      success: false,
      status: 'failed',
      message: 'Failed to record assessment submission in permanent storage.'
    };
  }

  // Strict Tenant Isolation for Submission Alerts
  if (io) {
    try {
      const submitAlert = {
        tenantId: String(tenantId),
        studentId: String(userId),
        studentName: session?.studentName || 'Student',
        className: session?.className || 'Class 10-A',
        assessmentId: String(assessmentId),
        assessmentTitle: session?.assessmentTitle || 'Assessment',
        eventType: isAutoTerminated ? 'ASSESSMENT_FORCE_TERMINATED' : 'ASSESSMENT_SUBMITTED',
        isTerminated: isAutoTerminated,
        isSubmittedLate: updatedSession.isSubmittedLate,
        violationCount: session?.violationCount || (isAutoTerminated ? 3 : 0),
        timestamp: new Date(now).toISOString()
      };

      io.to(`tenant:${tenantId}:role:trainer`).emit('assessment:alert', submitAlert);
      io.to(`tenant:${tenantId}:role:teacher`).emit('assessment:alert', submitAlert);

      if (isAutoTerminated) {
        io.to(`tenant:${tenantId}:user:${userId}`).emit('assessment:terminated', submitAlert);
      }
    } catch (_) {}
  }

  return {
    success: true,
    isTerminated: isAutoTerminated,
    status: isAutoTerminated ? 'disqualified' : isSubmittedLate ? 'submitted_late' : 'submitted',
    submittedAt: now,
    message: isAutoTerminated
      ? 'Assessment terminated and submitted due to proctoring violation limit.'
      : isSubmittedLate
      ? 'Assessment submitted after server deadline.'
      : 'Assessment submitted on-time.'
  };
};

/**
 * Live Monitoring Query Across Nodes via Redis
 */
export const getActiveAssessmentMonitoringList = async (tenantId) => {
  const client = getEffectiveClient();
  const activeSetKey = getTenantActiveSetKey(tenantId);
  const now = Date.now();

  const members = await client.smembers(activeSetKey);
  const activeList = [];

  for (const member of members) {
    const [userId, assessmentId] = member.split(':');
    if (!userId || !assessmentId) continue;

    const session = await getAssessmentSession(tenantId, userId, assessmentId);
    if (!session) continue;

    const remainingSeconds = Math.max(0, Math.round((session.expiresAt - now) / 1000));
    const totalSeconds = (session.durationMinutes || 45) * 60;
    const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
    const progressPct =
      totalSeconds > 0 ? Math.min(100, Math.round((elapsedSeconds / totalSeconds) * 100)) : 0;

    let statusDisplay = 'Inactive';
    if (session.status === 'terminated_violations') {
      statusDisplay = 'Terminated (3 Strikes)';
    } else if (session.status === 'completed') {
      statusDisplay = 'Submitted';
    } else if (session.status === 'in_progress') {
      statusDisplay = remainingSeconds === 0 ? 'Expired' : 'In Progress';
    } else if (session.status === 'submitted_late') {
      statusDisplay = 'Submitted (Late)';
    }

    activeList.push({
      sessionId: session.sessionId,
      studentId: session.studentId,
      studentName: session.studentName,
      className: session.className,
      assessmentId: session.assessmentId,
      assessmentTitle: session.assessmentTitle,
      status: statusDisplay,
      isTerminated: session.status === 'terminated_violations',
      progress:
        session.status === 'completed' || session.status === 'terminated_violations'
          ? 100
          : progressPct,
      remainingSeconds,
      durationMinutes: session.durationMinutes,
      alerts: session.violationCount || 0,
      startedAt: session.startedAt,
      submittedAt: session.submittedAt
    });
  }

  return activeList;
};
