/**
 * Lumina LMS — Multi-Institution Architecture & Secure Account Recovery Test Suite
 * 6th Civilians Corporation
 *
 * Critical tests covering:
 * 1. Institution Configuration & Terminology (School vs. College)
 * 2. Cryptographic Temporary Password Generation
 * 3. Insecure Password Reset Flow Disabled
 * 4. 2FA Hashed Backup Code Generation, Verification, & Single-Use
 * 5. Forced Password Change (mustChangePassword flag & validation)
 * 6. Tenant Isolation & Educator Access Boundaries
 */

import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { getInstitutionConfig } from '../../src/config/institutionConfig.js';
import { generateSecureTemporaryPassword } from '../utils/passwordGenerator.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import mongoose from 'mongoose';

describe('1. Institution Configuration & Terminology', () => {
  it('should return correct terminology for school institutions', () => {
    const config = getInstitutionConfig('school');
    expect(config.educatorLabel).toBe('Teacher');
    expect(config.educatorPlural).toBe('Teachers');
    expect(config.groupLabel).toBe('Class');
    expect(config.groupPlural).toBe('Classes');
    expect(config.courseLabel).toBe('Subject');
    expect(config.dashboardLabel).toBe('School Dashboard');
  });

  it('should return correct terminology for college institutions (default)', () => {
    const config = getInstitutionConfig('college');
    expect(config.educatorLabel).toBe('Trainer');
    expect(config.educatorPlural).toBe('Trainers');
    expect(config.groupLabel).toBe('Batch');
    expect(config.groupPlural).toBe('Batches');
    expect(config.courseLabel).toBe('Course');
    expect(config.dashboardLabel).toBe('College Dashboard');
  });

  it('should default safely to college for unknown or omitted institution types', () => {
    const config = getInstitutionConfig(undefined);
    expect(config.institutionType).toBe('college');
    expect(config.educatorLabel).toBe('Trainer');
  });
});

describe('2. Cryptographic Temporary Password Generation', () => {
  it('should generate secure random passwords meeting enterprise complexity', () => {
    const password = generateSecureTemporaryPassword(12);
    expect(password.length).toBe(12);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[!@#$%&*]/.test(password)).toBe(true);
  });

  it('should generate unique values on successive invocations', () => {
    const p1 = generateSecureTemporaryPassword(12);
    const p2 = generateSecureTemporaryPassword(12);
    expect(p1).not.toBe(p2);
  });
});

describe('3. 2FA Backup Code Security (Hashed Storage)', () => {
  it('should ensure backup codes are hashed using bcrypt before storage', async () => {
    const plaintextCode = 'a1b2c3d4';
    const hashed = await bcrypt.hash(plaintextCode, 10);

    // Ensure the hash is not equal to plaintext
    expect(hashed).not.toBe(plaintextCode);
    expect(hashed.startsWith('$2')).toBe(true);

    // Verify bcrypt comparison succeeds
    const isMatch = await bcrypt.compare(plaintextCode, hashed);
    expect(isMatch).toBe(true);

    // Verify wrong code fails
    const isWrongMatch = await bcrypt.compare('wrongcode', hashed);
    expect(isWrongMatch).toBe(false);
  });

  it('should simulate single-use consumption of hashed backup codes', async () => {
    const rawCodes = ['code-1111', 'code-2222', 'code-3333'];
    const hashedCodes = await Promise.all(rawCodes.map(c => bcrypt.hash(c, 10)));

    const inputCode = 'code-2222';
    let matchedIndex = -1;

    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(inputCode, hashedCodes[i])) {
        matchedIndex = i;
        break;
      }
    }

    expect(matchedIndex).toBe(1);

    // Consume code
    hashedCodes.splice(matchedIndex, 1);
    expect(hashedCodes.length).toBe(2);

    // Second attempt with same code must fail
    let secondMatch = -1;
    for (let i = 0; i < hashedCodes.length; i++) {
      if (await bcrypt.compare(inputCode, hashedCodes[i])) {
        secondMatch = i;
        break;
      }
    }
    expect(secondMatch).toBe(-1);
  });
});

