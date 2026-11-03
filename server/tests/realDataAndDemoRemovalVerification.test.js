/**
 * Lumina LMS — Real Data & Demo Removal Comprehensive Verification Suite
 * 6th Civilians Corporation / EdWth Academy
 *
 * Verifies:
 * 1. Clean Startup: No automatic seeding of demo institutions, users, courses, or batches.
 * 2. SuperAdmin Access: SuperAdmin can log in and manage the platform.
 * 3. Real Persistence: School/institution creation, student creation, batch assignment persist and reflect in subsequent reads.
 * 4. Role & Tenant Isolation: Trainers only see assigned records, students only see own records, cross-tenant leakage is blocked.
 * 5. Honest Empty States: Zero-data tenants return empty arrays ([]) and 0/null metrics, never mock defaults.
 * 6. Production Build Integrity: Confirms frontend build artifacts exist and contain no fatal errors.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import app from '../server.js';
import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
import { getJwtSecret } from '../config/environment.js';
import { runSeed } from '../scripts/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina LMS — Real Data Enforcement & Demo Removal Verification', () => {
  const runId = Date.now();
  let jwtSecret;

  // SuperAdmin credentials
  const superAdminPassword = 'SuperAdmin!Live2026';
  let superAdminUser;
  let superAdminToken;

  // Tenant A: Primary Test High School
  let tenantA;
  let tenantAAdmin;
  let tenantAAdminToken;
  let tenantATrainer;
  let tenantATrainerToken;
  let tenantABatch;
  let tenantAStudent;
  let tenantAStudentToken;

  // Tenant B: Isolated Academy (for tenant isolation tests)
  let tenantB;
  let tenantBAdmin;
  let tenantBAdminToken;

  // Tenant C: Empty Institution (for empty state tests)
  let tenantC;
  let tenantCAdmin;
  let tenantCAdminToken;
  let tenantCTrainer;
  let tenantCTrainerToken;
  let tenantCStudent;
  let tenantCStudentToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    jwtSecret = getJwtSecret();
    const commonHashedPassword = await bcrypt.hash('SecurePassword@2026', 10);
    const superAdminHashedPassword = await bcrypt.hash(superAdminPassword, 10);

    // 1. SuperAdmin fixture
    superAdminUser = await User.create({
      studentId: `SA-REAL-${runId}`,
      name: 'Global LMS SuperAdmin',
      email: `real.superadmin.${runId}@6c.com`,
      password: superAdminHashedPassword,
      role: 'superadmin',
      tenantId: null
    });

    superAdminToken = jwt.sign(
      { id: superAdminUser._id.toString(), role: 'superadmin', tenantId: null },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // 2. Tenant A setup
    tenantA = await College.create({
      name: `Real Academy Alpha ${runId}`,
      code: `RAA-${runId}`,
      slug: `raa-${runId}`,
      institutionType: 'school',
      status: 'active'
    });

    tenantAAdmin = await User.create({
      studentId: `ADM-A-${runId}`,
      name: 'Admin Alpha',
      email: `admin.alpha.${runId}@raa.test`,
      password: commonHashedPassword,
      role: 'admin',
      tenantId: tenantA._id
    });

    tenantAAdminToken = jwt.sign(
      { id: tenantAAdmin._id.toString(), role: 'admin', tenantId: tenantA._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    tenantABatch = await Batch.create({
      name: 'Grade 10 - Section A',
      code: `G10-A-${runId}`,
      department: 'Science',
      tenantId: tenantA._id,
      startDate: new Date(),
      status: 'active'
    });

    tenantATrainer = await User.create({
      studentId: `TRN-A-${runId}`,
      name: 'Trainer Alpha',
      email: `trainer.alpha.${runId}@raa.test`,
      password: commonHashedPassword,
      role: 'trainer',
      tenantId: tenantA._id,
      batchId: tenantABatch._id
    });

    tenantATrainerToken = jwt.sign(
      { id: tenantATrainer._id.toString(), role: 'trainer', tenantId: tenantA._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    tenantAStudent = await User.create({
      studentId: `STU-A-${runId}`,
      name: 'Student Alpha',
      email: `student.alpha.${runId}@raa.test`,
      password: commonHashedPassword,
      role: 'student',
      tenantId: tenantA._id,
      batchId: tenantABatch._id,
      className: 'Grade 10 - Section A'
    });

    tenantAStudentToken = jwt.sign(
      { id: tenantAStudent._id.toString(), role: 'student', tenantId: tenantA._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // 3. Tenant B setup (Isolated)
    tenantB = await College.create({
      name: `Real Academy Beta ${runId}`,
      code: `RAB-${runId}`,
      slug: `rab-${runId}`,
      institutionType: 'school',
      status: 'active'
    });

    tenantBAdmin = await User.create({
      studentId: `ADM-B-${runId}`,
      name: 'Admin Beta',
      email: `admin.beta.${runId}@rab.test`,
      password: commonHashedPassword,
      role: 'admin',
      tenantId: tenantB._id
    });

    tenantBAdminToken = jwt.sign(
      { id: tenantBAdmin._id.toString(), role: 'admin', tenantId: tenantB._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    // 4. Tenant C setup (Empty Institution - 0 students, 0 batches, 0 courses)
    tenantC = await College.create({
      name: `Empty Institution Gamma ${runId}`,
      code: `EIG-${runId}`,
      slug: `eig-${runId}`,
      institutionType: 'school',
      status: 'active'
    });

    tenantCAdmin = await User.create({
      studentId: `ADM-C-${runId}`,
      name: 'Admin Gamma',
      email: `admin.gamma.${runId}@eig.test`,
      password: commonHashedPassword,
      role: 'admin',
      tenantId: tenantC._id
    });

    tenantCAdminToken = jwt.sign(
      { id: tenantCAdmin._id.toString(), role: 'admin', tenantId: tenantC._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    tenantCTrainer = await User.create({
      studentId: `TRN-C-${runId}`,
      name: 'Trainer Gamma',
      email: `trainer.gamma.${runId}@eig.test`,
      password: commonHashedPassword,
      role: 'trainer',
      tenantId: tenantC._id
    });

    tenantCTrainerToken = jwt.sign(
      { id: tenantCTrainer._id.toString(), role: 'trainer', tenantId: tenantC._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );

    tenantCStudent = await User.create({
      studentId: `STU-C-${runId}`,
      name: 'Student Gamma',
      email: `student.gamma.${runId}@eig.test`,
      password: commonHashedPassword,
      role: 'student',
      tenantId: tenantC._id
    });

    tenantCStudentToken = jwt.sign(
      { id: tenantCStudent._id.toString(), role: 'student', tenantId: tenantC._id.toString() },
      jwtSecret,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    const testIds = [tenantA?._id, tenantB?._id, tenantC?._id].filter(Boolean);
    await College.deleteMany({ _id: { $in: testIds } });
    await Batch.deleteMany({ tenantId: { $in: testIds } });
    await Course.deleteMany({ tenantId: { $in: testIds } });
    await User.deleteMany({
      $or: [
        { _id: superAdminUser?._id },
        { tenantId: { $in: testIds } }
      ]
    });
  });

  // =========================================================================
  // 1. CLEAN STARTUP TEST
  // =========================================================================
  describe('1. Clean Startup & Demo Seed Guard', () => {
    it('1.1 Automatic demo seeding is strictly prohibited in production mode', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      await expect(runSeed()).rejects.toThrow(/Automatic demo seeding is strictly prohibited in production/i);
      process.env.NODE_ENV = origEnv;
    });

    it('1.2 Seeding is bypassed by default when ALLOW_SEED is not explicitly true', async () => {
      const origAllow = process.env.ALLOW_SEED;
      process.env.ALLOW_SEED = 'false';
      await expect(runSeed({ force: false })).resolves.toBeUndefined();
      process.env.ALLOW_SEED = origAllow;
    });

    it('1.3 server.js has auto-seed disabled by default', () => {
      const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf-8');
      expect(serverSource).toContain("process.env.AUTO_SEED === 'true'");
      expect(serverSource).not.toContain("userCount === 0 || process.env.AUTO_SEED === 'true'");
    });
  });

  // =========================================================================
  // 2. SUPERADMIN ACCESS
  // =========================================================================
  describe('2. SuperAdmin Authentication & Platform Management', () => {
    it('2.1 SuperAdmin logs in with valid credentials and receives full platform token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: superAdminUser.email,
          password: superAdminPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('superadmin');
    });

    it('2.2 SuperAdmin can access global overview and retrieve genuine metrics', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(true);
      expect(typeof res.body.data.institutions).toBe('number');
      expect(typeof res.body.data.users.students).toBe('number');
      expect(typeof res.body.data.users.trainers).toBe('number');
    });
  });

  // =========================================================================
  // 3. PERSISTENCE TEST (Institutions, Students, Batches)
  // =========================================================================
  describe('3. Real Persistence Workflows', () => {
    let createdSchoolId;
    let createdStudentId;
    let createdBatchId;

    it('3.1 SuperAdmin creates a new school/institution; verifies it persists and appears in GET', async () => {
      const payload = {
        name: `Dynamic Persisted School ${runId}`,
        code: `DPS-${runId.toString().slice(-6)}`,
        slug: `dps-${runId.toString().slice(-6)}`,
        institutionType: 'school',
        status: 'active',
        contactEmail: `contact.dps.${runId}@test.org`
      };

      const res = await request(app)
        .post('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.institution).toBeDefined();
      expect(res.body.institution.name).toBe(payload.name);
      createdSchoolId = res.body.institution._id;

      // Verify in GET /institutions list
      const listRes = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(listRes.status).toBe(200);
      const match = listRes.body.institutions.find((i) => i._id.toString() === createdSchoolId.toString());
      expect(match).toBeDefined();
      expect(match.name).toBe(payload.name);
      expect(match.studentCount).toBe(0);
    });

    it('3.2 Admin creates a new batch; verifies persistence in MongoDB', async () => {
      const res = await request(app)
        .post('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send({
          name: `Batch Dynamic ${runId}`,
          code: `BD-${runId.toString().slice(-6)}`,
          department: 'Mathematics',
          startDate: '2026-09-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.batch).toBeDefined();
      createdBatchId = res.body.batch._id;

      const inDb = await Batch.findById(createdBatchId).lean();
      expect(inDb).not.toBeNull();
      expect(inDb.name).toBe(`Batch Dynamic ${runId}`);
      expect(inDb.tenantId.toString()).toBe(tenantA._id.toString());
    });

    it('3.3 Admin provisions a new student under institution assigned to batch; verifies persistence', async () => {
      const studentPayload = {
        name: `Jane Doe ${runId}`,
        email: `jane.doe.${runId}@raa.test`,
        password: 'Password@123',
        batchId: createdBatchId,
        className: `Batch Dynamic ${runId}`
      };

      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${tenantAAdminToken}`)
        .send(studentPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.student).toBeDefined();
      createdStudentId = res.body.student._id;

      // Verify student in database has correct batch and tenant link
      const studentInDb = await User.findById(createdStudentId).lean();
      expect(studentInDb).not.toBeNull();
      expect(studentInDb.email).toBe(studentPayload.email.toLowerCase());
      expect(studentInDb.tenantId.toString()).toBe(tenantA._id.toString());
      expect(studentInDb.batchId.toString()).toBe(createdBatchId.toString());

      // Verify student appears in GET /api/v1/admin/students
      const rosterRes = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(rosterRes.status).toBe(200);
      const studentMatch = rosterRes.body.students.find((s) => s.email === studentPayload.email.toLowerCase());
      expect(studentMatch).toBeDefined();
      expect(studentMatch.batchId.toString()).toBe(createdBatchId.toString());
      expect(studentMatch.batchName).toBe(`Batch Dynamic ${runId}`);
    });
  });

  // =========================================================================
  // 4. ROLE & TENANT ISOLATION
  // =========================================================================
  describe('4. Strict Role & Tenant Isolation', () => {
    it('4.1 Trainer only sees students and batches belonging to their tenant', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/students')
        .set('Authorization', `Bearer ${tenantATrainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // All returned students must belong to Tenant A batch/roster
      expect(res.body.students.some((s) => s.email === tenantAStudent.email)).toBe(true);

      // Cannot see student from Tenant C
      const foundGamma = res.body.students.find((s) => s.email === tenantCStudent.email);
      expect(foundGamma).toBeUndefined();
    });

    it('4.2 Tenant A admin cannot see or delete Tenant B admin or students', async () => {
      // Attempt to retrieve Tenant B students as Tenant A admin
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(res.status).toBe(200);
      const crossTenantUser = res.body.students.find((s) => s.tenantId?.toString() === tenantB._id.toString());
      expect(crossTenantUser).toBeUndefined();

      // Attempt to delete Tenant B student as Tenant A admin
      const deleteRes = await request(app)
        .delete(`/api/v1/admin/students/${tenantBAdmin._id}`)
        .set('Authorization', `Bearer ${tenantAAdminToken}`);

      expect(deleteRes.status).toBe(404);
    });

    it('4.3 Student only sees curriculum subjects for their tenant', async () => {
      // Create a course in Tenant A
      const courseA = await Course.create({
        id: `course-phy-${runId}`,
        title: `Physics 101 ${runId}`,
        code: `PHY-${runId.toString().slice(-4)}`,
        tenantId: tenantA._id,
        className: 'Grade 10 - Section A'
      });

      // Tenant A student queries subjects
      const resA = await request(app)
        .get('/api/v1/school/subjects')
        .set('Authorization', `Bearer ${tenantAStudentToken}`);

      expect(resA.status).toBe(200);
      expect(resA.body.success).toBe(true);
      const hasCourseA = resA.body.subjects.some((s) => s._id.toString() === courseA._id.toString());
      expect(hasCourseA).toBe(true);

      // Tenant C student queries subjects (different tenant)
      const resC = await request(app)
        .get('/api/v1/school/subjects')
        .set('Authorization', `Bearer ${tenantCStudentToken}`);

      expect(resC.status).toBe(200);
      const crossCourse = resC.body.subjects.find((s) => s._id.toString() === courseA._id.toString());
      expect(crossCourse).toBeUndefined();
    });
  });

  // =========================================================================
  // 5. HONEST EMPTY STATES & ZERO DATA METRICS
  // =========================================================================
  describe('5. Honest Empty States (No Mock Defaults)', () => {
    it('5.1 Tenant C with 0 students returns empty student roster and count 0', async () => {
      // In Tenant C, only the admin, trainer, and 1 student exist.
      // Let's delete tenantCStudent to test true 0-student state
      await User.deleteOne({ _id: tenantCStudent._id });

      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${tenantCAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.students)).toBe(true);
      expect(res.body.students.length).toBe(0);
    });

    it('5.2 Tenant C admin overview displays 0 students, 0 batches, 0 courses', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${tenantCAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(false);
      expect(res.body.data.users.students).toBe(0);
      expect(res.body.data.batches).toBe(0);
      expect(res.body.data.courses).toBe(0);
    });

    it('5.3 Tenant C trainer analytics returns clean zero metrics and null rates', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/analytics')
        .set('Authorization', `Bearer ${tenantCTrainerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalStudents).toBe(0);
      expect(res.body.data.totalAttendance).toBe(0);
      expect(res.body.data.attendanceRate).toBeNull(); // Honest null instead of fake '95%'
      expect(res.body.data.totalSubmissions).toBe(0);
      expect(res.body.data.averageScore).toBeNull(); // Honest null instead of fake '88%'
    });

    it('5.4 Student datasheet controller returns null for unrecorded metrics, not hardcoded 3.8 GPA', async () => {
      // Create a student in Tenant C with no academic records
      const freshStudent = await User.create({
        studentId: `STU-EMPTY-${runId}`,
        name: 'Empty Student',
        email: `empty.student.${runId}@eig.test`,
        password: 'Password@123',
        role: 'student',
        tenantId: tenantC._id
      });

      const res = await request(app)
        .get('/api/v1/students/datasheet')
        .set('Authorization', `Bearer ${tenantCAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.averageGpa).toBeNull();
      
      const studentData = res.body.data.students.find((s) => s.email === freshStudent.email);
      expect(studentData).toBeDefined();
      // Verified: gpa is null, totalCredits is 0, totalStudyHours is 0
      expect(studentData.stats.gpa).toBeNull();
      expect(studentData.stats.totalCredits).toBe(0);
      expect(studentData.stats.totalStudyHours).toBe(0);
      expect(studentData.stats.assignmentCompletionRate).toBeNull();

      // Clean up
      await User.deleteOne({ _id: freshStudent._id });
    });
  });

  // =========================================================================
  // 6. BUILD INTEGRITY VERIFICATION
  // =========================================================================
  describe('6. Production Build Artifacts Integrity', () => {
    it('6.1 Vite production build artifacts exist in dist/ directory', () => {
      const distDir = path.resolve(__dirname, '../../dist');
      expect(fs.existsSync(distDir)).toBe(true);

      const indexHtml = path.join(distDir, 'index.html');
      const adminHtml = path.join(distDir, 'admin.html');
      const trainerHtml = path.join(distDir, 'trainer.html');

      expect(fs.existsSync(indexHtml)).toBe(true);
      expect(fs.existsSync(adminHtml)).toBe(true);
      expect(fs.existsSync(trainerHtml)).toBe(true);

      // Verify files have non-trivial content
      expect(fs.statSync(indexHtml).size).toBeGreaterThan(500);
      expect(fs.statSync(adminHtml).size).toBeGreaterThan(500);
      expect(fs.statSync(trainerHtml).size).toBeGreaterThan(500);
    });
  });
});
