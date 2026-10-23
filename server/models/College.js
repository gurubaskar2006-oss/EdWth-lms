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
    enum: ['school', 'college'],
    default: 'college'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
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
    }
  }
}, { timestamps: true });

export default mongoose.models.College || mongoose.model('College', collegeSchema);
