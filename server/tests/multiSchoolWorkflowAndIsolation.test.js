/**
 * Lumina LMS — Multi-School Training Workflow, Scheduling & Data Isolation Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Multi-School Admin Management: registration, cohort scheduling with session hours, class counts (Class 11 & 12).
 * 2. School-Scoped Student Leaderboard: strict school isolation, cross-school query tampering rejected with 403.
 * 3. Accurate Scoring & Data Integrity: real persisted records, proper handling of evaluated vs. ungraded attempts.
 * 4. Cross-School Comparison Benchmark for Platform Admin without student identity leakage.
 * 5. Historical Record Preservation when a training cohort is marked completed.
 * 6. RBAC Role Boundaries: student and trainer rejected from cross-school admin operations.
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
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Attendance from '../models/Attendance.js';

describe('Lumina LMS — Multi-School Training Workflow & Isolation Test Suite', () => {
  const TEST_JWT_SECRET = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_with_more_than_32_characters';

  let schoolA;
  let schoolB;
  let cohortA;
  let cohortB;
  let studentA1;
  let studentA2;
  let studentB1;
  let trainerA;
  let platformAdmin;

  let studentA1Token;
  let studentB1Token;
  let trainerAToken;
  let platformAdminToken;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;

    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }

    const testRunId = Date.now();

    // 1. Create Participating Schools
    schoolA = await College.create({
      name: `Delhi Public School ${testRunId}`,
      code: `DPS-${testRunId}`,
      slug: `dps-${testRunId}`,
      institutionType: 'school',
      status: 'active'
    });

    schoolB = await College.create({
      name: `Oakridge High School ${testRunId}`,
      code: `OAK-${testRunId}`,
      slug: `oak-${testRunId}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create Cohorts with configurable session hours
    cohortA = await Batch.create({
      name: `DPS Class 11 Cohort A`,
      tenantId: schoolA._id,
      targetClass: 'Class 11',
      sessionStartTime: '11:00 AM',
      sessionEndTime: '12:00 PM',
      scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      status: 'active'
    });

    cohortB = await Batch.create({
      name: `Oakridge Class 12 Cohort B`,
      tenantId: schoolB._id,
      targetClass: 'Class 12',
      sessionStartTime: '12:00 PM',
      sessionEndTime: '1:00 PM',
      scheduleDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      status: 'active'
    });

    // 3. Create Users
    platformAdmin = await User.create({
      studentId: `PADM-${testRunId}`,
      name: 'Corporation Platform Admin',
      email: `padmin-${testRunId}@6thcivilians.corp`,
      password: 'HashedPassword123!',
      role: 'superadmin',
      tenantId: null
    });

    trainerA = await User.create({
      studentId: `TRN-${testRunId}`,
      name: 'Lead Trainer Alpha',
      email: `trainer-${testRunId}@lumina.edu`,
      password: 'HashedPassword123!',
      role: 'trainer',
      tenantId: schoolA._id
    });

    studentA1 = await User.create({
      studentId: `DPS-STU1-${testRunId}`,
      name: 'Aarav Sharma',
      email: `aarav-${testRunId}@dps.test`,
      password: 'HashedPassword123!',
      role: 'student',
      tenantId: schoolA._id,
      batchId: cohortA._id,
      className: 'Class 11',
      streakDays: 5
    });

    studentA2 = await User.create({
      studentId: `DPS-STU2-${testRunId}`,
      name: 'Ananya Verma',
      email: `ananya-${testRunId}@dps.test`,
      password: 'HashedPassword123!',
      role: 'student',
      tenantId: schoolA._id,
      batchId: cohortA._id,
      className: 'Class 11',
      streakDays: 3
    });

    studentB1 = await User.create({
      studentId: `OAK-STU1-${testRunId}`,
      name: 'Rohan Gupta',
      email: `rohan-${testRunId}@oakridge.test`,
      password: 'HashedPassword123!',
      role: 'student',
      tenantId: schoolB._id,
      batchId: cohortB._id,
      className: 'Class 12',
      streakDays: 7
    });

    // Generate JWT Tokens
    const signToken = (u, tId) => jwt.sign(
      { id: u._id.toString(), role: u.role, tenantId: tId ? tId.toString() : null },
      TEST_JWT_SECRET,
      { expiresIn: '2h' }
    );

    platformAdminToken = signToken(platformAdmin, null);
    trainerAToken = signToken(trainerA, schoolA._id);
    studentA1Token = signToken(studentA1, schoolA._id);
    studentB1Token = signToken(studentB1, schoolB._id);

    // Persist real verified assessment attempt for studentA1 (Evaluated)
    await AssessmentAttempt.create({
      tenantId: schoolA._id,
      studentId: studentA1._id,
      studentName: studentA1.name,
      studentIdNumber: studentA1.studentId,
      assessmentId: 'test-101',
      assessmentTitle: 'Python Functions Assessment',
      score: 18,
      maxScore: 20,
      percentage: 90,
      status: 'evaluated'
    });

    // Persist an in-progress/ungraded attempt for studentA2 (should not break or be calculated as 0)
    await AssessmentAttempt.create({
      tenantId: schoolA._id,
      studentId: studentA2._id,
      studentName: studentA2.name,
      studentIdNumber: studentA2.studentId,
      assessmentId: 'test-101',
      assessmentTitle: 'Python Functions Assessment',
      score: null,
      maxScore: 20,
      status: 'submitted'
    });

    // Persist verified attendance for studentA1
    await Attendance.create({
      tenantId: schoolA._id,
      batchId: cohortA._id,
      studentId: studentA1._id,
      trainerId: trainerA._id,
      date: new Date(),
      status: 'present'
    });
  });

  afterAll(async () => {
    // Clean up test records
    if (schoolA && schoolB) {
      await Promise.all([
        College.deleteMany({ _id: { $in: [schoolA._id, schoolB._id] } }),
        Batch.deleteMany({ tenantId: { $in: [schoolA._id, schoolB._id] } }),
        User.deleteMany({ tenantId: { $in: [schoolA._id, schoolB._id] } }),
        User.deleteOne({ _id: platformAdmin._id }),
        AssessmentAttempt.deleteMany({ tenantId: { $in: [schoolA._id, schoolB._id] } }),
        Attendance.deleteMany({ tenantId: { $in: [schoolA._id, schoolB._id] } })
      ]);
    }
  });

  describe('1. Multi-School Admin Management & Class Breakdown', () => {
    it('Platform Admin can fetch all participating schools with class counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.schools)).toBe(true);

      const retrievedSchoolA = res.body.schools.find(s => s.id === schoolA._id.toString());
      expect(retrievedSchoolA).toBeDefined();
      expect(retrievedSchoolA.totalStudents).toBe(2);
      expect(retrievedSchoolA.class11Count).toBe(2);
      expect(retrievedSchoolA.class12Count).toBe(0);

      const retrievedSchoolB = res.body.schools.find(s => s.id === schoolB._id.toString());
      expect(retrievedSchoolB).toBeDefined();
      expect(retrievedSchoolB.totalStudents).toBe(1);
      expect(retrievedSchoolB.class12Count).toBe(1);
    });

    it('Platform Admin can configure a new cohort with session hours (11:00 AM - 12:00 PM)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${schoolA._id}/cohorts`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          name: 'DPS Class 11 - Cohort Morning',
          targetClass: 'Class 11',
          sessionStartTime: '11:00 AM',
          sessionEndTime: '12:00 PM',
          scheduleDays: ['Mon', 'Wed', 'Fri'],
          status: 'active'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.batch.sessionStartTime).toBe('11:00 AM');
      expect(res.body.batch.sessionEndTime).toBe('12:00 PM');
      expect(res.body.batch.targetClass).toBe('Class 11');
    });

    it('Completing a cohort preserves historical records', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/schools/${schoolA._id}/cohorts/${cohortA._id}`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .send({
          status: 'completed'
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.batch.status).toBe('completed');
      expect(res.body.batch.isCompleted).toBe(true);

      // Verify attempts and attendance remain untouched
      const attemptsCount = await AssessmentAttempt.countDocuments({ tenantId: schoolA._id });
      expect(attemptsCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. School-Scoped Student Leaderboard & Privacy Isolation', () => {
    it('Student from School A can retrieve their own school leaderboard', async () => {
      const res = await request(app)
        .get('/api/v1/school/leaderboard')
        .set('Authorization', `Bearer ${studentA1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.school.id).toBe(schoolA._id.toString());
      expect(Array.isArray(res.body.leaderboard)).toBe(true);

      // All returned students MUST belong to School A
      const studentIds = res.body.leaderboard.map(s => s.id);
      expect(studentIds).toContain(studentA1._id.toString());
      expect(studentIds).toContain(studentA2._id.toString());
      expect(studentIds).not.toContain(studentB1._id.toString());

      // Student A1 has evaluated score of 90%, rank 1
      const rank1 = res.body.leaderboard.find(s => s.id === studentA1._id.toString());
      expect(rank1.assessmentAverage).toBe(90);
      expect(rank1.rank).toBe(1);
    });

    it('CRITICAL: Student from School A is REJECTED with 403 when tampering with schoolId to view School B', async () => {
      const res = await request(app)
        .get(`/api/v1/school/leaderboard?schoolId=${schoolB._id}`)
        .set('Authorization', `Bearer ${studentA1Token}`)
        .expect(403);

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED_CROSS_SCHOOL_ACCESS');
    });

    it('Student from School B sees only School B students', async () => {
      const res = await request(app)
        .get('/api/v1/school/leaderboard')
        .set('Authorization', `Bearer ${studentB1Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.school.id).toBe(schoolB._id.toString());

      const studentIds = res.body.leaderboard.map(s => s.id);
      expect(studentIds).toContain(studentB1._id.toString());
      expect(studentIds).not.toContain(studentA1._id.toString());
      expect(studentIds).not.toContain(studentA2._id.toString());
    });
  });

  describe('3. Platform Admin Cross-School Comparison & Detailed Inspection', () => {
    it('Platform Admin can view cross-school comparison metrics without student names leaked', async () => {
      const res = await request(app)
        .get('/api/v1/admin/schools/comparison')
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.comparison)).toBe(true);

      const compA = res.body.comparison.find(c => c.schoolId === schoolA._id.toString());
      expect(compA).toBeDefined();
      expect(compA.totalStudents).toBe(2);
      expect(compA.class11Count).toBe(2);
      expect(compA.metrics.averageAssessmentScore).toBe(90);

      // Verify individual student names are NOT present in comparison
      expect(compA.students).toBeUndefined();
    });

    it('Platform Admin can inspect a specific school leaderboard', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/schools/${schoolA._id}/leaderboard`)
        .set('Authorization', `Bearer ${platformAdminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.school.id).toBe(schoolA._id.toString());
      expect(res.body.leaderboard.length).toBe(2);
    });
  });

  describe('4. RBAC Role Boundaries & Cross-School Security', () => {
    it('Student is rejected with 403 when trying to access admin schools endpoints', async () => {
      await request(app)
        .get('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${studentA1Token}`)
        .expect(403);
    });

    it('Trainer is rejected with 403 when trying to register a new school', async () => {
      await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ name: 'Unauthorized School', code: 'UNAUTH' })
        .expect(403);
    });

    it('Trainer is rejected with 403 when trying to access cross-school comparison', async () => {
      await request(app)
        .get('/api/v1/admin/schools/comparison')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(403);
    });
  });
});
