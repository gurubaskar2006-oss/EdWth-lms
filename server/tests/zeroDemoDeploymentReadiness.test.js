import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB, closeDB } from '../database/mongoose.js';
import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assessment from '../models/Assessment.js';
import authRoutes from '../routes/authRoutes.js';
import trainerRoutes from '../routes/trainerRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';
import { runSeed } from '../scripts/seedData.js';
import { getJwtSecret } from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina LMS — Zero-Demo Working Portal & Deployment Readiness Suite', () => {
  let app;
  let tenant1Id;
  let tenant2Id;
  let trainerToken;
  let adminToken;
  let superadminToken;
  let batch1Id;
  let jwtSecret;

  beforeAll(async () => {
    await connectDB();
    jwtSecret = getJwtSecret();

    app = express();
    app.use(express.json());
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/trainer', trainerRoutes);
    app.use('/api/v1/admin', adminRoutes);

    // Isolated test fixtures in MongoMemoryServer
    tenant1Id = new mongoose.Types.ObjectId();
    tenant2Id = new mongoose.Types.ObjectId();
    batch1Id = new mongoose.Types.ObjectId();

    await College.create({
      _id: tenant1Id,
      name: 'Alpha High School',
      code: 'ALPHA',
      slug: 'alpha',
      institutionType: 'school',
      status: 'active'
    });

    await College.create({
      _id: tenant2Id,
      name: 'Beta Academy',
      code: 'BETA',
      slug: 'beta',
      institutionType: 'school',
      status: 'active'
    });

    const hashedPassword = await bcrypt.hash('SecurePass@123', 10);

    const trainerUser = await User.create({
      _id: new mongoose.Types.ObjectId(),
      studentId: 'TRN-ALPHA-01',
      name: 'Test Teacher',
      email: 'teacher@alpha.edu',
      password: hashedPassword,
      role: 'trainer',
      tenantId: tenant1Id,
      batchId: null
    });

    const adminUser = await User.create({
      _id: new mongoose.Types.ObjectId(),
      studentId: 'ADM-ALPHA-01',
      name: 'Alpha Administrator',
      email: 'admin@alpha.edu',
      password: hashedPassword,
      role: 'admin',
      tenantId: tenant1Id
    });

    const superadminUser = await User.create({
      _id: new mongoose.Types.ObjectId(),
      studentId: 'SUP-CORP-01',
      name: 'Corp Operations Superadmin',
      email: 'superadmin@corp.org',
      password: hashedPassword,
      role: 'superadmin',
      tenantId: null
    });

    trainerToken = jwt.sign(
      { id: trainerUser._id.toString(), role: trainerUser.role, tenantId: trainerUser.tenantId.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    adminToken = jwt.sign(
      { id: adminUser._id.toString(), role: adminUser.role, tenantId: adminUser.tenantId.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    superadminToken = jwt.sign(
      { id: superadminUser._id.toString(), role: superadminUser.role, tenantId: null },
      jwtSecret,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    await College.deleteMany({ _id: { $in: [tenant1Id, tenant2Id] } });
    await User.deleteMany({ email: { $in: ['teacher@alpha.edu', 'admin@alpha.edu', 'superadmin@corp.org'] } });
    await closeDB();
  });

  describe('1. Production Seeding Guard & Zero-Demo Safeguard', () => {
    it('runSeed strictly throws if NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      await expect(runSeed()).rejects.toThrow(/Automatic demo seeding is strictly prohibited in production/i);
      process.env.NODE_ENV = originalEnv;
    });

    it('runSeed skips execution if ALLOW_SEED is not enabled and force is not set', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalAllow = process.env.ALLOW_SEED;
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_SEED = 'false';

      // Should complete without throwing and without seeding demo records
      await expect(runSeed({ force: false })).resolves.toBeUndefined();

      process.env.NODE_ENV = originalEnv;
      process.env.ALLOW_SEED = originalAllow;
    });

    it('server.js startup code does not auto-seed unless AUTO_SEED is explicitly true', () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf-8');
      expect(serverCode).toContain("process.env.AUTO_SEED === 'true'");
      expect(serverCode).not.toContain("userCount === 0 || process.env.AUTO_SEED === 'true'");
    });
  });

  describe('2. Empty State Workflows Across Roles', () => {
    it('trainer classes endpoint returns empty array and count 0 when no batches exist', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/classes')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.classes)).toBe(true);
      expect(res.body.classes.length).toBe(0);
    });

    it('trainer students endpoint returns empty array and count 0 when no students are enrolled', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/students')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.students)).toBe(true);
      expect(res.body.students.length).toBe(0);
    });

    it('trainer analytics endpoint returns clean zero metrics and null rates when no records exist', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/analytics')
        .set('Authorization', `Bearer ${trainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStudents).toBe(0);
      expect(res.body.data.totalAttendance).toBe(0);
      expect(res.body.data.attendanceRate).toBeNull();
      expect(res.body.data.totalSubmissions).toBe(0);
      expect(res.body.data.averageScore).toBeNull();
    });

    it('institution admin institutions directory returns only their institution with correct zero counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      const inst = res.body.institutions[0];
      expect(inst.name).toBe('Alpha High School');
      expect(inst.studentCount).toBe(0);
      expect(inst.trainerCount).toBe(1); // Test teacher
      expect(inst.batchCount).toBe(0);
    });

    it('institution admin overview displays accurate zero counts and isSuperAdmin false', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(false);
      expect(res.body.data.users.students).toBe(0);
      expect(res.body.data.users.trainers).toBe(1);
      expect(res.body.data.users.admins).toBe(1);
      expect(res.body.data.batches).toBe(0);
      expect(res.body.data.courses).toBe(0);
    });
  });

  describe('3. Profile Management & Role Scoping', () => {
    it('trainer can update contact phone and address without requiring emergency contacts', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          phone: '+1 (555) 777-8888',
          address: 'Building A, Room 204'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 777-8888');
      expect(res.body.user.address).toBe('Building A, Room 204');
    });

    it('rejects attempt to modify company-managed fields', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          role: 'superadmin',
          email: 'hacked@corp.org'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('FORBIDDEN_PROFILE_FIELD');
    });
  });

  describe('4. Assessment Creation Without Fabricated Stored Results', () => {
    it('trainer can schedule an assessment without generating artificial submissions', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/tests')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          title: 'Midterm Coding Exam',
          subject: 'Computer Science',
          date: '2026-11-15',
          durationMinutes: 90,
          totalMarks: 100
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.test.title).toBe('Midterm Coding Exam');

      // Verify no fake attempts were created
      const attemptsCount = await mongoose.model('AssessmentAttempt').countDocuments({
        assessmentId: res.body.test._id
      });
      expect(attemptsCount).toBe(0);

      // Clean up
      await Assessment.findByIdAndDelete(res.body.test._id);
    });
  });

  describe('5. Authentication Security (No Datasheet Backdoor)', () => {
    it('rejects unknown user and does not authenticate against legacy demo datasheet', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'alex.vance@mit.edu', // Exists in legacy datasheet but NOT in MongoDB
          password: 'Alex#Nexus2026!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
