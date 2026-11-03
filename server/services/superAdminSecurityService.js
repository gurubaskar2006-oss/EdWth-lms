/**
 * EdWth LMS — SuperAdmin Security Email & Recovery Service
 * 6th Civilians Corporation
 *
 * Enforces:
 * 1. Exclusive delivery to authorized SUPERADMIN_SECURITY_EMAIL (thesixthcivilians26@gmail.com).
 * 2. Cryptographically secure random OTPs and recovery tokens.
 * 3. Hashed persistence only (salted SHA-256).
 * 4. Rate-limiting, resend cooldowns (60s), max attempts (5), and short expiry (5m / 15m).
 * 5. Restricted recovery session scopes (never unrestricted SuperAdmin sessions).
 * 6. Protection against silent email alterations or unauthorized privilege elevation.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import EmailOtp from '../models/EmailOtp.js';
import RecoveryToken from '../models/RecoveryToken.js';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';
import {
  sendSuperAdminOtp,
  sendRecoveryLink,
  isEmailConfigured,
  getEmailDeliveryStatus
} from './emailService.js';
import { getExpectedOrigin } from '../config/webauthn.js';
import { getJwtSecret } from '../config/environment.js';
import { createAuditLog, createCriticalAuditLog } from '../utils/auditLogger.js';

/**
 * Computes a salted SHA-256 hash of an OTP code.
 *
 * @param {string} code
 * @param {string} salt
 * @returns {string} Hex hash
 */
export const hashOtp = (code, salt) => {
  return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
};

/**
 * Timing-safe string comparison to protect against timing attacks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export const timingSafeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Checks the status of the SuperAdmin security email binding.
 *
 * @param {object} user
 * @returns {object} Status metadata
 */
export const getSecurityEmailBindingStatus = (user) => {
  const authorized = getSuperAdminSecurityEmail();
  const accountEmail = (user.email || '').trim().toLowerCase();
  const securityEmail = (user.securityEmail || '').trim().toLowerCase();

  const isMatched = accountEmail === authorized || securityEmail === authorized;
  const isVerified = isMatched && !!user.isSecurityEmailVerified;

  const emailConfigured = isEmailConfigured();
  const deliveryStatus = getEmailDeliveryStatus();

  return {
    authorizedSecurityEmail: authorized,
    accountEmail: user.email,
    securityEmail: user.securityEmail || null,
    isSecurityEmailVerified: isVerified,
    requiresBinding: !isVerified,
    emailProviderConfigured: emailConfigured,
    emailDeliveryStatus: deliveryStatus
  };
};

/**
 * Generates and dispatches a binding OTP to the authorized security email.
 * Requires user to be authenticated SuperAdmin.
 *
 * @param {object} user
 * @returns {Promise<{ success: boolean, message: string, resendAfter: number }>}
 */
export const sendSecurityEmailBindingOtp = async (user) => {
  if (!user || user.role !== 'superadmin') {
    throw new Error('Security email verification is restricted to SuperAdmin accounts.');
  }

  const authorizedEmail = getSuperAdminSecurityEmail();

  // 1. Sliding-window hourly rate limit: maximum 5 requests per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCount = await EmailOtp.countDocuments({
    userId: user._id,
    createdAt: { $gte: oneHourAgo }
  });

  if (hourlyCount >= 5) {
    const rateLimitErr = new Error('Hourly verification code request limit reached (maximum 5 requests per hour). Please try again later for security.');
    rateLimitErr.code = 'RATE_LIMIT_EXCEEDED';
    throw rateLimitErr;
  }

  // 2. Check cooldown on recent active OTPs (60s cooldown)
  const recentOtp = await EmailOtp.findOne({
    userId: user._id,
    purpose: 'email_verification',
    consumed: false,
    resendAfter: { $gt: new Date() }
  });

  if (recentOtp) {
    const remainingSeconds = Math.ceil((recentOtp.resendAfter.getTime() - Date.now()) / 1000);
    throw new Error(`Please wait ${remainingSeconds} seconds before requesting a new verification code.`);
  }

  // Invalidate previous outstanding unconsumed binding OTPs
  await EmailOtp.updateMany(
    { userId: user._id, purpose: 'email_verification', consumed: false },
    { $set: { consumed: true } }
  );

  // Generate cryptographically secure 6-digit numeric code
  const codeNum = crypto.randomInt(100000, 1000000);
  const code = codeNum.toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(code, salt);

  const now = Date.now();
  const resendAfter = new Date(now + 60 * 1000); // 60 seconds cooldown
  const expiresAt = new Date(now + 5 * 60 * 1000); // 5 minutes validity

  const createdOtp = await EmailOtp.create({
    userId: user._id,
    email: authorizedEmail,
    purpose: 'email_verification',
    otpHash,
    salt,
    resendAfter,
    expiresAt,
    consumed: false
  });

  // Dispatch exclusively to authorized SuperAdmin security mailbox
  try {
    await sendSuperAdminOtp(authorizedEmail, {
      code,
      purpose: 'security_email_binding',
      expiresMinutes: 5
    });
  } catch (dispatchErr) {
    // If mail transfer failed, remove the unconsumed OTP so the admin isn't locked out by cooldown
    await EmailOtp.deleteOne({ _id: createdOtp._id });
    throw dispatchErr;
  }

  createAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'SUPERADMIN_SECURITY_EMAIL_OTP_DISPATCHED',
    details: { destination: authorizedEmail, purpose: 'email_verification' }
  });

  return {
    success: true,
    message: 'Verification code dispatched to the authorized SuperAdmin security mailbox.',
    resendAfter: 60
  };
};

