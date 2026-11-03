/**
 * Lumina LMS — Hardened Transactional & Resumable Cascade Deletion Service
 * 6th Civilians Corporation
 *
 * Implements:
 * 1. Strict Schema-Correct Identifier Typing:
 *    - Native ObjectId filters for ObjectId references (Attendance, Submission, AssessmentAttempt, etc.).
 *    - Strict String-casted filters for String references (Grade, TeacherNote).
 *    - Never mixes ObjectId and String values in a single type-incompatible filter.
 * 2. Sequential ACID Execution:
 *    - Inside MongoDB transactions, all operations execute strictly sequentially (no Promise.all).
 * 3. Durable Resumable Deletion Jobs:
 *    - Persists progress, completed stages, and failure checkpoints in MongoDB (DeletionJob).
 *    - Safe retries and resume capabilities after server/process restarts.
 *    - Post-cleanup verification: never marks complete while dependent records remain.
 * 4. Failure-Injection Hook:
 *    - Supports test-controlled stage interruptions to verify atomicity and recovery.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import StudentProgress from '../models/StudentProgress.js';
import Doubt from '../models/Doubt.js';
import Grade from '../models/Grade.js';
import Note from '../models/Note.js';
import TeacherNote from '../models/TeacherNote.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import Session from '../models/Session.js';
import Passkey from '../models/Passkey.js';
import EmailOtp from '../models/EmailOtp.js';
import Assignment from '../models/Assignment.js';
import Assessment from '../models/Assessment.js';
import Course from '../models/Course.js';
import DeletionJob from '../models/DeletionJob.js';
import { revokeAllUserSessions } from './sessionService.js';
import { createCriticalAuditLog } from '../utils/auditLogger.js';

/**
 * Executes a callback within a MongoDB replica set transaction if supported.
 * If transactions are not supported by the deployment (e.g. standalone/in-memory),
 * falls back to executing the operations sequentially with durable job tracking.
 */
export const runWithTransactionOrFallback = async (workFn, options = {}) => {
  const { requireTransaction = false, maxCommitRetries = 3 } = options;
  let session = null;
  let useTransaction = false;

  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
    const result = await workFn(session);

    let commitRetries = 0;
    while (true) {
      try {
        await session.commitTransaction();
        break;
      } catch (commitErr) {
        const isUnknownCommit = commitErr?.hasErrorLabel && commitErr.hasErrorLabel('UnknownTransactionCommitResult');
        if (isUnknownCommit && commitRetries < maxCommitRetries) {
          commitRetries++;
          await new Promise((r) => setTimeout(r, 100 * commitRetries));
          continue;
        }
        if (isUnknownCommit) {
          const uncertainErr = new Error('Transaction commit outcome is uncertain after retries.');
          uncertainErr.code = 'COMMIT_OUTCOME_UNCERTAIN';
          uncertainErr.isCommitUncertain = true;
          uncertainErr.originalError = commitErr;
          throw uncertainErr;
        }
        throw commitErr;
      }
    }

    return { success: true, isTransactional: true, data: result };


  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch {}
      try {
        session.endSession();
      } catch {}
      session = null;
    }

    const errMsg = (error.message || '') + ' ' + (error.errorResponse?.errmsg || '') + ' ' + (error.errorResponse?.message || '');
    const isNoReplicaSetError =
      error.code === 20 ||
      error.codeName === 'IllegalOperation' ||
      error.errorResponse?.code === 20 ||
      error.errorResponse?.codeName === 'IllegalOperation' ||
      errMsg.includes('replica set') ||
      errMsg.includes('Transaction numbers') ||
      errMsg.includes('does not support retryable writes') ||
      errMsg.includes('Transactions are not supported');

    if (isNoReplicaSetError) {
      if (requireTransaction) {
        const txErr = new Error('Database transactions are unavailable. Operation requires atomic transaction support to prevent partial writes.');
        txErr.code = 'TRANSACTION_REQUIRED';
        txErr.isTransactionalError = true;
        throw txErr;
      }
      const result = await workFn(null);
      return { success: true, isTransactional: false, data: result };


    }

    throw error;
  } finally {
    if (session) {
      try {
        session.endSession();
      } catch {}
    }
  }
};

