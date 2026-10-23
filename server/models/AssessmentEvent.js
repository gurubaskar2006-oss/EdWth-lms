import mongoose from 'mongoose';

const assessmentEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    studentName: {
      type: String,
      default: 'Student'
    },
    studentIdentifier: {
      type: String,
      default: ''
    },
    className: {
      type: String,
      default: ''
    },
    assessmentId: {
      type: String,
      required: true,
      index: true
    },
    assessmentTitle: {
      type: String,
      default: 'Assessment'
    },
    assessmentSessionId: {
      type: String,
      index: true
    },
    attemptNumber: {
      type: Number,
      default: 1
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'FULLSCREEN_EXIT',
        'FULLSCREEN_ENTERED',
        'TAB_OR_WINDOW_HIDDEN',
        'TAB_RETURNED',
        'WINDOW_BLUR',
        'WINDOW_FOCUS',
        'PRINT_ATTEMPT',
        'SAVE_ATTEMPT',
        'DEVTOOLS_SHORTCUT',
        'COPY_ATTEMPT',
        'PASTE_ATTEMPT',
        'ASSESSMENT_SUBMITTED',
        'ASSESSMENT_AUTO_SUBMITTED',
        'MAX_WARNINGS_EXCEEDED',
        'ASSESSMENT_FORCE_TERMINATED',
        'SESSION_EXPIRED'
      ]
    },
    severity: {
      type: String,
      enum: ['info', 'low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

assessmentEventSchema.index({ tenantId: 1, assessmentId: 1, timestamp: -1 });

export default mongoose.model('AssessmentEvent', assessmentEventSchema);
