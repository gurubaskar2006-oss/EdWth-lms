/**
 * EdWth LMS — Email OTP Storage
 * 6th Civilians Corporation
 *
 * Persists secure cryptographic hashes of email OTP codes.
 * Features:
 * - Stores ONLY salted SHA-256 hashes of OTP codes (never plaintext).
 * - Enforces single-use consumption and attempt rate limiting (max 5 attempts).
 * - Enforces resend cooldown (60 seconds) and TTL auto-purge (5 minutes).
 * - Bound strictly to account ID, email destination, and ceremony purpose.
 */

import mongoose from 'mongoose';

const emailOtpSchema = new mongoose.Schema(
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
    purpose: {
      type: String,
      enum: ['superadmin_step_up', 'email_verification', 'account_recovery', 'passkey_enrollment'],
      required: true
    },
    otpHash: {
      type: String,
      required: true
    },
    salt: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    resendAfter: {
      type: Date,
      required: true
    },
    consumed: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 } // TTL index automatically cleans up expired OTPs
    }
  },
  {
    timestamps: true
  }
);

emailOtpSchema.index({ userId: 1, purpose: 1, consumed: 1 });

export default mongoose.model('EmailOtp', emailOtpSchema);

