import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';
import mongoose from 'mongoose';
import Note from '../models/Note.js';
import Batch from '../models/Batch.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { uploadObject, getPresignedDownloadUrl, deleteObject, isStorageConfigured } from '../utils/b2Storage.js';

const router = express.Router();

const isEducatorOrAdmin = (role) => ['trainer', 'teacher', 'admin', 'superadmin'].includes(String(role || '').toLowerCase());

// Configure Multer (memory storage for B2 upload, 25 MB max)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
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
      'application/x-python-code',
      'application/json'
    ];
    const isAllowedExt = file.originalname.endsWith('.py') || 
                         file.originalname.endsWith('.md') || 
                         file.originalname.endsWith('.txt') || 
                         file.originalname.endsWith('.json');
                         
    if (allowedMimes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Word, PPT, JPG, PNG, TXT, MD, Python, JSON'), false);
    }
  }
});

const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File size exceeds maximum limit of 25 MB.' });
        }
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'File upload rejected.' });
    }
    next();
  });
};

/**
 * GET /api/v1/notes
 * Retrieves notes and study materials scoped strictly to authenticated tenant.
 * - Educators/Admins: see all materials in tenant, filterable by batchId / subject.
 * - Students: see own notes OR batch-shared materials for their assigned batch (or tenant-wide).
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is not available.' }
      });
    }

    if (!req.tenantId || !mongoose.Types.ObjectId.isValid(req.tenantId)) {
      return res.status(403).json({
        success: false,
        error: { code: 'MISSING_TENANT_CONTEXT', message: 'Missing institutional context.' }
      });
    }

    const { subject, batchId, category, resourceType } = req.query;
    const isStaff = isEducatorOrAdmin(req.user?.role);

    // Base query: strictly scoped to tenant
    const query = { tenantId: req.tenantId };

    if (isStaff) {
      // Educators/Admins can see tenant notes; optionally filter by batchId or subject
      if (batchId && mongoose.Types.ObjectId.isValid(batchId)) {
        query.$or = [
          { batchId },
          { batchId: null }
        ];
      }
    } else {
      // Students see:
      // 1. Notes they personally own
      // 2. batch-shared materials matching their assigned batchId OR tenant-wide (batchId: null)
      const orList = [];

      if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id)) {
        orList.push({ owner: req.user._id });
      }

      if (req.user?.batchId && mongoose.Types.ObjectId.isValid(req.user.batchId)) {
        orList.push({ visibility: 'batch-shared', batchId: req.user.batchId });
      }
      // Materials shared with all batches in the tenant
      orList.push({ visibility: 'batch-shared', batchId: null });

      query.$or = orList;
    }

    if (subject) {
      query.subject = { $regex: new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }
    if (category && category !== 'All') {
      query.category = category;
    }
    if (resourceType) {
      query.resourceType = resourceType;
    }

    const notes = await Note.find(query).sort({ pinned: -1, createdAt: -1 }).lean();
    return res.json(notes || []);
  } catch (error) {
    console.error('[NoteRoutes] GET / error:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve notes.' }
    });
  }
});

/**
 * POST /api/v1/notes
 * Create or update a note / study material metadata document
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const noteData = req.body;
    const isStaff = isEducatorOrAdmin(req.user.role);

    // Validate batchId belongs to tenant if specified
    if (noteData.batchId) {
      if (!mongoose.Types.ObjectId.isValid(noteData.batchId)) {
        return res.status(400).json({ error: 'Invalid batchId provided.' });
      }
      const batchExists = await Batch.findOne({ _id: noteData.batchId, tenantId: req.tenantId });
      if (!batchExists) {
        return res.status(400).json({ error: 'Specified batch does not belong to your institution.' });
      }
    }

    // Students cannot publish batch-shared materials
    if (!isStaff && noteData.visibility === 'batch-shared') {
      return res.status(403).json({ error: 'Only teachers and administrators can publish materials to classes.' });
    }

    let note = await Note.findOne({ id: noteData.id, tenantId: req.tenantId });
    
    if (note) {
      if (note.owner.toString() !== req.user._id.toString() && !isStaff) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      Object.assign(note, noteData);
      await note.save();
    } else {
      note = await Note.create({ 
        ...noteData, 
        owner: req.user._id, 
        tenantId: req.tenantId,
        createdAt: noteData.createdAt || new Date().toISOString()
      });
    }
    
    res.json(note);
  } catch (error) {
    console.error('[NoteRoutes] POST / error:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

/**
 * DELETE /api/v1/notes/:id
 * Delete note and clean up all associated B2 objects
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const note = await Note.findOne({ id: req.params.id, tenantId: req.tenantId });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    
    const isStaff = isEducatorOrAdmin(req.user.role);
    if (note.owner.toString() !== req.user._id.toString() && !isStaff) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Cascading cleanup of attached objects in Backblaze B2
    if (isStorageConfigured() && note.files && note.files.length > 0) {
      for (const f of note.files) {
        if (f.s3Key) {
          try {
            await deleteObject({ key: f.s3Key });
          } catch (delErr) {
            console.warn(`⚠️ [Storage] Could not delete B2 object ${f.s3Key} during note cleanup:`, delErr.message);
          }
        }
      }
    }

    await Note.findOneAndDelete({ id: req.params.id, tenantId: req.tenantId });
    res.json({ success: true });
  } catch (error) {
    console.error('[NoteRoutes] DELETE /:id error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

/**
 * POST /api/v1/notes/upload
 * Validates file signature, uploads object to Backblaze B2 under tenant prefix,
 * and atomically persists file metadata. Cleans up orphaned B2 object if DB save fails.
 */
