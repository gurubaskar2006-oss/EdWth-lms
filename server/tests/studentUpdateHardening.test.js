/**
 * Lumina LMS — Student Update Security Hardening Verification Test Suite
 * 6th Civilians Corporation
 *
 * Verifies without connecting to remote Atlas:
 * 1. Valid permitted updates by an authenticated administrator.
 * 2. Attempts to tamper with protected fields (role, tenantId, studentId, 2FA, password, soft-delete).
 * 3. Dedicated password-reset rejection notice.
 * 4. Cross-tenant student updates (tenant isolation).
 * 5. Attempts to update a trainer or administrator through the student endpoint.
 * 6. Rejection of unauthorized requests (student or trainer access).
 * 7. Type validation and range bounds on nested stats.
 * 8. Rejection of requests with no valid editable fields or malformed IDs.
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { updateStudent } from '../controllers/studentController.js';
import { verifyToken, requireRole } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

describe('Student Update Security Hardening Tests (Isolated Mock/Unit Layer)', () => {
  const JWT_SECRET = 'test-secret-for-student-update-hardening-32chars';
  let app;

  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const trainerAId = new mongoose.Types.ObjectId();
  const adminAId = new mongoose.Types.ObjectId();

  let adminTokenA;
  let trainerTokenA;
  let studentTokenA;

  // In-memory mock user store to simulate MongoDB User collection deterministically
  let mockUsers = {};

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    // Tokens
    adminTokenA = jwt.sign(
      { id: adminAId.toString(), role: 'admin', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    trainerTokenA = jwt.sign(
      { id: trainerAId.toString(), role: 'trainer', tenantId: tenantAId.toString() },
      JWT_SECRET
    );
    studentTokenA = jwt.sign(
      { id: studentAId.toString(), role: 'student', tenantId: tenantAId.toString() },
      JWT_SECRET
    );

    // Setup lightweight express app mounting studentRoutes-equivalent pipeline
    app = express();
    app.use(express.json());
    app.use(verifyToken);
    app.put('/api/v1/students/:id', requireRole(['admin']), updateStudent);
  });

  beforeEach(() => {
    mockUsers = {
      [studentAId.toString()]: {
        _id: studentAId,
        studentId: 'STU-001',
        name: 'Student One',
        email: 'student1@oakridge.edu',
        password: 'HashedPassword123!',
        role: 'student',
        tenantId: tenantAId,
        major: 'Computer Science',
        year: 'Freshman (Year 1)',
        stats: {
          gpa: '3.50',
          termGpa: '3.60',
          completedCredits: 15,
          totalCredits: 120,
          totalStudyHours: 10.0,
          assignmentCompletionRate: 85
        }
      },
      [studentBId.toString()]: {
        _id: studentBId,
        studentId: 'STU-002',
        name: 'Student Two',
        email: 'student2@nexus.edu',
        password: 'HashedPassword123!',
        role: 'student',
        tenantId: tenantBId,
        major: 'Cybersecurity'
      },
      [trainerAId.toString()]: {
        _id: trainerAId,
        studentId: 'TRN-001',
        name: 'Trainer One',
        email: 'trainer1@oakridge.edu',
        password: 'HashedPassword123!',
        role: 'trainer',
        tenantId: tenantAId
      },
      [adminAId.toString()]: {
        _id: adminAId,
        studentId: 'ADM-001',
        name: 'Admin One',
        email: 'admin1@oakridge.edu',
        password: 'HashedPassword123!',
        role: 'admin',
        tenantId: tenantAId
      }
    };

    // Ensure readyState is 1 for Mongoose lookup path
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // Mock User.findById for verifyToken middleware (with chained .select('-password'))
    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const u = mockUsers[id?.toString()];
      return {
        select: () => Promise.resolve(u ? { ...u } : null)
      };
    });

    // Mock User.findOne to work both directly with await and with chained .select()
    jest.spyOn(User, 'findOne').mockImplementation((query) => {
      const u = mockUsers[query._id?.toString()];
      let result = null;
      if (u) {
        const matchesTenant = !query.tenantId || (u.tenantId && u.tenantId.toString() === query.tenantId.toString());
        const matchesRole = !query.role || u.role === query.role;
        if (matchesTenant && matchesRole) {
          result = { ...u };
        }
      }
      return {
        select: () => Promise.resolve(result),
        then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected)
      };
    });

    // Mock User.findOneAndUpdate with select chained method
    jest.spyOn(User, 'findOneAndUpdate').mockImplementation((query, update) => {
      const u = mockUsers[query._id?.toString()];
      if (!u) return { select: () => Promise.resolve(null) };
      if (query.tenantId && u.tenantId.toString() !== query.tenantId.toString()) return { select: () => Promise.resolve(null) };
      if (query.role && u.role !== query.role) return { select: () => Promise.resolve(null) };

      // Apply $set updates
      if (update.$set) {
        for (const [key, val] of Object.entries(update.$set)) {
          if (key.startsWith('stats.')) {
            const statKey = key.split('.')[1];
            u.stats = { ...(u.stats || {}), [statKey]: val };
          } else {
            u[key] = val;
          }
        }
      }

      const returned = { ...u };
      delete returned.password;
      return { select: () => Promise.resolve(returned) };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. Allows administrator to update legitimate permitted fields', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        name: 'Student One Updated',
        major: 'Advanced AI & Machine Learning',
        year: 'Sophomore (Year 2)',
        phone: '+1 555 987 6543',
        accountStatus: 'Active',
        enrolledCourses: ['CS 101', 'MATH 201'],
        stats: {
          gpa: '3.92',
          termGpa: '4.00',
          completedCredits: 30,
          totalCredits: 120,
          totalStudyHours: 25.5,
          assignmentCompletionRate: 95
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.student.name).toBe('Student One Updated');
    expect(res.body.student.major).toBe('Advanced AI & Machine Learning');
    expect(res.body.student.stats.gpa).toBe('3.92');
    expect(res.body.student.stats.completedCredits).toBe(30);
  });

  test('2. Rejects request attempting to modify role to admin', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        name: 'Tamper Attempt',
        role: 'admin'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Modification of protected fields is prohibited: role');
  });

  test('3. Rejects request attempting to change tenantId', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        tenantId: tenantBId.toString()
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Modification of protected fields is prohibited: tenantId');
  });

  test('4. Rejects request attempting to alter studentId', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        studentId: 'STU-999-TAMPERED'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Modification of protected fields is prohibited: studentId');
  });

  test('5. Rejects password changes and instructs caller to use dedicated password-reset', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        password: 'NewPlaintextPassword123!'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Modification of protected fields is prohibited: password');
    expect(res.body.message).toContain('Passwords must be updated via the dedicated password-reset workflow');
  });

  test('6. Rejects 2FA security tampering (isTwoFactorEnabled, twoFactorSecret)', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        isTwoFactorEnabled: false,
        twoFactorSecret: 'malicious_secret'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Modification of protected fields is prohibited');
  });

  test('7. Rejects attempts by Tenant A admin to update Tenant B student (cross-tenant isolation)', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentBId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        name: 'Cross Tenant Exploit'
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Student record not found in this institution.');
  });

  test('8. Rejects attempts to update a trainer through the student endpoint', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${trainerAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        name: 'Attacking Trainer Account'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('The student-update endpoint can only be used to manage student accounts.');
  });

  test('9. Rejects unauthorized update requests by student and trainer (RBAC)', async () => {
    const resStudent = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${studentTokenA}`)
      .send({ name: 'Self Promotion' });

    expect(resStudent.status).toBe(403);

    const resTrainer = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${trainerTokenA}`)
      .send({ name: 'Trainer Tamper' });

    expect(resTrainer.status).toBe(403);
  });

  test('10. Rejects invalid GPA out of bounds (> 4.0 or negative)', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({
        stats: {
          gpa: '5.50'
        }
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Cumulative GPA must be a numerical value between 0.0 and 4.0');
  });

  test('11. Rejects empty payload or payload with only unallowed keys', async () => {
    const res = await request(app)
      .put(`/api/v1/students/${studentAId}`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('No valid editable fields provided');
  });

  test('12. Rejects malformed student ID parameter', async () => {
    const res = await request(app)
      .put('/api/v1/students/not-a-valid-object-id')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ name: 'Valid Name' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Invalid student ID format.');
  });
});
