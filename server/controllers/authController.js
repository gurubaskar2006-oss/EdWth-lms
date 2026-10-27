import User from '../models/User.js';
import College from '../models/College.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { createAuditLog, createCriticalAuditLog } from '../utils/auditLogger.js';
import { getJwtSecret } from '../config/environment.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookieHelper.js';
import { decryptTotpSecret, encryptTotpSecret, isEncrypted } from '../utils/mfaCrypto.js';

/**
 * Escape special characters before using user input in a MongoDB $regex.
 * Without this, an attacker can craft input that causes catastrophic backtracking (ReDoS).
 * Example: identifier = "((((((((…" could hang the Node.js event loop.
 */
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const generateToken = (id) => {
  return jwt.sign({ id }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

export const login = async (req, res) => {
  const identifier = req.body.identifier || req.body.email;
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/ID and Password are required.' });
  }

  const cleanId = identifier.trim().toLowerCase();

  try {
    if (process.env.NODE_ENV === 'production' && mongoose.connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Database offline: Cannot run in mock mode in production' });
    }

    let user = null;
    let isMatch = false;

    if (mongoose.connection.readyState === 1) {
      try {
        // SECURITY: Escape cleanId before using in $regex to prevent ReDoS attacks.
        // Never pass raw user input directly into a MongoDB regex pattern.
        const escapedId = escapeRegex(cleanId);
        user = await User.findOne({
          $or: [
            { email:     { $regex: new RegExp(`^${escapedId}$`, 'i') } },
            { studentId: { $regex: new RegExp(`^${escapedId}$`, 'i') } }
          ]
        });
      } catch (dbErr) {
        console.warn('DB query failed, attempting datasheet fallback:', dbErr.message);
      }
    }

    // Fallback: If DB query returned nothing or DB is offline (DEV/TEST ONLY, requires explicit opt-in)
    if (!user && process.env.NODE_ENV !== 'production' && process.env.ENABLE_LEGACY_DATASHEET_FALLBACK === 'true') {
      const { getStudents } = await import('../database/db.js');
      const localStudents = getStudents();
      // SECURITY: Use exact string comparison for fallback users — no regex needed
      const matched = localStudents.find(s =>
        (s.email?.toLowerCase() === cleanId || s.studentId?.toLowerCase() === cleanId)
      );

      if (matched) {
        user = {
          _id: matched.id || matched.studentId,
          name: matched.name,
          email: matched.email,
          studentId: matched.studentId,
          role: (matched.role || 'student').toLowerCase(),
          password: matched.password,
          isTwoFactorEnabled: false,
          tenantId: matched.tenantId || '650000000000000000000001'
        };
        isMatch = (matched.password === password) || (await bcrypt.compare(password, matched.password).catch(() => false));
      }
    } else if (user) {
      if (user.soft_deleted) {
        return res.status(401).json({ success: false, message: 'Account is disabled.' });
      }
      isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      if (!isMatch && process.env.NODE_ENV !== 'production' && user.password === password) {
        // Plaintext match allowed only for legacy non-production dev seeds
        isMatch = true;
      }
    }

    if (!user || !isMatch) {
      // CRITICAL security event: failed login attempt must always be audited
      createAuditLog({
        tenantId: user?.tenantId || null,
        actor: { userId: user?._id, role: user?.role || 'unknown', email: cleanId },
        action: 'AUTH_LOGIN_FAILED',
        details: { identifier: cleanId, reason: !user ? 'user_not_found' : 'invalid_password' }
      });
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (user.isTwoFactorEnabled) {
      const preAuthToken = jwt.sign(
        { id: user._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );
      return res.status(200).json({ success: true, requires2FA: true, preAuthToken });
    }

    if (typeof user.save === 'function') {
      user.lastLogin = new Date();
      await user.save().catch(() => {});
    }

    const token = generateToken(user._id);

    // Standard audit event: successful login (async, non-critical)
    createAuditLog({
      tenantId: user.tenantId || null,
      actor: { userId: user._id, role: user.role, email: user.email },
      action: 'AUTH_LOGIN_SUCCESS',
      details: { method: 'password' }
    });

    // Set cookie using synchronized cookie helper
    setAuthCookie(res, token);

    let institutionType = 'college';
    let tenantName = 'Lumina Portal';
    if (user.tenantId && mongoose.connection.readyState === 1) {
      try {
        const tenant = await College.findById(user.tenantId).select('name code institutionType').lean();
        if (tenant) {
          institutionType = tenant.institutionType || 'college';
          tenantName = tenant.name || tenantName;
        }
      } catch (tenantErr) {
        console.warn('[AuthController] Failed to lookup tenant:', tenantErr.message);
      }
    }

    res.status(200).json({
      success: true,
      token,
      mustChangePassword: !!user.mustChangePassword,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        role: user.role,
        batchId: user.batchId || null,
        mustChangePassword: !!user.mustChangePassword,
        tenantId: user.tenantId,
        institutionType,
        tenantName,
        isTwoFactorEnabled: !!user.isTwoFactorEnabled,
        mfaEnforced: !!user.mfaEnforced,
        mfaSetupRequired: !!user.mfaSetupRequired
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const resetPassword = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct password reset is disabled. Please contact your educator/teacher or institution administrator for password recovery.'
  });
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters long.'
    });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'New password and confirmation do not match.'
    });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // If the user is NOT in forced change mode, verify their current password
    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required.'
        });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password).catch(() => false);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Current password does not match.'
        });
      }
    }

    const previousPassword = user.password;
    const previousMustChange = user.mustChangePassword;

    // Hash new password using bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.mustChangePassword = false;
    await user.save();

    // Critical audit log — NEVER log the password itself
    try {
      await createCriticalAuditLog({
        tenantId: user.tenantId || null,
        actor: { userId: user._id, role: user.role, email: user.email },
        action: 'AUTH_PASSWORD_CHANGED',
        targetRecord: user._id,
        targetModel: 'User'
      });
    } catch (auditErr) {
      console.error('[AuthController] Audit log failed for password change:', auditErr.message);
      // Fail-closed rollback: revert password and flag to maintain audit integrity
      try {
        user.password = previousPassword;
        user.mustChangePassword = previousMustChange;
        await user.save();
      } catch (rollbackErr) {
        console.error(`[CRITICAL UNRESOLVED STATE] Password change audit failed (${auditErr.message}) and rollback failed (${rollbackErr.message}) for user ${user._id}`);
      }
      return res.status(500).json({
        success: false,
        message: 'Security audit logging failed. Password change could not be completed.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Password updated successfully.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTenants = async (req, res) => {
  try {
    const tenants = await College.find({ status: 'active' }).select('name code institutionType address').lean();
    return res.status(200).json({ success: true, tenants });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      let institutionType = 'college';
      let tenantName = 'Lumina Portal';
      if (user.tenantId && mongoose.connection.readyState === 1) {
        try {
          const tenant = await College.findById(user.tenantId).select('name code institutionType').lean();
          if (tenant) {
            institutionType = tenant.institutionType || 'college';
            tenantName = tenant.name || tenantName;
          }
        } catch (tErr) {
          console.warn('[AuthController] Failed to lookup tenant in getProfile:', tErr.message);
        }
      }
      const userObj = user.toObject ? user.toObject() : { ...user._doc };
      userObj.institutionType = institutionType;
      userObj.tenantName = tenantName;
      res.json({ success: true, user: userObj });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // 1. Strictly forbid company-managed & protected fields
    const companyManagedFields = [
      '_id',
      'id',
      'tenantId',
      'tenant',
      'studentId',
      'role',
      'name',
      'email',
      'password',
      'batchId',
      'major',
      'department',
      'university',
      'year',
      'enrolledCourses',
      'grades',
      'attendance',
      'stats',
      'xp',
      'streakDays',
      'level',
      'status',
      'accountStatus',
      'isTwoFactorEnabled',
      'mfaEnforced',
      'mfaSetupRequired',
      'mustChangePassword',
      'twoFactorSecret',
      'twoFactorBackupCodes',
      'pendingTwoFactorSecret',
      'pendingTwoFactorBackupCodes',
      'pendingTwoFactorCreatedAt',
      'soft_deleted',
      'joinedDate',
      'lastLogin',
      'createdAt',
      'updatedAt'
    ];

    const attemptedCompanyFields = companyManagedFields.filter(
      (field) => req.body[field] !== undefined
    );

    if (attemptedCompanyFields.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'FORBIDDEN_PROFILE_FIELD',
        message: `Modification of company-managed field(s) is prohibited: ${attemptedCompanyFields.join(', ')}. Name, email, academic status, grades, and credentials are maintained by 6th Civilians Corporation operations.`
      });
    }

    // 2. Validate permitted personal contact fields
    const allowedUpdates = {};
    const PHONE_REGEX = /^[\d\s+\-().]{7,25}$/;

    if (req.body.phone !== undefined) {
      if (typeof req.body.phone !== 'string') {
        return res.status(400).json({ success: false, message: 'Phone number must be a valid string.' });
      }
      const trimmedPhone = req.body.phone.trim();
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid phone number (7-25 digits, +, -, () permitted).' });
      }
      allowedUpdates.phone = trimmedPhone;
    }

    if (req.body.address !== undefined) {
      if (typeof req.body.address !== 'string') {
        return res.status(400).json({ success: false, message: 'Address must be a string.' });
      }
      const trimmedAddress = req.body.address.trim();
      if (trimmedAddress.length > 300) {
        return res.status(400).json({ success: false, message: 'Address cannot exceed 300 characters.' });
      }
      allowedUpdates.address = trimmedAddress;
    }

    if (req.body.emergencyContact !== undefined) {
      if (typeof req.body.emergencyContact !== 'object' || req.body.emergencyContact === null || Array.isArray(req.body.emergencyContact)) {
        return res.status(400).json({ success: false, message: 'Emergency contact must be an object with name and phone.' });
      }
      const { name, phone, relationship } = req.body.emergencyContact;
      const sanitizedContact = {};

      if (name !== undefined) {
        if (typeof name !== 'string') {
          return res.status(400).json({ success: false, message: 'Emergency contact name must be a string.' });
        }
        sanitizedContact.name = name.trim();
      }

      if (phone !== undefined) {
        if (typeof phone !== 'string') {
          return res.status(400).json({ success: false, message: 'Emergency contact phone must be a string.' });
        }
        const trimmedContactPhone = phone.trim();
        if (trimmedContactPhone && !PHONE_REGEX.test(trimmedContactPhone)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid emergency contact phone number.' });
        }
        sanitizedContact.phone = trimmedContactPhone;
      }

      if (relationship !== undefined) {
        if (typeof relationship !== 'string') {
          return res.status(400).json({ success: false, message: 'Emergency contact relationship must be a string.' });
        }
        sanitizedContact.relationship = relationship.trim();
      }

      for (const [k, v] of Object.entries(sanitizedContact)) {
        allowedUpdates[`emergencyContact.${k}`] = v;
      }
    }

    if (req.body.avatar !== undefined) {
      if (typeof req.body.avatar !== 'string') {
        return res.status(400).json({ success: false, message: 'Avatar must be a string URL.' });
      }
      allowedUpdates.avatar = req.body.avatar.trim();
    }

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No permitted profile fields provided to update.'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret -twoFactorBackupCodes');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    // Audit log (never leak PII like phone or address in details)
    createAuditLog({
      tenantId: updatedUser.tenantId || null,
      actor: { userId: updatedUser._id, role: updatedUser.role, email: updatedUser.email },
      action: 'USER_PROFILE_SELF_UPDATED',
      details: { updatedFields: Object.keys(allowedUpdates) }
    });

    let institutionType = 'college';
    let tenantName = 'Lumina Portal';
    if (updatedUser.tenantId && mongoose.connection.readyState === 1) {
      try {
        const tenant = await College.findById(updatedUser.tenantId).select('name code institutionType').lean();
        if (tenant) {
          institutionType = tenant.institutionType || 'college';
          tenantName = tenant.name || tenantName;
        }
      } catch (tErr) {}
    }

    const userObj = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser._doc };
    userObj.institutionType = institutionType;
    userObj.tenantName = tenantName;

    return res.status(200).json({
      success: true,
      message: 'Student profile updated successfully.',
      user: userObj
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const setup2FA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      '+password +twoFactorSecret +twoFactorBackupCodes +pendingTwoFactorSecret +pendingTwoFactorBackupCodes'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // REAUTHENTICATION GATEWAY: If user is already enrolled, block silent replacement!
    if (user.isTwoFactorEnabled) {
      const currentPassword = req.body.currentPassword || req.body.password;
      const currentToken = (
        req.body.currentToken ||
        req.body.currentCode ||
        req.body.currentOtp ||
        req.body.code ||
        req.body.token ||
        req.body.backupCode ||
        ''
      ).trim();

      if (!currentPassword || !currentToken) {
        return res.status(403).json({
          success: false,
          code: 'MFA_ALREADY_ENROLLED',
          message: 'Two-factor authentication is already enrolled for this account. Current password and active MFA code (or recovery backup code) are required to reconfigure MFA.'
        });
      }

      // 1. Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password).catch(() => false);
      if (!isPasswordValid) {
        createAuditLog({
          tenantId: user.tenantId || null,
          actor: { userId: user._id, role: user.role, email: user.email },
          action: 'AUTH_2FA_RECONFIG_FAILED',
          details: { reason: 'invalid_password' }
        });
        return res.status(401).json({ success: false, message: 'Current password verification failed.' });
      }

      // 2. Verify current second factor (either active TOTP or active backup code)
      let isSecondFactorValid = false;
      let usedBackupHash = null;

      if (user.twoFactorSecret) {
        try {
          const plainActiveSecret = decryptTotpSecret(user.twoFactorSecret);
          isSecondFactorValid = speakeasy.totp.verify({
            secret: plainActiveSecret,
            encoding: 'base32',
            token: currentToken,
            window: 1
          });
        } catch (decErr) {
          console.error('[setup2FA] Decrypt error on active secret:', decErr.message);
        }
      }

      if (!isSecondFactorValid && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
        for (const codeHash of user.twoFactorBackupCodes) {
          const isCodeMatch = await bcrypt.compare(currentToken, codeHash).catch(() => false);
          if (isCodeMatch) {
            isSecondFactorValid = true;
            usedBackupHash = codeHash;
            break;
          }
        }
      }

      if (!isSecondFactorValid) {
        createAuditLog({
          tenantId: user.tenantId || null,
          actor: { userId: user._id, role: user.role, email: user.email },
          action: 'AUTH_2FA_RECONFIG_FAILED',
          details: { reason: 'invalid_second_factor' }
        });
        return res.status(401).json({ success: false, message: 'Invalid current two-factor authentication or backup code.' });
      }

      // Re-authentication verified: Stage replacement without disabling existing MFA
      const secret = speakeasy.generateSecret({ name: `EdWth LMS (${user.email})`, issuer: 'EdWth Academy' });
      const backupCodes = Array.from({ length: 5 }, () => crypto.randomBytes(4).toString('hex'));
      const hashedCodes = await Promise.all(backupCodes.map(code => bcrypt.hash(code, 12)));

      user.pendingTwoFactorSecret = encryptTotpSecret(secret.base32);
      user.pendingTwoFactorBackupCodes = hashedCodes;
      user.pendingTwoFactorCreatedAt = new Date();

      // If a backup code was used for re-authentication, consume it atomically
      if (usedBackupHash) {
        await User.updateOne({ _id: user._id }, { $pull: { twoFactorBackupCodes: usedBackupHash } });
        user.twoFactorBackupCodes = user.twoFactorBackupCodes.filter(h => h !== usedBackupHash);
      }

      // CRITICAL: user.isTwoFactorEnabled remains true!
      // Active secret and active backup codes remain valid until the replacement is verified!
      await user.save();

      createAuditLog({
        tenantId: user.tenantId || null,
        actor: { userId: user._id, role: user.role, email: user.email },
        action: 'AUTH_2FA_RECONFIG_INITIATED',
        details: { method: usedBackupHash ? 'recovery_code' : 'totp' }
      });

      qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
        if (err) return res.status(500).json({ success: false, message: 'QR Generation failed' });
        res.json({
          success: true,
          secret: secret.base32,
          qrCode: data_url,
          backupCodes,
          isReconfiguration: true
        });
      });
      return;
    }

    // INITIAL ENROLLMENT FLOW (user.isTwoFactorEnabled === false)
    const secret = speakeasy.generateSecret({ name: `EdWth LMS (${user.email})`, issuer: 'EdWth Academy' });
    const backupCodes = Array.from({ length: 5 }, () => crypto.randomBytes(4).toString('hex'));
    const hashedCodes = await Promise.all(backupCodes.map(code => bcrypt.hash(code, 12)));

    // Store encrypted TOTP secret at rest
    user.twoFactorSecret = encryptTotpSecret(secret.base32);
    user.twoFactorBackupCodes = hashedCodes;
    user.isTwoFactorEnabled = false;
    user.pendingTwoFactorSecret = undefined;
    user.pendingTwoFactorBackupCodes = undefined;
    user.pendingTwoFactorCreatedAt = undefined;

    await user.save();

    qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) return res.status(500).json({ success: false, message: 'QR Generation failed' });
      res.json({
        success: true,
        secret: secret.base32,
        qrCode: data_url,
        backupCodes,
        isReconfiguration: false
      });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verify2FA = async (req, res) => {
  const { preAuthToken } = req.body;
  const userToken = (req.body.token || req.body.code || '').trim();

  if (!userToken) {
    return res.status(400).json({ success: false, message: 'Verification code is required.' });
  }

  try {
    let userId = null;
    let isPreAuth = false;

    // 1. Identify user from either preAuthToken (login flow) or session JWT/Bearer token (enrollment flow)
    if (preAuthToken) {
      try {
        const decoded = jwt.verify(preAuthToken, getJwtSecret());
        if (decoded.preAuth) {
          userId = decoded.id;
          isPreAuth = true;
        }
      } catch (tokenErr) {
        return res.status(401).json({ success: false, message: 'Invalid or expired preAuthToken.' });
      }
    }

    if (!userId) {
      // Check for Bearer token or cookie if authenticated session
      let sessionToken = null;
      if (req.cookies && (req.cookies.jwt || req.cookies.token)) {
        sessionToken = req.cookies.jwt || req.cookies.token;
      } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        sessionToken = req.headers.authorization.split(' ')[1];
      }

      if (sessionToken) {
        try {
          const decodedSession = jwt.verify(sessionToken, getJwtSecret());
          userId = decodedSession.id;
        } catch {
          // invalid session token
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication or preAuthToken required for 2FA verification.' });
    }

    const user = await User.findById(userId).select(
      '+password +twoFactorSecret +twoFactorBackupCodes +pendingTwoFactorSecret +pendingTwoFactorBackupCodes'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!user.twoFactorSecret && !user.pendingTwoFactorSecret) {
      return res.status(400).json({ success: false, message: '2FA has not been initiated for this account. Run setup first.' });
    }

    let isValid = false;
    let isPendingRotation = false;

    // STEP 1: If user has a pending replacement secret, verify against it
    if (user.pendingTwoFactorSecret) {
      try {
        const pendingPlain = decryptTotpSecret(user.pendingTwoFactorSecret);
        if (speakeasy.totp.verify({ secret: pendingPlain, encoding: 'base32', token: userToken, window: 1 })) {
          isValid = true;
          isPendingRotation = true;
        }
      } catch (err) {
        console.error('[verify2FA] Error decrypting pending secret:', err.message);
      }
    }

    // STEP 2: If not verified against pending secret, verify against active twoFactorSecret
    if (!isValid && user.twoFactorSecret) {
      try {
        const activePlain = decryptTotpSecret(user.twoFactorSecret);
        if (speakeasy.totp.verify({ secret: activePlain, encoding: 'base32', token: userToken, window: 1 })) {
          isValid = true;
          // Transparent in-place migration to encrypted secret if stored as legacy plaintext
          if (!isEncrypted(user.twoFactorSecret)) {
            user.twoFactorSecret = encryptTotpSecret(activePlain);
            await user.save().catch(e => console.error('[verify2FA] Encryption migration save error:', e.message));
          }
        }
      } catch (err) {
        console.error('[verify2FA] Error decrypting active secret:', err.message);
      }
    }

    // STEP 3: If TOTP fails and user is already 2FA enabled, check backup codes (only during login or normal verification)
    if (!isValid && user.isTwoFactorEnabled && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
      let matchedHash = null;
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        const isMatch = await bcrypt.compare(userToken, user.twoFactorBackupCodes[i]).catch(() => false);
        if (isMatch) {
          matchedHash = user.twoFactorBackupCodes[i];
          break;
        }
      }
      if (matchedHash) {
        // ATOMIC SINGLE-USE CONSUMPTION:
        // Atomically pull the matched code hash from MongoDB.
        // If concurrent requests attempt to consume the same code, only one findOneAndUpdate succeeds.
        const atomicConsume = await User.findOneAndUpdate(
          { _id: user._id, twoFactorBackupCodes: matchedHash },
          { $pull: { twoFactorBackupCodes: matchedHash } },
          { returnDocument: 'after', select: '+twoFactorBackupCodes' }
        );
        if (atomicConsume) {
          isValid = true;
          user.twoFactorBackupCodes = atomicConsume.twoFactorBackupCodes;
        } else {
          // Concurrent race condition: code was already consumed by an overlapping request
          isValid = false;
        }
      }
    }

    if (!isValid) {
      // CRITICAL: 2FA failures must always be audited
      createAuditLog({
        tenantId: user.tenantId || null,
        actor: { userId: user._id, role: user.role, email: user.email },
        action: user.isTwoFactorEnabled ? 'AUTH_2FA_FAILED' : 'AUTH_2FA_ENROLLMENT_FAILED',
        details: { reason: 'invalid_token' }
      });
      return res.status(401).json({ success: false, message: 'Invalid 2FA code.' });
    }

    // STATE TRANSITION A: Activating a rotated replacement secret
    if (isPendingRotation) {
      user.twoFactorSecret = user.pendingTwoFactorSecret;
      user.twoFactorBackupCodes = user.pendingTwoFactorBackupCodes;
      user.pendingTwoFactorSecret = undefined;
      user.pendingTwoFactorBackupCodes = undefined;
      user.pendingTwoFactorCreatedAt = undefined;
      user.isTwoFactorEnabled = true;
      user.mfaSetupRequired = false;
      await user.save();

      try {
        await createCriticalAuditLog({
          tenantId: user.tenantId || null,
          actor: { userId: user._id, role: user.role, email: user.email },
          action: 'AUTH_2FA_REPLACED',
          details: { method: 'totp_verified' }
        });
      } catch (auditErr) {
        console.error('[AuthController] Audit failed for 2FA replacement:', auditErr.message);
      }

      const finalJwt = generateToken(user._id);
      setAuthCookie(res, finalJwt);

      return res.status(200).json({
        success: true,
        token: finalJwt,
        isTwoFactorEnabled: true,
        message: 'Two-factor authentication secret successfully rotated and verified.',
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          mustChangePassword: !!user.mustChangePassword,
          tenantId: user.tenantId,
          isTwoFactorEnabled: true,
          mfaEnforced: !!user.mfaEnforced,
          mfaSetupRequired: false
        }
      });
    }

    // STATE TRANSITION B: Initial enrollment verification
    if (!user.isTwoFactorEnabled) {
      user.isTwoFactorEnabled = true;
      user.mfaSetupRequired = false;
      user.pendingTwoFactorSecret = undefined;
      user.pendingTwoFactorBackupCodes = undefined;
      user.pendingTwoFactorCreatedAt = undefined;
      await user.save();

      try {
        await createCriticalAuditLog({
          tenantId: user.tenantId || null,
          actor: { userId: user._id, role: user.role, email: user.email },
          action: 'AUTH_2FA_ENABLED',
          details: { method: 'totp_verified' }
        });
      } catch (auditErr) {
        console.error('[AuthController] CRITICAL audit failed for 2FA activation:', auditErr.message);
        // Fail-closed rollback
        try {
          user.isTwoFactorEnabled = false;
          user.mfaSetupRequired = true;
          await user.save();
        } catch (rollbackErr) {
          console.error(`[CRITICAL UNRESOLVED STATE] 2FA activation audit failed (${auditErr.message}) and rollback failed (${rollbackErr.message}) for user ${user._id}`);
        }
        return res.status(500).json({
          success: false,
          message: 'Security audit logging failed. Two-factor activation aborted.'
        });
      }

      const finalJwt = generateToken(user._id);
      setAuthCookie(res, finalJwt);

      return res.status(200).json({
        success: true,
        token: finalJwt,
        isTwoFactorEnabled: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          studentId: user.studentId,
          role: user.role,
          mustChangePassword: !!user.mustChangePassword,
          tenantId: user.tenantId,
          isTwoFactorEnabled: true,
          mfaEnforced: !!user.mfaEnforced,
          mfaSetupRequired: false
        },
        message: 'Two-factor authentication successfully verified and activated.'
      });
    }

    // STATE TRANSITION C: Login flow verification for existing 2FA enabled users
    await User.updateOne({ _id: user._id }, { lastLogin: new Date() });

    // Standard: 2FA success audit (async)
    createAuditLog({
      tenantId: user.tenantId || null,
      actor: { userId: user._id, role: user.role, email: user.email },
      action: 'AUTH_LOGIN_SUCCESS',
      details: { method: '2fa' }
    });

    const finalJwt = generateToken(user._id);

    // Set cookie using synchronized cookie helper
    setAuthCookie(res, finalJwt);

    return res.status(200).json({
      success: true,
      token: finalJwt,
      mustChangePassword: !!user.mustChangePassword,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        role: user.role,
        mustChangePassword: !!user.mustChangePassword,
        tenantId: user.tenantId
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Token verification failed.' });
  }
};
