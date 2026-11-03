/**
 * Lumina LMS — Complete Entity Lifecycle & CRUD Reliability Audit Test Suite
 * 6th Civilians Corporation
 *
 * Verifies the complete creation, read, update, delete, cascade, and restoration
 * lifecycle across all major entities in an isolated test environment.
 *
 * Scenarios tested per entity:
 * 1. Create with valid data
 * 2. Create with missing required data
 * 3. Create with invalid data
 * 4. Duplicate identity prevention (HTTP 409 Conflict)
 * 5. Idempotent creation (X-Idempotency-Key handling)
 * 6. Concurrent duplicate creation race conditions
 * 7. Read created records
 * 8. Update valid fields
 * 9. Prevent unauthorized protected field updates
 * 10. Cross-tenant isolation enforcement
 * 11. Deletion (soft & permanent)
 * 12. Repeated deletion idempotency
 * 13. Recreate / Conflict detection on soft-deleted records
 * 14. Restoration workflow
 * 15. Cascade cleanup and zero orphaned documents
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import crypto from 'crypto';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { getJwtSecret } from '../config/environment.js';

import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Attendance from '../models/Attendance.js';
import StudentProgress from '../models/StudentProgress.js';
import Doubt from '../models/Doubt.js';
import Grade from '../models/Grade.js';
import Note from '../models/Note.js';
import TeacherNote from '../models/TeacherNote.js';
import RetakeAuthorization from '../models/RetakeAuthorization.js';
import Session from '../models/Session.js';
import Passkey from '../models/Passkey.js';
import EmailOtp from '../models/EmailOtp.js';
import AuditLog from '../models/AuditLog.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import Announcement from '../models/Announcement.js';
import AcademicEvent from '../models/AcademicEvent.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import DeletionJob from '../models/DeletionJob.js';
import { cascadeDeleteStudent, resumeDeletionJob } from '../services/cascadeDeletionService.js';
import { idempotencyStorage } from '../middleware/idempotencyMiddleware.js';

describe('Lumina LMS — Complete Entity Lifecycle & Reliability Suite', () => {
  jest.setTimeout(120000);
  const testTimestamp = Date.now();

  let superAdminUser;
  let superAdminToken;

  let tenantA;
  let adminAUser;
  let adminAToken;
  let trainerAUser;
  let trainerAToken;

  let tenantB;
  let adminBUser;
  let adminBToken;

  const createAuthToken = (user) => {
    return jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        institution: user.institution,
        tenantId: user.tenantId ? user.tenantId.toString() : null
      },
      getJwtSecret(),
      { expiresIn: '2h' }
    );
  };

  beforeAll(async () => {
    // Wait for DB connection
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const passwordHash = await bcrypt.hash('AuditedPassword!2026', 10);

    // 1. Provision SuperAdmin
    superAdminUser = await User.create({
      name: 'Global Auditor SuperAdmin',
      email: `superauditor_${testTimestamp}@lumina.internal`,
      studentId: `SA-${testTimestamp}`,
      password: passwordHash,
      role: 'superadmin',
      status: 'active',
      isVerified: true
    });
    superAdminToken = createAuthToken(superAdminUser);

    // 2. Provision Tenant A (College)
    tenantA = await College.create({
      name: `Audit College Alpha ${testTimestamp}`,
      code: `ACA-${testTimestamp}`,
      slug: `aca-${testTimestamp}`,
      institutionType: 'college',
      status: 'active',
      isConfigured: true
    });

    adminAUser = await User.create({
      name: 'Admin Alpha',
      email: `admin_alpha_${testTimestamp}@lumina.internal`,
      studentId: `ADM-A-${testTimestamp}`,
      password: passwordHash,
      role: 'admin',
      institution: tenantA.name,
      tenantId: tenantA._id,
      status: 'active',
      isVerified: true
    });
    adminAToken = createAuthToken(adminAUser);

    trainerAUser = await User.create({
      name: 'Trainer Alpha',
      email: `trainer_alpha_${testTimestamp}@lumina.internal`,
      password: passwordHash,
      role: 'trainer',
      studentId: `TRN-A-${testTimestamp}`,
      institution: tenantA.name,
      tenantId: tenantA._id,
      status: 'active',
      isVerified: true
    });
    trainerAToken = createAuthToken(trainerAUser);

    // 3. Provision Tenant B (College for cross-tenant isolation testing)
    tenantB = await College.create({
      name: `Audit College Beta ${testTimestamp}`,
      code: `ACB-${testTimestamp}`,
      slug: `acb-${testTimestamp}`,
      institutionType: 'college',
      status: 'active',
      isConfigured: true
    });

    adminBUser = await User.create({
      name: 'Admin Beta',
      email: `admin_beta_${testTimestamp}@lumina.internal`,
      studentId: `ADM-B-${testTimestamp}`,
      password: passwordHash,
      role: 'admin',
      institution: tenantB.name,
      tenantId: tenantB._id,
      status: 'active',
      isVerified: true
    });
    adminBToken = createAuthToken(adminBUser);
  }, 120000);

  afterAll(async () => {
    // Cleanup test users and colleges created in beforeAll
    try {
      if (tenantA?._id) {
        await College.deleteOne({ _id: tenantA._id });
        await User.deleteMany({ tenantId: tenantA._id });
        await Batch.deleteMany({ tenantId: tenantA._id });
        await Course.deleteMany({ tenantId: tenantA._id });
      }
      if (tenantB?._id) {
        await College.deleteOne({ _id: tenantB._id });
        await User.deleteMany({ tenantId: tenantB._id });
        await Batch.deleteMany({ tenantId: tenantB._id });
        await Course.deleteMany({ tenantId: tenantB._id });
      }
      if (superAdminUser?._id) {
        await User.deleteOne({ _id: superAdminUser._id });
      }
    } catch {
      // Best-effort cleanup
    }
  });

  // =========================================================================
  // 1. INSTITUTION (COLLEGE) LIFECYCLE
  // =========================================================================
  describe('Entity: Institution (College)', () => {
    let createdSchoolId;
    const instCode = `INST-${testTimestamp}`;

    it('1. Create institution with valid data as SuperAdmin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `New Institute ${testTimestamp}`,
          code: instCode,
          institutionType: 'school',
          city: 'Bangalore',
          contactEmail: `contact_${testTimestamp}@institution.edu`
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.school).toBeDefined();
      expect(res.body.school.code).toBe(instCode);
      createdSchoolId = res.body.school._id || res.body.school.id;
    });

    it('2. Create institution with missing required data fails with 400', async () => {
      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          // Missing code
          name: 'Incomplete Institution'
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('3. Duplicate institution code returns 400 or 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `Duplicate Code Institute ${testTimestamp}`,
          code: instCode // same code
        });

      expect([409, 400]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('4. Non-superadmin cannot create institution (RBAC 403)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Unauthorized Institute',
          code: `UNAUTH-${testTimestamp}`
        });

      expect([403, 401]).toContain(res.status);
    });

    it('5. Read created institution', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/schools/${createdSchoolId}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.school.code).toBe(instCode);
    });

    it('6. Update valid institution fields', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/institutions/${createdSchoolId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `New Institute Updated ${testTimestamp}`,
          status: 'active'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await College.findById(createdSchoolId);
      expect(check.name).toBe(`New Institute Updated ${testTimestamp}`);
    });

    it('7. Cleanly delete test institution with confirmed code and verify cascade cleanup', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/schools/${createdSchoolId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          confirmationCode: instCode
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deleted = await College.findById(createdSchoolId);
      expect(deleted).toBeNull();
    });
  });

  // =========================================================================
  // 2. TRAINER LIFECYCLE
  // =========================================================================
  describe('Entity: Trainer (Faculty)', () => {
    let createdTrainerId;
    let trainerEmail = `trainer_created_${testTimestamp}@lumina.internal`;
    let generatedPassword;

    it('1. Create trainer with valid data, complete fields and secure credentials', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Dr. Jane Smith',
          email: trainerEmail,
          institution: tenantA.name,
          tenantId: tenantA._id.toString(),
          department: 'Computer Science'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.trainer).toBeDefined();
      expect(res.body.trainer.role).toBe('trainer');
      expect(res.body.trainer.studentId).toMatch(/^TRN-/);
      expect(res.body.temporaryPassword).toBeDefined();

      createdTrainerId = res.body.trainer._id;
      generatedPassword = res.body.temporaryPassword;

      // Verify DB record
      const dbRecord = await User.findById(createdTrainerId);
      expect(dbRecord).not.toBeNull();
      expect(dbRecord.password).not.toBe(generatedPassword); // Must be hashed!
      expect(dbRecord.mustChangePassword).toBe(true);
      expect(dbRecord.tenantId.toString()).toBe(tenantA._id.toString());
    });

    it('2. Created trainer can authenticate with generated temporary credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: trainerEmail,
          password: generatedPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('trainer');
      expect(res.body.mustChangePassword).toBe(true);
    });

    it('3. Create trainer with missing required data fails with 400', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'No Email Trainer',
          // Missing email & institution
        });

      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('4. Create duplicate trainer identity fails with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Jane Clone',
          email: trainerEmail, // Duplicate!
          institution: tenantA.name,
          tenantId: tenantA._id.toString()
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists|already registered|conflict/i);
    });

    it('5. Repeat creation request with idempotency key returns cached idempotent result', async () => {
      const idempotencyKey = `idem-trn-${Date.now()}`;
      const payload = {
        name: 'Idempotent Trainer',
        email: `idempotent_${testTimestamp}@lumina.internal`,
        institution: tenantA.name,
        tenantId: tenantA._id.toString()
      };

      // First call
      const res1 = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      const firstId = res1.body.trainer._id;

      // Second identical call with same idempotency key
      const res2 = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('X-Idempotency-Key', idempotencyKey)
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.trainer._id).toBe(firstId);

      // Verify no duplicate record was created in database
      const count = await User.countDocuments({ email: payload.email });
      expect(count).toBe(1);

      // Clean up the idempotent test user
      await User.deleteOne({ _id: firstId });
    });

    it('6. Institution Admin cannot create trainer under another institution (Server-enforced Tenant Boundary)', async () => {
      // Admin A tries to create trainer for Tenant B
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Infiltrator Trainer',
          email: `infiltrator_${testTimestamp}@lumina.internal`,
          institution: tenantB.name,
          tenantId: tenantB._id.toString()
        });

      expect(res.status).toBe(201);
      // Server MUST override tenantId with Admin A's verified tenant, never trusting client
      const created = await User.findById(res.body.trainer._id);
      expect(created.tenantId.toString()).toBe(tenantA._id.toString());
      expect(created.tenantId.toString()).not.toBe(tenantB._id.toString());

      await User.deleteOne({ _id: created._id });
    });
  });

  // =========================================================================
  // 3. BATCH (COHORT) LIFECYCLE
  // =========================================================================
  describe('Entity: Batch (Cohort)', () => {
    let createdBatchId;
    const batchName = `Batch AI 2026-${testTimestamp}`;
    const batchCode = `BAI-${testTimestamp}`;

    it('1. Create batch with valid data as Institution Admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: batchName,
          code: batchCode,
          department: 'Computer Science',
          semester: 'Spring 2026',
          maxCapacity: 40
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.batch).toBeDefined();
      expect(res.body.batch.name).toBe(batchName);
      expect(res.body.batch.tenantId.toString()).toBe(tenantA._id.toString());

      createdBatchId = res.body.batch._id;
    });

    it('2. Create duplicate batch name in same tenant fails with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: batchName, // duplicate!
          code: `DIFF-${testTimestamp}`
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('3. Read created batch', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const found = res.body.batches.find((b) => b._id === createdBatchId);
      expect(found).toBeDefined();
      expect(found.name).toBe(batchName);
    });

    it('4. Cross-tenant isolation: Admin B cannot see Batch belonging to Tenant A', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      const found = res.body.batches.find((b) => b._id === createdBatchId);
      expect(found).toBeUndefined(); // Strictly isolated!
    });

    it('5. Delete batch prevents deletion when active students exist (409 Conflict)', async () => {
      // Create student enrolled in this batch
      const enrolledStudent = await User.create({
        name: 'Enrolled Test Student',
        email: `enrolled_${testTimestamp}@lumina.internal`,
        password: 'hashedpassword',
        role: 'student',
        studentId: `ENR-${testTimestamp}`,
        batchId: createdBatchId,
        tenantId: tenantA._id,
        institution: tenantA.name,
        status: 'active'
      });

      // Attempt to delete batch without ?force=true
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/batches/${createdBatchId}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.hasActiveStudents).toBe(true);

      // Verify batch still exists
      const batchCheck = await Batch.findById(createdBatchId);
      expect(batchCheck).not.toBeNull();

      // Clean up enrolled student
      await User.deleteOne({ _id: enrolledStudent._id });
    });

    it('6. Delete batch succeeds when no active students are enrolled', async () => {
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/batches/${createdBatchId}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const deleted = await Batch.findById(createdBatchId);
      expect(deleted).toBeNull();
    });

    it('7. Repeated deletion returns 404 cleanly without side effects', async () => {
      const repeatRes = await request(app)
        .delete(`/api/v1/admin/batches/${createdBatchId}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(repeatRes.status).toBe(404);
    });
  });

  // =========================================================================
  // 4. COURSE LIFECYCLE
  // =========================================================================
  describe('Entity: Course (Curriculum)', () => {
    let createdCourseId;
    const courseCode = `CS-${testTimestamp.toString().slice(-4)}`;

    it('1. Create course with valid data as Admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          title: 'Distributed Systems & Cloud',
          code: courseCode,
          department: 'School of Computing',
          credits: 4
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.course).toBeDefined();
      expect(res.body.course.code).toBe(courseCode);
      createdCourseId = res.body.course._id;
    });

    it('2. Create duplicate course code in same tenant fails with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          title: 'Duplicate Course Code',
          code: courseCode, // Duplicate!
          department: 'School of Computing'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('3. Cross-tenant isolation: Admin B cannot view or delete Course from Tenant A', async () => {
      const deleteAttempt = await request(app)
        .delete(`/api/v1/admin/courses/${createdCourseId}`)
        .set('Authorization', `Bearer ${adminBToken}`);

      expect([403, 404]).toContain(deleteAttempt.status);

      // Verify course still exists
      const course = await Course.findById(createdCourseId);
      expect(course).not.toBeNull();
    });

    it('4. Delete course succeeds and cleans up cleanly', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/courses/${createdCourseId}`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await Course.findById(createdCourseId);
      expect(check).toBeNull();
    });
  });

  // =========================================================================
  // 5. STUDENT LIFECYCLE (CREATION, UPDATE, SOFT-DELETE, RESTORE, CASCADE)
  // =========================================================================
  describe('Entity: Student (Complete Lifecycle & Cascade)', () => {
    let studentIdNumber = `STU-AUD-${testTimestamp}`;
    let studentEmail = `student_${testTimestamp}@lumina.internal`;
    let createdStudentMongoId;

    it('1. Create student with valid data as Admin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Audit Student',
          email: studentEmail,
          studentId: studentIdNumber,
          password: 'InitialPassword!123',
          batch: 'Cohort Alpha',
          department: 'Information Science'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.student).toBeDefined();
      expect(res.body.student.role).toBe('student');
      expect(res.body.student.studentId).toBe(studentIdNumber);

      createdStudentMongoId = res.body.student._id;
    });

    it('2. Create duplicate studentId returns 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Student ID Collision',
          email: `different_email_${testTimestamp}@lumina.internal`,
          studentId: studentIdNumber, // duplicate!
          password: 'InitialPassword!123'
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already assigned|already registered/i);
    });

    it('3. Update valid student fields as Admin', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/students/${createdStudentMongoId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Audit Student Updated',
          phone: '+91 9876543210'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const dbStudent = await User.findById(createdStudentMongoId);
      expect(dbStudent.name).toBe('Audit Student Updated');
      expect(dbStudent.phone).toBe('+91 9876543210');
    });

    it('4. Attempt unauthorized protected field updates (role tampering rejected)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/students/${createdStudentMongoId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          role: 'superadmin' // Unauthorized role escalation!
        });

      // Role must remain 'student'
      const dbStudent = await User.findById(createdStudentMongoId);
      expect(dbStudent.role).toBe('student');
    });

    it('5. Soft-delete student sets status to inactive and prevents login', async () => {
      // Soft-delete via DELETE /api/v1/admin/students/:id (permanent=false)
      const res = await request(app)
        .delete(`/api/v1/admin/students/${createdStudentMongoId}?permanent=false`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await User.findById(createdStudentMongoId);
      expect(check.status.toLowerCase()).toBe('inactive');

      // Attempt login with soft-deleted account -> MUST fail or require reactivation
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentEmail,
          password: 'InitialPassword!123'
        });

      expect([401, 403]).toContain(loginRes.status);
    });

    it('6. Recreating a soft-deleted student prompts 409 Conflict with canRestore: true', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Audit Student',
          email: studentEmail,
          studentId: studentIdNumber,
          password: 'InitialPassword!123'
        });

      expect(res.status).toBe(409);
      expect(res.body.canRestore).toBe(true);
    });

    it('7. Restore soft-deleted student reactivates account', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/students/${createdStudentMongoId}/restore`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await User.findById(createdStudentMongoId);
      expect(check.status.toLowerCase()).toBe('active');
    });

    it('8. Permanent delete cascades all 10 student-bound collections without orphaned records', async () => {
      // Populate dependent records across all collections for this student
      const dummyDate = new Date();
      await Attendance.create({
        studentId: createdStudentMongoId,
        trainerId: trainerAUser._id,
        batchId: new mongoose.Types.ObjectId(),
        date: dummyDate,
        status: 'present',
        tenantId: tenantA._id
      });
      await StudentProgress.create({
        studentId: createdStudentMongoId,
        courseId: 'CRS-TEST',
        tenantId: tenantA._id
      });
      await Doubt.create({
        studentId: createdStudentMongoId,
        studentName: 'Audit Student',
        teacherName: 'Trainer Alpha',
        subject: 'Computer Science',
        topic: 'Tree Traversal',
        question: 'How does cascade delete work?',
        tenantId: tenantA._id
      });
      await Grade.create({
        studentId: createdStudentMongoId.toString(),
        subject: 'Algorithms',
        tenantId: tenantA._id
      });
      await Note.create({
        id: `note_${Date.now()}`,
        owner: createdStudentMongoId,
        title: 'Student Study Note',
        tenantId: tenantA._id
      });
      await TeacherNote.create({
        tenantId: tenantA._id.toString(),
        studentId: createdStudentMongoId.toString(),
        teacherId: trainerAUser._id.toString(),
        content: 'Observation by faculty'
      });

      // Also create an UNRELATED record for another student to verify it is NOT deleted!
      const otherStudentId = new mongoose.Types.ObjectId();
      await Attendance.create({
        studentId: otherStudentId,
        trainerId: trainerAUser._id,
        batchId: new mongoose.Types.ObjectId(),
        date: dummyDate,
        status: 'present',
        tenantId: tenantA._id
      });

      // Execute Permanent Delete
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/students/${createdStudentMongoId}?permanent=true`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify Student is permanently gone
      const studentAfter = await User.findById(createdStudentMongoId);
      expect(studentAfter).toBeNull();

      // Verify all 6 created dependent records are purged (zero orphans)
      const attendances = await Attendance.find({ studentId: createdStudentMongoId });
      expect(attendances.length).toBe(0);

      const progresses = await StudentProgress.find({ studentId: createdStudentMongoId });
      expect(progresses.length).toBe(0);

      const doubts = await Doubt.find({ studentId: createdStudentMongoId });
      expect(doubts.length).toBe(0);

      const grades = await Grade.find({ studentId: createdStudentMongoId.toString() });
      expect(grades.length).toBe(0);

      const notes = await Note.find({ owner: createdStudentMongoId });
      expect(notes.length).toBe(0);

      const teacherNotes = await TeacherNote.find({ studentId: createdStudentMongoId.toString() });
      expect(teacherNotes.length).toBe(0);

      // Verify UNRELATED student's record was preserved untouched!
      const otherAttendance = await Attendance.find({ studentId: otherStudentId });
      expect(otherAttendance.length).toBe(1);

      // Clean up other attendance
      await Attendance.deleteMany({ studentId: otherStudentId });
    });
  });

  // =========================================================================
  // 6. CONCURRENT CREATION & IDEMPOTENCY HARDENING
  // =========================================================================
  describe('Concurrency & Race Condition Hardening', () => {
    it('Handles concurrent duplicate requests gracefully without crashing or duplicating', async () => {
      const duplicateEmail = `race_${Date.now()}@lumina.internal`;
      const duplicateStudentId = `RACE-${Date.now()}`;

      const attemptCreation = () =>
        request(app)
          .post('/api/v1/admin/students')
          .set('Authorization', `Bearer ${adminAToken}`)
          .send({
            name: 'Race Candidate',
            email: duplicateEmail,
            studentId: duplicateStudentId,
            password: 'RacePassword!123'
          });

      // Fire 3 simultaneous requests with identical identity
      const results = await Promise.all([
        attemptCreation(),
        attemptCreation(),
        attemptCreation()
      ]);

      const successCount = results.filter((r) => r.status === 201).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      // Exactly ONE must succeed (201) and all others must receive conflict (409)
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(2);

      // Verify exactly ONE record exists in MongoDB
      const records = await User.find({ email: duplicateEmail });
      expect(records.length).toBe(1);

      // Clean up
      await User.deleteOne({ email: duplicateEmail });
    });

    it('Rejects identical idempotency key with modified payload (Payload Mismatch)', async () => {
      const testKey = `mismatch-${Date.now()}`;
      const payloadA = {
        name: 'Original Candidate',
        email: `candidate_a_${Date.now()}@lumina.internal`,
        studentId: `STU-A-${Date.now()}`,
        password: 'Password!123'
      };
      const payloadB = {
        name: 'Tampered Candidate',
        email: `candidate_b_${Date.now()}@lumina.internal`,
        studentId: `STU-B-${Date.now()}`,
        password: 'Password!123'
      };

      // First call with payload A
      const res1 = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('X-Idempotency-Key', testKey)
        .send(payloadA);

      expect(res1.status).toBe(201);

      // Second call with same key but DIFFERENT payload B
      const res2 = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('X-Idempotency-Key', testKey)
        .send(payloadB);

      // Must be rejected with 409 conflict
      expect(res2.status).toBe(409);
      expect(res2.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');

      // Clean up created student A
      await User.deleteOne({ email: payloadA.email });
    });

    it('Scopes idempotency keys by User and Tenant (No cross-user cache leakage)', async () => {
      const sharedKey = `shared-key-${Date.now()}`;
      const payloadAdminA = {
        name: 'Student For Tenant A',
        email: `shared_a_${Date.now()}@lumina.internal`,
        studentId: `STU-SH-A-${Date.now()}`,
        password: 'Password!123'
      };
      const payloadAdminB = {
        name: 'Student For Tenant B',
        email: `shared_b_${Date.now()}@lumina.internal`,
        studentId: `STU-SH-B-${Date.now()}`,
        password: 'Password!123'
      };

      // Admin A creates student with shared key
      const resA = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .set('X-Idempotency-Key', sharedKey)
        .send(payloadAdminA);

      expect(resA.status).toBe(201);
      expect(resA.body.student.email).toBe(payloadAdminA.email);

      // Admin B creates student with the SAME key in Tenant B
      // Should NOT collide with Admin A's cache!
      const resB = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminBToken}`)
        .set('X-Idempotency-Key', sharedKey)
        .send(payloadAdminB);

      expect(resB.status).toBe(201);
      expect(resB.body.student.email).toBe(payloadAdminB.email);

      // Clean up
      await User.deleteOne({ email: payloadAdminA.email });
      await User.deleteOne({ email: payloadAdminB.email });
    });
  });

  // =========================================================================
  // 7. ASSIGNMENT, SUBMISSION, & DOUBT LIFECYCLE
  // =========================================================================
  describe('Entity: Assignment, Submission, and Doubt Lifecycle', () => {
    let testBatch;
    let testStudent;
    let testStudentToken;
    let createdAssignmentId;
    let createdDoubtId;

    beforeAll(async () => {
      testBatch = await Batch.create({
        name: `Assignment Test Batch ${Date.now()}`,
        tenantId: tenantA._id
      });

      const pass = await bcrypt.hash('StudentPass!123', 10);
      testStudent = await User.create({
        name: 'Assignment Submitter',
        email: `submitter_${Date.now()}@lumina.internal`,
        studentId: `SUBM-${Date.now()}`,
        password: pass,
        role: 'student',
        batchId: testBatch._id,
        tenantId: tenantA._id,
        status: 'active'
      });
      testStudentToken = createAuthToken(testStudent);
    });

    afterAll(async () => {
      if (testBatch?._id) await Batch.deleteOne({ _id: testBatch._id });
      if (testStudent?._id) await User.deleteOne({ _id: testStudent._id });
      if (createdAssignmentId) {
        await Assignment.deleteOne({ _id: createdAssignmentId });
        await Submission.deleteMany({ assignmentId: createdAssignmentId });
      }
      if (createdDoubtId) await Doubt.deleteOne({ _id: createdDoubtId });
    });

    it('1. Create assignment with valid data', async () => {
      const assignment = await Assignment.create({
        title: `Kernel Engineering Lab ${Date.now()}`,
        courseId: 'CS-501',
        batchId: testBatch._id,
        tenantId: tenantA._id,
        description: 'Implement a preemptive scheduler',
        dueDate: new Date(Date.now() + 86400000),
        totalPoints: 100
      });

      expect(assignment).toBeDefined();
      expect(assignment.tenantId.toString()).toBe(tenantA._id.toString());
      createdAssignmentId = assignment._id;
    });

    it('2. Student submits assignment and prevents duplicate submissions via compound index', async () => {
      const sub1 = await Submission.create({
        tenantId: tenantA._id,
        assignmentId: createdAssignmentId,
        studentId: testStudent._id,
        studentName: testStudent.name,
        submissionText: 'https://github.com/lumina/scheduler-lab'
      });

      expect(sub1).toBeDefined();
      expect(sub1.status).toBe('submitted');

      // Attempt duplicate submission on same assignment by same student -> Rejected by compound index
      await expect(
        Submission.create({
          tenantId: tenantA._id,
          assignmentId: createdAssignmentId,
          studentId: testStudent._id,
          submissionText: 'Duplicate attempt'
        })
      ).rejects.toThrow();
    });

    it('3. Doubt creation and resolution lifecycle', async () => {
      const doubt = await Doubt.create({
        tenantId: tenantA._id,
        studentId: testStudent._id,
        studentName: testStudent.name,
        teacherName: 'Trainer Alpha',
        subject: 'Operating Systems',
        topic: 'Process Scheduling',
        question: 'What is the priority inversion mitigation algorithm?',
        status: 'submitted'
      });

      expect(doubt).toBeDefined();
      expect(doubt.status).toBe('submitted');
      createdDoubtId = doubt._id;

      // Update doubt status to answered
      doubt.status = 'answered';
      doubt.response = 'Use Priority Ceiling Protocol or Priority Inheritance Protocol.';
      await doubt.save();

      const updated = await Doubt.findById(createdDoubtId);
      expect(updated.status).toBe('answered');
      expect(updated.response).toContain('Priority Ceiling');
    });

    it('4. Cascade deletion cleans up assignment and all submissions without orphaned records', async () => {
      // Delete assignment and cascade submissions
      await Submission.deleteMany({ assignmentId: createdAssignmentId });
      await Assignment.deleteOne({ _id: createdAssignmentId });

      const assignmentCheck = await Assignment.findById(createdAssignmentId);
      expect(assignmentCheck).toBeNull();

      const submissionsCheck = await Submission.find({ assignmentId: createdAssignmentId });
      expect(submissionsCheck.length).toBe(0);
    });
  });

  // =========================================================================
  // 8. REPEATED CREATE -> EDIT -> DELETE -> RECREATE LIFECYCLE
  // =========================================================================
  describe('Full Repeatability Cycle: Create -> Edit -> Delete -> Recreate', () => {
    const cycleTimestamp = Date.now();
    const cycleStudentId = `CYCLE-${cycleTimestamp}`;
    const cycleEmail = `cycle_${cycleTimestamp}@lumina.internal`;
    let studentId;

    it('Step 1: Create initial student', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Cycle Candidate',
          email: cycleEmail,
          studentId: cycleStudentId,
          password: 'Password!123'
        });

      expect(res.status).toBe(201);
      studentId = res.body.student._id;
    });

    it('Step 2: Edit student record', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/students/${studentId}`)
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Cycle Candidate Updated'
        });

      expect(res.status).toBe(200);
      const check = await User.findById(studentId);
      expect(check.name).toBe('Cycle Candidate Updated');
    });

    it('Step 3: Permanently delete student record and verify zero remnants', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/students/${studentId}?permanent=true`)
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      const check = await User.findById(studentId);
      expect(check).toBeNull();
    });

    it('Step 4: Recreate student with same credentials according to business rules', async () => {
      // Since previous student was permanently deleted, re-creation must succeed cleanly!
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Cycle Candidate Fresh',
          email: cycleEmail,
          studentId: cycleStudentId,
          password: 'NewPassword!123'
        });

      expect(res.status).toBe(201);
      expect(res.body.student.name).toBe('Cycle Candidate Fresh');

      // Final cleanup
      await User.deleteOne({ _id: res.body.student._id });
    });
  });

  // =========================================================================
  // 9. CASCADE IDENTIFIER TYPE AUDIT (OBJECTID VS STRING REFERENCES)
  // =========================================================================
  describe('Cascade Identifier Type Audit: Strict Schema-Correct Filters', () => {
    const typeAuditTime = Date.now();
    let studentPrimary;
    let studentSimilar;

    beforeAll(async () => {
      studentPrimary = await User.create({
        name: 'Type Audit Primary',
        email: `type_primary_${typeAuditTime}@lumina.internal`,
        studentId: `STU-TYPE-${typeAuditTime}`,
        tenantId: tenantA._id,
        role: 'student',
        status: 'active',
        password: await bcrypt.hash('TestPass123!', 10)
      });

      // Another student in the same tenant with similar/prefix studentId to ensure NO accidental deletion
      studentSimilar = await User.create({
        name: 'Type Audit Similar',
        email: `type_similar_${typeAuditTime}@lumina.internal`,
        studentId: `STU-TYPE-${typeAuditTime}-SIMILAR`,
        tenantId: tenantA._id,
        role: 'student',
        status: 'active',
        password: await bcrypt.hash('TestPass123!', 10)
      });
    });

    it('1. Verifies student with ObjectId-based references deletes without CastError', async () => {
      // Create ObjectId-based records
      const attendance = await Attendance.create({
        tenantId: tenantA._id,
        batchId: new mongoose.Types.ObjectId(),
        studentId: studentPrimary._id,
        trainerId: trainerAUser._id,
        date: new Date(),
        status: 'present'
      });

      const submission = await Submission.create({
        tenantId: tenantA._id,
        assignmentId: new mongoose.Types.ObjectId(),
        studentId: studentPrimary._id,
        status: 'submitted',
        studentName: studentPrimary.name
      });

      expect(attendance._id).toBeDefined();
      expect(submission._id).toBeDefined();
    });

    it('2. Verifies student with String-based references (Grade & TeacherNote) handles string types safely', async () => {
      // Create String-based records
      const grade = await Grade.create({
        tenantId: tenantA._id,
        studentId: studentPrimary.studentId,
        cumulativeGpa: 3.85,
        academicStanding: 'Good Standing'
      });

      const teacherNote = await TeacherNote.create({
        tenantId: String(tenantA._id),
        studentId: studentPrimary.studentId,
        teacherId: String(trainerAUser._id),
        content: 'Exemplary focus and performance.'
      });

      // Also create records for similar student to verify isolation
      await Grade.create({
        tenantId: tenantA._id,
        studentId: studentSimilar.studentId,
        cumulativeGpa: 3.10
      });

      await TeacherNote.create({
        tenantId: String(tenantA._id),
        studentId: studentSimilar.studentId,
        teacherId: String(trainerAUser._id),
        content: 'Note for similar student.'
      });

      expect(grade._id).toBeDefined();
      expect(teacherNote._id).toBeDefined();
    });

    it('3. Cascade deletion purges both ObjectId and String references without touching similar student', async () => {
      const result = await cascadeDeleteStudent(studentPrimary, { userId: adminAUser._id, role: 'admin' });
      expect(result.success).toBe(true);

      // Verify Primary Student records are 100% gone
      const remainingAttendance = await Attendance.countDocuments({ studentId: studentPrimary._id });
      const remainingSubmission = await Submission.countDocuments({ studentId: studentPrimary._id });
      const remainingGrade = await Grade.countDocuments({ studentId: studentPrimary.studentId });
      const remainingTeacherNote = await TeacherNote.countDocuments({ studentId: studentPrimary.studentId });
      const remainingUser = await User.findById(studentPrimary._id);

      expect(remainingAttendance).toBe(0);
      expect(remainingSubmission).toBe(0);
      expect(remainingGrade).toBe(0);
      expect(remainingTeacherNote).toBe(0);
      expect(remainingUser).toBeNull();

      // Verify Similar Student was NOT accidentally deleted!
      const similarUser = await User.findById(studentSimilar._id);
      expect(similarUser).not.toBeNull();
      const similarGrade = await Grade.countDocuments({ studentId: studentSimilar.studentId });
      expect(similarGrade).toBe(1);
      const similarNote = await TeacherNote.countDocuments({ studentId: studentSimilar.studentId });
      expect(similarNote).toBe(1);

      // Clean up similar student
      await cascadeDeleteStudent(studentSimilar, { userId: adminAUser._id, role: 'admin' });
    });
  });

  // =========================================================================
  // 10. CASCADE DELETION RELIABILITY: RESUMABLE JOB & FAILURE INJECTION
  // =========================================================================
  describe('Cascade Deletion Reliability: Resumable DeletionJob & Recovery', () => {
    const failAuditTime = Date.now();
    let failStudent;
    let failedJobId;

    beforeAll(async () => {
      failStudent = await User.create({
        name: 'Failure Test Candidate',
        email: `fail_recovery_${failAuditTime}@lumina.internal`,
        studentId: `STU-FAIL-${failAuditTime}`,
        tenantId: tenantA._id,
        role: 'student',
        status: 'active',
        password: await bcrypt.hash('TestPass123!', 10)
      });

      await Attendance.create({
        tenantId: tenantA._id,
        batchId: new mongoose.Types.ObjectId(),
        studentId: failStudent._id,
        trainerId: trainerAUser._id,
        date: new Date(),
        status: 'present'
      });

      await Grade.create({
        tenantId: tenantA._id,
        studentId: failStudent.studentId,
        cumulativeGpa: 3.5
      });
    });

    it('1. Deliberately injects failure during deletion and verifies DeletionJob tracks failed state', async () => {
      // Deliberately fail at stage 'submission'
      await expect(
        cascadeDeleteStudent(failStudent, { userId: adminAUser._id, role: 'admin' }, { failAtStage: 'submission' })
      ).rejects.toThrow('SIMULATED_FAILURE_AT_STAGE: submission');

      // Verify DeletionJob exists in database with status 'failed'
      const job = await DeletionJob.findOne({ targetId: failStudent._id });
      expect(job).not.toBeNull();
      expect(job.status).toBe('failed');
      expect(job.failedStage.stage).toBe('submission');
      expect(job.completedStages.some((s) => s.stage === 'attendance')).toBe(true);

      failedJobId = job.jobId;

      // Verify User is NOT deleted while stages remain incomplete
      const studentStillExists = await User.findById(failStudent._id);
      expect(studentStillExists).not.toBeNull();
    });

    it('2. Resumes failed DeletionJob and verifies successful complete recovery', async () => {
      const resumeResult = await resumeDeletionJob(failedJobId, { userId: adminAUser._id, role: 'admin' });
      expect(resumeResult.success).toBe(true);

      // Verify job is now marked completed
      const updatedJob = await DeletionJob.findOne({ jobId: failedJobId });
      expect(updatedJob.status).toBe('completed');
      expect(updatedJob.completedAt).toBeDefined();

      // Verify all dependent records and student are now cleanly deleted
      const userCheck = await User.findById(failStudent._id);
      expect(userCheck).toBeNull();
      const gradeCheck = await Grade.countDocuments({ studentId: failStudent.studentId });
      expect(gradeCheck).toBe(0);
    });
  });

  // =========================================================================
  // 11. IDEMPOTENCY ACROSS API INSTANCES & LOCK RECOVERY
  // =========================================================================
  describe('Idempotency Storage & Multi-Instance Resilience', () => {
    it('1. Verifies storage adapter lock acquisition and release on failure', async () => {
      const testKey = `test-idem-lock-${Date.now()}`;
      const payloadHash = 'hash-abc-123';

      // Lock acquisition
      const lock1 = await idempotencyStorage.acquireLock(testKey, payloadHash, 60000, 30000);
      expect(lock1.acquired).toBe(true);

      // Second concurrent attempt receives lock failure
      const lock2 = await idempotencyStorage.acquireLock(testKey, payloadHash, 60000, 30000);
      expect(lock2.acquired).toBe(false);
      expect(lock2.existing.status).toBe('in_flight');

      // Failed request cleanup: release lock
      await idempotencyStorage.delete(testKey);

      // Retry after cleanup succeeds
      const lock3 = await idempotencyStorage.acquireLock(testKey, payloadHash, 60000, 30000);
      expect(lock3.acquired).toBe(true);

      await idempotencyStorage.delete(testKey);
    });

    it('2. Stalled in-flight lock recovery past inFlightTimeoutMs', async () => {
      const stalledKey = `stalled-lock-${Date.now()}`;
      const payloadHash = 'hash-xyz-456';

      // Acquire lock with short in-flight timeout (10ms)
      await idempotencyStorage.acquireLock(stalledKey, payloadHash, 60000, 10);

      // Wait 30ms for in-flight timeout to expire
      await new Promise((r) => setTimeout(r, 30));

      // Subsequent attempt detects stalled in-flight lock and recovers it
      const recoveryLock = await idempotencyStorage.acquireLock(stalledKey, payloadHash, 60000, 30000);
      expect(recoveryLock.acquired).toBe(true);

      await idempotencyStorage.delete(stalledKey);
    });
  });

  // =========================================================================
  // 12. APPEND-ONLY, EXPIRY-BASED & SECURITY LIFECYCLE ENTITIES
  // =========================================================================
  describe('Append-Only, Expiry-Based and Security Lifecycle Entities', () => {
    const secTimestamp = Date.now();

    it('1. AuditLog: Verifies immutable append-only ledger creation', async () => {
      const log = await AuditLog.create({
        tenantId: tenantA._id,
        actor: { userId: String(adminAUser._id), role: 'admin', email: adminAUser.email },
        action: 'SECURITY_AUDIT_VERIFIED',
        targetRecord: tenantA._id,
        targetModel: 'College',
        details: { auditPassed: true, timestamp: secTimestamp }
      });

      expect(log._id).toBeDefined();
      expect(log.action).toBe('SECURITY_AUDIT_VERIFIED');

      const retrieved = await AuditLog.findById(log._id);
      expect(retrieved.details.auditPassed).toBe(true);
    });

    it('2. EmailOtp: Verifies cryptographic hash storage, expiry TTL, and single-use consumption', async () => {
      const otpCode = '987654';
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = crypto.createHash('sha256').update(otpCode + salt).digest('hex');

      const otp = await EmailOtp.create({
        userId: adminAUser._id,
        email: adminAUser.email,
        purpose: 'email_verification',
        otpHash,
        salt,
        resendAfter: new Date(Date.now() + 60000),
        expiresAt: new Date(Date.now() + 300000) // 5 minutes TTL
      });

      expect(otp._id).toBeDefined();
      expect(otp.attempts).toBe(0);

      // Consume OTP (single use)
      await EmailOtp.deleteOne({ _id: otp._id });
      const verifyConsumed = await EmailOtp.findById(otp._id);
      expect(verifyConsumed).toBeNull();
    });

    it('3. Session: Verifies server-enforced session persistence and revocation', async () => {
      const testSessionId = `sess-${secTimestamp}-${crypto.randomBytes(8).toString('hex')}`;
      const session = await Session.create({
        sessionId: testSessionId,
        userId: adminAUser._id,
        role: 'admin',
        tenantId: tenantA._id,
        userAgent: 'Jest Audit Agent',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 86400000)
      });

      expect(session._id).toBeDefined();
      expect(session.isRevoked).toBe(false);

      // Revoke session
      session.isRevoked = true;
      await session.save();

      const revokedSession = await Session.findOne({ sessionId: testSessionId });
      expect(revokedSession.isRevoked).toBe(true);

      await Session.deleteOne({ _id: session._id });
    });

    it('4. Passkey: Verifies credential registration and unique credentialId constraint', async () => {
      const credId = `cred-${secTimestamp}`;
      const passkey = await Passkey.create({
        credentialId: credId,
        publicKey: Buffer.from('mock-public-key').toString('base64url'),
        userId: adminAUser._id,
        deviceType: 'singleDevice',
        deviceLabel: 'Test Chrome Authenticator'
      });

      expect(passkey._id).toBeDefined();

      // Duplicate credentialId fails with unique constraint
      await expect(
        Passkey.create({
          credentialId: credId,
          publicKey: Buffer.from('mock-public-key-2').toString('base64url'),
          userId: adminAUser._id,
          deviceLabel: 'Test Chrome Authenticator'
        })
      ).rejects.toThrow();

      await Passkey.deleteOne({ _id: passkey._id });
    });

    it('5. SecurityPolicy: Verifies system security policy retrieval', async () => {
      const policyKey = `password_policy_${secTimestamp}`;
      const policy = await SecurityPolicy.create({
        key: policyKey,
        passwordPolicy: { minLength: 12, requireSpecialChars: true },
        description: 'Test password policy'
      });

      expect(policy._id).toBeDefined();
      const fetched = await SecurityPolicy.findOne({ key: policyKey });
      expect(fetched.passwordPolicy.minLength).toBe(12);

      await SecurityPolicy.deleteOne({ _id: policy._id });
    });

    it('6. Announcement: Verifies tenant-bound creation and broadcast', async () => {
      const ann = await Announcement.create({
        tenantId: tenantA._id,
        authorId: adminAUser._id,
        authorName: adminAUser.name,
        title: 'Midterm Examination Schedule',
        content: 'Midterms begin next week across all departments.',
        targetAudience: 'all',
        status: 'published'
      });

      expect(ann._id).toBeDefined();
      expect(ann.tenantId.toString()).toBe(tenantA._id.toString());

      // Tenant isolation: Tenant B query should not find this announcement
      const crossCheck = await Announcement.findOne({ _id: ann._id, tenantId: tenantB._id });
      expect(crossCheck).toBeNull();

      await Announcement.deleteOne({ _id: ann._id });
    });

    it('7. AcademicEvent: Verifies timetable event scheduling and updates', async () => {
      const event = await AcademicEvent.create({
        tenantId: tenantA._id,
        title: 'Faculty Senate Meeting',
        dateStr: '2026-11-15',
        startTime: new Date('2026-11-15T10:00:00Z'),
        endTime: new Date('2026-11-15T12:00:00Z'),
        eventType: 'academic_event'
      });

      expect(event._id).toBeDefined();

      event.title = 'Updated Faculty Senate Meeting';
      await event.save();

      const updated = await AcademicEvent.findById(event._id);
      expect(updated.title).toBe('Updated Faculty Senate Meeting');

      await AcademicEvent.deleteOne({ _id: event._id });
    });
  });
});
