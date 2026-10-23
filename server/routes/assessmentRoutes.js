import express from 'express';
import mongoose from 'mongoose';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Assessment from '../models/Assessment.js';
import User from '../models/User.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import {
  createOrGetAssessmentSession,
  getAssessmentSession,
  processAssessmentEvent,
  finalizeAssessmentSubmission,
  getActiveAssessmentMonitoringList
} from '../services/assessmentSessionService.js';

const router = express.Router();
router.use(verifyToken);

/**
 * POST /api/v1/assessments/start OR POST /api/v1/assessments/:assessmentId/start
 * Starts or recovers an existing distributed assessment session across any server node.
 */
const handleStartSession = async (req, res) => {
  const assessmentId = req.params.assessmentId || req.body.assessmentId;
  const { durationMinutes = 45, assessmentTitle = 'Assessment' } = req.body;
  if (!assessmentId) {
    return res.status(400).json({ success: false, message: 'assessmentId is required' });
  }

  const userId = req.user?._id?.toString() || req.user?.id || 'anonymous';
  const tenantId = req.tenantId || req.user?.tenantId || 'global';
  const studentId = req.user?.studentId || userId;
  const studentName = req.user?.name || 'Student';
  const className = req.user?.className || req.user?.major || 'Class 10-A';

  const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;
  const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  // Single-attempt policy enforcement: Check if student has already submitted, evaluated, or been disqualified
  let existingAttempt = null;
  if (mongoose.connection.readyState === 1 && userObjId && tenantObjId) {
    try {
      existingAttempt = await AssessmentAttempt.findOne({
        tenantId: tenantObjId,
        assessmentId: String(assessmentId),
        studentId: userObjId
      }).sort({ attemptNumber: -1, startedAt: -1 }).lean();
    } catch (lookupErr) {
      console.warn('[AssessmentRoutes] Existing attempt lookup warning:', lookupErr.message);
    }
  }

  let attemptNumber = 1;
  let activeRetakeAuth = null;

  if (existingAttempt) {
    if (existingAttempt.status === 'disqualified') {
      // Check if trainer authorized a retake after disqualification
      let retakeAuth = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const RetakeAuthorization = (await import('../models/RetakeAuthorization.js')).default;
          retakeAuth = await RetakeAuthorization.findOne({
            tenantId: tenantObjId,
            assessmentId: String(assessmentId),
            studentId: userObjId,
            status: { $in: ['pending', 'in_progress'] }
          });
        } catch (_) {}
      }

      if (!retakeAuth) {
        return res.status(403).json({
          success: false,
          code: 'ASSESSMENT_DISQUALIFIED',
          message: 'This assessment was terminated due to proctoring policy violations. Retakes require explicit authorization by your trainer.'
        });
      }

      activeRetakeAuth = retakeAuth;
      attemptNumber = retakeAuth.targetAttemptNumber || 2;
    } else if (['submitted', 'evaluated', 'result_published'].includes(existingAttempt.status)) {
      // Check if an explicit trainer-authorized retake exists
      let retakeAuth = null;
      if (mongoose.connection.readyState === 1) {
        try {
          const RetakeAuthorization = (await import('../models/RetakeAuthorization.js')).default;
          retakeAuth = await RetakeAuthorization.findOne({
            tenantId: tenantObjId,
            assessmentId: String(assessmentId),
            studentId: userObjId,
            status: { $in: ['pending', 'in_progress'] }
          });
        } catch (_) {}
      }

      if (!retakeAuth) {
        return res.status(403).json({
          success: false,
          code: 'ASSESSMENT_ALREADY_COMPLETED',
          message: 'You have already completed and submitted this assessment. Additional attempts require explicit authorization by your trainer.',
          submittedAt: existingAttempt.submittedAt,
          attemptStatus: existingAttempt.status
        });
      }

      activeRetakeAuth = retakeAuth;
      attemptNumber = retakeAuth.targetAttemptNumber || 2;
    }
  }

  // If retake is pending, claim it atomically
  if (activeRetakeAuth && activeRetakeAuth.status === 'pending') {
    try {
      activeRetakeAuth.status = 'in_progress';
      activeRetakeAuth.usedAt = new Date();
      await activeRetakeAuth.save();
    } catch (saveErr) {
      console.warn('[AssessmentRoutes] Error claiming retake authorization:', saveErr.message);
    }
  }

  try {
    const session = await createOrGetAssessmentSession({
      tenantId,
      userId,
      studentId,
      studentName,
      className,
      assessmentId,
      assessmentTitle,
      durationMinutes,
      attemptNumber
    });

    const now = Date.now();
    const isExpired = now >= session.expiresAt;
    const remainingSeconds = Math.max(0, Math.round((session.expiresAt - now) / 1000));

    res.status(200).json({
      success: true,
      recovered: Boolean(session.startedAt < now - 1000),
      data: {
        sessionId: session.sessionId,
        assessmentId: session.assessmentId,
        assessmentTitle: session.assessmentTitle,
        attemptNumber: session.attemptNumber || attemptNumber || 1,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        durationMinutes: session.durationMinutes,
        remainingSeconds,
        serverTime: now,
        status: session.status,
        violationCount: session.violationCount || 0,
        isTerminated: session.status === 'terminated_violations',
        isExpired
      }
    });
  } catch (err) {
    console.error('Error starting assessment session:', err);
    res.status(500).json({ success: false, message: 'Failed to start assessment session' });
  }
};

