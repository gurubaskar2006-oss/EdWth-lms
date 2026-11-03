/**
 * EdWth LMS — Privileged Identity & MFA Security Regression Test Suite
 * 6th Civilians Corporation
 *
 * Covers:
 * 1. First-time enrollment and verification.
 * 2. Existing enrolled account cannot replace MFA without reauthentication.
 * 3. Valid current TOTP and valid single-use recovery code allow authorized replacement.
 * 4. Invalid/expired codes and invalid recovery codes are rejected.
 * 5. Encrypted secrets can be decrypted and verified after deployment.
 * 6. Unauthorized email identities cannot obtain privileged roles.
 * 7. Legitimate school and student accounts continue to work.
 * 8. All privileged authentication entry points enforce the same policy.
 * 9. MFA recovery cannot be used to bypass existing security controls.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import { getJwtSecret, validateProductionEnv } from '../config/environment.js';
import { decryptTotpSecret, encryptTotpSecret, isEncrypted } from '../utils/mfaCrypto.js';
import { validatePrivilegedIdentity, isPrivilegedRole } from '../config/privilegedIdentities.js';

describe('EdWth LMS — Privileged Identity & MFA Security Acceptance Suite', () => {
  let tenant;
  const testRunId = Date.now();
  const rawAdminPassword = 'CorporateAdmin!2026';
  const rawStudentPassword = 'StudentPass!2026';
  let adminToken;
  let adminUser;
  let activeSecretBase32;
  let backupCodePlain;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    tenant = await College.create({
      name: `Privileged Security College ${testRunId}`,
      code: `PSC-${testRunId}`,
      slug: `psc-${testRunId}`,
      institutionType: 'college',
      status: 'active'
    });

    const activeSecretObj = speakeasy.generateSecret({ name: 'EdWth Security Test', issuer: 'EdWth' });
    activeSecretBase32 = activeSecretObj.base32;
    backupCodePlain = 'c1d2e3f4';
    const backupHash = await bcrypt.hash(backupCodePlain, 12);

    // Enrolled admin with authorized company identity
    adminUser = await User.create({
      studentId: `SEC-ADM-${testRunId}`,
      name: 'Authorized Platform Admin',
      email: `admin.${testRunId}@6c.com`,
      password: await bcrypt.hash(rawAdminPassword, 10),
      role: 'admin',
      tenantId: tenant._id,
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      mfaSetupRequired: false,
      twoFactorSecret: encryptTotpSecret(activeSecretBase32),
      twoFactorBackupCodes: [backupHash]
    });

    adminToken = jwt.sign(
      { id: adminUser._id, role: 'admin', tenantId: tenant._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (tenant?._id) await College.deleteMany({ _id: tenant._id });
    if (adminUser?._id) await User.deleteMany({ email: new RegExp(`.*${testRunId}.*`) });
  });

  describe('1. First-Time MFA Enrollment & Verification', () => {
    let unenrolledUser;
    let unenrolledToken;
    let setupSecret;

    beforeAll(async () => {
      unenrolledUser = await User.create({
        studentId: `UNENROLLED-${testRunId}`,
        name: 'Unenrolled Platform Admin',
        email: `newadmin.${testRunId}@6c.com`,
        password: await bcrypt.hash(rawAdminPassword, 10),
        role: 'admin',
        tenantId: tenant._id,
        isTwoFactorEnabled: false,
        mfaEnforced: true,
        mfaSetupRequired: true
      });

      unenrolledToken = jwt.sign(
        { id: unenrolledUser._id, role: 'admin', tenantId: tenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );
    });

    afterAll(async () => {
      if (unenrolledUser?._id) await User.deleteOne({ _id: unenrolledUser._id });
    });

    it('1.1 Allows first-time setup for unenrolled user and stores encrypted secret without enabling MFA', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${unenrolledToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.secret).toBeDefined();
      expect(res.body.backupCodes.length).toBe(5);
      expect(res.body.isReconfiguration).toBe(false);

      setupSecret = res.body.secret;

      const dbUser = await User.findById(unenrolledUser._id).select('+twoFactorSecret +isTwoFactorEnabled');
      expect(dbUser.isTwoFactorEnabled).toBe(false); // MUST remain false until verified!
      expect(isEncrypted(dbUser.twoFactorSecret)).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(setupSecret);
    });

    it('1.2 Activates MFA only when authentic TOTP from newly enrolled secret is verified', async () => {
      const validCode = speakeasy.totp({ secret: setupSecret, encoding: 'base32' });

      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${unenrolledToken}`)
        .send({ token: validCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isTwoFactorEnabled).toBe(true);

      const dbUser = await User.findById(unenrolledUser._id).select('+isTwoFactorEnabled +mfaSetupRequired');
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(dbUser.mfaSetupRequired).toBe(false);
    });
  });

  describe('2. Existing Enrolled Account Cannot Replace MFA Without Re-authentication', () => {
    it('2.1 Rejects unauthenticated setup attempt on enrolled account with 403 MFA_ALREADY_ENROLLED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('MFA_ALREADY_ENROLLED');
      expect(res.body.message).toContain('Two-factor authentication is already enrolled');

      // Verify active secret in DB was not altered
      const dbUser = await User.findById(adminUser._id).select('+twoFactorSecret +isTwoFactorEnabled');
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(activeSecretBase32);
    });
  });

  describe('3. Authorized Replacement via Valid TOTP and Valid Single-Use Recovery Code', () => {
    let stagedSecret;

    it('3.1 Re-authenticating with valid password and active TOTP stages replacement without disrupting active MFA', async () => {
      const activeOtp = speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          currentToken: activeOtp
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isReconfiguration).toBe(true);
      expect(res.body.secret).toBeDefined();
      expect(res.body.qrCode).toBeDefined();

      stagedSecret = res.body.secret;

      // Active secret remains active!
      const dbUser = await User.findById(adminUser._id).select('+twoFactorSecret +pendingTwoFactorSecret +isTwoFactorEnabled');
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(activeSecretBase32);
      expect(decryptTotpSecret(dbUser.pendingTwoFactorSecret)).toBe(stagedSecret);
    });

    it('3.2 Re-authenticating with valid password and active recovery code consumes the backup code atomically', async () => {
      const singleUseCode = 'use-once-123';
      const hash = await bcrypt.hash(singleUseCode, 12);
      await User.updateOne({ _id: adminUser._id }, { twoFactorBackupCodes: [hash] });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          currentToken: singleUseCode
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify single-use consumption from DB
      const dbUser = await User.findById(adminUser._id).select('+twoFactorBackupCodes');
      expect(dbUser.twoFactorBackupCodes.length).toBe(0);

      // Attempting to reuse the exact same recovery code fails
      const reuseRes = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          currentToken: singleUseCode
        });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.message).toContain('Invalid current two-factor');
    });
  });

  describe('4. Invalid/Expired Codes and Invalid Recovery Codes are Rejected', () => {
    it('4.1 Rejects wrong password during reconfiguration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'BadPassword!999',
          currentToken: speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' })
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Current password verification failed');
    });

    it('4.2 Rejects invalid TOTP code during reconfiguration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          currentToken: '999999'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Invalid current two-factor');
    });

    it('4.3 Rejects invalid code in verify2FA', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: '000000' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid 2FA code.');
    });
  });

  describe('5. Encrypted Secrets Decryption and Verification', () => {
    it('5.1 Encrypted secret can be decrypted and produces valid TOTP', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(secret);
      expect(isEncrypted(encrypted)).toBe(true);

      const decrypted = decryptTotpSecret(encrypted);
      expect(decrypted).toBe(secret);

      const token = speakeasy.totp({ secret: decrypted, encoding: 'base32' });
      const isValid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
      expect(isValid).toBe(true);
    });

    it('5.2 Tampered ciphertext fails decryption securely (fails closed)', () => {
      const encrypted = encryptTotpSecret('JBSWY3DPEHPK3PXP');
      const tampered = encrypted.slice(0, -4) + 'abcd';
      expect(() => decryptTotpSecret(tampered)).toThrow();
    });
  });

  describe('6. Unauthorized Email Identities Cannot Obtain Privileged Roles', () => {
    let gmailAdmin;

    beforeAll(async () => {
      // Simulate an account created with an unauthorized public freemail domain
      gmailAdmin = await User.create({
        studentId: `GMAIL-ADM-${testRunId}`,
        name: 'Unauthorized Gmail User',
        email: `privileged.intruder.${testRunId}@gmail.com`,
        password: await bcrypt.hash(rawAdminPassword, 10),
        role: 'admin',
        tenantId: tenant._id,
        isTwoFactorEnabled: false
      });
    });

    afterAll(async () => {
      if (gmailAdmin?._id) await User.deleteOne({ _id: gmailAdmin._id });
    });

    it('6.1 Blocks login attempts for privileged roles with Gmail or public freemail domains', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: gmailAdmin.email,
          password: rawAdminPassword
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED_PRIVILEGED_IDENTITY');
      expect(res.body.message).toContain('public email services');
    });

    it('6.2 Blocks provisioning of trainers with public freemail domains', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Intruder Trainer',
          email: `trainer.${testRunId}@yahoo.com`,
          password: 'TrainerPassword!2026',
          department: 'Computer Science'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('UNAUTHORIZED_PRIVILEGED_IDENTITY');
    });

    it('6.3 Prevents privilege elevation through student provisioning endpoint', async () => {
      const res = await request(app)
        .post('/api/v1/students')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Elevation Attacker',
          email: `attacker.${testRunId}@6c.com`,
          password: 'Password123!',
          role: 'superadmin'
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ROLE_ELEVATION_PROHIBITED');
    });
  });

  describe('7. Legitimate School and Student Accounts Continue to Work', () => {
    let studentUser;

    beforeAll(async () => {
      studentUser = await User.create({
        studentId: `STU-LEGIT-${testRunId}`,
        name: 'Legitimate Student',
        email: `student.${testRunId}@school.org`,
        password: await bcrypt.hash(rawStudentPassword, 10),
        role: 'student',
        tenantId: tenant._id,
        isTwoFactorEnabled: false
      });
    });

    afterAll(async () => {
      if (studentUser?._id) await User.deleteOne({ _id: studentUser._id });
    });

    it('7.1 Allows legitimate student login regardless of institutional or personal domain', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.email,
          password: rawStudentPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('student');
    });

    it('7.2 Allows student with public domain to log in normally (students not restricted)', async () => {
      const personalStudent = await User.create({
        studentId: `STU-GMAIL-${testRunId}`,
        name: 'Personal Email Student',
        email: `personal.learner.${testRunId}@gmail.com`,
        password: await bcrypt.hash(rawStudentPassword, 10),
        role: 'student',
        tenantId: tenant._id,
        isTwoFactorEnabled: false
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: personalStudent.email,
          password: rawStudentPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('student');

      await User.deleteOne({ _id: personalStudent._id });
    });
  });

  describe('8. Privileged Login Flow Returns isTwoFactorEnabled: true', () => {
    let orig2FaSetting;
    beforeAll(() => {
      orig2FaSetting = process.env.ENABLE_SUPERADMIN_2FA;
      // In this test block, test genuine SuperAdmin MFA enforcement
      process.env.ENABLE_SUPERADMIN_2FA = 'true';
    });

    afterAll(() => {
      process.env.ENABLE_SUPERADMIN_2FA = orig2FaSetting;
    });

    it('8.1 Login verification for enrolled 2FA account returns isTwoFactorEnabled: true in user payload', async () => {
      // 1. Initial login request
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: adminUser.email,
          password: rawAdminPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.requires2FA).toBe(true);
      const preAuthToken = loginRes.body.preAuthToken;

      // 2. 2FA verification step
      const totpToken = speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' });
      const verifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: totpToken });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.isTwoFactorEnabled).toBe(true);
      expect(verifyRes.body.user.isTwoFactorEnabled).toBe(true);
      expect(verifyRes.body.user.mfaSetupRequired).toBe(false);
    });

    it('8.2 Enrolled SuperAdmin login returns isTwoFactorEnabled: true and does not trigger false forced-enrollment modal', async () => {
      const saSecretObj = speakeasy.generateSecret({ name: 'EdWth SA Test', issuer: 'EdWth' });
      const rawSaPassword = 'SuperAdmin!2026Password';
      const superAdminUser = await User.create({
        studentId: `SA-TEST-${testRunId}`,
        name: 'Corporate SuperAdmin',
        email: `superadmin.verified.${testRunId}@6c.com`,
        password: await bcrypt.hash(rawSaPassword, 10),
        role: 'superadmin',
        tenantId: null,
        isTwoFactorEnabled: true,
        mfaEnforced: true,
        mfaSetupRequired: false,
        twoFactorSecret: encryptTotpSecret(saSecretObj.base32)
      });

      // 1. Password login
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: superAdminUser.email, password: rawSaPassword });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.requires2FA).toBe(true);

      // 2. TOTP verification
      const saTotp = speakeasy.totp({ secret: saSecretObj.base32, encoding: 'base32' });
      const verifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken: loginRes.body.preAuthToken, token: saTotp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.user.role).toBe('superadmin');
      expect(verifyRes.body.user.isTwoFactorEnabled).toBe(true);
      expect(verifyRes.body.user.mfaSetupRequired).toBe(false);

      // Verify the AdminApp.jsx check:
      // requiresMfaEnrollment = isSuperAdmin && !user?.isTwoFactorEnabled;
      const isSuperAdmin = verifyRes.body.user.role === 'superadmin';
      const requiresMfaEnrollment = isSuperAdmin && !verifyRes.body.user?.isTwoFactorEnabled;
      expect(requiresMfaEnrollment).toBe(false);

      await User.deleteOne({ _id: superAdminUser._id });
    });
  });

  describe('9. MFA Recovery Cannot Be Used to Bypass Security Controls', () => {
    it('9.1 Recovery backup code cannot be used without valid account password', async () => {
      const backupCode = 'recovery-pass-test';
      const hash = await bcrypt.hash(backupCode, 12);
      await User.updateOne({ _id: adminUser._id }, { twoFactorBackupCodes: [hash] });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          currentPassword: 'IncorrectPassword!2026',
          currentToken: backupCode
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Current password verification failed');

      // The backup code was NOT consumed because authentication failed
      const dbUser = await User.findById(adminUser._id).select('+twoFactorBackupCodes');
      expect(dbUser.twoFactorBackupCodes.length).toBe(1);
    });
  });

  describe('10. Missing or Invalid Production Security Configuration Fails Safely', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('10.1 validateProductionEnv halts startup when MFA_ENCRYPTION_KEY is missing in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGO_URI = 'mongodb://localhost:27017/prod_test';
      process.env.JWT_SECRET = 'a_very_secure_and_long_jwt_secret_for_prod_12345';
      delete process.env.MFA_ENCRYPTION_KEY;
      delete process.env.TOTP_ENCRYPTION_KEY;

      expect(() => validateProductionEnv()).toThrow(/MFA_ENCRYPTION_KEY/);
    });

    it('10.2 validatePrivilegedIdentity safely rejects null, empty, or malformed email inputs', () => {
      expect(validatePrivilegedIdentity(null, 'superadmin').allowed).toBe(false);
      expect(validatePrivilegedIdentity('', 'admin').allowed).toBe(false);
      expect(validatePrivilegedIdentity('invalid-no-domain', 'trainer').allowed).toBe(false);
      expect(validatePrivilegedIdentity('@domain.com', 'admin').allowed).toBe(false);
    });
  });

  describe('11. Password-Change and JWT Session Integrity', () => {
    it('11.1 Password change requires valid current password, updates hash, and rotates session token', async () => {
      const pwUserPassword = 'InitialPassword!2026';
      const newPassword = 'UpdatedPassword!2026New';
      const pwUser = await User.create({
        studentId: `PW-USER-${testRunId}`,
        name: 'Password Test User',
        email: `pwchange.${testRunId}@6c.com`,
        password: await bcrypt.hash(pwUserPassword, 10),
        role: 'admin',
        tenantId: tenant._id,
        mustChangePassword: false,
        isTwoFactorEnabled: false
      });

      const userToken = jwt.sign(
        { id: pwUser._id, role: 'admin', tenantId: tenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Wrong current password fails
      const badPwRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'WrongPassword!123',
          newPassword,
          confirmPassword: newPassword
        });
      expect(badPwRes.status).toBe(400);

      // Valid change succeeds and rotates token
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: pwUserPassword,
          newPassword,
          confirmPassword: newPassword
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.token).toBeDefined();

      // Subsequent login with old password fails
      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: pwUser.email, password: pwUserPassword });
      expect(oldLogin.status).toBe(401);

      // Subsequent login with new password succeeds
      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: pwUser.email, password: newPassword });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.success).toBe(true);

      await User.deleteOne({ _id: pwUser._id });
    });
  });
});
