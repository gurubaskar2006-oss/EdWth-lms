/**
 * EdWth LMS — Authentication Credential Conflict Resolution & Integration Protection Test Suite
 * 6th Civilians Corporation
 *
 * Test Matrix:
 * 1. Valid SuperAdmin Bearer + expired student cookie -> Bearer succeeds; stale cookie cleared
 * 2. Valid SuperAdmin Bearer + revoked SuperAdmin cookie -> Bearer succeeds; stale cookie cleared
 * 3. Valid SuperAdmin Bearer + malformed cookie -> Bearer succeeds only after independent validation
 * 4. Valid SuperAdmin Bearer + active student cookie -> 401 CONFLICTING_CREDENTIALS + Audit Log
 * 5. Valid student Bearer + active SuperAdmin cookie -> 401 CONFLICTING_CREDENTIALS + Audit Log
 * 6. Invalid Bearer + valid cookie -> Reject (401); no cookie fallback
 * 7. Expired Bearer + valid cookie -> Reject (401); no cookie fallback
 * 8. Cookie identity resolution database failure -> Fail closed (500); no authentication bypass
 * 9. Recovery verification with existing cookie -> Response clears existing cookie
 * 10. Recovery token permission scope -> Remains restricted
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';
import RecoveryToken from '../models/RecoveryToken.js';
import { getJwtSecret } from '../config/environment.js';
import { createSession, revokeSession } from '../services/sessionService.js';
import crypto from 'crypto';

describe('EdWth LMS — Authentication Conflict Resolution & Protection Suite', () => {
  const testRunId = Date.now();
  let superAdminUser;
  let superAdminToken;
  let superAdminSessionId;

  let studentUser;
  let studentToken;
  let studentSessionId;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create isolated student account
    studentUser = await User.create({
      studentId: `STU-CONF-${testRunId}`,
      name: 'Conflict Test Student',
      email: `conflict.student.${testRunId}@lumina.test`,
      password: await bcrypt.hash('Student123!Test', 10),
      role: 'student',
      standard: 'Class 11',
      className: 'Class 11-A',
      isTwoFactorEnabled: false
    });

    const studentSession = await createSession(studentUser, { headers: {} });
    studentSessionId = studentSession.sessionId;
    studentToken = jwt.sign(
      { id: studentUser._id, role: 'student', sessionId: studentSessionId },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 2. Create isolated SuperAdmin account
    superAdminUser = await User.create({
      studentId: `SA-CONF-${testRunId}`,
      name: 'Conflict Test SuperAdmin',
      email: `conflict.superadmin.${testRunId}@lumina.test`,
      password: await bcrypt.hash('SuperAdmin!2026', 10),
      role: 'superadmin',
      tenantId: null,
      isTwoFactorEnabled: true,
      twoFactorSecret: 'MFA_ENABLED_FIXTURE_KEY_32_CHARS!',
      isSecurityEmailVerified: true,
      securityEmail: 'thesixthcivilians26@gmail.com'
    });

    const adminSession = await createSession(superAdminUser, { headers: {} });
    superAdminSessionId = adminSession.sessionId;
    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin', sessionId: superAdminSessionId },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (studentUser?._id) {
      await User.deleteOne({ _id: studentUser._id });
      await Session.deleteMany({ userId: studentUser._id });
    }
    if (superAdminUser?._id) {
      await User.deleteOne({ _id: superAdminUser._id });
      await Session.deleteMany({ userId: superAdminUser._id });
      await RecoveryToken.deleteMany({ userId: superAdminUser._id });
    }
  });

  describe('1. Stale / Expired / Revoked Cookie Handling with Valid Bearer', () => {
    it('1.1 Valid SuperAdmin Bearer + expired student cookie -> Bearer succeeds and stale cookie is cleared', async () => {
      // Create an expired student token (expired 2 hours ago)
      const expiredStudentToken = jwt.sign(
        { id: studentUser._id, role: 'student', sessionId: studentSessionId, exp: Math.floor(Date.now() / 1000) - 7200 },
        getJwtSecret()
      );

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Cookie', [`jwt=${expiredStudentToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify that Set-Cookie header contains instructions to clear the stale cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasClearJwt = cookies.some((c) => c.includes('jwt=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0')));
      expect(hasClearJwt).toBe(true);
    });

    it('1.2 Valid SuperAdmin Bearer + revoked SuperAdmin cookie -> Bearer succeeds and stale cookie is cleared', async () => {
      // Create a revoked session for the SuperAdmin
      const revokedSession = await createSession(superAdminUser, { headers: {} });
      await revokeSession(revokedSession.sessionId, 'admin_action');

      const revokedCookieToken = jwt.sign(
        { id: superAdminUser._id, role: 'superadmin', sessionId: revokedSession.sessionId },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Cookie', [`jwt=${revokedCookieToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasClearJwt = cookies.some((c) => c.includes('jwt=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0')));
      expect(hasClearJwt).toBe(true);
    });

    it('1.3 Valid SuperAdmin Bearer + malformed cookie -> Bearer succeeds and invalid cookie is cleared', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Cookie', ['jwt=not-a-valid-jwt-token-string']);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasClearJwt = cookies.some((c) => c.includes('jwt=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0')));
      expect(hasClearJwt).toBe(true);
    });
  });

  describe('2. Active Cross-Account Credential Conflict Rejection', () => {
    it('2.1 Valid SuperAdmin Bearer + active student cookie -> 401 CONFLICTING_CREDENTIALS + Audit Log', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .set('Cookie', [`jwt=${studentToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CONFLICTING_CREDENTIALS');
      expect(res.body.message).toMatch(/Conflicting credentials presented/);

      // Verify Critical Audit Log event was generated
      const auditEntry = await AuditLog.findOne({
        action: 'AUTH_CONFLICTING_CREDENTIALS_REJECTED',
        targetRecord: superAdminUser._id
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry.details.headerUserId).toBe(superAdminUser._id.toString());
      expect(auditEntry.details.cookieUserId).toBe(studentUser._id.toString());
    });

    it('2.2 Valid student Bearer + active SuperAdmin cookie -> 401 CONFLICTING_CREDENTIALS + Audit Log', async () => {
      const res = await request(app)
        .get('/api/v1/students/datasheet')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Cookie', [`jwt=${superAdminToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('CONFLICTING_CREDENTIALS');
      expect(res.body.message).toMatch(/Conflicting credentials presented/);
    });
  });

  describe('3. Strict Bearer Validation & No Cookie Fallback', () => {
    it('3.1 Invalid Bearer + valid SuperAdmin cookie -> Reject (401); no cookie fallback rescue', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', 'Bearer invalid.tampered.token')
        .set('Cookie', [`jwt=${superAdminToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('3.2 Expired Bearer + valid SuperAdmin cookie -> Reject (401); no cookie fallback rescue', async () => {
      const expiredAdminToken = jwt.sign(
        { id: superAdminUser._id, role: 'superadmin', exp: Math.floor(Date.now() / 1000) - 3600 },
        getJwtSecret()
      );

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${expiredAdminToken}`)
        .set('Cookie', [`jwt=${superAdminToken}`]);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('4. Operational / Database Error Handling (Fail Closed)', () => {
    it('4.1 Cookie resolution database failure fails closed with 500 AUTH_DATABASE_ERROR without bypassing auth', async () => {
      const originalFindById = User.findById;
      // Mock User.findById to simulate operational database failure when resolving the cookie candidate
      User.findById = jest.fn().mockImplementation((id, ...args) => {
        if (id && id.toString() === studentUser._id.toString()) {
          throw new Error('MongoNetworkTimeoutException: connection timed out');
        }
        return originalFindById.call(User, id, ...args);
      });

      try {
        const res = await request(app)
          .get('/api/v1/admin/overview')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .set('Cookie', [`jwt=${studentToken}`]);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.code).toBe('AUTH_DATABASE_ERROR');
      } finally {
        User.findById = originalFindById;
      }
    });
  });

  describe('5. Recovery Verification Cookie Clearing & Restricted Scoping', () => {
    it('5.1 Recovery verification clears existing cookies upon issuing recovery token', async () => {
      const rawRecoveryToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawRecoveryToken).digest('hex');

      await RecoveryToken.create({
        tokenHash,
        userId: superAdminUser._id,
        email: superAdminUser.email,
        purpose: 'superadmin_passkey_recovery',
        consumed: false,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      });

      const res = await request(app)
        .post('/api/v1/auth/recovery/verify')
        .set('Cookie', [`jwt=${studentToken}`])
        .send({ token: rawRecoveryToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recoverySessionToken).toBeDefined();

      // Ensure Set-Cookie cleared the stale/pre-existing cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const hasClearJwt = cookies.some((c) => c.includes('jwt=') && (c.includes('Expires=Thu, 01 Jan 1970') || c.includes('Max-Age=0')));
      expect(hasClearJwt).toBe(true);

      // Verify the newly issued recovery token is strictly restricted from regular administrative endpoints
      const recoveryToken = res.body.recoverySessionToken;
      const adminAttempt = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${recoveryToken}`);

      expect(adminAttempt.status).toBe(403);
      expect(adminAttempt.body.code).toBe('RESTRICTED_RECOVERY_SESSION');
    });
  });
});