router.post('/start', handleStartSession);
router.post('/:assessmentId/start', handleStartSession);

/**
 * GET /api/v1/assessments/:assessmentId/session
 * Fetches current authoritative session state and remaining seconds across any node.
 */
router.get('/:assessmentId/session', async (req, res) => {
  const { assessmentId } = req.params;
  const userId = req.user?._id?.toString() || req.user?.id || 'anonymous';
  const tenantId = req.tenantId || req.user?.tenantId || 'global';

  try {
    const session = await getAssessmentSession(tenantId, userId, assessmentId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active assessment session found. Please start the assessment.'
      });
    }

    const now = Date.now();
    const isExpired = now >= session.expiresAt;
    const remainingSeconds = Math.max(0, Math.round((session.expiresAt - now) / 1000));

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        assessmentId: session.assessmentId,
        assessmentTitle: session.assessmentTitle,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        durationMinutes: session.durationMinutes,
        remainingSeconds,
        serverTime: now,
        status: session.status,
        violationCount: session.violationCount || 0,
        isTerminated: session.status === 'terminated_violations',
        isExpired
      }
    });
  } catch (err) {
    console.error('Error fetching assessment session:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve assessment session' });
  }
});

/**
 * POST /api/v1/assessments/:assessmentId/events
 * Real browser assessment monitoring event ingestion.
 * Server-authoritative warning correlation, deduplication, and automatic termination.
 */
