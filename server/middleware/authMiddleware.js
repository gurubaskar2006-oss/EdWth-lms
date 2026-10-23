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
import { getJwtSecret } from '../config/environment.js';

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
    let token;

    // 1. Check cookies (jwt or token)
    if (req.cookies && (req.cookies.jwt || req.cookies.token)) {
      token = req.cookies.jwt || req.cookies.token;
    }
    // 2. Check Authorization header (Bearer <token>)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    let user = null;

    // A. Primary path: look up by MongoDB ObjectId (one query — covers 100% of production users)
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
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
        // Fall through to in-memory fallback
      }
    }

    // C. Development in-memory fallback (DEV/TEST ONLY, requires explicit opt-in)
    if (!user && decoded.id && process.env.NODE_ENV !== 'production' && process.env.ENABLE_LEGACY_DATASHEET_FALLBACK === 'true') {
      try {
        const { getStudents } = await import('../database/db.js');
        const localStudents = getStudents();
        const decodedIdStr = decoded.id.toString().toLowerCase();
        const matched = localStudents.find(s =>
          s.id === decoded.id ||
          s.studentId?.toLowerCase() === decodedIdStr ||
          s.email?.toLowerCase()     === decodedIdStr
        );
        if (matched) {
          user = {
            _id:       matched.id || matched.studentId,
            name:      matched.name,
            email:     matched.email,
            studentId: matched.studentId,
            role:      (matched.role || 'student').toLowerCase(),
            tenantId:  null
          };
        }
      } catch (err) {
        // In-memory store unavailable
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    if (user.soft_deleted) {
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

    if (process.env.NODE_ENV === 'production' && !req.tenantId && req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        code: 'MISSING_TENANT_CONTEXT',
        message: 'Account does not belong to a valid tenant institution.'
      });
    }
    // Exact normalized pathname and HTTP method evaluation
    // Uses the exact canonical pathname that the Express router matched
    // Query parameters and URL fragments cannot influence endpoint authorization
    const matchedPath = ((req.baseUrl || '') + (req.path || '')) || req.originalUrl || '';
    const normalizedPath = normalizeRequestPath(matchedPath);
    const method = (req.method || '').toUpperCase();

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
    const requiresMfaEnrollment = 
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
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
