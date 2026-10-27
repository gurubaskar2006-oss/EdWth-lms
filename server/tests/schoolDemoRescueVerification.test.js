/**
 * EdWth LMS — School Visit Demo Rescue Verification Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Admin student creation (createStudent) hashes password with bcrypt so student can log in.
 * 2. School student login correctly returns institutionType: 'school' for school tenant scoping.
 * 3. Reset password endpoint generates a verified temporary password that authenticates properly.
 * 4. apiService has getStorageDownloadUrl restored.
 * 5. School student demo credentials drawer is accessible with ?demo=true without leaking passwords or backdoors.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import { apiService } from '../../src/services/apiService.js';

describe('EdWth LMS — School Visit Demo Rescue Verification', () => {
  const ts = Date.now();
  let schoolTenant;
  let adminUser;
  let adminToken;
  let testStudent;

  beforeAll(async () => {
    // Wait for DB ready
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create school tenant
    schoolTenant = await College.create({
      name: `Oakridge High School Demo ${ts}`,
      code: `OAKDEMO_${ts}`,
      slug: `oakdemo-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create school administrator
    const adminHashedPass = await bcrypt.hash('Admin#123!', 10);
    adminUser = await User.create({
      studentId: `ADM-DEMO-${ts}`,
      name: 'School Admin Demo',
      email: `admin.demo.${ts}@oakridge.test`,
      password: adminHashedPass,
      role: 'admin',
      tenantId: schoolTenant._id,
      tenantName: schoolTenant.name,
      accountStatus: 'Active'
    });

    const jwtSecret = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_with_more_than_32_characters';
    adminToken = jwt.sign({ id: adminUser._id }, jwtSecret, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (schoolTenant) {
      await User.deleteMany({ tenantId: schoolTenant._id });
      await College.deleteOne({ _id: schoolTenant._id });
    }
  });

  describe('1. Student Creation & Bcrypt Hash Verification', () => {
    it('should hash student password with bcrypt upon creation and allow successful login', async () => {
      const studentEmail = `student.created.${ts}@oakridge.test`;
      const plainPassword = 'CreatedStudent#2026!';

      // Admin registers a new student
      const createRes = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Aisha Rescue Patel',
          email: studentEmail,
          password: plainPassword,
          role: 'student',
          major: 'Class 10 - Section A',
          department: 'Secondary Education',
          year: '10th Standard'
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);

      // Verify the password in DB is a valid bcrypt hash, NOT plaintext
      const dbRecord = await User.findOne({ email: studentEmail });
      expect(dbRecord).toBeTruthy();
      expect(dbRecord.password).not.toBe(plainPassword);
      expect(dbRecord.password).toMatch(/^\$2[aby]\$\d+\$/);

      // Verify student can authenticate with their password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentEmail,
          password: plainPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.token).toBeTruthy();
      expect(loginRes.body.user.role).toBe('student');
      expect(loginRes.body.user.institutionType).toBe('school');
      expect(loginRes.body.user.tenantName).toBe(schoolTenant.name);
    });
  });

  describe('2. Student Password Reset Workflow', () => {
    it('should generate a secure temporary password by MongoDB _id and allow student login with forced change', async () => {
      const studentEmail = `student.reset.${ts}@oakridge.test`;
      const originalPass = await bcrypt.hash('OldSecret#123!', 10);

      const targetStudent = await User.create({
        studentId: `SCH-RST-${ts}`,
        name: 'Reset Test Student',
        email: studentEmail,
        password: originalPass,
        role: 'student',
        tenantId: schoolTenant._id,
        tenantName: schoolTenant.name,
        accountStatus: 'Active'
      });

      // Admin triggers reset by MongoDB _id
      const resetRes = await request(app)
        .post(`/api/v1/students/${targetStudent._id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.temporaryPassword).toBeTruthy();

      const tempPassword = resetRes.body.temporaryPassword;

      // Student logs in with temporary password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentEmail,
          password: tempPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.mustChangePassword).toBe(true);
      expect(loginRes.body.user.mustChangePassword).toBe(true);
      expect(loginRes.body.user.institutionType).toBe('school');
    });

    it('should reset password when requested with school studentId (e.g. SCH-2026-004) without Mongoose CastError', async () => {
      const schoolStudentId = `SCH-2026-${ts}`;
      const studentEmail = `student.schoolid.${ts}@oakridge.test`;
      const originalPass = await bcrypt.hash('InitialPass#123!', 10);

      const schoolStudent = await User.create({
        studentId: schoolStudentId,
        name: 'Aisha SchoolId Test',
        email: studentEmail,
        password: originalPass,
        role: 'student',
        tenantId: schoolTenant._id,
        tenantName: schoolTenant.name,
        accountStatus: 'Active'
      });

      // Reset using the school student ID string instead of MongoDB _id
      const resetRes = await request(app)
        .post(`/api/v1/students/${schoolStudentId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.temporaryPassword).toBeTruthy();
      expect(typeof resetRes.body.temporaryPassword).toBe('string');
      expect(resetRes.body.temporaryPassword.length).toBe(12);

      // Verify password was updated to a bcrypt hash in DB
      const updatedUser = await User.findById(schoolStudent._id);
      expect(updatedUser.password).not.toBe(originalPass);
      expect(updatedUser.password).toMatch(/^\$2[aby]\$\d+\$/);
      expect(updatedUser.mustChangePassword).toBe(true);

      // Verify login with temporary password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentEmail,
          password: resetRes.body.temporaryPassword
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
    });

    it('should reset password via admin route (/api/v1/admin/students/:studentId/reset-password) by studentId', async () => {
      const studentId = `SCH-ADM-${ts}`;
      const studentEmail = `student.adminroute.${ts}@oakridge.test`;

      await User.create({
        studentId,
        name: 'Admin Route Test Student',
        email: studentEmail,
        password: await bcrypt.hash('Pass#123!', 10),
        role: 'student',
        tenantId: schoolTenant._id,
        tenantName: schoolTenant.name,
        accountStatus: 'Active'
      });

      const resetRes = await request(app)
        .post(`/api/v1/admin/students/${studentId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.temporaryPassword).toBeTruthy();
    });

    it('returns controlled 404 (not 500 or CastError) when student identifier does not exist', async () => {
      const res = await request(app)
        .post('/api/v1/students/SCH-NONEXISTENT-9999/reset-password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Student not found/i);
    });

    it('strictly enforces tenant isolation: cross-institution admin cannot reset password', async () => {
      // Create a foreign tenant and admin
      const foreignTenant = await College.create({
        name: `Foreign Academy ${ts}`,
        code: `FOR_${ts}`,
        slug: `foreign-${ts}`,
        institutionType: 'school',
        status: 'active'
      });

      const foreignAdmin = await User.create({
        studentId: `FOR-ADM-${ts}`,
        name: 'Foreign Admin',
        email: `foreign.admin.${ts}@test.org`,
        password: await bcrypt.hash('Foreign#123!', 10),
        role: 'admin',
        tenantId: foreignTenant._id,
        tenantName: foreignTenant.name,
        accountStatus: 'Active'
      });

      const jwtSecret = process.env.JWT_SECRET || 'a_very_strong_production_test_secret_with_more_than_32_characters';
      const foreignToken = jwt.sign({ id: foreignAdmin._id }, jwtSecret, { expiresIn: '1h' });

      // Create a student in schoolTenant
      const localStudent = await User.create({
        studentId: `SCH-ISOL-${ts}`,
        name: 'Isolated Student',
        email: `isolated.${ts}@oakridge.test`,
        password: await bcrypt.hash('Secret#123!', 10),
        role: 'student',
        tenantId: schoolTenant._id,
        tenantName: schoolTenant.name,
        accountStatus: 'Active'
      });

      // Foreign admin attempts to reset local student's password
      const resetRes = await request(app)
        .post(`/api/v1/students/${localStudent.studentId}/reset-password`)
        .set('Authorization', `Bearer ${foreignToken}`)
        .send();

      expect(resetRes.status).toBe(404);
      expect(resetRes.body.success).toBe(false);

      // Clean up foreign tenant
      await User.deleteMany({ tenantId: foreignTenant._id });
      await College.deleteOne({ _id: foreignTenant._id });
    });
  });

  describe('3. apiService Method Availability', () => {
    it('has getStorageDownloadUrl defined and functional on apiService', () => {
      expect(typeof apiService.getStorageDownloadUrl).toBe('function');
    });
  });

  describe('4. Security Gate: Public Demo Login Shortcut Disabled', () => {
    it('ensures LoginModal and UnauthenticatedView do not expose demo=true public backdoors', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const loginModalCode = fs.readFileSync(path.resolve('src/components/LoginModal.jsx'), 'utf-8');
      const unauthViewCode = fs.readFileSync(path.resolve('src/components/UnauthenticatedView.jsx'), 'utf-8');

      expect(loginModalCode).not.toContain('demo=true');
      expect(unauthViewCode).not.toContain('demo=true');
      expect(loginModalCode).toContain('import.meta.env.DEV');
      expect(unauthViewCode).toContain('import.meta.env.DEV');
    });
  });

  describe('5. Forced Password Change & Session Continuity Flow', () => {
    let studentRecord;
    let tempPass;
    let tempAuthToken;
    let rotatedAuthToken;

    beforeAll(async () => {
      // Create student in school tenant
      studentRecord = await User.create({
        studentId: `SCH-FPC-${ts}`,
        name: 'Forced Change Student',
        email: `fpc.student.${ts}@oakridge.test`,
        password: await bcrypt.hash('Initial#123!', 10),
        role: 'student',
        tenantId: schoolTenant._id,
        tenantName: schoolTenant.name,
        accountStatus: 'Active'
      });
    });

    it('generates a temporary password when admin resets student password', async () => {
      const resetRes = await request(app)
        .post(`/api/v1/students/${studentRecord.studentId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send();

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.temporaryPassword).toBeTruthy();
      tempPass = resetRes.body.temporaryPassword;

      const updated = await User.findById(studentRecord._id);
      expect(updated.mustChangePassword).toBe(true);
    });

    it('student logs in with temporary password and receives mustChangePassword: true with temporary JWT', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentRecord.studentId,
          password: tempPass
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.mustChangePassword).toBe(true);
      expect(loginRes.body.token).toBeTruthy();
      expect(loginRes.body.user.mustChangePassword).toBe(true);
      expect(loginRes.body.user.institutionType).toBe('school');

      tempAuthToken = loginRes.body.token;
    });

    it('forbids access (403 MUST_CHANGE_PASSWORD) to academic endpoints while mustChangePassword is true', async () => {
      const accessRes = await request(app)
        .get('/api/v1/school/subjects')
        .set('Authorization', `Bearer ${tempAuthToken}`);

      expect(accessRes.status).toBe(403);
      expect(accessRes.body.success).toBe(false);
      expect(accessRes.body.code).toBe('MUST_CHANGE_PASSWORD');
    });

    it('rejects POST /api/v1/auth/change-password with 401 when no token is supplied', async () => {
      const unauthRes = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          newPassword: 'Permanent#2026!Pass',
          confirmPassword: 'Permanent#2026!Pass'
        });

      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.success).toBe(false);
      expect(unauthRes.body.message).toMatch(/Not authorized, no token/i);
    });

    it('successfully changes password with temp token, rotates JWT token, and clears mustChangePassword flag', async () => {
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tempAuthToken}`)
        .send({
          newPassword: 'Permanent#2026!Pass',
          confirmPassword: 'Permanent#2026!Pass'
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.token).toBeTruthy();
      expect(changeRes.body.user).toBeTruthy();
      expect(changeRes.body.user.mustChangePassword).toBe(false);
      expect(changeRes.body.user.institutionType).toBe('school');

      rotatedAuthToken = changeRes.body.token;

      // Verify in DB
      const dbUser = await User.findById(studentRecord._id);
      expect(dbUser.mustChangePassword).toBe(false);
      const isMatch = await bcrypt.compare('Permanent#2026!Pass', dbUser.password);
      expect(isMatch).toBe(true);
    });

    it('allows access to protected academic endpoints using the rotated session token', async () => {
      const schoolRes = await request(app)
        .get('/api/v1/school/subjects')
        .set('Authorization', `Bearer ${rotatedAuthToken}`);

      expect(schoolRes.status).toBe(200);
      expect(schoolRes.body.success).toBe(true);
      expect(Array.isArray(schoolRes.body.subjects)).toBe(true);
    });

    it('student can log in again using permanent password without prompt', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentRecord.studentId,
          password: 'Permanent#2026!Pass'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.mustChangePassword).toBe(false);
      expect(loginRes.body.user.mustChangePassword).toBe(false);
    });

    it('old temporary password is no longer valid', async () => {
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: studentRecord.studentId,
          password: tempPass
        });

      expect(oldLoginRes.status).toBe(401);
      expect(oldLoginRes.body.success).toBe(false);
    });
  });
});