router.post('/:assessmentId/events', async (req, res) => {
  const { assessmentId } = req.params;
  const {
    eventType,
    assessmentTitle,
    metadata = {},
    severity = 'low',
    eventId,
    attemptNumber
  } = req.body;

  const validEvents = [
    'FULLSCREEN_EXIT',
    'FULLSCREEN_ENTERED',
    'TAB_OR_WINDOW_HIDDEN',
    'TAB_RETURNED',
    'WINDOW_BLUR',
    'WINDOW_FOCUS',
    'PRINT_ATTEMPT',
    'SAVE_ATTEMPT',
    'DEVTOOLS_SHORTCUT',
    'COPY_ATTEMPT',
    'PASTE_ATTEMPT',
    'ASSESSMENT_SUBMITTED',
    'ASSESSMENT_AUTO_SUBMITTED',
    'MAX_WARNINGS_EXCEEDED',
    'ASSESSMENT_FORCE_TERMINATED',
    'SESSION_EXPIRED'
  ];

  if (!eventType || !validEvents.includes(eventType)) {
    return res.status(400).json({ success: false, message: `Invalid eventType: ${eventType}` });
  }

  const userId = req.user?._id?.toString() || req.user?.id || 'anonymous';
  const tenantId = req.tenantId || req.user?.tenantId || 'global';
  const studentName = req.user?.name || 'Student';
  const studentId = req.user?.studentId || userId;
  const className = req.user?.className || req.user?.major || 'Class 10-A';

  let effectiveAttemptNumber = Number(attemptNumber) || 0;
  if (!effectiveAttemptNumber && req.user?._id) {
    try {
      const activeAuth = await RetakeAuthorization.findOne({
        tenantId,
        assessmentId,
        studentId: req.user._id,
        status: 'in_progress'
      }).lean();
      if (activeAuth) {
        effectiveAttemptNumber = activeAuth.targetAttemptNumber;
      }
    } catch {
      // ignore
    }
  }
  if (!effectiveAttemptNumber) effectiveAttemptNumber = 1;

  try {
    const result = await processAssessmentEvent({
      tenantId,
      userId,
      studentId,
      studentName,
      className,
      assessmentId,
      assessmentTitle,
      attemptNumber: effectiveAttemptNumber,
      eventType,
      severity,
      metadata,
      eventId,
      io: req.app.get('io')
    });

    if (!result.success && result.isTerminated) {
      return res.status(403).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    console.error('Error processing assessment event:', err);
    res.status(500).json({ success: false, message: 'Failed to record assessment event' });
  }
});

/**
 * GET /api/v1/assessments/:assessmentId/events
 * Retrieves security and environment monitoring events for a specific assessment.
 */
router.get('/:assessmentId/events', async (req, res) => {
  const { assessmentId } = req.params;
  const tenantId = req.tenantId || req.user?.tenantId || 'global';

  let events = [];
  if (mongoose.connection.readyState === 1) {
    try {
      events = await AssessmentEvent.find({
        tenantId: String(tenantId),
        assessmentId: String(assessmentId)
      })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();
    } catch (err) {
      console.warn('⚠️ [AssessmentEvent] Query fallback:', err.message);
    }
  }

  res.json({
    success: true,
    count: events.length,
    data: events,
    events
  });
});

/**
 * GET /api/v1/assessments/active-monitoring
 * Trainer endpoint: Returns live monitoring status for active assessments in the tenant.
 */
router.get('/active-monitoring', requireRole('trainer', 'teacher', 'admin'), async (req, res) => {
  const tenantId = req.tenantId || req.user?.tenantId || 'global';
  const now = Date.now();

  try {
    const activeList = await getActiveAssessmentMonitoringList(tenantId);

    return res.json({
      success: true,
      count: activeList.length,
      data: activeList,
      activeSessions: activeList
    });
  } catch (err) {
    console.error('Error fetching active assessment monitoring:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve active monitoring' });
  }
});

/**
 * GET /api/v1/assessments/:assessmentId/submissions-detailed
 * Trainer endpoint: Returns detailed student results strictly based on persisted AssessmentAttempt records
 * and authoritative environment monitoring event timeline from MongoDB AssessmentEvent.
 */
