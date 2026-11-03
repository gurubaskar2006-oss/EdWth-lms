/**
 * Lumina LMS — Auth Routes
 * 6th Civilians Corporation
 *
 * Rate limiting:
 *   - login          → loginRateLimiter         (fail-closed in production)
 *   - 2FA verify     → twofaRateLimiter          (fail-closed in production)
 *   - reset-password → passwordResetRateLimiter  (fail-closed in production)
 *
 * The old express-rate-limit (per-process, non-distributed) is replaced by
 * the Redis-backed rateLimitMiddleware that correctly handles horizontal scaling.
 */

import express from 'express';
import { login, logout, getProfile, updateProfile, resetPassword, changePassword, setup2FA, verify2FA, getTenants } from '../controllers/authController.js';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import {
  loginRateLimiter,
  twofaRateLimiter,
  passwordResetRateLimiter
} from '../middleware/rateLimitMiddleware.js';
import { requireFeatureFlag } from '../config/featureFlags.js';
import {
  getPasskeyRegistrationOptionsHandler,
  verifyPasskeyRegistrationHandler,
  getPasskeyLoginOptionsHandler,
  verifyPasskeyLoginHandler,
  listPasskeysHandler,
  deletePasskeyHandler
} from '../controllers/passkeyController.js';
import {
  getSecurityEmailStatusHandler,
  sendSecurityEmailOtpHandler,
  verifySecurityEmailOtpHandler,
  requestRecoveryHandler,
  verifyRecoveryHandler
} from '../controllers/superAdminSecurityController.js';

const router = express.Router();

router.get('/tenants',          getTenants);
router.post('/login',           loginRateLimiter,         login);
router.post('/logout',                                    logout);
router.post('/reset-password',  passwordResetRateLimiter, resetPassword);
router.post('/change-password', verifyToken,              changePassword);
router.get( '/profile',         verifyToken,              getProfile);
router.put( '/profile',         verifyToken,              updateProfile);

// 2FA Routes (TOTP & Backup Codes)
router.post('/2fa/setup',  verifyToken, twofaRateLimiter, setup2FA);
router.post('/2fa/verify', twofaRateLimiter, verify2FA);

// SuperAdmin Passkey (WebAuthn) Routes
router.post('/passkeys/register/options', verifyToken, requireRole('superadmin'), requireFeatureFlag('passkeyRegistration'), twofaRateLimiter, getPasskeyRegistrationOptionsHandler);
router.post('/passkeys/register/verify',  verifyToken, requireRole('superadmin'), requireFeatureFlag('passkeyRegistration'), twofaRateLimiter, verifyPasskeyRegistrationHandler);
router.post('/passkeys/login/options',    requireFeatureFlag('passkeyLogin'), loginRateLimiter, getPasskeyLoginOptionsHandler);
router.post('/passkeys/login/verify',     requireFeatureFlag('passkeyLogin'), loginRateLimiter, verifyPasskeyLoginHandler);
router.get( '/passkeys',                  verifyToken, requireRole('superadmin'), listPasskeysHandler);
router.delete('/passkeys/:id',            verifyToken, requireRole('superadmin'), twofaRateLimiter, deletePasskeyHandler);

// SuperAdmin Security Email Binding & Verification Routes
router.get( '/superadmin/security-email/status',     verifyToken, requireRole('superadmin'), getSecurityEmailStatusHandler);
router.post('/superadmin/security-email/send-otp',   verifyToken, requireRole('superadmin'), requireFeatureFlag('superAdminEmailOtp'), twofaRateLimiter, sendSecurityEmailOtpHandler);
router.post('/superadmin/security-email/verify-otp', verifyToken, requireRole('superadmin'), requireFeatureFlag('superAdminEmailOtp'), twofaRateLimiter, verifySecurityEmailOtpHandler);

// SuperAdmin Passkey Account Recovery Routes
router.post('/recovery/request', requireFeatureFlag('emailRecovery'), passwordResetRateLimiter, requestRecoveryHandler);
router.post('/recovery/verify',  requireFeatureFlag('emailRecovery'), passwordResetRateLimiter, verifyRecoveryHandler);

export default router;
