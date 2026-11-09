import express from 'express';
import fs from 'fs';
import path from 'path';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import Batch from '../models/Batch.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import College from '../models/College.js';
import AuditLog from '../models/AuditLog.js';
import Announcement from '../models/Announcement.js';
import Doubt from '../models/Doubt.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import StudentProgress from '../models/StudentProgress.js';
import Note from '../models/Note.js';
import TeacherNote from '../models/TeacherNote.js';
import AcademicEvent from '../models/AcademicEvent.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import Grade from '../models/Grade.js';
import Session from '../models/Session.js';
import Passkey from '../models/Passkey.js';
import EmailOtp from '../models/EmailOtp.js';
import { computeSchoolLeaderboard, computeAllSchoolsComparison } from '../services/schoolLeaderboardService.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { createCriticalAuditLog, actorFromRequest } from '../utils/auditLogger.js';
import generateSecureTemporaryPassword from '../utils/passwordGenerator.js';
import { allocateUniqueStudentId } from '../utils/studentIdGenerator.js';
import { validatePrivilegedIdentity } from '../config/privilegedIdentities.js';
import { validatePasswordAgainstEffectivePolicy } from '../utils/passwordPolicyValidator.js';
import { revokeAllUserSessions } from '../services/sessionService.js';
import { handleDatabaseError } from '../utils/errorHandler.js';
import { requireIdempotency } from '../middleware/idempotencyMiddleware.js';
import { cascadeDeleteStudent, cascadeDeleteCourse, runWithTransactionOrFallback, runMandatoryTransaction } from '../services/cascadeDeletionService.js';

import { isRedisHealthy } from '../services/redisService.js';
import { getSecurityPolicies, updateSecurityPolicies } from '../controllers/securityPolicyController.js';

const router = express.Router();

// All routes require admin or superadmin authentication first
router.use(verifyToken, requireRole(['admin', 'superadmin']));

// Apply idempotency check for state-changing administrative requests (scoped to verified user and tenant)
router.use(requireIdempotency());

/**
 * Helper to determine tenant scoping based on RBAC:
 * - Ordinary institution admin ('admin'): strictly scoped to req.tenantId.
 * - Company-wide super-administrator ('superadmin'): can query cross-tenant or specific tenant.
 */
const getAdminTenantFilter = (req) => {
  if (req.user.role === 'superadmin') {
    const filterId = req.query.tenantId || req.query.collegeId || req.headers['x-tenant-id'];
    if (filterId && mongoose.Types.ObjectId.isValid(filterId)) {
      return { tenantId: filterId };
    }
    return {}; // Cross-tenant company-wide oversight for 6th Civilians Corporation
  }
  return { tenantId: req.tenantId };
};

/**
 * GET /api/v1/admin/overview
 *
 * Returns real MongoDB aggregated statistics for the company operations console.
 * Business statistics are calculated directly from persisted records.
 */
router.get('/overview', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const isSuperAdmin = req.user.role === 'superadmin' && Object.keys(tenantFilter).length === 0;

    let students = 0, trainers = 0, admins = 0, courses = 0, batches = 0, institutions = 0;
    let activeInstitutions = 0, pendingSetupInstitutions = 0, incompleteProfiles = 0, pendingGrading = 0;
    let isRedisReady = false;

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is temporarily unavailable. Operational metrics cannot be verified.'
      });
    }

    try {
      const instScope = isSuperAdmin ? {} : { _id: req.tenantId };
      const [
        counts,
        activeInstCount,
        pendingInstCount,
        incompleteCount,
        pendingGradingCount,
        redisStatus
      ] = await Promise.all([
        Promise.all([
          User.countDocuments({ ...tenantFilter, role: 'student', soft_deleted: { $ne: true } }),
          User.countDocuments({ ...tenantFilter, role: { $in: ['trainer', 'teacher'] }, soft_deleted: { $ne: true } }),
          User.countDocuments({ ...tenantFilter, role: { $in: ['admin', 'superadmin'] }, soft_deleted: { $ne: true } }),
          Course.countDocuments(tenantFilter),
          Batch.countDocuments(tenantFilter),
          College.countDocuments(instScope)
        ]),
        College.countDocuments({ ...instScope, status: 'active' }),
        College.countDocuments({ ...instScope, status: { $ne: 'active' } }),
        User.countDocuments({
          ...tenantFilter,
          role: 'student',
          soft_deleted: { $ne: true },
          $or: [
            { phone: { $in: [null, ''] } },
            { address: { $in: [null, ''] } },
            { 'emergencyContact.phone': { $in: [null, ''] } }
          ]
        }),
        Submission.countDocuments({
          ...tenantFilter,
          status: { $in: ['submitted', 'pending', 'resubmitted'] }
        }),
        isRedisHealthy().catch(() => false)
      ]);

      students = counts[0];
      trainers = counts[1];
      admins = counts[2];
      courses = counts[3] || 0;
      batches = counts[4] || 0;
      institutions = counts[5] || 0;
      activeInstitutions = activeInstCount || 0;
      pendingSetupInstitutions = pendingInstCount || 0;
      incompleteProfiles = incompleteCount || 0;
      pendingGrading = pendingGradingCount || 0;
      isRedisReady = redisStatus;
    } catch (dbErr) {
      console.error('Admin overview DB count failed:', dbErr.message);
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Failed to retrieve authoritative metrics from database.'
      });
    }

    res.json({
      success: true,
      data: {
        tenantId: req.tenantId,
        isSuperAdmin,
        institutions,
        activeInstitutions,
        pendingSetupInstitutions,
        incompleteProfiles,
        pendingGrading,
        users: { students, trainers, admins, total: students + trainers + admins },
        courses,
        batches,
        serviceHealth: {
          database: mongoose.connection.readyState === 1 ? 'healthy' : 'disconnected',
          redis: isRedisReady ? 'connected' : (process.env.NODE_ENV === 'production' ? 'disconnected' : 'in-memory-fallback'),
          realtime: 'connected'
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[AdminRoutes] /overview error:', err.message);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve overview data.' }
    });
  }
});

router.get('/batches', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const batches = await Batch.find(tenantFilter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, count: batches ? batches.length : 0, batches: batches || [] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const targetTenantId = isSuperAdmin
      ? (req.body.targetTenantId || req.body.tenantId || req.body.collegeId || req.headers['x-tenant-id'] || req.query.tenantId)
      : req.tenantId;

    if (!targetTenantId || !mongoose.Types.ObjectId.isValid(targetTenantId)) {
      return res.status(400).json({ success: false, message: 'Valid target institution (tenantId) is required to create a batch.' });
    }

    const targetCollege = await College.findOne({ _id: targetTenantId, status: 'active' });
    if (!targetCollege) {
      return res.status(400).json({ success: false, message: 'Specified target institution does not exist or is inactive.' });
    }

    const { name, ...rest } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Batch name is required.' });
    }

    const cleanName = name.trim();
    const existing = await Batch.findOne({ tenantId: targetTenantId, name: cleanName });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_BATCH_NAME',
        message: `A cohort or class named "${cleanName}" already exists in this institution.`
      });
    }

    const data = { ...rest, name: cleanName, tenantId: targetTenantId };
    delete data._id;
    const batch = await Batch.create(data);

    createCriticalAuditLog({
      tenantId: targetTenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_BATCH_CREATED',
      targetRecord: batch._id,
      targetModel: 'Batch',
      details: { name: batch.name, tenantId: targetTenantId }
    });

    res.status(201).json({ success: true, batch });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to create batch.');
  }
});

router.put('/batches/:id', async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.tenantId;
    const tenantFilter = getAdminTenantFilter(req);

    if (data.name) {
      data.name = data.name.trim();
      const existing = await Batch.findOne({
        _id: { $ne: req.params.id },
        ...tenantFilter,
        name: data.name
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_BATCH_NAME',
          message: `Another cohort or class with name "${data.name}" already exists.`
        });
      }
    }

    const batch = await Batch.findOneAndUpdate(
      { _id: req.params.id, ...tenantFilter },
      data,
      { new: true, runValidators: true }
    );
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found.' });
    }
    res.json({ success: true, batch });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to update batch.');
  }
});

router.delete('/batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch identifier format.' });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const batch = await Batch.findOne({ _id: id, ...tenantFilter });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found in this institution.' });
    }

    const enrolledStudents = await User.countDocuments({
      $or: [{ batchId: id }, { batch: batch.name }],
      tenantId: batch.tenantId,
      soft_deleted: { $ne: true }
    });

    if (enrolledStudents > 0 && req.query.force !== 'true') {
      return res.status(409).json({
        success: false,
        code: 'BATCH_HAS_ACTIVE_STUDENTS',
        message: `Cannot delete batch: ${enrolledStudents} active student(s) are currently assigned to this cohort. Reassign them first or specify ?force=true.`,
        hasActiveStudents: true,
        activeStudents: enrolledStudents,
        enrolledCount: enrolledStudents
      });
    }

    // Unassign students from this batch if forced
    if (enrolledStudents > 0) {
      await User.updateMany(
        { $or: [{ batchId: id }, { batch: batch.name }], tenantId: batch.tenantId },
        { $unset: { batchId: 1, batch: 1 } }
      );
    }

    await Batch.deleteOne({ _id: id });

    createCriticalAuditLog({
      tenantId: batch.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_BATCH_DELETED',
      targetRecord: batch._id,
      targetModel: 'Batch',
      details: { name: batch.name, tenantId: batch.tenantId }
    });

    res.json({ success: true, message: `Batch ${batch.name} deleted successfully.` });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to delete batch.');
  }
});