/**
 * Verifies the binding OTP and explicitly binds the SuperAdmin account to the authorized security email.
 *
 * @param {object} user
 * @param {string} code - 6-digit code entered by user
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const verifySecurityEmailBindingOtp = async (user, code) => {
  if (!user || user.role !== 'superadmin') {
    throw new Error('Security email verification is restricted to SuperAdmin accounts.');
  }

  if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
    throw new Error('Please enter a valid 6-digit verification code.');
  }

  const authorizedEmail = getSuperAdminSecurityEmail();
  const cleanCode = code.trim();

  const otpDoc = await EmailOtp.findOne({
    userId: user._id,
    purpose: 'email_verification',
    consumed: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new Error('Verification code has expired or was not found. Please request a new code.');
  }

  // Attempt rate limiting
  if (otpDoc.attempts >= otpDoc.maxAttempts) {
    otpDoc.consumed = true;
    await otpDoc.save();
    throw new Error('Maximum verification attempts exceeded. Please request a new code.');
  }

  otpDoc.attempts += 1;
  await otpDoc.save();

  const computedHash = hashOtp(cleanCode, otpDoc.salt);
  const isValid = timingSafeCompare(computedHash, otpDoc.otpHash);

  if (!isValid) {
    createAuditLog({
      tenantId: null,
      actor: { userId: user._id, role: 'superadmin', email: user.email },
      action: 'SUPERADMIN_SECURITY_EMAIL_OTP_FAILED',
      details: { attempt: otpDoc.attempts }
    });
    throw new Error(`Invalid verification code. ${otpDoc.maxAttempts - otpDoc.attempts} attempt(s) remaining.`);
  }

  // Consume code
  otpDoc.consumed = true;
  await otpDoc.save();

  // Bind security email to user record
  user.securityEmail = authorizedEmail;
  user.isSecurityEmailVerified = true;
  await user.save();

  await createCriticalAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'SUPERADMIN_SECURITY_EMAIL_BOUND',
    details: {
      accountEmail: user.email,
      boundSecurityEmail: authorizedEmail,
      timestamp: new Date().toISOString()
    }
  });

  return {
    success: true,
    message: 'Authorized SuperAdmin security email successfully verified and bound.'
  };
};

/**
 * Initiates an account recovery request for SuperAdmin.
 * Dispatches a single-use recovery link to the authorized security mailbox.
 *
 * @param {string} identifier - SuperAdmin email or ID
 * @param {object} req - Express request
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const requestSuperAdminRecovery = async (identifier, req) => {
  const authorizedEmail = getSuperAdminSecurityEmail();

  // Generic security response to prevent account enumeration
  const genericResponse = {
    success: true,
    message: 'If an authorized SuperAdmin account is registered, recovery instructions have been dispatched to the authorized security mailbox.'
  };

  if (!identifier || typeof identifier !== 'string') {
    return genericResponse;
  }

  const cleanId = identifier.trim().toLowerCase();

  const superAdmin = await User.findOne({
    $or: [{ email: cleanId }, { studentId: cleanId }, { securityEmail: cleanId }],
    role: 'superadmin',
    soft_deleted: false
  });

  if (!superAdmin) {
    return genericResponse;
  }

  // Rate limit 1: Check hourly request limit (max 5 requests per hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const hourlyCount = await RecoveryToken.countDocuments({
    userId: superAdmin._id,
    createdAt: { $gte: oneHourAgo }
  });

  if (hourlyCount >= 5) {
    return genericResponse;
  }

  // Rate limit 2: Check if a recovery token was requested in the last 2 minutes
  const recentToken = await RecoveryToken.findOne({
    userId: superAdmin._id,
    consumed: false,
    createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) }
  });

  if (recentToken) {
    return genericResponse;
  }

  // Invalidate previous outstanding tokens
  await RecoveryToken.updateMany(
    { userId: superAdmin._id, consumed: false },
    { $set: { consumed: true } }
  );

  // Generate cryptographically secure random token (32 bytes = 64 hex chars)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

  await RecoveryToken.create({
    userId: superAdmin._id,
    email: authorizedEmail,
    tokenHash,
    purpose: 'superadmin_passkey_recovery',
    expiresAt,
    consumed: false
  });

  // Construct recovery URL based on configured origin
  const origin = getExpectedOrigin(req);
  const recoveryUrl = `${origin}/admin.html?recovery_token=${rawToken}`;

  try {
    await sendRecoveryLink(authorizedEmail, {
      recoveryUrl,
      expiresMinutes: 15
    });
  } catch (err) {
    console.error('[superAdminSecurityService] Failed to dispatch recovery email:', err.message);
  }

  createCriticalAuditLog({
    tenantId: null,
    actor: { userId: superAdmin._id, role: 'superadmin', email: superAdmin.email },
    action: 'SUPERADMIN_RECOVERY_REQUESTED',
    details: { destination: authorizedEmail, ip: req.ip }
  }).catch(() => {});

  return genericResponse;
};

/**
 * Verifies a single-use recovery token and issues a restricted recovery session token.
 *
 * @param {string} rawToken
 * @param {object} req - Express request
 * @returns {Promise<{ success: boolean, recoverySessionToken: string, user: object }>}
 */
