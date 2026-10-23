import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  authorRole: {
    type: String,
    enum: ['trainer', 'admin', 'student'],
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const doubtSchema = new mongoose.Schema({
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
    required: true
  },
  studentIdNumber: {
    type: String,
    default: ''
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  teacherName: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  courseId: {
    type: String,
    default: null
  },
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
  topic: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  codeSnippet: {
    type: String,
    default: '',
    maxlength: 5000
  },
  status: {
    type: String,
    enum: ['submitted', 'pending', 'answered', 'resolved'],
    default: 'submitted',
    index: true
  },
  response: {
    type: String,
    default: ''
  },
  repliedAt: {
    type: Date,
    default: null
  },
  replies: [replySchema]
}, { timestamps: true });

// Compound indexes for tenant-isolated lookups
doubtSchema.index({ tenantId: 1, studentId: 1, createdAt: -1 });
doubtSchema.index({ tenantId: 1, teacherId: 1, status: 1, createdAt: -1 });
doubtSchema.index({ tenantId: 1, batchId: 1, createdAt: -1 });

const Doubt = mongoose.models.Doubt || mongoose.model('Doubt', doubtSchema);

export default Doubt;
