/**
 * EdWth LMS — Privileged SuperAdmin MFA Enrollment Lifecycle Verification
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Privileged accounts without MFA enrollment are blocked from admin APIs with 403 MFA_SETUP_REQUIRED.
 * 2. Privileged accounts CAN call POST /api/v1/auth/2fa/setup (returning QR code and secret).
 * 3. Before verification, isTwoFactorEnabled remains false.
 * 4. Invalid TOTP tokens are rejected with 401 and do not activate MFA.
 * 5. Authentic TOTP tokens verify successfully, activating isTwoFactorEnabled: true and clearing mfaSetupRequired.
 * 6. After activation, privileged accounts successfully access /api/v1/admin/overview.
 * 7. Non-privileged student accounts cannot bypass role checks.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import speakeasy from 'speakeasy';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import { getJwtSecret } from '../config/environment.js';
import { decryptTotpSecret } from '../utils/mfaCrypto.js';

const generateToken = (id, role = 'superadmin', tenantId = null) => {
  return jwt.sign({ id, role, tenantId }, getJwtSecret(), { expiresIn: '1h' });
};

describe('EdWth LMS — Privileged SuperAdmin MFA Enrollment Flow', () => {
  let superadminUser;
  let superadminToken;
  let tenantInstitution;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    // Ensure test institution exists
    tenantInstitution = await College.findOne({ code: 'TEST-EDWTH-ACADEMY' });
    if (!tenantInstitution) {
      tenantInstitution = await College.create({
        name: 'EdWth Academy Core Test Institution',
        code: 'TEST-EDWTH-ACADEMY',
        slug: 'test-edwth-academy',
        institutionType: 'college',
        status: 'active'
      });
    }

    // Create an unenrolled SuperAdmin
    const uniqueEmail = `superadmin.mfa.${Date.now()}@edwth.com`;
    superadminUser = await User.create({
      name: 'EdWth Test SuperAdmin',
      email: uniqueEmail,
      studentId: `SA-${Date.now().toString().slice(-4)}`,
      password: 'StrongSuperAdminPass!2026',
      role: 'superadmin',
      tenantId: null, // superadmin has global platform oversight
      mfaEnforced: true,
      mfaSetupRequired: true,
      isTwoFactorEnabled: false
    });

    superadminToken = generateToken(superadminUser._id);

    // Create a student user for baseline permission check
    studentUser = await User.create({
      name: 'Test Student',
      email: `student.${Date.now()}@edwth.com`,
      studentId: `STU-${Date.now().toString().slice(-4)}`,
      password: 'StudentPass!2026',
      role: 'student',
      tenantId: tenantInstitution._id,
      mfaEnforced: false,
      isTwoFactorEnabled: false
    });

    studentToken = generateToken(studentUser._id);
  });

  afterAll(async () => {
    if (superadminUser?._id) {
      await User.deleteOne({ _id: superadminUser._id });
    }
    if (studentUser?._id) {
      await User.deleteOne({ _id: studentUser._id });
    }
  });

  it('1. Blocks unenrolled privileged SuperAdmin from admin overview with 403 MFA_SETUP_REQUIRED', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('MFA_SETUP_REQUIRED');
    expect(res.body.message).toContain('Multi-factor authentication enrollment is required for privileged accounts');
  });

  it('2. Blocks unenrolled privileged SuperAdmin from institutions directory with 403 MFA_SETUP_REQUIRED', async () => {
    const res = await request(app)
      .get('/api/v1/admin/institutions')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('MFA_SETUP_REQUIRED');
  });

  let generatedSecret = null;

  it('3. Allows unenrolled SuperAdmin to access POST /api/v1/auth/2fa/setup', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/setup')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.secret).toBeDefined();
    expect(typeof res.body.secret).toBe('string');
    expect(res.body.qrCode).toBeDefined();
    expect(res.body.qrCode).toContain('data:image/png;base64');
    expect(Array.isArray(res.body.backupCodes)).toBe(true);
    expect(res.body.backupCodes.length).toBe(5);

    generatedSecret = res.body.secret;

    // Verify DB state: isTwoFactorEnabled must NOT be set to true simply by calling setup
    const refreshed = await User.findById(superadminUser._id).select('+twoFactorSecret +twoFactorBackupCodes');
    expect(refreshed.isTwoFactorEnabled).toBe(false);
    expect(decryptTotpSecret(refreshed.twoFactorSecret)).toBe(generatedSecret);
    expect(refreshed.twoFactorBackupCodes.length).toBe(5);
  });

  it('4. Rejects invalid TOTP token during enrollment verification with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ token: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid 2FA code');

    // DB state must remain isTwoFactorEnabled: false
    const refreshed = await User.findById(superadminUser._id);
    expect(refreshed.isTwoFactorEnabled).toBe(false);
  });

  it('5. Successfully verifies genuine TOTP token, activating isTwoFactorEnabled: true', async () => {
    // Generate valid TOTP token using speakeasy
    const validTotp = speakeasy.totp({
      secret: generatedSecret,
      encoding: 'base32'
    });

    const res = await request(app)
      .post('/api/v1/auth/2fa/verify')
      .set('Authorization', `Bearer ${superadminToken}`)
      .send({ token: validTotp });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.isTwoFactorEnabled).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.isTwoFactorEnabled).toBe(true);
    expect(res.body.user.mfaSetupRequired).toBe(false);

    // Verify DB state
    const refreshed = await User.findById(superadminUser._id);
    expect(refreshed.isTwoFactorEnabled).toBe(true);
    expect(refreshed.mfaSetupRequired).toBe(false);
  });

  it('6. Allows enrolled SuperAdmin full access to /api/v1/admin/overview', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.isSuperAdmin).toBe(true);
  });

  it('7. Allows enrolled SuperAdmin full access to /api/v1/admin/institutions', async () => {
    const res = await request(app)
      .get('/api/v1/admin/institutions')
      .set('Authorization', `Bearer ${superadminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.institutions)).toBe(true);
  });

  it('8. Student account cannot access admin overview even without MFA restrictions', async () => {
    const res = await request(app)
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Insufficient privileges');
  });
});
