import mongoose from 'mongoose';

const retakeAuthorizationSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true
    },
    assessmentId: {
      type: String,
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    targetAttemptNumber: {
      type: Number,
      required: true,
      default: 2
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'revoked'],
      default: 'pending',
      index: true
    },
    reason: {
      type: String,
      trim: true,
      default: 'Trainer-authorized re-examination'
    },
    authorizedAt: {
      type: Date,
      default: Date.now
    },
    usedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

retakeAuthorizationSchema.index({ tenantId: 1, assessmentId: 1, studentId: 1, status: 1 });

export default mongoose.models.RetakeAuthorization || mongoose.model('RetakeAuthorization', retakeAuthorizationSchema);
