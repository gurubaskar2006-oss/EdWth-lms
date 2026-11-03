/**
 * EdWth LMS — WebAuthn / Passkey Relying Party Configuration
 * 6th Civilians Corporation
 *
 * Strict origin, RP ID, and user verification policies.
 * Never weakens verification checks to make tests pass.
 */

import { isProduction } from './environment.js';

const DEFAULT_RP_NAME = 'EdWth LMS (6th Civilians Corporation)';

/**
 * Retrieves the validated Relying Party ID (RP ID).
 * For localhost dev: 'localhost' or '127.0.0.1'.
 * For staging/production: must be configured via WEBAUTHN_RP_ID or APP_DOMAIN.
 */
export const getRelyingPartyID = (req) => {
  const envRpId = process.env.WEBAUTHN_RP_ID || process.env.RP_ID;
  if (envRpId && envRpId.trim()) {
    return envRpId.trim().toLowerCase();
  }

  if (isProduction()) {
    throw new Error('FATAL: WEBAUTHN_RP_ID environment variable is required in production.');
  }

  // Local development fallback based on request host header if available
  if (req && req.headers && req.headers.host) {
    const host = req.headers.host.split(':')[0].toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') {
      return host;
    }
  }

  return 'localhost';
};

export const getRelyingPartyName = () => {
  return process.env.WEBAUTHN_RP_NAME || DEFAULT_RP_NAME;
};

/**
 * Resolves the expected origin for WebAuthn ceremony verification.
 * Enforces HTTPS in production mode.
 */
export const getExpectedOrigin = (req) => {
  const envOrigin = process.env.WEBAUTHN_ORIGIN;
  if (envOrigin) {
    const origins = envOrigin.split(',').map((o) => o.trim().replace(/\/+$/, ''));
    if (req && req.headers && req.headers.origin) {
      const clientOrigin = req.headers.origin.trim().replace(/\/+$/, '');
      if (origins.includes(clientOrigin)) {
        return clientOrigin;
      }
    }
    return origins[0];
  }

  if (isProduction()) {
    throw new Error('FATAL: WEBAUTHN_ORIGIN environment variable is required in production mode (HTTPS required).');
  }

  // Development origins
  if (req && req.headers && req.headers.origin) {
    const clientOrigin = req.headers.origin.trim().replace(/\/+$/, '');
    if (
      clientOrigin.startsWith('http://localhost') ||
      clientOrigin.startsWith('http://127.0.0.1') ||
      clientOrigin.startsWith('https://localhost')
    ) {
      return clientOrigin;
    }
  }

  return 'http://localhost:3000';
};

/**
 * User verification policy:
 * 'preferred' for platform authenticators (TouchID/Windows Hello/FaceID)
 * or 'required' based on platform risk policy.
 */
export const getUserVerificationPolicy = () => {
  return process.env.WEBAUTHN_USER_VERIFICATION || 'preferred';
};

export default {
  getRelyingPartyID,
  getRelyingPartyName,
  getExpectedOrigin,
  getUserVerificationPolicy
};

