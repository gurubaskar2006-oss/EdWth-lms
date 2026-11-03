/**
 * Regression Test Suite: MFA Pre-Auth Challenge Token Protection & Complete MFA Flow Verification
 * 6th Civilians Corporation — EdWth Academy LMS
 *
 * Verifies:
 * 1. Tokens containing `preAuth: true` are strictly rejected on all protected endpoints (HTTP 403 MFA_VERIFICATION_REQUIRED).
 * 2. `POST /api/v1/auth/2fa/verify` validates valid vs invalid TOTP codes with preAuthToken.
 * 3. Single-use backup / recovery codes verify correctly and cannot be reused.
 * 4. Initial enrollment flow vs existing enrollment (reconfiguration gatekeeping).
 * 5. Fully authenticated post-MFA tokens have normal access to protected admin routes.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import app from '../server.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';
import { encryptTotpSecret } from '../utils/mfaCrypto.js';

describe('MFA Security, PreAuth Token Protection & Verification Regression', () => {
  let superAdminUser;
  let rawTotpSecret;
  let rawBackupCodes;

  beforeAll(async () => {
    // Wait for mongoose connection
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 40) {
      await new Promise(r => setTimeout(r, 250));
      retries++;
    }

    // Generate test TOTP secret
    const generated = speakeasy.generateSecret({ length: 20 });
    rawTotpSecret = generated.base32;

    // Generate 2 test backup codes
    rawBackupCodes = ['bkpCode1', 'bkpCode2'];
    const hashedBackupCodes = await Promise.all(
      rawBackupCodes.map(code => bcrypt.hash(code, 8))
    );

    const hashedPassword = await bcrypt.hash('P@ssword123456!', 10);

    // Create an enrolled SuperAdmin user in test database
    superAdminUser = await User.create({
      studentId: `SA-REGRESS-${Date.now()}`,
      name: 'MFA Security Regression Admin',
      email: `mfa.regression.${Date.now()}@6c.com`,
      password: hashedPassword,
      role: 'superadmin',
      tenantId: null,
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      mfaSetupRequired: false,
      twoFactorSecret: encryptTotpSecret(rawTotpSecret),
      twoFactorBackupCodes: hashedBackupCodes
    });
  });

  afterAll(async () => {
    if (superAdminUser?._id) {
      await User.deleteOne({ _id: superAdminUser._id }).catch(() => {});
      await AuditLog.deleteMany({ 'actor.userId': superAdminUser._id }).catch(() => {});
    }
  });

  describe('1. PreAuth Token Bypass Prevention (Vulnerability Closure)', () => {
    let preAuthToken;

    beforeEach(() => {
      // Issue temporary challenge token (identical to login step 1)
      preAuthToken = jwt.sign(
        { id: superAdminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
    });

    test('preAuth token is strictly rejected on GET /api/v1/admin/overview with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${preAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('MFA_VERIFICATION_REQUIRED');
      expect(res.body.message).toMatch(/Multi-factor authentication required/i);
    });

    test('preAuth token is strictly rejected on GET /api/v1/school/batches with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/v1/school/batches')
        .set('Authorization', `Bearer ${preAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_VERIFICATION_REQUIRED');
    });

    test('preAuth token is strictly rejected on GET /api/v1/audit with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/v1/audit')
        .set('Authorization', `Bearer ${preAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_VERIFICATION_REQUIRED');
    });

    test('preAuth token is strictly rejected on GET /api/v1/auth/profile with HTTP 403', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${preAuthToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_VERIFICATION_REQUIRED');
    });

    test('preAuth token is strictly rejected on POST /api/v1/auth/change-password with HTTP 403', async () => {
      const res = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${preAuthToken}`)
        .send({
          currentPassword: 'P@ssword123456!',
          newPassword: 'NewP@ssword123456!',
          confirmPassword: 'NewP@ssword123456!'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_VERIFICATION_REQUIRED');
    });
  });

  describe('2. TOTP Code Verification & Login Flow', () => {
    let preAuthToken;

    beforeEach(() => {
      preAuthToken = jwt.sign(
        { id: superAdminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
    });

    test('POST /api/v1/auth/2fa/verify rejects missing verification code with HTTP 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Verification code is required/i);
    });

    test('POST /api/v1/auth/2fa/verify rejects invalid 6-digit TOTP code with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: '999999' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid 2FA code/i);
    });

    test('POST /api/v1/auth/2fa/verify rejects malformed / expired preAuthToken with HTTP 401', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken: 'invalid.jwt.token', token: '123456' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid or expired preAuthToken/i);
    });

    test('POST /api/v1/auth/2fa/verify succeeds with valid 6-digit TOTP code and returns full session token', async () => {
      const validCode = speakeasy.totp({
        secret: rawTotpSecret,
        encoding: 'base32'
      });

      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: validCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('superadmin');
      expect(res.body.user.isTwoFactorEnabled).toBe(true);

      // Verify the returned token is NOT a preAuth token and can access protected admin APIs
      const adminRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${res.body.token}`);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.success).toBe(true);
    });
  });

  describe('3. Single-Use Backup / Recovery Codes', () => {
    test('valid backup code verifies successfully and is consumed atomically', async () => {
      const token1 = jwt.sign(
        { id: superAdminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      // Verify using first backup code
      const res1 = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken: token1, token: rawBackupCodes[0] });

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.token).toBeDefined();

      // Attempting to reuse the exact same backup code must FAIL (single-use)
      const token2 = jwt.sign(
        { id: superAdminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      const res2 = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken: token2, token: rawBackupCodes[0] });

      expect(res2.status).toBe(401);
      expect(res2.body.success).toBe(false);
      expect(res2.body.message).toMatch(/Invalid 2FA code/i);
    });
  });

  describe('4. Initial Enrollment vs Existing Enrollment Gatekeeping', () => {
    let unenrolledUser;
    let unenrolledToken;

    beforeAll(async () => {
      const pwd = await bcrypt.hash('P@ssword123456!', 10);
      unenrolledUser = await User.create({
        studentId: `UNENROLLED-${Date.now()}`,
        name: 'Unenrolled Admin',
        email: `unenrolled.${Date.now()}@6c.com`,
        password: pwd,
        role: 'superadmin',
        tenantId: null,
        isTwoFactorEnabled: false,
        mfaEnforced: true,
        mfaSetupRequired: true
      });
      unenrolledToken = jwt.sign({ id: unenrolledUser._id }, getJwtSecret(), { expiresIn: '1h' });
    });

    afterAll(async () => {
      if (unenrolledUser?._id) {
        await User.deleteOne({ _id: unenrolledUser._id }).catch(() => {});
      }
    });

    test('unenrolled superadmin receives 403 MFA_SETUP_REQUIRED on protected routes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${unenrolledToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_SETUP_REQUIRED');
    });

    test('unenrolled superadmin can call POST /api/v1/auth/2fa/setup and receive QR code', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${unenrolledToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.secret).toBeDefined();
      expect(res.body.backupCodes).toBeDefined();
    });

    test('already-enrolled superadmin cannot call setup2FA without current password and code', async () => {
      const fullEnrolledToken = jwt.sign({ id: superAdminUser._id }, getJwtSecret(), { expiresIn: '1h' });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${fullEnrolledToken}`)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('MFA_ALREADY_ENROLLED');
      expect(res.body.message).toMatch(/Two-factor authentication is already enrolled/i);
    });
  });
});
