/**
 * Lumina LMS — Data Routes
 * 6th Civilians Corporation
 *
 * SECURITY: All tenant-sensitive queries MUST have a tenantId.
 * There is NO fallback to {} (unrestricted query).
 * If tenantId is missing or invalid, the request is rejected with 403.
 *
 * This prevents any scenario where a misconfigured or compromised account
 * could accidentally receive records belonging to another tenant.
 */

import express from 'express';
import mongoose from 'mongoose';
import { verifyToken as protect } from '../middleware/authMiddleware.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Grade from '../models/Grade.js';

const router = express.Router();

/**
 * Validates that tenantId is a proper ObjectId and MongoDB is connected.
 * - For normal users and institution admins: enforces strict req.tenantId.
 * - For superadmin: allows cross-tenant query or specific tenant via req.query.tenantId.
 * Returns { filter } object or sends a 403/503 response and returns null.
 */
const getTenantQueryFilter = (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not available.' }
    });
    return null;
  }

  if (req.user && req.user.role === 'superadmin') {
    if (req.query.tenantId && mongoose.Types.ObjectId.isValid(req.query.tenantId)) {
      return { tenantId: req.query.tenantId };
    }
    return {}; // Cross-tenant company oversight for superadmin
  }

  const tenantId = req.tenantId;
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Your account does not have a valid institutional context. Please contact your administrator.'
      }
    });
    return null;
  }

  return { tenantId };
};

// GET /api/v1/data/courses
router.get('/courses', protect, async (req, res) => {
  try {
    const filter = getTenantQueryFilter(req, res);
    if (!filter) return;

    const courses = await Course.find(filter).lean();
    return res.json(courses);
  } catch (error) {
    console.error('[DataRoutes] /courses error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve courses.' }
    });
  }
});

// GET /api/v1/data/assignments
router.get('/assignments', protect, async (req, res) => {
  try {
    const filter = getTenantQueryFilter(req, res);
    if (!filter) return;

    const assignments = await Assignment.find(filter).lean();
    return res.json(assignments);
  } catch (error) {
    console.error('[DataRoutes] /assignments error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve assignments.' }
    });
  }
});

// GET /api/v1/data/grades
router.get('/grades', protect, async (req, res) => {
  try {
    if (req.user?.role === 'superadmin' && !req.user?.studentId) {
      return res.json(null);
    }

    const filter = getTenantQueryFilter(req, res);
    if (!filter) return;

    if (!req.user?.studentId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_STUDENT_ID', message: 'Could not determine your student record.' }
      });
    }

    // Always scope by both studentId AND tenantId — never trust one alone
    const grades = await Grade.findOne({
      studentId: req.user.studentId,
      ...filter
    }).lean();

    return res.json(grades || null);
  } catch (error) {
    console.error('[DataRoutes] /grades error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve grades.' }
    });
  }
});

// GET /api/v1/data/leaderboard
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const tenantId = requireTenantContext(req, res);
    if (!tenantId) return;

    const requestedTenantId = req.query.tenantId || req.query.schoolId;
    if (requestedTenantId && requestedTenantId.toString() !== tenantId.toString() && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_CROSS_TENANT_ACCESS',
        message: 'Security Violation: You are not authorized to view another institution\'s student leaderboard.'
      });
    }

    const { computeSchoolLeaderboard } = await import('../services/schoolLeaderboardService.js');
    const result = await computeSchoolLeaderboard({
      tenantId,
      batchId: req.user?.batchId,
      className: req.user?.className
    });

    return res.json({
      success: true,
      school: result.school,
      count: result.count,
      leaderboard: result.leaderboard
    });
  } catch (error) {
    console.error('[DataRoutes] /leaderboard error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve leaderboard.' }
    });
  }
});

export default router;
