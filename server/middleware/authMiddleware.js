/**
 * Lumina LMS — Auth Middleware
 * 6th Civilians Corporation
 *
 * JWT verification + DB-validated user lookup.
 *
 * Query analysis (verified against actual code):
 *   Normal path (MongoDB ObjectId in JWT):
 *     Query A: User.findById(decoded.id) — ONE query, ends here on success
 *
 *   Legacy fallback path (string ID in JWT, e.g. old local-db tokens):
 *     Query B: User.findOne({ studentId | email }) — runs ONLY if A returns null
 *
 *   In-memory fallback (dev without MongoDB):
 *     No DB query — reads from local JSON data
 *
 *   So: production with MongoDB = exactly ONE DB query per authenticated request.
 *   The "two queries" concern was a misread — B only executes when A finds nothing.
 *
 * Security: req.tenantId is always derived from the DB-verified user record.
 * The frontend/client NEVER supplies tenantId — it is always server-determined.
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { getJwtSecret, isSuperAdmin2FaFrozen } from '../config/environment.js';
import { validateSession } from '../services/sessionService.js';
import { clearAuthCookie } from '../utils/cookieHelper.js';
import { createCriticalAuditLog } from '../utils/auditLogger.js';

/**
 * Escape special regex characters before using user input in $regex.
 * Prevents ReDoS on the legacy studentId/email fallback path.
 */
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Normalizes request path for security evaluation:
 * - Strips query parameters and fragments completely
 * - Decodes URL-encoded entities safely
 * - Lowercases path
 * - Collapses duplicate slashes (/api//v1///auth -> /api/v1/auth)
 * - Removes trailing slash (except root '/')
 */
export const normalizeRequestPath = (urlPath) => {
  if (!urlPath || typeof urlPath !== 'string') return '';
  const withoutQuery = urlPath.split('?')[0].split('#')[0];
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    // Preserve if malformed percent encoding
  }
  let lower = decoded.toLowerCase().replace(/\/+/g, '/');
  if (lower.length > 1 && lower.endsWith('/')) {
    lower = lower.slice(0, -1);
  }
  return lower;
};

