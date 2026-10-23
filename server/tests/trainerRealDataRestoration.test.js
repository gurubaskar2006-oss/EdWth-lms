/**
 * Lumina LMS — Trainer Real Data Restoration & RBAC Verification
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. School Teacher access to /api/v1/students/datasheet (HTTP 200, valid shape with data.students).
 * 2. School Teacher access to /api/v1/trainer/students with batch/section scoping.
 * 3. Trainer and Teacher access to /api/v1/trainer/courses (returns courses and subjects).
 * 4. Assessment submissions-detailed view returns pending-evaluation attempts with status: 'submitted'.
 * 5. Notes / Materials endpoint accurately serves tenant notes and handles empty states.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Course from '../models/Course.js';
import Note from '../models/Note.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Trainer Portal Real-Data Restoration & RBAC', () => {
  const ts = Date.now();

  let schoolTenant;
  let schoolBatch;
  let teacherUser;
  let teacherToken;

  let collegeTenant;
  let collegeTrainer;
  let trainerToken;

  let schoolStudent1;
  let schoolStudent2;
  let studentToken;

  let testAssessment;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // Create School Tenant
    schoolTenant = await College.create({
      name: `Oakridge High School ${ts}`,
      code: `OHS-${ts}`,
      slug: `ohs-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    // Create Batch
    schoolBatch = await Batch.create({
      tenantId: schoolTenant._id,
      name: 'Class 10 - Section A',
      code: `SEC-A-${ts}`
    });

    // Create Teacher (role: 'trainer' in school tenant)
    teacherUser = await User.create({
      tenantId: schoolTenant._id,
      batchId: schoolBatch._id,
      studentId: `TCH-${ts}`,
      name: 'Sarah Jenkins',
      email: `teacher_${ts}@oakridge.edu`,
      password: 'HashedPassword123!',
      role: 'trainer'
    });
    teacherToken = jwt.sign({ id: teacherUser._id.toString() }, getJwtSecret(), { expiresIn: '1h' });

    // Create College Tenant & Trainer
    collegeTenant = await College.create({
      name: `Nexus Tech Institute ${ts}`,
      code: `NEX-${ts}`,
      slug: `nex-${ts}`,
      institutionType: 'college',
      status: 'active'
    });

    collegeTrainer = await User.create({
      tenantId: collegeTenant._id,
      studentId: `TRN-${ts}`,
      name: 'Dr. Marcus Cole',
      email: `trainer_${ts}@nexus.edu`,
      password: 'HashedPassword123!',
      role: 'trainer'
    });
    trainerToken = jwt.sign({ id: collegeTrainer._id.toString() }, getJwtSecret(), { expiresIn: '1h' });

    // Create School Students
    schoolStudent1 = await User.create({
      tenantId: schoolTenant._id,
      batchId: schoolBatch._id,
      studentId: `STU1-${ts}`,
      name: 'Leo Miller',
      email: `leo_${ts}@oakridge.edu`,
      password: 'StudentPass123!',
      role: 'student'
    });
    studentToken = jwt.sign({ id: schoolStudent1._id.toString() }, getJwtSecret(), { expiresIn: '1h' });

    schoolStudent2 = await User.create({
      tenantId: schoolTenant._id,
      batchId: schoolBatch._id,
      studentId: `STU2-${ts}`,
      name: 'Samantha Lee',
      email: `samantha_${ts}@oakridge.edu`,
      password: 'StudentPass123!',
      role: 'student'
    });

    // Create Assessment
    testAssessment = await Assessment.create({
      tenantId: schoolTenant._id,
      id: `diag-eval-${ts}`,
      title: 'Mathematics Unit Test',
      subject: 'Mathematics',
      date: new Date(),
      totalMarks: 50,
      durationMinutes: 45,
      status: 'scheduled'
    });

    // Create Course
    await Course.create({
      tenantId: schoolTenant._id,
      id: `crs-${ts}`,
      code: `MATH-10-${ts}`,
      courseCode: `MATH-10-${ts}`,
      title: 'Advanced Mathematics',
      subject: 'Mathematics',
      className: 'Class 10 - Section A'
    });

    // Create Assessment Attempt (submitted, pending evaluation)
    await AssessmentAttempt.create({
      tenantId: schoolTenant._id,
      assessmentId: testAssessment.id,
      assessmentTitle: 'Mathematics Unit Test',
      subject: 'Mathematics',
      studentId: schoolStudent1._id,
      studentIdentifier: schoolStudent1.studentId,
      studentName: schoolStudent1.name,
      attemptNumber: 1,
      status: 'submitted',
      score: null,
      maxScore: 50,
      percentage: null,
      timeUsedMinutes: 30,
      answers: [
        { questionId: 'q1', type: 'mcq', selectedOption: 1 },
        { questionId: 'q2', type: 'text', answerText: 'x = 5' }
      ]
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (schoolTenant) {
      await Promise.all([
        College.deleteOne({ _id: schoolTenant._id }),
        College.deleteOne({ _id: collegeTenant._id }),
        Batch.deleteMany({ tenantId: schoolTenant._id }),
        User.deleteMany({ tenantId: { $in: [schoolTenant._id, collegeTenant._id] } }),
        Assessment.deleteMany({ tenantId: schoolTenant._id }),
        AssessmentAttempt.deleteMany({ tenantId: schoolTenant._id }),
        Course.deleteMany({ tenantId: schoolTenant._id }),
        Note.deleteMany({ tenantId: schoolTenant._id })
      ]);
    }
  });

  describe('1. Student Datasheet Access & Response Shape', () => {
    it('should allow teacher role to access /api/v1/students/datasheet and return data.students', async () => {
      const res = await request(app)
        .get('/api/v1/students/datasheet')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.students)).toBe(true);
      expect(res.body.data.students.length).toBeGreaterThanOrEqual(2);

      const names = res.body.data.students.map((s) => s.name);
      expect(names).toContain('Leo Miller');
      expect(names).toContain('Samantha Lee');
    });

    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/students/datasheet');
      expect(res.status).toBe(401);
    });

    it('should reject student role with 403', async () => {
      const res = await request(app)
        .get('/api/v1/students/datasheet')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Teacher Roster Scoping (/api/v1/trainer/students)', () => {
    it('should return teacher assigned section students with academic status and metrics', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/students')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.students)).toBe(true);
      expect(res.body.students.length).toBeGreaterThanOrEqual(2);

      const stu = res.body.students.find((s) => s.name === 'Leo Miller');
      expect(stu).toBeDefined();
      expect(stu.studentId).toBe(`STU1-${ts}`);
      expect(stu.status).toBeDefined();
    });
  });

  describe('3. Unified Courses Endpoint (/api/v1/trainer/courses)', () => {
    it('should return courses and subjects for trainer/teacher', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/courses')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.courses)).toBe(true);
      expect(Array.isArray(res.body.subjects)).toBe(true);
      expect(res.body.courses.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('4. Detailed Submissions & Pending Evaluation Visibility', () => {
    it('should return submitted attempt with null score visible as pending evaluation', async () => {
      const res = await request(app)
        .get(`/api/v1/assessments/${testAssessment.id}/submissions-detailed`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.submissions)).toBe(true);
      expect(res.body.submissions.length).toBe(1);

      const sub = res.body.submissions[0];
      expect(sub.studentName).toBe('Leo Miller');
      expect(sub.marksObtained).toBeNull();
      expect(sub.percentage).toBeNull();
      expect(sub.attemptStatus).toBe('Submitted (Awaiting Marks)');
    });
  });

  describe('5. Notes / Materials Tenant Scoping & Empty States', () => {
    it('should return empty array with 200 for tenant with no notes', async () => {
      const res = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('should return created note after upload/creation in tenant', async () => {
      const note = await Note.create({
        id: 'note-trig-01',
        tenantId: schoolTenant._id,
        owner: teacherUser._id,
        title: 'Trigonometry Formula Sheet',
        subject: 'Mathematics',
        category: 'Study Guide',
        visibility: 'batch-shared',
        batchId: schoolBatch._id
      });

      const res = await request(app)
        .get('/api/v1/notes')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Trigonometry Formula Sheet');

      await Note.deleteOne({ _id: note._id });
    });
  });

  describe('6. Cohort Performance Analytics & Error Resilience', () => {
    it('6A: should return 200 and safe zero/null empty state for cohort with no activity', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/analytics')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(typeof res.body.data.totalStudents).toBe('number');
      expect(typeof res.body.data.totalAttendance).toBe('number');
      expect(typeof res.body.data.totalSubmissions).toBe('number');
      expect(typeof res.body.data.gradedSubmissions).toBe('number');
      expect(res.body.data.attendanceRate).toBeNull();
      expect(res.body.data.averageScore).toBeNull();
    });

    it('6B: should calculate accurate metrics when attendance and graded submissions exist', async () => {
      // Create an assignment and submission
      const assignment = await mongoose.model('Assignment').create({
        tenantId: schoolTenant._id,
        courseId: 'MTH-101',
        title: `Test HW ${ts}`,
        batchId: schoolBatch._id,
        points: 100
      });

      const submission = await Submission.create({
        tenantId: schoolTenant._id,
        assignmentId: assignment._id,
        studentId: schoolStudent1._id,
        status: 'graded',
        score: 92
      });

      // Create attendance records
      const att1 = await Attendance.create({
        tenantId: schoolTenant._id,
        batchId: schoolBatch._id,
        studentId: schoolStudent1._id,
        trainerId: teacherUser._id,
        date: new Date(),
        status: 'present'
      });

      const res = await request(app)
        .get('/api/v1/trainer/analytics')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSubmissions).toBeGreaterThanOrEqual(1);
      expect(res.body.data.gradedSubmissions).toBeGreaterThanOrEqual(1);
      expect(res.body.data.averageScore).toBe('92.0');
      expect(res.body.data.attendanceRate).toBe(100);

      // Clean up test records
      await Submission.deleteOne({ _id: submission._id });
      await Attendance.deleteOne({ _id: att1._id });
      await mongoose.model('Assignment').deleteOne({ _id: assignment._id });
    });

    it('6C: should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/v1/trainer/analytics');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('6D: should deny student access to trainer cohort analytics with 403', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/analytics')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('6E: should return 400 Bad Request for malformed batchId instead of HTTP 500', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/analytics/batch/not-an-object-id')
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid cohort identifier');
    });

    it('6F: should deny out-of-cohort access when a trainer requests a different batch', async () => {
      const otherBatchId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/v1/trainer/analytics/batch/${otherBatchId}`)
        .set('Authorization', `Bearer ${teacherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Access denied');
    });
  });
});
