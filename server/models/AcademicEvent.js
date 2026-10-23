import mongoose from 'mongoose';

const AcademicEventSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      required: true,
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    eventType: {
      type: String,
      enum: ['class', 'homework', 'test', 'announcement', 'academic_event'],
      required: true,
      default: 'class'
    },
    subject: {
      type: String,
      default: 'General'
    },
    description: {
      type: String,
      default: ''
    },
    room: {
      type: String,
      default: 'Room 102'
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date,
      required: true
    },
    dateStr: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'rescheduled', 'cancelled', 'completed'],
      default: 'scheduled'
    },
    cancellationReason: {
      type: String,
      default: ''
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    creatorName: {
      type: String,
      default: 'Faculty'
    },
    linkedRecordId: {
      type: String,
      default: null
    },
    linkedRecordType: {
      type: String,
      enum: ['Assignment', 'Assessment', null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast tenant date queries
AcademicEventSchema.index({ tenantId: 1, dateStr: 1 });
AcademicEventSchema.index({ tenantId: 1, batchId: 1, dateStr: 1 });

const AcademicEvent = mongoose.models.AcademicEvent || mongoose.model('AcademicEvent', AcademicEventSchema);

export default AcademicEvent;
