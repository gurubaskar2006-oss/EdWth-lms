/**
 * EdWth LMS — Passkey (WebAuthn) Credential Model
 * 6th Civilians Corporation
 *
 * Persists registered WebAuthn public keys, credential IDs, authenticator metadata,
 * counters (for clone/replay protection), and device labels.
 *
 * NEVER stores private keys.
 */

import mongoose from 'mongoose';

const passkeySchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    publicKey: {
      type: String, // Base64URL encoded public key
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    counter: {
      type: Number,
      required: true,
      default: 0
    },
    deviceType: {
      type: String,
      enum: ['singleDevice', 'multiDevice', 'unknown'],
      default: 'singleDevice'
    },
    backedUp: {
      type: Boolean,
      default: false
    },
    transports: {
      type: [String],
      default: []
    },
    deviceLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    aaguid: {
      type: String,
      default: null
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Prevent exposing public key material unnecessarily in general serialization
passkeySchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.publicKey;
    return ret;
  }
});

passkeySchema.set('toObject', {
  transform: function (doc, ret) {
    delete ret.publicKey;
    return ret;
  }
});

export default mongoose.model('Passkey', passkeySchema);

