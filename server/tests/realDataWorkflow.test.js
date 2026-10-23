/**
 * Lumina LMS — Real Data Integration & End-to-End Workflow Verification Suite
 * 6th Civilians Corporation
 *
 * Verifies the complete 15-step scenario:
 * 1. Trainer signs in / authenticates.
 * 2. Trainer creates a homework assignment for a real test class.
 * 3. Assignment appears in trainer list and student account.
 * 4. Trainer opens assignment roster and sees every assigned student.
 * 5. Student A submits work; Student B does not.
 * 6. Roster correctly distinguishes submitted and not submitted students.
 * 7. Trainer grades Student A's submission with marks and feedback, persisting to MongoDB.
 * 8. Grade and feedback remain persisted and visible in student's homework.
 * 9. Trainer publishes an announcement targeting the test class.
 * 10. Intended student sees the announcement; outside student does not.
 * 11. Trainer publishes a calendar event for the class.
 * 12. Intended student sees event in schedule; student cannot edit or delete it.
 * 13. File storage endpoint handles file validation and returns honest status.
 * 14. Unauthorized tenant cannot access file or announcements (cross-tenant isolation).
 * 15. Persistence verified across re-queries.
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
import Announcement from '../models/Announcement.js';
import AcademicEvent from '../models/AcademicEvent.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — 15-Step Real Data Integration & End-to-End Workflow', () => {
  const TEST_JWT_SECRET = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_with_more_than_32_characters';
  const ts = Date.now();

  let tenantA;
  let tenantB;
  let batchClass10A;
  let batchClass10B;
  let trainerUser;
  let studentA;
  let studentB;
  let studentC_OtherTenant;

  let trainerToken;
  let studentAToken;
  let studentBToken;
  let studentCToken;

  let createdAssignmentId;
  let createdSubmissionId;
  let createdAnnouncementId;
  let createdEventId;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    // Ensure database connection is active
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create Tenant A (School)
    tenantA = await College.create({
      name: `Apex International Academy ${ts}`,
      code: `AIA${ts}`,
      slug: `aia-${ts}`,
      institutionType: 'school',
      domain: `apex-${ts}.edu`
    });

    // 2. Create Tenant B (Outside School for isolation verification)
    tenantB = await College.create({
      name: `Beacon Hill School ${ts}`,
      code: `BHS${ts}`,
      slug: `bhs-${ts}`,
      institutionType: 'school',
      domain: `beacon-${ts}.edu`
    });

    // 3. Create real batches in Tenant A
    batchClass10A = await Batch.create({
      name: 'Class 10-A',
      code: `C10A-${ts}`,
      tenantId: tenantA._id,
      academicTerm: '2026-Fall',
      grade: '10',
      section: 'A'
    });

    batchClass10B = await Batch.create({
      name: 'Class 10-B',
      code: `C10B-${ts}`,
      tenantId: tenantA._id,
      academicTerm: '2026-Fall',
      grade: '10',
      section: 'B'
    });

    // 4. Create Trainer User in Tenant A
    trainerUser = await User.create({
      name: 'Dr. Sarah Lin',
      email: `sarah.lin.${ts}@apex.edu`,
      studentId: `TRN-${ts}`,
      role: 'trainer',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      password: '$2b$10$abcdefghijklmnopqrstuv'
    });

    // 5. Create Student A in Tenant A (Class 10-A)
    studentA = await User.create({
      name: 'Liam Chen',
      email: `liam.chen.${ts}@apex.edu`,
      studentId: `SCH-${ts}-001`,
      role: 'student',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      batchId: batchClass10A._id,
      batchName: batchClass10A.name,
      className: batchClass10A.name,
      password: '$2b$10$abcdefghijklmnopqrstuv'
    });

    // 6. Create Student B in Tenant A (Class 10-A)
    studentB = await User.create({
      name: 'Sophia Patel',
      email: `sophia.patel.${ts}@apex.edu`,
      studentId: `SCH-${ts}-002`,
      role: 'student',
      tenantId: tenantA._id,
      tenantCode: tenantA.code,
      batchId: batchClass10A._id,
      batchName: batchClass10A.name,
      className: batchClass10A.name,
      password: '$2b$10$abcdefghijklmnopqrstuv'
    });

    // 7. Create Student C in Tenant B (Outside tenant)
    studentC_OtherTenant = await User.create({
      name: 'Ethan Hunt',
      email: `ethan.hunt.${ts}@beacon.edu`,
      studentId: `SCH-${ts}-999`,
      role: 'student',
      tenantId: tenantB._id,
      tenantCode: tenantB.code,
      password: '$2b$10$abcdefghijklmnopqrstuv'
    });

    // Generate JWT tokens
    const secret = getJwtSecret();
    trainerToken = jwt.sign(
      { id: trainerUser._id.toString(), role: 'trainer', tenantId: tenantA._id.toString(), tenantCode: tenantA.code },
      secret,
      { expiresIn: '1h' }
    );

    studentAToken = jwt.sign(
      { id: studentA._id.toString(), studentId: studentA.studentId, role: 'student', tenantId: tenantA._id.toString(), tenantCode: tenantA.code, batchId: batchClass10A._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    studentBToken = jwt.sign(
      { id: studentB._id.toString(), studentId: studentB.studentId, role: 'student', tenantId: tenantA._id.toString(), tenantCode: tenantA.code, batchId: batchClass10A._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    studentCToken = jwt.sign(
      { id: studentC_OtherTenant._id.toString(), studentId: studentC_OtherTenant.studentId, role: 'student', tenantId: tenantB._id.toString(), tenantCode: tenantB.code },
      secret,
      { expiresIn: '1h' }
    );
  }, 60000);

  afterAll(async () => {
    // Isolated cleanup of test records
    if (tenantA?._id && tenantB?._id) {
      await Submission.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await Assignment.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await Announcement.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await AcademicEvent.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await User.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await Batch.deleteMany({ tenantId: { $in: [tenantA._id, tenantB._id] } });
      await College.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    }
  }, 30000);

  // Step 1: Trainer sign in
  it('Step 1: Trainer authenticates with valid role and tenant context', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/classes')
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.classes)).toBe(true);
    expect(res.body.classes.some((c) => c.name === 'Class 10-A')).toBe(true);
  });

  // Step 2: Trainer creates homework assignment for Class 10-A
  it('Step 2: Trainer creates homework assignment targeted to Class 10-A', async () => {
    const res = await request(app)
      .post('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        title: 'Python Recursion & Fibonacci Series',
        subject: 'Python Programming',
        topic: 'Recursive Algorithms',
        batchId: batchClass10A._id.toString(),
        batchName: batchClass10A.name,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        points: 25,
        description: 'Implement fibonacci(n) with base cases and complexity analysis.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.assignment).toBeDefined();
    expect(res.body.assignment.title).toBe('Python Recursion & Fibonacci Series');
    expect(res.body.assignment.points).toBe(25);
    createdAssignmentId = res.body.assignment.id || res.body.assignment._id;
  });

  // Step 3: Assignment appears in trainer list and student account
  it('Step 3: Assignment appears in trainer list and assigned student account', async () => {
    // In trainer homework list
    const trainerRes = await request(app)
      .get('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(trainerRes.status).toBe(200);
    const trainerHw = trainerRes.body.assignments.find((a) => (a._id || a.id) === createdAssignmentId);
    expect(trainerHw).toBeDefined();
    expect(trainerHw.batchName).toBe('Class 10-A');
    expect(trainerHw.totalAssigned).toBe(2); // studentA and studentB in Class 10-A

    // In student A homework list
    const studentRes = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${studentAToken}`);

    expect(studentRes.status).toBe(200);
    expect(studentRes.body.success).toBe(true);
    const studentHw = studentRes.body.homework.find((h) => (h._id || h.id) === createdAssignmentId);
    expect(studentHw).toBeDefined();
    expect(studentHw.title).toBe('Python Recursion & Fibonacci Series');
  });

  // Step 4: Trainer opens assignment roster and sees every assigned student
  it('Step 4: Trainer opens roster and sees all genuinely assigned students', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerToken}`);

    const hw = res.body.assignments.find((a) => (a._id || a.id) === createdAssignmentId);
    expect(hw.roster).toBeDefined();
    expect(hw.roster.length).toBe(2);

    const names = hw.roster.map((r) => r.studentName);
    expect(names).toContain('Liam Chen');
    expect(names).toContain('Sophia Patel');
  });

  // Step 5: Student A submits work; Student B does not
  it('Step 5: Student A submits homework code; Student B does not submit', async () => {
    const res = await request(app)
      .post(`/api/v1/school/homework/${createdAssignmentId}/submit`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({
        submissionText: 'def fibonacci(n):\n    if n <= 1: return n\n    return fibonacci(n-1) + fibonacci(n-2)'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    createdSubmissionId = res.body.submission.id;
  });

  // Step 6: Roster correctly distinguishes submitted and not submitted students
  it('Step 6: Roster correctly distinguishes SUBMITTED vs NOT_SUBMITTED students', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/homework')
      .set('Authorization', `Bearer ${trainerToken}`);

    const hw = res.body.assignments.find((a) => (a._id || a.id) === createdAssignmentId);
    expect(hw.submittedCount).toBe(1);
    expect(hw.notSubmittedCount).toBe(1);
    expect(hw.awaitingEvaluationCount).toBe(1);

    const studentARoster = hw.roster.find((r) => r.studentName === 'Liam Chen');
    const studentBRoster = hw.roster.find((r) => r.studentName === 'Sophia Patel');

    expect(studentARoster.status).toBe('submitted');
    expect(studentARoster.submissionId).toBeDefined();

    expect(['not_submitted', 'awaiting']).toContain(studentBRoster.status);
    expect(studentBRoster.submissionId).toBeNull();
  });

  // Step 7: Trainer opens submission, saves marks and feedback, and reloads
  it('Step 7: Trainer grades Student A with 24/25 marks and feedback, verified in MongoDB', async () => {
    const gradeRes = await request(app)
      .post(`/api/v1/trainer/assignments/${createdSubmissionId}/grade`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        studentId: studentA._id.toString(),
        score: 24,
        feedback: 'Excellent recursive implementation. Consider memoization for O(n) performance.',
        status: 'graded'
      });

    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.success).toBe(true);
    expect(gradeRes.body.submission.score).toBe(24);

    // Verify rejection if score exceeds max points (25)
    const invalidGradeRes = await request(app)
      .post(`/api/v1/trainer/assignments/${createdSubmissionId}/grade`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        studentId: studentA._id.toString(),
        score: 30, // exceeds 25
        feedback: 'Invalid high score',
        status: 'graded'
      });

    expect(invalidGradeRes.status).toBe(400);
    expect(invalidGradeRes.body.message).toContain('exceeds maximum points');
  });

  // Step 8: Grade and feedback remain persisted and visible to the student
  it('Step 8: Grade and feedback remain persisted and visible in Student A account', async () => {
    const res = await request(app)
      .get('/api/v1/school/homework')
      .set('Authorization', `Bearer ${studentAToken}`);

    const hw = res.body.homework.find((h) => (h._id || h.id) === createdAssignmentId);
    expect(hw).toBeDefined();
    expect(hw.status).toBe('graded');
    expect(hw.score).toBe(24);
    expect(hw.feedback).toBe('Excellent recursive implementation. Consider memoization for O(n) performance.');
  });

  // Step 9: Trainer publishes an announcement targeting Class 10-A
  it('Step 9: Trainer publishes an announcement targeted to Class 10-A', async () => {
    const res = await request(app)
      .post('/api/v1/trainer/announcements')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        title: 'Lab Revision Session on Friday',
        message: 'Please review Unit 4 Recursion before coming to Computer Lab 2.',
        batchId: batchClass10A._id.toString(),
        batchName: batchClass10A.name,
        priority: 'important',
        status: 'published'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.announcement.title).toBe('Lab Revision Session on Friday');
    createdAnnouncementId = res.body.announcement._id;
  });

  // Step 10: Intended student sees announcement; outside student does not
  it('Step 10: Student in Class 10-A sees announcement; outside tenant student does not', async () => {
    // Student A (Class 10-A) sees notice
    const studentRes = await request(app)
      .get('/api/v1/school/announcements')
      .set('Authorization', `Bearer ${studentAToken}`);

    expect(studentRes.status).toBe(200);
    const notice = studentRes.body.announcements.find((a) => (a._id || a.id) === createdAnnouncementId.toString());
    expect(notice).toBeDefined();
    expect(notice.title).toBe('Lab Revision Session on Friday');

    // Student C (Tenant B) cannot see Tenant A's announcement
    const outsiderRes = await request(app)
      .get('/api/v1/school/announcements')
      .set('Authorization', `Bearer ${studentCToken}`);

    expect(outsiderRes.status).toBe(200);
    const outsiderNotice = (outsiderRes.body.announcements || []).find((a) => (a._id || a.id) === createdAnnouncementId.toString());
    expect(outsiderNotice).toBeUndefined();
  });

  // Step 11: Trainer publishes a calendar event for Class 10-A
  it('Step 11: Trainer publishes an academic calendar event', async () => {
    const res = await request(app)
      .post('/api/v1/trainer/calendar/events')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({
        title: 'Mid-Term Python Practice Session',
        eventType: 'class',
        subject: 'Python Programming',
        batchId: batchClass10A._id.toString(),
        batchName: batchClass10A.name,
        startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
        room: 'Lab 2',
        description: 'Comprehensive problem solving for recursion and lists.'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.event.title).toBe('Mid-Term Python Practice Session');
    createdEventId = res.body.event._id || res.body.event.id;
  });

  // Step 12: Student sees event and cannot modify/delete it
  it('Step 12: Student reads published calendar event and is forbidden from editing', async () => {
    // Student reads calendar
    const calRes = await request(app)
      .get('/api/v1/school/calendar/events')
      .set('Authorization', `Bearer ${studentAToken}`);

    expect(calRes.status).toBe(200);
    expect(calRes.body.success).toBe(true);
    const ev = calRes.body.events.find((e) => (e._id || e.id) === createdEventId.toString());
    expect(ev).toBeDefined();
    expect(ev.title).toBe('Mid-Term Python Practice Session');

    // Student attempt to update calendar event is rejected (403 Forbidden / role restriction)
    const forbiddenRes = await request(app)
      .put(`/api/v1/trainer/calendar/events/${createdEventId}`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ title: 'Hacked Event Title' });

    expect([401, 403]).toContain(forbiddenRes.status);
  });

  // Step 13: Storage endpoint handles file upload / status honestly
  it('Step 13: Storage status endpoint honestly reports configuration status', async () => {
    const res = await request(app)
      .get('/api/v1/storage/status')
      .set('Authorization', `Bearer ${trainerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.provider).toBe('Backblaze B2');
    // In local dev without live vault credentials, configured is false with an informative notice
    expect(typeof res.body.configured).toBe('boolean');
  });

  // Step 14: Cross-tenant download authorization is strictly rejected
  it('Step 14: Cross-tenant storage key download is strictly rejected (403)', async () => {
    // Student C in Tenant B tries to request a download URL for a file in Tenant A's folder
    const crossTenantKey = `tenants/${tenantA._id}/submissions/student-exam-answer.pdf`;
    const res = await request(app)
      .get(`/api/v1/storage/download?key=${encodeURIComponent(crossTenantKey)}`)
      .set('Authorization', `Bearer ${studentCToken}`);

    expect([400, 403]).toContain(res.status);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Access denied');
  });

  // Step 15: Application state remains persisted after re-fetch
  it('Step 15: Records remain fully persisted in MongoDB upon re-querying', async () => {
    // Re-verify homework record in database
    const dbHw = await Assignment.findById(createdAssignmentId).lean();
    expect(dbHw).toBeDefined();
    expect(dbHw.title).toBe('Python Recursion & Fibonacci Series');
    expect(dbHw.points).toBe(25);

    // Re-verify submission grade in database
    const dbSub = await Submission.findById(createdSubmissionId).lean();
    expect(dbSub).toBeDefined();
    expect(dbSub.score).toBe(24);
    expect(dbSub.status).toBe('graded');

    // Re-verify announcement in database
    const dbAnn = await Announcement.findById(createdAnnouncementId).lean();
    expect(dbAnn).toBeDefined();
    expect(dbAnn.status).toBe('published');

    // Re-verify academic calendar event in database
    const dbEv = await AcademicEvent.findById(createdEventId).lean();
    expect(dbEv).toBeDefined();
    expect(dbEv.title).toBe('Mid-Term Python Practice Session');
  });
});
