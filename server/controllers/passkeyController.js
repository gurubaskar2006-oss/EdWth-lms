/**
 * EdWth LMS — Passkey (WebAuthn) Controller
 * 6th Civilians Corporation
 *
 * Implements endpoints for:
 * - POST /api/v1/auth/passkeys/register/options
 * - POST /api/v1/auth/passkeys/register/verify
 * - POST /api/v1/auth/passkeys/login/options
 * - POST /api/v1/auth/passkeys/login/verify
 * - GET  /api/v1/auth/passkeys
 * - DELETE /api/v1/auth/passkeys/:id
 */

import {
  generatePasskeyRegistrationOptions,
  verifyPasskeyRegistrationService,
  generatePasskeyLoginOptionsService,
  verifyPasskeyLoginService,
  listUserPasskeysService,
  deleteUserPasskeyService
} from '../services/passkeyService.js';
import { setAuthCookie } from '../utils/cookieHelper.js';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/environment.js';
import { createSession } from '../services/sessionService.js';

const generateToken = (id, sessionId = null, timeoutMinutes = null) => {
  const payload = { id };
  if (sessionId) {
    payload.sessionId = sessionId;
  }
  const expiry = timeoutMinutes ? `${timeoutMinutes}m` : '120m';
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: expiry
  });
};

/**
 * Generates WebAuthn registration options for an authenticated SuperAdmin.
 */
export const getPasskeyRegistrationOptionsHandler = async (req, res) => {
  try {
    const options = await generatePasskeyRegistrationOptions(req.user, req);
    return res.status(200).json({ success: true, options });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Verifies WebAuthn registration and saves the new passkey credential.
 */
export const verifyPasskeyRegistrationHandler = async (req, res) => {
  try {
    const { response, deviceLabel } = req.body;
    if (!response) {
      return res.status(400).json({ success: false, message: 'Registration response payload is required.' });
    }

    const passkey = await verifyPasskeyRegistrationService(req.user, response, deviceLabel, req);
    return res.status(200).json({
      success: true,
      message: 'Passkey registered successfully.',
      passkey
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Generates WebAuthn authentication options for passkey sign-in.
 */
export const getPasskeyLoginOptionsHandler = async (req, res) => {
  try {
    const { email } = req.body;
    const options = await generatePasskeyLoginOptionsService(req, email);
    return res.status(200).json({ success: true, options });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Verifies WebAuthn authentication response and logs in the SuperAdmin.
 */
export const verifyPasskeyLoginHandler = async (req, res) => {
  try {
    const { response } = req.body;
    if (!response) {
      return res.status(400).json({ success: false, message: 'Authentication response payload is required.' });
    }

    const result = await verifyPasskeyLoginService(response, req);
    const user = result.user;

    const { sessionId, timeoutMinutes } = await createSession(user, req);
    const token = generateToken(user._id, sessionId, timeoutMinutes);
    setAuthCookie(res, token, timeoutMinutes);

    return res.status(200).json({
      success: true,
      token,
      message: 'Passkey authentication successful.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        studentId: user.studentId,
        role: user.role,
        tenantId: user.tenantId,
        isTwoFactorEnabled: !!user.isTwoFactorEnabled,
        mfaEnforced: !!user.mfaEnforced,
        mfaSetupRequired: false
      }
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message });
  }
};

/**
 * Lists registered passkeys for the authenticated SuperAdmin.
 */
export const listPasskeysHandler = async (req, res) => {
  try {
    const passkeys = await listUserPasskeysService(req.user._id);
    return res.status(200).json({ success: true, passkeys });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Deletes a registered passkey after fresh re-authentication.
 */
export const deletePasskeyHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, secondFactorCode } = req.body;

    const result = await deleteUserPasskeyService(
      req.user,
      id,
      { currentPassword, secondFactorCode },
      req
    );

    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export default {
  getPasskeyRegistrationOptionsHandler,
  verifyPasskeyRegistrationHandler,
  getPasskeyLoginOptionsHandler,
  verifyPasskeyLoginHandler,
  listPasskeysHandler,
  deletePasskeyHandler
};

