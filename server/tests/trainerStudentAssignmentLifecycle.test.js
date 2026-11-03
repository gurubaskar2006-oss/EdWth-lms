/**
 * Lumina LMS — Trainer-to-Student Assignment Lifecycle Acceptance Tests
 * 6th Civilians Corporation
 *
 * Verifies the complete lifecycle of Trainer CRUD in conjunction with Student Assignments:
 * 1. Trainer creation with privileged identity validation.
 * 2. Trainer assignment to a cohort/batch.
 * 3. Assigned student visibility in the trainer portal.
 * 4. Cross-tenant student access rejection (strict tenant isolation).
 * 5. Trainer detail edits with assignment preservation.
 * 6. Trainer deactivation (soft delete & session invalidation).
 * 7. Rejection of new logins and rejection of existing sessions.
 * 8. Historical integrity (notes, doubts, submissions, and audit records remain intact).
 * 9. Reassignment of cohorts/students to an active replacement trainer.
 * 10. Replacement trainer verification (receives access to the assigned cohort).
 * 11. Stale token / deactivated trainer lockout.
 * 12. Separate verification of school teacher ('teacher') and college trainer ('trainer') behavior.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Doubt from '../models/Doubt.js';
import TeacherNote from '../models/TeacherNote.js';
import Submission from '../models/Submission.js';
import Assignment from '../models/Assignment.js';
import AuditLog from '../models/AuditLog.js';
import Session from '../models/Session.js';
import { getJwtSecret } from '../config/environment.js';
import { createSession } from '../services/sessionService.js';

describe('Lumina LMS — Trainer-to-Student Assignment Lifecycle Suite', () => {
  const testSuffix = Date.now();

  let collegeA;
  let collegeB;
  let schoolC;

  let adminUser;
  let adminToken;

  let schoolAdminUser;
  let schoolAdminToken;

  let trainer1User;
  let trainer1Token;
  let trainer1SessionId;

  let trainer2User;
  let trainer2Token;

  let teacherUser;
  let teacherToken;

  let batch1;
  let batch2;
  let schoolClass1;

  let student1;
  let student2;
  let student3;
  let studentOtherBatch;
  let studentForeignTenant;
  let schoolStudent;

  let historicalAssignment;
  let historicalSubmission;
  let historicalDoubt;
  let historicalNote;

  const makeAuthToken = (user, sessionId) => {
    return jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        sessionId: sessionId ? sessionId.toString() : undefined
      },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const passwordHash = await bcrypt.hash('SecurePassword!123', 10);

    // 1. Create Isolated College Tenants
    collegeA = await College.create({
      name: `Lifecycle College A ${testSuffix}`,
      code: `LCA-${testSuffix}`,
      slug: `lca-${testSuffix}`,
      institutionType: 'college',
      status: 'active'
    });

    collegeB = await College.create({
      name: `Lifecycle College B ${testSuffix}`,
      code: `LCB-${testSuffix}`,
      slug: `lcb-${testSuffix}`,
      institutionType: 'college',
      status: 'active'
    });

    schoolC = await College.create({
      name: `Lifecycle School C ${testSuffix}`,
      code: `LSC-${testSuffix}`,
      slug: `lsc-${testSuffix}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create College Admin
    adminUser = await User.create({
      name: 'College A Admin',
      email: `admin.collega.${testSuffix}@nexus.edu`,
      password: passwordHash,
      role: 'admin',
      tenantId: collegeA._id,
      studentId: `ADM-COL-${testSuffix}`
    });
    adminToken = makeAuthToken(adminUser);

    // 3. Create School Admin
    schoolAdminUser = await User.create({
      name: 'School C Admin',
      email: `admin.schoolc.${testSuffix}@apex.edu`,
      password: passwordHash,
      role: 'admin',
      tenantId: schoolC._id,
      studentId: `ADM-SCH-${testSuffix}`
    });
    schoolAdminToken = makeAuthToken(schoolAdminUser);

    // 4. Create Batches in College A
    batch1 = await Batch.create({
      name: `CS FullStack Cohort 1 ${testSuffix}`,
      tenantId: collegeA._id,
      targetClass: 'General',
      status: 'active'
    });

    batch2 = await Batch.create({
      name: `Data Science Cohort 2 ${testSuffix}`,
      tenantId: collegeA._id,
      targetClass: 'General',
      status: 'active'
    });

    schoolClass1 = await Batch.create({
      name: `Grade 10 - Section A ${testSuffix}`,
      tenantId: schoolC._id,
      targetClass: 'Class 11',
      status: 'active'
    });

    // 5. Create Students in College A Batch 1 (3 students)
    student1 = await User.create({
      name: 'Student One',
      email: `student1.${testSuffix}@nexus.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: collegeA._id,
      batchId: batch1._id,
      batch: batch1.name,
      studentId: `STU-1-${testSuffix}`,
      department: 'Computer Science'
    });

    student2 = await User.create({
      name: 'Student Two',
      email: `student2.${testSuffix}@nexus.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: collegeA._id,
      batchId: batch1._id,
      batch: batch1.name,
      studentId: `STU-2-${testSuffix}`,
      department: 'Computer Science'
    });

    student3 = await User.create({
      name: 'Student Three',
      email: `student3.${testSuffix}@nexus.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: collegeA._id,
      batchId: batch1._id,
      batch: batch1.name,
      studentId: `STU-3-${testSuffix}`,
      department: 'Computer Science'
    });

    // 6. Create Student in College A Batch 2 (not assigned to Trainer 1)
    studentOtherBatch = await User.create({
      name: 'Student Other Batch',
      email: `student.other.${testSuffix}@nexus.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: collegeA._id,
      batchId: batch2._id,
      batch: batch2.name,
      studentId: `STU-OTH-${testSuffix}`,
      department: 'Data Science'
    });

    // 7. Create Student in Foreign Tenant (College B)
    studentForeignTenant = await User.create({
      name: 'Foreign Tenant Student',
      email: `foreign.student.${testSuffix}@other.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: collegeB._id,
      studentId: `STU-FOR-${testSuffix}`,
      department: 'Business'
    });

    // 8. Create School Student in School C
    schoolStudent = await User.create({
      name: 'School Student C',
      email: `school.student.${testSuffix}@apex.edu`,
      password: passwordHash,
      role: 'student',
      tenantId: schoolC._id,
      batchId: schoolClass1._id,
      batch: schoolClass1.name,
      studentId: `STU-SCH-${testSuffix}`,
      department: 'Academics'
    });
  });

  afterAll(async () => {
    // Clean up disposable test data strictly
    const collegeIds = [collegeA?._id, collegeB?._id, schoolC?._id].filter(Boolean);
    if (collegeIds.length > 0) {
      await Promise.all([
        College.deleteMany({ _id: { $in: collegeIds } }),
        User.deleteMany({ tenantId: { $in: collegeIds } }),
        Batch.deleteMany({ tenantId: { $in: collegeIds } }),
        Doubt.deleteMany({ tenantId: { $in: collegeIds } }),
        TeacherNote.deleteMany({ tenantId: { $in: collegeIds.map(String) } }),
        Assignment.deleteMany({ tenantId: { $in: collegeIds } }),
        Submission.deleteMany({ tenantId: { $in: collegeIds } }),
        Session.deleteMany({ userId: { $in: [trainer1User?._id, trainer2User?._id, teacherUser?._id].filter(Boolean) } })
      ]);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Create Trainer
  // ───────────────────────────────────────────────────────────────────────────
  it('1. should create a trainer with verified institutional domain and identifier', async () => {
    const res = await request(app)
      .post('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. John Doe',
        email: `john.doe.${testSuffix}@nexus.edu`,
        department: 'School of Computing',
        phone: '+1-555-0199',
        role: 'trainer'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.trainer).toBeDefined();
    expect(res.body.trainer.name).toBe('Dr. John Doe');
    expect(res.body.trainer.role).toBe('trainer');
    expect(res.body.trainer.studentId).toMatch(/^TRN-/);
    expect(res.body.temporaryPassword).toBeDefined();

    trainer1User = await User.findById(res.body.trainer._id);
    expect(trainer1User).not.toBeNull();
    expect(trainer1User.tenantId.toString()).toBe(collegeA._id.toString());

    // Clear mustChangePassword to simulate completion of first-time login credential setup
    await User.findByIdAndUpdate(trainer1User._id, { mustChangePassword: false });
    trainer1User = await User.findById(trainer1User._id);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Assign Trainer to Batch / Class
  // ───────────────────────────────────────────────────────────────────────────
  it('2. should assign the trainer to a batch/cohort and sync bidirectional references', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/trainers/${trainer1User._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        batchId: batch1._id.toString()
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trainer.batchId).toBe(batch1._id.toString());

    // Verify User record updated
    const updatedTrainer = await User.findById(trainer1User._id);
    expect(updatedTrainer.batchId.toString()).toBe(batch1._id.toString());

    // Verify Batch.assignedTrainers updated
    const updatedBatch = await Batch.findById(batch1._id);
    expect(updatedBatch.assignedTrainers.map(String)).toContain(trainer1User._id.toString());
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Verify Assigned Students Appear in Trainer Portal
  // ───────────────────────────────────────────────────────────────────────────
  it('3. should display the 3 assigned batch students in the trainer portal roster', async () => {
    // Authenticate / create session for trainer1
    trainer1User = await User.findById(trainer1User._id);
    const sessResult = await createSession(trainer1User, { userAgent: 'trainer-agent', ip: '127.0.0.1' });
    trainer1SessionId = sessResult.sessionId;
    trainer1Token = makeAuthToken(trainer1User, trainer1SessionId);

    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.students).toBeDefined();

    const studentIds = res.body.students.map((s) => s._id.toString());
    expect(studentIds).toContain(student1._id.toString());
    expect(studentIds).toContain(student2._id.toString());
    expect(studentIds).toContain(student3._id.toString());

    // Student from other batch must NOT be in assigned roster
    expect(studentIds).not.toContain(studentOtherBatch._id.toString());

    // Verify trainer analytics reflects the assigned cohort count
    const analyticsRes = await request(app)
      .get('/api/v1/trainer/analytics')
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.totalStudents).toBe(3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Verify Trainer Cannot Access Students from Another Tenant
  // ───────────────────────────────────────────────────────────────────────────
  it('4. should reject trainer attempt to access foreign tenant student (tenant isolation)', async () => {
    const res = await request(app)
      .get(`/api/v1/trainer/students/${studentForeignTenant._id}/dossier`)
      .set('Authorization', `Bearer ${trainer1Token}`);

    // Must return 404 (not found in directory) and NOT leak foreign student record
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Password reset on foreign student must also be rejected
    const resetRes = await request(app)
      .post(`/api/v1/trainer/students/${studentForeignTenant._id}/reset-password`)
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(resetRes.status).toBe(404);
    expect(resetRes.body.success).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5: Edit Trainer Details and Verify Assignments Remain Intact
  // ───────────────────────────────────────────────────────────────────────────
  it('5. should update trainer profile details while preserving batch assignment and roster access', async () => {
    const res = await request(app)
      .put(`/api/v1/admin/trainers/${trainer1User._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. John Doe Senior',
        department: 'Artificial Intelligence & Robotics',
        phone: '+1-555-9988'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trainer.name).toBe('Dr. John Doe Senior');
    expect(res.body.trainer.department).toBe('Artificial Intelligence & Robotics');
    expect(res.body.trainer.phone).toBe('+1-555-9988');

    // Batch assignment must remain untouched
    const batchCheck = await Batch.findById(batch1._id);
    expect(batchCheck.assignedTrainers.map(String)).toContain(trainer1User._id.toString());

    // Trainer portal should still display the 3 students
    const rosterRes = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.students.length).toBe(3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Create Historical Records Before Deactivation
  // ───────────────────────────────────────────────────────────────────────────
  it('6a. should create historical doubts, notes, and submissions associated with trainer', async () => {
    // 1. TeacherNote
    historicalNote = await TeacherNote.create({
      tenantId: collegeA._id.toString(),
      studentId: student1._id.toString(),
      teacherId: trainer1User._id.toString(),
      content: 'Excellent progress on data structures module.'
    });

    // 2. Doubt replied by trainer
    historicalDoubt = await Doubt.create({
      tenantId: collegeA._id,
      studentId: student1._id,
      studentName: student1.name,
      teacherId: trainer1User._id,
      teacherName: trainer1User.name,
      subject: 'Algorithms',
      topic: 'Binary Search',
      question: 'How does pivot selection prevent worst case?',
      response: 'Use median-of-three partitioning.',
      status: 'answered'
    });

    // 3. Assignment and graded submission
    historicalAssignment = await Assignment.create({
      tenantId: collegeA._id,
      title: 'Lab 1 — Dynamic Programming',
      batchId: batch1._id,
      status: 'published'
    });

    historicalSubmission = await Submission.create({
      tenantId: collegeA._id,
      studentId: student1._id,
      assignmentId: historicalAssignment._id,
      status: 'graded',
      score: 95,
      gradedBy: trainer1User._id
    });

    expect(historicalNote).toBeDefined();
    expect(historicalDoubt).toBeDefined();
    expect(historicalSubmission).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6: Deactivate the Trainer
  // ───────────────────────────────────────────────────────────────────────────
  it('6b. should deactivate the trainer account and revoke active sessions', async () => {
    const res = await request(app)
      .delete(`/api/v1/admin/trainers/${trainer1User._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkUser = await User.findById(trainer1User._id);
    expect(checkUser.soft_deleted).toBe(true);
    expect(checkUser.accountStatus).toBe('Inactive');
    expect(checkUser.status).toBe('Inactive');

    // Audit log should be recorded
    const audit = await AuditLog.findOne({
      tenantId: collegeA._id,
      action: 'ADMIN_TRAINER_DEACTIVATED',
      targetRecord: trainer1User._id
    });
    expect(audit).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7: Verify Login Rejected and Active Session Invalidated
  // ───────────────────────────────────────────────────────────────────────────
  it('7. should reject new login attempts and reject existing session tokens for deactivated trainer', async () => {
    // Attempt login with credentials
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: trainer1User.email,
        password: 'SecurePassword!123'
      });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.success).toBe(false);

    // Attempt request with existing previously issued token
    const oldTokenRes = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(oldTokenRes.status).toBe(401);
    expect(oldTokenRes.body.success).toBe(false);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 8: Verify Historical Notes, Doubts, Submissions Remain Intact
  // ───────────────────────────────────────────────────────────────────────────
  it('8. should verify students and historical notes, doubts, and submissions remain completely intact', async () => {
    // 1. Students are NOT deleted
    const activeStudents = await User.find({
      _id: { $in: [student1._id, student2._id, student3._id] }
    });
    expect(activeStudents.length).toBe(3);
    activeStudents.forEach((s) => {
      expect(s.soft_deleted).toBeFalsy();
    });

    // 2. Historical note remains intact
    const note = await TeacherNote.findById(historicalNote._id);
    expect(note).not.toBeNull();
    expect(note.content).toBe('Excellent progress on data structures module.');

    // 3. Historical doubt remains intact
    const doubt = await Doubt.findById(historicalDoubt._id);
    expect(doubt).not.toBeNull();
    expect(doubt.response).toBe('Use median-of-three partitioning.');

    // 4. Historical submission remains intact
    const submission = await Submission.findById(historicalSubmission._id);
    expect(submission).not.toBeNull();
    expect(submission.score).toBe(95);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 9: Reassign Students / Cohort to Another Active Trainer
  // ───────────────────────────────────────────────────────────────────────────
  it('9. should reassign cohorts and students from deactivated trainer to a new active trainer', async () => {
    // Provision active replacement Trainer 2
    const createRes = await request(app)
      .post('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Prof. Replacement Trainer',
        email: `trainer2.${testSuffix}@nexus.edu`,
        department: 'School of Computing',
        role: 'trainer'
      });

    expect(createRes.status).toBe(201);
    trainer2User = await User.findById(createRes.body.trainer._id);
    await User.findByIdAndUpdate(trainer2User._id, { mustChangePassword: false });
    trainer2User = await User.findById(trainer2User._id);

    // Call reassignment endpoint
    const reassignRes = await request(app)
      .post(`/api/v1/admin/trainers/${trainer1User._id}/reassign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        replacementTrainerId: trainer2User._id.toString(),
        batchId: batch1._id.toString()
      });

    expect(reassignRes.status).toBe(200);
    expect(reassignRes.body.success).toBe(true);
    expect(reassignRes.body.affectedStudents).toBe(3);

    // Batch.assignedTrainers must now contain Trainer 2 and pull Trainer 1
    const updatedBatch = await Batch.findById(batch1._id);
    expect(updatedBatch.assignedTrainers.map(String)).toContain(trainer2User._id.toString());
    expect(updatedBatch.assignedTrainers.map(String)).not.toContain(trainer1User._id.toString());

    // Verify audit log
    const reassignAudit = await AuditLog.findOne({
      tenantId: collegeA._id,
      action: 'ADMIN_TRAINER_REASSIGNED',
      targetRecord: trainer1User._id
    });
    expect(reassignAudit).not.toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10: Replacement Trainer Receives the Correct Access
  // ───────────────────────────────────────────────────────────────────────────
  it('10. should allow replacement trainer to access the reassigned cohort roster and analytics', async () => {
    trainer2User = await User.findById(trainer2User._id);
    const t2Sess = await createSession(trainer2User, { userAgent: 'trainer2-agent', ip: '127.0.0.1' });
    trainer2Token = makeAuthToken(trainer2User, t2Sess.sessionId);

    // Fetch student roster as replacement trainer
    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${trainer2Token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.students.length).toBe(3);

    const studentIds = res.body.students.map((s) => s._id.toString());
    expect(studentIds).toContain(student1._id.toString());
    expect(studentIds).toContain(student2._id.toString());
    expect(studentIds).toContain(student3._id.toString());

    // Replacement trainer analytics should reflect the reassigned cohort
    const analyticsRes = await request(app)
      .get('/api/v1/trainer/analytics')
      .set('Authorization', `Bearer ${trainer2Token}`);

    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.data.totalStudents).toBe(3);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 11: Deactivated Trainer Cannot Regain Access Through Stale Tokens
  // ───────────────────────────────────────────────────────────────────────────
  it('11. should block deactivated trainer from regaining access through stale tokens or reassigned batches', async () => {
    const res = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);

    // Even if old token is presented to single-student dossier
    const dossierRes = await request(app)
      .get(`/api/v1/trainer/students/${student1._id}/dossier`)
      .set('Authorization', `Bearer ${trainer1Token}`);

    expect(dossierRes.status).toBe(401);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 12: Verify School Teacher and College Trainer Roles Separately
  // ───────────────────────────────────────────────────────────────────────────
  it('12a. should verify school teacher (role: "teacher") in K-12 school mode', async () => {
    // 1. Provision Teacher in School C
    const res = await request(app)
      .post('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Ms. Alice Teacher',
        email: `alice.teacher.${testSuffix}@apex.edu`,
        department: 'High School Mathematics',
        role: 'teacher',
        batchId: schoolClass1._id.toString()
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.trainer.role).toBe('teacher');
    expect(res.body.trainer.studentId).toMatch(/^TCH-/);

    teacherUser = await User.findById(res.body.trainer._id);
    expect(teacherUser.role).toBe('teacher');
    expect(teacherUser.batchId.toString()).toBe(schoolClass1._id.toString());
    await User.findByIdAndUpdate(teacherUser._id, { mustChangePassword: false });
    teacherUser = await User.findById(teacherUser._id);

    // 2. School Admin Roster must display teacher
    const rosterRes = await request(app)
      .get('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${schoolAdminToken}`);

    expect(rosterRes.status).toBe(200);
    const teacherFound = rosterRes.body.trainers.find((t) => t._id.toString() === teacherUser._id.toString());
    expect(teacherFound).toBeDefined();
    expect(teacherFound.role).toBe('teacher');

    // 3. Teacher portal access
    teacherUser = await User.findById(teacherUser._id);
    const teachSess = await createSession(teacherUser, { userAgent: 'teacher-agent', ip: '127.0.0.1' });
    teacherToken = makeAuthToken(teacherUser, teachSess.sessionId);

    const teachRosterRes = await request(app)
      .get('/api/v1/trainer/students')
      .set('Authorization', `Bearer ${teacherToken}`);

    expect(teachRosterRes.status).toBe(200);
    expect(teachRosterRes.body.students.length).toBe(1);
    expect(teachRosterRes.body.students[0]._id.toString()).toBe(schoolStudent._id.toString());
  });

  it('12b. should verify college trainer (role: "trainer") in Higher Education mode', async () => {
    // Verify College Admin Roster displays both Trainer 1 (if querying all or active) and Trainer 2
    const rosterRes = await request(app)
      .get('/api/v1/admin/trainers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(rosterRes.status).toBe(200);
    expect(rosterRes.body.success).toBe(true);

    const trainer2Found = rosterRes.body.trainers.find((t) => t._id.toString() === trainer2User._id.toString());
    expect(trainer2Found).toBeDefined();
    expect(trainer2Found.role).toBe('trainer');
    expect(trainer2Found.batchName).toBe(batch1.name);
  });
});
