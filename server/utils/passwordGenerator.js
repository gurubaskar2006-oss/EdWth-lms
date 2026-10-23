/**
 * Lumina LMS — Secure Temporary Password Generator
 * 6th Civilians Corporation
 *
 * Generates cryptographically secure temporary passwords using Node.js crypto.
 * Conforms to enterprise complexity: uppercase, lowercase, numbers, and symbols.
 */

import crypto from 'crypto';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const NUMS  = '23456789';
const SYMS  = '!@#$%&*';

export const generateSecureTemporaryPassword = (length = 12) => {
  // Ensure at least one from each required character class
  const requiredChars = [
    UPPER[crypto.randomInt(0, UPPER.length)],
    LOWER[crypto.randomInt(0, LOWER.length)],
    NUMS[crypto.randomInt(0, NUMS.length)],
    SYMS[crypto.randomInt(0, SYMS.length)],
  ];

  const allChars = UPPER + LOWER + NUMS + SYMS;
  const remainingCount = length - requiredChars.length;
  const randomBytes = crypto.randomBytes(remainingCount);

  const remainingChars = [];
  for (let i = 0; i < remainingCount; i++) {
    remainingChars.push(allChars[randomBytes[i] % allChars.length]);
  }

  // Shuffle together cryptographically
  const combined = [...requiredChars, ...remainingChars];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
};

export default generateSecureTemporaryPassword;
