import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    default: 'application/octet-stream'
  },
  size: {
    type: Number,
    default: 0
  },
  s3Key: {
    type: String,
    required: true
  },
  url: {
    type: String,
    default: ''
  }
}, { _id: true, timestamps: true });

const announcementSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: function() {
      return !this.isPlatformWide;
    },
    default: null,
    index: true
  },
  isPlatformWide: {
    type: Boolean,
    default: false,
    index: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null,
    index: true
  },
  batchName: {
    type: String,
    default: 'All Classes'
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['normal', 'important', 'urgent', 'high', 'low'],
    default: 'normal'
  },
  badge: {
    type: String,
    default: 'Notice'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
    index: true
  },
  attachments: [attachmentSchema],
  publishedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound indexes for tenant-isolated announcement lookups
announcementSchema.index({ tenantId: 1, status: 1, publishedAt: -1 });
announcementSchema.index({ tenantId: 1, batchId: 1, status: 1 });
announcementSchema.index({ isPlatformWide: 1, status: 1, publishedAt: -1 });

const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

export default Announcement;
