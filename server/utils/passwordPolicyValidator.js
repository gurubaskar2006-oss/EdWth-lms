/**
 * Lumina LMS — Centralized Dynamic Password Policy Validator
 * 6th Civilians Corporation
 *
 * Enforces dynamic platform password complexity and minimum length
 * configured in the MongoDB SecurityPolicy ('global_security_policy').
 *
 * Failsafe Rule:
 * If the database is unreachable or the policy document is missing,
 * this utility fails safely by enforcing enterprise secure standards
 * (minimum 12 characters, uppercase, lowercase, numbers, and symbols).
 * It NEVER falls back to weak or permissive password rules.
 */

import mongoose from 'mongoose';
import SecurityPolicy from '../models/SecurityPolicy.js';

export const ENTERPRISE_SECURE_PASSWORD_DEFAULTS = Object.freeze({
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAgeDays: 90
});

/**
 * Retrieves the effective dynamic password policy from MongoDB.
 * Falls back safely to enterprise secure standards on error.
 *
 * @returns {Promise<object>} Effective password policy
 */
export async function getEffectivePasswordPolicy() {
  try {
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const policyDoc = await SecurityPolicy.findOne({ key: 'global_security_policy' })
        .select('passwordPolicy')
        .lean();
      if (policyDoc && policyDoc.passwordPolicy) {
        return {
          minLength: Number(policyDoc.passwordPolicy.minLength) || ENTERPRISE_SECURE_PASSWORD_DEFAULTS.minLength,
          requireUppercase: policyDoc.passwordPolicy.requireUppercase !== false,
          requireLowercase: policyDoc.passwordPolicy.requireLowercase !== false,
          requireNumbers: policyDoc.passwordPolicy.requireNumbers !== false,
          requireSpecialChars: policyDoc.passwordPolicy.requireSpecialChars !== false,
          maxAgeDays: Number(policyDoc.passwordPolicy.maxAgeDays) || ENTERPRISE_SECURE_PASSWORD_DEFAULTS.maxAgeDays
        };
      }
    }
  } catch (err) {
    console.warn('[PasswordPolicyValidator] Failed to query dynamic SecurityPolicy; adopting enterprise secure defaults:', err.message);
  }

  return { ...ENTERPRISE_SECURE_PASSWORD_DEFAULTS };
}

/**
 * Pure synchronous validator against a given policy object.
 *
 * @param {string} password - Candidate password
 * @param {object} policy - Policy rules to enforce
 * @returns {{ isValid: boolean, message?: string, code?: string, missingRequirement?: string }}
 */
export function validatePasswordAgainstPolicyRules(password, policy = ENTERPRISE_SECURE_PASSWORD_DEFAULTS) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_REQUIRED',
      missingRequirement: 'required',
      message: 'Password is required and cannot be empty.'
    };
  }

  const minLength = Number(policy.minLength) || ENTERPRISE_SECURE_PASSWORD_DEFAULTS.minLength;
  if (password.length < minLength) {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_TOO_SHORT',
      missingRequirement: 'minLength',
      message: `Password must be at least ${minLength} characters long.`
    };
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_MISSING_UPPERCASE',
      missingRequirement: 'uppercase',
      message: 'Password must contain at least one uppercase letter (A-Z).'
    };
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_MISSING_LOWERCASE',
      missingRequirement: 'lowercase',
      message: 'Password must contain at least one lowercase letter (a-z).'
    };
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_MISSING_NUMBER',
      missingRequirement: 'number',
      message: 'Password must contain at least one number (0-9).'
    };
  }

  // Permitted special characters: standard ASCII symbols
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
    return {
      valid: false,
      isValid: false,
      code: 'PASSWORD_MISSING_SPECIAL_CHAR',
      missingRequirement: 'specialChar',
      message: 'Password must contain at least one special character (e.g. !@#$%^&*).'
    };
  }

  return { valid: true, isValid: true, message: null };
}

/**
 * Asynchronously validates a password against the effective MongoDB SecurityPolicy.
 *
 * @param {string} password - Candidate password
 * @returns {Promise<{ isValid: boolean, message?: string, code?: string, policy: object }>}
 */
export async function validatePasswordAgainstEffectivePolicy(password) {
  const policy = await getEffectivePasswordPolicy();
  const validation = validatePasswordAgainstPolicyRules(password, policy);
  return {
    ...validation,
    policy
  };
}

export default {
  getEffectivePasswordPolicy,
  validatePasswordAgainstPolicyRules,
  validatePasswordAgainstEffectivePolicy,
  ENTERPRISE_SECURE_PASSWORD_DEFAULTS
};
