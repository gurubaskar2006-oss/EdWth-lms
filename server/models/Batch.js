import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  startDate: Date,
  endDate: Date,
  targetClass: {
    type: String,
    enum: ['Class 11', 'Class 12', 'General', 'Other'],
    default: 'Class 11'
  },
  sessionStartTime: {
    type: String,
    default: '11:00 AM'
  },
  sessionEndTime: {
    type: String,
    default: '12:00 PM'
  },
  scheduleDays: [{
    type: String,
    default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  }],
  assignedTrainers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  liveSessionNotes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'upcoming'],
    default: 'upcoming'
  },
  isCompleted: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

batchSchema.index({ tenantId: 1, name: 1 });

export default mongoose.model('Batch', batchSchema);
