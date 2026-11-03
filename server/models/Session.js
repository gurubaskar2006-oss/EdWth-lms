/**
 * Lumina LMS — Server-Enforced Session Model
 * 6th Civilians Corporation
 *
 * Persists active user sessions for server-side validation, concurrent session
 * limit enforcement, idle/absolute timeout verification, and instant revocation.
 */

import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  role: {
    type: String,
    required: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    default: null
  },
  userAgent: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revocationReason: {
    type: String,
    enum: [
      'logout',
      'password_change',
      'concurrent_limit_exceeded',
      'expired',
      'idle_timeout',
      'security_event',
      'admin_revocation',
      null
    ],
    default: null
  }
}, { timestamps: true });

// Auto-purge sessions 7 days after absolute expiration
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 86400 });

// Compound index for querying active sessions by user
sessionSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });

export default mongoose.models.Session || mongoose.model('Session', sessionSchema);
