/**
 * EdWth LMS — SuperAdmin Account Recovery Token Storage
 * 6th Civilians Corporation
 *
 * Persists secure SHA-256 hashes of single-use recovery tokens.
 * Enforces TTL expiry (15 minutes) and single-use consumption.
 * Never stores raw tokens.
 */

import mongoose from 'mongoose';

const recoveryTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    purpose: {
      type: String,
      default: 'superadmin_passkey_recovery'
    },
    consumed: {
      type: Boolean,
      default: false
    },
    consumedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically cleans up expired tokens
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('RecoveryToken', recoveryTokenSchema);

