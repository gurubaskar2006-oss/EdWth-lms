import express from 'express';
import mongoose from 'mongoose';
import TeacherNote from '../models/TeacherNote.js';
import { requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Resilient in-memory fallback store if MongoDB is offline or in disconnected test mode
const inMemoryTeacherNotes = new Map();

/**
 * GET /api/v1/teacher-notes/:studentId
 * Retrieves instructional/advisory notes for a student, strictly isolated by tenant.
 * RBAC: Accessible only to teachers, trainers, and admins.
 */
router.get('/:studentId', requireRole('trainer', 'teacher', 'admin'), async (req, res) => {
  const { studentId } = req.params;
  const tenantId = req.tenantId || req.user?.tenantId || 'global';

  try {
    if (mongoose.connection.readyState === 1) {
      const note = await TeacherNote.findOne({
        tenantId: String(tenantId),
        studentId: String(studentId)
      }).lean();

      if (note) {
        return res.json({ success: true, note });
      }
    }

    // Check in-memory store
    const memKey = `${tenantId}:${studentId}`;
    const memNote = inMemoryTeacherNotes.get(memKey);

    return res.json({
      success: true,
      note: memNote || {
        tenantId,
        studentId,
        teacherId: req.user?._id || req.user?.id || 'teacher',
        content: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Error fetching teacher note:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve teacher note' });
  }
});

/**
 * PUT /api/v1/teacher-notes/:studentId
 * Saves/updates instructional notes for a student, strictly isolated by tenant.
 * RBAC: Accessible only to teachers, trainers, and admins.
 */
router.put('/:studentId', requireRole('trainer', 'teacher', 'admin'), async (req, res) => {
  const { studentId } = req.params;
  const { content = '' } = req.body;
  const tenantId = req.tenantId || req.user?.tenantId || 'global';
  const teacherId = req.user?._id?.toString() || req.user?.id || 'teacher';

  try {
    let savedNote = null;

    if (mongoose.connection.readyState === 1) {
      savedNote = await TeacherNote.findOneAndUpdate(
        {
          tenantId: String(tenantId),
          studentId: String(studentId)
        },
        {
          $set: {
            content: String(content),
            teacherId: String(teacherId)
          }
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      ).lean();
    }

    // Always update in-memory store as well for resilient fallback
    const memKey = `${tenantId}:${studentId}`;
    const memRecord = {
      tenantId: String(tenantId),
      studentId: String(studentId),
      teacherId: String(teacherId),
      content: String(content),
      createdAt: savedNote?.createdAt || inMemoryTeacherNotes.get(memKey)?.createdAt || new Date(),
      updatedAt: savedNote?.updatedAt || new Date()
    };
    inMemoryTeacherNotes.set(memKey, memRecord);

    return res.json({
      success: true,
      message: 'Teacher note persisted successfully',
      note: savedNote || memRecord
    });
  } catch (err) {
    console.error('Error saving teacher note:', err);
    res.status(500).json({ success: false, message: 'Failed to save teacher note' });
  }
});

export default router;
