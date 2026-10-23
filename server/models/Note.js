import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  id: { type: String, required: true },
  title: { type: String, default: 'Untitled Note' },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visibility: { 
    type: String, 
    enum: ['private', 'batch-shared'], 
    default: 'private' 
  },
  category: { type: String, default: 'General' },
  color: { type: String, default: 'emerald' },
  pinned: { type: Boolean, default: false },
  content: { type: String, default: '' },
  sourcePage: { type: String, default: 'Unknown' },
  createdAt: { type: String },
  updatedAt: { type: String },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null
  },
  subject: { type: String, default: '' },
  resourceType: { type: String, default: 'Study Material' },
  // File attachments metadata
  files: [{
    originalName: String,
    mimeType: String,
    size: Number,
    s3Key: String,
    uploadDate: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

noteSchema.index({ tenantId: 1, id: 1 }, { unique: true });
noteSchema.index({ tenantId: 1, owner: 1 });
noteSchema.index({ tenantId: 1, batchId: 1, visibility: 1 });

const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
export default Note;