export const verifyToken = async (req, res, next) => {
  try {
    let headerToken = null;
    let headerSupplied = false;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && typeof authHeader === 'string' && authHeader.trim().toLowerCase().startsWith('bearer ')) {
      headerSupplied = true;
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length >= 2 && parts[1] && parts[1] !== 'null' && parts[1] !== 'undefined') {
        headerToken = parts[1].trim();
      }
    }

    if (!headerToken && req.headers['x-auth-token']) {
      const xToken = String(req.headers['x-auth-token']).trim();
      if (xToken && xToken !== 'null' && xToken !== 'undefined') {
        headerSupplied = true;
        headerToken = xToken;
      }
    }

    if (!headerToken && req.body && req.body.token) {
      const bToken = String(req.body.token).trim();
      if (bToken && bToken !== 'null' && bToken !== 'undefined') {
        headerSupplied = true;
        headerToken = bToken;
      }
    }

    let cookieToken = null;
    let cookieSupplied = false;
    if (req.cookies && (req.cookies.jwt || req.cookies.token)) {
      const c = req.cookies.jwt || req.cookies.token;
      if (c && c !== 'null' && c !== 'undefined') {
        cookieSupplied = true;
        cookieToken = c.trim();
      }
    }

    if (!headerSupplied && !cookieSupplied) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    // Helper to verify and resolve candidate credentials safely
    const resolveCandidateIdentity = async (rawToken, source) => {
      if (!rawToken || typeof rawToken !== 'string') {
        return { error: 'TOKEN_INVALID', subCode: 'TOKEN_MALFORMED', message: 'Token is malformed or empty' };
      }
      const cleanToken = rawToken.trim();
      if (!cleanToken || cleanToken === 'null' || cleanToken === 'undefined') {
        return { error: 'TOKEN_INVALID', subCode: 'TOKEN_MALFORMED', message: 'Token is malformed or empty' };
      }

      let decoded;
      try {
        decoded = jwt.verify(cleanToken, getJwtSecret());
      } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
          return { error: 'TOKEN_EXPIRED', message: 'Token expired', expiredAt: jwtErr.expiredAt };
        }
        if (jwtErr.name === 'JsonWebTokenError') {
          const isSignature = (jwtErr.message || '').toLowerCase().includes('signature');
          return {
            error: 'TOKEN_INVALID',
            subCode: isSignature ? 'TOKEN_INVALID_SIGNATURE' : 'TOKEN_MALFORMED',
            message: jwtErr.message || 'Not authorized, token failed'
          };
        }
        return { error: 'TOKEN_INVALID', message: 'Not authorized, token failed' };
      }

      if (decoded && decoded.preAuth) {
        return { token: cleanToken, source, decoded, isPreAuth: true };
      }

      let sessionValidation = null;
      if (decoded && decoded.sessionId) {
        try {
          sessionValidation = await validateSession(decoded.id, decoded.sessionId);
        } catch (sessErr) {
          console.error(`[AuthMiddleware] Operational failure during session validation for ${source}:`, sessErr.message);
          return {
            error: 'DATABASE_ERROR',
            isOperationalError: true,
            message: 'Session validation service temporarily unavailable.'
          };
        }

        if (!sessionValidation || !sessionValidation.valid) {
          const code = sessionValidation?.code || 'SESSION_INVALID';
          return {
            token: cleanToken,
            source,
            decoded,
            isSessionInvalid: true,
            error: code,
            sessionValidation,
            message: sessionValidation?.message || 'Session is invalid, expired, or has been revoked.'
          };
        }
      }

      let dbUser = null;
      try {
        if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
          dbUser = await User.findById(decoded.id).select('-password');
        }
        if (!dbUser && mongoose.connection && mongoose.connection.readyState === 1 && decoded.id) {
          const escapedId = escapeRegex(decoded.id.toString());
          dbUser = await User.findOne({
            $or: [
              { studentId: { $regex: new RegExp(`^${escapedId}$`, 'i') } },
              { email:     { $regex: new RegExp(`^${escapedId}$`, 'i') } }
            ]
          }).select('-password');
        }
      } catch (dbErr) {
        console.error(`[AuthMiddleware] Operational database failure querying user for ${source}:`, dbErr.message);
        return {
          error: 'DATABASE_ERROR',
          isOperationalError: true,
          message: 'Authentication service temporarily unavailable due to a database error.'
        };
      }

      if (!dbUser || dbUser.soft_deleted) {
        return { error: 'USER_NOT_FOUND', message: 'User not found or deleted' };
      }

      const role = String(dbUser.role || decoded.role || '').toLowerCase().trim();
      return {
        token: cleanToken,
        source,
        decoded,
        user: dbUser,
        role,
        session: sessionValidation?.session || null,
        sessionId: decoded.sessionId || null
      };
    };

    let selected = null;

    // MANDATORY SECURITY POLICY:
    // 1. If an Authorization Bearer header is supplied, validate it and bind strictly to that identity.
    // 2. If Bearer validation fails (expired, invalid, malformed, revoked), REJECT immediately (401). NEVER fall back to cookie!
    // 3. If BOTH Bearer and cookie credentials are present:
    //    - If cookie validation hits an operational/database error, fail closed (HTTP 500).
    //    - If cookie is expired, revoked, idle-expired, or invalid, clear stale cookie and continue with valid Bearer.
    //    - If BOTH resolve to active valid identities but DIFFERENT users, REJECT with 401 CONFLICTING_CREDENTIALS.
    // 4. Never select an identity based on role seniority.
    if (headerSupplied) {
      const headerCandidate = await resolveCandidateIdentity(headerToken, 'header');
      if (headerCandidate.isOperationalError || headerCandidate.error === 'DATABASE_ERROR') {
        return res.status(500).json({
          success: false,
          code: 'AUTH_DATABASE_ERROR',
          message: 'Authentication service temporarily unavailable due to a database error.'
        });
      }

      if (headerCandidate.error) {
        return res.status(401).json({
          success: false,
          code: headerCandidate.error,
          message: headerCandidate.message || 'Not authorized, token failed'
        });
      }

      if (cookieSupplied) {
        const cookieCandidate = await resolveCandidateIdentity(cookieToken, 'cookie');

        // Case F: Infrastructure or database failure during cookie validation -> Fail closed!
        if (cookieCandidate.isOperationalError || cookieCandidate.error === 'DATABASE_ERROR') {
          return res.status(500).json({
            success: false,
            code: 'AUTH_DATABASE_ERROR',
            message: 'Authentication service temporarily unavailable due to an operational failure.'
          });
        }

        // Cases B, C, D: Stale, expired, revoked, or malformed cookie -> Clear cookie and proceed with valid Bearer
        const isStaleOrInvalidCookie = Boolean(
          cookieCandidate.error ||
          cookieCandidate.isSessionInvalid ||
          cookieCandidate.isPreAuth ||
          !cookieCandidate.user
        );

        if (isStaleOrInvalidCookie) {
          clearAuthCookie(res);
        } else {
          // Both header and cookie resolved to active, authenticated identities
          const headerUserId = headerCandidate.user ? headerCandidate.user._id.toString() : null;
          const cookieUserId = cookieCandidate.user ? cookieCandidate.user._id.toString() : null;

          if (headerUserId !== cookieUserId) {
            try {
              await createCriticalAuditLog({
                tenantId: headerCandidate.user.tenantId || null,
                actor: {
                  userId: headerCandidate.user._id,
                  role: headerCandidate.role,
                  email: headerCandidate.user.email
                },
                action: 'AUTH_CONFLICTING_CREDENTIALS_REJECTED',
                targetRecord: headerCandidate.user._id,
                targetModel: 'User',
                details: {
                  headerUserId,
                  headerRole: headerCandidate.role,
                  cookieSupplied: true,
                  cookieUserId: cookieUserId || 'unresolved',
                  cookieRole: cookieCandidate.role || 'unknown',
                  ip: req.ip,
                  userAgent: req.headers['user-agent']
                }
              });
            } catch (auditErr) {
              console.error('[AuthMiddleware] Audit log failure for conflicting credentials:', auditErr.message);
            }

            return res.status(401).json({
              success: false,
              code: 'CONFLICTING_CREDENTIALS',
              message: 'Conflicting credentials presented: Authorization header and authentication cookie resolve to different identities.'
            });
          }
        }
      }

      selected = headerCandidate;
    } else {
      // Cookie credential only (no Authorization Bearer header provided)
      const cookieCandidate = await resolveCandidateIdentity(cookieToken, 'cookie');
      if (cookieCandidate.isOperationalError || cookieCandidate.error === 'DATABASE_ERROR') {
        return res.status(500).json({
          success: false,
          code: 'AUTH_DATABASE_ERROR',
          message: 'Authentication service temporarily unavailable due to a database error.'
        });
      }

      if (cookieCandidate.error) {
        clearAuthCookie(res);
        return res.status(401).json({
          success: false,
          code: cookieCandidate.error,
          message: cookieCandidate.message || 'Not authorized, token failed'
        });
      }
      selected = cookieCandidate;
    }

    if (!selected) {
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }

    if (selected.isPreAuth) {
      return res.status(403).json({
        success: false,
        code: 'MFA_VERIFICATION_REQUIRED',
        message: 'Multi-factor authentication required. Temporary challenge tokens cannot access protected endpoints.'
      });
    }

    if (selected.isSessionInvalid) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        code: selected.sessionValidation?.code || 'SESSION_INVALID',
        message: selected.sessionValidation?.message || 'Session is invalid, expired, or has been revoked. Please log in again.'
      });
    }

    const { token, decoded, sessionId, session } = selected;
    let user = selected.user || null;
    if (sessionId) {
      req.sessionId = sessionId;
      req.session = session;
    }

    // SECURITY: Enforce restricted scope for recovery session tokens.
    // Recovery tokens (recovery: true, scope: 'superadmin_recovery') must never grant unrestricted normal SuperAdmin access.
    if (decoded && (decoded.recovery || decoded.scope === 'superadmin_recovery')) {
      const normalizedPath = normalizeRequestPath(req.originalUrl || req.path);
      const isRecoveryPermitted = normalizedPath.includes('/passkeys/register') ||
                                  normalizedPath.includes('/recovery') ||
                                  normalizedPath.includes('/superadmin/security-email');

      if (!isRecoveryPermitted) {
        return res.status(403).json({
          success: false,
          code: 'RESTRICTED_RECOVERY_SESSION',
          message: 'Restricted recovery session: Access to regular administrative resources is prohibited until recovery re-enrollment completes.'
        });
      }
      req.isRecoverySession = true;
    }

    // A. Primary path: look up by MongoDB ObjectId (if not already hydrated)
    if (!user && mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
      try {
        user = await User.findById(decoded.id).select('-password');
      } catch (err) {
        // DB error — fall through to secondary lookup
      }
    }

    // B. Legacy fallback: look up by studentId or email (string-based IDs from old tokens)
    // SECURITY: Escape decoded.id before using in $regex to prevent ReDoS.
    if (!user && mongoose.connection.readyState === 1 && decoded.id) {
      try {
        const escapedId = escapeRegex(decoded.id.toString());
        user = await User.findOne({
          $or: [
            { studentId: { $regex: new RegExp(`^${escapedId}$`, 'i') } },
            { email:     { $regex: new RegExp(`^${escapedId}$`, 'i') } }
          ]
        }).select('-password');
      } catch (err) {
        // Fall through to user check
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    if (user.soft_deleted || user.accountStatus === 'Inactive' || user.status === 'Inactive') {
      return res.status(401).json({ success: false, message: 'Account disabled' });
    }

    req.user = user;
    if (req.user) {
      if (req.user.role) {
        req.user.role = String(req.user.role).toLowerCase().trim();
      } else if (decoded.role) {
        req.user.role = String(decoded.role).toLowerCase().trim();
      }
    }

    // Resolve tenantId from DB user record or verified JWT token claims
    let rawTenantId = user.tenantId?._id || user.tenantId;
    if (!rawTenantId && decoded.tenantId) {
      rawTenantId = decoded.tenantId;
    }

    // Superadmin has global platform oversight and intentionally carries tenantId: null.
    // Tenant-scoped roles resolve tenantId strictly from authenticated server/JWT context without synthetic fallbacks.
    req.tenantId = (rawTenantId && mongoose.Types.ObjectId.isValid(rawTenantId))
      ? rawTenantId.toString()
      : null;

    if (req.user && !req.user.tenantId && req.tenantId) {
      req.user.tenantId = req.tenantId;
    }

    // Exact normalized pathname and HTTP method evaluation
    // Uses the exact canonical pathname that the Express router matched
    // Query parameters and URL fragments cannot influence endpoint authorization
    const matchedPath = ((req.baseUrl || '') + (req.path || '')) || req.originalUrl || '';
    const normalizedPath = normalizeRequestPath(matchedPath);
    const method = (req.method || '').toUpperCase();

    const isAuthAccountRoute =
      normalizedPath.startsWith('/api/v1/auth/') ||
      normalizedPath.startsWith('/api/auth/') ||
      normalizedPath.startsWith('/auth/');

    // FAIL-CLOSED TENANT ENFORCEMENT:
    // Any tenant-scoped account (student, trainer, teacher) MUST possess a valid tenant context in all environments.
    // In production, ordinary admin also requires a valid tenant context.
    // Exempt only basic account maintenance endpoints (profile, logout, change-password).
    if (!isAuthAccountRoute && !req.tenantId && req.user?.role !== 'superadmin') {
      const isTenantScopedRole = ['student', 'trainer', 'teacher'].includes(req.user?.role);
      const isProductionAdmin = process.env.NODE_ENV === 'production' && req.user?.role === 'admin';
      if (isTenantScopedRole || isProductionAdmin) {
        return res.status(403).json({
          success: false,
          code: 'MISSING_TENANT_CONTEXT',
          message: 'Account does not belong to a valid tenant institution.'
        });
      }
    }

    // Whitelisted exact pathnames and methods for forced password change
    const isChangePasswordEndpoint =
      method === 'POST' && (
        normalizedPath === '/api/v1/auth/change-password' ||
        normalizedPath === '/api/auth/change-password' ||
        normalizedPath === '/auth/change-password'
      );
    const isLogoutEndpoint =
      method === 'POST' && (
        normalizedPath === '/api/v1/auth/logout' ||
        normalizedPath === '/api/auth/logout' ||
        normalizedPath === '/auth/logout'
      );
    const isProfileEndpoint =
      method === 'GET' && (
        normalizedPath === '/api/v1/auth/profile' ||
        normalizedPath === '/api/auth/profile' ||
        normalizedPath === '/auth/profile'
      );

    const isAllowedPasswordChangeEndpoint =
      isChangePasswordEndpoint || isLogoutEndpoint || isProfileEndpoint;

    // SECURITY: Enforce forced password change. Users with mustChangePassword=true
    // cannot access normal portal endpoints until their password has been changed.
    if (user.mustChangePassword) {
      if (!isAllowedPasswordChangeEndpoint) {
        return res.status(403).json({
          success: false,
          code: 'MUST_CHANGE_PASSWORD',
          message: 'Password change is required before continuing.'
        });
      }
    }

    // SECURITY: Enforce mandatory MFA enrollment for privileged accounts.
    // Superadmins and accounts with mfaEnforced=true or mfaSetupRequired=true
    // must enroll in 2FA before accessing any administrative or portal endpoints.
    // When ENABLE_SUPERADMIN_2FA=false in development/staging, SuperAdmin 2FA is temporarily bypassed.
    const isSuperAdminBypass = user.role === 'superadmin' && isSuperAdmin2FaFrozen();

    const requiresMfaEnrollment = 
      !isSuperAdminBypass &&
      ((process.env.NODE_ENV === 'production' && user.role === 'superadmin') ||
       user.mfaEnforced ||
       user.mfaSetupRequired) &&
      !user.isTwoFactorEnabled;

    if (requiresMfaEnrollment) {
      const is2faSetupEndpoint =
        method === 'POST' && (
          normalizedPath === '/api/v1/auth/2fa/setup' ||
          normalizedPath === '/api/auth/2fa/setup' ||
          normalizedPath === '/auth/2fa/setup'
        );
      const is2faVerifyEndpoint =
        method === 'POST' && (
          normalizedPath === '/api/v1/auth/2fa/verify' ||
          normalizedPath === '/api/auth/2fa/verify' ||
          normalizedPath === '/auth/2fa/verify'
        );

      const isAllowedMfaEndpoint =
        is2faSetupEndpoint ||
        is2faVerifyEndpoint ||
        isAllowedPasswordChangeEndpoint;

      if (!isAllowedMfaEndpoint) {
        return res.status(403).json({
          success: false,
          code: 'MFA_SETUP_REQUIRED',
          message: 'Multi-factor authentication enrollment is required for privileged accounts before accessing portal functions.'
        });
      }
    }

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

export const requireRole = (...roles) => {
  const allowedRoles = roles.flat().map((r) => String(r).toLowerCase().trim());
  return (req, res, next) => {
    const userRole = req.user?.role ? String(req.user.role).toLowerCase().trim() : '';
    if (!req.user || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PRIVILEGES',
        message: 'Forbidden: Insufficient privileges'
      });
    }
    next();
  };
};
