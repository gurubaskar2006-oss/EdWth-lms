/**
 * Lumina LMS — Student Profile Completion Workflow Integration & Regression Tests
 * 6th Civilians Corporation
 *
 * Verifies end-to-end:
 * 1. Authenticated student can save permitted contact details (phone, address, emergencyContact).
 * 2. Authenticated profile endpoint (GET /api/v1/auth/profile) returns saved details.
 * 3. Completion calculation correctly transitions:
 *    - 0/3 when none provided
 *    - 1/3 or 2/3 when partially completed
 *    - 3/3 when all required fields (phone, address, emergencyContact name + phone) are valid
 * 4. Completion persists across session reloads.
 * 5. Student identity is strictly derived from the verified token; students cannot edit another student's profile.
 * 6. Attempts to modify protected fields (role, tenantId, studentId, email, password, grades, attendance, major) are rejected with 400.
 * 7. Invalid phone numbers are rejected with 400.
 * 8. Database failures return an error status (500) rather than a false positive success.
 * 9. Frontend components routing & view mapping integrity (SchoolStudentApp, CollegeStudentApp, SchoolSidebar, Sidebar, SettingsView).
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateProfile, getProfile } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import College from '../models/College.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina LMS — Student Profile Completion Workflow Test Suite', () => {
  const JWT_SECRET = 'test-secret-profile-completion-workflow-32ch';
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const studentAliceId = new mongoose.Types.ObjectId();
  const studentBobId = new mongoose.Types.ObjectId();

  let aliceToken;
  let bobToken;

  let mockUsers = {};
  let originalFindById;
  let originalFindByIdAndUpdate;
  let originalAuditLogCreate;
  let originalCollegeFindById;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    aliceToken = jwt.sign(
      { id: studentAliceId.toString(), role: 'student', tenantId: tenantAId.toString() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    bobToken = jwt.sign(
      { id: studentBobId.toString(), role: 'student', tenantId: tenantAId.toString() },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    mockUsers[studentAliceId.toString()] = {
      _id: studentAliceId,
      studentId: 'STU-ALICE-01',
      name: 'Alice Johnson',
      email: 'alice.johnson@school.edu',
      role: 'student',
      tenantId: tenantAId,
      major: 'Grade 10-A',
      phone: '',
      address: '',
      emergencyContact: {
        name: '',
        phone: '',
        relationship: 'Parent/Guardian'
      },
      save: async function() { return this; },
      toObject: function() { return { ...this }; }
    };

    mockUsers[studentBobId.toString()] = {
      _id: studentBobId,
      studentId: 'STU-BOB-02',
      name: 'Bob Smith',
      email: 'bob.smith@school.edu',
      role: 'student',
      tenantId: tenantAId,
      major: 'Grade 10-B',
      phone: '+1 555-111-2222',
      address: '742 Evergreen Terrace',
      emergencyContact: {
        name: 'Helen Smith',
        phone: '+1 555-333-4444',
        relationship: 'Mother'
      },
      save: async function() { return this; },
      toObject: function() { return { ...this }; }
    };

    // Ensure readyState is 1 for Mongoose lookup path
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // Mock User.findById with select chaining
    originalFindById = User.findById;
    User.findById = function(id) {
      const u = mockUsers[id?.toString()];
      return {
        select: () => Promise.resolve(u || null),
        lean: () => Promise.resolve(u || null),
        then: (onFulfilled, onRejected) => Promise.resolve(u || null).then(onFulfilled, onRejected)
      };
    };

    // Mock User.findByIdAndUpdate
    originalFindByIdAndUpdate = User.findByIdAndUpdate;
    User.findByIdAndUpdate = function(id, update) {
      const u = mockUsers[id?.toString()];
      if (!u) {
        return {
          select: () => Promise.resolve(null),
          then: (onFulfilled) => Promise.resolve(null).then(onFulfilled)
        };
      }
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          if (key.startsWith('emergencyContact.')) {
            const sub = key.split('.')[1];
            u.emergencyContact = { ...(u.emergencyContact || {}), [sub]: val };
          } else {
            u[key] = val;
          }
        }
      }
      return {
        select: () => Promise.resolve(u),
        then: (onFulfilled, onRejected) => Promise.resolve(u).then(onFulfilled, onRejected)
      };
    };

    // Mock AuditLog.create
    originalAuditLogCreate = AuditLog.create;
    AuditLog.create = async () => ({ _id: new mongoose.Types.ObjectId() });

    // Mock College.findById
    originalCollegeFindById = College.findById;
    College.findById = function() {
      return {
        select: () => ({
          lean: () => Promise.resolve({ name: 'Oakridge High School', code: 'OAKRIDGE', institutionType: 'school' })
        })
      };
    };

    // Build Express app with the exact authentication and profile controllers
    app = express();
    app.use(express.json());

    app.get('/api/v1/auth/profile', verifyToken, getProfile);
    app.put('/api/v1/auth/profile', verifyToken, updateProfile);
    app.put('/api/v1/students/me/profile', verifyToken, updateProfile);
  });

  afterAll(() => {
    if (originalFindById) {
      User.findById = originalFindById;
    }
    if (originalFindByIdAndUpdate) {
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
    if (originalAuditLogCreate) {
      AuditLog.create = originalAuditLogCreate;
    }
    if (originalCollegeFindById) {
      College.findById = originalCollegeFindById;
    }
  });

  describe('1. Profile Completion State Transitions (0/3 -> 1/3 -> 2/3 -> 3/3)', () => {
    const calculateCompletion = (user) => {
      const PHONE_REGEX = /^[\d\s+\-().]{7,25}$/;
      const hasPhone = Boolean(user?.phone && user.phone.trim() && PHONE_REGEX.test(user.phone.trim()));
      const hasAddress = Boolean(user?.address && user.address.trim());
      const hasEmergency = Boolean(
        user?.emergencyContact?.name?.trim() &&
        user?.emergencyContact?.phone?.trim() &&
        PHONE_REGEX.test(user.emergencyContact.phone.trim())
      );
      const count = (hasPhone ? 1 : 0) + (hasAddress ? 1 : 0) + (hasEmergency ? 1 : 0);
      return { count, isComplete: count === 3 };
    };

    test('Initial empty profile is 0/3 and incomplete', () => {
      const alice = mockUsers[studentAliceId.toString()];
      const { count, isComplete } = calculateCompletion(alice);
      expect(count).toBe(0);
      expect(isComplete).toBe(false);
    });

    test('Saving contact phone transitions completion to 1/3', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ phone: '+1 (555) 019-2831' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 019-2831');

      const { count, isComplete } = calculateCompletion(res.body.user);
      expect(count).toBe(1);
      expect(isComplete).toBe(false);
    });

    test('Saving residential address transitions completion to 2/3', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ address: '100 University Avenue, Apt 4B' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { count, isComplete } = calculateCompletion(res.body.user);
      expect(count).toBe(2);
      expect(isComplete).toBe(false);
    });

    test('Saving full emergency contact transitions completion to 3/3 (Complete)', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          emergencyContact: {
            name: 'Robert Johnson',
            phone: '+1 (555) 444-5555',
            relationship: 'Father'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { count, isComplete } = calculateCompletion(res.body.user);
      expect(count).toBe(3);
      expect(isComplete).toBe(true);
    });
  });

  describe('2. Persistence Across Session Reloads', () => {
    test('Authenticated GET /api/v1/auth/profile returns saved details upon session reload', async () => {
      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 019-2831');
      expect(res.body.user.address).toBe('100 University Avenue, Apt 4B');
      expect(res.body.user.emergencyContact.name).toBe('Robert Johnson');
      expect(res.body.user.emergencyContact.phone).toBe('+1 (555) 444-5555');
    });

    test('PUT /api/v1/students/me/profile endpoint also saves and returns updated details', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ phone: '+1 (555) 999-8888' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 999-8888');
    });
  });

  describe('3. Validation of Phone Numbers and Field Inputs', () => {
    test('Rejects invalid phone numbers with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ phone: 'invalid-letters-123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/valid phone number/i);
    });

    test('Rejects invalid emergency contact phone numbers with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ emergencyContact: { name: 'Parent', phone: 'abc' } });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/valid emergency contact phone number/i);
    });

    test('Rejects addresses exceeding length limit with 400', async () => {
      const longAddress = 'A'.repeat(350);
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ address: longAddress });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cannot exceed 300 characters/i);
    });
  });

  describe('4. Security & Tenant Isolation', () => {
    test('Rejects attempts to modify protected company-managed fields', async () => {
      const forbiddenFields = [
        { role: 'admin' },
        { email: 'hacked@school.edu' },
        { name: 'Impostor' },
        { studentId: 'NEW-ID-999' },
        { password: 'newpassword123' },
        { grades: [100, 100] },
        { attendance: 100 },
        { major: 'Computer Science' },
        { tenantId: new mongoose.Types.ObjectId().toString() }
      ];

      for (const payload of forbiddenFields) {
        const res = await request(app)
          .put('/api/v1/auth/profile')
          .set('Authorization', `Bearer ${aliceToken}`)
          .send(payload);

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('FORBIDDEN_PROFILE_FIELD');
      }
    });

    test('Student identity is derived from verified token; cannot modify another student', async () => {
      // Alice tries to update Bob by passing Bob's ID in body
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          _id: studentBobId.toString(),
          phone: '+1 (555) 000-0000'
        });

      // Should be rejected because _id is a forbidden company-managed field
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FORBIDDEN_PROFILE_FIELD');

      // Verify Bob's profile was completely untouched
      const bob = mockUsers[studentBobId.toString()];
      expect(bob.phone).toBe('+1 555-111-2222');
    });

    test('Unauthenticated requests are rejected with 401', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .send({ phone: '+1 (555) 123-4567' });

      expect(res.status).toBe(401);
    });
  });

  describe('5. Database Failure Handling', () => {
    test('Database error returns 500 without falsely reporting success', async () => {
      const original = User.findByIdAndUpdate;
      User.findByIdAndUpdate = function() {
        return {
          select: () => Promise.reject(new Error('Simulated MongoDB connection timeout')),
          then: (onFulfilled, onRejected) => Promise.reject(new Error('Simulated MongoDB connection timeout')).then(onFulfilled, onRejected)
        };
      };

      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ phone: '+1 (555) 777-8888' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Simulated MongoDB connection timeout');

      User.findByIdAndUpdate = original;
    });
  });

  describe('6. Frontend Routing & Component Integration Integrity', () => {
    test('SchoolStudentApp.jsx includes case "profile" and case "settings" rendering SettingsView', () => {
      const appCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/school/SchoolStudentApp.jsx'), 'utf-8');
      expect(appCode).toMatch(/case\s+['"]profile['"]:/);
      expect(appCode).toMatch(/case\s+['"]settings['"]:/);
      expect(appCode).toMatch(/<SettingsView\s+onCancel/);
    });

    test('CollegeStudentApp.jsx includes case "profile" and case "settings" rendering SettingsView', () => {
      const appCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/college/CollegeStudentApp.jsx'), 'utf-8');
      expect(appCode).toMatch(/case\s+['"]profile['"]:/);
      expect(appCode).toMatch(/case\s+['"]settings['"]:/);
      expect(appCode).toMatch(/<SettingsView/);
    });

    test('SchoolSidebar.jsx contains "My Profile" navigation item and clickable footer profile', () => {
      const sidebarCode = fs.readFileSync(path.resolve(__dirname, '../../src/components/school/SchoolSidebar.jsx'), 'utf-8');
      expect(sidebarCode).toContain("id: 'profile'");
      expect(sidebarCode).toContain("label: 'My Profile'");
      expect(sidebarCode).toMatch(/onClick=\{.*setActiveTab\(['"]profile['"]\)/);
    });

    test('SettingsView.jsx includes Cancel button, field-level error messages, and 3/3 completion count', () => {
      const settingsCode = fs.readFileSync(path.resolve(__dirname, '../../src/views/SettingsView.jsx'), 'utf-8');
      expect(settingsCode).toContain('handleCancel');
      expect(settingsCode).toContain('Cancel');
      expect(settingsCode).toContain('fieldErrors');
      expect(settingsCode).toContain('PHONE_REGEX');
      expect(settingsCode).toMatch(/Math\.round\(\(completedCount\s*\/\s*3\)\s*\*\s*100\)/);
    });

    test('apiService.js includes getProfile and updateStudentProfile', () => {
      const apiCode = fs.readFileSync(path.resolve(__dirname, '../../src/services/apiService.js'), 'utf-8');
      expect(apiCode).toContain('async getProfile()');
      expect(apiCode).toContain('async updateStudentProfile(');
    });

    test('DashboardView.jsx and SchoolDashboardView.jsx calculate 3/3 completion from actual server user data', () => {
      const schoolDash = fs.readFileSync(path.resolve(__dirname, '../../src/views/school/SchoolDashboardView.jsx'), 'utf-8');
      const collegeDash = fs.readFileSync(path.resolve(__dirname, '../../src/views/DashboardView.jsx'), 'utf-8');

      expect(schoolDash).toContain('emergencyContact?.name?.trim()');
      expect(schoolDash).toContain('emergencyContact?.phone?.trim()');
      expect(schoolDash).toMatch(/completedFieldsCount\s*===\s*3/);

      expect(collegeDash).toContain('emergencyContact?.name?.trim()');
      expect(collegeDash).toContain('emergencyContact?.phone?.trim()');
      expect(collegeDash).toMatch(/completedFieldsCount\s*===\s*3/);
    });
  });
});
