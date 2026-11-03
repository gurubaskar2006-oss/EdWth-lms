/**
 * Lumina LMS — Dynamic Password Policy Test Suite
 * 6th Civilians Corporation
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { getJwtSecret } from '../config/environment.js';
import {
  validatePasswordAgainstEffectivePolicy,
  validatePasswordAgainstPolicyRules,
  ENTERPRISE_SECURE_PASSWORD_DEFAULTS
} from '../utils/passwordPolicyValidator.js';

describe('Lumina LMS — Dynamic Password Policy Enforcement', () => {
  const runId = Date.now();
  let jwtSecret;
  let testTenant;
  let superAdminUser;
  let superAdminToken;
  let trainerUser;
  let originalPolicy;

  const createdUserIds = [];

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    jwtSecret = getJwtSecret();

    // Preserve original SecurityPolicy if present
    const existing = await SecurityPolicy.findOne({ key: 'global_security_policy' }).lean();
    if (existing) {
      originalPolicy = existing.passwordPolicy;
    }

    // Set a known initial baseline policy: minLength: 10, requireUppercase, requireNumbers, requireSpecialChars
    await SecurityPolicy.findOneAndUpdate(
      { key: 'global_security_policy' },
      {
        $set: {
          'passwordPolicy.minLength': 10,
          'passwordPolicy.requireUppercase': true,
          'passwordPolicy.requireLowercase': true,
          'passwordPolicy.requireNumbers': true,
          'passwordPolicy.requireSpecialChars': true
        }
      },
      { upsert: true, new: true }
    );

    // Find or create SuperAdmin
    superAdminUser = await User.findOne({ role: 'superadmin' });
    if (!superAdminUser) {
      const hash = await bcrypt.hash('SuperAdmin!2026', 10);
      superAdminUser = await User.create({
        name: 'Dynamic Policy Test SuperAdmin',
        email: `policy-super-${runId}@6c.com`,
        studentId: `SA-${runId}`,
        password: hash,
        role: 'superadmin',
        isTwoFactorEnabled: true
      });
      createdUserIds.push(superAdminUser._id);
    }
    superAdminToken = jwt.sign({ id: superAdminUser._id, role: 'superadmin' }, jwtSecret, { expiresIn: '1h' });

    // Create a test tenant college
    testTenant = await College.create({
      name: `Policy Test Academy ${runId}`,
      code: `PTA${String(runId).slice(-4)}`,
      slug: `pta-${runId}`,
      institutionType: 'school',
      status: 'active'
    });

    // Create a regular user for password change testing
    const trainerHash = await bcrypt.hash('Initial#Password123', 10);
    trainerUser = await User.create({
      name: `Trainer Test ${runId}`,
      email: `trainer-${runId}@edwthacademy.com`,
      password: trainerHash,
      role: 'trainer',
      tenantId: testTenant._id,
      studentId: `TRN-${runId}`
    });
    createdUserIds.push(trainerUser._id);
  });

  afterAll(async () => {
    // Restore original SecurityPolicy if it existed
    if (originalPolicy) {
      await SecurityPolicy.updateOne(
        { key: 'global_security_policy' },
        { $set: { passwordPolicy: originalPolicy } }
      );
    }

    // Clean up created records
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (testTenant?._id) {
      await College.deleteOne({ _id: testTenant._id });
    }
  });

  describe('1. Unit Validation & Enterprise Defaults', () => {
    it('enforces enterprise secure defaults when policy is fallback', () => {
      expect(ENTERPRISE_SECURE_PASSWORD_DEFAULTS.minLength).toBe(12);
      expect(ENTERPRISE_SECURE_PASSWORD_DEFAULTS.requireUppercase).toBe(true);
      expect(ENTERPRISE_SECURE_PASSWORD_DEFAULTS.requireLowercase).toBe(true);
      expect(ENTERPRISE_SECURE_PASSWORD_DEFAULTS.requireNumbers).toBe(true);
      expect(ENTERPRISE_SECURE_PASSWORD_DEFAULTS.requireSpecialChars).toBe(true);
    });

    it('rejects passwords below length requirement', () => {
      const res = validatePasswordAgainstPolicyRules('Short!1', { minLength: 10 });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/at least 10 characters/i);
    });

    it('rejects passwords missing uppercase letters', () => {
      const res = validatePasswordAgainstPolicyRules('alllowercase123!', { minLength: 8, requireUppercase: true });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/uppercase/i);
    });

    it('rejects passwords missing numbers', () => {
      const res = validatePasswordAgainstPolicyRules('NoNumbersHere!', { minLength: 8, requireNumbers: true });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/number/i);
    });

    it('rejects passwords missing special characters', () => {
      const res = validatePasswordAgainstPolicyRules('NoSpecialChar123', { minLength: 8, requireSpecialChars: true });
      expect(res.valid).toBe(false);
      expect(res.message).toMatch(/special character/i);
    });

    it('accepts compliant passwords', () => {
      const res = validatePasswordAgainstPolicyRules('Valid#Pass2026!', {
        minLength: 10,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      });
      expect(res.valid).toBe(true);
      expect(res.message).toBeNull();
    });
  });

  describe('2. Dynamic MongoDB Policy Propagation', () => {
    it('immediately enforces database policy updates without restart', async () => {
      // 1. Set policy in MongoDB: minLength = 16
      await SecurityPolicy.updateOne(
        { key: 'global_security_policy' },
        { $set: { 'passwordPolicy.minLength': 16 } }
      );

      // A 12-char password that passed earlier must now fail
      const testPass12 = 'Short#Pass12';
      expect(testPass12.length).toBeLessThan(16);
      const check1 = await validatePasswordAgainstEffectivePolicy(testPass12);
      expect(check1.valid).toBe(false);
      expect(check1.message).toMatch(/at least 16 characters/i);

      // A 16-char password passes
      const testPass16 = 'Compliant!Pass16CharLong';
      expect(testPass16.length).toBeGreaterThanOrEqual(16);
      const check2 = await validatePasswordAgainstEffectivePolicy(testPass16);
      expect(check2.valid).toBe(true);

      // 2. Dynamically lower policy in MongoDB: minLength = 8
      await SecurityPolicy.updateOne(
        { key: 'global_security_policy' },
        { $set: { 'passwordPolicy.minLength': 8 } }
      );

      const check3 = await validatePasswordAgainstEffectivePolicy(testPass12);
      expect(check3.valid).toBe(true);
    });
  });

  describe('3. User Password Change Endpoint Enforcement', () => {
    it('rejects password change when new password violates effective policy (400)', async () => {
      // Set policy minLength: 12
      await SecurityPolicy.updateOne(
        { key: 'global_security_policy' },
        { $set: { 'passwordPolicy.minLength': 12, 'passwordPolicy.requireSpecialChars': true } }
      );

      const trainerToken = jwt.sign({ id: trainerUser._id, role: 'trainer' }, jwtSecret, { expiresIn: '1h' });

      // Attempt 1: Too short (9 chars)
      const res1 = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          currentPassword: 'Initial#Password123',
          newPassword: 'Short#123',
          confirmPassword: 'Short#123'
        });

      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.code).toBe('PASSWORD_POLICY_VIOLATION');
      expect(res1.body.message).toMatch(/at least 12 characters/i);

      // Attempt 2: Missing special character
      const res2 = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          currentPassword: 'Initial#Password123',
          newPassword: 'LongPasswordWithoutSpecial123',
          confirmPassword: 'LongPasswordWithoutSpecial123'
        });

      expect(res2.status).toBe(400);
      expect(res2.body.code).toBe('PASSWORD_POLICY_VIOLATION');
      expect(res2.body.message).toMatch(/special character/i);
    });

    it('accepts password change meeting effective dynamic policy (200)', async () => {
      const trainerToken = jwt.sign({ id: trainerUser._id, role: 'trainer' }, jwtSecret, { expiresIn: '1h' });

      const compliantPassword = 'BrandNew#Secure2026!';
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          currentPassword: 'Initial#Password123',
          newPassword: compliantPassword,
          confirmPassword: compliantPassword
        });

      if (res.status !== 200) {
        console.error('change-password failed response:', res.body);
      }
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();

      // Verify user in DB has updated hash
      const updatedUser = await User.findById(trainerUser._id);
      const isMatch = await bcrypt.compare(compliantPassword, updatedUser.password);
      expect(isMatch).toBe(true);
    });
  });

  describe('4. Admin User Creation Policy Enforcement', () => {
    it('POST /api/v1/admin/trainers rejects weak password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Weak Password Trainer',
          email: `weak-trainer-${runId}@edwthacademy.com`,
          password: 'weak',
          tenantId: testTenant._id
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_POLICY_VIOLATION');
    });

    it('POST /api/v1/admin/trainers accepts compliant password (201)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Compliant Trainer',
          email: `valid-trainer-${runId}@edwthacademy.com`,
          password: 'Strong#Trainer2026!',
          tenantId: testTenant._id
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      if (res.body.trainer?._id) {
        createdUserIds.push(res.body.trainer._id);
      }
    });

    it('POST /api/v1/admin/students rejects custom weak password (400)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Weak Password Student',
          email: `weak-student-${runId}@test.com`,
          password: '123',
          tenantId: testTenant._id
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('PASSWORD_POLICY_VIOLATION');
    });

    it('POST /api/v1/admin/students accepts compliant custom password (201)', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Valid Password Student',
          email: `valid-student-${runId}@test.com`,
          password: 'Strong#Student2026!',
          tenantId: testTenant._id
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      if (res.body.student?._id) {
        createdUserIds.push(res.body.student._id);
      }
    });
  });
});