router.get('/:assessmentId/submissions-detailed', requireRole('trainer', 'teacher', 'admin'), async (req, res) => {
  const { assessmentId } = req.params;
  const tenantId = req.tenantId || req.user?.tenantId;

  if (!tenantId) {
    return res.status(401).json({ success: false, message: 'Authentication and tenant context required' });
  }

  try {
    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;
    const orConditions = [{ id: String(assessmentId) }];
    if (mongoose.Types.ObjectId.isValid(assessmentId)) {
      orConditions.push({ _id: new mongoose.Types.ObjectId(assessmentId) });
    }

    let assessmentDoc = null;
    if (mongoose.connection.readyState === 1) {
      assessmentDoc = await Assessment.findOne({
        tenantId: tenantObjId,
        $or: orConditions
      }).lean();
    }

    // Determine canonical assessment IDs to match attempts
    const assessmentQueryIds = [String(assessmentId)];
    if (assessmentDoc?.id && !assessmentQueryIds.includes(assessmentDoc.id)) {
      assessmentQueryIds.push(assessmentDoc.id);
    }
    if (assessmentDoc?._id && !assessmentQueryIds.includes(assessmentDoc._id.toString())) {
      assessmentQueryIds.push(assessmentDoc._id.toString());
    }

    // Strictly fetch real AssessmentAttempts matching this tenant and assessment
    let attempts = [];
    if (mongoose.connection.readyState === 1) {
      attempts = await AssessmentAttempt.find({
        tenantId: tenantObjId,
        assessmentId: { $in: assessmentQueryIds }
      }).sort({ submittedAt: -1, startedAt: -1 }).lean();
    }

    if (!attempts || attempts.length === 0) {
      return res.json({
        success: true,
        assessmentId,
        count: 0,
        data: [],
        submissions: []
      });
    }

    // Fetch proctoring environment events for these specific attempts
    let events = [];
    if (mongoose.connection.readyState === 1) {
      events = await AssessmentEvent.find({
        tenantId: String(tenantId),
        assessmentId: { $in: assessmentQueryIds }
      }).sort({ timestamp: 1 }).lean();
    }

    // Index events by studentId and studentIdentifier
    const studentEventsMap = new Map();
    events.forEach((ev) => {
      const keys = [ev.studentId?.toString(), ev.studentIdentifier].filter(Boolean);
      keys.forEach((k) => {
        if (!studentEventsMap.has(k)) studentEventsMap.set(k, []);
        studentEventsMap.get(k).push(ev);
      });
    });

    const detailedResults = attempts.map((att) => {
      const sid = att.studentIdentifier || att.studentId?.toString() || 'STUDENT';
      const studentEvents = studentEventsMap.get(att.studentId?.toString()) ||
                            studentEventsMap.get(att.studentIdentifier) ||
                            [];

      const warningEvents = studentEvents.filter((e) =>
        ['FULLSCREEN_EXIT', 'TAB_OR_WINDOW_HIDDEN', 'WINDOW_BLUR', 'MAX_WARNINGS_EXCEEDED'].includes(e.eventType)
      );

      const timeline = studentEvents.map((e) => {
        let desc = 'Assessment activity logged';
        if (e.eventType === 'FULLSCREEN_ENTERED') desc = 'Entered focused assessment window.';
        else if (e.eventType === 'FULLSCREEN_EXIT') desc = 'Exited fullscreen assessment window.';
        else if (e.eventType === 'TAB_OR_WINDOW_HIDDEN') desc = 'Assessment window lost visibility.';
        else if (e.eventType === 'TAB_RETURNED') desc = 'Returned to assessment environment.';
        else if (e.eventType === 'WINDOW_BLUR') desc = 'Assessment focus lost.';
        else if (e.eventType === 'WINDOW_FOCUS') desc = 'Assessment focus regained.';
        else if (e.eventType === 'ASSESSMENT_SUBMITTED') desc = 'Assessment submitted by student.';
        else if (e.eventType === 'MAX_WARNINGS_EXCEEDED') desc = 'Automated session termination: 3 warning policy limit exceeded.';

        return {
          type: e.eventType,
          time: new Date(e.timestamp).toLocaleTimeString(),
          description: desc,
          severity: e.severity || 'low'
        };
      });

      let attemptStatusDisplay = 'Submitted On-Time';
      if (att.status === 'disqualified') {
        attemptStatusDisplay = 'Terminated (Policy Violations)';
      } else if (att.status === 'evaluated') {
        attemptStatusDisplay = 'Evaluated';
      } else if (att.status === 'submitted') {
        attemptStatusDisplay = 'Submitted (Awaiting Marks)';
      } else if (att.status === 'in_progress') {
        attemptStatusDisplay = 'In Progress';
      } else if (att.status) {
        attemptStatusDisplay = att.status.charAt(0).toUpperCase() + att.status.slice(1);
      }

      const totalMarks = att.maxScore != null ? att.maxScore : (assessmentDoc?.totalMarks || 20);
      const marksObtained = att.score != null ? att.score : (att.status === 'disqualified' ? 0 : null);
      const percentage = att.percentage != null ? att.percentage : (att.status === 'disqualified' ? 0 : null);

      return {
        attemptId: att._id?.toString(),
        studentId: sid,
        studentName: att.studentName || 'Student',
        className: att.className || 'Class 10 - Section A',
        assessmentTitle: att.assessmentTitle || assessmentDoc?.title || 'Assessment',
        startTime: att.startedAt ? new Date(att.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        submissionTime: att.submittedAt ? new Date(att.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
        durationMinutes: assessmentDoc?.durationMinutes || 45,
        timeUsedMinutes: att.timeUsedMinutes || 0,
        attemptStatus: attemptStatusDisplay,
        status: att.status,
        totalMarks,
        marksObtained,
        score: marksObtained,
        percentage,
        warningCount: att.violationCount != null ? att.violationCount : warningEvents.length,
        environmentEvents: timeline,
        questions: [],
        topicPerformance: [],
        correctCount: null,
        incorrectCount: null,
        unansweredCount: null
      };
    });

    res.json({
      success: true,
      assessmentId,
      count: detailedResults.length,
      data: detailedResults,
      submissions: detailedResults
    });
  } catch (err) {
    console.error('Error in submissions-detailed:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve detailed submissions' });
  }
});

/**
 * POST /api/v1/assessments/:assessmentId/submit
 * Validates and finalizes assessment submission against authoritative expiry timestamp.
 */
router.post('/:assessmentId/submit', async (req, res) => {
  const { assessmentId } = req.params;
  const { code, answers, violationCount = 0, questionResults = [], isTerminated = false, submissionReason = 'NORMAL', attemptNumber } = req.body;
  const userId = req.user?._id?.toString() || req.user?.id;
  const tenantId = req.tenantId || req.user?.tenantId;

  if (!userId || !tenantId) {
    return res.status(401).json({ success: false, status: 'failed', message: 'Authentication and tenant context required' });
  }

  try {
    const result = await finalizeAssessmentSubmission({
      tenantId,
      userId,
      assessmentId,
      attemptNumber: Number(attemptNumber) || 1,
      code,
      answers,
      questionResults,
      isTerminated,
      submissionReason,
      io: req.app.get('io')
    });

    if (!result.success) {
      const statusCode = result.isTerminated
        ? 403
        : (result.message?.includes('Database') || result.message?.includes('permanent storage') || result.message?.includes('unavailable'))
        ? 503
        : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('Error submitting assessment:', err);
    res.status(500).json({ success: false, message: 'Failed to submit assessment' });
  }
});

/**
 * POST /api/v1/assessments/attempts/:attemptId/grade
 * Evaluates an assessment attempt, sets marks, percentage, feedback, and transitions to 'evaluated'.
 */
router.post('/attempts/:attemptId/grade', requireRole('trainer', 'teacher', 'admin'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { score, teacherFeedback = '' } = req.body;
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Institutional tenant context missing' });
    }

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      return res.status(400).json({ success: false, message: 'Invalid attemptId' });
    }

    const numScore = Number(score);
    if (score === undefined || score === null || score === '' || isNaN(numScore) || numScore < 0) {
      return res.status(400).json({ success: false, message: 'A valid non-negative numerical score is required for evaluation.' });
    }

    const tenantObjId = mongoose.Types.ObjectId.isValid(tenantId) ? new mongoose.Types.ObjectId(tenantId) : tenantId;

    const attempt = await AssessmentAttempt.findOne({
      _id: new mongoose.Types.ObjectId(attemptId),
      tenantId: tenantObjId
    });

    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Assessment attempt not found or unauthorized' });
    }

    if (attempt.status === 'disqualified') {
      return res.status(400).json({ success: false, message: 'Cannot evaluate an attempt that was disqualified due to policy violations.' });
    }

    const assessmentDoc = await Assessment.findOne({
      tenantId: tenantObjId,
      $or: [
        { id: String(attempt.assessmentId) },
        { _id: mongoose.Types.ObjectId.isValid(attempt.assessmentId) ? new mongoose.Types.ObjectId(attempt.assessmentId) : null }
      ]
    }).lean();

    const maxScore = assessmentDoc?.totalMarks != null ? Number(assessmentDoc.totalMarks) : (attempt.maxScore || 100);
    if (numScore > maxScore) {
      return res.status(400).json({ success: false, message: `Score cannot exceed maximum score of ${maxScore}.` });
    }

    const percentage = Math.round((numScore / maxScore) * 100);

    attempt.maxScore = maxScore;
    attempt.score = numScore;
    attempt.percentage = percentage;
    attempt.teacherFeedback = teacherFeedback.trim();
    attempt.status = 'evaluated';
    await attempt.save();

    // Critical audit log for manual grading
    try {
      const { createCriticalAuditLog, actorFromRequest } = await import('../utils/auditLogger.js');
      await createCriticalAuditLog({
        tenantId,
        actor: actorFromRequest(req),
        action: 'ASSESSMENT_MANUALLY_GRADED',
        targetRecord: attempt._id,
        targetModel: 'AssessmentAttempt',
        details: {
          assessmentId: attempt.assessmentId,
          studentId: attempt.studentId,
          score: numScore,
          maxScore,
          percentage
        }
      });
    } catch (auditErr) {
      console.error('[AssessmentRoutes] Audit log error on grading attempt:', auditErr.message);
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${tenantId}`).emit('assessment:evaluated', {
        attemptId: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
        score: numScore,
        percentage
      });
    }

    res.json({
      success: true,
      message: 'Assessment attempt evaluated and marks recorded successfully.',
      attempt: {
        _id: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
        status: attempt.status,
        score: attempt.score,
        maxScore: attempt.maxScore,
        percentage: attempt.percentage,
        teacherFeedback: attempt.teacherFeedback
      }
    });
  } catch (err) {
    console.error('Error evaluating assessment attempt:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