router.get('/trainers', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const trainers = await User.find({
      ...tenantFilter,
      role: { $in: ['trainer', 'teacher'] },
      soft_deleted: { $ne: true }
    }).select('-password -twoFactorSecret -twoFactorBackupCodes').sort({ name: 1 }).lean();

    const batchIds = (trainers || []).map((t) => t.batchId).filter(Boolean);
    const batches = await Batch.find({ _id: { $in: batchIds } }).select('name targetClass').lean();
    const batchMap = new Map(batches.map((b) => [b._id.toString(), b]));

    const enrichedTrainers = (trainers || []).map((t) => ({
      ...t,
      batchName: t.batchId ? batchMap.get(t.batchId.toString())?.name || null : null,
      targetClass: t.batchId ? batchMap.get(t.batchId.toString())?.targetClass || null : null
    }));

    res.json({ success: true, count: enrichedTrainers.length, trainers: enrichedTrainers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/trainers', async (req, res) => {
  try {
    const { name, email, password, studentId, department, phone, ...rest } = req.body;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Trainer full name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Trainer email is required.' });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Check if an existing account uses this email
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_IDENTITY',
        message: 'A user account with this email address already exists in the system.'
      });
    }

    let finalPassword = password;
    if (!finalPassword) {
      finalPassword = generateSecureTemporaryPassword(14);
    } else {
      // Dynamic password policy validation derived from MongoDB SecurityPolicy
      const passwordValidation = await validatePasswordAgainstEffectivePolicy(finalPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          code: 'PASSWORD_POLICY_VIOLATION',
          message: passwordValidation.message
        });
      }
    }

    // SECURITY: Validate and resolve target tenant institution
    let targetTenantId = null;
    let targetCollege = null;

    if (req.user.role === 'superadmin') {
      const tenantParam = req.body.tenantId || req.body.collegeId;
      if (!tenantParam) {
        return res.status(400).json({
          success: false,
          code: 'MISSING_TENANT_ASSIGNMENT',
          message: 'Target institution (tenantId) is required when provisioning an educator.'
        });
      }
      if (!mongoose.Types.ObjectId.isValid(tenantParam)) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_TENANT_ASSIGNMENT',
          message: 'Invalid target institution identifier.'
        });
      }
      targetCollege = await College.findOne({ _id: tenantParam, status: 'active' });
      if (!targetCollege) {
        return res.status(404).json({
          success: false,
          code: 'TENANT_NOT_FOUND_OR_INACTIVE',
          message: 'Target institution not found or is not currently active.'
        });
      }
      targetTenantId = targetCollege._id;
    } else if (req.user.role === 'admin') {
      if (!req.tenantId) {
        return res.status(403).json({
          success: false,
          code: 'MISSING_TENANT_CONTEXT',
          message: 'Administrator does not belong to a valid tenant institution.'
        });
      }
      targetCollege = await College.findOne({ _id: req.tenantId, status: 'active' });
      if (!targetCollege) {
        return res.status(404).json({
          success: false,
          code: 'TENANT_NOT_FOUND_OR_INACTIVE',
          message: 'Administrator institution not found or is not active.'
        });
      }
      // Ordinary admin cannot provision for any other institution; strictly use own verified tenant
      targetTenantId = targetCollege._id;
    } else {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PRIVILEGES',
        message: 'Only authorized administrators may provision faculty accounts.'
      });
    }

    // Determine educator role: explicit role overrides, otherwise infer from target institution type
    const isSchool = targetCollege?.institutionType === 'school';
    const targetRole = rest.role === 'teacher' || (!rest.role && isSchool) ? 'teacher' : 'trainer';

    // SECURITY: Enforce approved privileged identity policy for trainers / teachers
    const identityCheck = validatePrivilegedIdentity(cleanEmail, targetRole);
    if (!identityCheck.allowed) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_PRIVILEGED_IDENTITY',
        message: identityCheck.reason || 'Educator accounts require an authorized organizational identity or approved email domain.'
      });
    }

    let resolvedStudentId = studentId ? studentId.trim() : null;
    if (resolvedStudentId) {
      const existingId = await User.findOne({ studentId: resolvedStudentId });
      if (existingId) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_IDENTIFIER',
          message: `The educator identifier "${resolvedStudentId}" is already assigned to another account.`
        });
      }
    } else {
      let uniqueFound = false;
      const prefix = targetRole === 'teacher' ? 'TCH' : 'TRN';
      while (!uniqueFound) {
        resolvedStudentId = `${prefix}-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
        const exists = await User.findOne({ studentId: resolvedStudentId });
        if (!exists) uniqueFound = true;
      }
    }

    // Batch assignment if batchId is provided
    let resolvedBatchId = null;
    if (req.body.batchId && mongoose.Types.ObjectId.isValid(req.body.batchId)) {
      const batchDoc = await Batch.findOne({ _id: req.body.batchId, tenantId: targetTenantId });
      if (!batchDoc) {
        return res.status(404).json({
          success: false,
          code: 'BATCH_NOT_FOUND',
          message: 'Target cohort/class was not found in this institution.'
        });
      }
      resolvedBatchId = batchDoc._id;
    }

    // SECURITY: Hash password before storing — never store plaintext credentials
    const hashedPassword = await bcrypt.hash(finalPassword, 12);
    const trainerData = {
      ...rest,
      name: cleanName,
      email: cleanEmail,
      studentId: resolvedStudentId,
      department: department ? department.trim() : (targetRole === 'teacher' ? 'Academics' : 'School of Computing'),
      phone: phone ? phone.trim() : undefined,
      role: targetRole,
      batchId: resolvedBatchId,
      status: 'Active',
      accountStatus: 'Active',
      mustChangePassword: true,
      tenantId: targetTenantId,
      password: hashedPassword
    };
    const trainer = await User.create(trainerData);

    if (resolvedBatchId) {
      await Batch.findByIdAndUpdate(resolvedBatchId, {
        $addToSet: { assignedTrainers: trainer._id }
      });
    }

    // CRITICAL audit: educator account creation is an admin action
    try {
      await createCriticalAuditLog({
        tenantId: targetTenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_TRAINER_CREATED',
        targetRecord: trainer._id,
        targetModel: 'User',
        details: { email: trainer.email, name: trainer.name, studentId: trainer.studentId, role: trainer.role, batchId: trainer.batchId }
      });
    } catch (auditErr) {
      console.error('[AdminRoutes] CRITICAL audit failed for educator creation:', auditErr.message);
      try {
        await User.findByIdAndDelete(trainer._id);
        if (resolvedBatchId) {
          await Batch.findByIdAndUpdate(resolvedBatchId, { $pull: { assignedTrainers: trainer._id } });
        }
      } catch (rollbackErr) {
        console.error(`[CRITICAL UNRESOLVED STATE] Trainer creation audit failed (${auditErr.message}) and rollback failed (${rollbackErr.message}) for trainer ${trainer._id}`);
      }
      return res.status(500).json({ success: false, message: 'Security audit logging failed. Trainer creation aborted.' });
    }

    // Never return credentials or sensitive secrets in the response
    const safeTrainer = trainer.toObject();
    delete safeTrainer.password;
    delete safeTrainer.twoFactorSecret;
    delete safeTrainer.twoFactorBackupCodes;
    res.status(201).json({
      success: true,
      trainer: safeTrainer,
      temporaryPassword: finalPassword
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to provision trainer.');
  }
});

/**
 * GET /api/v1/admin/trainers/:id
 * Retrieve single trainer details and assigned cohorts
 */
router.get('/trainers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainer identifier format.' });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const trainer = await User.findOne({
      _id: id,
      ...tenantFilter,
      role: { $in: ['trainer', 'teacher'] }
    }).select('-password -twoFactorSecret -twoFactorBackupCodes').lean();

    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found in this institution.' });
    }

    const assignedBatches = await Batch.find({
      tenantId: trainer.tenantId,
      $or: [
        ...(trainer.batchId ? [{ _id: trainer.batchId }] : []),
        { assignedTrainers: trainer._id }
      ]
    }).select('name targetClass startDate endDate status').lean();

    const batchIds = assignedBatches.map((b) => b._id);
    const studentCount = await User.countDocuments({
      tenantId: trainer.tenantId,
      role: 'student',
      batchId: { $in: batchIds },
      soft_deleted: { $ne: true }
    });

    res.json({
      success: true,
      trainer: {
        ...trainer,
        assignedBatches,
        assignedStudentsCount: studentCount
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to fetch trainer details.');
  }
});

/**
 * PUT /api/v1/admin/trainers/:id
 * Updates trainer profile and batch assignment with full tenant isolation.
 * Preserves historical records and audit trail.
 */
router.put('/trainers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainer identifier format.' });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const trainer = await User.findOne({
      _id: id,
      ...tenantFilter,
      role: { $in: ['trainer', 'teacher'] }
    });

    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found in this institution.' });
    }

    const { name, phone, department, role, batchId, status, accountStatus } = req.body;
    const oldBatchId = trainer.batchId ? trainer.batchId.toString() : null;

    if (name && typeof name === 'string' && name.trim()) {
      trainer.name = name.trim();
    }
    if (phone !== undefined) {
      trainer.phone = typeof phone === 'string' ? phone.trim() : phone;
    }
    if (department && typeof department === 'string' && department.trim()) {
      trainer.department = department.trim();
    }
    if (role && ['trainer', 'teacher'].includes(role)) {
      trainer.role = role;
    }
    if (status && ['Active', 'Inactive'].includes(status)) {
      trainer.status = status;
    }
    if (accountStatus && ['Active', 'Inactive'].includes(accountStatus)) {
      trainer.accountStatus = accountStatus;
      if (accountStatus === 'Inactive') {
        trainer.soft_deleted = true;
        await revokeAllUserSessions(trainer._id.toString(), 'trainer_deactivated');
      }
    }

    if (batchId !== undefined) {
      if (batchId === null || batchId === '') {
        trainer.batchId = null;
        if (oldBatchId) {
          await Batch.findByIdAndUpdate(oldBatchId, {
            $pull: { assignedTrainers: trainer._id }
          });
        }
      } else if (mongoose.Types.ObjectId.isValid(batchId)) {
        const newBatchDoc = await Batch.findOne({
          _id: batchId,
          tenantId: trainer.tenantId
        });
        if (!newBatchDoc) {
          return res.status(404).json({ success: false, code: 'BATCH_NOT_FOUND', message: 'Assigned batch does not exist in this institution.' });
        }
        trainer.batchId = newBatchDoc._id;

        if (oldBatchId && oldBatchId !== newBatchDoc._id.toString()) {
          await Batch.findByIdAndUpdate(oldBatchId, {
            $pull: { assignedTrainers: trainer._id }
          });
        }
        await Batch.findByIdAndUpdate(newBatchDoc._id, {
          $addToSet: { assignedTrainers: trainer._id }
        });
      } else {
        return res.status(400).json({ success: false, message: 'Invalid batch identifier format.' });
      }
    }

    await trainer.save();

    await createCriticalAuditLog({
      tenantId: trainer.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_TRAINER_UPDATED',
      targetRecord: trainer._id,
      targetModel: 'User',
      details: {
        name: trainer.name,
        email: trainer.email,
        department: trainer.department,
        batchId: trainer.batchId,
        role: trainer.role
      }
    });

    const safeTrainer = trainer.toObject();
    delete safeTrainer.password;
    delete safeTrainer.twoFactorSecret;
    delete safeTrainer.twoFactorBackupCodes;

    res.json({
      success: true,
      message: 'Trainer updated successfully.',
      trainer: safeTrainer
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to update trainer.');
  }
});

/**
 * DELETE /api/v1/admin/trainers/:id
 * Deactivates a trainer account safely.
 * DOES NOT delete assigned students or historical academic records.
 * Revokes all active sessions immediately.
 */
router.delete('/trainers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid trainer identifier format.' });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const trainer = await User.findOne({
      _id: id,
      ...tenantFilter,
      role: { $in: ['trainer', 'teacher'] }
    });

    if (!trainer) {
      return res.status(404).json({ success: false, message: 'Trainer not found in this institution.' });
    }

    // Soft deactivation
    trainer.soft_deleted = true;
    trainer.accountStatus = 'Inactive';
    trainer.status = 'Inactive';
    await trainer.save();

    // Invalidate active sessions immediately
    await revokeAllUserSessions(trainer._id.toString(), 'trainer_deactivated');

    await createCriticalAuditLog({
      tenantId: trainer.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_TRAINER_DEACTIVATED',
      targetRecord: trainer._id,
      targetModel: 'User',
      details: {
        trainerId: trainer._id,
        email: trainer.email,
        name: trainer.name,
        studentId: trainer.studentId
      }
    });

    res.json({
      success: true,
      message: 'Trainer account has been deactivated and active sessions revoked. Historical records remain intact.'
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to deactivate trainer.');
  }
});

/**
 * POST /api/v1/admin/trainers/:id/reassign
 * Reassigns cohorts and students from one trainer to another active trainer.
 * Atomic reassignment across Batch.assignedTrainers and User.batchId.
 */
router.post('/trainers/:id/reassign', async (req, res) => {
  try {
    const { id } = req.params;
    const { replacementTrainerId, batchId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(replacementTrainerId)) {
      return res.status(400).json({ success: false, message: 'Invalid trainer identifier format.' });
    }

    if (id.toString() === replacementTrainerId.toString()) {
      return res.status(400).json({ success: false, message: 'Replacement trainer must be a different educator.' });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const [outgoingTrainer, replacementTrainer] = await Promise.all([
      User.findOne({ _id: id, ...tenantFilter, role: { $in: ['trainer', 'teacher'] } }),
      User.findOne({ _id: replacementTrainerId, ...tenantFilter, role: { $in: ['trainer', 'teacher'] }, soft_deleted: { $ne: true } })
    ]);

    if (!outgoingTrainer) {
      return res.status(404).json({ success: false, message: 'Current trainer not found in this institution.' });
    }
    if (!replacementTrainer) {
      return res.status(404).json({ success: false, message: 'Replacement trainer not found or is currently inactive.' });
    }

    // Determine target batches to reassign
    let targetBatches = [];
    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batch identifier.' });
      }
      const singleBatch = await Batch.findOne({ _id: batchId, tenantId: outgoingTrainer.tenantId });
      if (!singleBatch) {
        return res.status(404).json({ success: false, message: 'Specified batch not found in this institution.' });
      }
      targetBatches = [singleBatch];
    } else {
      targetBatches = await Batch.find({
        tenantId: outgoingTrainer.tenantId,
        $or: [
          ...(outgoingTrainer.batchId ? [{ _id: outgoingTrainer.batchId }] : []),
          { assignedTrainers: outgoingTrainer._id }
        ]
      });
    }

    if (targetBatches.length === 0) {
      return res.status(400).json({ success: false, message: 'No assigned cohorts found for this trainer to reassign.' });
    }

    const batchIds = targetBatches.map((b) => b._id);

    // Reassign batches sequentially to avoid ConflictingUpdateOperators on assignedTrainers
    for (const bId of batchIds) {
      await Batch.findByIdAndUpdate(bId, {
        $pull: { assignedTrainers: outgoingTrainer._id }
      });
      await Batch.findByIdAndUpdate(bId, {
        $addToSet: { assignedTrainers: replacementTrainer._id }
      });
    }

    // Update replacement trainer's primary batchId to the first reassigned batch
    replacementTrainer.batchId = batchIds[0];
    await replacementTrainer.save();

    // Clear outgoing trainer's batchId if reassigned all batches
    if (!batchId || (outgoingTrainer.batchId && outgoingTrainer.batchId.toString() === batchId.toString())) {
      outgoingTrainer.batchId = null;
      await outgoingTrainer.save();
    }

    // Count affected students
    const affectedStudents = await User.countDocuments({
      tenantId: outgoingTrainer.tenantId,
      role: 'student',
      batchId: { $in: batchIds },
      soft_deleted: { $ne: true }
    });

    await createCriticalAuditLog({
      tenantId: outgoingTrainer.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_TRAINER_REASSIGNED',
      targetRecord: outgoingTrainer._id,
      targetModel: 'User',
      details: {
        fromTrainerId: outgoingTrainer._id,
        toTrainerId: replacementTrainer._id,
        reassignedBatches: batchIds,
        affectedStudentsCount: affectedStudents
      }
    });

    res.json({
      success: true,
      message: `Successfully reassigned ${targetBatches.length} cohort(s) and ${affectedStudents} student(s) to ${replacementTrainer.name}.`,
      affectedStudents,
      reallocatedBatches: batchIds
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to reassign trainer cohorts.');
  }
});

router.post('/students/:studentId/reset-password', async (req, res) => {
  const { studentId } = req.params;
  try {
    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = studentId.trim();
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Support lookup by either MongoDB _id or school studentId without Mongoose CastError
    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const query = {
      ...idFilter,
      role: 'student',
      soft_deleted: { $ne: true }
    };

    // Tenant isolation: non-superadmin callers are strictly bounded by tenantId
    if (!isSuperAdmin) {
      if (!req.tenantId) {
        return res.status(403).json({ success: false, message: 'Tenant identifier required for institution admin.' });
      }
      query.tenantId = req.tenantId;
    }

    const student = await User.findOne(query);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found in this institution.' });
    }

    const temporaryPassword = generateSecureTemporaryPassword(12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const prevPassword = student.password;
    const prevMustChange = student.mustChangePassword;

    student.password = hashedPassword;
    student.mustChangePassword = true;
    await student.save();

    // Revoke all existing sessions for the student upon password reset
    await revokeAllUserSessions(student._id, 'admin_password_reset');

    try {
      await createCriticalAuditLog({
        tenantId: req.tenantId || student.tenantId,
        actor: actorFromRequest(req),
        action: 'STUDENT_PASSWORD_RESET',
        targetRecord: student._id,
        targetModel: 'User',
        details: { studentId: student.studentId, email: student.email }
      });
    } catch (auditErr) {
      console.error('[AdminRoutes] Audit log failed for student password reset:', auditErr.message);
      try {
        student.password = prevPassword;
        student.mustChangePassword = prevMustChange;
        await student.save();
      } catch (rollbackErr) {
        console.error(`[CRITICAL UNRESOLVED STATE] Student reset audit failed (${auditErr.message}) and rollback failed (${rollbackErr.message}) for student ${student._id}`);
      }
      return res.status(500).json({ success: false, message: 'Security audit logging failed. Password reset aborted.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Temporary password generated successfully.',
      temporaryPassword
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ success: false, message: `Invalid student identifier format: ${err.value}` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/admin/students
 * Real persisted student roster scoped to institution (or cross-tenant if superadmin).
 * Dynamically distinguishes School Mode vs College Mode records.
 */
router.get('/students', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database connection is temporarily unavailable. Student records cannot be retrieved.'
      });
    }

    const tenantFilter = getAdminTenantFilter(req);
    const targetTenantId = tenantFilter.tenantId || (req.user.role === 'admin' ? req.tenantId : req.query.tenantId);

    let isSchool = false;
    let collegeDoc = null;
    if (targetTenantId && mongoose.Types.ObjectId.isValid(targetTenantId)) {
      collegeDoc = await College.findById(targetTenantId).select('name institutionType settings').lean();
      if (collegeDoc?.institutionType === 'school') {
        isSchool = true;
      }
    }

    const students = await User.find({
      ...tenantFilter,
      role: 'student',
      soft_deleted: { $ne: true }
    })
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('batchId', 'name code department semester')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = students.map((s) => {
      const base = {
        _id: s._id,
        id: s.studentId || s._id.toString(),
        studentId: s.studentId || `STU-${s._id.toString().slice(-4)}`,
        name: s.name,
        email: s.email,
        phone: s.phone || '',
        address: s.address || '',
        avatar: s.avatar || '',
        role: 'student',
        status: s.status || s.accountStatus || 'Active',
        accountStatus: s.accountStatus || s.status || 'Active',
        tenantId: s.tenantId,
        enrolledCourses: s.enrolledCourses || [],
        joinedDate: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '',
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };

      const studentIsSchool = isSchool || Boolean(s.standard || s.schoolProfile?.standard || s.group || s.rollNumber);

      if (studentIsSchool) {
        const std = s.standard || s.schoolProfile?.standard || (s.className && s.className.includes('11') ? 'Class 11' : (s.className && s.className.includes('12') ? 'Class 12' : s.className)) || '';
        const grp = s.group || s.schoolProfile?.group || '';
        const sec = s.section || s.schoolProfile?.section || '';
        const rNo = s.rollNumber || s.schoolProfile?.rollNumber || '';
        const med = s.medium || s.schoolProfile?.medium || 'English';
        const pName = s.parentName || s.schoolProfile?.parentName || s.emergencyContact?.name || '';
        const pPhone = s.parentPhone || s.schoolProfile?.parentPhone || s.emergencyContact?.phone || '';
        const dobVal = s.dob || s.schoolProfile?.dob || '';
        const genderVal = s.gender || s.schoolProfile?.gender || '';

        return {
          ...base,
          standard: std,
          group: grp,
          section: sec,
          rollNumber: rNo,
          medium: med,
          parentName: pName,
          parentPhone: pPhone,
          dob: dobVal,
          gender: genderVal,
          schoolProfile: {
            academicYear: s.schoolProfile?.academicYear || collegeDoc?.settings?.academicConfig?.academicSession || '',
            standard: std,
            group: grp,
            section: sec,
            rollNumber: rNo,
            medium: med,
            parentName: pName,
            parentPhone: pPhone,
            gender: genderVal,
            dob: dobVal
          },
          className: std ? (sec ? `${std}-${sec}` : std) : (s.className || ''),
          emergencyContact: {
            name: pName,
            phone: pPhone,
            relationship: 'Parent / Guardian'
          },
          major: undefined,
          department: undefined,
          year: std,
          university: undefined,
          stats: {
            attendanceRate: s.attendanceRate ?? null,
            assignmentCompletionRate: s.assignmentCompletionRate ?? null,
            gpa: null
          }
        };
      } else {
        return {
          ...base,
          className: s.className || s.batchId?.name || '',
          batchName: s.batchId?.name || s.className || '',
          batchId: s.batchId?._id || s.batchId,
          department: s.department || s.batchId?.department || 'General Academic',
          major: s.major || s.department || s.batchId?.department || 'General Academic',
          year: s.year || s.className || s.batchId?.name || 'Year 1',
          university: s.university || '',
          emergencyContact: s.emergencyContact || {},
          stats: {
            gpa: s.stats?.gpa || s.gpa || null,
            termGpa: s.stats?.termGpa || null,
            completedCredits: s.stats?.completedCredits ?? 0,
            totalCredits: s.stats?.totalCredits ?? 0,
            totalStudyHours: s.stats?.totalStudyHours ?? 0,
            assignmentCompletionRate: s.stats?.assignmentCompletionRate ?? null
          }
        };
      }
    });

    let class11Count = 0;
    let class12Count = 0;
    let gpaSum = 0;
    let gpaCount = 0;

    formatted.forEach((st) => {
      const stdStr = String(st.standard || st.schoolProfile?.standard || st.className || '');
      if (stdStr.includes('11')) {
        class11Count++;
      } else if (stdStr.includes('12')) {
        class12Count++;
      }

      if (st.stats?.gpa && typeof st.stats.gpa === 'number') {
        gpaSum += st.stats.gpa;
        gpaCount++;
      }
    });

    const averageGpa = isSchool ? null : (gpaCount > 0 ? Number((gpaSum / gpaCount).toFixed(2)) : null);

    res.json({
      success: true,
      count: formatted.length,
      institutionType: isSchool ? 'school' : 'college',
      students: formatted,
      data: formatted,
      meta: {
        totalStudents: formatted.length,
        class11Count,
        class12Count,
        averageGpa
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/students/:id
 * Retrieve single student dossier with attendance records & submissions.
 */
router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.user.role === 'superadmin';
    const filter = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: id }, { studentId: id }], role: 'student' }
      : { studentId: id, role: 'student' };

    if (!isSuperAdmin) {
      filter.tenantId = req.tenantId;
    }

    const student = await User.findOne(filter)
      .select('-password -twoFactorSecret -twoFactorBackupCodes')
      .populate('batchId', 'name code department semester')
      .lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const [attendanceRecords, submissions] = await Promise.all([
      Attendance.find({ userId: student._id }).sort({ date: -1 }).limit(30).lean(),
      Submission.find({ studentId: student._id }).populate('assignmentId', 'title totalPoints dueDate').sort({ createdAt: -1 }).limit(10).lean()
    ]);

    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(a => a.status === 'present').length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    const dossier = {
      ...student,
      id: student.studentId || student._id.toString(),
      calculatedAttendanceRate: attendancePercentage,
      attendanceRecords,
      recentSubmissions: submissions
    };

    res.json({
      success: true,
      student: dossier,
      data: dossier
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * POST /api/v1/admin/students
 * Provision a new student account in the tenant.
 * Fully supports School Mode profiles without fake college defaults.
 */
router.post('/students', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      studentId,
      className,
      batchId,
      phone,
      address,
      standard,
      group,
      section,
      rollNumber,
      medium,
      parentName,
      parentPhone,
      dob,
      gender,
      academicYear,
      major,
      department,
      year,
      gpa
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Student name is required.' });
    if (!email || !email.trim()) return res.status(400).json({ success: false, message: 'Student email is required.' });

    const targetTenantId = (req.user.role === 'superadmin' && (req.body.tenantId || req.body.collegeId))
      ? (req.body.tenantId || req.body.collegeId)
      : req.tenantId;
    if (!targetTenantId) {
      return res.status(400).json({ success: false, message: 'Target institution (tenantId or collegeId) is required.' });
    }

    const college = await College.findById(targetTenantId).lean();
    const isSchool = college?.institutionType === 'school' || Boolean(standard || group || rollNumber);

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Global email duplicate pre-check (enforces global email_1 index across all tenants)
    const existingEmailUser = await User.findOne({ email: normalizedEmail }).select('_id tenantId soft_deleted role');
    if (existingEmailUser) {
      if (existingEmailUser.soft_deleted && String(existingEmailUser.tenantId) === String(targetTenantId)) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_EMAIL',
          message: 'A deactivated student account with this email exists in this institution. You can restore this student.',
          canRestore: true,
          studentId: existingEmailUser._id
        });
      }

      const isSameTenant = String(existingEmailUser.tenantId) === String(targetTenantId);
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_EMAIL',
        message: isSameTenant
          ? 'A student with this email already exists in this institution.'
          : 'An account with this email address already exists in the system.'
      });
    }

    // 2. Student identifier resolution (explicit vs collision-resistant auto-allocation)
    const isExplicitStudentId = Boolean(studentId && studentId.trim());
    let resolvedStudentId = isExplicitStudentId ? studentId.trim() : null;

    if (isExplicitStudentId) {
      const existingIdUser = await User.findOne({ studentId: resolvedStudentId }).select('_id');
      if (existingIdUser) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_STUDENT_ID',
          message: `The student identifier "${resolvedStudentId}" is already assigned to another account.`
        });
      }
    } else {
      resolvedStudentId = await allocateUniqueStudentId({ maxAttempts: 10 });
      if (!resolvedStudentId) {
        return res.status(503).json({
          success: false,
          code: 'STUDENT_ID_ALLOCATION_FAILED',
          message: 'Unable to allocate a unique student identifier at this time. Please retry.'
        });
      }
    }

    if (password) {
      const passwordValidation = await validatePasswordAgainstEffectivePolicy(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({
          success: false,
          code: 'PASSWORD_POLICY_VIOLATION',
          message: passwordValidation.message
        });
      }
    }

    const tempPassword = password || generateSecureTemporaryPassword(12);
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    let studentData = {
      tenantId: targetTenantId,
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      status: 'Active',
      accountStatus: 'Active',
      phone: phone || undefined,
      address: address || undefined,
      mustChangePassword: true,
      streakDays: 0,
      xp: 0,
      level: 'Learner'
    };

    if (isSchool) {
      const resolvedStandard = standard || className || 'Class 11';
      const resolvedSection = section ? section.trim().toUpperCase() : 'A';
      const resolvedGroup = group ? group.trim() : '';
      const resolvedMedium = medium ? medium.trim() : 'English';
      const resolvedSession = academicYear || college?.settings?.academicConfig?.academicSession || '2026-2027';

      studentData = {
        ...studentData,
        standard: resolvedStandard,
        group: resolvedGroup,
        section: resolvedSection,
        rollNumber: rollNumber ? rollNumber.trim() : '',
        medium: resolvedMedium,
        parentName: parentName ? parentName.trim() : '',
        parentPhone: parentPhone ? parentPhone.trim() : '',
        dob: dob || '',
        gender: gender || '',
        className: `${resolvedStandard}-${resolvedSection}`,
        schoolProfile: {
          academicYear: resolvedSession,
          standard: resolvedStandard,
          group: resolvedGroup,
          section: resolvedSection,
          rollNumber: rollNumber ? rollNumber.trim() : '',
          medium: resolvedMedium,
          parentName: parentName ? parentName.trim() : '',
          parentPhone: parentPhone ? parentPhone.trim() : '',
          gender: gender || '',
          dob: dob || ''
        },
        emergencyContact: {
          name: parentName ? parentName.trim() : undefined,
          phone: parentPhone ? parentPhone.trim() : undefined,
          relationship: 'Parent / Guardian'
        }
      };
    } else {
      studentData = {
        ...studentData,
        className: className || undefined,
        batchId: batchId || undefined,
        major: major || 'General Academic',
        department: department || 'General Education',
        year: year || 'Year 1',
        stats: {
          gpa: gpa || null,
          termGpa: gpa || null,
          completedCredits: 0,
          totalCredits: 0,
          totalStudyHours: 0,
          assignmentCompletionRate: null
        }
      };
    }

    // 3. Bounded insert retry loop with MongoDB E11000 duplicate key handling
    let newStudent;
    let insertAttempts = 0;
    const maxInsertAttempts = isExplicitStudentId ? 1 : 3;

    while (!newStudent && insertAttempts < maxInsertAttempts) {
      insertAttempts++;
      try {
        newStudent = await User.create({
          ...studentData,
          studentId: resolvedStudentId
        });
      } catch (insertErr) {
        const isDuplicateKey = insertErr.code === 11000 || (insertErr.name === 'MongoServerError' && insertErr.code === 11000);
        if (!isDuplicateKey) {
          throw insertErr;
        }

        const isEmailConflict = insertErr.keyPattern?.email || insertErr.message?.includes('email_1');
        const isStudentIdConflict = insertErr.keyPattern?.studentId || insertErr.message?.includes('studentId_1');

        if (isEmailConflict) {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_EMAIL',
            message: 'An account with this email address already exists.'
          });
        }

        if (isStudentIdConflict) {
          if (isExplicitStudentId) {
            return res.status(409).json({
              success: false,
              code: 'DUPLICATE_STUDENT_ID',
              message: `The student identifier "${resolvedStudentId}" is already assigned to another account.`
            });
          }

          if (insertAttempts < maxInsertAttempts) {
            resolvedStudentId = await allocateUniqueStudentId({ maxAttempts: 10 });
            if (!resolvedStudentId) {
              return res.status(503).json({
                success: false,
                code: 'STUDENT_ID_ALLOCATION_FAILED',
                message: 'Unable to allocate a unique student identifier at this time. Please retry.'
              });
            }
            continue;
          } else {
            return res.status(503).json({
              success: false,
              code: 'STUDENT_ID_ALLOCATION_FAILED',
              message: 'Unable to allocate a unique student identifier at this time. Please retry.'
            });
          }
        }

        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_RESOURCE',
          message: 'A unique constraint violation occurred while provisioning the student.'
        });
      }
    }

    createCriticalAuditLog({
      tenantId: targetTenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_STUDENT_PROVISIONED',
      targetRecord: newStudent._id,
      targetModel: 'User',
      details: { email: newStudent.email, studentId: newStudent.studentId, name: newStudent.name, institutionType: isSchool ? 'school' : 'college' }
    });

    const studentJson = newStudent.toObject();
    delete studentJson.password;

    res.status(201).json({
      success: true,
      message: 'Student account provisioned successfully.',
      student: {
        _id: newStudent._id,
        id: newStudent.studentId,
        studentId: newStudent.studentId,
        name: newStudent.name,
        email: newStudent.email,
        role: newStudent.role,
        standard: newStudent.standard,
        group: newStudent.group,
        section: newStudent.section,
        rollNumber: newStudent.rollNumber,
        medium: newStudent.medium,
        parentName: newStudent.parentName,
        parentPhone: newStudent.parentPhone,
        dob: newStudent.dob,
        gender: newStudent.gender,
        schoolProfile: newStudent.schoolProfile,
        mustChangePassword: newStudent.mustChangePassword
      },
      data: studentJson,
      temporaryPassword: password ? undefined : tempPassword,
      isTemporaryPassword: !password
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * PUT /api/v1/admin/students/:id
 * Update student profile (supporting school or college attributes).
 */
router.put('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID format.' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const query = isSuperAdmin
      ? { _id: id, role: 'student' }
      : { _id: id, tenantId: req.tenantId, role: 'student' };

    const student = await User.findOne(query);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found in this institution.' });
    }

    const allowedUpdates = {};

    if (req.body.name !== undefined && typeof req.body.name === 'string' && req.body.name.trim()) {
      allowedUpdates.name = req.body.name.trim();
    }
    if (req.body.phone !== undefined) {
      allowedUpdates.phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    }
    if (req.body.address !== undefined) {
      allowedUpdates.address = typeof req.body.address === 'string' ? req.body.address.trim() : '';
    }
    if (req.body.accountStatus !== undefined) {
      allowedUpdates.accountStatus = typeof req.body.accountStatus === 'string' ? req.body.accountStatus.trim() : 'Active';
    }
    if (req.body.status !== undefined) {
      allowedUpdates.status = typeof req.body.status === 'string' ? req.body.status.trim() : 'Active';
    }

    // School profile fields
    if (req.body.standard !== undefined) {
      allowedUpdates.standard = typeof req.body.standard === 'string' ? req.body.standard.trim() : '';
      allowedUpdates['schoolProfile.standard'] = allowedUpdates.standard;
    }
    if (req.body.group !== undefined) {
      allowedUpdates.group = typeof req.body.group === 'string' ? req.body.group.trim() : '';
      allowedUpdates['schoolProfile.group'] = allowedUpdates.group;
    }
    if (req.body.section !== undefined) {
      allowedUpdates.section = typeof req.body.section === 'string' ? req.body.section.trim().toUpperCase() : '';
      allowedUpdates['schoolProfile.section'] = allowedUpdates.section;
    }
    if (req.body.rollNumber !== undefined) {
      allowedUpdates.rollNumber = typeof req.body.rollNumber === 'string' ? req.body.rollNumber.trim() : '';
      allowedUpdates['schoolProfile.rollNumber'] = allowedUpdates.rollNumber;
    }
    if (req.body.medium !== undefined) {
      allowedUpdates.medium = typeof req.body.medium === 'string' ? req.body.medium.trim() : 'English';
      allowedUpdates['schoolProfile.medium'] = allowedUpdates.medium;
    }
    if (req.body.parentName !== undefined) {
      allowedUpdates.parentName = typeof req.body.parentName === 'string' ? req.body.parentName.trim() : '';
      allowedUpdates['schoolProfile.parentName'] = allowedUpdates.parentName;
      allowedUpdates['emergencyContact.name'] = allowedUpdates.parentName;
    }
    if (req.body.parentPhone !== undefined) {
      allowedUpdates.parentPhone = typeof req.body.parentPhone === 'string' ? req.body.parentPhone.trim() : '';
      allowedUpdates['schoolProfile.parentPhone'] = allowedUpdates.parentPhone;
      allowedUpdates['emergencyContact.phone'] = allowedUpdates.parentPhone;
    }
    if (req.body.dob !== undefined) {
      allowedUpdates.dob = typeof req.body.dob === 'string' ? req.body.dob.trim() : '';
      allowedUpdates['schoolProfile.dob'] = allowedUpdates.dob;
    }
    if (req.body.gender !== undefined) {
      allowedUpdates.gender = typeof req.body.gender === 'string' ? req.body.gender.trim() : '';
      allowedUpdates['schoolProfile.gender'] = allowedUpdates.gender;
    }
    if (req.body.academicYear !== undefined) {
      allowedUpdates['schoolProfile.academicYear'] = typeof req.body.academicYear === 'string' ? req.body.academicYear.trim() : '';
    }
    if (req.body.className !== undefined) {
      allowedUpdates.className = typeof req.body.className === 'string' ? req.body.className.trim() : '';
    }

    // College fields
    if (req.body.major !== undefined) allowedUpdates.major = typeof req.body.major === 'string' ? req.body.major.trim() : '';
    if (req.body.department !== undefined) allowedUpdates.department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    if (req.body.year !== undefined) allowedUpdates.year = typeof req.body.year === 'string' ? req.body.year.trim() : '';

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid editable fields provided in update request.' });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student record updated successfully.',
      student: updated,
      data: updated
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * DELETE /api/v1/admin/students/:id
 * Remove, deactivate, or permanently delete a student account.
 */
router.delete('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = id.trim();
    const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;
    const tenantFilter = getAdminTenantFilter(req);

    // Support lookup by either MongoDB _id or school studentId without Mongoose CastError
    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const target = await User.findOne({ ...idFilter, ...tenantFilter, role: 'student' });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Student not found in this institution.' });
    }

    if (isPermanent) {
      const result = await cascadeDeleteStudent(target, actorFromRequest(req));
      return res.json({
        success: true,
        isTransactional: result.isTransactional,
        message: 'Student account and academic records permanently deleted.',
        journal: result.journal
      });
    } else {
      target.soft_deleted = true;
      target.accountStatus = 'Inactive';
      target.status = 'Inactive';
      await target.save();

      await revokeAllUserSessions(target._id.toString(), 'admin_revocation');

      createCriticalAuditLog({
        tenantId: target.tenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENT_DEACTIVATED',
        targetRecord: target._id,
        targetModel: 'User',
        details: { email: target.email, studentId: target.studentId, name: target.name }
      });

      return res.json({ success: true, message: 'Student account deactivated.' });
    }
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to delete student.');
  }
});

/**
 * POST /api/v1/admin/students/:id/restore
 * Restore a soft-deleted / deactivated student account back to active status.
 */
router.post('/students/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || typeof id !== 'string' || !id.trim()) {
      return res.status(400).json({ success: false, message: 'Valid student identifier is required.' });
    }
    const cleanId = id.trim();
    const tenantFilter = getAdminTenantFilter(req);

    const idFilter = mongoose.Types.ObjectId.isValid(cleanId)
      ? { $or: [{ _id: cleanId }, { studentId: cleanId }] }
      : { studentId: cleanId };

    const target = await User.findOne({ ...idFilter, ...tenantFilter, role: 'student' });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Student not found in this institution.' });
    }

    if (!target.soft_deleted && target.status === 'Active' && target.accountStatus === 'Active') {
      return res.status(400).json({ success: false, message: 'Student account is already active.' });
    }

    // Check for collision with another active user
    const conflicting = await User.findOne({
      _id: { $ne: target._id },
      $or: [{ email: target.email }, { studentId: target.studentId }],
      soft_deleted: { $ne: true }
    });

    if (conflicting) {
      return res.status(409).json({
        success: false,
        code: 'RESTORATION_CONFLICT',
        message: `Cannot restore: an active account already uses this student's email (${target.email}) or identifier (${target.studentId}).`
      });
    }

    target.soft_deleted = false;
    target.accountStatus = 'Active';
    target.status = 'Active';
    await target.save();

    createCriticalAuditLog({
      tenantId: target.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_STUDENT_RESTORED',
      targetRecord: target._id,
      targetModel: 'User',
      details: { email: target.email, studentId: target.studentId, name: target.name }
    });

    const safeStudent = target.toObject();
    delete safeStudent.password;
    delete safeStudent.twoFactorSecret;
    delete safeStudent.twoFactorBackupCodes;

    return res.json({ success: true, message: 'Student account restored to active status.', student: safeStudent });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to restore student.');
  }
});

