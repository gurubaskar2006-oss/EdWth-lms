/**
 * Lumina LMS — Resumable Deletion Job Model
 * 6th Civilians Corporation
 *
 * Tracks the durable execution of multi-collection cascade deletions.
 * Guarantees progress persistence, retryability after system restarts,
 * and prevents premature completion marking while dependent records remain.
 */

import mongoose from 'mongoose';

const completedStageSchema = new mongoose.Schema({
  stage: { type: String, required: true },
  collectionName: { type: String, required: true },
  deletedCount: { type: Number, default: 0 },
  completedAt: { type: Date, default: Date.now }
}, { _id: false });

const deletionJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    default: null,
    index: true
  },
  targetModel: {
    type: String,
    required: true,
    enum: ['User', 'Course', 'Batch'],
    index: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  targetIdentifier: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  currentStage: {
    type: String,
    default: 'init'
  },
  completedStages: [completedStageSchema],
  failedStage: {
    stage: { type: String },
    error: { type: String },
    failedAt: { type: Date }
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  actor: {
    userId: { type: String },
    role: { type: String },
    email: { type: String }
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

deletionJobSchema.index({ tenantId: 1, targetModel: 1, targetId: 1 });
deletionJobSchema.index({ status: 1, createdAt: -1 });

const DeletionJob = mongoose.models.DeletionJob || mongoose.model('DeletionJob', deletionJobSchema);

export default DeletionJob;