router.post('/upload', verifyToken, handleUpload, async (req, res) => {
  let uploadedS3Key = null;

  try {
    const { noteId, title, subject, resourceType, batchId, visibility } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    if (!noteId) return res.status(400).json({ error: 'Missing noteId' });

    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required for file upload.' });
    }

    const isStaff = isEducatorOrAdmin(req.user.role);

    // File-Type Magic Byte Validation
    const type = await fileTypeFromBuffer(req.file.buffer);
    const isTextFallback = [
      'text/plain', 
      'text/markdown', 
      'text/x-python', 
      'application/x-python-code', 
      'application/json'
    ].includes(req.file.mimetype) ||
      req.file.originalname.endsWith('.py') ||
      req.file.originalname.endsWith('.md') ||
      req.file.originalname.endsWith('.txt') ||
      req.file.originalname.endsWith('.json');
    
    if (!type && !isTextFallback) {
      return res.status(400).json({ error: 'File validation failed: Unknown or disallowed file signature.' });
    }

    if (type) {
      const allowedExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'png', 'jpeg'];
      if (!allowedExts.includes(type.ext)) {
        return res.status(400).json({ error: `File validation failed: Detected format "${type.ext}" is not allowed.` });
      }

      // If user uploaded a file claiming to be a PDF, ensure magic bytes actually match PDF
      if (req.file.originalname.toLowerCase().endsWith('.pdf') && type.ext !== 'pdf') {
        return res.status(400).json({ error: 'File signature mismatch: File claimed to be PDF but magic bytes did not match.' });
      }
    }

    // Validate batch ownership if batchId is provided
    let verifiedBatchId = null;
    if (batchId && batchId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ error: 'Invalid class/batch ID.' });
      }
      const batchDoc = await Batch.findOne({ _id: batchId, tenantId });
      if (!batchDoc) {
        return res.status(400).json({ error: 'Selected class does not belong to your institution.' });
      }
      verifiedBatchId = batchDoc._id;
    }

    // Find or prepare note document
    let note = await Note.findOne({ id: noteId, tenantId });
    if (!note) {
      const isShared = isStaff && visibility !== 'private';
      note = new Note({
        id: noteId,
        title: title || req.file.originalname,
        owner: req.user._id,
        tenantId,
        visibility: isShared ? 'batch-shared' : 'private',
        batchId: verifiedBatchId,
        subject: subject || '',
        resourceType: resourceType || 'Study Material',
        createdAt: new Date().toISOString()
      });
    } else {
      if (note.owner.toString() !== req.user._id.toString() && !isStaff) {
        return res.status(403).json({ error: 'Forbidden. You do not own this note.' });
      }
      if (title) note.title = title;
      if (subject) note.subject = subject;
      if (resourceType) note.resourceType = resourceType;
      if (verifiedBatchId !== undefined) note.batchId = verifiedBatchId;
    }

    // Enforce storage availability
    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'STORAGE_NOT_CONFIGURED',
        message: 'Backblaze B2 object storage is not configured or uses placeholder credentials.'
      });
    }

    // Strictly isolated key pattern: tenants/:tenantId/materials/:noteId/:uuid-:filename
    const sanitizedName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `tenants/${tenantId}/materials/${noteId}/${crypto.randomUUID()}-${sanitizedName}`;

    // Upload to Backblaze B2
    await uploadObject({
      key: fileKey,
      body: req.file.buffer,
      contentType: req.file.mimetype,
      metadata: {
        tenantId: tenantId.toString(),
        uploadedBy: req.user._id.toString(),
        noteId: String(noteId)
      }
    });

    uploadedS3Key = fileKey;

    const fileMeta = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      s3Key: fileKey,
      uploadDate: new Date()
    };

    note.files.push(fileMeta);

    // Save metadata with atomic rollback if MongoDB persistence fails
    try {
      await note.save();
    } catch (dbErr) {
      console.error('[NoteRoutes] MongoDB metadata save failed after B2 upload. Attempting rollback cleanup...', dbErr);
      try {
        await deleteObject({ key: fileKey });
        console.warn(`[Storage] Rollback successful: Removed orphaned B2 object ${fileKey}.`);
      } catch (cleanupErr) {
        console.error(`[Storage CRITICAL] Failed to rollback orphaned B2 object ${fileKey}:`, cleanupErr.message);
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to persist file metadata. Object cleanup was performed to prevent orphaned storage.'
      });
    }

    return res.status(201).json({ success: true, note, file: fileMeta });
  } catch (error) {
    console.error('[NoteRoutes] Upload Error:', error);
    // If uploadObject failed or previous step failed, no document was updated
    res.status(500).json({ success: false, error: error.message || 'File upload failed' });
  }
});

