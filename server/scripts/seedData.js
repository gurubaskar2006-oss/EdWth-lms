import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from '../database/mongoose.js';
import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Attendance from '../models/Attendance.js';
import StudentProgress from '../models/StudentProgress.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import AcademicEvent from '../models/AcademicEvent.js';
import { PYTHON_SCHOOL_CURRICULUM } from '../data/pythonCurriculum.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

export const runSeed = async (options = {}) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: Automatic demo seeding is strictly prohibited in production.');
  }

  const isTest = process.env.NODE_ENV === 'test';
  if (process.env.ALLOW_SEED !== 'true' && !options.force && !isTest) {
    console.log('ℹ️ [Seed Guard] Seeding bypassed: set ALLOW_SEED=true to run seed explicitly.');
    return;
  }

  const withAcademicDemo = options.withAcademicDemo ?? (process.env.SEED_DEMO_ACADEMIC === 'true');
  const withDemoStudents = options.withDemoStudents ?? (process.env.SEED_DEMO_STUDENTS === 'true');
  try {
    console.log(`Seeding environment (Demo Students: ${withDemoStudents ? 'ENABLED' : 'DISABLED'} | Academic Demo records: ${withAcademicDemo ? 'ENABLED' : 'DISABLED'})...`);

    // 1. College Tenant
    let defaultTenant = await College.findOne({ code: 'NEXUS' });
    if (!defaultTenant) {
      defaultTenant = await College.create({
        name: 'Nexus Institute of Technology',
        code: 'NEXUS',
        slug: 'nexus',
        institutionType: 'college',
        status: 'active'
      });
      console.log('✅ Default College Tenant created: Nexus Institute of Technology (college)');
    } else if (!defaultTenant.institutionType) {
      defaultTenant.institutionType = 'college';
      await defaultTenant.save();
    }

    // 1b. School Tenant
    let schoolTenant = await College.findOne({ code: 'OAKRIDGE' });
    if (!schoolTenant) {
      schoolTenant = await College.create({
        name: 'Oakridge High School',
        code: 'OAKRIDGE',
        slug: 'oakridge',
        institutionType: 'school',
        status: 'active'
      });
      console.log('✅ Default School Tenant created: Oakridge High School (school)');
    } else if (schoolTenant.institutionType !== 'school') {
      schoolTenant.institutionType = 'school';
      await schoolTenant.save();
    }

    // 2. Class / Batch for School
    let schoolBatch = await Batch.findOne({ tenantId: schoolTenant._id, name: 'Class 10 - Section A' });
    if (!schoolBatch) {
      schoolBatch = await Batch.create({
        tenantId: schoolTenant._id,
        name: 'Class 10 - Section A',
        status: 'active',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-05-30')
      });
      console.log('✅ School Batch created: Class 10 - Section A');
    }

    // 3. Admin Accounts
    const adminPass = await bcrypt.hash('Admin@123', 10);
    const adminExists = await User.findOne({ email: 'admin@nexus.edu' });
    if (!adminExists) {
      await User.create({
        studentId: 'ADMIN-001',
        name: 'System Administrator',
        email: 'admin@nexus.edu',
        password: adminPass,
        role: 'admin',
        accountStatus: 'Active',
        tenantId: defaultTenant._id
      });
      console.log('✅ Default Admin created: admin@nexus.edu / Admin@123');
    }

    let schoolAdmin = await User.findOne({ email: 'admin@oakridge.edu' });
    if (!schoolAdmin) {
      schoolAdmin = await User.create({
        studentId: 'SCH-ADMIN-001',
        name: 'Oakridge Principal & Admin',
        email: 'admin@oakridge.edu',
        password: adminPass,
        role: 'admin',
        accountStatus: 'Active',
        tenantId: schoolTenant._id
      });
      console.log('✅ School Admin created: admin@oakridge.edu / Admin@123');
    }

    // 4. Trainers / Teachers
    const trainerPass = await bcrypt.hash('Trainer@123', 10);
    const trainerExists = await User.findOne({ email: 'trainer@nexus.edu' });
    if (!trainerExists) {
      await User.create({
        studentId: 'TRAINER-001',
        name: 'Dr. Evelyn Reed',
        email: 'trainer@nexus.edu',
        password: trainerPass,
        role: 'trainer',
        accountStatus: 'Active',
        tenantId: defaultTenant._id
      });
      console.log('✅ Default Trainer created: trainer@nexus.edu / Trainer@123');
    }

    const teacherPass = await bcrypt.hash('Teacher@123', 10);
    let teacherUser = await User.findOne({ email: 'teacher@oakridge.edu' });
    if (!teacherUser) {
      teacherUser = await User.create({
        studentId: 'TEACHER-001',
        name: 'Sarah Jenkins',
        email: 'teacher@oakridge.edu',
        password: teacherPass,
        role: 'trainer',
        accountStatus: 'Active',
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id
      });
      console.log('✅ School Teacher created: teacher@oakridge.edu / Teacher@123');
    } else {
      teacherUser.batchId = schoolBatch._id;
      teacherUser.password = teacherPass;
      await teacherUser.save();
    }

    // 5. School Students in Class 10 - Section A (Demo Student Roster)
    const studentUserDocs = {};
    if (withDemoStudents) {
      const studentPass = await bcrypt.hash('Student#123!', 10);
      const studentsToSeed = [
        {
          studentId: 'SCH-2026-001',
          name: 'Leo Miller',
          email: 'leo.miller@oakridge.edu',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          university: 'Oakridge High School',
          year: '10th Standard',
          streakDays: 8,
          xp: 1250,
          level: '3',
          status: 'Active'
        },
        {
          studentId: 'SCH-2026-002',
          name: 'Samantha Lee',
          email: 'samantha.lee@oakridge.edu',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          university: 'Oakridge High School',
          year: '10th Standard',
          streakDays: 14,
          xp: 1980,
          level: '4',
          status: 'Active'
        },
        {
          studentId: 'SCH-2026-003',
          name: 'Daniel Wu',
          email: 'daniel.wu@oakridge.edu',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          university: 'Oakridge High School',
          year: '10th Standard',
          streakDays: 3,
          xp: 820,
          level: '2',
          status: 'Low Attendance'
        },
        {
          studentId: 'SCH-2026-004',
          name: 'Aisha Patel',
          email: 'aisha.patel@oakridge.edu',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          university: 'Oakridge High School',
          year: '10th Standard',
          streakDays: 20,
          xp: 2450,
          level: '5',
          status: 'Active'
        },
        {
          studentId: 'SCH-2026-005',
          name: 'Maya Lin',
          email: 'maya.lin@oakridge.edu',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          university: 'Oakridge High School',
          year: '10th Standard',
          streakDays: 12,
          xp: 1650,
          level: '3',
          status: 'Active'
        }
      ];

      for (const stu of studentsToSeed) {
        let existing = await User.findOne({ email: stu.email });
        if (!existing) {
          existing = await User.create({
            ...stu,
            password: studentPass,
            role: 'student',
            accountStatus: 'Active',
            tenantId: schoolTenant._id,
            batchId: schoolBatch._id
          });
          console.log(`✅ Seeded student: ${stu.name} (${stu.email})`);
        } else {
          existing.tenantId = schoolTenant._id;
          existing.batchId = schoolBatch._id;
          existing.role = 'student';
          existing.password = studentPass;
          await existing.save();
        }
        studentUserDocs[stu.studentId] = existing;
      }
    } else {
      console.log('ℹ️ School demo students skipped (SEED_DEMO_STUDENTS is false). Clean zero-demo environment preserved.');
    }

    if (withDemoStudents) {
      // 6. Migrate existing college students (Foundational accounts)
    const dataPath = path.join(__dirname, '..', 'data', 'students_master_datasheet.json');
    let legacyStudents = [];
    if (fs.existsSync(dataPath)) {
      const content = fs.readFileSync(dataPath, 'utf-8');
      legacyStudents = JSON.parse(content);
    }

    for (const s of legacyStudents) {
      const existing = await User.findOne({ 
        $or: [{ studentId: s.studentId }, { email: s.email }] 
      });
      if (!existing) {
        const hashedPass = await bcrypt.hash(s.password || 'password123', 10);
        let assignedRole = 'student';
        if (s.role && (s.role.toLowerCase().includes('admin') || s.role.toLowerCase().includes('instructor') || s.role.toLowerCase().includes('trainer'))) {
          assignedRole = 'trainer';
        }
        
        try {
          await User.create({
            studentId: s.studentId,
            name: s.name,
            email: s.email,
            password: hashedPass,
            role: assignedRole,
            tenantId: defaultTenant._id,
            avatar: s.avatar,
            major: s.major,
            department: s.department,
            university: s.university,
            year: s.year,
            streakDays: s.streakDays,
            xp: s.xp,
            level: s.level,
            status: s.status,
            accountStatus: s.accountStatus,
            phone: s.phone,
            lastLogin: s.lastLogin ? new Date(s.lastLogin) : null,
            joinedDate: s.joinedDate ? new Date(s.joinedDate) : null,
            enrolledCourses: s.enrolledCourses || [],
            stats: s.stats || {}
          });
          console.log(`✅ Migrated foundational user: ${s.email}`);
        } catch (insertErr) {
          if (insertErr.code !== 11000) throw insertErr;
        }
      } else if (!existing.tenantId) {
        existing.tenantId = defaultTenant._id;
        await existing.save();
      }
    }
  } else {
    console.log('ℹ️ Legacy college demo students skipped (SEED_DEMO_STUDENTS is false). Clean foundational environment preserved.');
  }

    if (!withAcademicDemo) {
      console.log('ℹ️ Demo academic transactional records skipped (SEED_DEMO_ACADEMIC is false). Clean runtime environment preserved.');
      console.log('🎉 Foundational Seeding complete (Tenants, Batches, Users ready for genuine testing)!');
      return;
    }

    console.log('🚀 SEED_DEMO_ACADEMIC is true. Populating optional demo academic transactions...');

    // 6b. Seed Subjects / Courses with Real Curriculum (Demo only)
    const totalPythonTopics = PYTHON_SCHOOL_CURRICULUM.reduce((sum, u) => sum + u.topics.length, 0);

    const pythonCourseData = {
      tenantId: schoolTenant._id,
      id: 'sub-py-1',
      code: 'CS-101',
      title: 'Python Programming',
      category: 'Computer Science',
      level: 'Secondary',
      className: 'Class 10 - Section A',
      instructor: {
        name: 'Mr. David Miller',
        role: 'Computer Science Educator',
        avatar: '👨‍🏫'
      },
      schedule: {
        days: ['Monday', 'Wednesday', 'Friday'],
        time: '10:00 AM - 11:00 AM',
        room: 'Coding Lab 1'
      },
      icon: '🐍',
      color: '#2563EB',
      currentTeachingTopic: {
        unitNumber: 7,
        unitTitle: 'Functions',
        topicNumber: 2,
        topicTitle: 'Parameters & Arguments',
        scheduledTime: 'Today, 10:00 AM',
        teacherName: 'Mr. David Miller',
        className: 'Class 10 - Section A',
        progressText: 'Unit 7 — Topic 2 of 3'
      },
      totalModules: PYTHON_SCHOOL_CURRICULUM.length,
      units: PYTHON_SCHOOL_CURRICULUM,
      description: 'Comprehensive K-12 Python curriculum from basic syntax and types through functions, collections, and problem solving.'
    };

    await Course.findOneAndUpdate(
      { tenantId: schoolTenant._id, id: 'sub-py-1' },
      pythonCourseData,
      { upsert: true, new: true }
    );
    console.log(`✅ Seeded Python Curriculum: ${PYTHON_SCHOOL_CURRICULUM.length} Units, ${totalPythonTopics} Topics`);

    // Other School Subjects
    const otherSchoolSubjects = [
      {
        tenantId: schoolTenant._id,
        id: 'sub-sql-2',
        code: 'DB-102',
        title: 'SQL & Relational Databases',
        category: 'Database Systems',
        level: 'Secondary',
        className: 'Class 10 - Section A',
        instructor: { name: 'Mrs. Sarah Jenkins', role: 'Database Instructor', avatar: '👩‍🏫' },
        schedule: { days: ['Tuesday', 'Thursday'], time: '11:00 AM - 12:00 PM', room: 'Database Studio' },
        icon: '🗄️',
        color: '#059669',
        currentTeachingTopic: {
          unitNumber: 2,
          unitTitle: 'Relational Queries',
          topicNumber: 3,
          topicTitle: 'INNER & LEFT JOIN Relationships',
          scheduledTime: 'Today, 11:00 AM',
          teacherName: 'Mrs. Sarah Jenkins',
          className: 'Class 10 - Section A',
          progressText: 'Unit 2 — Topic 3'
        },
        totalModules: 6,
        description: 'Relational schema, SQL queries, table joins, and database design fundamentals.'
      },
      {
        tenantId: schoolTenant._id,
        id: 'sub-cpp-3',
        code: 'CPP-103',
        title: 'C++ Fundamentals',
        category: 'Systems Programming',
        level: 'Secondary',
        className: 'Class 10 - Section A',
        instructor: { name: 'Dr. Robert Vance', role: 'Systems Programming Head', avatar: '👨‍🔬' },
        schedule: { days: ['Monday', 'Wednesday'], time: '12:00 PM - 01:00 PM', room: 'Systems Lab B' },
        icon: '⚡',
        color: '#7C3AED',
        currentTeachingTopic: {
          unitNumber: 3,
          unitTitle: 'Object-Oriented Programming',
          topicNumber: 1,
          topicTitle: 'Classes, Objects & Constructors',
          scheduledTime: 'Today, 12:00 PM',
          teacherName: 'Dr. Robert Vance',
          className: 'Class 10 - Section A',
          progressText: 'Unit 3 — Topic 1'
        },
        totalModules: 5,
        description: 'Introduction to compiled languages, pointers, memory management, and OOP in C++.'
      },
      {
        tenantId: schoolTenant._id,
        id: 'sub-web-4',
        code: 'WEB-104',
        title: 'Web Development (HTML/CSS/JS)',
        category: 'Web Technologies',
        level: 'Secondary',
        className: 'Class 10 - Section A',
        instructor: { name: 'Ms. Clara Higgins', role: 'Frontend Engineer & Teacher', avatar: '👩‍💻' },
        schedule: { days: ['Tuesday', 'Friday'], time: '09:00 AM - 10:00 AM', room: 'Web Innovation Studio' },
        icon: '🌐',
        color: '#D97706',
        currentTeachingTopic: {
          unitNumber: 3,
          unitTitle: 'JavaScript Interactivity',
          topicNumber: 2,
          topicTitle: 'DOM Event Listeners & State',
          scheduledTime: 'Tomorrow, 09:00 AM',
          teacherName: 'Ms. Clara Higgins',
          className: 'Class 10 - Section A',
          progressText: 'Unit 3 — Topic 2'
        },
        totalModules: 5,
        description: 'Semantic HTML5, CSS layout systems, JavaScript DOM manipulation, and responsive web design.'
      },
      {
        tenantId: schoolTenant._id,
        id: 'sub-algo-5',
        code: 'ALGO-105',
        title: 'Algorithms & Logic Building',
        category: 'Computer Science',
        level: 'Secondary',
        className: 'Class 10 - Section A',
        instructor: { name: 'Mr. Alan Parker', role: 'Algorithm Specialist', avatar: '👨‍🏫' },
        schedule: { days: ['Thursday'], time: '10:30 AM - 12:00 PM', room: 'Logic Hall 108' },
        icon: '🧩',
        color: '#EC4899',
        currentTeachingTopic: {
          unitNumber: 2,
          unitTitle: 'Searching Algorithms',
          topicNumber: 2,
          topicTitle: 'Binary Search Implementation',
          scheduledTime: 'Tomorrow, 10:30 AM',
          teacherName: 'Mr. Alan Parker',
          className: 'Class 10 - Section A',
          progressText: 'Unit 2 — Topic 2'
        },
        totalModules: 4,
        description: 'Algorithmic thinking, flowcharting, search/sort algorithms, and Big-O complexity introductory principles.'
      }
    ];

    for (const sub of otherSchoolSubjects) {
      await Course.findOneAndUpdate(
        { tenantId: schoolTenant._id, id: sub.id },
        sub,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Seeded All 5 School Subjects with Real Academic Attributes');

    // 7. Seed Real Homework Assignments
    const homeworkSeed = [
      {
        id: 'hw-py-01',
        title: 'Lab 4: Palindrome & String Reversal Algorithms',
        subject: 'Python Programming',
        topic: 'Unit 8 — Strings: Indexing & Slicing',
        courseId: 'sub-py-1',
        courseCode: 'CS-101',
        courseTitle: 'Python Programming',
        dueDate: new Date(Date.now() + 2 * 24 * 3600 * 1000), // Due in 2 days
        dueRelative: 'In 2 days',
        priority: 'High',
        points: 20,
        description: 'Implement a function is_palindrome(text) that ignores spaces, punctuation, and casing. Test with racecar, madam, and custom sentences.',
        requirements: [
          'Function must accept a string parameter',
          'Strip whitespace and non-alphanumeric characters',
          'Case-insensitive comparison',
          'Return True or False'
        ]
      },
      {
        id: 'hw-py-02',
        title: 'Loops Practice: Multiples Accumulator & range()',
        subject: 'Python Programming',
        topic: 'Unit 6 — Loops: for Loops & range()',
        courseId: 'sub-py-1',
        courseCode: 'CS-101',
        courseTitle: 'Python Programming',
        dueDate: new Date(Date.now() + 5 * 24 * 3600 * 1000), // Due in 5 days
        dueRelative: 'In 5 days',
        priority: 'Normal',
        points: 20,
        description: 'Write a program that uses a for loop with range() to calculate the sum of all multiples of 3 or 5 below 100.',
        requirements: [
          'Use for i in range(1, 100)',
          'Check condition with modulus operator (%)',
          'Accumulate total and print result'
        ]
      },
      {
        id: 'hw-sql-01',
        title: 'Queries Practice: Library Database Inner Joins',
        subject: 'SQL & Relational Databases',
        topic: 'Unit 2 — Relational Queries: Table Joins',
        courseId: 'sub-sql-2',
        courseCode: 'DB-102',
        courseTitle: 'SQL & Relational Databases',
        dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000), // Due in 3 days
        dueRelative: 'Friday, 3:00 PM',
        priority: 'Normal',
        points: 20,
        description: 'Write an SQL query joining books, authors, and borrow_records to list overdue books checked out this month.',
        requirements: [
          'Use INNER JOIN between books and authors',
          'Filter by due_date < CURRENT_DATE',
          'Order by borrower name'
        ]
      },
      {
        id: 'hw-cpp-01',
        title: 'OOP Project: BankAccount Class Implementation',
        subject: 'C++ Fundamentals',
        topic: 'Unit 3 — OOP: Classes & Encapsulation',
        courseId: 'sub-cpp-3',
        courseCode: 'CPP-103',
        courseTitle: 'C++ Fundamentals',
        dueDate: new Date(Date.now() - 3 * 24 * 3600 * 1000), // Completed in the past
        dueRelative: 'Submitted',
        priority: 'Normal',
        points: 20,
        description: 'Design a BankAccount class with private balance, public deposit, withdraw, and getBalance methods.',
        requirements: [
          'Private member variable balance',
          'Public constructor with initial balance',
          'Validation against negative withdrawals',
          'Const accessor getBalance()'
        ]
      }
    ];

    const assignmentDocs = {};
    for (const hw of homeworkSeed) {
      const doc = await Assignment.findOneAndUpdate(
        { tenantId: schoolTenant._id, id: hw.id },
        { ...hw, tenantId: schoolTenant._id, batchId: schoolBatch._id, trainerId: teacherUser._id },
        { upsert: true, new: true }
      );
      assignmentDocs[hw.id] = doc;
    }
    console.log('✅ Seeded 4 Real Homework Assignments');

    // 8. Seed Submissions
    // Leo Miller submitted hw-cpp-01 and it has been graded with feedback
    const leoUser = studentUserDocs['SCH-2026-001'];
    if (leoUser && assignmentDocs['hw-cpp-01']) {
      await Submission.findOneAndUpdate(
        {
          tenantId: schoolTenant._id,
          assignmentId: assignmentDocs['hw-cpp-01']._id,
          studentId: leoUser._id
        },
        {
          tenantId: schoolTenant._id,
          assignmentId: assignmentDocs['hw-cpp-01']._id,
          studentId: leoUser._id,
          studentName: leoUser.name,
          studentIdentifier: leoUser.studentId,
          status: 'graded',
          score: 20,
          feedback: 'Exceptional encapsulation and clean memory management! Private variables are correctly shielded.',
          submissionText: `class BankAccount {\nprivate:\n    double balance;\npublic:\n    BankAccount(double init) : balance(init > 0 ? init : 0) {}\n    void deposit(double amt) { if(amt > 0) balance += amt; }\n    bool withdraw(double amt) {\n        if(amt > 0 && balance >= amt) { balance -= amt; return true; }\n        return false;\n    }\n    double getBalance() const { return balance; }\n};`,
          submittedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
          gradedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000)
        },
        { upsert: true, new: true }
      );
    }

    // Samantha Lee submitted hw-py-01 (pending evaluation)
    const samanthaUser = studentUserDocs['SCH-2026-002'];
    if (samanthaUser && assignmentDocs['hw-py-01']) {
      await Submission.findOneAndUpdate(
        {
          tenantId: schoolTenant._id,
          assignmentId: assignmentDocs['hw-py-01']._id,
          studentId: samanthaUser._id
        },
        {
          tenantId: schoolTenant._id,
          assignmentId: assignmentDocs['hw-py-01']._id,
          studentId: samanthaUser._id,
          studentName: samanthaUser.name,
          studentIdentifier: samanthaUser.studentId,
          status: 'submitted',
          score: null,
          feedback: null,
          submissionText: `def is_palindrome(text):\n    clean = [c.lower() for c in text if c.isalnum()]\n    return clean == clean[::-1]\n\n# Verified with racecar\nprint(is_palindrome("racecar"))  # True`,
          submittedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000)
        },
        { upsert: true, new: true }
      );
    }
    console.log('✅ Seeded Homework Submissions with Real Student Linkage');

    // 9. Seed Student Topic Progress for Leo Miller
    // Leo has completed Units 1 through 6 in Python (Units 1-6 = 4 + 5 + 3 + 2 + 3 + 3 = 20 topics)
    if (leoUser) {
      const completedList = [];
      for (let u = 1; u <= 6; u++) {
        const unitObj = PYTHON_SCHOOL_CURRICULUM.find(unit => unit.unitNumber === u);
        if (unitObj) {
          unitObj.topics.forEach(t => {
            completedList.push({
              unitNumber: u,
              topicNumber: t.topicNumber,
              topicTitle: t.title,
              completedAt: new Date(Date.now() - (7 - u) * 24 * 3600 * 1000)
            });
          });
        }
      }

      await StudentProgress.findOneAndUpdate(
        { tenantId: schoolTenant._id, studentId: leoUser._id, courseId: 'sub-py-1' },
        {
          tenantId: schoolTenant._id,
          studentId: leoUser._id,
          studentIdentifier: leoUser.studentId,
          courseId: 'sub-py-1',
          completedTopics: completedList,
          lastActiveTopic: {
            unitNumber: 7,
            topicNumber: 1,
            topicTitle: 'What is a Function?'
          },
          lastActivityAt: new Date()
        },
        { upsert: true, new: true }
      );
      console.log(`✅ Seeded Leo Miller Curriculum Progress: ${completedList.length} of ${totalPythonTopics} topics completed`);
    }

    // 10. Seed Attendance for the 5 students across 10 session dates
    const attendanceDates = [
      '2026-09-15', '2026-09-17', '2026-09-19', '2026-09-22', '2026-09-24',
      '2026-09-26', '2026-09-29', '2026-10-01', '2026-10-03', '2026-10-06'
    ];

    for (const dStr of attendanceDates) {
      const d = new Date(dStr);
      // Leo is present all 10 dates (100%)
      if (leoUser) {
        await Attendance.findOneAndUpdate(
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: leoUser._id, date: d },
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: leoUser._id, trainerId: teacherUser._id, date: d, status: 'present' },
          { upsert: true }
        );
      }
      // Samantha is present 9 of 10 (90%)
      if (samanthaUser) {
        const isAbsent = dStr === '2026-09-24';
        await Attendance.findOneAndUpdate(
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: samanthaUser._id, date: d },
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: samanthaUser._id, trainerId: teacherUser._id, date: d, status: isAbsent ? 'absent' : 'present' },
          { upsert: true }
        );
      }
      // Daniel is present 7 of 10 (70% - low attendance)
      const danielUser = studentUserDocs['SCH-2026-003'];
      if (danielUser) {
        const isAbsent = dStr === '2026-09-17' || dStr === '2026-09-26' || dStr === '2026-10-01';
        await Attendance.findOneAndUpdate(
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: danielUser._id, date: d },
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: danielUser._id, trainerId: teacherUser._id, date: d, status: isAbsent ? 'absent' : 'present' },
          { upsert: true }
        );
      }
      // Aisha is present 10 of 10 (100%)
      const aishaUser = studentUserDocs['SCH-2026-004'];
      if (aishaUser) {
        await Attendance.findOneAndUpdate(
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: aishaUser._id, date: d },
          { tenantId: schoolTenant._id, batchId: schoolBatch._id, studentId: aishaUser._id, trainerId: teacherUser._id, date: d, status: 'present' },
          { upsert: true }
        );
      }
    }
    console.log('✅ Seeded 10 Attendance Sessions for Oakridge Class 10-A');

    // 10b. Seed Scheduled School Assessments / Examinations
    const assessmentsToSeed = [
      {
        id: 'diag-eval-01',
        title: 'Python Fundamentals Diagnostic',
        subject: 'Python Programming',
        courseId: 'sub-py-1',
        courseCode: 'CS-101',
        date: new Date('2026-09-28T10:00:00Z'),
        time: '10:00 - 10:45 AM',
        room: 'Coding Lab 1',
        totalMarks: 20,
        durationMinutes: 45,
        isCodingExam: true,
        status: 'completed',
        description: 'Covers Python basic syntax, variables, print statements, and fundamental types.'
      },
      {
        id: 'midterm-py-01',
        title: 'Conditional Statements & Loops Test',
        subject: 'Python Programming',
        courseId: 'sub-py-1',
        courseCode: 'CS-101',
        date: new Date('2026-10-04T10:00:00Z'),
        time: '10:00 - 10:45 AM',
        room: 'Coding Lab 1',
        totalMarks: 20,
        durationMinutes: 45,
        isCodingExam: true,
        status: 'completed',
        description: 'Evaluation of if-elif-else branching, while loops, and for loop iteration.'
      },
      {
        id: 'exam-py-02',
        title: 'Functions & Algorithmic Logic Test',
        subject: 'Python Programming',
        courseId: 'sub-py-1',
        courseCode: 'CS-101',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days in future
        time: '10:00 - 10:45 AM',
        room: 'Coding Lab 1',
        totalMarks: 20,
        durationMinutes: 45,
        isCodingExam: true,
        status: 'scheduled',
        description: 'Proctored practical test on function definitions, parameters, return values, and modular design.',
        challenge: {
          id: 'chal-py-fn-01',
          title: 'Function: Calculate Factorial Accumulator',
          description: 'Define a function named `calculate_factorial(n)` that takes a positive integer n and returns its factorial.',
          language: 'python',
          starterCode: 'def calculate_factorial(n):\n    # Write your code here\n    pass\n\nprint(calculate_factorial(5))\n'
        }
      },
      {
        id: 'exam-sql-01',
        title: 'Relational Queries & JOINs Mid-Term Lab Test',
        subject: 'SQL & Relational Databases',
        courseId: 'sub-db-1',
        courseCode: 'DB-102',
        date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days in future
        time: '11:00 - 11:45 AM',
        room: 'Database Studio',
        totalMarks: 20,
        durationMinutes: 45,
        isCodingExam: true,
        status: 'scheduled',
        description: 'Laboratory assessment covering SELECT queries, INNER JOIN, GROUP BY, and aggregate functions.'
      }
    ];

    for (const aData of assessmentsToSeed) {
      await Assessment.findOneAndUpdate(
        { tenantId: schoolTenant._id, id: aData.id },
        { ...aData, tenantId: schoolTenant._id },
        { upsert: true }
      );
    }
    console.log('✅ Seeded Scheduled School Assessments for Oakridge');

    // 11. Seed Real Assessment Attempts & Test Results
    const testsData = [
      {
        assessmentId: 'diag-eval-01',
        assessmentTitle: 'Python Fundamentals Diagnostic',
        subject: 'Python Programming',
        maxScore: 20,
        date: new Date('2026-09-28T10:00:00Z'),
        studentScores: {
          'SCH-2026-001': { score: 18, time: 24, violations: 0 },
          'SCH-2026-002': { score: 19, time: 21, violations: 0 },
          'SCH-2026-003': { score: 14, time: 38, violations: 1 },
          'SCH-2026-004': { score: 20, time: 18, violations: 0 },
          'SCH-2026-005': { score: 15, time: 30, violations: 0 }
        }
      },
      {
        assessmentId: 'midterm-py-01',
        assessmentTitle: 'Conditional Statements & Loops Test',
        subject: 'Python Programming',
        maxScore: 20,
        date: new Date('2026-10-04T10:00:00Z'),
        studentScores: {
          'SCH-2026-001': { score: 16, time: 32, violations: 1 },
          'SCH-2026-002': { score: 18, time: 26, violations: 0 },
          'SCH-2026-003': { score: 11, time: 42, violations: 2 },
          'SCH-2026-004': { score: 19, time: 22, violations: 0 }
        }
      }
    ];

    for (const test of testsData) {
      for (const [sId, info] of Object.entries(test.studentScores)) {
        const studentDoc = studentUserDocs[sId];
        if (studentDoc) {
          const pct = Math.round((info.score / test.maxScore) * 100);
          await AssessmentAttempt.findOneAndUpdate(
            { tenantId: schoolTenant._id, assessmentId: test.assessmentId, studentId: studentDoc._id },
            {
              tenantId: schoolTenant._id,
              assessmentId: test.assessmentId,
              assessmentTitle: test.assessmentTitle,
              subject: test.subject,
              studentId: studentDoc._id,
              studentIdentifier: sId,
              studentName: studentDoc.name,
              className: 'Class 10 - Section A',
              startedAt: test.date,
              submittedAt: new Date(test.date.getTime() + info.time * 60000),
              status: 'evaluated',
              score: info.score,
              maxScore: test.maxScore,
              percentage: pct,
              timeUsedMinutes: info.time,
              violationCount: info.violations,
              integrityStatus: info.violations >= 2 ? 'review_required' : info.violations > 0 ? 'attention_required' : 'normal',
              teacherFeedback: pct >= 85 ? 'Strong conceptual grasp demonstrated.' : pct >= 70 ? 'Satisfactory. Reinforce loops syntax.' : 'Needs remedial review on nested logic.'
            },
            { upsert: true }
          );
        }
      }
    }
    console.log('✅ Seeded Real Assessment Attempts for Oakridge Class 10-A');

    // 12. Seed Real Assessment Integrity Events (Proctoring Telemetry)
    const leoDoc = studentUserDocs['SCH-2026-001'];
    if (leoDoc) {
      await AssessmentEvent.findOneAndUpdate(
        { tenantId: schoolTenant._id, assessmentId: 'midterm-py-01', studentId: leoDoc._id, eventType: 'FULLSCREEN_EXIT' },
        {
          tenantId: schoolTenant._id,
          assessmentId: 'midterm-py-01',
          assessmentTitle: 'Conditional Statements & Loops Test',
          studentId: leoDoc._id,
          studentIdentifier: 'SCH-2026-001',
          studentName: leoDoc.name,
          className: 'Class 10 - Section A',
          eventType: 'FULLSCREEN_EXIT',
          severity: 'medium',
          reason: 'Assessment window exited fullscreen view.',
          timestamp: new Date('2026-10-04T10:42:17Z')
        },
        { upsert: true }
      );
    }

    const danielDoc = studentUserDocs['SCH-2026-003'];
    if (danielDoc) {
      await AssessmentEvent.findOneAndUpdate(
        { tenantId: schoolTenant._id, assessmentId: 'midterm-py-01', studentId: danielDoc._id, eventType: 'WINDOW_BLUR' },
        {
          tenantId: schoolTenant._id,
          assessmentId: 'midterm-py-01',
          assessmentTitle: 'Conditional Statements & Loops Test',
          studentId: danielDoc._id,
          studentIdentifier: 'SCH-2026-003',
          studentName: danielDoc.name,
          className: 'Class 10 - Section A',
          eventType: 'WINDOW_BLUR',
          severity: 'low',
          reason: 'Assessment window lost active focus.',
          timestamp: new Date('2026-10-04T10:28:11Z')
        },
        { upsert: true }
      );
      await AssessmentEvent.findOneAndUpdate(
        { tenantId: schoolTenant._id, assessmentId: 'midterm-py-01', studentId: danielDoc._id, eventType: 'TAB_OR_WINDOW_HIDDEN' },
        {
          tenantId: schoolTenant._id,
          assessmentId: 'midterm-py-01',
          assessmentTitle: 'Conditional Statements & Loops Test',
          studentId: danielDoc._id,
          studentIdentifier: 'SCH-2026-003',
          studentName: danielDoc.name,
          className: 'Class 10 - Section A',
          eventType: 'TAB_OR_WINDOW_HIDDEN',
          severity: 'medium',
          reason: 'Assessment tab or browser window was minimized/hidden.',
          timestamp: new Date('2026-10-04T10:31:45Z')
        },
        { upsert: true }
      );
    }
    console.log('✅ Seeded Real Assessment Integrity Events');

    // 12. Seed Authoritative Academic Calendar Events
    const initialCalendarEvents = [
      {
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id,
        batchName: 'Class 10 - Section A',
        title: 'Python Programming — Functions & Recursion Lab',
        eventType: 'class',
        subject: 'Python Programming',
        description: 'Hands-on coding session in Computer Lab 1 covering recursive problem decomposition.',
        room: 'Coding Lab 1',
        startTime: new Date('2026-10-12T09:00:00Z'),
        endTime: new Date('2026-10-12T09:45:00Z'),
        dateStr: '2026-10-12',
        status: 'scheduled',
        creatorId: teacherUser._id,
        creatorName: 'Mr. David Miller'
      },
      {
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id,
        batchName: 'Class 10 - Section A',
        title: 'SQL & Relational Databases — Schema Design Lab',
        eventType: 'class',
        subject: 'SQL & Relational Databases',
        description: 'Practical exercise on foreign key constraints and primary index relationships.',
        room: 'Database Studio',
        startTime: new Date('2026-10-13T10:00:00Z'),
        endTime: new Date('2026-10-13T10:45:00Z'),
        dateStr: '2026-10-13',
        status: 'scheduled',
        creatorId: teacherUser._id,
        creatorName: 'Mrs. Sarah Jenkins'
      },
      {
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id,
        batchName: 'Class 10 - Section A',
        title: 'Mid-Term Algorithms & Logic Building Review',
        eventType: 'class',
        subject: 'Algorithms & Logic Building',
        description: 'Interactive walkthrough of searching algorithms and sorting complexity.',
        room: 'Logic Hall 108',
        startTime: new Date('2026-10-14T11:00:00Z'),
        endTime: new Date('2026-10-14T11:45:00Z'),
        dateStr: '2026-10-14',
        status: 'scheduled',
        creatorId: teacherUser._id,
        creatorName: 'Mr. Alan Parker'
      },
      {
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id,
        batchName: 'Class 10 - Section A',
        title: 'School Hackathon & Computational Olympiad 2026',
        eventType: 'academic_event',
        subject: 'School-Wide Event',
        description: 'Annual competitive programming showcase for high school divisions.',
        room: 'Auditorium & Tech Wing',
        startTime: new Date('2026-10-16T08:30:00Z'),
        endTime: new Date('2026-10-16T15:00:00Z'),
        dateStr: '2026-10-16',
        status: 'scheduled',
        creatorId: schoolAdmin._id,
        creatorName: 'Principal Office'
      }
    ];

    for (const ev of initialCalendarEvents) {
      await AcademicEvent.findOneAndUpdate(
        {
          tenantId: ev.tenantId,
          title: ev.title,
          dateStr: ev.dateStr
        },
        ev,
        { upsert: true, new: true }
      );
    }
    console.log('✅ Seeded Authoritative Academic Calendar Events');

    console.log('🎉 Full Academic Seeding (with demo records) complete!');
  } catch (error) {
    console.error(`❌ Seeding Error: ${error.message}`);
    throw error;
  }
};

export const seedFoundationalData = runSeed;
export default runSeed;

// Check if running directly
if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  (async () => {
    const conn = await connectDB();
    if (!conn) {
      console.log('No DB connection. Cannot seed.');
      return;
    }
    const withAcademicDemo = process.argv.includes('--with-demo') || process.env.SEED_DEMO_ACADEMIC === 'true';
    await runSeed({ withAcademicDemo });
    process.exit(0);
  })();
}
