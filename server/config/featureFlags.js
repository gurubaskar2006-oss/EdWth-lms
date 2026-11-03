/**
 * EdWth LMS — Authentication & Passkey Feature Flags
 * 6th Civilians Corporation
 *
 * Safe Migration Safeguard:
 * Default new production features to DISABLED until a separately approved rollout.
 * Local development and test environments enable features for testing.
 */

import { isProduction } from './environment.js';

export const getFeatureFlags = () => {
  const prod = isProduction();

  return {
    // Passkey WebAuthn Registration
    passkeyRegistration: process.env.ENABLE_PASSKEY_REGISTRATION === 'true' ||
      (!prod && process.env.ENABLE_PASSKEY_REGISTRATION !== 'false'),

    // Passkey WebAuthn Login
    passkeyLogin: process.env.ENABLE_PASSKEY_LOGIN === 'true' ||
      (!prod && process.env.ENABLE_PASSKEY_LOGIN !== 'false'),

    // SuperAdmin Email OTP Step-up
    superAdminEmailOtp: process.env.ENABLE_SUPERADMIN_EMAIL_OTP === 'true' ||
      (!prod && process.env.ENABLE_SUPERADMIN_EMAIL_OTP !== 'false'),

    // SuperAdmin Account Recovery
    emailRecovery: process.env.ENABLE_EMAIL_RECOVERY === 'true' ||
      (!prod && process.env.ENABLE_EMAIL_RECOVERY !== 'false')
  };
};

export const requireFeatureFlag = (flagName) => {
  return (req, res, next) => {
    const flags = getFeatureFlags();
    if (!flags[flagName]) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_DISABLED',
        message: `The requested capability (${flagName}) is currently disabled by platform security policy.`
      });
    }
    next();
  };
};

export default {
  getFeatureFlags,
  requireFeatureFlag
};

