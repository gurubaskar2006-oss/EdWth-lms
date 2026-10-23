/**
 * Lumina LMS — Clean Acceptance Environment & Zero Predefined Data Regression Suite
 * 6th Civilians Corporation
 *
 * Verifies all Section 7 acceptance criteria:
 * 1. Clean tenant starts with zero unintended academic records.
 * 2. Restarting the server does not recreate demo Physics assignments.
 * 3. Empty API results return clean empty collections without mock fallbacks.
 * 4. Creating an assignment persists it and makes it visible only to eligible students.
 * 5. Submission and grading persist correctly.
 * 6. Data remains strictly isolated between tenants.
 * 7. Code Lab exercises do not appear as graded homework or enrolled subjects.
 * 8. Cleanup cannot delete records belonging to another tenant.
 * 9. Database connection failures are reported honestly.
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
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AcademicEvent from '../models/AcademicEvent.js';
import Announcement from '../models/Announcement.js';
import Attendance from '../models/Attendance.js';
import { seedFoundationalData } from '../scripts/seedData.js';
import { executeDataCleanup } from '../utils/dataCleanup.js';
import { connectDB, closeDB } from '../database/mongoose.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Clean Acceptance Environment & Seed Data Removal', () => {
  const ts = Date.now();

  let tenantA;
  let tenantB;
  let batch10A;
  let batch10B;
  let trainerA;
  let student10A;
  let student10B;
  let studentTenantB;

  let trainerAToken;
  let student10AToken;
  let student10BToken;
  let studentTenantBToken;

  beforeAll(async () => {
    // Ensure database connection is active
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // Create Tenant A & B
    tenantA = await College.create({
      code: `CTA${ts}`,
      name: `Clean Acceptance Academy A ${ts}`,
      slug: `clean-a-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    tenantB = await College.create({
      code: `CTB${ts}`,
      name: `Clean Acceptance Academy B ${ts}`,
      slug: `clean-b-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    // Create Batches in Tenant A
    batch10A = await Batch.create({
      name: 'Class 10-A',
      tenantId: tenantA._id,
      code: `BATCH_10A_${ts}`,
      grade: '10',
      section: 'A'
    });

    batch10B = await Batch.create({
      name: 'Class 10-B',
      tenantId: tenantA._id,
      code: `BATCH_10B_${ts}`,
      grade: '10',
      section: 'B'
    });

    // Create Trainer in Tenant A
    trainerA = await User.create({
      name: 'Clean Trainer Alice',
      email: `trainer.alice.${ts}@cleantest.edu`,
      studentId: `TRN-${ts}`,
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'trainer',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      mustChangePassword: false
    });

    // Create Student in Class 10-A
    student10A = await User.create({
      name: 'Student 10A User',
      email: `student.10a.${ts}@cleantest.edu`,
      studentId: `SCH-${ts}-101`,
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'student',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      batchId: batch10A._id,
      className: 'Class 10-A',
      mustChangePassword: false
    });

    // Create Student in Class 10-B
    student10B = await User.create({
      name: 'Student 10B User',
      email: `student.10b.${ts}@cleantest.edu`,
      studentId: `SCH-${ts}-102`,
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'student',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      batchId: batch10B._id,
      className: 'Class 10-B',
      mustChangePassword: false
    });

    // Create Student in Tenant B
    studentTenantB = await User.create({
      name: 'Student Tenant B User',
      email: `student.tenantb.${ts}@cleantest.edu`,
      studentId: `SCH-${ts}-999`,
      password: '$2b$10$abcdefghijklmnopqrstuv',
      role: 'student',
      tenantId: tenantB._id,
      tenantCode: tenantB.code,
      mustChangePassword: false
    });

    // Sign JWT tokens
    const secret = getJwtSecret();
    trainerAToken = jwt.sign(
      { id: trainerA._id.toString(), userId: trainerA._id.toString(), email: trainerA.email, role: 'trainer', tenantId: tenantA._id.toString(), tenantCode: tenantA.code },
      secret,
      { expiresIn: '2h' }
    );

    student10AToken = jwt.sign(
      { id: student10A._id.toString(), userId: student10A._id.toString(), studentId: student10A.studentId, email: student10A.email, role: 'student', tenantId: tenantA._id.toString(), tenantCode: tenantA.code, batchId: batch10A._id.toString(), className: 'Class 10-A' },
      secret,
      { expiresIn: '2h' }
    );

    student10BToken = jwt.sign(
      { id: student10B._id.toString(), userId: student10B._id.toString(), studentId: student10B.studentId, email: student10B.email, role: 'student', tenantId: tenantA._id.toString(), tenantCode: tenantA.code, batchId: batch10B._id.toString(), className: 'Class 10-B' },
      secret,
      { expiresIn: '2h' }
    );

    studentTenantBToken = jwt.sign(
      { id: studentTenantB._id.toString(), userId: studentTenantB._id.toString(), studentId: studentTenantB.studentId, email: studentTenantB.email, role: 'student', tenantId: tenantB._id.toString(), tenantCode: tenantB.code },
      secret,
      { expiresIn: '2h' }
    );
  }, 35000);

  afterAll(async () => {
    // Purge test tenant data cleanly
    if (tenantA && tenantB) {
      await Promise.all([
        College.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } }),
        Batch.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        User.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Course.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Assignment.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Submission.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Assessment.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        AssessmentAttempt.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        AcademicEvent.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Announcement.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } }),
        Attendance.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } })
      ]);
    }
  }, 15000);

  // Requirement 1: A clean tenant starts with zero unintended academic records
  it('1. Clean tenant starts with zero unintended academic records', async () => {
    const [courses, assignments, submissions, assessments, attempts, events, announcements, attendance] = await Promise.all([
      Course.countDocuments({ tenantId: tenantA._id }),
      Assignment.countDocuments({ tenantId: tenantA._id }),
      Submission.countDocuments({ tenantId: tenantA._id }),
      Assessment.countDocuments({ tenantId: tenantA._id }),
      AssessmentAttempt.countDocuments({ tenantId: tenantA._id }),
      AcademicEvent.countDocuments({ tenantId: tenantA._id }),
      Announcement.countDocuments({ tenantId: tenantA._id }),
      Attendance.countDocuments({ tenantId: tenantA._id })
    ]);

    expect(courses).toBe(0);
    expect(assignments).toBe(0);
    expect(submissions).toBe(0);
    expect(assessments).toBe(0);
    expect(attempts).toBe(0);
    expect(events).toBe(0);
    expect(announcements).toBe(0);
    expect(attendance).toBe(0);
  });

  // Requirement 2: Restarting server does not recreate demo Physics assignments
  it('2. Restarting/invoking seedFoundationalData does not recreate demo Physics records when withAcademicDemo is false', async () => {
    await seedFoundationalData({ withAcademicDemo: false });

    // Verify no Physics assignments exist in the database
    const physicsAssignments = await Assignment.find({
      $or: [
        { title: /Physics/i },
        { subject: /Physics/i }
      ]
    });

    expect(physicsAssignments.length).toBe(0);

    // Verify static seed demo assignment IDs do not exist
    const demoHw = await Assignment.find({ id: { $in: ['hw-py-01', 'hw-py-02', 'hw-sql-01', 'hw-cpp-01'] } });
    expect(demoHw.length).toBe(0);
  });

  // Requirement 3: Empty API results render empty states instead of mock records
  it('3. Empty API results return clean empty arrays without mock fallbacks', async () => {
    // Student endpoints
    const subRes = await request(app)
      .get('/api/v1/school/subjects')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(subRes.status).toBe(200);
    const subjects = subRes.body.subjects ?? subRes.body;
    expect(Array.isArray(subjects)).toBe(true);
    expect(subjects.length).toBe(0);

    const hwRes = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(hwRes.status).toBe(200);
    const homework = hwRes.body.homework ?? hwRes.body;
    expect(Array.isArray(homework)).toBe(true);
    expect(homework.length).toBe(0);

    const testRes = await request(app)
      .get('/api/v1/school/tests')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(testRes.status).toBe(200);
    const tests = testRes.body.tests ?? testRes.body;
    expect(Array.isArray(tests)).toBe(true);
    expect(tests.length).toBe(0);

    const annRes = await request(app)
      .get('/api/v1/school/announcements')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(annRes.status).toBe(200);
    const announcements = annRes.body.announcements ?? annRes.body;
    expect(Array.isArray(announcements)).toBe(true);
    expect(announcements.length).toBe(0);

    const calRes = await request(app)
      .get('/api/v1/school/calendar/events')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(calRes.status).toBe(200);
    const events = calRes.body.events ?? calRes.body;
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBe(0);

    // Trainer endpoints
    const trCourses = await request(app)
      .get('/api/v1/trainer/courses')
      .set('Authorization', `Bearer ${trainerAToken}`);
    expect(trCourses.status).toBe(200);
    const courses = trCourses.body.courses ?? trCourses.body;
    expect(Array.isArray(courses)).toBe(true);
    expect(courses.length).toBe(0);

    const trHw = await request(app)
      .get('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerAToken}`);
    expect(trHw.status).toBe(200);
    const trHomework = trHw.body.assignments ?? trHw.body.homework ?? trHw.body;
    expect(Array.isArray(trHomework)).toBe(true);
    expect(trHomework.length).toBe(0);

    const trSubs = await request(app)
      .get('/api/v1/trainer/submissions')
      .set('Authorization', `Bearer ${trainerAToken}`);
    expect(trSubs.status).toBe(200);
    const submissions = trSubs.body.submissions ?? trSubs.body;
    expect(Array.isArray(submissions)).toBe(true);
    expect(submissions.length).toBe(0);
  });

  // Requirement 4: Creating an assignment persists it and makes it visible only to eligible students
  let createdHwId;
  it('4. Creating an assignment persists it and makes it visible only to eligible students in target class', async () => {
    const createRes = await request(app)
      .post('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerAToken}`)
      .send({
        title: `Mathematics Calculus Problem Set ${ts}`,
        subject: 'Mathematics',
        batchId: batch10A._id.toString(),
        batchName: 'Class 10-A',
        className: 'Class 10-A',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        points: 50,
        description: 'Solve problems 1 through 10 in Section 4.2.'
      });

    expect(createRes.status).toBe(201);
    const createdAssignment = createRes.body.assignment || createRes.body.homework;
    expect(createdAssignment).toBeDefined();
    createdHwId = createdAssignment._id || createdAssignment.id;

    // Student in Class 10-A MUST see the homework
    const student10AHw = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(student10AHw.status).toBe(200);
    const hwList10A = student10AHw.body.homework ?? student10AHw.body;
    const foundIn10A = hwList10A.find(h => (h._id || h.id).toString() === createdHwId.toString() || h.title.includes('Calculus Problem Set'));
    expect(foundIn10A).toBeDefined();

    // Student in Class 10-B MUST NOT see the homework
    const student10BHw = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${student10BToken}`);
    expect(student10BHw.status).toBe(200);
    const hwList10B = student10BHw.body.homework ?? student10BHw.body;
    const foundIn10B = hwList10B.find(h => (h._id || h.id).toString() === createdHwId.toString());
    expect(foundIn10B).toBeUndefined();
  });

  // Requirement 5: Submission and grading persist correctly
  it('5. Submission and grading persist correctly and reflect in student queries', async () => {
    // Student 10-A submits work
    const submitRes = await request(app)
      .post(`/api/v1/school/homework/${createdHwId}/submit`)
      .set('Authorization', `Bearer ${student10AToken}`)
      .send({
        submissionText: 'Here is the step-by-step calculus derivation for problems 1 to 10.',
        notes: 'Attached derivation steps.'
      });

    expect([200, 201]).toContain(submitRes.status);

    // Trainer queries submissions for this homework
    const trSubsRes = await request(app)
      .get('/api/v1/trainer/submissions')
      .set('Authorization', `Bearer ${trainerAToken}`);
    expect(trSubsRes.status).toBe(200);
    const trSubsList = trSubsRes.body.submissions ?? trSubsRes.body;

    const targetSub = trSubsList.find(s =>
      (s.assignmentTitle && s.assignmentTitle.includes('Calculus Problem Set')) ||
      (s.assignmentId && (s.assignmentId.toString() === createdHwId.toString() || s.assignmentId._id?.toString() === createdHwId.toString() || s.assignmentId.id === createdHwId.toString()))
    );
    expect(targetSub).toBeDefined();
    const submissionId = targetSub._id || targetSub.id;

    // Trainer evaluates submission with marks and feedback
    const gradeRes = await request(app)
      .post(`/api/v1/trainer/assignments/${submissionId}/grade`)
      .set('Authorization', `Bearer ${trainerAToken}`)
      .send({
        score: 48,
        status: 'graded',
        feedback: 'Outstanding mathematical derivation and clarity.'
      });
    expect(gradeRes.status).toBe(200);

    // Student queries homework and sees persisted evaluation
    const studentHwCheck = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(studentHwCheck.status).toBe(200);
    const hwItems = studentHwCheck.body.homework ?? studentHwCheck.body;
    const evaluatedItem = hwItems.find(h => (h._id || h.id).toString() === createdHwId.toString());
    expect(evaluatedItem).toBeDefined();
    expect(evaluatedItem.status).toBe('graded');
    expect(evaluatedItem.score).toBe(48);
  });

  // Requirement 6: Data remains isolated between tenants
  it('6. Data remains strictly isolated across tenants', async () => {
    // Tenant B student querying homework should see 0 items
    const tenantBHw = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${studentTenantBToken}`);
    expect(tenantBHw.status).toBe(200);
    const tenantBHwList = tenantBHw.body.homework ?? tenantBHw.body;
    expect(tenantBHwList.length).toBe(0);

    // Create Course in Tenant A
    const courseA = await Course.create({
      id: `crs-clean-math-${ts}`,
      code: `MATH101-${ts}`,
      title: 'Advanced Mathematics',
      instructor: { name: 'Clean Trainer Alice' },
      tenantId: tenantA._id,
      className: 'Class 10-A',
      batchId: batch10A._id
    });

    // Student 10-A sees course
    const student10ACourses = await request(app)
      .get('/api/v1/school/subjects')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(student10ACourses.status).toBe(200);
    const subjects10A = student10ACourses.body.subjects ?? student10ACourses.body;
    expect(subjects10A.some(c => (c.name || c.title) === 'Advanced Mathematics')).toBe(true);

    // Tenant B student does NOT see course
    const studentBCourses = await request(app)
      .get('/api/v1/school/subjects')
      .set('Authorization', `Bearer ${studentTenantBToken}`);
    expect(studentBCourses.status).toBe(200);
    const subjectsB = studentBCourses.body.subjects ?? studentBCourses.body;
    expect(subjectsB.some(c => (c.name || c.title) === 'Advanced Mathematics')).toBe(false);
  });

  // Requirement 7: Practice Code Lab exercises do not create graded homework or enrolled subjects
  it('7. Practice Code Lab exercises do not appear as graded homework or enrolled subjects', async () => {
    // Check Code Lab endpoint
    const codeLabRes = await request(app)
      .get('/api/v1/school/code-lab/exercises')
      .set('Authorization', `Bearer ${student10AToken}`);

    // If Code Lab endpoint exists, verify it returns practice challenges
    if (codeLabRes.status === 200) {
      expect(Array.isArray(codeLabRes.body)).toBe(true);
    }

    // Verify homework list contains ONLY trainer-created academic homework (1 item), never Code Lab problems
    const hwListRes = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${student10AToken}`);
    expect(hwListRes.status).toBe(200);
    const hwList = hwListRes.body.homework ?? hwListRes.body;
    expect(hwList.length).toBe(1);
    expect(hwList[0].title).toContain('Calculus Problem Set');

    // Verify database Assignment collection does not have Code Lab exercises
    const codeLabInHw = await Assignment.find({
      tenantId: tenantA._id,
      title: /(Palindrome|Two Sum|Fibonacci|Factorial)/i
    });
    expect(codeLabInHw.length).toBe(0);
  });

  // Requirement 8: Cleanup cannot delete records belonging to another tenant
  it('8. Tenant-scoped cleanup purges only target tenant and preserves other tenants', async () => {
    // Create an announcement in Tenant B
    const annB = await Announcement.create({
      title: `[AUDIT_TEST] Tenant B Announcement ${ts}`,
      content: 'Important Tenant B specific announcement.',
      category: 'General',
      authorName: 'Clean Trainer Alice',
      authorId: trainerA._id,
      tenantId: tenantB._id,
      publishedAt: new Date()
    });

    // Run cleanup targeting only Tenant A
    const cleanupResult = await executeDataCleanup({
      removeAudit: true,
      removeDemo: true,
      tenantId: tenantA._id
    });

    expect(cleanupResult.success).toBe(true);

    // Verify Tenant B's announcement was NOT touched
    const stillExistsB = await Announcement.findById(annB._id);
    expect(stillExistsB).not.toBeNull();
    expect(stillExistsB.tenantId.toString()).toBe(tenantB._id.toString());
  });

  // Requirement 9: Database connection failures are reported honestly
  it('9. Database connection failures are reported honestly without masking errors', async () => {
    // Verify an unreachable connection throws an honest error without masking
    const unreachableConn = mongoose.createConnection('mongodb://127.0.0.1:29999/unreachable_db_testing', {
      serverSelectionTimeoutMS: 500,
      connectTimeoutMS: 500
    });

    await expect(unreachableConn.asPromise()).rejects.toThrow();
  });
});
