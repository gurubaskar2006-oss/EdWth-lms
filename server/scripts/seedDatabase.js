import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import User from '../models/User.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Grade from '../models/Grade.js';
import College from '../models/College.js';

// Since mockData uses React/frontend imports (like canvas-confetti), importing it directly in Node might crash if it has frontend-only imports at the top.
// Wait, mockData.js has NO frontend imports! It only exports data.
import { COURSES, ASSIGNMENTS, STUDENTS_DATA_SHEET, GRADES_DATA } from '../../src/data/mockData.js';

dotenv.config({ path: './server/.env' });

const seedDatabase = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing in .env');
    }
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Clear existing data
    console.log('Clearing existing data...');
    await College.deleteMany({});
    await User.deleteMany({});
    await Course.deleteMany({});
    await Assignment.deleteMany({});
    await Grade.deleteMany({});

    // 1.5 Create Default Tenant
    console.log('Creating Default Tenant...');
    const defaultTenant = await College.create({
      name: 'Nexus College',
      code: 'NEXUS-01',
      slug: 'nexus-college',
      settings: {
        branding: { primaryColor: '#2563eb' },
        contact: { email: 'admin@nexus.edu' }
      }
    });
    const tenantId = defaultTenant._id;

    // 2. Seed Users
    console.log('Seeding Users...');
    for (const student of STUDENTS_DATA_SHEET) {
      const hashedPassword = await bcrypt.hash(student.password || 'password123', 10);
      await User.create({
        tenantId,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
        password: hashedPassword,
        role: student.role.toLowerCase().includes('admin') || student.role.toLowerCase().includes('instructor') ? 'admin' : 'student',
        avatar: student.avatar,
        major: student.major,
        department: student.department,
        year: student.year
      });
    }

    // 3. Seed Courses
    console.log('Seeding Courses...');
    const coursesWithTenant = COURSES.map(c => ({ ...c, tenantId }));
    await Course.insertMany(coursesWithTenant);

    // 4. Seed Assignments
    console.log('Seeding Assignments...');
    const assignmentsWithTenant = ASSIGNMENTS.map(a => ({ ...a, tenantId }));
    await Assignment.insertMany(assignmentsWithTenant);

    // 5. Seed Grades
    // Mock data only has one GRADES_DATA object. We'll assign it to a default user (Maya Lin).
    console.log('Seeding Grades...');
    const defaultUser = await User.findOne({ email: 'maya.lin@nexus.edu' });
    if (defaultUser) {
      await Grade.create({
        tenantId,
        studentId: defaultUser.studentId,
        ...GRADES_DATA
      });
    } else {
      // If Maya Lin doesn't exist, just assign it to the first user
      const firstUser = await User.findOne({});
      if (firstUser) {
         await Grade.create({
          tenantId,
          studentId: firstUser.studentId,
          ...GRADES_DATA
        });
      }
    }

    console.log('🎉 Database Seeded Successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
