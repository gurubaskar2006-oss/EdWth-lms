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
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  loginRateLimiter,
  twofaRateLimiter,
  passwordResetRateLimiter
} from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.get('/tenants',          getTenants);
router.post('/login',           loginRateLimiter,         login);
router.post('/logout',                                    logout);
router.post('/reset-password',  passwordResetRateLimiter, resetPassword);
router.post('/change-password', verifyToken,              changePassword);
router.get( '/profile',         verifyToken,              getProfile);
router.put( '/profile',         verifyToken,              updateProfile);

// 2FA Routes
router.post('/2fa/setup',  verifyToken,      setup2FA);
router.post('/2fa/verify', twofaRateLimiter, verify2FA);

export default router;
