/**
 * Lumina LMS — Development Test Login & Safe Provisioning Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Only Student, Trainer / Teacher, and Admin (6th Civilians Corporation) appear as development login choices.
 * 2. No Principal or school login is exposed.
 * 3. Student, trainer, and admin authentication each work through the real local development login flow.
 * 4. Invalid credentials are rejected.
 * 5. Institution-scoped users cannot access company-wide administration.
 * 6. No demo students or school data are automatically seeded.
 * 7. Production cannot provision development accounts.
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB, closeDB } from '../database/mongoose.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assessment from '../models/Assessment.js';
import authRoutes from '../routes/authRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import {
  provisionDevTestAccounts,
  assertSafeDevEnvironment,
  DEV_TEST_CREDENTIALS
} from '../scripts/provisionDevTestAccount.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina LMS — Safe Development Test Login Suite', () => {
  let app;
  let devAdminToken;
  let localAdminToken;
  let localAdminUser;
  let localTenantId;

  beforeAll(async () => {
    await connectDB();

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/admin', adminRoutes);

    // Provision clean development accounts
    await provisionDevTestAccounts();

    // Create an isolated institution-scoped admin for RBAC boundary testing
    localTenantId = new mongoose.Types.ObjectId();
    await College.create({
      _id: localTenantId,
      name: 'Local Test Academy',
      code: 'LOCAL-ACAD',
      slug: 'local-acad',
      institutionType: 'school',
      status: 'active'
    });

    localAdminUser = await User.create({
      studentId: 'LOCAL-ADM-001',
      name: 'Local Institution Administrator',
      email: 'local.admin@test.org',
      password: 'HashedPassword@123',
      role: 'admin', // Institution-scoped admin
      tenantId: localTenantId,
      accountStatus: 'Active'
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          DEV_TEST_CREDENTIALS.student.email,
          DEV_TEST_CREDENTIALS.trainer.email,
          DEV_TEST_CREDENTIALS.admin.email,
          'local.admin@test.org'
        ]
      }
    });
    await College.deleteMany({ code: { $in: ['DEV-INST', 'LOCAL-ACAD'] } });
    await closeDB();
  });

  describe('1. UI Contract: Permitted Development Login Roles (No Principal or School Demo)', () => {
    it('LoginModal.jsx contains only Student, Trainer / Teacher, and Admin (6th Civilians Corporation)', () => {
      const modalCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/LoginModal.jsx'), 'utf-8');
      
      // Permitted roles present
      expect(modalCode).toContain('Student (Dev)');
      expect(modalCode).toContain('Trainer / Teacher (Dev)');
      expect(modalCode).toContain('Admin (Dev)');
      expect(modalCode).toContain('Admin — 6th Civilians Corporation');

      // Prohibited roles and demo names absent
      expect(modalCode).not.toContain('Principal (Test)');
      expect(modalCode).not.toContain('Teacher (Test)');
      expect(modalCode).not.toContain('Oakridge');
      expect(modalCode).not.toContain('Sarah Jenkins');
      expect(modalCode).not.toContain('teacher@oakridge.edu');
      expect(modalCode).not.toContain('admin@oakridge.edu');
    });

    it('UnauthenticatedView.jsx contains only Student, Trainer / Teacher, and Admin (6th Civilians Corporation)', () => {
      const viewCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/UnauthenticatedView.jsx'), 'utf-8');

      // Permitted roles present
      expect(viewCode).toContain('Student (Dev)');
      expect(viewCode).toContain('Trainer / Teacher (Dev)');
      expect(viewCode).toContain('Admin (Dev)');
      expect(viewCode).toContain('Admin — 6th Civilians Corporation');

      // Prohibited roles and demo names absent
      expect(viewCode).not.toContain('Principal (Test)');
      expect(viewCode).not.toContain('Teacher (Test)');
      expect(viewCode).not.toContain('Oakridge');
      expect(viewCode).not.toContain('Sarah Jenkins');
      expect(viewCode).not.toContain('teacher@oakridge.edu');
      expect(viewCode).not.toContain('admin@oakridge.edu');
    });
  });

  describe('2. Production & Atlas Safeguards', () => {
    it('strictly refuses to provision dev accounts if NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      expect(() => assertSafeDevEnvironment()).toThrow(
        /Development test accounts cannot be provisioned in production/i
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('strictly refuses to provision dev accounts on a remote Atlas cluster host', () => {
      const originalHost = mongoose.connection.host;
      mongoose.connection.host = 'cluster0.tvhnpjq.mongodb.net';

      expect(() => assertSafeDevEnvironment()).toThrow(
        /Refusing to provision development test accounts on production or Atlas cluster/i
      );

      mongoose.connection.host = originalHost;
    });
  });

  describe('3. Minimal Zero-Demo Compliance', () => {
    it('provisions development test accounts without creating any fake demo students, classes, or assessments', async () => {
      // Verify only the 1 development student account exists
      const studentCount = await User.countDocuments({ role: 'student' });
      expect(studentCount).toBe(1);

      // Verify ZERO fake demo students exist
      const fakeStudents = await User.find({
        name: { $in: ['Leo Miller', 'Samantha Lee', 'Daniel Wu', 'Aisha Patel', 'Maya Lin'] }
      });
      expect(fakeStudents.length).toBe(0);

      // Verify ZERO cohorts/classes exist
      const batchCount = await Batch.countDocuments();
      expect(batchCount).toBe(0);

      // Verify ZERO courses exist
      const courseCount = await Course.countDocuments();
      expect(courseCount).toBe(0);

      // Verify ZERO assessments exist
      const assessmentCount = await Assessment.countDocuments();
      expect(assessmentCount).toBe(0);
    });
  });

  describe('4. Authentication Flow: Student, Trainer, Admin Roles', () => {
    it('successfully logs in dev student account and returns student role with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: DEV_TEST_CREDENTIALS.student.email,
          password: DEV_TEST_CREDENTIALS.student.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.email).toBe(DEV_TEST_CREDENTIALS.student.email);
      expect(res.body.token).toBeDefined();
    });

    it('successfully logs in dev trainer account and returns trainer role with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: DEV_TEST_CREDENTIALS.trainer.email,
          password: DEV_TEST_CREDENTIALS.trainer.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('trainer');
      expect(res.body.user.email).toBe(DEV_TEST_CREDENTIALS.trainer.email);
      expect(res.body.token).toBeDefined();
    });

    it('successfully logs in dev admin account and returns superadmin role with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: DEV_TEST_CREDENTIALS.admin.email,
          password: DEV_TEST_CREDENTIALS.admin.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('superadmin'); // Platform administrator
      expect(res.body.user.email).toBe(DEV_TEST_CREDENTIALS.admin.email);
      expect(res.body.token).toBeDefined();
      devAdminToken = res.body.token;
    });

    it('rejects incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: DEV_TEST_CREDENTIALS.trainer.email,
          password: 'IncorrectPassword@999'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid credentials/i);
    });

    it('rejects nonexistent user with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'nonexistent.user@random.org',
          password: 'SomePassword@123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. RBAC Isolation: Platform Admin vs Institution Admin', () => {
    it('platform admin (6th Civilians Corporation) is granted company-wide overview (isSuperAdmin: true)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${devAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('institution-scoped admin is strictly scoped to local tenant (isSuperAdmin: false)', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      const { getJwtSecret } = await import('../config/environment.js');
      localAdminToken = jwt.sign(
        { id: localAdminUser._id.toString(), role: 'admin', tenantId: localTenantId.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${localAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(false); // Does NOT have company-wide access
    });
  });

  describe('6. Logout Endpoint Verification', () => {
    it('successfully logs out and clears auth cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
