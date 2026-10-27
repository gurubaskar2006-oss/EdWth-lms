/**
 * EdWth LMS — MFA Secret Protection, Rotation & Encryption Regression Test Suite
 * 6th Civilians Corporation
 *
 * Validates:
 * 1. Blocks unauthorized MFA secret replacement on already-enrolled accounts (403 MFA_ALREADY_ENROLLED).
 * 2. Blocks re-authentication attempts with incorrect password (401).
 * 3. Blocks re-authentication attempts with invalid second factor (401).
 * 4. Staging isolation: Re-authentication stages new secret into pending fields without disabling existing MFA or invalidating active secret.
 * 5. Continuity: User can still log in with existing active secret while replacement is pending.
 * 6. Promotion & Activation: Verifying new TOTP code promotes pending secret to active, clears pending fields, and emits critical audit log.
 * 7. Recovery flow: Enrolled user can re-authenticate for replacement using valid backup code.
 * 8. Schema projection security: twoFactorSecret and backup codes are excluded by default from findById, lean queries, and API responses.
 * 9. Encryption at rest: TOTP secrets stored in MongoDB start with enc:v1: and are encrypted with AES-256-GCM.
 * 10. Backward compatibility: Legacy plaintext TOTP secrets verify successfully and are migrated transparently.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import { getJwtSecret, getMfaEncryptionKey, validateProductionEnv } from '../config/environment.js';
import { decryptTotpSecret, encryptTotpSecret, isEncrypted } from '../utils/mfaCrypto.js';

describe('EdWth LMS — MFA Secret Protection, Rotation & Encryption at Rest', () => {
  let tenant;
  let enrolledUser;
  let enrolledToken;
  let rawPassword = 'SecureAdminPassword!2026';
  let activeSecretBase32;
  let activeBackupPlain;
  let activeBackupHash;
  const testRunId = Date.now();

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    tenant = await College.create({
      name: `MFA Security Tenant ${testRunId}`,
      code: `MFA-TEN-${testRunId}`,
      slug: `mfa-ten-${testRunId}`,
      institutionType: 'college',
      status: 'active'
    });

    const activeSecretObj = speakeasy.generateSecret({ name: 'EdWth LMS Test', issuer: 'EdWth' });
    activeSecretBase32 = activeSecretObj.base32;

    activeBackupPlain = 'a1b2c3d4';
    activeBackupHash = await bcrypt.hash(activeBackupPlain, 12);

    enrolledUser = await User.create({
      studentId: `MFA-ADM-${testRunId}`,
      name: `MFA Test Admin ${testRunId}`,
      email: `mfa.admin.${testRunId}@edwth.test`,
      password: await bcrypt.hash(rawPassword, 10),
      role: 'admin',
      tenantId: tenant._id,
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      mfaSetupRequired: false,
      twoFactorSecret: encryptTotpSecret(activeSecretBase32),
      twoFactorBackupCodes: [activeBackupHash]
    });

    enrolledToken = jwt.sign(
      { id: enrolledUser._id, role: 'admin', tenantId: tenant._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (tenant?._id) await College.deleteMany({ _id: tenant._id });
    if (enrolledUser?._id) await User.deleteMany({ _id: enrolledUser._id });
  });

  describe('1. Prevention of Unauthorized MFA Secret Replacement', () => {
    it('1.1 Rejects ordinary POST /api/v1/auth/2fa/setup for already-enrolled user with 403 MFA_ALREADY_ENROLLED', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${enrolledToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('MFA_ALREADY_ENROLLED');

      // Verify DB remains untouched
      const dbUser = await User.findById(enrolledUser._id).select('+twoFactorSecret +isTwoFactorEnabled');
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(activeSecretBase32);
    });

    it('1.2 Rejects reconfiguration when current password is wrong', async () => {
      const validActiveOtp = speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({
          currentPassword: 'WrongPassword!999',
          currentToken: validActiveOtp
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Current password verification failed');
    });

    it('1.3 Rejects reconfiguration when current second factor is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({
          currentPassword: rawPassword,
          currentToken: '000000'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid current two-factor authentication or backup code');
    });
  });

  describe('2. Staged Secret Rotation with Zero Downtime', () => {
    let newSecretBase32;

    it('2.1 Successfully stages new secret in pending fields upon authentic re-authentication without altering active MFA', async () => {
      const validActiveOtp = speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({
          currentPassword: rawPassword,
          currentToken: validActiveOtp
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isReconfiguration).toBe(true);
      expect(res.body.secret).toBeDefined();
      expect(res.body.qrCode).toBeDefined();
      expect(res.body.backupCodes.length).toBe(5);

      newSecretBase32 = res.body.secret;

      // Check DB: Active secret is STILL active, isTwoFactorEnabled is STILL true!
      const dbUser = await User.findById(enrolledUser._id).select(
        '+twoFactorSecret +pendingTwoFactorSecret +isTwoFactorEnabled'
      );
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(activeSecretBase32);

      // Pending secret is staged and encrypted
      expect(dbUser.pendingTwoFactorSecret).toBeDefined();
      expect(isEncrypted(dbUser.pendingTwoFactorSecret)).toBe(true);
      expect(decryptTotpSecret(dbUser.pendingTwoFactorSecret)).toBe(newSecretBase32);
    });

    it('2.2 Allows normal login using active secret while replacement secret is in pending state', async () => {
      // Simulate login step 1
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: enrolledUser.email,
          password: rawPassword
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.requires2FA).toBe(true);
      const preAuthToken = loginRes.body.preAuthToken;

      // Verify with active secret OTP
      const activeOtp = speakeasy.totp({ secret: activeSecretBase32, encoding: 'base32' });
      const verifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: activeOtp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.token).toBeDefined();
    });

    it('2.3 Promotes pending secret to active only when genuine OTP from new secret is verified', async () => {
      // Verify with invalid code first
      const invalidRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({ token: '999999' });

      expect(invalidRes.status).toBe(401);

      // Verify with authentic code generated from NEW secret
      const validNewOtp = speakeasy.totp({ secret: newSecretBase32, encoding: 'base32' });
      const validRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({ token: validNewOtp });

      expect(validRes.status).toBe(200);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.message).toContain('rotated');

      // Check DB: pending secret has been promoted to active twoFactorSecret!
      const dbUser = await User.findById(enrolledUser._id).select(
        '+twoFactorSecret +pendingTwoFactorSecret +isTwoFactorEnabled'
      );
      expect(dbUser.isTwoFactorEnabled).toBe(true);
      expect(decryptTotpSecret(dbUser.twoFactorSecret)).toBe(newSecretBase32);
      expect(dbUser.pendingTwoFactorSecret).toBeUndefined();

      // Update activeSecretBase32 for subsequent tests
      activeSecretBase32 = newSecretBase32;
    });
  });

  describe('3. Re-authentication via Recovery Backup Code', () => {
    it('3.1 Enrolled user can initiate MFA replacement using a valid single-use backup code', async () => {
      // Give user a known backup code
      const backupCode = 'recovery999';
      const hash = await bcrypt.hash(backupCode, 12);
      await User.updateOne({ _id: enrolledUser._id }, { twoFactorBackupCodes: [hash] });

      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${enrolledToken}`)
        .send({
          currentPassword: rawPassword,
          currentToken: backupCode
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.isReconfiguration).toBe(true);

      // Check that the backup code was consumed atomically from active codes
      const dbUser = await User.findById(enrolledUser._id).select('+twoFactorBackupCodes +pendingTwoFactorSecret');
      expect(dbUser.twoFactorBackupCodes.length).toBe(0);
      expect(dbUser.pendingTwoFactorSecret).toBeDefined();
    });
  });

  describe('4. Schema Projection Security & Encryption at Rest', () => {
    it('4.1 Default Mongoose queries (findById, findOne, lean) strictly omit twoFactorSecret and backup codes', async () => {
      const defaultUser = await User.findById(enrolledUser._id);
      expect(defaultUser.twoFactorSecret).toBeUndefined();
      expect(defaultUser.twoFactorBackupCodes).toBeUndefined();
      expect(defaultUser.pendingTwoFactorSecret).toBeUndefined();

      const leanUser = await User.findById(enrolledUser._id).lean();
      expect(leanUser.twoFactorSecret).toBeUndefined();
      expect(leanUser.twoFactorBackupCodes).toBeUndefined();
      expect(leanUser.pendingTwoFactorSecret).toBeUndefined();
    });

    it('4.2 Authenticated API profile and administrator listings never leak secrets', async () => {
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${enrolledToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user.twoFactorSecret).toBeUndefined();
      expect(profileRes.body.user.twoFactorBackupCodes).toBeUndefined();
      expect(profileRes.body.user.pendingTwoFactorSecret).toBeUndefined();
    });

    it('4.3 Secrets in MongoDB are encrypted at rest with AES-256-GCM (enc:v1: prefix)', async () => {
      const dbUser = await User.findById(enrolledUser._id).select('+twoFactorSecret');
      expect(isEncrypted(dbUser.twoFactorSecret)).toBe(true);
      expect(dbUser.twoFactorSecret.startsWith('enc:v1:')).toBe(true);

      const parts = dbUser.twoFactorSecret.split(':');
      expect(parts.length).toBe(5); // ['enc', 'v1', ivHex, tagHex, cipherHex]
    });

    it('4.4 Backward compatibility: Legacy unencrypted plaintext secrets verify seamlessly', async () => {
      // Create user with legacy plaintext secret
      const legacySecret = 'JBSWY3DPEHPK3PXP';
      const legacyUser = await User.create({
        studentId: `LEGACY-${testRunId}`,
        name: 'Legacy MFA User',
        email: `legacy.${testRunId}@edwth.test`,
        password: await bcrypt.hash('LegacyPass!123', 10),
        role: 'student',
        tenantId: tenant._id,
        isTwoFactorEnabled: true,
        twoFactorSecret: legacySecret // Plaintext legacy string
      });

      const legacyToken = jwt.sign(
        { id: legacyUser._id, role: 'student', tenantId: tenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const otp = speakeasy.totp({ secret: legacySecret, encoding: 'base32' });

      const verifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${legacyToken}`)
        .send({ token: otp });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // Verify that verify2FA performed in-place migration to encrypted format
      const migratedUser = await User.findById(legacyUser._id).select('+twoFactorSecret');
      expect(isEncrypted(migratedUser.twoFactorSecret)).toBe(true);
      expect(decryptTotpSecret(migratedUser.twoFactorSecret)).toBe(legacySecret);

      await User.deleteOne({ _id: legacyUser._id });
    });
  });

  describe('5. Production Startup Validation & Cryptographic Tamper-Resistance', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('5.1 validateProductionEnv halts startup when MFA_ENCRYPTION_KEY is missing in production mode', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGO_URI = 'mongodb://localhost:27017/edwth_prod';
      process.env.JWT_SECRET = 'a_very_secure_jwt_secret_with_more_than_32_characters';
      delete process.env.MFA_ENCRYPTION_KEY;
      delete process.env.TOTP_ENCRYPTION_KEY;

      expect(() => validateProductionEnv()).toThrow(/MFA_ENCRYPTION_KEY/);
    });

    it('5.2 validateProductionEnv halts startup when MFA_ENCRYPTION_KEY is shorter than 32 characters in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.MONGO_URI = 'mongodb://localhost:27017/edwth_prod';
      process.env.JWT_SECRET = 'a_very_secure_jwt_secret_with_more_than_32_characters';
      process.env.MFA_ENCRYPTION_KEY = 'short_key_1234';

      expect(() => validateProductionEnv()).toThrow(/MFA_ENCRYPTION_KEY/);
    });

    it('5.3 getMfaEncryptionKey properly parses 64-hex char keys and derives 32-byte key from string', () => {
      const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.MFA_ENCRYPTION_KEY = hexKey;
      const keyBuffer = getMfaEncryptionKey();
      expect(keyBuffer).toBeInstanceOf(Buffer);
      expect(keyBuffer.length).toBe(32);
      expect(keyBuffer.toString('hex')).toBe(hexKey);
    });

    it('5.4 decryptTotpSecret rejects tampered ciphertext or corrupted auth tag with generic safe error', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptTotpSecret(plaintext);
      const parts = encrypted.split(':'); // ['enc', 'v1', ivHex, tagHex, cipherHex]

      // Tamper with the ciphertext
      const tamperedCipher = parts[4].slice(0, -2) + (parts[4].endsWith('0') ? '1' : '0');
      const tamperedSecret = `enc:v1:${parts[2]}:${parts[3]}:${tamperedCipher}`;

      expect(() => decryptTotpSecret(tamperedSecret)).toThrow(/MFA cryptographic verification failed/);

      // Tamper with auth tag
      const tamperedTag = parts[3].slice(0, -2) + (parts[3].endsWith('0') ? '1' : '0');
      const tamperedTagSecret = `enc:v1:${parts[2]}:${tamperedTag}:${parts[4]}`;

      expect(() => decryptTotpSecret(tamperedTagSecret)).toThrow(/MFA cryptographic verification failed/);
    });
  });
});
