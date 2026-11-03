/**
 * Lumina LMS — Platform Security Policy Controller
 * 6th Civilians Corporation
 */

import SecurityPolicy from '../models/SecurityPolicy.js';
import { isSuperAdmin2FaFrozen } from '../config/environment.js';
import { createCriticalAuditLog, actorFromRequest } from '../utils/auditLogger.js';

/**
 * GET /api/v1/admin/security-policies
 * Retrieves current effective security policy with runtime enforcement annotations.
 */
export const getSecurityPolicies = async (req, res) => {
  try {
    let policy = await SecurityPolicy.findOne({ key: 'global_security_policy' }).lean();

    if (!policy) {
      policy = await SecurityPolicy.create({
        key: 'global_security_policy',
        lastUpdatedByEmail: 'System Initialization'
      });
      policy = policy.toObject ? policy.toObject() : policy;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const isFrozen = isSuperAdmin2FaFrozen();
    const isSuperAdmin = req.user?.role === 'superadmin';

    // Build annotated response explaining which policies are enforced vs configurable
    const effectivePolicy = {
      ...policy,
      runtimeContext: {
        environment: process.env.NODE_ENV || 'development',
        isSuperAdmin,
        superAdmin2FaFrozen: isFrozen,
        superAdminMfaEffective: isProduction ? true : !isFrozen
      },
      annotations: {
        strictTenantIsolation: {
          enforced: true,
          configurable: false,
          description: 'Server-enforced query scoping by tenantId. Immutable platform security rule.'
        },
        superAdminMfa: {
          enforced: isProduction,
          configurable: !isProduction,
          description: isProduction
            ? 'Mandatory 2FA strictly enforced in production. Cannot be disabled.'
            : (isFrozen ? 'Temporarily frozen for non-production testing.' : 'Active in non-production.')
        },
        passwordRequirements: {
          enforced: true,
          configurable: isSuperAdmin,
          description: 'Complexity checks enforced on user provisioning and password resets.'
        },
        sessionLifetime: {
          enforced: true,
          configurable: isSuperAdmin,
          description: 'JWT expiration and Redis token lifecycle boundaries.'
        }
      }
    };

    res.json({
      success: true,
      policy: effectivePolicy
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * PUT /api/v1/admin/security-policies
 * Allows authorized Super-Admin to modify configurable security policy settings.
 */
export const updateSecurityPolicies = async (req, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        code: 'SUPERADMIN_REQUIRED',
        message: 'Only 6th Civilians Corporation Super-Administrators are authorized to modify global security policies.'
      });
    }

    const { mfaPolicy, passwordPolicy, sessionPolicy, tenantPolicy } = req.body;
    const isProduction = process.env.NODE_ENV === 'production';

    // Failsafe 1: Production SuperAdmin MFA cannot be disabled
    if (isProduction && mfaPolicy && mfaPolicy.superAdminMfaEnforced === false) {
      return res.status(400).json({
        success: false,
        code: 'PROD_MFA_MANDATORY',
        message: 'Super-Admin multi-factor authentication is mandatory in production and cannot be disabled.'
      });
    }

    // Failsafe 2: Tenant isolation cannot be disabled
    if (tenantPolicy && tenantPolicy.strictTenantIsolation === false) {
      return res.status(400).json({
        success: false,
        code: 'TENANT_ISOLATION_IMMUTABLE',
        message: 'Strict tenant isolation is an immutable platform architecture rule and cannot be disabled.'
      });
    }

    // Validation: Password minLength
    if (passwordPolicy?.minLength !== undefined) {
      const len = parseInt(passwordPolicy.minLength);
      if (isNaN(len) || len < 8 || len > 64) {
        return res.status(400).json({
          success: false,
          message: 'Password minimum length must be between 8 and 64 characters.'
        });
      }
    }

    // Validation: Session timeout
    if (sessionPolicy?.sessionTimeoutMinutes !== undefined) {
      const timeout = parseInt(sessionPolicy.sessionTimeoutMinutes);
      if (isNaN(timeout) || timeout < 15 || timeout > 1440) {
        return res.status(400).json({
          success: false,
          message: 'Session timeout must be between 15 minutes and 1440 minutes (24 hours).'
        });
      }
    }

    const updateFields = {
      lastUpdatedBy: req.user._id,
      lastUpdatedByEmail: req.user.email
    };

    if (mfaPolicy) {
      if (mfaPolicy.requireAdminMfa !== undefined) updateFields['mfaPolicy.requireAdminMfa'] = !!mfaPolicy.requireAdminMfa;
      if (mfaPolicy.requireTrainerMfa !== undefined) updateFields['mfaPolicy.requireTrainerMfa'] = !!mfaPolicy.requireTrainerMfa;
      if (!isProduction && mfaPolicy.superAdminMfaEnforced !== undefined) {
        updateFields['mfaPolicy.superAdminMfaEnforced'] = !!mfaPolicy.superAdminMfaEnforced;
      }
    }

    if (passwordPolicy) {
      if (passwordPolicy.minLength !== undefined) updateFields['passwordPolicy.minLength'] = parseInt(passwordPolicy.minLength);
      if (passwordPolicy.requireUppercase !== undefined) updateFields['passwordPolicy.requireUppercase'] = !!passwordPolicy.requireUppercase;
      if (passwordPolicy.requireLowercase !== undefined) updateFields['passwordPolicy.requireLowercase'] = !!passwordPolicy.requireLowercase;
      if (passwordPolicy.requireNumbers !== undefined) updateFields['passwordPolicy.requireNumbers'] = !!passwordPolicy.requireNumbers;
      if (passwordPolicy.requireSpecialChars !== undefined) updateFields['passwordPolicy.requireSpecialChars'] = !!passwordPolicy.requireSpecialChars;
      if (passwordPolicy.maxAgeDays !== undefined) updateFields['passwordPolicy.maxAgeDays'] = parseInt(passwordPolicy.maxAgeDays) || 90;
    }

    if (sessionPolicy) {
      if (sessionPolicy.sessionTimeoutMinutes !== undefined) {
        updateFields['sessionPolicy.sessionTimeoutMinutes'] = parseInt(sessionPolicy.sessionTimeoutMinutes);
      }
      if (sessionPolicy.idleTimeoutMinutes !== undefined) {
        updateFields['sessionPolicy.idleTimeoutMinutes'] = parseInt(sessionPolicy.idleTimeoutMinutes);
      }
      if (sessionPolicy.maxConcurrentSessions !== undefined) {
        updateFields['sessionPolicy.maxConcurrentSessions'] = parseInt(sessionPolicy.maxConcurrentSessions);
      }
      if (sessionPolicy.enforceIpBinding !== undefined) {
        updateFields['sessionPolicy.enforceIpBinding'] = !!sessionPolicy.enforceIpBinding;
      }
    }

    const updated = await SecurityPolicy.findOneAndUpdate(
      { key: 'global_security_policy' },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );

    // Write critical audit log
    await createCriticalAuditLog({
      tenantId: null,
      actor: actorFromRequest(req),
      action: 'SECURITY_POLICY_UPDATED',
      targetRecord: updated._id,
      targetModel: 'SecurityPolicy',
      details: {
        updatedBy: req.user.email,
        updatedFields: Object.keys(updateFields)
      }
    });

    res.json({
      success: true,
      message: 'Platform security policy updated successfully.',
      policy: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