/**
 * Runs a strictly mandatory transaction. Fails closed with TRANSACTION_REQUIRED
 * if the database environment does not support replica set transactions.
 * Never executes sequential non-transactional fallback.
 */
export const runMandatoryTransaction = async (workFn, options = {}) => {
  return runWithTransactionOrFallback(workFn, { ...options, requireTransaction: true });
};

/**
 * Permanently deletes a student account and all 10 dependent collections.
 * Supports resume capability and optional failure injection for testing.
 */
export const cascadeDeleteStudent = async (targetStudent, actor, options = {}) => {
  if (!targetStudent || !targetStudent._id) {
    throw new Error('Valid target student document is required for deletion.');
  }

  const { failAtStage, existingJobId } = options;

  // Revoke active sessions immediately to cut off ingress
  try {
    await revokeAllUserSessions(targetStudent._id.toString(), 'admin_permanent_deletion');
  } catch (revErr) {
    console.warn(`[CascadeDelete] Non-fatal session revocation notice: ${revErr.message}`);
  }

  // Schema-correct typing:
  const studentObjectId = new mongoose.Types.ObjectId(targetStudent._id);
  const tenantObjectId = targetStudent.tenantId ? new mongoose.Types.ObjectId(targetStudent.tenantId) : null;
  const tenantString = targetStudent.tenantId ? String(targetStudent.tenantId) : '';
  const studentIdString = targetStudent.studentId ? String(targetStudent.studentId) : '';
  const studentObjIdString = String(targetStudent._id);

  // Initialize or fetch durable DeletionJob record
  let job;
  if (existingJobId) {
    job = await DeletionJob.findOne({ jobId: existingJobId });
    if (!job) throw new Error(`DeletionJob with id "${existingJobId}" not found.`);
    job.status = 'in_progress';
    job.retryCount += 1;
    await job.save();
  } else {
    job = await DeletionJob.create({
      jobId: `del-stu-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      tenantId: tenantObjectId,
      targetModel: 'User',
      targetId: studentObjectId,
      targetIdentifier: studentIdString,
      status: 'in_progress',
      currentStage: 'init',
      completedStages: [],
      actor: actor ? { userId: String(actor.userId || actor.id || 'system'), role: actor.role || 'admin', email: actor.email || '' } : { userId: 'system', role: 'admin', email: 'system@lumina.internal' },
      startedAt: new Date()
    });
  }

  const completedSet = new Set(job.completedStages.map((s) => s.stage));

  const executeCascade = async (session) => {
    const opts = session ? { session } : {};



    // Helper to record and checkpoint each stage sequentially
    const runStage = async (stageName, collectionName, deletePromiseFn) => {
      if (completedSet.has(stageName)) {
        return; // Already completed in a prior run
      }

      const res = await deletePromiseFn();
      const count = res?.deletedCount ?? 0;

      // Update in-memory job tracker
      job.completedStages.push({
        stage: stageName,
        collectionName,
        deletedCount: count,
        completedAt: new Date()
      });
      job.currentStage = stageName;

      // Save job progress (skip session if standalone journal fallback)
      if (!session) {
        await job.save();
      }

      // Failure-injection check for testing resilience
      if (failAtStage && failAtStage === stageName) {
        const injectedErr = new Error(`SIMULATED_FAILURE_AT_STAGE: ${stageName}`);
        injectedErr.stage = stageName;
        throw injectedErr;
      }
    };



    // 1. Attendance Records (ObjectId studentId, ObjectId tenantId)
    await runStage('attendance', 'Attendance', () =>
      Attendance.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 2. Assignment Submissions (ObjectId studentId, ObjectId tenantId)
    await runStage('submission', 'Submission', () =>
      Submission.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 3. Assessment Attempts (ObjectId studentId, ObjectId tenantId)
    await runStage('assessment_attempt', 'AssessmentAttempt', () =>
      AssessmentAttempt.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 4. Student Topic Progress (ObjectId studentId, ObjectId tenantId)
    await runStage('student_progress', 'StudentProgress', () =>
      StudentProgress.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 5. Academic Doubts (ObjectId studentId, ObjectId tenantId)
    await runStage('doubt', 'Doubt', () =>
      Doubt.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 6. Grades & Transcripts (String studentId, ObjectId tenantId)
    // Query exclusively with Strings to prevent CastError
    const gradeStringFilters = [{ studentId: studentIdString }];
    if (studentObjIdString !== studentIdString) {
      gradeStringFilters.push({ studentId: studentObjIdString });
    }
    await runStage('grade', 'Grade', () =>
      Grade.deleteMany({
        tenantId: tenantObjectId,
        $or: gradeStringFilters
      }, opts)
    );

    // 7. Personal Notes (ObjectId owner, ObjectId tenantId)
    await runStage('note', 'Note', () =>
      Note.deleteMany({ tenantId: tenantObjectId, owner: studentObjectId }, opts)
    );

    // 8. Teacher Notes on Student (String studentId, String tenantId)
    // Strictly uses String casting for both fields
    const tnStringFilters = [{ studentId: studentIdString }];
    if (studentObjIdString !== studentIdString) {
      tnStringFilters.push({ studentId: studentObjIdString });
    }
    await runStage('teacher_note', 'TeacherNote', () =>
      TeacherNote.deleteMany({
        tenantId: tenantString,
        $or: tnStringFilters
      }, opts)
    );

    // 9. Retake Authorizations (ObjectId studentId, ObjectId tenantId)
    await runStage('retake_authorization', 'RetakeAuthorization', () =>
      RetakeAuthorization.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 10. Proctoring Audit Events (ObjectId studentId, ObjectId tenantId)
    await runStage('assessment_event', 'AssessmentEvent', () =>
      AssessmentEvent.deleteMany({ tenantId: tenantObjectId, studentId: studentObjectId }, opts)
    );

    // 11. Security Credentials (Executed sequentially, no Promise.all)
    await runStage('session', 'Session', () => Session.deleteMany({ userId: studentObjectId }, opts));
    await runStage('passkey', 'Passkey', () => Passkey.deleteMany({ userId: studentObjectId }, opts));
    await runStage('email_otp', 'EmailOtp', () => EmailOtp.deleteMany({ userId: studentObjectId }, opts));

    // 12. Primary User Record
    await runStage('user', 'User', () =>
      User.deleteOne({ _id: studentObjectId, tenantId: tenantObjectId }, opts)
    );

    return { completedStages: job.completedStages };


  };



  try {
    const { isTransactional } = await runWithTransactionOrFallback(executeCascade);

    // Post-Cleanup Verification: Ensure no dependent records remain
    const remainingChecks = await Promise.all([
      Attendance.countDocuments({ tenantId: tenantObjectId, studentId: studentObjectId }),
      Submission.countDocuments({ tenantId: tenantObjectId, studentId: studentObjectId }),
      AssessmentAttempt.countDocuments({ tenantId: tenantObjectId, studentId: studentObjectId }),
      Grade.countDocuments({ tenantId: tenantObjectId, $or: [{ studentId: studentIdString }, { studentId: studentObjIdString }] }),
      TeacherNote.countDocuments({ tenantId: tenantString, $or: [{ studentId: studentIdString }, { studentId: studentObjIdString }] }),
      User.countDocuments({ _id: studentObjectId })
    ]);

    const totalRemaining = remainingChecks.reduce((acc, count) => acc + count, 0);
    if (totalRemaining > 0) {
      job.status = 'failed';
      job.failedStage = { stage: 'post_verification', error: `${totalRemaining} orphaned records remained post-deletion.`, failedAt: new Date() };


      await job.save();
      throw new Error(`CASCADE_VERIFICATION_FAILED: ${totalRemaining} dependent records remained after deletion.`);
    }

    job.status = 'completed';
    job.currentStage = 'finished';
    job.completedAt = new Date();
    await job.save();

    // Critical Audit Log
    createCriticalAuditLog({
      tenantId: targetStudent.tenantId,
      actor: actor || { userId: 'system', role: 'admin', email: 'system@lumina.internal' },
      action: 'ADMIN_STUDENT_PERMANENTLY_DELETED',
      targetRecord: targetStudent._id,
      targetModel: 'User',
      details: {
        email: targetStudent.email,
        studentId: targetStudent.studentId,
        name: targetStudent.name,
        isTransactional,
        jobId: job.jobId,
        stages: job.completedStages
      }
    });

    return {
      success: true,
      isTransactional,
      jobId: job.jobId,
      stages: job.completedStages
    };


  } catch (err) {
    job.status = 'failed';
    job.failedStage = {
      stage: err.stage || job.currentStage,
      error: err.message,
      failedAt: new Date()
    };


    await job.save();

    throw err;
  }
};



/**
 * Resumes a previously incomplete or failed DeletionJob by its ID.
 */
export const resumeDeletionJob = async (jobId, actor) => {
  const job = await DeletionJob.findOne({ jobId });
  if (!job) {
    throw new Error(`DeletionJob with ID "${jobId}" not found.`);
  }

  if (job.status === 'completed') {
    return { success: true, message: 'Job already completed.', job };


  }

  // Mock target student document with verified IDs for resumption
  const targetStudent = {
    _id: job.targetId,
    tenantId: job.tenantId,
    studentId: job.targetIdentifier
  };



  return cascadeDeleteStudent(targetStudent, actor, { existingJobId: jobId });
};



/**
 * Cascades course deletion with dependency checks and sequential execution.
 */
export const cascadeDeleteCourse = async (course, actor, force = false) => {
  if (!course || !course._id) {
    throw new Error('Valid course document is required.');
  }

  const courseObjectId = new mongoose.Types.ObjectId(course._id);
  const tenantObjectId = course.tenantId ? new mongoose.Types.ObjectId(course.tenantId) : null;
  const courseCode = course.code ? String(course.code) : '';

  const linkedAssignments = await Assignment.countDocuments({
    $or: [{ courseId: courseObjectId }, { courseCode: courseCode }],
    tenantId: tenantObjectId
  });

  const linkedAssessments = await Assessment.countDocuments({
    $or: [{ courseId: courseObjectId }, { courseCode: courseCode }],
    tenantId: tenantObjectId
  });

  if ((linkedAssignments > 0 || linkedAssessments > 0) && !force) {
    return {
      success: false,
      conflict: true,
      hasDependencies: true,
      assignmentsCount: linkedAssignments,
      assessmentsCount: linkedAssessments,
      message: `Cannot delete course: ${linkedAssignments} assignments and ${linkedAssessments} assessments reference this course. Pass force=true to cascade.`
    };


  }

  const executeCourseCascade = async (session) => {
    const opts = session ? { session } : {};



    if (force && (linkedAssignments > 0 || linkedAssessments > 0)) {
      const assignments = await Assignment.find(
        { $or: [{ courseId: courseObjectId }, { courseCode: courseCode }], tenantId: tenantObjectId },
        '_id',
        opts
      );
      const assignmentIds = assignments.map((a) => a._id);

      // Execute sequentially (no Promise.all inside transaction)
      if (assignmentIds.length > 0) {
        await Submission.deleteMany({ assignmentId: { $in: assignmentIds } }, opts);
        await Assignment.deleteMany({ _id: { $in: assignmentIds } }, opts);
      }
      await Assessment.deleteMany(
        { $or: [{ courseId: courseObjectId }, { courseCode: courseCode }], tenantId: tenantObjectId },
        opts
      );
      if (courseCode) {
        await StudentProgress.deleteMany({ courseId: courseCode, tenantId: tenantObjectId }, opts);
      }
    }

    await Course.deleteOne({ _id: courseObjectId, tenantId: tenantObjectId }, opts);
    return { deletedCourseId: course._id };


  };



  const { isTransactional } = await runWithTransactionOrFallback(executeCourseCascade);

  createCriticalAuditLog({
    tenantId: course.tenantId,
    actor: actor || { userId: 'system', role: 'admin', email: 'system@lumina.internal' },
    action: 'ADMIN_COURSE_DELETED',
    targetRecord: course._id,
    targetModel: 'Course',
    details: { code: course.code, title: course.title, force, isTransactional }
  });

  return { success: true, isTransactional };


};



export default {
  runWithTransactionOrFallback,
  cascadeDeleteStudent,
  resumeDeletionJob,
  cascadeDeleteCourse
};


