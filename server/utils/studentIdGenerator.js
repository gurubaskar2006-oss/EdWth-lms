/**
 * Lumina LMS — Collision-Resistant Student Identifier Generator
 * 6th Civilians Corporation
 *
 * Allocates unique student IDs in format STU-<YYYY>-<RANDOM_6_DIGITS>.
 * Implements bounded collision detection with database uniqueness verification.
 */

import crypto from 'crypto';
import User from '../models/User.js';

/**
 * Generate a candidate student ID in format STU-<YYYY>-<6-digit-random>.
 * Example: STU-2026-481920
 */
export const generateCandidateStudentId = (year = new Date().getFullYear()) => {
  const randomNum = crypto.randomInt(100000, 1000000); // 100000 to 999999 inclusive
  return `STU-${year}-${randomNum}`;
};

/**
 * Allocate a unique student identifier with bounded retries against the User model.
 * If all attempts collide, returns null to signal allocation exhaustion (HTTP 503).
 *
 * @param {Object} options
 * @param {number} [options.maxAttempts=10] Maximum generation iterations
 * @param {number} [options.year] Target academic year
 * @param {import('mongoose').ClientSession} [options.session] Optional transaction session
 * @param {Function} [options.candidateGenerator] Optional custom generator function (for testing)
 * @returns {Promise<string|null>} The unique student identifier, or null if exhausted.
 */
export const allocateUniqueStudentId = async ({
  maxAttempts = 10,
  year = new Date().getFullYear(),
  session = null,
  candidateGenerator = null
} = {}) => {
  const generator = candidateGenerator || global.__mockStudentIdGenerator || (() => generateCandidateStudentId(year));

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const candidateId = generator();
    const query = User.findOne({ studentId: candidateId });
    if (session) {
      query.session(session);
    }
    const exists = await query.select('_id').lean();
    if (!exists) {
      return candidateId;
    }
  }

  return null; // Exhausted all attempts
};

export default {
  generateCandidateStudentId,
  allocateUniqueStudentId
};

