import mongoose from 'mongoose';

const assessmentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true,
    index: true
  },
  id: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    default: 'Python Programming'
  },
  courseId: String,
  courseCode: String,
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null,
    index: true
  },
  className: {
    type: String,
    default: ''
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    default: '10:00 - 10:45 AM'
  },
  room: {
    type: String,
    default: 'Coding Lab 1'
  },
  totalMarks: {
    type: Number,
    default: 20
  },
  durationMinutes: {
    type: Number,
    default: 45
  },
  isCodingExam: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  description: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    enum: ['python', 'cpp', 'c++', 'sql', 'mixed'],
    default: 'python'
  },
  questions: [{
    id: { type: String, required: true },
    type: { type: String, enum: ['mcq', 'coding', 'sql', 'descriptive'], default: 'coding' },
    title: { type: String, default: '' },
    prompt: { type: String, required: true },
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
  challenge: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

assessmentSchema.index({ tenantId: 1, id: 1 }, { unique: true });

const Assessment = mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);

export default Assessment;
