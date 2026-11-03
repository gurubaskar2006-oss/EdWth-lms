/**
 * EdWth LMS — WebAuthn Challenge Storage
 * 6th Civilians Corporation
 *
 * Persists unpredictable, short-lived, single-use WebAuthn ceremony challenges.
 * Enforces TTL expiry (5 minutes) and single-use consumption.
 */

import mongoose from 'mongoose';

const webAuthnChallengeSchema = new mongoose.Schema(
  {
    challenge: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    purpose: {
      type: String,
      enum: ['registration', 'authentication'],
      required: true
    },
    expectedRPID: {
      type: String,
      required: true
    },
    expectedOrigin: {
      type: String,
      required: true
    },
    userVerification: {
      type: String,
      default: 'preferred'
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
      index: { expires: 0 } // MongoDB TTL index automatically purges expired challenges
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('WebAuthnChallenge', webAuthnChallengeSchema);

