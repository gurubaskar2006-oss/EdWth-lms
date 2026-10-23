import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['submitted', 'graded', 'in_progress', 'needs_revision'],
    default: 'submitted'
  },
  studentName: String,
  studentIdentifier: String,
  submissionText: String,
  score: Number,
  feedback: String,
  submittedAt: {
    type: Date,
    default: Date.now
  },
  gradedAt: Date,
  submissionFile: String
}, { timestamps: true });

// Ensure a student only has one active submission per assignment
submissionSchema.index({ tenantId: 1, assignmentId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);