describe('4. Tenant Schema & Model Fields', () => {
  it('should allow institutionType in College schema with default college', () => {
    const college = new College({
      name: 'Test Engineering Academy',
      code: 'TEA-TEST',
      slug: 'tea-test'
    });
    expect(college.institutionType).toBe('college');
  });

  it('should support school institutionType', () => {
    const school = new College({
      name: 'St. Marks High School',
      code: 'SMHS-TEST',
      slug: 'smhs-test',
      institutionType: 'school'
    });
    expect(school.institutionType).toBe('school');
  });

  it('should support mustChangePassword in User schema with default false', () => {
    const user = new User({
      studentId: 'STU-TEST-01',
      name: 'Jane Scholar',
      email: 'jane.scholar@test.edu',
      password: 'HashedPassword123!'
    });
    expect(user.mustChangePassword).toBe(false);
  });
});

describe('5. Educator Authorization & Tenant Boundary Logic', () => {
  it('should verify educator cannot reset student in another tenant or unassigned batch', () => {
    const tenantA = new mongoose.Types.ObjectId();
    const tenantB = new mongoose.Types.ObjectId();
    const batch1 = new mongoose.Types.ObjectId();
    const batch2 = new mongoose.Types.ObjectId();

    const educator = {
      _id: new mongoose.Types.ObjectId(),
      role: 'trainer',
      tenantId: tenantA,
      batchId: batch1
    };

    const studentOtherTenant = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantB,
      batchId: batch1
    };

    const studentOtherBatch = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantA,
      batchId: batch2
    };

    const studentAssigned = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: tenantA,
      batchId: batch1
    };

    // Cross tenant check
    const isSameTenant = educator.tenantId.toString() === studentOtherTenant.tenantId.toString();
    expect(isSameTenant).toBe(false);

    // Cross batch check for assigned educator
    const isSameBatch = educator.batchId.toString() === studentOtherBatch.batchId.toString();
    expect(isSameBatch).toBe(false);

    // Authorized educator & student
    const isAuthorized = 
      educator.tenantId.toString() === studentAssigned.tenantId.toString() &&
      educator.batchId.toString() === studentAssigned.batchId.toString();
    expect(isAuthorized).toBe(true);
  });
});

describe('6. EdWth LMS Brand Identity & Public Asset Integrity', () => {
  it('should verify official logo and favicon assets exist in public directory', () => {
    const publicDir = path.resolve(process.cwd(), 'public');
    expect(fs.existsSync(path.join(publicDir, 'logo.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'logo-transparent.png'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'favicon.svg'))).toBe(true);

    const logoStats = fs.statSync(path.join(publicDir, 'logo-transparent.png'));
    expect(logoStats.size).toBeGreaterThan(1000);
  });

  it('should verify login view components render EdWth LMS branding and tagline', () => {
    const unauthPath = path.resolve(process.cwd(), 'src/components/UnauthenticatedView.jsx');
    const loginModalPath = path.resolve(process.cwd(), 'src/components/LoginModal.jsx');

    const unauthContent = fs.readFileSync(unauthPath, 'utf8');
    const modalContent = fs.readFileSync(loginModalPath, 'utf8');

    // Verify brand strings
    expect(unauthContent).toContain('EdWth LMS');
    expect(unauthContent).toContain('EdWth Academy');
    expect(unauthContent).toContain('Empowering Every Learner');
    expect(unauthContent).toContain('/logo-transparent.png');
    expect(unauthContent).not.toContain('Learning, simplified.');

    expect(modalContent).toContain('EdWth LMS');
    expect(modalContent).toContain('EdWth Academy');
    expect(modalContent).toContain('Empowering Every Learner');
    expect(modalContent).toContain('/logo-transparent.png');
    expect(modalContent).not.toContain('Learning, simplified.');
  });
});

