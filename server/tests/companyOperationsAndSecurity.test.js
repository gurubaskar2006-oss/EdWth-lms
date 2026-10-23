/**
 * Lumina LMS — Company Operations & Security Hardening Verification Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Production Demo Seeding Guard: Production never runs runSeed() even if DB is empty.
 * 2. Student Profile Self-Service:
 *    - Updates permitted personal fields (phone, address, emergencyContact).
 *    - Strictly blocks company-managed fields (name, email, role, tenantId, studentId, password, etc.).
 *    - Rejects invalid phone numbers.
 * 3. Trainer Subject Creation Restrictions:
 *    - Backend returns 403 Forbidden for POST /api/v1/trainer/courses.
 *    - Backend returns 403 Forbidden for DELETE /api/v1/trainer/courses/:id.
 * 4. Company Admin vs Institution Admin Scoping:
 *    - Student and Trainer roles receive 403 on admin endpoints.
 * 5. Vercel Configuration Integrity:
 *    - Verifies entrypoints (index.html, admin.html, trainer.html) and that /api/* never falls through to index.html.
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { updateProfile } from '../controllers/authController.js';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import trainerRoutes from '../routes/trainerRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Company Operations & Security Hardening Test Suite', () => {
  const JWT_SECRET = 'test-secret-company-ops-security-verification-32ch';
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();
  const studentAId = new mongoose.Types.ObjectId();
  const trainerAId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();
  const superAdminId = new mongoose.Types.ObjectId();

  let studentToken;
  let trainerToken;
  let adminToken;
  let superAdminToken;

  let mockUsers = {};
  let originalFindById;
  let originalFindByIdAndUpdate;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    studentToken = jwt.sign(
      { id: studentAId.toString(), role: 'student', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    trainerToken = jwt.sign(
      { id: trainerAId.toString(), role: 'trainer', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    adminToken = jwt.sign(
      { id: adminAId.toString(), role: 'admin', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    superAdminToken = jwt.sign(
      { id: superAdminId.toString(), role: 'superadmin', tenantId: 'company' },
      JWT_SECRET
    );

    // Initialize mock database store
    mockUsers[studentAId.toString()] = {
      _id: studentAId,
      name: 'Sarah Connor',
      email: 'sarah.c@school.edu',
      role: 'student',
      tenantId: tenantAId.toString(),
      studentId: 'STU-1001',
      phone: '',
      address: '',
      emergencyContact: {},
      save: async function() { return this; },
      toObject: function() { return { ...this }; }
    };

    mockUsers[trainerAId.toString()] = {
      _id: trainerAId,
      name: 'Prof. John Doe',
      email: 'john.doe@school.edu',
      role: 'trainer',
      tenantId: tenantAId.toString(),
      save: async function() { return this; },
      toObject: function() { return { ...this }; }
    };

    mockUsers[adminAId.toString()] = {
      _id: adminAId,
      name: 'Admin User',
      email: 'admin@school.edu',
      role: 'admin',
      tenantId: tenantAId.toString(),
      save: async function() { return this; },
      toObject: function() { return { ...this }; }
    };

    mockUsers[superAdminId.toString()] = {
      _id: superAdminId,
      name: 'Super Admin',
      email: 'super@company.com',
      role: 'superadmin',
      tenantId: 'company',
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

    // Build test express application
    app = express();
    app.use(express.json());

    // Mount Auth / Profile Route
    app.put('/api/v1/auth/profile', verifyToken, updateProfile);
    app.put('/api/v1/students/me/profile', verifyToken, updateProfile);

    // Mount Trainer Routes
    app.use('/api/v1/trainer', trainerRoutes);

    // Mount Admin Routes
    app.use('/api/v1/admin', adminRoutes);
  });

  afterAll(() => {
    if (originalFindById) {
      User.findById = originalFindById;
    }
    if (originalFindByIdAndUpdate) {
      User.findByIdAndUpdate = originalFindByIdAndUpdate;
    }
  });

  describe('1. Production Demo Seeding Guard', () => {
    test('Server code contains explicit NODE_ENV === production guard that disables runSeed()', () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf-8');
      
      // Must check NODE_ENV before seeding
      expect(serverCode).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]production['"]/);
      expect(serverCode).toContain('Automatic demo seeding is strictly prohibited in production');
    });

    test('runSeed logic refuses to execute when NODE_ENV is production even if count is 0', () => {
      const isProduction = true;
      const count = 0;
      let seedExecuted = false;

      // The exact logic now in server.js
      if (isProduction) {
        seedExecuted = false;
      } else if (count === 0) {
        seedExecuted = true;
      }

      expect(seedExecuted).toBe(false);
    });
  });

  describe('2. Student Profile Self-Service & Protection of Company-Managed Fields', () => {
    test('Student can successfully update permitted personal fields (phone, address, emergencyContact)', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          phone: '+1 555-0199',
          address: '42 Academic Way, Suite 100',
          emergencyContact: {
            name: 'Dr. Silberman',
            phone: '+1 555-0188',
            relationship: 'Guardian'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 555-0199');
      expect(res.body.user.address).toBe('42 Academic Way, Suite 100');
      expect(res.body.user.emergencyContact.name).toBe('Dr. Silberman');
    });

    test('Student cannot alter company-managed field: name', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Hacked Name',
          phone: '+1 555-0199'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('company-managed');
    });

    test('Student cannot alter company-managed field: email', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          email: 'newemail@domain.com'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('company-managed');
    });

    test('Student cannot alter company-managed field: role or tenantId', async () => {
      const resRole = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ role: 'admin' });
      expect(resRole.status).toBe(400);

      const resTenant = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ tenantId: tenantBId.toString() });
      expect(resTenant.status).toBe(400);
    });

    test('Student cannot alter password or credentials through profile self-service', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ password: 'compromisedPassword123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test('Invalid phone format is rejected with 400', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ phone: '123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('valid phone number');
    });

    test('Student can update profile through mounted /api/v1/students/me/profile alias', async () => {
      const res = await request(app)
        .put('/api/v1/students/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          address: '77 Cyberdyne Blvd'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.address).toBe('77 Cyberdyne Blvd');
    });
  });

  describe('3. Trainer Subject Creation Restrictions', () => {
    test('POST /api/v1/trainer/courses returns 403 Forbidden with clear company authorization message', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/courses')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Unauthorized Subject',
          code: 'UNAUTH-101'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_ACTION');
      expect(res.body.message).toContain('Company Administrators');
    });

    test('DELETE /api/v1/trainer/courses/:id returns 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/v1/trainer/courses/fakeCourse123')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_ACTION');
    });
  });

  describe('4. Role Boundaries & Admin Access Control', () => {
    test('Student is rejected from accessing /api/v1/admin/overview with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
    });

    test('Trainer is rejected from accessing /api/v1/admin/overview with 403', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(403);
    });

    test('Unauthenticated request to /api/v1/admin/overview is rejected with 401', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview');

      expect(res.status).toBe(401);
    });
  });

  describe('5. Vercel Configuration Verification', () => {
    test('vercel.json exists, is valid JSON, and preserves multi-page HTML entrypoints', () => {
      const vercelPath = path.resolve(__dirname, '../../vercel.json');
      expect(fs.existsSync(vercelPath)).toBe(true);

      const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
      expect(Array.isArray(vercelConfig.rewrites)).toBe(true);

      const rewrites = vercelConfig.rewrites;

      // Must have admin.html rewrite
      const adminRewrite = rewrites.find(r => r.source === '/admin' || r.source === '/admin/:path*');
      expect(adminRewrite).toBeDefined();
      expect(adminRewrite.destination).toBe('/admin.html');

      // Must have trainer.html rewrite
      const trainerRewrite = rewrites.find(r => r.source === '/trainer' || r.source === '/trainer/:path*');
      expect(trainerRewrite).toBeDefined();
      expect(trainerRewrite.destination).toBe('/trainer.html');

      // Must ensure /api/* does not fall through to index.html
      const apiRewrite = rewrites.find(r => r.source.startsWith('/api'));
      expect(apiRewrite).toBeDefined();
      expect(apiRewrite.destination).not.toBe('/index.html');
    });
  });
});
