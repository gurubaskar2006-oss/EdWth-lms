/**
 * Lumina LMS — Backblaze B2 Object Storage Routes
 * 6th Civilians Corporation
 *
 * Dedicated endpoints for authorized file uploads, presigned download URLs,
 * and tenant-isolated file retrieval.
 */

import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import { verifyToken } from '../middleware/authMiddleware.js';
import Note from '../models/Note.js';
import {
  uploadObject,
  getPresignedDownloadUrl,
  deleteObject,
  isStorageConfigured,
  getBucketName
} from '../utils/b2Storage.js';

const router = express.Router();
router.use(verifyToken);

// Configure Multer in-memory storage (25 MB max)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'text/plain',
      'text/markdown',
      'text/x-python',
      'application/json'
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.endsWith('.py') || file.originalname.endsWith('.md')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Word, PPT, JPG, PNG, TXT, MD, Python, JSON'), false);
    }
  }
});

/**
 * GET /api/v1/storage/status
 * Check if Backblaze B2 object storage is operational
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    provider: 'Backblaze B2',
    configured: isStorageConfigured(),
    bucket: isStorageConfigured() ? getBucketName() : null
  });
});

/**
 * POST /api/v1/storage/upload
 * Authoritatively uploads an attachment buffer to B2 and returns object key + metadata
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file buffer provided in request.' });
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required for object storage.' });
    }

    // Validate file magic bytes
    const type = await fileTypeFromBuffer(req.file.buffer);
    const isTextFallback = ['text/plain', 'text/markdown', 'text/x-python', 'application/json'].includes(req.file.mimetype)
      || req.file.originalname.endsWith('.py')
      || req.file.originalname.endsWith('.md')
      || req.file.originalname.endsWith('.txt');

    if (!type && !isTextFallback) {
      return res.status(400).json({ success: false, message: 'File signature validation failed.' });
    }

    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'STORAGE_NOT_CONFIGURED',
        message: 'Backblaze B2 object storage is not configured or uses placeholder credentials. Set B2_ENDPOINT, B2_APPLICATION_KEY_ID, and B2_APPLICATION_KEY in server/.env.'
      });
    }

    const folder = (req.body.folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '');
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `tenants/${tenantId}/${folder}/${crypto.randomUUID()}-${sanitizedName}`;

    await uploadObject({
      key: s3Key,
      body: req.file.buffer,
      contentType: req.file.mimetype,
      metadata: {
        tenantId: tenantId.toString(),
        uploadedBy: req.user._id.toString()
      }
    });

    const fileMeta = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      s3Key,
      uploadDate: new Date()
    };

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully to Backblaze B2.',
      file: fileMeta
    });
  } catch (err) {
    console.error('Storage upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'File upload failed.' });
  }
});

/**
 * GET /api/v1/storage/download
 * Retrieves a secure, short-lived presigned URL with strict tenant authorization
 */
router.get('/download', async (req, res) => {
  try {
    const s3Key = req.query.key || req.query.s3Key;
    if (!s3Key) {
      return res.status(400).json({ success: false, message: 'Missing s3Key query parameter.' });
    }

    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Tenant context required.' });
    }

    // STRICT TENANT ISOLATION CHECK
    // Object key format: tenants/<tenantId>/...
    if (s3Key.startsWith('tenants/')) {
      const parts = s3Key.split('/');
      const keyTenant = parts[1];
      if (keyTenant && keyTenant !== tenantId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to access files belonging to another institution.'
        });
      }
    }

    // DOCUMENT-LEVEL AUTHORIZATION: Do not treat possession of an object key as authorization
    const noteDoc = await Note.findOne({
      tenantId,
      'files.s3Key': s3Key
    });

    if (noteDoc) {
      const userRole = (req.user?.role || '').toLowerCase();
      const isStaff = ['trainer', 'teacher', 'admin', 'superadmin'].includes(userRole);
      const isOwner = noteDoc.owner?.toString() === req.user?._id?.toString();

      if (!isStaff && !isOwner) {
        if (noteDoc.visibility !== 'batch-shared') {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You are not authorized to access this private material.'
          });
        }

        if (noteDoc.batchId) {
          const studentBatchId = req.user?.batchId ? req.user.batchId.toString() : null;
          if (!studentBatchId || studentBatchId !== noteDoc.batchId.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Access denied: Material is restricted to a different class.'
            });
          }
        }
      }
    }

    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'STORAGE_NOT_CONFIGURED',
        message: 'Backblaze B2 object storage is not configured or uses placeholder credentials.'
      });
    }

    const downloadUrl = await getPresignedDownloadUrl({
      key: s3Key,
      expiresInSeconds: 3600
    });

    res.json({
      success: true,
      downloadUrl,
      expiresInSeconds: 3600
    });
  } catch (err) {
    console.error('Presigned URL error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to generate download URL.' });
  }
});

export default router;
