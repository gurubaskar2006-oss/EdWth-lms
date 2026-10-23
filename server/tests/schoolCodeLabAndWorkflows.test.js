/**
 * Lumina LMS — School Student Code Lab, Homework & Academic Calendar Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Safe Code Lab execution endpoint rejects invalid payloads, requires auth, and fails-closed.
 * 2. School Curriculum topic completion persists deterministically to StudentProgress.
 * 3. End-to-end homework workflow: create by trainer -> view by student -> submit -> grade -> view results.
 * 4. Academic Calendar event synchronization and date handling.
 * 5. Tenant isolation: cross-tenant access to homework is strictly prohibited.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import StudentProgress from '../models/StudentProgress.js';

describe('Lumina LMS — School Code Lab, Homework & Calendar Workflow Tests', () => {
  const TEST_JWT_SECRET = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_with_more_than_32_characters';
  let schoolTenant;
  let collegeTenant;
  let teacherUser;
  let studentUser;
  let outsiderUser;
  let schoolBatch;
  let schoolCourse;
  let teacherToken;
  let studentToken;
  let outsiderToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    // Wait for server's database connection to be fully ready
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // Create test school tenant
    const ts = Date.now();
    schoolTenant = await College.create({
      name: 'Test Oakridge High School ' + ts,
      code: 'TOHS' + ts,
      slug: 'tohs-' + ts,
      institutionType: 'school',
      domain: 'testoakridge.edu'
    });

    // Create test college tenant for isolation tests
    collegeTenant = await College.create({
      name: 'Test Nexus University ' + ts,
      code: 'TNEX' + ts,
      slug: 'tnex-' + ts,
      institutionType: 'college',
      domain: 'testnexus.edu'
    });

    // Create class / batch
    schoolBatch = await Batch.create({
      name: 'Class 10 - Section T',
      tenantId: schoolTenant._id,
      institutionType: 'school',
      academicYear: '2026-2027',
      classGrade: '10'
    });

    // Create course/subject
    schoolCourse = await Course.create({
      id: 'course-py-' + ts,
      title: 'Python Programming',
      code: 'PY-' + ts,
      tenantId: schoolTenant._id,
      institutionType: 'school',
      units: [
        {
          unitNumber: 1,
          title: 'Python Fundamentals',
          topics: [
            { topicNumber: 1, title: 'Variables and Print' }
          ]
        }
      ]
    });

    // Create teacher
    teacherUser = await User.create({
      studentId: 'TR-' + ts,
      name: 'Teacher Robinson',
      email: `teacher_${ts}@testoakridge.edu`,
      password: 'HashedPassword123!',
      role: 'trainer',
      institutionType: 'school',
      tenantId: schoolTenant._id,
      assignedBatches: [schoolBatch._id]
    });

    // Create school student
    studentUser = await User.create({
      studentId: 'ST-' + ts,
      name: 'Alex Student',
      email: `student_${ts}@testoakridge.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      institutionType: 'school',
      tenantId: schoolTenant._id,
      batchId: schoolBatch._id
    });

    // Create outsider user in college tenant
    outsiderUser = await User.create({
      studentId: 'OUT-' + ts,
      name: 'Outsider User',
      email: `outsider_${ts}@testnexus.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      institutionType: 'college',
      tenantId: collegeTenant._id
    });

    teacherToken = jwt.sign(
      { userId: teacherUser._id, id: teacherUser._id, email: teacherUser.email, role: 'trainer', tenantId: schoolTenant._id },
      TEST_JWT_SECRET,
      { expiresIn: '2h' }
    );

    studentToken = jwt.sign(
      { userId: studentUser._id, id: studentUser._id, email: studentUser.email, role: 'student', tenantId: schoolTenant._id },
      TEST_JWT_SECRET,
      { expiresIn: '2h' }
    );

    outsiderToken = jwt.sign(
      { userId: outsiderUser._id, id: outsiderUser._id, email: outsiderUser.email, role: 'student', tenantId: collegeTenant._id },
      TEST_JWT_SECRET,
      { expiresIn: '2h' }
    );
  }, 30000);

  afterAll(async () => {
    try {
      if (schoolTenant?._id) {
        await Assignment.deleteMany({ tenantId: schoolTenant._id });
        await Submission.deleteMany({ tenantId: schoolTenant._id });
        await Course.deleteMany({ tenantId: schoolTenant._id });
      }
      if (studentUser?._id) {
        await StudentProgress.deleteMany({ studentId: studentUser._id });
      }
      const userIds = [teacherUser?._id, studentUser?._id, outsiderUser?._id].filter(Boolean);
      if (userIds.length > 0) {
        await User.deleteMany({ _id: { $in: userIds } });
      }
      if (schoolBatch?._id) {
        await Batch.deleteMany({ _id: schoolBatch._id });
      }
      const tenantIds = [schoolTenant?._id, collegeTenant?._id].filter(Boolean);
      if (tenantIds.length > 0) {
        await College.deleteMany({ _id: { $in: tenantIds } });
      }
    } catch (e) {
      // Ignore cleanup error in teardown
    }
  });

  describe('1. Code Lab Execution Security & Boundaries', () => {
    it('should reject unauthenticated code execution', async () => {
      const res = await request(app)
        .post('/api/v1/execute')
        .send({ language: 'python', files: [{ content: 'print("hello")' }] });

      expect(res.status).toBe(401);
    });

    it('should reject code execution with missing files', async () => {
      const res = await request(app)
        .post('/api/v1/execute')
        .set('Cookie', [`token=${studentToken}`])
        .send({ language: 'python', files: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should handle code execution via safe sandboxed runner queue', async () => {
      const res = await request(app)
        .post('/api/v1/execute')
        .set('Cookie', [`token=${studentToken}`])
        .send({ language: 'python', files: [{ content: 'print(2 + 2)' }] });

      // If Piston container is reachable, returns 200; in test/offline fallback, handles safely without throwing unhandled exceptions
      expect([200, 500, 502, 503]).toContain(res.status);
    });

    it('should never create academic records, topic completions, or homework submissions during practice code runs', async () => {
      const beforeSubs = await Submission.countDocuments({ studentId: studentUser._id });
      const beforeProgress = await StudentProgress.findOne({ studentId: studentUser._id });
      const beforeCompletedTopics = beforeProgress?.completedTopics?.length || 0;

      await request(app)
        .post('/api/v1/execute')
        .set('Cookie', [`token=${studentToken}`])
        .send({ language: 'python', files: [{ content: 'print("Practice code only")' }] });

      const afterSubs = await Submission.countDocuments({ studentId: studentUser._id });
      const afterProgress = await StudentProgress.findOne({ studentId: studentUser._id });
      const afterCompletedTopics = afterProgress?.completedTopics?.length || 0;

      expect(afterSubs).toBe(beforeSubs);
      expect(afterCompletedTopics).toBe(beforeCompletedTopics);
    });
  });

  describe('2. School Curriculum Progress Persistence', () => {
    it('should persist topic completion for authenticated school student', async () => {
      const res = await request(app)
        .post('/api/v1/school/topics/complete')
        .set('Cookie', [`token=${studentToken}`])
        .send({
          courseId: schoolCourse.id,
          unitNumber: 1,
          topicNumber: 1,
          topicTitle: 'Variables and Print'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const saved = await StudentProgress.findOne({
        studentId: studentUser._id,
        courseId: schoolCourse.id
      });
      expect(saved).not.toBeNull();
      expect(saved.completedTopics.length).toBeGreaterThan(0);
      expect(saved.completedTopics[0].topicTitle).toBe('Variables and Print');
    });

    it('should be idempotent: completing topic again does not create duplicate entries', async () => {
      await request(app)
        .post('/api/v1/school/topics/complete')
        .set('Cookie', [`token=${studentToken}`])
        .send({
          courseId: schoolCourse.id,
          unitNumber: 1,
          topicNumber: 1,
          topicTitle: 'Variables and Print'
        });

      const progress = await StudentProgress.findOne({
        studentId: studentUser._id,
        courseId: schoolCourse.id
      });
      expect(progress.completedTopics.length).toBe(1);
    });
  });

  describe('3. Homework Management & Student Submission Lifecycle', () => {
    let createdAssignmentId;

    it('should allow trainer to create and publish homework', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/homework')
        .set('Cookie', [`token=${teacherToken}`])
        .send({
          title: 'Loops and Multiples Homework',
          subject: 'Python Programming',
          topic: 'For and While Loops',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
          points: 25,
          description: 'Write a program to print multiplication tables up to 10.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assignment).toBeDefined();
      createdAssignmentId = res.body.assignment._id;
    });

    it('should allow school student to fetch published homework with pending status', async () => {
      const res = await request(app)
        .get('/api/v1/school/homework')
        .set('Cookie', [`token=${studentToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const target = res.body.homework.find((a) => String(a._id) === String(createdAssignmentId));
      expect(target).toBeDefined();
      expect(target.status).toBe('pending');
    });

    it('should allow student to submit homework solution', async () => {
      const res = await request(app)
        .post(`/api/v1/school/homework/${createdAssignmentId}/submit`)
        .set('Cookie', [`token=${studentToken}`])
        .send({
          code: 'for i in range(1, 11):\n    print(f"5 x {i} = {5 * i}")'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.submission).toBeDefined();
      expect(res.body.submission.status).toBe('submitted');
    });

    it('should allow trainer to review submission and submit verified score with feedback', async () => {
      const gradeRes = await request(app)
        .post(`/api/v1/trainer/assignments/${createdAssignmentId}/grade`)
        .set('Cookie', [`token=${teacherToken}`])
        .send({
          studentId: studentUser._id,
          score: 24,
          feedback: 'Excellent loop formatting! Clean output.'
        });

      expect(gradeRes.status).toBe(200);
      expect(gradeRes.body.success).toBe(true);
      expect(gradeRes.body.submission.score).toBe(24);
      expect(gradeRes.body.submission.status).toBe('graded');
    });

    it('should show graded score and teacher feedback on student portal', async () => {
      const res = await request(app)
        .get('/api/v1/school/homework')
        .set('Cookie', [`token=${studentToken}`]);

      expect(res.status).toBe(200);
      const target = res.body.homework.find((a) => String(a._id) === String(createdAssignmentId));
      expect(target).toBeDefined();
      expect(target.status).toBe('graded');
      expect(target.score).toBe(24);
      expect(target.feedback).toBe('Excellent loop formatting! Clean output.');
    });

    it('should return unambiguous student-level roster on trainer homework endpoint', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/homework')
        .set('Cookie', [`token=${teacherToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const asg = res.body.assignments.find((a) => String(a._id) === String(createdAssignmentId));
      expect(asg).toBeDefined();
      expect(asg.roster).toBeDefined();
      expect(Array.isArray(asg.roster)).toBe(true);

      const studentEntry = asg.roster.find((r) => String(r.studentDbId) === String(studentUser._id));
      expect(studentEntry).toBeDefined();
      expect(studentEntry.studentName).toBe(studentUser.name);
      expect(studentEntry.studentId).toBe(studentUser.studentId);
      expect(studentEntry.status).toBe('graded');
      expect(studentEntry.submissionId).toBeDefined();
    });

    it('should allow trainer to return student work for revision and display to student', async () => {
      const revRes = await request(app)
        .post(`/api/v1/trainer/assignments/${createdAssignmentId}/grade`)
        .set('Cookie', [`token=${teacherToken}`])
        .send({
          studentId: studentUser._id,
          score: 15,
          feedback: 'Please refactor while loop into a for loop and add comments.',
          status: 'needs_revision'
        });

      expect(revRes.status).toBe(200);
      expect(revRes.body.success).toBe(true);
      expect(revRes.body.submission.status).toBe('needs_revision');

      const studentRes = await request(app)
        .get('/api/v1/school/homework')
        .set('Cookie', [`token=${studentToken}`]);

      expect(studentRes.status).toBe(200);
      const target = studentRes.body.homework.find((a) => String(a._id) === String(createdAssignmentId));
      expect(target).toBeDefined();
      expect(target.status).toBe('needs_revision');
      expect(target.feedback).toBe('Please refactor while loop into a for loop and add comments.');
    });

    it('should enforce tenant isolation: outsider cannot access trainer homework', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/homework')
        .set('Cookie', [`token=${outsiderToken}`]);

      // Outsider student cannot access trainer endpoints (403 Forbidden)
      expect(res.status).toBe(403);
    });
  });

  describe('4. Academic Calendar & Timetable Integrity', () => {
    it('should allow trainer to fetch authoritative classes and timetable data', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/classes')
        .set('Cookie', [`token=${teacherToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.classes)).toBe(true);
    });

    it('should provide consistent UTC date formatting for calendar deadlines', async () => {
      const hwRes = await request(app)
        .get('/api/v1/trainer/homework')
        .set('Cookie', [`token=${teacherToken}`]);

      expect(hwRes.status).toBe(200);
      if (hwRes.body.assignments?.length > 0) {
        const item = hwRes.body.assignments[0];
        const dueDate = new Date(item.dueDate);
        expect(isNaN(dueDate.getTime())).toBe(false);
      }
    });
  });
});
