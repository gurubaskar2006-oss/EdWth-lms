/**
 * EdWth LMS — Passkey (WebAuthn) Ceremony Service
 * 6th Civilians Corporation
 *
 * Implements FIDO2 / WebAuthn passkey registration, authentication, listing, and deletion
 * using @simplewebauthn/server.
 *
 * Enforces:
 * - Origin and Relying Party ID verification
 * - Challenge expiry and single-use consumption
 * - Signature, counter verification, and clone-detection
 * - Device labels and timestamp metadata
 * - SuperAdmin role verification and authorized security email binding
 * - Email security notifications upon registration/deletion
 * - Never returns or stores private keys
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import Passkey from '../models/Passkey.js';
import WebAuthnChallenge from '../models/WebAuthnChallenge.js';
import User from '../models/User.js';
import { getRelyingPartyID, getRelyingPartyName, getExpectedOrigin, getUserVerificationPolicy } from '../config/webauthn.js';
import { getSuperAdminSecurityEmail } from '../config/privilegedIdentities.js';
import { sendPasskeySecurityNotification } from './emailService.js';
import { revokeAllUserSessions } from './sessionService.js';
import { createAuditLog, createCriticalAuditLog } from '../utils/auditLogger.js';
import { decryptTotpSecret } from '../utils/mfaCrypto.js';

/**
 * Checks whether an account is fully bound to the authorized SuperAdmin security email.
 * @param {object} user
 * @returns {boolean}
 */
export const isSuperAdminSecurityEmailBound = (user) => {
  if (!user || user.role !== 'superadmin') return false;
  const authorized = getSuperAdminSecurityEmail();
  const accountEmail = (user.email || '').trim().toLowerCase();
  const securityEmail = (user.securityEmail || '').trim().toLowerCase();

  const isMatched = accountEmail === authorized || securityEmail === authorized;
  return isMatched && !!user.isSecurityEmailVerified;
};

/**
 * Generates registration options for an already authenticated SuperAdmin.
 *
 * @param {object} user - Authenticated user document
 * @param {object} req - Express request
 * @returns {Promise<object>} Registration options
 */
