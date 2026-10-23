import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: false,
    default: null
  },
  isPlatform: {
    type: Boolean,
    default: false
  },
  actor: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, default: null },
    role: { type: String, required: true },
    email: { type: String }
  },
  action: {
    type: String,
    required: true
  },
  targetRecord: {
    type: mongoose.Schema.Types.ObjectId
  },
  targetModel: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Mongoose-level immutability enforcement: audit records can be appended, but never modified
auditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function(next) {
  const err = new Error('Security Violation: AuditLog records are immutable and cannot be modified.');
  if (typeof next === 'function') return next(err);
  throw err;
});

// AuditLog deletion is strictly prohibited: audit logs are append-only
auditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndRemove'], function(next) {
  const err = new Error('Security Violation: AuditLog deletion is prohibited. Audit logs are append-only.');
  if (typeof next === 'function') return next(err);
  throw err;
});

auditLogSchema.index({ tenantId: 1, action: 1 });
auditLogSchema.index({ tenantId: 1, timestamp: -1 });
auditLogSchema.index({ isPlatform: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
