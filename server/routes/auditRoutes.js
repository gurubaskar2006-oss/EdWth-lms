import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

const getAuditLogsHandler = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    let query = { tenantId: req.tenantId };
    if (req.user.role === 'superadmin') {
      if (req.query.tenantId) {
        query = { tenantId: req.query.tenantId };
      } else {
        query = {}; // Cross-tenant global audit oversight
      }
    }

    if (req.query.eventType || req.query.action) {
      query.action = req.query.eventType || req.query.action;
    }

    if (req.query.actor) {
      query['actor.email'] = { $regex: new RegExp(String(req.query.actor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    }

    if (req.query.from || req.query.to) {
      query.timestamp = {};
      if (req.query.from) query.timestamp.$gte = new Date(req.query.from);
      if (req.query.to) query.timestamp.$lte = new Date(req.query.to);
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .populate('actor.userId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/', verifyToken, requireRole(['admin', 'superadmin']), getAuditLogsHandler);
router.get('/logs', verifyToken, requireRole(['admin', 'superadmin']), getAuditLogsHandler);

export default router;