export const generatePasskeyRegistrationOptions = async (user, req) => {
  if (!user || user.role !== 'superadmin') {
    throw new Error('Passkey registration is restricted to SuperAdmin accounts.');
  }

  // Pre-condition 1: Must have completed existing MFA
  if (!user.isTwoFactorEnabled) {
    throw new Error('Prior enrollment and activation of two-factor authentication is required before registering passkeys.');
  }

  // Pre-condition 2: Must be bound to authorized security email
  if (!isSuperAdminSecurityEmailBound(user)) {
    throw new Error('SuperAdmin account must be bound and verified with the authorized security mailbox before registering passkeys.');
  }

  const rpID = getRelyingPartyID(req);
  const rpName = getRelyingPartyName();
  const expectedOrigin = getExpectedOrigin(req);
  const userVerification = getUserVerificationPolicy();

  // Retrieve existing passkeys to prevent re-registering existing authenticators
  const existingPasskeys = await Passkey.find({ userId: user._id });
  const excludeCredentials = existingPasskeys.map((p) => ({
    id: p.credentialId,
    type: 'public-key',
    transports: p.transports || []
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userID: new Uint8Array(Buffer.from(user._id.toString(), 'hex')),
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification
    }
  });

  // Store challenge with 5-minute expiry
  await WebAuthnChallenge.create({
    challenge: options.challenge,
    userId: user._id,
    purpose: 'registration',
    expectedRPID: rpID,
    expectedOrigin,
    userVerification,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  return options;
};

/**
 * Verifies WebAuthn registration response and registers the passkey credential.
 *
 * @param {object} user
 * @param {object} response - Registration response from @simplewebauthn/browser
 * @param {string} deviceLabel - User-provided or auto-detected device label
 * @param {object} req - Express request
 * @returns {Promise<object>} Registered passkey summary
 */
export const verifyPasskeyRegistrationService = async (user, response, deviceLabel, req) => {
  if (!user || user.role !== 'superadmin') {
    throw new Error('Passkey registration is restricted to SuperAdmin accounts.');
  }

  if (!response || !response.id) {
    throw new Error('Invalid WebAuthn registration payload.');
  }

  // Decode clientDataJSON to extract challenge for exact challenge lookup
  let clientChallenge = null;
  try {
    if (response.response && response.response.clientDataJSON) {
      const clientDataStr = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
      const parsed = JSON.parse(clientDataStr);
      clientChallenge = parsed.challenge;
    }
  } catch (parseErr) {
    // Fallback to active challenge lookup
  }

  const query = {
    userId: user._id,
    purpose: 'registration',
    consumed: false,
    expiresAt: { $gt: new Date() }
  };
  if (clientChallenge) {
    query.challenge = clientChallenge;
  }

  const challengeDoc = await WebAuthnChallenge.findOne(query).sort({ createdAt: -1 });
  if (!challengeDoc) {
    throw new Error('Registration challenge has expired or does not exist. Please initiate registration again.');
  }

  const expectedRPID = challengeDoc.expectedRPID;
  const expectedOrigin = challengeDoc.expectedOrigin;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challengeDoc.challenge,
      expectedOrigin,
      expectedRPID,
      requireUserVerification: challengeDoc.userVerification === 'required'
    });
  } catch (verErr) {
    throw new Error(`WebAuthn registration verification failed: ${verErr.message}`);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('WebAuthn registration verification failed.');
  }

  // Stage 3: Atomically consume challenge conditionally to prevent concurrency replay
  const now = new Date();
  const consumedChallenge = await WebAuthnChallenge.findOneAndUpdate(
    {
      _id: challengeDoc._id,
      challenge: challengeDoc.challenge,
      userId: user._id,
      purpose: 'registration',
      consumed: false,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        consumed: true,
        consumedAt: now
      }
    },
    { returnDocument: 'after' }
  );

  if (!consumedChallenge) {
    throw new Error('Registration challenge has already been consumed or expired.');
  }

  const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;

  // Prevent duplicate credential ID registration
  const duplicate = await Passkey.findOne({ credentialId: credential.id });
  if (duplicate) {
    throw new Error('A credential with this ID is already registered.');
  }

  const label = (deviceLabel && deviceLabel.trim()) ? deviceLabel.trim() : 'Authenticator Passkey';

  const newPasskey = await Passkey.create({
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    userId: user._id,
    counter: credential.counter,
    deviceType: credentialDeviceType || 'singleDevice',
    backedUp: !!credentialBackedUp,
    transports: credential.transports || [],
    deviceLabel: label,
    aaguid: aaguid || null,
    lastUsedAt: now
  });

  const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

  // Detect recovery session context to trigger full session revocation post-recovery
  const isRecoverySession = !!(
    req &&
    (req.isRecoverySession || req.user?.recovery || req.user?.scope === 'superadmin_recovery')
  );

  if (isRecoverySession) {
    // Revoke all existing sessions for this SuperAdmin user
    await revokeAllUserSessions(user._id, 'superadmin_account_recovered');
    createCriticalAuditLog({
      tenantId: null,
      actor: { userId: user._id, role: 'superadmin', email: user.email },
      action: 'SUPERADMIN_SESSIONS_REVOKED_POST_RECOVERY',
      details: { ip: clientIp, timestamp: now.toISOString() }
    }).catch(() => {});
  }

  // Security notification to authorized SuperAdmin security mailbox
  try {
    const notifyAction = isRecoverySession ? 'recovered' : 'registered';
    await sendPasskeySecurityNotification(getSuperAdminSecurityEmail(), {
      action: notifyAction,
      deviceLabel: label,
      ip: clientIp,
      timestamp: now
    });
  } catch (notifyErr) {
    console.warn('[passkeyService] Security notification dispatch failed:', notifyErr.message);
  }

  // Audit log
  createCriticalAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'AUTH_PASSKEY_REGISTERED',
    details: {
      passkeyId: newPasskey._id.toString(),
      deviceLabel: label,
      deviceType: credentialDeviceType,
      ip: clientIp
    }
  }).catch(() => {});

  return {
    id: newPasskey._id,
    credentialId: newPasskey.credentialId,
    deviceLabel: newPasskey.deviceLabel,
    deviceType: newPasskey.deviceType,
    createdAt: newPasskey.createdAt
  };
};

/**
 * Generates authentication options for passkey login.
 *
 * @param {object} req - Express request
 * @param {string} email - Optional identifier / email
 * @returns {Promise<object>} Authentication options
 */
