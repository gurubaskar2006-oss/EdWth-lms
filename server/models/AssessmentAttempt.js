import mongoose from 'mongoose';

const assessmentAttemptSchema = new mongoose.Schema({
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
  assessmentTitle: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    default: 'Python Programming'
  },
  attemptNumber: {
    type: Number,
    default: 1
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  studentIdentifier: String,
  studentName: String,
  className: String,
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'submitted', 'evaluated', 'missed', 'disqualified', 'result_published'],
    default: 'submitted'
  },
  score: {
    type: Number,
    default: null
  },
  maxScore: {
    type: Number,
    default: 100
  },
  percentage: {
    type: Number,
    default: null
  },
  timeUsedMinutes: {
    type: Number,
    default: 0
  },
  violationCount: {
    type: Number,
    default: 0
  },
  integrityStatus: {
    type: String,
    enum: ['normal', 'attention_required', 'review_required'],
    default: 'normal'
  },
  answers: [mongoose.Schema.Types.Mixed],
  questionResults: [mongoose.Schema.Types.Mixed],
  teacherFeedback: String
}, { timestamps: true });

assessmentAttemptSchema.index({ tenantId: 1, assessmentId: 1, studentId: 1 });
assessmentAttemptSchema.index({ tenantId: 1, assessmentId: 1, studentId: 1, attemptNumber: 1 }, { unique: true });

export default mongoose.models.AssessmentAttempt || mongoose.model('AssessmentAttempt', assessmentAttemptSchema);
