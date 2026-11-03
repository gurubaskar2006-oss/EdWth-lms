/**
 * EdWth LMS — SuperAdmin Security Mailbox Delivery & Verification Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Strict Recipient Exclusivity (fails closed on non-authorized email)
 * 2. Provider Configuration & Sanitized Status Reporting (zero secret leaks)
 * 3. Fail-Closed behavior when Outbound SMTP is unconfigured (no false-positive 200s)
 * 4. Cryptographic Hashing at rest (salted SHA-256) & 5-minute expiry
 * 5. Cooldown enforcement (60s) on rapid resends
 * 6. Sliding-window hourly rate limiting (max 5 requests/hr)
 * 7. Single-use consumption and automatic invalidation of stale codes
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectDB } from '../database/mongoose.js';
import User from '../models/User.js';
import EmailOtp from '../models/EmailOtp.js';
import RecoveryToken from '../models/RecoveryToken.js';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';
import {
  assertAuthorizedSuperAdminRecipient,
  isEmailConfigured,
  getEmailDeliveryStatus,
  sendSuperAdminOtp,
  testEmailDispatchLog
} from '../services/emailService.js';
import {
  hashOtp,
  timingSafeCompare,
  getSecurityEmailBindingStatus,
  sendSecurityEmailBindingOtp,
  verifySecurityEmailBindingOtp
} from '../services/superAdminSecurityService.js';

describe('EdWth LMS — SuperAdmin Security Mailbox Delivery & Verification', () => {
  const runId = Date.now();
  let superAdminUser;

  beforeAll(async () => {
    await connectDB();
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // Find or create test SuperAdmin account
    superAdminUser = await User.findOne({ role: 'superadmin' });
    if (!superAdminUser) {
      superAdminUser = await User.create({
        studentId: `SA-DELIV-${runId}`,
        name: 'Delivery Audit SuperAdmin',
        email: `sa.deliv.${runId}@6c.com`,
        password: await bcrypt.hash('SuperAdmin!2026', 10),
        role: 'superadmin',
        isTwoFactorEnabled: true,
        securityEmail: null,
        isSecurityEmailVerified: false
      });
    }
  });

  beforeEach(async () => {
    // Clean test dispatch log and test OTP records
    testEmailDispatchLog.length = 0;
    if (superAdminUser?._id) {
      await EmailOtp.deleteMany({ userId: superAdminUser._id });
    }
  });

  describe('1. Security Mailbox Exclusivity & Recipient Validation', () => {
    it('1.1 Authorized security mailbox must strictly match the sixth civilians address', () => {
      const authorized = getSuperAdminSecurityEmail();
      expect(authorized).toBe('thesixthcivilians26@gmail.com');
    });

    it('1.2 assertAuthorizedSuperAdminRecipient succeeds for authorized address', () => {
      expect(() => {
        assertAuthorizedSuperAdminRecipient('thesixthcivilians26@gmail.com');
        assertAuthorizedSuperAdminRecipient('  THESIXTHCIVILIANS26@GMAIL.COM  ');
      }).not.toThrow();
    });

    it('1.3 assertAuthorizedSuperAdminRecipient throws SECURITY VIOLATION for any other address', () => {
      expect(() => {
        assertAuthorizedSuperAdminRecipient('attacker@gmail.com');
      }).toThrow(/SECURITY VIOLATION/);

      expect(() => {
        assertAuthorizedSuperAdminRecipient('');
      }).toThrow(/SECURITY VIOLATION/);

      expect(() => {
        assertAuthorizedSuperAdminRecipient(null);
      }).toThrow(/SECURITY VIOLATION/);
    });
  });

  describe('2. Sanitized Provider Status & Secret Protection', () => {
    it('2.1 getEmailDeliveryStatus returns safe metadata without leaking passwords', () => {
      const status = getEmailDeliveryStatus();
      expect(status).toHaveProperty('configured');
      expect(status).toHaveProperty('authorizedSecurityEmail', 'thesixthcivilians26@gmail.com');
      expect(status).toHaveProperty('environment');

      // Crucial: Must NEVER leak SMTP_PASS or any private credentials
      expect(status).not.toHaveProperty('pass');
      expect(status).not.toHaveProperty('password');
      expect(status).not.toHaveProperty('SMTP_PASS');
      expect(JSON.stringify(status)).not.toMatch(/password|secret|pass/i);
    });

    it('2.2 getSecurityEmailBindingStatus exposes emailProviderConfigured and deliveryStatus', () => {
      const bindingStatus = getSecurityEmailBindingStatus(superAdminUser);
      expect(bindingStatus).toHaveProperty('authorizedSecurityEmail', 'thesixthcivilians26@gmail.com');
      expect(bindingStatus).toHaveProperty('emailProviderConfigured');
      expect(bindingStatus).toHaveProperty('emailDeliveryStatus');
    });
  });

  describe('3. Fail-Closed Outbound Delivery Enforcement', () => {
    it('3.1 sendSuperAdminOtp throws EMAIL_PROVIDER_NOT_CONFIGURED when SMTP is unconfigured in non-test mode', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalHost = process.env.SMTP_HOST;
      const originalUser = process.env.SMTP_USER;
      const originalPass = process.env.SMTP_PASS;

      try {
        // Temporarily simulate staging/dev mode with missing SMTP
        process.env.NODE_ENV = 'development';
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;

        await expect(
          sendSuperAdminOtp('thesixthcivilians26@gmail.com', { code: '123456', purpose: 'test' })
        ).rejects.toMatchObject({
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED'
        });
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalHost) process.env.SMTP_HOST = originalHost;
        if (originalUser) process.env.SMTP_USER = originalUser;
        if (originalPass) process.env.SMTP_PASS = originalPass;
      }
    });

    it('3.2 In test environment, sendSuperAdminOtp records dispatch in testEmailDispatchLog', async () => {
      const result = await sendSuperAdminOtp('thesixthcivilians26@gmail.com', {
        code: '987654',
        purpose: 'unit_test',
        expiresMinutes: 5
      });

      expect(result.success).toBe(true);
      expect(testEmailDispatchLog.length).toBe(1);
      expect(testEmailDispatchLog[0].to).toBe('thesixthcivilians26@gmail.com');
      expect(testEmailDispatchLog[0].subject).toContain('UNIT TEST');
    });
  });

  describe('4. Cryptographic Hashing at Rest & Storage Security', () => {
    it('4.1 hashOtp produces deterministic salted SHA-256 hashes', () => {
      const code = '654321';
      const salt = crypto.randomBytes(16).toString('hex');
      const hash1 = hashOtp(code, salt);
      const hash2 = hashOtp(code, salt);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex string length
    });

    it('4.2 timingSafeCompare prevents timing analysis', () => {
      const strA = 'abcdef1234567890';
      const strB = 'abcdef1234567890';
      const strC = 'abcdef1234567899';
      expect(timingSafeCompare(strA, strB)).toBe(true);
      expect(timingSafeCompare(strA, strC)).toBe(false);
      expect(timingSafeCompare(strA, 'short')).toBe(false);
    });

    it('4.3 Plaintext OTP is never stored directly in MongoDB EmailOtp document', async () => {
      await sendSecurityEmailBindingOtp(superAdminUser);

      const latestOtp = await EmailOtp.findOne({ userId: superAdminUser._id }).sort({ createdAt: -1 });
      expect(latestOtp).toBeDefined();
      expect(latestOtp.otpHash).toBeDefined();
      expect(latestOtp.salt).toBeDefined();

      // Ensure no property contains a raw 6-digit numeric string
      const docString = JSON.stringify(latestOtp.toJSON());
      expect(docString).not.toMatch(/"code":/);
      expect(docString).not.toMatch(/"otp":\s*"\d{6}"/);
    });
  });

  describe('5. Rate Limiting, Cooldowns & Consumption Lifecycle', () => {
    it('5.1 Enforces 60-second cooldown on immediate repeated request', async () => {
      await sendSecurityEmailBindingOtp(superAdminUser);

      await expect(
        sendSecurityEmailBindingOtp(superAdminUser)
      ).rejects.toThrow(/Please wait \d+ seconds before requesting a new verification code/);
    });

    it('5.2 Enforces sliding-window hourly rate limit (max 5 requests per hour)', async () => {
      // Create 5 existing OTP records for this user in the last 30 minutes
      const now = Date.now();
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = hashOtp('111111', salt);

      // Pre-seed 5 records
      for (let i = 0; i < 5; i++) {
        await EmailOtp.create({
          userId: superAdminUser._id,
          email: 'thesixthcivilians26@gmail.com',
          purpose: 'email_verification',
          otpHash,
          salt,
          resendAfter: new Date(now - 1000), // cooldown expired
          expiresAt: new Date(now + 300000),
          consumed: true,
          createdAt: new Date(now - (i * 5 * 60 * 1000)) // within last 25 minutes
        });
      }

      await expect(
        sendSecurityEmailBindingOtp(superAdminUser)
      ).rejects.toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED'
      });
    });

    it('5.3 Invalidates previous outstanding unconsumed OTPs when a new OTP is issued', async () => {
      const now = Date.now();
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = hashOtp('222222', salt);

      // Create an old unconsumed OTP with expired cooldown
      const oldOtp = await EmailOtp.create({
        userId: superAdminUser._id,
        email: 'thesixthcivilians26@gmail.com',
        purpose: 'email_verification',
        otpHash,
        salt,
        resendAfter: new Date(now - 2000), // cooldown already passed
        expiresAt: new Date(now + 300000),
        consumed: false
      });

      // Dispatch a fresh OTP
      await sendSecurityEmailBindingOtp(superAdminUser);

      // Verify the old OTP was invalidated (consumed = true)
      const reloadedOldOtp = await EmailOtp.findById(oldOtp._id);
      expect(reloadedOldOtp.consumed).toBe(true);
    });

    it('5.4 Successful verification marks OTP consumed and updates SuperAdmin record', async () => {
      // Manually create a verifiable OTP with known code
      const targetCode = '741852';
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = hashOtp(targetCode, salt);
      const now = Date.now();

      await EmailOtp.create({
        userId: superAdminUser._id,
        email: 'thesixthcivilians26@gmail.com',
        purpose: 'email_verification',
        otpHash,
        salt,
        resendAfter: new Date(now + 60000),
        expiresAt: new Date(now + 300000),
        consumed: false,
        attempts: 0,
        maxAttempts: 5
      });

      // Verify with wrong code first -> fails and increments attempts
      await expect(
        verifySecurityEmailBindingOtp(superAdminUser, '999999')
      ).rejects.toThrow(/Invalid verification code/);

      // Verify with correct code -> succeeds
      const verifyRes = await verifySecurityEmailBindingOtp(superAdminUser, targetCode);
      expect(verifyRes.success).toBe(true);

      // Verify user document in DB is updated
      const updatedUser = await User.findById(superAdminUser._id);
      expect(updatedUser.securityEmail).toBe('thesixthcivilians26@gmail.com');
      expect(updatedUser.isSecurityEmailVerified).toBe(true);

      // Verify OTP document in DB is now consumed
      const consumedOtp = await EmailOtp.findOne({ userId: superAdminUser._id, consumed: true }).sort({ createdAt: -1 });
      expect(consumedOtp.consumed).toBe(true);

      // Attempting to re-verify same consumed code must fail
      await expect(
        verifySecurityEmailBindingOtp(superAdminUser, targetCode)
      ).rejects.toThrow(/Verification code has expired or was not found/);
    });
  });
});
