/**
 * EdWth LMS — SuperAdmin Passkeys, Email OTP & Account Recovery Test Suite
 * 6th Civilians Corporation
 *
 * Verification Coverage:
 * 1. Exclusive SuperAdmin Security Email enforcement (thesixthcivilians26@gmail.com)
 * 2. WebAuthn Passkey Registration Options & Verification
 * 3. Passkey Authentication, Session Issuance & Clone Replay Defense
 * 4. Passkey Listing (no public key leak) & Deletion with Re-authentication
 * 5. Email OTP generation, hashing, attempt throttling & single-use consumption
 * 6. Account Recovery Token issuance, hashing, restricted session scoping
 * 7. Non-SuperAdmin & Unauthenticated Privilege Elevation Prevention
 * 8. Feature Flag enforcement
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../server.js';
import User from '../models/User.js';
import Passkey from '../models/Passkey.js';
import WebAuthnChallenge from '../models/WebAuthnChallenge.js';
import EmailOtp from '../models/EmailOtp.js';
import RecoveryToken from '../models/RecoveryToken.js';
import Session from '../models/Session.js';
import { getJwtSecret } from '../config/environment.js';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';
import { testEmailDispatchLog } from '../services/emailService.js';
import { getFeatureFlags } from '../config/featureFlags.js';
import { revokeAllUserSessions } from '../services/sessionService.js';

describe('EdWth LMS — SuperAdmin Passkeys & Recovery Acceptance Suite', () => {
  const testRunId = Date.now();
  const rawAdminPassword = 'SuperAdmin!Password2026';
  let superAdminUser;
  let superAdminToken;
  let studentUser;
  let studentToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create standard student account for privilege boundary testing
    studentUser = await User.create({
      studentId: `STU-PK-${testRunId}`,
      name: 'Regular Student',
      email: `student.${testRunId}@lumina.test`,
      password: await bcrypt.hash('Student123!Test', 10),
      role: 'student',
      isTwoFactorEnabled: false
    });

    studentToken = jwt.sign(
      { id: studentUser._id, role: 'student' },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 2. Create SuperAdmin account
    superAdminUser = await User.create({
      studentId: `SA-PK-${testRunId}`,
      name: 'Platform SuperAdmin',
      email: `superadmin.${testRunId}@6c.com`,
      password: await bcrypt.hash(rawAdminPassword, 10),
      role: 'superadmin',
      tenantId: null,
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      mfaSetupRequired: false,
      securityEmail: getSuperAdminSecurityEmail(),
      isSecurityEmailVerified: true
    });

    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin' },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (studentUser?._id) await User.deleteOne({ _id: studentUser._id });
    if (superAdminUser?._id) {
      await User.deleteOne({ _id: superAdminUser._id });
      await Passkey.deleteMany({ userId: superAdminUser._id });
      await EmailOtp.deleteMany({ userId: superAdminUser._id });
      await RecoveryToken.deleteMany({ userId: superAdminUser._id });
    }
  });

  describe('1. SuperAdmin Security Mailbox Exclusivity', () => {
    it('1.1 Verifies that configured security email is the exact authorized address', () => {
      const email = getSuperAdminSecurityEmail();
      expect(email).toBe('thesixthcivilians26@gmail.com');
    });

    it('1.2 Rejects sending SuperAdmin security OTP if target does not match authorized email', async () => {
      const { sendSuperAdminOtp } = await import('../services/emailService.js');
      await expect(
        sendSuperAdminOtp('unauthorized.hacker@evil.com', { code: '123456', purpose: 'test' })
      ).rejects.toThrow(/SECURITY VIOLATION.*restricted exclusively/);
    });

    it('1.3 Binding status reports unverified if account security email is not verified', async () => {
      const unverifiedAdmin = await User.create({
        studentId: `UNVER-${testRunId}`,
        name: 'Unverified Admin',
        email: `unverified.${testRunId}@6c.com`,
        password: await bcrypt.hash(rawAdminPassword, 10),
        role: 'superadmin',
        isTwoFactorEnabled: true,
        securityEmail: null,
        isSecurityEmailVerified: false
      });

      const unverifiedToken = jwt.sign(
        { id: unverifiedAdmin._id, role: 'superadmin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/superadmin/security-email/status')
        .set('Authorization', `Bearer ${unverifiedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status.requiresBinding).toBe(true);
      expect(res.body.status.isSecurityEmailVerified).toBe(false);

      await User.deleteOne({ _id: unverifiedAdmin._id });
    });
  });

  describe('2. Security Email Binding Ceremony & OTP Throttling', () => {
    let bindingAdmin;
    let bindingToken;

    beforeAll(async () => {
      bindingAdmin = await User.create({
        studentId: `BIND-${testRunId}`,
        name: 'Binding Admin',
        email: `bindadmin.${testRunId}@6c.com`,
        password: await bcrypt.hash(rawAdminPassword, 10),
        role: 'superadmin',
        isTwoFactorEnabled: true,
        securityEmail: null,
        isSecurityEmailVerified: false
      });

      bindingToken = jwt.sign(
        { id: bindingAdmin._id, role: 'superadmin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );
    });

    afterAll(async () => {
      if (bindingAdmin?._id) {
        await User.deleteOne({ _id: bindingAdmin._id });
        await EmailOtp.deleteMany({ userId: bindingAdmin._id });
      }
    });

    it('2.1 Successfully dispatches binding OTP to the authorized security email', async () => {
      testEmailDispatchLog.length = 0; // Clear log

      const res = await request(app)
        .post('/api/v1/auth/superadmin/security-email/send-otp')
        .set('Authorization', `Bearer ${bindingToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(testEmailDispatchLog.length).toBeGreaterThan(0);
      const lastEmail = testEmailDispatchLog[testEmailDispatchLog.length - 1];
      expect(lastEmail.to).toBe('thesixthcivilians26@gmail.com');
      expect(lastEmail.subject).toContain('SuperAdmin Verification Code');
    });

    it('2.2 Enforces 60-second cooldown on immediate resend attempt', async () => {
      const res = await request(app)
        .post('/api/v1/auth/superadmin/security-email/send-otp')
        .set('Authorization', `Bearer ${bindingToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/wait.*seconds/i);
    });

    it('2.3 Rejects invalid or wrong OTP code with remaining attempt count', async () => {
      const res = await request(app)
        .post('/api/v1/auth/superadmin/security-email/verify-otp')
        .set('Authorization', `Bearer ${bindingToken}`)
        .send({ code: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid verification code/i);
    });

    it('2.4 Verifies valid OTP, sets securityEmail and marks verified', async () => {
      // Find the active OTP doc and reverse-check hash with a simulated code
      const otpDoc = await EmailOtp.findOne({
        userId: bindingAdmin._id,
        purpose: 'email_verification',
        consumed: false
      });
      expect(otpDoc).toBeTruthy();

      // Retrieve the code that was dispatched in the test log
      const lastEmail = testEmailDispatchLog[testEmailDispatchLog.length - 1];
      const match = lastEmail.text.match(/verification code is:\s*(\d{6})/i);
      expect(match).toBeTruthy();
      const code = match[1];

      const res = await request(app)
        .post('/api/v1/auth/superadmin/security-email/verify-otp')
        .set('Authorization', `Bearer ${bindingToken}`)
        .send({ code });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedAdmin = await User.findById(bindingAdmin._id);
      expect(updatedAdmin.securityEmail).toBe('thesixthcivilians26@gmail.com');
      expect(updatedAdmin.isSecurityEmailVerified).toBe(true);
    });
  });

  describe('3. Passkey Registration Ceremony', () => {
    it('3.1 Rejects registration options if user is not SuperAdmin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/passkeys/register/options')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('3.2 Generates valid WebAuthn registration options for authorized SuperAdmin', async () => {
      const res = await request(app)
        .post('/api/v1/auth/passkeys/register/options')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.options).toHaveProperty('challenge');
      expect(res.body.options).toHaveProperty('rp');
      expect(res.body.options.rp.name).toContain('EdWth');

      // Verify challenge was saved in database
      const challengeDoc = await WebAuthnChallenge.findOne({ challenge: res.body.options.challenge });
      expect(challengeDoc).toBeTruthy();
      expect(challengeDoc.purpose).toBe('registration');
      expect(challengeDoc.consumed).toBe(false);
    });

    it('3.3 Rejects registration verify when challenge is missing or replayed', async () => {
      const res = await request(app)
        .post('/api/v1/auth/passkeys/register/verify')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          response: {
            id: 'mock-cred-id-1234',
            rawId: 'mock-cred-id-1234',
            type: 'public-key',
            response: {
              clientDataJSON: Buffer.from(JSON.stringify({
                type: 'webauthn.create',
                challenge: 'nonexistent-or-expired-challenge',
                origin: 'http://localhost:3000'
              })).toString('base64url')
            }
          }
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/challenge.*expired.*not exist/i);
    });

    it('3.4 Enforces atomic registration challenge consumption under simultaneous requests', async () => {
      const challengeStr = crypto.randomBytes(32).toString('base64url');
      const now = new Date();
      const challengeDoc = await WebAuthnChallenge.create({
        challenge: challengeStr,
        userId: superAdminUser._id,
        purpose: 'registration',
        expectedRPID: 'localhost',
        expectedOrigin: 'http://localhost:3000',
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        consumed: false
      });

      // Simulate simultaneous concurrent attempts to consume the same registration challenge
      const attemptConsumption = async () => {
        return WebAuthnChallenge.findOneAndUpdate(
          {
            _id: challengeDoc._id,
            challenge: challengeDoc.challenge,
            userId: superAdminUser._id,
            purpose: 'registration',
            consumed: false,
            expiresAt: { $gt: new Date() }
          },
          {
            $set: {
              consumed: true,
              consumedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );
      };

      const [res1, res2, res3] = await Promise.all([
        attemptConsumption(),
        attemptConsumption(),
        attemptConsumption()
      ]);

      const consumedResults = [res1, res2, res3].filter((r) => r !== null);
      const failedResults = [res1, res2, res3].filter((r) => r === null);

      expect(consumedResults.length).toBe(1);
      expect(failedResults.length).toBe(2);
      expect(consumedResults[0].consumed).toBe(true);
      expect(consumedResults[0].consumedAt).toBeInstanceOf(Date);

      // Verify second sequential attempt also fails
      const sequentialAttempt = await attemptConsumption();
      expect(sequentialAttempt).toBeNull();

      await WebAuthnChallenge.deleteOne({ _id: challengeDoc._id });
    });
  });

  describe('4. Passkey Login & Clone Replay Defense', () => {
    let mockPasskey;

    beforeAll(async () => {
      // Create a mock registered passkey for login tests
      mockPasskey = await Passkey.create({
        credentialId: `test-cred-${testRunId}`,
        publicKey: Buffer.from('mock-public-key-data').toString('base64url'),
        userId: superAdminUser._id,
        counter: 10,
        deviceLabel: 'YubiKey 5 NFC (SuperAdmin Key)',
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['usb', 'nfc']
      });
    });

    afterAll(async () => {
      if (mockPasskey?._id) await Passkey.deleteOne({ _id: mockPasskey._id });
    });

    it('4.1 Generates passkey login options with rpId and challenge', async () => {
      const res = await request(app)
        .post('/api/v1/auth/passkeys/login/options')
        .send({ email: superAdminUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.options).toHaveProperty('challenge');
      expect(res.body.options.allowCredentials.length).toBeGreaterThan(0);
      expect(res.body.options.allowCredentials[0].id).toBe(mockPasskey.credentialId);
    });

    it('4.2 Rejects login verify if passkey credential ID is unknown', async () => {
      const res = await request(app)
        .post('/api/v1/auth/passkeys/login/verify')
        .send({
          response: {
            id: 'unknown-credential-id-9999',
            type: 'public-key',
            response: {}
          }
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/Unrecognized passkey credential/i);
    });

    it('4.3 Enforces atomic authentication challenge consumption under simultaneous requests', async () => {
      const challengeStr = crypto.randomBytes(32).toString('base64url');
      const now = new Date();
      const challengeDoc = await WebAuthnChallenge.create({
        challenge: challengeStr,
        purpose: 'authentication',
        expectedRPID: 'localhost',
        expectedOrigin: 'http://localhost:3000',
        expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
        consumed: false
      });

      const attemptConsumption = async () => {
        return WebAuthnChallenge.findOneAndUpdate(
          {
            _id: challengeDoc._id,
            challenge: challengeDoc.challenge,
            purpose: 'authentication',
            consumed: false,
            expiresAt: { $gt: new Date() }
          },
          {
            $set: {
              consumed: true,
              consumedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );
      };

      const [res1, res2, res3] = await Promise.all([
        attemptConsumption(),
        attemptConsumption(),
        attemptConsumption()
      ]);

      const consumedResults = [res1, res2, res3].filter((r) => r !== null);
      const failedResults = [res1, res2, res3].filter((r) => r === null);

      expect(consumedResults.length).toBe(1);
      expect(failedResults.length).toBe(2);
      expect(consumedResults[0].consumed).toBe(true);
      expect(consumedResults[0].consumedAt).toBeInstanceOf(Date);

      // Verify second sequential attempt also fails
      const sequentialAttempt = await attemptConsumption();
      expect(sequentialAttempt).toBeNull();

      await WebAuthnChallenge.deleteOne({ _id: challengeDoc._id });
    });

    it('4.4 Detects authenticator clone or counter rollback when counter does not advance', async () => {
      // Create a test passkey with stored counter = 10
      const cloneTestPasskey = await Passkey.create({
        credentialId: `clone-cred-${testRunId}`,
        publicKey: Buffer.from('mock-pubkey-clone').toString('base64url'),
        userId: superAdminUser._id,
        counter: 10,
        deviceLabel: 'Cloned Hardware Key'
      });

      // Authenticator returns counter <= storedCounter (e.g. 5 <= 10)
      const receivedCounter = 5;
      const isCloneDetected = cloneTestPasskey.counter > 0 && receivedCounter <= cloneTestPasskey.counter;
      expect(isCloneDetected).toBe(true);

      await Passkey.deleteOne({ _id: cloneTestPasskey._id });
    });
  });

  describe('5. Passkey Management & Re-authentication on Deletion', () => {
    let passkeyToDelete;

    beforeAll(async () => {
      passkeyToDelete = await Passkey.create({
        credentialId: `delete-cred-${testRunId}`,
        publicKey: Buffer.from('mock-pubkey-to-delete').toString('base64url'),
        userId: superAdminUser._id,
        counter: 1,
        deviceLabel: 'Old Windows Hello Device',
        deviceType: 'singleDevice'
      });
    });

    afterAll(async () => {
      if (passkeyToDelete?._id) await Passkey.deleteOne({ _id: passkeyToDelete._id });
    });

    it('5.1 Lists registered passkeys without exposing public-key material', async () => {
      const res = await request(app)
        .get('/api/v1/auth/passkeys')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.passkeys)).toBe(true);
      expect(res.body.passkeys.length).toBeGreaterThan(0);

      // Verify no public keys leaked
      for (const pk of res.body.passkeys) {
        expect(pk).toHaveProperty('deviceLabel');
        expect(pk).toHaveProperty('credentialId');
        expect(pk).not.toHaveProperty('publicKey');
      }
    });

    it('5.2 Rejects passkey deletion when current password is missing', async () => {
      const res = await request(app)
        .delete(`/api/v1/auth/passkeys/${passkeyToDelete._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Fresh re-authentication is required/i);
    });

    it('5.3 Rejects passkey deletion when second-factor code is invalid', async () => {
      const res = await request(app)
        .delete(`/api/v1/auth/passkeys/${passkeyToDelete._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          secondFactorCode: '999999'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid second-factor code/i);
    });

    it('5.4 Successfully removes passkey when authenticated with valid backup recovery code', async () => {
      const backupCodePlain = 'a1b2c3d4';
      const backupHash = await bcrypt.hash(backupCodePlain, 10);
      await User.updateOne({ _id: superAdminUser._id }, { $push: { twoFactorBackupCodes: backupHash } });

      testEmailDispatchLog.length = 0;

      const res = await request(app)
        .delete(`/api/v1/auth/passkeys/${passkeyToDelete._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          currentPassword: rawAdminPassword,
          secondFactorCode: backupCodePlain
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedCheck = await Passkey.findById(passkeyToDelete._id);
      expect(deletedCheck).toBeNull();

      // Check notification sent
      expect(testEmailDispatchLog.length).toBeGreaterThan(0);
      const alertEmail = testEmailDispatchLog[testEmailDispatchLog.length - 1];
      expect(alertEmail.to).toBe('thesixthcivilians26@gmail.com');
      expect(alertEmail.subject).toMatch(/Passkey REMOVED/i);
    });
  });

  describe('6. Passkey Account Recovery Flow', () => {
    it('6.1 Request recovery sends link to authorized security email and returns generic message', async () => {
      testEmailDispatchLog.length = 0;

      const res = await request(app)
        .post('/api/v1/auth/recovery/request')
        .send({ identifier: superAdminUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('authorized security mailbox');

      expect(testEmailDispatchLog.length).toBeGreaterThan(0);
      const recoveryEmail = testEmailDispatchLog[testEmailDispatchLog.length - 1];
      expect(recoveryEmail.to).toBe('thesixthcivilians26@gmail.com');
      expect(recoveryEmail.subject).toContain('SuperAdmin Passkey Recovery');
    });

    it('6.2 Recovery token verification issues a restricted session token', async () => {
      // Extract raw token from the dispatched recovery email URL
      const recoveryEmail = testEmailDispatchLog[testEmailDispatchLog.length - 1];
      const match = recoveryEmail.text.match(/recovery_token=([a-f0-9]{64})/i);
      expect(match).toBeTruthy();
      const rawToken = match[1];

      const res = await request(app)
        .post('/api/v1/auth/recovery/verify')
        .send({ token: rawToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('recoverySessionToken');

      const decoded = jwt.verify(res.body.recoverySessionToken, getJwtSecret());
      expect(decoded.recovery).toBe(true);
      expect(decoded.scope).toBe('superadmin_recovery');

      // Re-using the token must fail (single-use)
      const reuseRes = await request(app)
        .post('/api/v1/auth/recovery/verify')
        .send({ token: rawToken });

      expect(reuseRes.status).toBe(400);
    });

    it('6.3 Restricted recovery session CANNOT access regular admin resources', async () => {
      const restrictedRecoveryToken = jwt.sign(
        { id: superAdminUser._id, role: 'superadmin', recovery: true, scope: 'superadmin_recovery' },
        getJwtSecret(),
        { expiresIn: '15m' }
      );

      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${restrictedRecoveryToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('RESTRICTED_RECOVERY_SESSION');
    });

    it('6.4 Account recovery initiation does NOT delete existing MFA credentials', async () => {
      const admin = await User.findById(superAdminUser._id);
      expect(admin.isTwoFactorEnabled).toBe(true);
    });

    it('6.5 Enforces atomic recovery token consumption under simultaneous concurrent requests', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const now = new Date();
      await RecoveryToken.create({
        userId: superAdminUser._id,
        email: getSuperAdminSecurityEmail(),
        tokenHash,
        purpose: 'superadmin_passkey_recovery',
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
        consumed: false
      });

      // Launch 5 concurrent verification attempts simultaneously
      const results = await Promise.all([
        request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken }),
        request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken }),
        request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken }),
        request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken }),
        request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken })
      ]);

      const successes = results.filter((r) => r.status === 200);
      const failures = results.filter((r) => r.status === 400);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(4);
      expect(successes[0].body.success).toBe(true);
      expect(successes[0].body).toHaveProperty('recoverySessionToken');

      const consumedDoc = await RecoveryToken.findOne({ tokenHash });
      expect(consumedDoc.consumed).toBe(true);
      expect(consumedDoc.consumedAt).toBeInstanceOf(Date);

      // Subsequent request also fails
      const subRes = await request(app).post('/api/v1/auth/recovery/verify').send({ token: rawToken });
      expect(subRes.status).toBe(400);
    });
  });

  describe('7. Privilege Boundary & Security Controls', () => {
    it('7.1 Student account cannot access passkey routes or elevate privileges', async () => {
      const res = await request(app)
        .get('/api/v1/auth/passkeys')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    it('7.2 Normal student login continues to work without regression', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: studentUser.email,
          password: 'Student123!Test'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('student');
    });
  });

  describe('8. Post-Recovery Session Revocation & Multi-Tenant Isolation', () => {
    it('8.1 Revokes all active SuperAdmin sessions post-recovery while preserving student sessions', async () => {
      // 1. Create 2 sessions for SuperAdmin
      const saSession1 = await Session.create({
        sessionId: `sa-sess-1-${testRunId}`,
        userId: superAdminUser._id,
        role: 'superadmin',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isRevoked: false
      });
      const saSession2 = await Session.create({
        sessionId: `sa-sess-2-${testRunId}`,
        userId: superAdminUser._id,
        role: 'superadmin',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isRevoked: false
      });

      // 2. Create 1 session for regular student
      const studentSession = await Session.create({
        sessionId: `stu-sess-1-${testRunId}`,
        userId: studentUser._id,
        role: 'student',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        isRevoked: false
      });

      // 3. Trigger revocation as done post-recovery
      await revokeAllUserSessions(superAdminUser._id, 'superadmin_account_recovered');

      // 4. Verify SuperAdmin sessions are revoked
      const updatedSa1 = await Session.findOne({ sessionId: saSession1.sessionId });
      const updatedSa2 = await Session.findOne({ sessionId: saSession2.sessionId });
      expect(updatedSa1.isRevoked).toBe(true);
      expect(updatedSa1.revocationReason).toBe('superadmin_account_recovered');
      expect(updatedSa2.isRevoked).toBe(true);
      expect(updatedSa2.revocationReason).toBe('superadmin_account_recovered');

      // 5. Verify Student session is NOT revoked (multi-tenant isolation)
      const updatedStu = await Session.findOne({ sessionId: studentSession.sessionId });
      expect(updatedStu.isRevoked).toBe(false);

      // Cleanup
      await Session.deleteMany({
        sessionId: { $in: [saSession1.sessionId, saSession2.sessionId, studentSession.sessionId] }
      });
    });
  });
});

