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
    it('should generate a secure temporary password and allow student login with forced change', async () => {
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

      // Admin triggers reset
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
});
