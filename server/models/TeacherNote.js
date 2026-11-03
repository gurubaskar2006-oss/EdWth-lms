import mongoose from 'mongoose';

const teacherNoteSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: true,
    index: true
  },
  studentId: {
    type: String,
    required: true,
    index: true
  },
  teacherId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure efficient querying, tenant isolation, and single note per student
teacherNoteSchema.index({ tenantId: 1, studentId: 1 }, { unique: true });

const TeacherNote = mongoose.models.TeacherNote || mongoose.model('TeacherNote', teacherNoteSchema);

export default TeacherNote;