export const generatePasskeyLoginOptionsService = async (req, email) => {
  const rpID = getRelyingPartyID(req);
  const expectedOrigin = getExpectedOrigin(req);
  const userVerification = getUserVerificationPolicy();

  let allowCredentials = undefined;
  let targetUserId = null;

  if (email && email.trim()) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { studentId: cleanEmail }]
    });

    if (user) {
      if (user.role !== 'superadmin') {
        throw new Error('Passkey authentication is currently provisioned exclusively for SuperAdmin accounts.');
      }
      targetUserId = user._id;
      const passkeys = await Passkey.find({ userId: user._id });
      if (passkeys.length > 0) {
        allowCredentials = passkeys.map((p) => ({
          id: p.credentialId,
          type: 'public-key',
          transports: p.transports || []
        }));
      }
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification
  });

  await WebAuthnChallenge.create({
    challenge: options.challenge,
    userId: targetUserId,
    purpose: 'authentication',
    expectedRPID: rpID,
    expectedOrigin,
    userVerification,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000)
  });

  return options;
};

/**
 * Verifies WebAuthn authentication response and returns authenticated SuperAdmin.
 *
 * @param {object} response - Authentication response from @simplewebauthn/browser
 * @param {object} req - Express request
 * @returns {Promise<{ verified: boolean, user: object }>}
 */
export const verifyPasskeyLoginService = async (response, req) => {
  if (!response || !response.id) {
    throw new Error('Invalid WebAuthn authentication payload.');
  }

  // 1. Locate registered passkey by credential ID
  const passkey = await Passkey.findOne({ credentialId: response.id });
  if (!passkey) {
    throw new Error('Unrecognized passkey credential. Please sign in with password.');
  }

  // 2. Locate associated user
  const user = await User.findById(passkey.userId);
  if (!user) {
    throw new Error('User associated with passkey credential not found.');
  }

  if (user.role !== 'superadmin') {
    throw new Error('Passkey login is restricted to SuperAdmin accounts.');
  }

  if (user.soft_deleted) {
    throw new Error('Administrative account is disabled.');
  }

  // 3. Verify security email binding
  if (!isSuperAdminSecurityEmailBound(user)) {
    throw new Error('SuperAdmin account must be bound and verified with the authorized security mailbox before using passkey login.');
  }

  // 4. Locate matching authentication challenge
  let clientChallenge = null;
  try {
    if (response.response && response.response.clientDataJSON) {
      const clientDataStr = Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8');
      const parsed = JSON.parse(clientDataStr);
      clientChallenge = parsed.challenge;
    }
  } catch (err) {}

  const query = {
    purpose: 'authentication',
    consumed: false,
    expiresAt: { $gt: new Date() }
  };
  if (clientChallenge) {
    query.challenge = clientChallenge;
  }

  const challengeDoc = await WebAuthnChallenge.findOne(query).sort({ createdAt: -1 });
  if (!challengeDoc) {
    throw new Error('Authentication challenge has expired or does not exist. Please try again.');
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeDoc.challenge,
      expectedOrigin: challengeDoc.expectedOrigin,
      expectedRPID: challengeDoc.expectedRPID,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports
      },
      requireUserVerification: challengeDoc.userVerification === 'required'
    });
  } catch (verErr) {
    throw new Error(`Passkey verification failed: ${verErr.message}`);
  }

  if (!verification.verified || !verification.authenticationInfo) {
    throw new Error('WebAuthn signature verification failed.');
  }

  const { newCounter } = verification.authenticationInfo;

  // 5. Clone / Replay Detection
  // If authenticator returns a counter that has not advanced (when counter > 0), suspect credential clone.
  if (passkey.counter > 0 && newCounter <= passkey.counter) {
    createCriticalAuditLog({
      tenantId: null,
      actor: { userId: user._id, role: user.role, email: user.email },
      action: 'AUTH_PASSKEY_CLONE_DETECTED',
      details: {
        passkeyId: passkey._id.toString(),
        storedCounter: passkey.counter,
        receivedCounter: newCounter,
        ip: req.ip
      }
    }).catch(() => {});

    throw new Error('Security Alert: Potential authenticator clone or replay attack detected. Login halted.');
  }

  // 6. Stage 3: Atomically consume challenge conditionally to prevent concurrency replay
  const now = new Date();
  const consumedChallenge = await WebAuthnChallenge.findOneAndUpdate(
    {
      _id: challengeDoc._id,
      challenge: challengeDoc.challenge,
      purpose: 'authentication',
      consumed: false,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        consumed: true,
        consumedAt: now
      }
    },
    { returnDocument: 'after' }
  );

  if (!consumedChallenge) {
    throw new Error('Authentication challenge has already been consumed or expired.');
  }

  passkey.counter = newCounter;
  passkey.lastUsedAt = now;
  await passkey.save();

  // Audit successful passkey login
  createAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'AUTH_PASSKEY_LOGIN_SUCCESS',
    details: { passkeyId: passkey._id.toString(), deviceLabel: passkey.deviceLabel }
  });

  return { verified: true, user };
};

