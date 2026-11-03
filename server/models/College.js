import mongoose from 'mongoose';

const collegeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  institutionType: {
    type: String,
    enum: ['school', 'college', 'unconfigured'],
    default: null
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'archived'],
    default: 'active'
  },
  settings: {
    branding: {
      logoUrl: String,
      primaryColor: { type: String, default: '#0066cc' },
      theme: { type: String, default: 'light' }
    },
    contact: {
      email: String,
      phone: String,
      address: String,
      helpline: String,
      academicOffice: String,
      counselor: String
    },
    features: {
      enableAssessments: { type: Boolean, default: true },
      enableForums: { type: Boolean, default: true }
    },
    academicConfig: {
      academicSession: { type: String, default: null },
      classesOffered: { type: [String], default: ['Class 11', 'Class 12'] },
      groups: [{
        id: String,
        code: String,
        name: String,
        stream: String,
        subjects: [String],
        description: String
      }],
      sections: { type: [String], default: ['A', 'B', 'C'] },
      mediums: { type: [String], default: ['English'] },
      trainingSubjects: { type: [String], default: [] },
      trainingSchedules: [{
        cohortName: String,
        targetClass: String,
        days: [String],
        startTime: String,
        endTime: String
      }],
      minimumAttendance: { type: Number, default: null },
      evaluationSlaHours: { type: Number, default: null },
      gradingScale: [{
        grade: String,
        minPercentage: Number,
        maxPercentage: Number,
        gpa: Number,
        label: String
      }]
    }
  }
}, { timestamps: true });

export default mongoose.models.College || mongoose.model('College', collegeSchema);
