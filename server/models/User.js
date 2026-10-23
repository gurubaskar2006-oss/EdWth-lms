import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'trainer', 'admin', 'superadmin'],
    default: 'student'
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    default: null
  },
  isTwoFactorEnabled: {
    type: Boolean,
    default: false
  },
  mfaEnforced: {
    type: Boolean,
    default: false
  },
  mfaSetupRequired: {
    type: Boolean,
    default: false
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String
  },
  twoFactorBackupCodes: [{
    type: String
  }],
  soft_deleted: {
    type: Boolean,
    default: false
  },
  avatar: String,
  major: String,
  department: String,
  university: String,
  year: String,
  className: String,
  schoolName: String,
  streakDays: {
    type: Number,
    default: 0
  },
  xp: {
    type: Number,
    default: 0
  },
  level: String,
  status: String,
  accountStatus: {
    type: String,
    default: 'Active'
  },
  phone: String,
  address: String,
  emergencyContact: {
    name: String,
    phone: String,
    relationship: String
  },
  lastLogin: Date,
  joinedDate: Date,
  enrolledCourses: [String],
  stats: {
    gpa: String,
    termGpa: String,
    completedCredits: Number,
    totalCredits: Number,
    totalStudyHours: Number,
    assignmentCompletionRate: Number
  }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.twoFactorSecret;
    delete ret.twoFactorBackupCodes;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.twoFactorSecret;
    delete ret.twoFactorBackupCodes;
    return ret;
  }
});

userSchema.index({ tenantId: 1, email: 1 }, { unique: true, partialFilterExpression: { tenantId: { $exists: true } } });
userSchema.index({ tenantId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { tenantId: { $exists: true } } });

export default mongoose.model('User', userSchema);
