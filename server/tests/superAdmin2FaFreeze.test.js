/**
 * EdWth LMS — Temporary SuperAdmin 2FA Freeze Regression Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. SuperAdmin authenticates with login ID/email and password only when ENABLE_SUPERADMIN_2FA=false in dev/staging.
 * 2. Successful login returns normal, fully authenticated session token (no requires2FA, no preAuthToken).
 * 3. Incorrect passwords are rejected with 401.
 * 4. Non-SuperAdmin cannot obtain SuperAdmin access.
 * 5. Student, trainer, and school-admin authentication remain unchanged.
 * 6. All normal SuperAdmin API permissions remain active.
 * 7. Production mode strictly refuses the bypass and halts startup if enabled.
 * 8. Existing MFA database records (secrets, backup codes, isTwoFactorEnabled) remain intact.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import { getJwtSecret, validateProductionEnv, isSuperAdmin2FaFrozen } from '../config/environment.js';
import { encryptTotpSecret } from '../utils/mfaCrypto.js';

describe('EdWth LMS — SuperAdmin 2FA Freeze & Password-Only Login Suite', () => {
  const testRunId = Date.now();
  const rawAdminPassword = 'SuperAdmin!FreezePassword2026';
  const rawStudentPassword = 'Student!Password2026';
  const rawTrainerPassword = 'Trainer!Password2026';

  let superAdminUser;
  let studentUser;
  let trainerUser;
  let testTenant;
  const initialSecretCipher = encryptTotpSecret('JBSWY3DPEHPK3PXP');
  const initialBackupHash = '$2b$10$abcdefghijklmnopqrstuu';

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    testTenant = await College.create({
      name: `Freeze Test College ${testRunId}`,
      code: `FTC-${testRunId}`,
      slug: `ftc-${testRunId}`,
      institutionType: 'college',
      status: 'active'
    });

    // Enrolled SuperAdmin with existing MFA data in MongoDB
    superAdminUser = await User.create({
      studentId: `SA-FRZ-${testRunId}`,
      name: 'Corporate SuperAdmin',
      email: `superadmin.freeze.${testRunId}@6c.com`,
      password: await bcrypt.hash(rawAdminPassword, 10),
      role: 'superadmin',
      tenantId: null,
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      mfaSetupRequired: false,
      twoFactorSecret: initialSecretCipher,
      twoFactorBackupCodes: [initialBackupHash]
    });

    // Student user
    studentUser = await User.create({
      studentId: `STU-FRZ-${testRunId}`,
      name: 'Test Student',
      email: `student.freeze.${testRunId}@lumina.test`,
      password: await bcrypt.hash(rawStudentPassword, 10),
      role: 'student',
      tenantId: testTenant._id,
      isTwoFactorEnabled: false
    });

    // Trainer user
    trainerUser = await User.create({
      studentId: `TRN-FRZ-${testRunId}`,
      name: 'Test Trainer',
      email: `trainer.freeze.${testRunId}@corp.org`,
      password: await bcrypt.hash(rawTrainerPassword, 10),
      role: 'trainer',
      tenantId: testTenant._id,
      isTwoFactorEnabled: false
    });
  });

  afterAll(async () => {
    if (superAdminUser?._id) await User.deleteOne({ _id: superAdminUser._id });
    if (studentUser?._id) await User.deleteOne({ _id: studentUser._id });
    if (trainerUser?._id) await User.deleteOne({ _id: trainerUser._id });
    if (testTenant?._id) await College.deleteOne({ _id: testTenant._id });
  });

  describe('1. Controlled Password-Only SuperAdmin Login (Dev / Staging Mode)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.ENABLE_SUPERADMIN_2FA = 'false';
    });

    it('1.1 isSuperAdmin2FaFrozen returns true when ENABLE_SUPERADMIN_2FA=false in non-production', () => {
      expect(isSuperAdmin2FaFrozen()).toBe(true);
    });

    it('1.2 Existing SuperAdmin logs in with email and password without 2FA prompt or preAuthToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: rawAdminPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requires2FA).toBeFalsy();
      expect(res.body.preAuthToken).toBeUndefined();
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');

      // Verify user payload
      expect(res.body.user.role).toBe('superadmin');
      expect(res.body.user.email).toBe(superAdminUser.email);
      expect(res.body.user.mfaSetupRequired).toBe(false);
      expect(res.body.user.superAdmin2FaFrozen).toBe(true);

      // Verify token decoded has full session access (not preAuth)
      const decoded = jwt.verify(res.body.token, getJwtSecret());
      expect(decoded.id).toBe(superAdminUser._id.toString());
      expect(decoded.preAuth).toBeUndefined();
    });

    it('1.3 SuperAdmin can log in using studentId identifier and password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: superAdminUser.studentId,
          password: rawAdminPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.requires2FA).toBeFalsy();
      expect(res.body.token).toBeTruthy();
    });

    it('1.4 Authenticated session from password-only login accesses protected endpoints without MFA block', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: rawAdminPassword
        });

      const token = loginRes.body.token;

      // Access protected profile
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user.role).toBe('superadmin');

      // Access admin sensitive endpoint
      const adminRes = await request(app)
        .get('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${token}`);

      expect(adminRes.status).not.toBe(403);
    });

    it('1.5 Existing MFA records in MongoDB remain completely intact and preserved', async () => {
      const doc = await User.findById(superAdminUser._id).select('+twoFactorSecret +twoFactorBackupCodes');
      expect(doc.isTwoFactorEnabled).toBe(true);
      expect(doc.mfaEnforced).toBe(true);
      expect(doc.twoFactorSecret).toBe(initialSecretCipher);
      expect(doc.twoFactorBackupCodes.length).toBe(1);
      expect(doc.twoFactorBackupCodes[0]).toBe(initialBackupHash);
    });
  });

  describe('2. Negative & Boundary Security Protections', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
      process.env.ENABLE_SUPERADMIN_2FA = 'false';
    });

    it('2.1 Incorrect password for SuperAdmin is rejected with 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: 'WrongPassword!123'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid credentials');
    });

    it('2.2 Empty password is rejected with 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: ''
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.3 Non-SuperAdmin cannot obtain SuperAdmin privileges', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.email,
          password: rawStudentPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('student');
      expect(res.body.user.superAdmin2FaFrozen).toBeFalsy();

      // Student token cannot access superadmin/admin endpoints
      const studentToken = res.body.token;
      const adminRes = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(adminRes.status).toBe(403);
    });

    it('2.4 Trainer authentication remains normal and isolated', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: trainerUser.email,
          password: rawTrainerPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('trainer');
    });
  });

  describe('3. Production Failsafe & Strict Startup Protection', () => {
    it('3.1 isSuperAdmin2FaFrozen strictly returns false when NODE_ENV=production', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevFlag = process.env.ENABLE_SUPERADMIN_2FA;
      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_SUPERADMIN_2FA = 'false';
        expect(isSuperAdmin2FaFrozen()).toBe(false);
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.ENABLE_SUPERADMIN_2FA = prevFlag;
      }
    });

    it('3.2 validateProductionEnv halts startup if ENABLE_SUPERADMIN_2FA=false in production', () => {
      const prevEnv = process.env.NODE_ENV;
      const prevFlag = process.env.ENABLE_SUPERADMIN_2FA;
      const prevMfaKey = process.env.MFA_ENCRYPTION_KEY;
      const prevJwt = process.env.JWT_SECRET;
      const prevMongo = process.env.MONGO_URI;

      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_SUPERADMIN_2FA = 'false';
        process.env.MONGO_URI = 'mongodb://localhost:27017/prod_db';
        process.env.JWT_SECRET = 'a'.repeat(32);
        process.env.MFA_ENCRYPTION_KEY = 'b'.repeat(32);

        expect(() => validateProductionEnv()).toThrow(
          /ENABLE_SUPERADMIN_2FA cannot be "false" in production/
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.ENABLE_SUPERADMIN_2FA = prevFlag;
        process.env.MFA_ENCRYPTION_KEY = prevMfaKey;
        process.env.JWT_SECRET = prevJwt;
        process.env.MONGO_URI = prevMongo;
      }
    });

    it('3.3 In production, SuperAdmin login enforces full 2FA challenge and never bypasses', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevFlag = process.env.ENABLE_SUPERADMIN_2FA;
      try {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_SUPERADMIN_2FA = 'false'; // Attempted bypass in production

        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: superAdminUser.email,
            password: rawAdminPassword
          });

        expect(res.status).toBe(200);
        // Production fails closed: requires2FA MUST be true, preAuthToken must be returned!
        expect(res.body.requires2FA).toBe(true);
        expect(res.body.preAuthToken).toBeTruthy();
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.ENABLE_SUPERADMIN_2FA = prevFlag;
      }
    });
  });

  describe('4. Full 2FA Reinstatement When Flag is Enabled', () => {
    it('4.1 When ENABLE_SUPERADMIN_2FA=true, normal 2FA prompt is restored', async () => {
      process.env.NODE_ENV = 'test';
      process.env.ENABLE_SUPERADMIN_2FA = 'true';

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: rawAdminPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.requires2FA).toBe(true);
      expect(res.body.preAuthToken).toBeTruthy();
    });
  });
});