/**
 * GET /api/v1/notes/:noteId/files/download?key=... OR /:noteId/files/:s3Key/download
 * Generates a short-lived presigned download URL after verifying user authorization.
 */
const handleDownloadRequest = async (req, res) => {
  try {
    const { noteId } = req.params;
    const s3Key = req.params.s3Key || req.query.key;
    if (!s3Key) return res.status(400).json({ error: 'Missing S3 key' });

    const note = await Note.findOne({ id: noteId, tenantId: req.tenantId });
    if (!note) {
      return res.status(404).json({ error: 'Study material or note not found.' });
    }

    // Verify the requested key actually belongs to this note
    const fileExistsInNote = note.files.some(f => f.s3Key === s3Key);
    if (!fileExistsInNote) {
      return res.status(404).json({ error: 'Requested attachment is not associated with this document.' });
    }

    const isStaff = isEducatorOrAdmin(req.user.role);
    const isOwner = note.owner.toString() === req.user._id.toString();

    // Authorization checks:
    // 1. Staff and document owners have access
    // 2. If student: material must be batch-shared AND student must belong to matching batch (or tenant-wide)
    if (!isStaff && !isOwner) {
      if (note.visibility !== 'batch-shared') {
        return res.status(403).json({ error: 'Access denied: Note is private.' });
      }

      if (note.batchId) {
        const studentBatchId = req.user.batchId ? req.user.batchId.toString() : null;
        if (!studentBatchId || studentBatchId !== note.batchId.toString()) {
          return res.status(403).json({ error: 'Access denied: Material is restricted to a different class.' });
        }
      }
    }

    if (!isStorageConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'STORAGE_NOT_CONFIGURED',
        message: 'Backblaze B2 storage is not configured.'
      });
    }

    const signedUrl = await getPresignedDownloadUrl({ key: s3Key, expiresInSeconds: 3600 });
    return res.json({ success: true, url: signedUrl, expiresInSeconds: 3600 });
  } catch (error) {
    console.error('[NoteRoutes] Download URL error:', error);
    res.status(500).json({ error: 'Failed to generate download link' });
  }
};

router.get('/:noteId/files/download', verifyToken, handleDownloadRequest);
router.get('/:noteId/files/:s3Key/download', verifyToken, handleDownloadRequest);

/**
 * DELETE /api/v1/notes/:noteId/files
 * Deletes a single attachment from B2 and updates note document
 */
router.delete('/:noteId/files', verifyToken, async (req, res) => {
  try {
    const s3Key = req.query.key;
    if (!s3Key) return res.status(400).json({ error: 'Missing S3 key' });

    const note = await Note.findOne({ id: req.params.noteId, tenantId: req.tenantId });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const isStaff = isEducatorOrAdmin(req.user.role);
    if (note.owner.toString() !== req.user._id.toString() && !isStaff) {
      return res.status(403).json({ error: 'Forbidden. Only owner or educator can delete attachments.' });
    }

    if (isStorageConfigured()) {
      try {
        await deleteObject({ key: s3Key });
      } catch (err) {
        console.warn('⚠️ [Storage] Failed to delete remote object from bucket:', err.message);
      }
    }

    note.files = note.files.filter(f => f.s3Key !== s3Key);
    await note.save();
    res.json({ success: true, note });
  } catch (error) {
    console.error('[NoteRoutes] Attachment Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