/**
 * POST /api/v1/admin/students/bulk-delete
 * Bulk deactivate or permanently delete multiple students.
 */
router.post('/students/bulk-delete', async (req, res) => {
  try {
    const { studentIds, permanent } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'studentIds must be a non-empty array.' });
    }

    const isPermanent = permanent === true || req.query.permanent === 'true';
    const tenantFilter = getAdminTenantFilter(req);
    const students = await User.find({ _id: { $in: studentIds }, ...tenantFilter, role: 'student' });

    if (students.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching students found in your institution.' });
    }

    const targetIds = students.map(s => s._id);

    if (isPermanent) {
      for (const s of students) {
        await revokeAllUserSessions(s._id.toString(), 'bulk_permanently_deleted');
      }

      const allStudentIdentifiers = students.flatMap(s => [s._id.toString(), s.studentId]).filter(Boolean);

      await Promise.all([
        Attendance.deleteMany({ studentId: { $in: targetIds } }),
        Submission.deleteMany({ studentId: { $in: targetIds } }),
        AssessmentAttempt.deleteMany({ studentId: { $in: targetIds } }),
        StudentProgress.deleteMany({ studentId: { $in: targetIds } }),
        Doubt.deleteMany({ studentId: { $in: targetIds } }),
        Grade.deleteMany({ studentId: { $in: allStudentIdentifiers } }),
        Note.deleteMany({ owner: { $in: targetIds } }),
        TeacherNote.deleteMany({ studentId: { $in: allStudentIdentifiers } }),
        RetakeAuthorization.deleteMany({ studentId: { $in: targetIds } }),
        AssessmentEvent.deleteMany({ studentId: { $in: targetIds } }),
        Session.deleteMany({ userId: { $in: targetIds } }),
        Passkey.deleteMany({ userId: { $in: targetIds } }),
        EmailOtp.deleteMany({ userId: { $in: targetIds } }),
        User.deleteMany({ _id: { $in: targetIds } })
      ]);

      createCriticalAuditLog({
        tenantId: req.tenantId || students[0]?.tenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENTS_BULK_PERMANENTLY_DELETED',
        details: { count: targetIds.length, studentIds: targetIds }
      });

      return res.json({
        success: true,
        message: `Successfully permanently deleted ${targetIds.length} student record(s).`,
        count: targetIds.length
      });
    } else {
      await User.updateMany(
        { _id: { $in: targetIds } },
        { $set: { soft_deleted: true, accountStatus: 'Inactive', status: 'Inactive' } }
      );

      for (const s of students) {
        await revokeAllUserSessions(s._id.toString(), 'bulk_deactivated');
      }

      createCriticalAuditLog({
        tenantId: req.tenantId || students[0]?.tenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_STUDENTS_BULK_DEACTIVATED',
        details: { count: targetIds.length, studentIds: targetIds }
      });

      return res.json({
        success: true,
        message: `Successfully deactivated ${targetIds.length} student account(s).`,
        count: targetIds.length
      });
    }
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to perform bulk student deletion.');
  }
});

