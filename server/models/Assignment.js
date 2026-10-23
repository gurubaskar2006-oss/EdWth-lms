import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  id: String,
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
  },
  batchName: String,
  trainerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  title: {
    type: String,
    required: true
  },
  courseId: String,
  courseCode: String,
  courseTitle: String,
  subject: String,
  topic: String,
  dueDate: Date,
  dueRelative: String,
  priority: String,
  status: {
    type: String,
    default: 'published'
  },
  points: Number,
  score: Number,
  weight: String,
  description: String,
  requirements: [String],
  attachments: [{
    name: String,
    url: String,
    key: String,
    size: Number,
    mimeType: String
  }],
  submissionFile: String,
  submittedAt: Date,
  feedback: String
}, { timestamps: true });

assignmentSchema.index({ tenantId: 1, courseId: 1 });

export default mongoose.model('Assignment', assignmentSchema);
