import mongoose from 'mongoose';

const studentProgressSchema = new mongoose.Schema(
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
    studentIdentifier: {
      type: String,
      default: ''
    },
    courseId: {
      type: String,
      required: true,
      index: true
    },
    completedTopics: [
      {
        unitNumber: { type: Number, required: true },
        topicNumber: { type: Number, required: true },
        topicTitle: { type: String, default: '' },
        completedAt: { type: Date, default: Date.now }
      }
    ],
    lastActiveTopic: {
      unitNumber: Number,
      topicNumber: Number,
      topicTitle: String
    },
    lastActivityAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

studentProgressSchema.index({ tenantId: 1, studentId: 1, courseId: 1 }, { unique: true });

export default mongoose.models.StudentProgress || mongoose.model('StudentProgress', studentProgressSchema);
