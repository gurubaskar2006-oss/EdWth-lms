import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  studentId: {
    type: String,
    required: true,
  },
  cumulativeGpa: Number,
  termGpa: Number,
  academicStanding: String,
  creditsAttempted: Number,
  creditsEarned: Number,
  courses: [
    {
      code: String,
      name: String,
      credits: Number,
      grade: String,
      score: Number,
      classAvg: Number,
      rank: String,
      breakdown: [
        {
          item: String,
          weight: String,
          score: mongoose.Schema.Types.Mixed // can be Number or String like "In Grading"
        }
      ]
    }
  ]
}, { timestamps: true });

gradeSchema.index({ tenantId: 1, studentId: 1 });

export default mongoose.models.Grade || mongoose.model('Grade', gradeSchema);