export const verifySuperAdminRecoveryToken = async (rawToken, req) => {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length < 32) {
    throw new Error('Invalid recovery token.');
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');

  // Atomic conditional consumption: enforces correct hash, unconsumed status,
  // unexpired TTL, and intended recovery purpose in a single atomic database operation.
  // Guarantees that concurrent requests cannot consume the same token multiple times.
  const now = new Date();
  const tokenDoc = await RecoveryToken.findOneAndUpdate(
    {
      tokenHash,
      consumed: false,
      expiresAt: { $gt: now },
      purpose: 'superadmin_passkey_recovery'
    },
    {
      $set: {
        consumed: true,
        consumedAt: now
      }
    },
    { returnDocument: 'after' }
  );

  if (!tokenDoc) {
    throw new Error('Recovery token has expired or is invalid.');
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user || user.role !== 'superadmin' || user.soft_deleted) {
    throw new Error('Administrative account associated with recovery token is not available.');
  }

  // Issue restricted recovery session JWT (valid for 15 minutes)
  // Scope: 'superadmin_recovery' - Cannot access standard admin resources!
  const recoverySessionToken = jwt.sign(
    {
      id: user._id,
      role: 'superadmin',
      recovery: true,
      scope: 'superadmin_recovery'
    },
    getJwtSecret(),
    { expiresIn: '15m' }
  );

  createCriticalAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'SUPERADMIN_RECOVERY_TOKEN_VERIFIED',
    details: { ip: req.ip, timestamp: new Date().toISOString() }
  }).catch(() => {});

  return {
    success: true,
    recoverySessionToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isTwoFactorEnabled: !!user.isTwoFactorEnabled
    }
  };
};

export default {
  hashOtp,
  timingSafeCompare,
  getSecurityEmailBindingStatus,
  sendSecurityEmailBindingOtp,
  verifySecurityEmailBindingOtp,
  requestSuperAdminRecovery,
  verifySuperAdminRecoveryToken
};

