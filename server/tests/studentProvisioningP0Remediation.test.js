/**
 * Lumina LMS — P0 Student Provisioning Remediation Test Suite
 * 6th Civilians Corporation
 *
 * Validates the three P0 remediations:
 * - Fix A: Global Email Uniqueness and E11000 duplicate key recovery
 * - Fix B: Collision-resistant Student ID allocation with retry and bounded 503 handling
 * - Fix C: Secure Temporary Credential handover and UI delivery contracts
 *
 * 14 Test Scenarios:
 * 1. Normal student creation in POST /api/v1/students.
 * 2. Normal student creation in POST /api/v1/admin/students.
 * 3. Same-tenant email duplicate rejection (HTTP 409, DUPLICATE_EMAIL).
 * 4. Cross-tenant email duplicate rejection (HTTP 409, DUPLICATE_EMAIL).
 * 5. Deactivated-account duplicate rejection (HTTP 409, canRestore).
 * 6. Auto-generated student ID uniqueness across multiple creations.
 * 7. Simulated student ID collision retry and recovery.
 * 8. Explicit duplicate student ID rejection (HTTP 409, DUPLICATE_STUDENT_ID).
 * 9. Exhaustion of student ID generation attempts (HTTP 503, STUDENT_ID_ALLOCATION_FAILED).
 * 10. Explicit password accepted and validated against security policy.
 * 11. Auto-generated temporary password returned when password omitted.
 * 12. Audit logging for both endpoints without logging raw passwords.
 * 13. User.mustChangePassword: true set on all newly created student accounts.
 * 14. Concurrent creation of students with adjacent IDs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — P0 Student Provisioning Remediation Suite', () => {
  jest.setTimeout(120000);
  const testSuffix = Date.now();

  let schoolAlpha;
  let schoolBeta;
  let superAdminUser;
  let superAdminToken;
  let schoolAdminUser;
  let schoolAdminToken;

  const makeAuthToken = (user) => {
    return jwt.sign(
      {
        id: user._id.toString(),
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null
      },
      getJwtSecret(),
      { expiresIn: '2h' }
    );
  };

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const hashedPassword = await bcrypt.hash('AlphaAdmin#2026!', 10);

    // 1. Create Institutions
    schoolAlpha = await College.create({
      name: `Alpha School ${testSuffix}`,
      code: `ALPH-${testSuffix}`,
      slug: `alpha-school-${testSuffix}`,
      institutionType: 'school',
      status: 'active'
    });

    schoolBeta = await College.create({
      name: `Beta Academy ${testSuffix}`,
      code: `BETA-${testSuffix}`,
      slug: `beta-academy-${testSuffix}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create Super Admin
    superAdminUser = await User.create({
      tenantId: null,
      name: 'Global Super Admin',
      email: `superadmin.p0.${testSuffix}@6thcivilians.org`,
      studentId: `ADM-SUP-${testSuffix}`,
      password: hashedPassword,
      role: 'superadmin',
      accountStatus: 'Active',
      status: 'Active'
    });
    superAdminToken = makeAuthToken(superAdminUser);

    // 3. Create School Admin for Alpha School
    schoolAdminUser = await User.create({
      tenantId: schoolAlpha._id,
      name: 'Alpha School Principal',
      email: `principal.alpha.${testSuffix}@alphaschool.edu`,
      studentId: `ADM-SCH-${testSuffix}`,
      password: hashedPassword,
      role: 'admin',
      accountStatus: 'Active',
      status: 'Active'
    });
    schoolAdminToken = makeAuthToken(schoolAdminUser);
  });

  afterEach(() => {
    delete global.__mockStudentIdGenerator;
  });

  afterAll(async () => {
    delete global.__mockStudentIdGenerator;
  });

  // Scenario 1: Normal student creation in POST /api/v1/students
  it('Scenario 1: creates a student normally via POST /api/v1/students', async () => {
    const studentEmail = `student.alpha1.${testSuffix}@alphaschool.edu`;
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Aarav Patel',
        email: studentEmail,
        standard: 'Class 11',
        section: 'A',
        group: 'Group I (MPC)',
        medium: 'English'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.student).toBeDefined();
    expect(res.body.student.email).toBe(studentEmail);
    expect(res.body.student.role).toBe('student');
    expect(res.body.student.studentId).toMatch(/^STU-\d{4}-\d{6}$/);
    expect(res.body.student.mustChangePassword).toBe(true);
    expect(res.body.temporaryPassword).toBeDefined();
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(res.body.isTemporaryPassword).toBe(true);
    expect(res.body.student.password).toBeUndefined(); // Password not exposed in JSON
  });

  // Scenario 2: Normal student creation in POST /api/v1/admin/students
  it('Scenario 2: creates a student normally via POST /api/v1/admin/students', async () => {
    const studentEmail = `student.admin1.${testSuffix}@alphaschool.edu`;
    const res = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Diya Sharma',
        email: studentEmail,
        standard: 'Class 12',
        section: 'B',
        group: 'Group II (BiPC)',
        medium: 'English'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.student).toBeDefined();
    expect(res.body.student.email).toBe(studentEmail);
    expect(res.body.student.studentId).toMatch(/^STU-\d{4}-\d{6}$/);
    expect(res.body.temporaryPassword).toBeDefined();
    expect(res.body.isTemporaryPassword).toBe(true);
    expect(res.body.student.password).toBeUndefined();
  });

  // Scenario 3: Same-tenant email duplicate rejection (HTTP 409, correct code)
  it('Scenario 3: rejects duplicate email in same tenant with HTTP 409 and DUPLICATE_EMAIL', async () => {
    const duplicateEmail = `same.tenant.dup.${testSuffix}@alphaschool.edu`;

    // First creation
    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Student One',
        email: duplicateEmail
      });
    expect(res1.status).toBe(201);

    // Duplicate attempt (case-insensitive) via student endpoint
    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Student Duplicate',
        email: duplicateEmail.toUpperCase()
      });
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.code).toBe('DUPLICATE_EMAIL');
    expect(res2.body.message).toMatch(/already exists in this institution/i);

    // Duplicate attempt via admin endpoint
    const res3 = await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Student Duplicate Admin',
        email: duplicateEmail
      });
    expect(res3.status).toBe(409);
    expect(res3.body.success).toBe(false);
    expect(res3.body.code).toBe('DUPLICATE_EMAIL');
  });

  // Scenario 4: Cross-tenant email duplicate rejection (HTTP 409, correct code)
  it('Scenario 4: rejects cross-tenant email duplicate with HTTP 409 without leaking other tenant info', async () => {
    const crossEmail = `cross.tenant.${testSuffix}@alphaschool.edu`;

    // Created in Alpha School
    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Alpha Student',
        email: crossEmail
      });
    expect(res1.status).toBe(201);

    // Attempted creation in Beta Academy with same email
    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolBeta._id.toString(),
        name: 'Beta Impostor',
        email: crossEmail
      });
    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.code).toBe('DUPLICATE_EMAIL');
    expect(res2.body.message).toMatch(/already exists in the system/i);
    expect(res2.body.message).not.toMatch(/Alpha School/i); // No cross-tenant identity leak
  });

  // Scenario 5: Deactivated-account duplicate rejection (HTTP 409, restore option)
  it('Scenario 5: rejects duplicate for deactivated account and surfaces canRestore', async () => {
    const deactivatedEmail = `deactivated.${testSuffix}@alphaschool.edu`;

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Deactivated Student',
        email: deactivatedEmail
      });
    expect(res1.status).toBe(201);
    const studentId = res1.body.student._id;

    // Soft-delete the student
    await User.updateOne({ _id: studentId }, { soft_deleted: true, status: 'Inactive', accountStatus: 'Suspended' });

    // Attempt re-provisioning with same email
    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Reactivated Student',
        email: deactivatedEmail
      });

    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('DUPLICATE_EMAIL');
    expect(res2.body.canRestore).toBe(true);
    expect(res2.body.studentId.toString()).toBe(studentId.toString());
  });

  // Scenario 6: Auto-generated student ID uniqueness across multiple creations
  it('Scenario 6: allocates unique, well-formatted student IDs across multiple creations', async () => {
    const studentIds = new Set();
    const batchCount = 10;

    for (let i = 0; i < batchCount; i++) {
      const res = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: schoolAlpha._id.toString(),
          name: `Batch Student ${i}`,
          email: `batch.student.${i}.${testSuffix}@alphaschool.edu`
        });

      expect(res.status).toBe(201);
      const allocatedId = res.body.student.studentId;
      expect(allocatedId).toMatch(/^STU-\d{4}-\d{6}$/);
      expect(studentIds.has(allocatedId)).toBe(false);
      studentIds.add(allocatedId);
    }

    expect(studentIds.size).toBe(batchCount);
  });

  // Scenario 7: Simulated student ID collision retry and recovery
  it('Scenario 7: recovers transparently from simulated student ID collision', async () => {
    // 1. Pre-occupy an ID
    const collidingId = `STU-2026-999001`;
    await User.create({
      tenantId: schoolAlpha._id,
      name: 'Existing Colliding User',
      email: `colliding.occupant.${testSuffix}@alphaschool.edu`,
      studentId: collidingId,
      password: 'HashedPassword123!',
      role: 'student'
    });

    // 2. Mock candidate generator: first yield collidingId, then a fresh ID
    let callCount = 0;
    const targetFreshId = `STU-2026-999002`;
    global.__mockStudentIdGenerator = () => {
      callCount++;
      return callCount === 1 ? collidingId : targetFreshId;
    };

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Resilient Student',
        email: `resilient.student.${testSuffix}@alphaschool.edu`
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.student.studentId).toBe(targetFreshId);
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  // Scenario 8: Explicit duplicate student ID rejection (HTTP 409, correct code)
  it('Scenario 8: rejects duplicate explicit student ID with HTTP 409 and DUPLICATE_STUDENT_ID', async () => {
    const explicitId = `ALPHA-MANUAL-${testSuffix}`;

    const res1 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Manual ID Student 1',
        email: `manual.id1.${testSuffix}@alphaschool.edu`,
        studentId: explicitId
      });
    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Manual ID Student 2',
        email: `manual.id2.${testSuffix}@alphaschool.edu`,
        studentId: explicitId
      });

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.code).toBe('DUPLICATE_STUDENT_ID');
    expect(res2.body.message).toMatch(/already assigned/i);
  });

  // Scenario 9: Exhaustion of student ID generation attempts (controlled 503 error, never 500)
  it('Scenario 9: returns controlled HTTP 503 (STUDENT_ID_ALLOCATION_FAILED) upon attempt exhaustion', async () => {
    const infiniteCollidingId = `STU-2026-ALWAYS-EXISTS`;
    await User.create({
      tenantId: schoolAlpha._id,
      name: 'Permanent Occupant',
      email: `exhaustion.occupant.${testSuffix}@alphaschool.edu`,
      studentId: infiniteCollidingId,
      password: 'HashedPassword123!',
      role: 'student'
    });

    // Mock generator to ALWAYS return the existing ID
    global.__mockStudentIdGenerator = () => infiniteCollidingId;

    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Exhausted Student',
        email: `exhausted.${testSuffix}@alphaschool.edu`
      });

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('STUDENT_ID_ALLOCATION_FAILED');
    expect(res.body.message).toMatch(/unable to allocate a unique student identifier/i);
  });

  // Scenario 10: Explicit password accepted and validated against security policy
  it('Scenario 10: validates explicit password against policy (rejects weak, accepts strong)', async () => {
    // Weak password rejected
    const weakRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Weak Password Student',
        email: `weak.pwd.${testSuffix}@alphaschool.edu`,
        password: 'weak'
      });
    expect(weakRes.status).toBe(400);
    expect(weakRes.body.code).toBe('PASSWORD_POLICY_VIOLATION');

    // Strong explicit password accepted
    const strongPassword = 'StrongStudent#2026!Alpha';
    const strongRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Strong Password Student',
        email: `strong.pwd.${testSuffix}@alphaschool.edu`,
        password: strongPassword
      });

    expect(strongRes.status).toBe(201);
    expect(strongRes.body.success).toBe(true);
    expect(strongRes.body.temporaryPassword).toBeUndefined(); // Explicit password not echoed as temporary
    expect(strongRes.body.isTemporaryPassword).toBe(false);

    // Verify hash in DB works with explicit password
    const userInDb = await User.findOne({ email: `strong.pwd.${testSuffix}@alphaschool.edu` });
    expect(userInDb).toBeDefined();
    const isMatch = await bcrypt.compare(strongPassword, userInDb.password);
    expect(isMatch).toBe(true);
  });

  // Scenario 11: Auto-generated temporary password returned when password omitted
  it('Scenario 11: returns complex temporary password when password omitted and verifies bcrypt match', async () => {
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Auto Temp Pwd Student',
        email: `temp.pwd.${testSuffix}@alphaschool.edu`
      });

    expect(res.status).toBe(201);
    const tempPwd = res.body.temporaryPassword;
    expect(tempPwd).toBeDefined();
    expect(tempPwd.length).toBeGreaterThanOrEqual(12);
    expect(res.body.isTemporaryPassword).toBe(true);

    const userInDb = await User.findOne({ email: `temp.pwd.${testSuffix}@alphaschool.edu` });
    expect(userInDb).toBeDefined();
    const isMatch = await bcrypt.compare(tempPwd, userInDb.password);
    expect(isMatch).toBe(true);
  });

  // Scenario 12: Audit logging for both endpoints without logging raw passwords
  it('Scenario 12: creates critical audit logs without ever logging raw passwords', async () => {
    const student1Email = `audit.student1.${testSuffix}@alphaschool.edu`;
    const student2Email = `audit.student2.${testSuffix}@alphaschool.edu`;

    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Audit Student 1',
        email: student1Email
      });

    await request(app)
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        name: 'Audit Student 2',
        email: student2Email
      });

    const logs = await AuditLog.find({
      action: 'ADMIN_STUDENT_PROVISIONED',
      'details.email': { $in: [student1Email, student2Email] }
    });

    expect(logs.length).toBe(2);

    for (const log of logs) {
      expect(log.details.email).toBeDefined();
      expect(log.details.studentId).toBeDefined();
      expect(log.details.password).toBeUndefined();
      expect(log.details.temporaryPassword).toBeUndefined();
      expect(log.details.hash).toBeUndefined();

      const serialized = JSON.stringify(log.toObject());
      expect(serialized).not.toMatch(/password/i);
    }
  });

  // Scenario 13: User.mustChangePassword: true set on all newly created student accounts
  it('Scenario 13: enforces User.mustChangePassword = true on all newly created accounts', async () => {
    const email1 = `mustchange.auto.${testSuffix}@alphaschool.edu`;
    const email2 = `mustchange.explicit.${testSuffix}@alphaschool.edu`;

    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Must Change Auto',
        email: email1
      });

    await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        tenantId: schoolAlpha._id.toString(),
        name: 'Must Change Explicit',
        email: email2,
        password: 'ValidPassword#2026!'
      });

    const u1 = await User.findOne({ email: email1 });
    const u2 = await User.findOne({ email: email2 });

    expect(u1.mustChangePassword).toBe(true);
    expect(u2.mustChangePassword).toBe(true);
  });

  // Scenario 14: Concurrent creation of students with adjacent IDs
  it('Scenario 14: handles concurrent student creations cleanly without duplicate key crashes', async () => {
    const concurrentCount = 6;
    const promises = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        request(app)
          .post('/api/v1/students')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            tenantId: schoolAlpha._id.toString(),
            name: `Concurrent Student ${i}`,
            email: `concurrent.${i}.${testSuffix}@alphaschool.edu`,
            standard: 'Class 11',
            section: 'A'
          })
      );
    }

    const results = await Promise.all(promises);

    for (const res of results) {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.student.studentId).toMatch(/^STU-\d{4}-\d{6}$/);
    }

    const createdIds = results.map((r) => r.body.student.studentId);
    const uniqueIds = new Set(createdIds);
    expect(uniqueIds.size).toBe(concurrentCount);
  });
});

