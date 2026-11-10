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
  questions: [{
    id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    type: { type: String, enum: ['mcq', 'coding', 'sql', 'descriptive', 'paragraph'], default: 'descriptive' },
    title: { type: String, default: '' },
    prompt: { type: String, default: '' },
    language: { type: String, default: 'python' },
    options: [{ type: String }],
    correctAnswer: { type: mongoose.Schema.Types.Mixed, default: null },
    starterCode: { type: String, default: '' },
    testCases: [{
      id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
      input: { type: String, default: '' },
      expectedOutput: { type: String, default: '' },
      isHidden: { type: Boolean, default: false },
      marks: { type: Number, default: 5 }
    }],
    marks: { type: Number, default: 10 }
  }],
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
assignmentSchema.index({ tenantId: 1, batchId: 1, title: 1 });

export default mongoose.model('Assignment', assignmentSchema);
