import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'College',
    required: true
  },
  id: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  instructor: {
    name: String,
    role: String,
    avatar: String,
  },
  category: String,
  level: String,
  thumbnail: String,
  progress: {
    type: Number,
    default: 0,
  },
  totalModules: Number,
  completedModules: Number,
  nextUp: String,
  recentActivity: String,
  description: String,
  credits: Number,
  schedule: {
    days: [String],
    time: String,
    room: String,
  },
  className: String,
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  icon: String,
  color: String,
  currentTeachingTopic: {
    unitNumber: Number,
    unitTitle: String,
    unitName: String,
    topicNumber: Number,
    topicTitle: String,
    topicName: String,
    scheduledTime: String,
    teacherName: String,
    className: String,
    progressText: String
  },
  units: [
    {
      unitNumber: Number,
      title: String,
      description: String,
      topics: [
        {
          topicNumber: Number,
          title: String,
          description: String,
          lessons: [
            {
              title: String,
              whatIsIt: String,
              whyUseIt: String,
              syntax: String,
              example: String,
              explanation: [String],
              expectedOutput: String,
              commonMistakes: [String],
              tryItYourself: String,
              starterCode: String,
              practiceQuestion: String
            }
          ]
        }
      ]
    }
  ],
  syllabus: [
    {
      week: Number,
      topic: String,
      status: String,
    }
  ]
}, { timestamps: true });

courseSchema.index({ tenantId: 1, id: 1 }, { unique: true });
courseSchema.index({ tenantId: 1, code: 1 });

export default mongoose.models.Course || mongoose.model('Course', courseSchema);
