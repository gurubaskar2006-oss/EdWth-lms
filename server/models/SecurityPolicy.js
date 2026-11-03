import mongoose from 'mongoose';

const securityPolicySchema = new mongoose.Schema({
  // Global identifier - single document pattern for platform-wide policies
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'global_security_policy'
  },
  mfaPolicy: {
    superAdminMfaEnforced: {
      type: Boolean,
      default: true
    },
    requireAdminMfa: {
      type: Boolean,
      default: true
    },
    requireTrainerMfa: {
      type: Boolean,
      default: false
    }
  },
  passwordPolicy: {
    minLength: {
      type: Number,
      default: 12,
      min: 8,
      max: 64
    },
    requireUppercase: {
      type: Boolean,
      default: true
    },
    requireLowercase: {
      type: Boolean,
      default: true
    },
    requireNumbers: {
      type: Boolean,
      default: true
    },
    requireSpecialChars: {
      type: Boolean,
      default: true
    },
    maxAgeDays: {
      type: Number,
      default: 90
    }
  },
  sessionPolicy: {
    sessionTimeoutMinutes: {
      type: Number,
      default: 120,
      min: 15,
      max: 1440
    },
    idleTimeoutMinutes: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440
    },
    maxConcurrentSessions: {
      type: Number,
      default: 3,
      min: 1,
      max: 10
    },
    enforceIpBinding: {
      type: Boolean,
      default: false
    }
  },
  tenantPolicy: {
    strictTenantIsolation: {
      type: Boolean,
      default: true
    },
    allowCrossTenantViewing: {
      type: Boolean,
      default: false
    }
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  lastUpdatedByEmail: {
    type: String,
    default: 'System Default'
  }
}, { timestamps: true });

export default mongoose.models.SecurityPolicy || mongoose.model('SecurityPolicy', securityPolicySchema);

