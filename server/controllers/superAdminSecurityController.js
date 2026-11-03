/**
 * EdWth LMS — SuperAdmin Security Email & Recovery Controller
 * 6th Civilians Corporation
 *
 * Implements endpoints for:
 * - GET  /api/v1/auth/superadmin/security-email/status
 * - POST /api/v1/auth/superadmin/security-email/send-otp
 * - POST /api/v1/auth/superadmin/security-email/verify-otp
 * - POST /api/v1/auth/recovery/request
 * - POST /api/v1/auth/recovery/verify
 */

import {
  getSecurityEmailBindingStatus,
  sendSecurityEmailBindingOtp,
  verifySecurityEmailBindingOtp,
  requestSuperAdminRecovery,
  verifySuperAdminRecoveryToken
} from '../services/superAdminSecurityService.js';
import User from '../models/User.js';
import { clearAuthCookie } from '../utils/cookieHelper.js';

/**
 * Returns security email binding status for the authenticated SuperAdmin.
 */
export const getSecurityEmailStatusHandler = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'SuperAdmin authorization required.' });
    }

    const status = getSecurityEmailBindingStatus(user);
    return res.status(200).json({ success: true, status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Sends a binding OTP to the authorized SuperAdmin security mailbox.
 */
export const sendSecurityEmailOtpHandler = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'SuperAdmin authorization required.' });
    }

    const result = await sendSecurityEmailBindingOtp(user);
    return res.status(200).json(result);
  } catch (err) {
    const statusCode = err.code === 'EMAIL_PROVIDER_NOT_CONFIGURED' ? 503 : 400;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'OTP_DISPATCH_ERROR',
      message: err.message
    });
  }
};

/**
 * Verifies the binding OTP and binds the account to the authorized security email.
 */
export const verifySecurityEmailOtpHandler = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await User.findById(req.user._id);
    if (!user || user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'SuperAdmin authorization required.' });
    }

    const result = await verifySecurityEmailBindingOtp(user, code);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Initiates an account recovery request for a SuperAdmin who lost passkeys.
 */
export const requestRecoveryHandler = async (req, res) => {
  try {
    const { identifier } = req.body;
    const result = await requestSuperAdminRecovery(identifier, req);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      success: true,
      message: 'If an authorized administrative account exists, recovery instructions have been dispatched to the registered security mailbox.'
    });
  }
};

/**
 * Verifies a single-use recovery token and issues a restricted recovery session token.
 */
export const verifyRecoveryHandler = async (req, res) => {
  try {
    const { token } = req.body;
    const result = await verifySuperAdminRecoveryToken(token, req);
    if (result && result.success) {
      clearAuthCookie(res);
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export default {
  getSecurityEmailStatusHandler,
  sendSecurityEmailOtpHandler,
  verifySecurityEmailOtpHandler,
  requestRecoveryHandler,
  verifyRecoveryHandler
};

