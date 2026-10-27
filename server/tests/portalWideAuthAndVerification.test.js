import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Batch from '../models/Batch.js';
import Submission from '../models/Submission.js';
import { getJwtSecret } from '../config/environment.js';
import { getAuthToken, normalizeApiUrl } from '../../src/services/apiService.js';

describe('Portal-Wide Authentication Repair & Section Verification Matrix', () => {
  const testRunId = Date.now();
  let superadminUser;
  let adminUser;
  let studentUser;
  let orphanUser;
  let demoCollege;
  let testBatch;
  let testCourse;
  let testAssignment;
  let testSubmission;
  let superadminToken;
  let adminToken;
  let studentToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }

    // Create test tenant with unique slug/code
    demoCollege = await College.create({
      name: `EdWth Demo Academy ${testRunId}`,
      code: `EDA-${testRunId}`,
      slug: `eda-${testRunId}`,
      institutionType: 'college',
      status: 'active'
    });

    // Create SuperAdmin (company-wide, tenantId: null)
    superadminUser = await User.create({
      name: `Super Administrator ${testRunId}`,
      email: `superadmin-${testRunId}@edwth.com`,
      studentId: `SUP-${testRunId}`,
      role: 'superadmin',
      password: 'HashedPassword123!',
      isTwoFactorEnabled: true,
      mfaEnforced: true,
      tenantId: null
    });
    superadminToken = jwt.sign({ id: superadminUser._id }, getJwtSecret(), { expiresIn: '7d' });

    // Create Institution Admin (scoped to demoCollege)
    adminUser = await User.create({
      name: `College Administrator ${testRunId}`,
      email: `admin-${testRunId}@eda.edu`,
      studentId: `ADM-${testRunId}`,
      role: 'admin',
      password: 'HashedPassword123!',
      isTwoFactorEnabled: true,
      mfaEnforced: false,
      tenantId: demoCollege._id
    });
    adminToken = jwt.sign({ id: adminUser._id }, getJwtSecret(), { expiresIn: '7d' });

    // Create Student (scoped to demoCollege)
    studentUser = await User.create({
      name: `Alice Scholar ${testRunId}`,
      email: `alice-${testRunId}@eda.edu`,
      studentId: `STU-${testRunId}`,
      role: 'student',
      password: 'HashedPassword123!',
      isTwoFactorEnabled: false,
      mfaEnforced: false,
      tenantId: demoCollege._id
    });
    studentToken = jwt.sign({ id: studentUser._id }, getJwtSecret(), { expiresIn: '7d' });

    // Seed test academic records
    testBatch = await Batch.create({
      name: `Batch AI-${testRunId}`,
      code: `BAI-${testRunId}`,
      tenantId: demoCollege._id,
      department: 'School of Computing',
      semester: 'Fall 2026'
    });

    testCourse = await Course.create({
      id: `CS-${testRunId}`,
      title: `Advanced Machine Learning ${testRunId}`,
      code: `CS-${testRunId}`,
      tenantId: demoCollege._id,
      department: 'School of Computing'
    });

    testAssignment = await Assignment.create({
      id: `ASG-${testRunId}`,
      title: `Neural Networks Lab ${testRunId}`,
      courseId: String(testCourse._id),
      tenantId: demoCollege._id,
      points: 100
    });

    testSubmission = await Submission.create({
      studentId: studentUser._id,
      studentIdentifier: `STU-${testRunId}`,
      studentName: `Alice Scholar ${testRunId}`,
      assignmentId: testAssignment._id,
      tenantId: demoCollege._id,
      status: 'submitted',
      score: null
    });
  });

  afterAll(async () => {
    try {
      if (demoCollege?._id) await College.deleteOne({ _id: demoCollege._id });
      if (superadminUser?._id) await User.deleteOne({ _id: superadminUser._id });
      if (adminUser?._id) await User.deleteOne({ _id: adminUser._id });
      if (studentUser?._id) await User.deleteOne({ _id: studentUser._id });
      if (orphanUser?._id) await User.deleteOne({ _id: orphanUser._id });
      if (testBatch?._id) await Batch.deleteOne({ _id: testBatch._id });
      if (testCourse?._id) await Course.deleteOne({ _id: testCourse._id });
      if (testAssignment?._id) await Assignment.deleteOne({ _id: testAssignment._id });
      if (testSubmission?._id) await Submission.deleteOne({ _id: testSubmission._id });
    } catch {
      // Ignore teardown errors
    }
  });

  describe('1. Shared API Client & URL Normalization', () => {
    it('normalizes relative endpoints starting with /api/ correctly', () => {
      const normalized = normalizeApiUrl('/api/v1/admin/batches');
      expect(normalized).toContain('/api/v1/admin/batches');
    });

    it('normalizes shorthand endpoints without leading slash', () => {
      const normalized = normalizeApiUrl('admin/academic-ops');
      expect(normalized).toContain('/api/v1/admin/academic-ops');
    });

    it('preserves fully-qualified HTTP/HTTPS URLs', () => {
      expect(normalizeApiUrl('https://api.edwth.com/api/v1/health')).toBe('https://api.edwth.com/api/v1/health');
    });

    it('resolves tokens across multiple keys without crashing', () => {
      const token = getAuthToken();
      // In Node environment without window/localStorage, safely returns null without throwing
      expect(token === null || typeof token === 'string').toBe(true);
    });
  });

  describe('2. Authentication Fail-Closed Enforcement (Missing & Invalid Tokens)', () => {
    it('rejects unauthenticated requests to Assignments & Assessment Operations with exact 401 Not authorized, no token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/academic-ops');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Not authorized, no token');
    });

    it('rejects expired or forged token with 401 Not authorized, token failed', async () => {
      const res = await request(app)
        .get('/api/v1/admin/academic-ops')
        .set('Authorization', 'Bearer forged.invalid.token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Not authorized, token failed');
    });

    it('rejects student role accessing admin sections with 403 Access denied', async () => {
      const res = await request(app)
        .get('/api/v1/admin/academic-ops')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden|Access denied|Insufficient/i);
    });
  });

  describe('3. Super Admin & Institution Admin Protected Sections Verification Matrix', () => {
    it('allows Super Admin to access Assignments & Assessment Operations (/admin/academic-ops)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/academic-ops')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('totalSubmissions');
      expect(res.body).toHaveProperty('batchBreakdown');
      expect(Array.isArray(res.body.batchBreakdown)).toBe(true);
    });

    it('allows Super Admin to access Company Overview Dashboard (/admin/overview)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('activeInstitutions');
    });

    it('allows Super Admin to access Batches (/admin/batches)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.batches)).toBe(true);
    });

    it('allows Super Admin to access Authorized Administrators (/admin/administrators)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/administrators')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.administrators)).toBe(true);
    });

    it('allows Super Admin to access Courses Catalog (/admin/courses)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.courses)).toBe(true);
    });

    it('allows Super Admin to access Audit Logs (/admin/audit-logs)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });

    it('allows Super Admin to query /data/courses across institutions without tenant error', async () => {
      const res = await request(app)
        .get('/api/v1/data/courses')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('allows Super Admin to query /data/assignments across institutions without tenant error', async () => {
      const res = await request(app)
        .get('/api/v1/data/assignments')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('allows Institution Admin to query /data/courses strictly scoped to their tenant', async () => {
      const res = await request(app)
        .get('/api/v1/data/courses')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(c => {
        expect(c.tenantId.toString()).toBe(demoCollege._id.toString());
      });
    });

    it('blocks users lacking tenantId from accessing tenant-scoped /data routes with 403', async () => {
      orphanUser = await User.create({
        name: `Orphan Student ${testRunId}`,
        email: `orphan-${testRunId}@test.com`,
        studentId: `ORP-${testRunId}`,
        role: 'student',
        password: 'Password123!',
        tenantId: null
      });
      const orphanToken = jwt.sign({ id: orphanUser._id }, getJwtSecret(), { expiresIn: '1h' });

      const res = await request(app)
        .get('/api/v1/data/courses')
        .set('Authorization', `Bearer ${orphanToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('MISSING_TENANT_CONTEXT');
    });
  });

  describe('4. Cookie Authentication Support', () => {
    it('authenticates Super Admin via HTTP cookie (jwt)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/academic-ops')
        .set('Cookie', [`jwt=${superadminToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Cross-Tenant Isolation & Anti-Tampering Verification', () => {
    let tenantB;
    let adminB;
    let adminBToken;
    let courseB;

    beforeAll(async () => {
      tenantB = await College.create({
        name: `Tenant B Academy ${testRunId}`,
        code: `TB-${testRunId}`,
        slug: `tb-${testRunId}`,
        institutionType: 'college',
        status: 'active'
      });

      adminB = await User.create({
        name: `Admin B ${testRunId}`,
        email: `adminb-${testRunId}@tb.edu`,
        studentId: `ADMB-${testRunId}`,
        role: 'admin',
        password: 'HashedPassword123!',
        tenantId: tenantB._id
      });
      adminBToken = jwt.sign({ id: adminB._id }, getJwtSecret(), { expiresIn: '1h' });

      courseB = await Course.create({
        id: `CS-TB-${testRunId}`,
        title: `Tenant B Algorithms ${testRunId}`,
        code: `CSTB-${testRunId}`,
        tenantId: tenantB._id,
        department: 'School of Mathematics'
      });
    });

    afterAll(async () => {
      try {
        if (tenantB?._id) await College.deleteOne({ _id: tenantB._id });
        if (adminB?._id) await User.deleteOne({ _id: adminB._id });
        if (courseB?._id) await Course.deleteOne({ _id: courseB._id });
      } catch {}
    });

    it('Admin A cannot view Tenant B courses even when passing Tenant B id in query string', async () => {
      const res = await request(app)
        .get(`/api/v1/data/courses?tenantId=${tenantB._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // All returned courses MUST belong strictly to demoCollege (Tenant A), never Tenant B
      res.body.forEach(c => {
        expect(c.tenantId.toString()).toBe(demoCollege._id.toString());
        expect(c.tenantId.toString()).not.toBe(tenantB._id.toString());
      });
    });

    it('Admin B cannot view Tenant A courses', async () => {
      const res = await request(app)
        .get('/api/v1/data/courses')
        .set('Authorization', `Bearer ${adminBToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach(c => {
        expect(c.tenantId.toString()).toBe(tenantB._id.toString());
        expect(c.tenantId.toString()).not.toBe(demoCollege._id.toString());
      });
    });

    it('SuperAdmin has cross-tenant oversight and sees courses from both Tenant A and Tenant B', async () => {
      const res = await request(app)
        .get('/api/v1/data/courses')
        .set('Authorization', `Bearer ${superadminToken}`);
      expect(res.status).toBe(200);
      const tenantIds = res.body.map(c => c.tenantId?.toString());
      expect(tenantIds).toContain(demoCollege._id.toString());
      expect(tenantIds).toContain(tenantB._id.toString());
    });

    it('Unauthenticated requests are strictly rejected with 401 without token exposure', async () => {
      const res = await request(app).get('/api/v1/data/courses');
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain('secret');
      expect(JSON.stringify(res.body)).not.toContain('Bearer');
    });
  });
});