/**
 * Lists all registered passkeys for an authorized user without leaking public-key material.
 *
 * @param {string} userId
 * @returns {Promise<Array<object>>}
 */
export const listUserPasskeysService = async (userId) => {
  const passkeys = await Passkey.find({ userId })
    .select('-publicKey')
    .sort({ createdAt: -1 })
    .lean();

  return passkeys.map((p) => ({
    id: p._id.toString(),
    credentialId: p.credentialId,
    deviceLabel: p.deviceLabel,
    deviceType: p.deviceType,
    backedUp: p.backedUp,
    transports: p.transports || [],
    createdAt: p.createdAt,
    lastUsedAt: p.lastUsedAt
  }));
};

/**
 * Removes a registered passkey after fresh re-authentication with another factor.
 *
 * @param {object} user - SuperAdmin user document
 * @param {string} passkeyId - MongoDB ID of passkey to delete
 * @param {{ currentPassword: string, secondFactorCode: string, recoveryToken?: string }} reauthData
 * @param {object} req - Express request
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const deleteUserPasskeyService = async (user, passkeyId, reauthData = {}, req) => {
  if (!user || user.role !== 'superadmin') {
    throw new Error('Passkey deletion is restricted to SuperAdmin accounts.');
  }

  const passkey = await Passkey.findOne({ _id: passkeyId, userId: user._id });
  if (!passkey) {
    throw new Error('Passkey credential not found.');
  }

  const { currentPassword, secondFactorCode } = reauthData;

  // Fresh authentication check: Must provide current password + valid second factor (TOTP or backup code)
  if (!currentPassword || !secondFactorCode) {
    throw new Error('Fresh re-authentication is required to remove a passkey. Please provide your current password and MFA code.');
  }

  // 1. Verify password
  const fullUser = await User.findById(user._id).select('+password +twoFactorSecret +twoFactorBackupCodes');
  const isPasswordValid = await bcrypt.compare(currentPassword, fullUser.password).catch(() => false);
  if (!isPasswordValid) {
    throw new Error('Re-authentication failed: Invalid current password.');
  }

  // 2. Verify second factor (TOTP or backup code)
  let isSecondFactorValid = false;
  if (fullUser.twoFactorSecret) {
    try {
      const plainSecret = decryptTotpSecret(fullUser.twoFactorSecret);
      isSecondFactorValid = speakeasy.totp.verify({
        secret: plainSecret,
        encoding: 'base32',
        token: secondFactorCode.trim(),
        window: 2
      });
    } catch (e) {}
  }

  if (!isSecondFactorValid && fullUser.twoFactorBackupCodes && fullUser.twoFactorBackupCodes.length > 0) {
    for (const hash of fullUser.twoFactorBackupCodes) {
      if (await bcrypt.compare(secondFactorCode.trim(), hash).catch(() => false)) {
        isSecondFactorValid = true;
        // Atomically consume used backup code
        await User.updateOne({ _id: fullUser._id }, { $pull: { twoFactorBackupCodes: hash } });
        break;
      }
    }
  }

  if (!isSecondFactorValid) {
    throw new Error('Re-authentication failed: Invalid second-factor code.');
  }

  // 3. Remove the passkey
  await Passkey.findByIdAndDelete(passkey._id);

  const clientIp = req?.ip || '127.0.0.1';

  // 4. Send security notification
  try {
    await sendPasskeySecurityNotification(getSuperAdminSecurityEmail(), {
      action: 'removed',
      deviceLabel: passkey.deviceLabel,
      ip: clientIp,
      timestamp: new Date()
    });
  } catch (notifyErr) {
    console.warn('[passkeyService] Deletion notification dispatch error:', notifyErr.message);
  }

  // 5. Audit log
  createCriticalAuditLog({
    tenantId: null,
    actor: { userId: user._id, role: 'superadmin', email: user.email },
    action: 'AUTH_PASSKEY_REMOVED',
    details: { passkeyId: passkey._id.toString(), deviceLabel: passkey.deviceLabel, ip: clientIp }
  }).catch(() => {});

  return { success: true, message: `Passkey "${passkey.deviceLabel}" was removed successfully.` };
};

export default {
  isSuperAdminSecurityEmailBound,
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistrationService,
  generatePasskeyLoginOptionsService,
  verifyPasskeyLoginService,
  listUserPasskeysService,
  deleteUserPasskeyService
};