router.get('/institutions', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const filter = isSuperAdmin ? {} : { _id: req.tenantId };
    const colleges = await College.find(filter).sort({ name: 1 }).lean();

    // Enrich with real persisted records per institution
    const enriched = await Promise.all((colleges || []).map(async (c) => {
      const [studentsCount, trainersCount, batchesCount, coursesCount] = await Promise.all([
        User.countDocuments({ tenantId: c._id, role: 'student', soft_deleted: { $ne: true } }),
        User.countDocuments({ tenantId: c._id, role: 'trainer', soft_deleted: { $ne: true } }),
        Batch.countDocuments({ tenantId: c._id }),
        Course.countDocuments({ tenantId: c._id })
      ]);
      return {
        ...c,
        studentCount: studentsCount,
        studentsCount,
        trainerCount: trainersCount,
        trainersCount,
        batchCount: batchesCount,
        batchesCount,
        courseCount: coursesCount,
        coursesCount
      };
    }));

    res.json({
      success: true,
      count: enriched.length,
      institutions: enriched
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.post('/institutions', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only 6th Civilians Corporation Company Super-Administrators can register new institutions.'
      });
    }

    const { name, code, slug, institutionType, status, contactEmail, contactPhone, address } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Institution name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'Institution code is required.' });
    }

    const finalSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
    const finalCode = code.trim().toUpperCase();

    // Check unique constraints
    const existing = await College.findOne({
      $or: [{ name: name.trim() }, { code: finalCode }, { slug: finalSlug }]
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An institution with this name, code, or slug already exists.'
      });
    }

    const newInst = await College.create({
      name: name.trim(),
      code: finalCode,
      slug: finalSlug,
      institutionType: ['school', 'college', 'unconfigured'].includes(institutionType) ? institutionType : 'unconfigured',
      status: status || 'active',
      settings: {
        contact: {
          email: contactEmail || undefined,
          phone: contactPhone || undefined,
          address: address || undefined
        }
      }
    });

    createCriticalAuditLog({
      tenantId: newInst._id,
      actor: actorFromRequest(req),
      action: 'COMPANY_ADMIN_INSTITUTION_REGISTERED',
      details: { institutionId: newInst._id, name: newInst.name, code: newInst.code, type: newInst.institutionType }
    });

    res.status(201).json({
      success: true,
      message: 'Institution registered successfully.',
      institution: newInst
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/institutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid institution ID format.' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    if (!isSuperAdmin && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized institution scope.' });
    }

    const inst = await College.findById(id).lean();
    if (!inst) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    const [batches, trainers, studentsCount, courses] = await Promise.all([
      Batch.find({ tenantId: id }).lean(),
      User.find({ tenantId: id, role: 'trainer', soft_deleted: { $ne: true } }).select('name email department').lean(),
      User.countDocuments({ tenantId: id, role: 'student', soft_deleted: { $ne: true } }),
      Course.find({ tenantId: id }).lean()
    ]);

    res.json({
      success: true,
      institution: {
        ...inst,
        batches,
        trainers,
        studentsCount,
        courses
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/institution-profile', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    let targetTenantId = req.tenantId;

    if (isSuperAdmin && req.query.tenantId && mongoose.Types.ObjectId.isValid(req.query.tenantId)) {
      targetTenantId = req.query.tenantId;
    }

    if (!targetTenantId) {
      return res.json({
        success: true,
        isSuperAdmin,
        institution: null,
        message: isSuperAdmin ? 'Global Super-Admin context (no specific tenant selected).' : 'No tenant assigned.'
      });
    }

    const institution = await College.findById(targetTenantId).lean();
    if (!institution) {
      return res.status(404).json({ success: false, message: 'Institution profile not found.' });
    }

    res.json({
      success: true,
      isSuperAdmin,
      institution
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.put('/institutions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid institution ID format.' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const isTenantAdmin = req.user.role === 'admin' && req.tenantId?.toString() === id;

    if (!isSuperAdmin && !isTenantAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized institution scope.' });
    }

    const { name, status, contactEmail, contactPhone, address, institutionType, settings } = req.body;

    // Tenant admins CANNOT modify institutionType or academicConfig
    if (!isSuperAdmin && (institutionType !== undefined || settings?.academicConfig !== undefined)) {
      return res.status(403).json({
        success: false,
        code: 'TENANT_MODE_SUPERADMIN_ONLY',
        message: 'Institution operating mode and academic structure are bound to the organization license and can only be modified by Super-Administrators.'
      });
    }

    const update = {};
    if (name && isSuperAdmin) update.name = name.trim();
    if (status && isSuperAdmin && ['active', 'inactive', 'suspended'].includes(status)) update.status = status;
    if (institutionType && isSuperAdmin) {
      if (['school', 'college', 'unconfigured'].includes(institutionType)) {
        update.institutionType = institutionType;
      }
    }

    if (contactEmail !== undefined) update['settings.contact.email'] = contactEmail;
    if (contactPhone !== undefined) update['settings.contact.phone'] = contactPhone;
    if (address !== undefined) update['settings.contact.address'] = address;

    if (settings?.branding) {
      if (settings.branding.logoUrl !== undefined) update['settings.branding.logoUrl'] = settings.branding.logoUrl;
      if (settings.branding.primaryColor !== undefined) update['settings.branding.primaryColor'] = settings.branding.primaryColor;
      if (settings.branding.theme !== undefined) update['settings.branding.theme'] = settings.branding.theme;
    }

    if (isSuperAdmin && settings?.academicConfig) {
      if (settings.academicConfig.academicSession !== undefined) {
        update['settings.academicConfig.academicSession'] = settings.academicConfig.academicSession;
      }
      if (settings.academicConfig.minimumAttendance !== undefined) {
        update['settings.academicConfig.minimumAttendance'] = settings.academicConfig.minimumAttendance;
      }
      if (settings.academicConfig.evaluationSlaHours !== undefined) {
        update['settings.academicConfig.evaluationSlaHours'] = settings.academicConfig.evaluationSlaHours;
      }
      if (settings.academicConfig.gradingScale !== undefined && Array.isArray(settings.academicConfig.gradingScale)) {
        update['settings.academicConfig.gradingScale'] = settings.academicConfig.gradingScale;
      }
    }

    const updated = await College.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Institution not found.' });
    }

    createCriticalAuditLog({
      tenantId: updated._id,
      actor: actorFromRequest(req),
      action: 'COMPANY_ADMIN_INSTITUTION_UPDATED',
      details: { institutionId: updated._id, updatedFields: Object.keys(update) }
    });

    res.json({ success: true, message: 'Institution updated successfully.', institution: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 6TH CIVILIANS CORPORATION — MULTI-SCHOOL PLATFORM MANAGEMENT
// =========================================================================

/**
 * GET /api/v1/admin/schools
 * Lists all participating schools with student counts by class (Class 11, Class 12),
 * trainer assignments, and training cohorts.
 * By default, excludes archived schools unless requested via ?status=all or ?status=archived.
 */
router.get('/schools', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';
    const filter = isSuperAdmin
      ? { institutionType: 'school' }
      : { _id: req.tenantId, institutionType: 'school' };

    // Exclude archived schools by default
    if (req.query.status === 'archived') {
      filter.status = 'archived';
    } else if (req.query.status !== 'all') {
      filter.status = { $ne: 'archived' };
    }

    const schools = await College.find(filter).sort({ name: 1 }).lean();

    const enriched = await Promise.all(schools.map(async (school) => {
      const sId = school._id;
      const [students, trainers, batches] = await Promise.all([
        User.find({ tenantId: sId, role: 'student', soft_deleted: { $ne: true } })
          .select('className standard group section rollNumber batchId name email studentId streakDays stats schoolProfile')
          .lean(),
        User.find({ tenantId: sId, role: 'trainer', soft_deleted: { $ne: true } })
          .select('name email department')
          .lean(),
        Batch.find({ tenantId: sId }).sort({ createdAt: -1 }).lean()
      ]);

      const batchMap = new Map();
      batches.forEach(b => batchMap.set(b._id.toString(), b.name));

      let class11Count = 0;
      let class12Count = 0;
      let otherClassCount = 0;

      students.forEach(st => {
        const std = (st.standard || st.schoolProfile?.standard || st.className || '').toLowerCase();
        const bName = (st.batchId ? batchMap.get(st.batchId.toString()) : '')?.toLowerCase() || '';

        if (std.includes('11') || bName.includes('11')) {
          class11Count++;
        } else if (std.includes('12') || bName.includes('12')) {
          class12Count++;
        } else if (std || bName) {
          otherClassCount++;
        }
      });

      const activeCohorts = batches.filter(b => b.status === 'active' || !b.status);
      const completedCohorts = batches.filter(b => b.status === 'completed');
      const upcomingCohorts = batches.filter(b => b.status === 'upcoming');

      return {
        ...school,
        id: sId.toString(),
        totalStudents: students.length,
        studentsCount: students.length,
        class11Count,
        class12Count,
        otherClassCount,
        trainersCount: trainers.length,
        batchesCount: batches.length,
        activeCohortsCount: activeCohorts.length,
        completedCohortsCount: completedCohorts.length,
        upcomingCohortsCount: upcomingCohorts.length,
        trainers,
        academicConfig: school.settings?.academicConfig || {
          academicSession: '2026-2027',
          classesOffered: ['Class 11', 'Class 12'],
          sections: ['A', 'B', 'C'],
          mediums: ['English'],
          trainingSubjects: ['Python Programming', 'Aptitude & Logical Reasoning', 'Soft Skills']
        },
        cohorts: batches.map(b => ({
          _id: b._id,
          id: b._id.toString(),
          name: b.name,
          targetClass: b.targetClass || (b.name.includes('12') ? 'Class 12' : 'Class 11'),
          startDate: b.startDate,
          endDate: b.endDate,
          sessionStartTime: b.sessionStartTime || '11:00 AM',
          sessionEndTime: b.sessionEndTime || '12:00 PM',
          scheduleDays: b.scheduleDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          assignedTrainers: b.assignedTrainers || [],
          status: b.status || 'upcoming',
          isCompleted: b.isCompleted || false
        }))
      };
    }));

    res.json({
      success: true,
      count: enriched.length,
      schools: enriched,
      data: enriched
    });
  } catch (err) {
    console.error('Error fetching participating schools:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/schools
 * Registers a new participating school institution.
 * Restricted strictly to 6th Civilians Corporation Platform Admin.
 * Always sets institutionType: 'school' and initializes default academicConfig.
 */
router.post('/schools', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only 6th Civilians Corporation Platform Super-Administrators can register new schools.'
      });
    }

    const {
      name,
      code,
      slug,
      status,
      contactEmail,
      contactPhone,
      address,
      academicSession,
      classesOffered,
      groups,
      sections,
      mediums,
      trainingSubjects
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'School name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: 'School code is required.' });
    }

    const finalSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-')).trim();
    const finalCode = code.trim().toUpperCase();

    const existing = await College.findOne({
      $or: [{ name: name.trim() }, { code: finalCode }, { slug: finalSlug }]
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A school or institution with this name, code, or slug already exists.'
      });
    }

    const defaultGroups = [
      { id: 'grp-mpc', code: 'MPC', name: 'Group I (MPC)', stream: 'Science', subjects: ['Mathematics', 'Physics', 'Chemistry'], description: 'Maths, Physics, Chemistry' },
      { id: 'grp-bpc', code: 'BPC', name: 'Group II (BPC)', stream: 'Science', subjects: ['Biology', 'Physics', 'Chemistry'], description: 'Biology, Physics, Chemistry' },
      { id: 'grp-pure-science', code: 'PURE_SCI', name: 'Group III (Pure Science)', stream: 'Science', subjects: ['Physics', 'Chemistry', 'Biology', 'Mathematics'], description: 'Pure Science' },
      { id: 'grp-commerce', code: 'COMM', name: 'Group IV (Commerce)', stream: 'Commerce', subjects: ['Commerce', 'Accountancy', 'Economics', 'Computer Applications'], description: 'Commerce & Accountancy' }
    ];

    const newSchool = await College.create({
      name: name.trim(),
      code: finalCode,
      slug: finalSlug,
      institutionType: 'school',
      status: status || 'active',
      settings: {
        contact: {
          email: contactEmail || undefined,
          phone: contactPhone || undefined,
          address: address || undefined
        },
        academicConfig: {
          academicSession: academicSession?.trim() || '2026-2027',
          classesOffered: Array.isArray(classesOffered) && classesOffered.length > 0 ? classesOffered : ['Class 11', 'Class 12'],
          groups: Array.isArray(groups) && groups.length > 0 ? groups : defaultGroups,
          sections: Array.isArray(sections) && sections.length > 0 ? sections : ['A', 'B', 'C'],
          mediums: Array.isArray(mediums) && mediums.length > 0 ? mediums : ['English'],
          trainingSubjects: Array.isArray(trainingSubjects) && trainingSubjects.length > 0 ? trainingSubjects : ['Python Programming', 'Aptitude & Logical Reasoning', 'Soft Skills'],
          trainingSchedules: []
        }
      }
    });

    createCriticalAuditLog({
      tenantId: newSchool._id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_SCHOOL_REGISTERED',
      details: { schoolId: newSchool._id, name: newSchool.name, code: newSchool.code }
    });

    res.status(201).json({
      success: true,
      message: 'Participating school registered successfully.',
      school: newSchool,
      data: newSchool
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/schools/comparison
 * Compares all participating schools through aggregate metrics (test scores, attendance, completion).
 * Strictly preserves privacy without mixing or exposing individual student lists across schools.
 */
router.get('/schools/comparison', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cross-school comparison reports are restricted to Platform Administrators.'
      });
    }

    const comparison = await computeAllSchoolsComparison();
    res.json({
      success: true,
      count: comparison.length,
      comparison,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error computing all schools comparison:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/admin/schools/:id
 * Detailed inspection of an authorized school record.
 */
router.get('/schools/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID format.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school inspection scope.' });
    }

    const school = await College.findById(id).lean();
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const [students, trainers, batches, courses, recentAssessments] = await Promise.all([
      User.find({ tenantId: id, role: 'student', soft_deleted: { $ne: true } })
        .select('name studentId email className standard group section rollNumber batchId streakDays stats createdAt schoolProfile')
        .lean(),
      User.find({ tenantId: id, role: 'trainer', soft_deleted: { $ne: true } })
        .select('name email department')
        .lean(),
      Batch.find({ tenantId: id }).sort({ createdAt: -1 }).lean(),
      Course.find({ tenantId: id }).lean(),
      Assessment.find({ tenantId: id }).sort({ date: -1 }).limit(10).lean()
    ]);

    let class11Count = 0;
    let class12Count = 0;
    let otherClassCount = 0;

    students.forEach(st => {
      const cls = (st.standard || st.schoolProfile?.standard || st.className || '').toLowerCase();
      if (cls.includes('11')) class11Count++;
      else if (cls.includes('12')) class12Count++;
      else if (cls) otherClassCount++;
    });

    res.json({
      success: true,
      school: {
        ...school,
        id: school._id.toString(),
        totalStudents: students.length,
        class11Count,
        class12Count,
        otherClassCount,
        academicConfig: school.settings?.academicConfig || {},
        students,
        trainers,
        batches,
        courses,
        recentAssessments
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/schools/:id/academic-config
 * Retrieve academic configuration for a school.
 */
router.get('/schools/:id/academic-config', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school access.' });
    }

    const school = await College.findById(id).select('settings.academicConfig name code').lean();
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const resolvedConfig = school.settings?.academicConfig || {
      academicSession: '2026-2027',
      classesOffered: ['Class 11', 'Class 12'],
      groups: [],
      sections: ['A', 'B', 'C'],
      mediums: ['English'],
      trainingSubjects: []
    };

    res.json({
      success: true,
      schoolName: school.name,
      schoolCode: school.code,
      academicConfig: resolvedConfig,
      data: {
        schoolName: school.name,
        schoolCode: school.code,
        academicConfig: resolvedConfig
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * PUT /api/v1/admin/schools/:id/academic-config
 * Update academic structure settings for a school.
 * Permitted for SuperAdmin and the authorized School Admin for that school.
 */
router.put('/schools/:id/academic-config', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school access.' });
    }

    const school = await College.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const configSource = (req.body.academicConfig && typeof req.body.academicConfig === 'object')
      ? req.body.academicConfig
      : req.body;

    const {
      academicSession,
      classesOffered,
      groups,
      sections,
      mediums,
      trainingSubjects,
      trainingSchedules
    } = configSource;

    if (!school.settings) school.settings = {};
    if (!school.settings.academicConfig) school.settings.academicConfig = {};

    if (academicSession !== undefined && typeof academicSession === 'string') {
      school.settings.academicConfig.academicSession = academicSession.trim();
    }
    if (Array.isArray(classesOffered)) {
      school.settings.academicConfig.classesOffered = classesOffered.map(c => String(c).trim()).filter(Boolean);
    }
    if (Array.isArray(groups)) {
      school.settings.academicConfig.groups = groups.map(g => ({
        id: g.id || `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        code: String(g.code || g.id?.replace(/^grp-/, '').toUpperCase() || '').trim().toUpperCase(),
        name: String(g.name || '').trim(),
        stream: String(g.stream || '').trim(),
        subjects: Array.isArray(g.subjects) ? g.subjects.map(s => String(s).trim()).filter(Boolean) : [],
        description: String(g.description || '').trim()
      }));
    }
    if (Array.isArray(sections)) {
      school.settings.academicConfig.sections = sections.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    }
    if (Array.isArray(mediums)) {
      school.settings.academicConfig.mediums = mediums.map(m => String(m).trim()).filter(Boolean);
    }
    if (Array.isArray(trainingSubjects)) {
      school.settings.academicConfig.trainingSubjects = trainingSubjects.map(s => String(s).trim()).filter(Boolean);
    }
    if (Array.isArray(trainingSchedules)) {
      school.settings.academicConfig.trainingSchedules = trainingSchedules;
    }

    school.markModified('settings.academicConfig');
    await school.save();

    createCriticalAuditLog({
      tenantId: school._id,
      actor: actorFromRequest(req),
      action: 'SCHOOL_ACADEMIC_CONFIG_UPDATED',
      details: {
        schoolId: school._id,
        academicSession: school.settings.academicConfig.academicSession,
        classesCount: school.settings.academicConfig.classesOffered?.length,
        groupsCount: school.settings.academicConfig.groups?.length
      }
    });

    res.json({
      success: true,
      message: 'School academic structure updated successfully.',
      academicConfig: school.settings.academicConfig,
      data: { academicConfig: school.settings.academicConfig }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * POST /api/v1/admin/schools/:id/archive
 * Deactivates and archives a school. Hides it from active operations while preserving all records.
 * Restricted strictly to SuperAdmin.
 */
router.post('/schools/:id/archive', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only Platform Super-Administrators can archive a participating school.'
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    const school = await College.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    school.status = 'archived';
    await school.save();

    // Revoke active sessions for all users of this school
    const schoolUsers = await User.find({ tenantId: school._id }).select('_id');
    for (const u of schoolUsers) {
      await revokeAllUserSessions(u._id.toString(), 'school_archived');
    }

    createCriticalAuditLog({
      tenantId: school._id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_SCHOOL_ARCHIVED',
      targetRecord: school._id,
      targetModel: 'College',
      details: { schoolId: school._id, name: school.name, code: school.code }
    });

    res.json({
      success: true,
      message: `School ${school.name} (${school.code}) has been archived. It is hidden from active operations.`,
      school,
      data: school
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * POST /api/v1/admin/schools/:id/restore
 * Restores an archived school back to active status.
 * Restricted strictly to SuperAdmin.
 */
router.post('/schools/:id/restore', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only Platform Super-Administrators can restore an archived school.'
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    const school = await College.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    school.status = 'active';
    await school.save();

    createCriticalAuditLog({
      tenantId: school._id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_SCHOOL_RESTORED',
      targetRecord: school._id,
      targetModel: 'College',
      details: { schoolId: school._id, name: school.name, code: school.code }
    });

    res.json({
      success: true,
      message: `School ${school.name} (${school.code}) has been restored to active status.`,
      school,
      data: school
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/schools/:id/pre-delete-inspection
 * Inspects all documents and dependencies tied to this school prior to permanent deletion.
 * Restricted strictly to SuperAdmin.
 */
router.get('/schools/:id/pre-delete-inspection', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only Platform Super-Administrators can inspect school deletion dependencies.'
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    const school = await College.findById(id).lean();
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const [
      studentsCount,
      trainersCount,
      adminsCount,
      batchesCount,
      coursesCount,
      assignmentsCount,
      attendanceCount,
      submissionsCount,
      announcementsCount,
      doubtsCount,
      assessmentsCount
    ] = await Promise.all([
      User.countDocuments({ tenantId: id, role: 'student' }),
      User.countDocuments({ tenantId: id, role: 'trainer' }),
      User.countDocuments({ tenantId: id, role: { $in: ['admin'] } }),
      Batch.countDocuments({ tenantId: id }),
      Course.countDocuments({ tenantId: id }),
      Assignment.countDocuments({ tenantId: id }),
      Attendance.countDocuments({ tenantId: id }),
      Submission.countDocuments({ tenantId: id }),
      Announcement.countDocuments({ tenantId: id }),
      Doubt.countDocuments({ tenantId: id }),
      Assessment.countDocuments({ tenantId: id })
    ]);

    const totalRecords = studentsCount + trainersCount + adminsCount + batchesCount + coursesCount +
      assignmentsCount + attendanceCount + submissionsCount + announcementsCount + doubtsCount + assessmentsCount + 1;

    const inspectionSchool = {
      id: school._id.toString(),
      name: school.name,
      code: school.code,
      slug: school.slug,
      status: school.status
    };

    const inspectionCounts = {
      students: studentsCount,
      trainers: trainersCount,
      schoolAdmins: adminsCount,
      cohorts: batchesCount,
      courses: coursesCount,
      assignments: assignmentsCount,
      attendanceRecords: attendanceCount,
      submissions: submissionsCount,
      announcements: announcementsCount,
      doubts: doubtsCount,
      assessments: assessmentsCount,
      totalRecords
    };

    res.json({
      success: true,
      school: inspectionSchool,
      counts: inspectionCounts,
      data: {
        school: inspectionSchool,
        counts: inspectionCounts
      }
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * DELETE /api/v1/admin/schools/:id
 * Permanently deletes a school and all associated records scoped to it.
 * Strictly requires confirmationCode matching school.code.
 * Generates a scoped JSON backup file before deletion.
 * Restricted strictly to SuperAdmin.
 */
router.delete('/schools/:id', async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Only Platform Super-Administrators can permanently delete a school.'
      });
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    const school = await College.findById(id);
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const { confirmationCode } = req.body;
    if (!confirmationCode || confirmationCode.trim().toUpperCase() !== school.code.toUpperCase()) {
      return res.status(400).json({
        success: false,
        code: 'CONFIRMATION_CODE_MISMATCH',
        message: `Deletion rejected. Confirmation code must exactly match the school code '${school.code}'.`
      });
    }

    // Step 1: Scoped Pre-Deletion Backup
    const backupDir = path.resolve('server/scripts/backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const [
      scopedUsers,
      scopedBatches,
      scopedCourses,
      scopedAssignments,
      scopedAttendance,
      scopedSubmissions,
      scopedAnnouncements,
      scopedDoubts,
      scopedAssessments,
      scopedNotes,
      scopedTeacherNotes,
      scopedAcademicEvents,
      scopedRetakes,
      scopedAssessmentEvents,
      scopedStudentProgress,
      scopedGrades
    ] = await Promise.all([
      User.find({ tenantId: id }).lean(),
      Batch.find({ tenantId: id }).lean(),
      Course.find({ tenantId: id }).lean(),
      Assignment.find({ tenantId: id }).lean(),
      Attendance.find({ tenantId: id }).lean(),
      Submission.find({ tenantId: id }).lean(),
      Announcement.find({ tenantId: id }).lean(),
      Doubt.find({ tenantId: id }).lean(),
      Assessment.find({ tenantId: id }).lean(),
      Note.find({ tenantId: id }).lean(),
      TeacherNote.find({ tenantId: id.toString() }).lean(),
      AcademicEvent.find({ tenantId: id }).lean(),
      RetakeAuthorization.find({ tenantId: id }).lean(),
      AssessmentEvent.find({ tenantId: id }).lean(),
      StudentProgress.find({ tenantId: id }).lean(),
      Grade.find({ tenantId: id }).lean()
    ]);

    const backupPayload = {
      timestamp: new Date().toISOString(),
      school: school.toObject(),
      records: {
        users: scopedUsers,
        batches: scopedBatches,
        courses: scopedCourses,
        assignments: scopedAssignments,
        attendance: scopedAttendance,
        submissions: scopedSubmissions,
        announcements: scopedAnnouncements,
        doubts: scopedDoubts,
        assessments: scopedAssessments,
        notes: scopedNotes,
        teacherNotes: scopedTeacherNotes,
        academicEvents: scopedAcademicEvents,
        retakes: scopedRetakes,
        assessmentEvents: scopedAssessmentEvents,
        studentProgress: scopedStudentProgress,
        grades: scopedGrades
      }
    };

    const backupFilePath = path.join(backupDir, `school_purge_${school.code}_${Date.now()}.json`);
    fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), 'utf8');

    // Step 2: Revoke active sessions for all school users
    for (const u of scopedUsers) {
      await revokeAllUserSessions(u._id.toString(), 'school_permanently_deleted');
    }

    // Step 3: Cascade deletion strictly scoped to tenantId
    await Promise.all([
      User.deleteMany({ tenantId: id }),
      Batch.deleteMany({ tenantId: id }),
      Course.deleteMany({ tenantId: id }),
      Assignment.deleteMany({ tenantId: id }),
      Attendance.deleteMany({ tenantId: id }),
      Submission.deleteMany({ tenantId: id }),
      Announcement.deleteMany({ tenantId: id }),
      Doubt.deleteMany({ tenantId: id }),
      Assessment.deleteMany({ tenantId: id }),
      AssessmentAttempt.deleteMany({ tenantId: id }),
      Note.deleteMany({ tenantId: id }),
      TeacherNote.deleteMany({ tenantId: id.toString() }),
      AcademicEvent.deleteMany({ tenantId: id }),
      RetakeAuthorization.deleteMany({ tenantId: id }),
      AssessmentEvent.deleteMany({ tenantId: id }),
      StudentProgress.deleteMany({ tenantId: id }),
      Grade.deleteMany({ tenantId: id }),
      College.deleteOne({ _id: id })
    ]);

    // Step 4: Audit log
    createCriticalAuditLog({
      tenantId: null,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_SCHOOL_PERMANENTLY_DELETED',
      details: {
        schoolId: id,
        name: school.name,
        code: school.code,
        backupPath: backupFilePath,
        recordsDeleted: {
          users: scopedUsers.length,
          batches: scopedBatches.length,
          attendance: scopedAttendance.length,
          assignments: scopedAssignments.length,
          submissions: scopedSubmissions.length
        }
      }
    });

    res.json({
      success: true,
      message: `School ${school.name} (${school.code}) and all associated records have been permanently deleted.`,
      backupPath: backupFilePath,
      data: { backupPath: backupFilePath }
    });
  } catch (err) {
    console.error('Error permanently deleting school:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/schools/:id/cohorts
 * Creates a training cohort for a specific school.
 * Configures training dates, session start/end times (e.g. 11:00 AM - 12:00 PM),
 * targetClass ('Class 11' | 'Class 12'), scheduleDays, and assigned trainers.
 * Includes schedule overlap detection.
 */
router.post('/schools/:id/cohorts', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const {
      name,
      targetClass = 'Class 11',
      startDate,
      endDate,
      sessionStartTime = '11:00 AM',
      sessionEndTime = '12:00 PM',
      scheduleDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      assignedTrainers = [],
      status = 'active',
      liveSessionNotes = ''
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Cohort name is required.' });
    }

    // Overlapping schedule verification
    const existingBatches = await Batch.find({
      tenantId: id,
      status: { $ne: 'completed' },
      sessionStartTime: sessionStartTime.trim()
    }).lean();

    let scheduleWarning = null;
    if (existingBatches.length > 0) {
      scheduleWarning = `Notice: Another active cohort in this school also starts at ${sessionStartTime}. Please ensure room/lab availability.`;
    }

    const batch = await Batch.create({
      name: name.trim(),
      tenantId: id,
      targetClass,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      sessionStartTime: sessionStartTime.trim(),
      sessionEndTime: sessionEndTime.trim(),
      scheduleDays,
      assignedTrainers: Array.isArray(assignedTrainers) ? assignedTrainers : [],
      status,
      liveSessionNotes,
      isCompleted: status === 'completed'
    });

    createCriticalAuditLog({
      tenantId: id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_COHORT_CREATED',
      details: {
        cohortId: batch._id,
        name: batch.name,
        targetClass,
        sessionStartTime,
        sessionEndTime
      }
    });

    res.status(201).json({
      success: true,
      message: 'Training cohort created successfully.',
      batch,
      scheduleWarning
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/v1/admin/schools/:id/cohorts/:cohortId
 * Updates training cohort schedule, dates, trainers, and status.
 * Historical records preservation: Setting status to 'completed' preserves all records intact.
 */
router.put('/schools/:id/cohorts/:cohortId', async (req, res) => {
  try {
    const { id, cohortId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(cohortId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const {
      name,
      targetClass,
      startDate,
      endDate,
      sessionStartTime,
      sessionEndTime,
      scheduleDays,
      assignedTrainers,
      status,
      liveSessionNotes
    } = req.body;

    const update = {};
    if (name) update.name = name.trim();
    if (targetClass) update.targetClass = targetClass;
    if (startDate !== undefined) update.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) update.endDate = endDate ? new Date(endDate) : null;
    if (sessionStartTime) update.sessionStartTime = sessionStartTime.trim();
    if (sessionEndTime) update.sessionEndTime = sessionEndTime.trim();
    if (scheduleDays) update.scheduleDays = scheduleDays;
    if (assignedTrainers) update.assignedTrainers = assignedTrainers;
    if (liveSessionNotes !== undefined) update.liveSessionNotes = liveSessionNotes;
    if (status) {
      update.status = status;
      if (status === 'completed') {
        update.isCompleted = true; // Historical preservation flag
      } else {
        update.isCompleted = false;
      }
    }

    const updated = await Batch.findOneAndUpdate(
      { _id: cohortId, tenantId: id },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Cohort record not found.' });
    }

    createCriticalAuditLog({
      tenantId: id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_COHORT_UPDATED',
      details: { cohortId, updatedFields: Object.keys(update), status: updated.status }
    });

    res.json({
      success: true,
      message: updated.status === 'completed'
        ? 'Training cohort completed. All historical records, assessments, and attendance preserved.'
        : 'Cohort updated successfully.',
      batch: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/schools/:id/assign
 * Assigns students and educators to the correct school and cohort.
 * Supports explicit cohorts and General School Enrollment (default class cohort).
 */
router.post('/schools/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const school = await College.findById(id).select('name code institutionType').lean();
    if (!school) {
      return res.status(404).json({ success: false, message: 'School not found.' });
    }

    const { studentIds = [], trainerIds = [], cohortId = null, className = 'Class 11' } = req.body;

    if (!Array.isArray(studentIds) || !Array.isArray(trainerIds)) {
      return res.status(400).json({ success: false, message: 'studentIds and trainerIds must be arrays.' });
    }

    if (studentIds.length === 0 && trainerIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one student or educator must be provided for assignment.' });
    }

    // 1. Validate identifier formats
    const invalidStudentId = studentIds.find((sid) => !mongoose.Types.ObjectId.isValid(sid));
    if (invalidStudentId) {
      return res.status(400).json({ success: false, code: 'INVALID_STUDENT_ID', message: `Invalid student identifier: ${invalidStudentId}` });
    }
    const invalidTrainerId = trainerIds.find((tid) => !mongoose.Types.ObjectId.isValid(tid));
    if (invalidTrainerId) {
      return res.status(400).json({ success: false, code: 'INVALID_TRAINER_ID', message: `Invalid educator identifier: ${invalidTrainerId}` });
    }

    // 2. Validate cohort existence & ownership
    let resolvedCohort = null;
    if (cohortId && mongoose.Types.ObjectId.isValid(cohortId)) {
      resolvedCohort = await Batch.findOne({ _id: cohortId, tenantId: id });
      if (!resolvedCohort) {
        return res.status(404).json({ success: false, code: 'COHORT_NOT_FOUND', message: 'Specified cohort not found in this school.' });
      }
    } else {
      // General School Enrollment: Resolve or create the canonical default cohort for this school & class
      const defaultCohortName = `${school.name} - ${className}`;
      let defaultCohort = await Batch.findOne({
        tenantId: id,
        targetClass: className,
        $or: [
          { name: defaultCohortName },
          { name: `${school.name} - General ${className}` },
          { name: `${className} - General Cohort` }
        ]
      });

      if (!defaultCohort) {
        defaultCohort = await Batch.create({
          tenantId: id,
          name: defaultCohortName,
          targetClass: className,
          status: 'active',
          scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          sessionStartTime: '11:00 AM',
          sessionEndTime: '12:00 PM',
          assignedTrainers: []
        });
      }
      resolvedCohort = defaultCohort;
    }

    // 3. Verify user existence, roles and prevent silent partial failures
    const students = studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds }, role: 'student', soft_deleted: { $ne: true } })
      : [];

    if (studentIds.length > 0 && students.length !== studentIds.length) {
      const foundIds = new Set(students.map((s) => s._id.toString()));
      const missingId = studentIds.find((sid) => !foundIds.has(sid.toString()));
      return res.status(400).json({
        success: false,
        code: 'STUDENT_NOT_FOUND',
        message: `Student with identifier ${missingId} not found, inactive, or invalid.`
      });
    }

    const educators = trainerIds.length > 0
      ? await User.find({ _id: { $in: trainerIds }, role: { $in: ['trainer', 'teacher'] }, soft_deleted: { $ne: true } })
      : [];

    if (trainerIds.length > 0 && educators.length !== trainerIds.length) {
      const foundIds = new Set(educators.map((e) => e._id.toString()));
      const missingId = trainerIds.find((tid) => !foundIds.has(tid.toString()));
      return res.status(400).json({
        success: false,
        code: 'EDUCATOR_NOT_FOUND',
        message: `Educator with identifier ${missingId} not found, inactive, or not authorized for educator role.`
      });
    }

    // 4. Execute atomic updates and critical audit logging in a single mandatory transaction
    await runMandatoryTransaction(async (session) => {
      const sessionOpts = { session };

      if (students.length > 0) {
        const studentOids = students.map((s) => s._id);
        await User.updateMany(
          { _id: { $in: studentOids } },
          {
            $set: {
              tenantId: id,
              className,
              batchId: resolvedCohort._id,
              batch: resolvedCohort.name
            }
          },
          sessionOpts
        );
      }

      if (educators.length > 0) {
        const educatorOids = educators.map((e) => e._id);
        // Ensure tenantId is updated to the school
        await User.updateMany(
          { _id: { $in: educatorOids } },
          { $set: { tenantId: id } },
          sessionOpts
        );

        // Assign primary batchId if educator does not have one
        await User.updateMany(
          { _id: { $in: educatorOids }, batchId: null },
          { $set: { batchId: resolvedCohort._id, batch: resolvedCohort.name } },
          sessionOpts
        );

        // Add educators to Batch.assignedTrainers
        await Batch.findByIdAndUpdate(
          resolvedCohort._id,
          { $addToSet: { assignedTrainers: { $each: educatorOids } } },
          sessionOpts
        );
      }

      // Critical Audit Logging inside the exact same transaction session
      await createCriticalAuditLog({
        tenantId: id,
        actor: actorFromRequest(req),
        action: 'PLATFORM_ADMIN_MEMBERS_ASSIGNED',
        targetRecord: resolvedCohort._id,
        targetModel: 'Batch',
        details: {
          schoolId: id,
          schoolName: school.name,
          cohortId: resolvedCohort._id,
          cohortName: resolvedCohort.name,
          targetClass: className,
          isDefaultCohort: !cohortId,
          studentsAssigned: students.length,
          studentIds: students.map((s) => s._id),
          educatorsAssigned: educators.length,
          educatorIds: educators.map((e) => e._id)
        },
        session
      });
    });

    res.json({
      success: true,
      message: `Successfully assigned ${students.length} student(s) and ${educators.length} educator(s) to ${resolvedCohort.name}.`,
      cohort: {
        _id: resolvedCohort._id,
        name: resolvedCohort.name,
        targetClass: resolvedCohort.targetClass
      },
      updatedStudentsCount: students.length,
      updatedTrainersCount: educators.length
    });
  } catch (err) {
    if (err.code === 'TRANSACTION_REQUIRED' || err.isTransactionalError) {
      return res.status(503).json({
        success: false,
        code: 'TRANSACTIONS_UNAVAILABLE',
        message: 'Assignment service requires atomic transaction support. No records were modified.'
      });
    }
    if (err.isCommitUncertain || err.code === 'COMMIT_OUTCOME_UNCERTAIN') {
      return res.status(500).json({
        success: false,
        code: 'TRANSACTION_COMMIT_UNCERTAIN',
        message: 'Assignment commit outcome is uncertain due to a network or database interruption. Please verify existing assignments before retrying.'
      });
    }
    return handleDatabaseError(err, res, 'Failed to execute school member assignment. Transaction aborted with no partial changes.');
  }
});

/**
 * GET /api/v1/admin/schools/:id/leaderboard
 * Platform Admin inspection of a specific school's student leaderboard.
 */
router.get('/schools/:id/leaderboard', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const { batchId, className } = req.query;
    const result = await computeSchoolLeaderboard({
      tenantId: id,
      batchId,
      className
    });

    res.json({
      success: true,
      school: result.school,
      count: result.count,
      leaderboard: result.leaderboard
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/schools/:id/performance
 * Platform Admin view of attendance, assessments, and homework reports by school.
 */
router.get('/schools/:id/performance', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const { cohortId } = req.query;
    const query = { tenantId: id };

    let studentIds = null;
    if (cohortId && mongoose.Types.ObjectId.isValid(cohortId)) {
      const cohortStudents = await User.find({ tenantId: id, batchId: cohortId }).select('_id').lean();
      studentIds = cohortStudents.map(s => s._id);
      query.studentId = { $in: studentIds };
    }

    const [attendanceRecords, assessmentAttempts, homeworkSubmissions, students, batches] = await Promise.all([
      Attendance.find(query).sort({ date: -1 }).limit(100).lean(),
      AssessmentAttempt.find(query).sort({ submittedAt: -1 }).limit(100).lean(),
      Submission.find(query).populate('assignmentId', 'title points').sort({ submittedAt: -1 }).limit(100).lean(),
      User.find({ tenantId: id, role: 'student', soft_deleted: { $ne: true } }).select('name studentId className batchId').lean(),
      Batch.find({ tenantId: id }).lean()
    ]);

    // Aggregate summary metrics
    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;

    const evaluatedAttempts = assessmentAttempts.filter(a => a.status === 'evaluated');
    const avgTestPct = evaluatedAttempts.length > 0
      ? Math.round(evaluatedAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / evaluatedAttempts.length)
      : null;

    const gradedSubmissions = homeworkSubmissions.filter(s => s.status === 'graded');
    const homeworkCompletionRate = homeworkSubmissions.length > 0
      ? Math.round((homeworkSubmissions.filter(s => s.status === 'graded' || s.status === 'submitted').length / homeworkSubmissions.length) * 100)
      : null;

    res.json({
      success: true,
      summary: {
        totalStudents: students.length,
        attendanceRate,
        averageTestPercentage: avgTestPct,
        homeworkCompletionRate,
        totalEvaluatedAttempts: evaluatedAttempts.length,
        totalGradedSubmissions: gradedSubmissions.length
      },
      attendanceRecords,
      assessmentAttempts,
      homeworkSubmissions,
      batches
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * POST /api/v1/admin/schools/:id/assign-content
 * Assigns assessment, homework assignment, or announcement to a specific school and cohort.
 */
router.post('/schools/:id/assign-content', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid school ID.' });
    }

    if (req.user.role !== 'superadmin' && req.tenantId?.toString() !== id) {
      return res.status(403).json({ success: false, message: 'Unauthorized school scope.' });
    }

    const { contentType, cohortId, title, description, subject, dueDate, date, points, durationMinutes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    let createdRecord = null;
    let modelName = '';

    if (contentType === 'homework' || contentType === 'assignment') {
      modelName = 'Assignment';
      createdRecord = await Assignment.create({
        tenantId: id,
        batchId: cohortId || undefined,
        title: title.trim(),
        subject: subject || 'Python Programming',
        description: description || '',
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        points: points || 20,
        status: 'published'
      });
    } else if (contentType === 'assessment' || contentType === 'test') {
      modelName = 'Assessment';
      createdRecord = await Assessment.create({
        id: `exam-${Date.now()}`,
        tenantId: id,
        batchId: cohortId || undefined,
        title: title.trim(),
        subject: subject || 'Python Programming',
        date: date ? new Date(date) : new Date(),
        durationMinutes: durationMinutes || 45,
        totalMarks: points || 20,
        isCodingExam: true
      });
    } else if (contentType === 'announcement') {
      modelName = 'Announcement';
      createdRecord = await Announcement.create({
        tenantId: id,
        batchId: cohortId || undefined,
        title: title.trim(),
        content: description || title.trim(),
        authorId: req.user._id,
        authorName: req.user.name || 'Platform Administration',
        priority: 'normal',
        status: 'published',
        publishedAt: new Date()
      });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid contentType. Use "homework", "assessment", or "announcement".' });
    }

    createCriticalAuditLog({
      tenantId: id,
      actor: actorFromRequest(req),
      action: 'PLATFORM_ADMIN_CONTENT_ASSIGNED',
      details: { schoolId: id, cohortId, contentType, recordId: createdRecord._id }
    });

    res.status(201).json({
      success: true,
      message: `${modelName} assigned to cohort successfully.`,
      record: createdRecord
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/administrators', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const admins = await User.find({
      ...tenantFilter,
      role: { $in: ['admin', 'superadmin'] },
      soft_deleted: { $ne: true }
    }).select('-password -twoFactorSecret -twoFactorBackupCodes').sort({ name: 1 }).lean();

    res.json({
      success: true,
      count: admins ? admins.length : 0,
      administrators: admins || []
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/courses', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const courses = await Course.find(tenantFilter).sort({ title: 1 }).lean();
    res.json({
      success: true,
      count: courses ? courses.length : 0,
      courses: courses || []
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.post('/courses', async (req, res) => {
  try {
    const { title, code, description, department, credits, className, batchId, trainerId, targetTenantId } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Course/Subject title is required.' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    const targetTenant = isSuperAdmin
      ? (targetTenantId || req.body.tenantId || req.body.collegeId || req.headers['x-tenant-id'] || req.query.tenantId)
      : req.tenantId;

    if (!targetTenant || !mongoose.Types.ObjectId.isValid(targetTenant)) {
      return res.status(400).json({ success: false, message: 'Target tenant ID is required.' });
    }

    const targetCollege = await College.findOne({ _id: targetTenant, status: 'active' });
    if (!targetCollege) {
      return res.status(400).json({ success: false, message: 'Specified target institution does not exist or is inactive.' });
    }

    let assignedTrainer = null;
    if (trainerId && mongoose.Types.ObjectId.isValid(trainerId)) {
      const trainerUser = await User.findById(trainerId).lean();
      if (trainerUser) {
        assignedTrainer = {
          name: trainerUser.name,
          email: trainerUser.email,
          role: trainerUser.role
        };
      }
    }

    const courseId = `crs-${title.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15)}-${Date.now()}`;
    const courseCode = code ? code.trim().toUpperCase() : `SUB-${Math.floor(100 + Math.random() * 900)}`;

    const existingCourse = await Course.findOne({ tenantId: targetTenant, code: courseCode });
    if (existingCourse) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_COURSE_CODE',
        message: `A curriculum/subject with course code "${courseCode}" already exists in this institution.`
      });
    }

    const newCourse = await Course.create({
      tenantId: targetTenant,
      id: courseId,
      code: courseCode,
      title: title.trim(),
      description: description || `Curriculum for ${title.trim()}`,
      department: department || 'General',
      credits: credits ? parseInt(credits) : 3,
      className: className || undefined,
      batchId: batchId || undefined,
      instructor: assignedTrainer || { name: 'Assigned Educator', role: 'Faculty' },
      assignedTrainer: assignedTrainer || undefined,
      status: 'Active',
      units: []
    });

    createCriticalAuditLog({
      tenantId: targetTenant,
      actor: actorFromRequest(req),
      action: 'COMPANY_ADMIN_COURSE_CREATED',
      details: { courseId: newCourse._id, code: newCourse.code, title: newCourse.title }
    });

    res.status(201).json({
      success: true,
      message: 'Course / subject created successfully.',
      course: newCourse
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to create course.');
  }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getAdminTenantFilter(req);

    const { title, code, description, department, credits, status, trainerId } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (code) {
      update.code = code.trim().toUpperCase();
      const existing = await Course.findOne({
        ...tenantFilter,
        _id: { $ne: mongoose.Types.ObjectId.isValid(id) ? id : null },
        id: { $ne: id },
        code: update.code
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          code: 'DUPLICATE_COURSE_CODE',
          message: `Another curriculum with code "${update.code}" already exists.`
        });
      }
    }
    if (description) update.description = description.trim();
    if (department) update.department = department.trim();
    if (credits !== undefined) update.credits = parseInt(credits) || 3;
    if (status) update.status = status;

    if (trainerId && mongoose.Types.ObjectId.isValid(trainerId)) {
      const trainerUser = await User.findById(trainerId).lean();
      if (trainerUser) {
        update.instructor = { name: trainerUser.name, role: trainerUser.role };
        update.assignedTrainer = { name: trainerUser.name, email: trainerUser.email, role: trainerUser.role };
      }
    }

    const updatedCourse = await Course.findOneAndUpdate(
      { ...tenantFilter, $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }] },
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({ success: false, message: 'Course not found or unauthorized.' });
    }

    res.json({
      success: true,
      message: 'Course / subject updated successfully.',
      course: updatedCourse
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to update course.');
  }
});

/**
 * DELETE /api/v1/admin/courses/:id
 * Company Administrator deletion of curriculum/subject.
 * Verifies tenant authorization and dependent records (assignments, assessments).
 */
router.delete('/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getAdminTenantFilter(req);

    const course = await Course.findOne({
      ...tenantFilter,
      $or: [{ id }, { _id: mongoose.Types.ObjectId.isValid(id) ? id : null }]
    });

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course / subject not found or unauthorized.' });
    }

    const cascadeResult = await cascadeDeleteCourse(course, actorFromRequest(req), req.query.force === 'true');
    if (!cascadeResult.success && cascadeResult.conflict) {
      return res.status(409).json({
        success: false,
        code: 'COURSE_HAS_DEPENDENCIES',
        message: cascadeResult.message,
        hasDependencies: true,
        activeAssignments: cascadeResult.assignmentsCount,
        activeAssessments: cascadeResult.assessmentsCount
      });
    }

    res.json({
      success: true,
      isTransactional: cascadeResult.isTransactional,
      message: `Course "${course.title}" deleted successfully.`
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Failed to delete course.');
  }
});

router.get('/attendance-stats', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const totalSessions = await Attendance.countDocuments(tenantFilter);
    const verifiedRecords = await Attendance.aggregate([
      { $match: tenantFilter },
      { $project: { count: { $size: { $ifNull: ['$records', []] } } } },
      { $group: { _id: null, total: { $sum: '$count' } } }
    ]);
    const totalVerified = verifiedRecords[0]?.total || 0;
    const studentsCount = await User.countDocuments({ ...tenantFilter, role: 'student', soft_deleted: { $ne: true } });
    const attendanceRate = totalSessions > 0 && studentsCount > 0
      ? Math.min(100, Math.round((totalVerified / (totalSessions * studentsCount)) * 100))
      : 0;

    const statsObj = {
      totalSessions,
      totalVerified,
      averageRate: `${attendanceRate}%`,
      activeCohorts: await Batch.countDocuments(tenantFilter)
    };

    res.json({
      success: true,
      averageRate: `${attendanceRate}%`,
      totalSessions,
      totalAttendanceRecords: totalVerified,
      activeCohorts: statsObj.activeCohorts,
      activeSessions: [],
      stats: statsObj
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/academic-ops', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const batches = await Batch.find(tenantFilter).lean();

    const queueStats = await Promise.all((batches || []).map(async (b) => {
      const submissions = await Submission.find({
        ...tenantFilter,
        $or: [{ batchId: b._id }, { batchName: b.name }]
      }).lean();

      const total = submissions.length;
      const graded = submissions.filter(s => s.status === 'graded').length;
      const pending = total - graded;

      return {
        batchId: b._id,
        name: b.name,
        cohort: b.name,
        code: b.code || b.name,
        total,
        graded,
        pending
      };
    }));

    const totalSubmissions = await Submission.countDocuments(tenantFilter);
    const evaluatedSubmissions = await Submission.countDocuments({ ...tenantFilter, status: 'graded' });
    const pendingSubmissions = totalSubmissions - evaluatedSubmissions;
    const evaluationRate = totalSubmissions > 0 ? Math.round((evaluatedSubmissions / totalSubmissions) * 100) : 100;

    res.json({
      success: true,
      totalSubmissions,
      evaluatedSubmissions,
      pendingSubmissions,
      evaluationRate,
      batchBreakdown: queueStats,
      queue: queueStats
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/announcements
 * Retrieve all campus circulars and announcements for this institution
 */
router.get('/announcements', async (req, res) => {
  try {
    let query;
    if (req.user.role === 'superadmin') {
      if (req.query.tenantId && mongoose.Types.ObjectId.isValid(req.query.tenantId)) {
        query = { $or: [{ tenantId: req.query.tenantId }, { isPlatformWide: true }] };
      } else {
        query = {}; // All announcements across platform
      }
    } else {
      const tenantId = req.tenantId || req.user?.tenantId;
      query = { $or: [{ tenantId }, { isPlatformWide: true }] };
    }

    const notices = await Announcement.find(query)
      .populate('batchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = notices.map((n) => ({
      _id: n._id,
      id: n._id.toString(),
      title: n.title,
      content: n.content,
      message: n.content,
      author: n.authorName || 'School Administration',
      authorName: n.authorName || 'School Administration',
      authorId: n.authorId,
      batchId: n.batchId?._id || n.batchId || null,
      batchName: n.batchId?.name || n.batchName || 'All Campus',
      audience: n.batchId?.name || n.batchName || 'All Campus',
      priority: n.priority || 'normal',
      badge: n.priority === 'urgent' ? 'Urgent Alert' : (n.badge || 'Campus Circular'),
      status: n.status || 'published',
      attachments: n.attachments || [],
      publishedAt: n.publishedAt || n.createdAt,
      date: n.publishedAt
        ? new Date(n.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Recent Notice'
    }));

    res.json({ success: true, count: formatted.length, announcements: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/announcements
 * Broadcast official campus circular to students and faculty
 */
router.post('/announcements', async (req, res) => {
  try {
    const { title, content, message, priority, batchId, batchName, status, attachments, isPlatformWide: reqPlatformWide, targetTenantId } = req.body;
    const bodyContent = content || message;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Announcement title is required' });
    }
    if (!bodyContent || !bodyContent.trim()) {
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Announcement body is required' });
    }

    const isSuperAdmin = req.user.role === 'superadmin';
    let resolvedTenantId = null;
    let isPlatformWide = false;

    if (isSuperAdmin) {
      const explicitTarget = targetTenantId || req.body.tenantId || req.body.collegeId || req.headers['x-tenant-id'] || req.query.tenantId;
      if (explicitTarget && mongoose.Types.ObjectId.isValid(explicitTarget)) {
        const col = await College.findById(explicitTarget).lean();
        if (!col) {
          return res.status(400).json({ success: false, code: 'INVALID_TENANT_TARGET', message: 'Target institution not found' });
        }
        resolvedTenantId = explicitTarget;
        isPlatformWide = false;
      } else {
        isPlatformWide = true;
        resolvedTenantId = null;
      }
    } else {
      resolvedTenantId = req.tenantId || req.user?.tenantId;
      if (!resolvedTenantId) {
        return res.status(400).json({ success: false, code: 'MISSING_TENANT_CONTEXT', message: 'Tenant context required' });
      }
    }

    // Audience validation (batchId)
    let resolvedBatchName = batchName;
    let resolvedBatchId = null;
    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, code: 'INVALID_BATCH_ID', message: 'Invalid cohort identifier' });
      }
      if (resolvedTenantId) {
        const batchDoc = await Batch.findOne({ _id: batchId, tenantId: resolvedTenantId });
        if (!batchDoc) {
          return res.status(403).json({
            success: false,
            code: 'INVALID_AUDIENCE_SCOPE',
            errorCode: 'INVALID_AUDIENCE_SCOPE',
            message: 'The selected cohort/batch does not belong to your authorized institution.'
          });
        }
        resolvedBatchName = batchDoc.name;
        resolvedBatchId = batchDoc._id;
      }
    }

    const noticeStatus = ['draft', 'published', 'archived'].includes(status) ? status : 'published';
    const isPublished = noticeStatus === 'published';

    const announcement = await Announcement.create({
      tenantId: resolvedTenantId,
      isPlatformWide,
      authorId: req.user._id,
      authorName: req.user.name || 'School Administration',
      authorRole: req.user.role || 'admin',
      title: title.trim(),
      content: bodyContent.trim(),
      batchId: resolvedBatchId,
      batchName: resolvedBatchName || 'All Campus',
      priority: ['normal', 'important', 'urgent', 'high', 'low'].includes(priority) ? priority : 'normal',
      status: noticeStatus,
      badge: priority === 'urgent' ? 'Urgent Alert' : 'Campus Circular',
      attachments: Array.isArray(attachments) ? attachments : [],
      publishedAt: isPublished ? new Date() : null
    });

    const io = req.app.get('io');
    if (io && isPublished) {
      if (isPlatformWide) {
        io.emit('announcement:new', announcement);
      } else if (announcement.batchId) {
        io.to(`tenant:${resolvedTenantId}:batch:${announcement.batchId}`).emit('announcement:new', announcement);
        io.to(`tenant:${resolvedTenantId}:role:trainer`).emit('announcement:new', announcement);
        io.to(`tenant:${resolvedTenantId}:role:teacher`).emit('announcement:new', announcement);
        io.to(`tenant:${resolvedTenantId}:role:admin`).emit('announcement:new', announcement);
      } else {
        io.to(`tenant:${resolvedTenantId}`).emit('announcement:new', announcement);
      }
    }

    if (resolvedTenantId) {
      createCriticalAuditLog({
        tenantId: resolvedTenantId,
        actor: actorFromRequest(req),
        action: 'ADMIN_ANNOUNCEMENT_CREATED',
        targetRecord: announcement._id,
        targetModel: 'Announcement',
        details: { title: announcement.title, priority: announcement.priority, status: noticeStatus, isPlatformWide }
      });
    }

    res.status(201).json({
      success: true,
      message: isPublished ? 'Announcement published successfully' : 'Draft saved successfully',
      announcement
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join('; ');
      return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: msg || 'Announcement validation failed' });
    }
    console.error('Error creating announcement:', err);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
});

/**
 * DELETE /api/v1/admin/announcements/:id
 * Delete or archive campus circular
 */
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getAdminTenantFilter(req);
    const deleted = await Announcement.findOneAndDelete({ _id: id, ...tenantFilter });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${deleted.tenantId}`).emit('announcement:deleted', { id });
    }

    createCriticalAuditLog({
      tenantId: deleted.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_ANNOUNCEMENT_DELETED',
      targetRecord: deleted._id,
      targetModel: 'Announcement',
      details: { title: deleted.title }
    });

    res.json({ success: true, message: 'Announcement deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/v1/admin/doubts
 * View student doubts and helpdesk inquiries across the institution
 */
router.get('/doubts', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const doubts = await Doubt.find(tenantFilter).sort({ createdAt: -1 }).lean();

    const formatted = doubts.map((d) => ({
      _id: d._id,
      id: d._id.toString(),
      studentName: d.studentName,
      studentId: d.studentIdNumber || (d.studentId ? d.studentId.toString().substring(0, 8) : 'Student'),
      subject: d.subject,
      topic: d.topic,
      question: d.question,
      codeSnippet: d.codeSnippet || '',
      status: d.status === 'answered' ? 'Answered' : 'Submitted',
      reply: d.response || '',
      response: d.response || '',
      teacherName: d.teacherName || 'Faculty / Administration',
      createdAt: d.createdAt,
      repliedAt: d.repliedAt,
      replies: d.replies || []
    }));

    res.json({ success: true, count: formatted.length, doubts: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/doubts/:id/reply
 * Admin can reply to and resolve student questions
 */
router.post('/doubts/:id/reply', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const { id } = req.params;
    const doubt = await Doubt.findOne({ _id: id, ...tenantFilter });
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt inquiry not found.' });
    }

    const replyText = (req.body.reply || req.body.response || '').trim();
    if (!replyText) {
      return res.status(400).json({ success: false, message: 'Reply text cannot be empty.' });
    }

    doubt.status = 'answered';
    doubt.response = replyText;
    doubt.repliedAt = new Date();
    doubt.teacherId = req.user._id;
    doubt.teacherName = req.user.name || 'School Administration';
    doubt.replies.push({
      authorId: req.user._id,
      authorName: req.user.name || 'School Administration',
      authorRole: req.user.role || 'admin',
      text: replyText,
      createdAt: new Date()
    });

    await doubt.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`tenant:${doubt.tenantId}`).emit('doubt:answered', {
        id: doubt._id.toString(),
        studentId: doubt.studentId,
        response: replyText
      });
    }

    res.json({ success: true, message: 'Reply sent to student.', doubt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/incomplete-profiles', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const students = await User.find({
      ...tenantFilter,
      role: 'student',
      soft_deleted: { $ne: true },
      $or: [
        { phone: { $in: [null, ''] } },
        { address: { $in: [null, ''] } },
        { 'emergencyContact.name': { $in: [null, ''] } },
        { 'emergencyContact.phone': { $in: [null, ''] } }
      ]
    }).select('studentId name email phone address emergencyContact tenantId batchId').lean();

    res.json({
      success: true,
      count: students.length,
      students
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/security-policies', getSecurityPolicies);
router.put('/security-policies', updateSecurityPolicies);

router.get('/audit-logs', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));

    const filter = { ...tenantFilter };

    if (req.query.action && req.query.action.trim()) {
      filter.action = req.query.action.trim();
    }
    if (req.query.actor && req.query.actor.trim()) {
      filter['actor.email'] = { $regex: req.query.actor.trim(), $options: 'i' };
    }
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    res.json({
      success: true,
      count: logs.length,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      logs
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

router.get('/analytics', async (req, res) => {
  try {
    const tenantFilter = getAdminTenantFilter(req);

    const [
      totalStudents,
      totalTrainers,
      totalBatches,
      totalCourses,
      totalAssignments,
      totalSubmissions,
      gradedSubmissions,
      totalAttendanceRecords,
      presentAttendanceRecords
    ] = await Promise.all([
      User.countDocuments({ ...tenantFilter, role: 'student', soft_deleted: { $ne: true } }),
      User.countDocuments({ ...tenantFilter, role: 'trainer', soft_deleted: { $ne: true } }),
      Batch.countDocuments(tenantFilter),
      Course.countDocuments(tenantFilter),
      Assignment.countDocuments(tenantFilter).catch(() => 0),
      Submission.countDocuments(tenantFilter).catch(() => 0),
      Submission.countDocuments({ ...tenantFilter, status: 'graded' }).catch(() => 0),
      Attendance.countDocuments(tenantFilter).catch(() => 0),
      Attendance.countDocuments({ ...tenantFilter, status: { $in: ['present', 'late'] } }).catch(() => 0)
    ]);

    // Query live batch breakdown for cohorts within this tenant
    const batches = await Batch.find(tenantFilter).lean();
    const batchBreakdown = await Promise.all(
      batches.map(async (b) => {
        const studentCount = await User.countDocuments({
          batchId: b._id,
          role: 'student',
          soft_deleted: { $ne: true }
        });
        return {
          id: b._id,
          name: b.name,
          code: b.code || b.name,
          studentCount
        };
      })
    );

    const evaluationRate = totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : null;
    const averageAttendanceRate = totalAttendanceRecords > 0 ? Math.round((presentAttendanceRecords / totalAttendanceRecords) * 100) : null;

    res.json({
      success: true,
      tenantId: req.tenantId,
      stats: {
        studentsCount: totalStudents,
        trainersCount: totalTrainers,
        batchesCount: totalBatches,
        coursesCount: totalCourses,
        assignmentsCount: totalAssignments,
        submissionsCount: totalSubmissions,
        evaluationsCount: gradedSubmissions,
        evaluationRate,
        attendanceSessionsCount: totalAttendanceRecords,
        averageAttendanceRate
      },
      data: {
        totalStudents,
        totalTrainers,
        totalBatches,
        totalCourses,
        totalAssignments,
        totalSubmissions,
        gradedSubmissions,
        attendanceRecords: totalAttendanceRecords,
        averageAttendanceRate,
        completionRate: evaluationRate
      },
      batchBreakdown
    });
  } catch (err) {
    return handleDatabaseError(err, res, 'Database operation failed.');
  }
});

/**
 * GET /api/v1/admin/maintenance/plan
 * Inspect candidate test and demo records before deletion
 */
router.get('/maintenance/plan', async (req, res) => {
  try {
    const { buildDeletionPlan } = await import('../utils/dataCleanup.js');
    const plan = await buildDeletionPlan(req.tenantId);
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/v1/admin/maintenance/clean-demo-academic
 * Safely removes verified audit-generated and demo academic records
 */
router.post('/maintenance/clean-demo-academic', async (req, res) => {
  try {
    const isDryRun = req.query.dryRun === 'true';
    const removeAudit = req.body.removeAudit !== false;
    const removeDemo = req.body.removeDemo !== false;

    const { buildDeletionPlan, executeDataCleanup } = await import('../utils/dataCleanup.js');

    if (isDryRun) {
      const plan = await buildDeletionPlan(req.tenantId);
      return res.json({ success: true, dryRun: true, plan });
    }

    const result = await executeDataCleanup({
      removeAudit,
      removeDemo,
      tenantId: req.tenantId
    });

    await createCriticalAuditLog({
      tenantId: req.tenantId,
      actor: actorFromRequest(req),
      action: 'ADMIN_CLEAN_ACADEMIC_DEMO_DATA',
      details: { deletedCounts: result.deletedCounts, remainingCounts: result.remainingCounts }
    });

    res.json({
      success: true,
      message: 'Verified audit and demo records removed successfully.',
      ...result
    });
  } catch (err) {
    console.error('Error in maintenance clean-demo-academic:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
