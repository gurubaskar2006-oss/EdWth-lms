/**
 * Lumina LMS — SuperAdmin & School Admin Data Integrity, Tenant Mode & Security Remediation Test Suite
 * 6th Civilians Corporation / EdWth Academy
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import College from '../models/College.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import AuditLog from '../models/AuditLog.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Tenant Mode, Academic Integrity and Security Remediation', () => {
  const runId = Date.now();
  let jwtSecret;

  // Track created documents for safe cleanup
  const createdIds = {
    colleges: [],
    users: [],
    batches: [],
    courses: [],
    assignments: [],
    submissions: [],
    attendances: []
  };

  let superAdminUser;
  let superAdminToken;

  let schoolCollege;
  let schoolAdminUser;
  let schoolAdminToken;

  let collegeTenant;
  let collegeAdminUser;
  let collegeAdminToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    jwtSecret = getJwtSecret();

    // 1. Get or create SuperAdmin reference
    superAdminUser = await User.findOne({ role: 'superadmin' });
    if (!superAdminUser) {
      const passwordHash = await bcrypt.hash('SuperAdmin!2026', 10);
      superAdminUser = await User.create({
        studentId: `SA-${runId}`,
        name: 'Platform SuperAdmin',
        email: `superadmin_${runId}@6c.com`,
        password: passwordHash,
        role: 'superadmin',
        isSuperAdmin: true,
        tenantId: null
      });
      createdIds.users.push(superAdminUser._id);
    }

    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin', isSuperAdmin: true },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 2. Create School Tenant with 'school' institutionType
    schoolCollege = await College.create({
      name: `Horizon Public High School ${runId}`,
      code: `HPHS-${runId}`,
      slug: `hphs-${runId}`,
      institutionType: 'school',
      status: 'active',
      settings: {
        academicConfig: {
          academicSession: '2026 – 2027 Academic Year',
          minimumAttendance: 80,
          evaluationSlaHours: 24,
          gradingScale: [
            { grade: 'A+', minPercentage: 90, maxPercentage: 100, gpa: 4.0, label: 'Outstanding' },
            { grade: 'A', minPercentage: 80, maxPercentage: 89, gpa: 3.5, label: 'Very Good' },
            { grade: 'B', minPercentage: 70, maxPercentage: 79, gpa: 3.0, label: 'Good' }
          ]
        }
      }
    });
    createdIds.colleges.push(schoolCollege._id);

    const schoolAdminHash = await bcrypt.hash('SchoolAdmin!2026', 10);
    schoolAdminUser = await User.create({
      studentId: `ADM-SCH-${runId}`,
      name: 'School Principal',
      email: `principal_${runId}@school.org`,
      password: schoolAdminHash,
      role: 'admin',
      tenantId: schoolCollege._id
    });
    createdIds.users.push(schoolAdminUser._id);

    schoolAdminToken = jwt.sign(
      { id: schoolAdminUser._id, role: 'admin', tenantId: schoolCollege._id },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 3. Create College Tenant with 'college' institutionType (Unconfigured academicConfig)
    collegeTenant = await College.create({
      name: `Metropolitan University ${runId}`,
      code: `METRO-${runId}`,
      slug: `metro-${runId}`,
      institutionType: 'college',
      status: 'active',
      settings: {
        academicConfig: {
          academicSession: null,
          minimumAttendance: null,
          evaluationSlaHours: null,
          gradingScale: []
        }
      }
    });
    createdIds.colleges.push(collegeTenant._id);

    const collegeAdminHash = await bcrypt.hash('CollegeAdmin!2026', 10);
    collegeAdminUser = await User.create({
      studentId: `ADM-COL-${runId}`,
      name: 'College Dean',
      email: `dean_${runId}@metro.edu`,
      password: collegeAdminHash,
      role: 'admin',
      tenantId: collegeTenant._id
    });
    createdIds.users.push(collegeAdminUser._id);

    collegeAdminToken = jwt.sign(
      { id: collegeAdminUser._id, role: 'admin', tenantId: collegeTenant._id },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up created records cleanly using their exact IDs
    if (createdIds.attendances.length) await Attendance.deleteMany({ _id: { $in: createdIds.attendances } });
    if (createdIds.submissions.length) await Submission.deleteMany({ _id: { $in: createdIds.submissions } });
    if (createdIds.assignments.length) await Assignment.deleteMany({ _id: { $in: createdIds.assignments } });
    if (createdIds.batches.length) await Batch.deleteMany({ _id: { $in: createdIds.batches } });
    if (createdIds.courses.length) await Course.deleteMany({ _id: { $in: createdIds.courses } });
    if (createdIds.users.length) await User.deleteMany({ _id: { $in: createdIds.users } });
    if (createdIds.colleges.length) await College.deleteMany({ _id: { $in: createdIds.colleges } });
  });

  describe('1. Analytics Attendance & SLA Rate Integrity (Zero Hardcoded 95%)', () => {
    it('returns honest null/0 metrics when tenant has zero attendance sessions and zero submissions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Must be null or 0 sessions, NEVER fake 95%
      expect(res.body.stats.averageAttendanceRate).toBeNull();
      expect(res.body.stats.attendanceSessionsCount).toBe(0);
      expect(res.body.stats.evaluationRate).toBeNull();
      expect(res.body.stats.submissionsCount).toBe(0);
    });

    it('calculates real database-backed attendance percentage when verified sessions exist', async () => {
      // Create student & trainer in school tenant
      const defaultPass = await bcrypt.hash('TestPass!123', 10);
      const trainer = await User.create({
        studentId: `TR-${runId}`,
        name: 'Science Teacher',
        email: `teacher_${runId}@school.org`,
        password: defaultPass,
        role: 'trainer',
        tenantId: schoolCollege._id
      });
      createdIds.users.push(trainer._id);

      const student1 = await User.create({
        studentId: `ST1-${runId}`,
        name: 'Alice Student',
        email: `alice_${runId}@school.org`,
        password: defaultPass,
        role: 'student',
        tenantId: schoolCollege._id
      });
      const student2 = await User.create({
        studentId: `ST2-${runId}`,
        name: 'Bob Student',
        email: `bob_${runId}@school.org`,
        password: defaultPass,
        role: 'student',
        tenantId: schoolCollege._id
      });
      createdIds.users.push(student1._id, student2._id);

      const batch = await Batch.create({
        name: `Grade 10-A ${runId}`,
        code: `G10A-${runId}`,
        tenantId: schoolCollege._id,
        trainerId: trainer._id,
        status: 'active'
      });
      createdIds.batches.push(batch._id);

      // Create attendance: 3 present, 1 absent (3/4 = 75%)
      const att1 = await Attendance.create({
        tenantId: schoolCollege._id,
        batchId: batch._id,
        studentId: student1._id,
        trainerId: trainer._id,
        date: new Date('2026-10-01'),
        status: 'present'
      });
      const att2 = await Attendance.create({
        tenantId: schoolCollege._id,
        batchId: batch._id,
        studentId: student2._id,
        trainerId: trainer._id,
        date: new Date('2026-10-01'),
        status: 'present'
      });
      const att3 = await Attendance.create({
        tenantId: schoolCollege._id,
        batchId: batch._id,
        studentId: student1._id,
        trainerId: trainer._id,
        date: new Date('2026-10-02'),
        status: 'present'
      });
      const att4 = await Attendance.create({
        tenantId: schoolCollege._id,
        batchId: batch._id,
        studentId: student2._id,
        trainerId: trainer._id,
        date: new Date('2026-10-02'),
        status: 'absent'
      });
      createdIds.attendances.push(att1._id, att2._id, att3._id, att4._id);

      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.attendanceSessionsCount).toBe(4);
      expect(res.body.stats.averageAttendanceRate).toBe(75); // Exactly 3/4 = 75%
      expect(res.body.stats.studentsCount).toBe(2);
      expect(res.body.stats.trainersCount).toBe(1);
    });
  });

  describe('2. Academic Structure Database Grounding', () => {
    it('returns honest empty/unconfigured state for tenant without academic setup', async () => {
      const res = await request(app)
        .get('/api/v1/admin/institution-profile')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institution.name).toBe(collegeTenant.name);
      expect(res.body.institution.institutionType).toBe('college');
      expect(res.body.institution.settings?.academicConfig?.academicSession).toBeNull();
      expect(res.body.institution.settings?.academicConfig?.gradingScale).toEqual([]);
    });

    it('returns populated verified academic settings for provisioned tenant', async () => {
      const res = await request(app)
        .get('/api/v1/admin/institution-profile')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institution.name).toBe(schoolCollege.name);
      expect(res.body.institution.institutionType).toBe('school');
      expect(res.body.institution.settings.academicConfig.academicSession).toBe('2026 – 2027 Academic Year');
      expect(res.body.institution.settings.academicConfig.minimumAttendance).toBe(80);
      expect(res.body.institution.settings.academicConfig.gradingScale.length).toBe(3);
    });
  });

  describe('3. Server-Authoritative Tenant Mode & RBAC', () => {
    it('returns correct institutionType in auth profile for school and college admins', async () => {
      const schoolRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(schoolRes.status).toBe(200);
      expect(schoolRes.body.user.institutionType).toBe('school');

      const collegeRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${collegeAdminToken}`);
      expect(collegeRes.status).toBe(200);
      expect(collegeRes.body.user.institutionType).toBe('college');

      const superRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(superRes.status).toBe(200);
      expect(superRes.body.user.institutionType).toBeNull();
    });

    it('strictly forbids tenant admins from changing operating mode (returns 403)', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/institutions/${schoolCollege._id}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ institutionType: 'college' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('TENANT_MODE_SUPERADMIN_ONLY');
    });

    it('allows SuperAdmin to update operating mode and academicConfig', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/institutions/${collegeTenant._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          institutionType: 'college',
          settings: {
            academicConfig: {
              academicSession: 'Spring 2027 Semester',
              minimumAttendance: 85,
              evaluationSlaHours: 48,
              gradingScale: [
                { grade: 'A', minPercentage: 90, maxPercentage: 100, gpa: 4.0, label: 'Honors' }
              ]
            }
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institution.institutionType).toBe('college');
      expect(res.body.institution.settings.academicConfig.academicSession).toBe('Spring 2027 Semester');
    });
  });

  describe('4. Security Audit Logs: Pagination, Filtering & Tenant Scoping', () => {
    it('enforces strict tenant isolation on audit logs (tenant admin cannot view other tenants)', async () => {
      const schoolLogs = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(schoolLogs.status).toBe(200);
      expect(schoolLogs.body.success).toBe(true);
      expect(Array.isArray(schoolLogs.body.logs)).toBe(true);
      
      // All logs must belong to schoolCollege or be tenant-scoped
      schoolLogs.body.logs.forEach((log) => {
        if (log.tenantId) {
          expect(log.tenantId.toString()).toBe(schoolCollege._id.toString());
        }
      });
    });

    it('supports pagination parameters (page, limit, total, totalPages)', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?page=1&limit=5')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.page).toBe(1);
      expect(typeof res.body.total).toBe('number');
      expect(typeof res.body.totalPages).toBe('number');
      expect(res.body.logs.length).toBeLessThanOrEqual(5);
    });

    it('supports filtering by action type', async () => {
      const res = await request(app)
        .get('/api/v1/admin/audit-logs?action=COMPANY_ADMIN_INSTITUTION_UPDATED')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.logs.forEach((log) => {
        expect(log.action).toBe('COMPANY_ADMIN_INSTITUTION_UPDATED');
      });
    });
  });

  describe('5. Platform Security Policies API', () => {
    it('allows read access to effective policies for all admins with runtime annotations', async () => {
      const res = await request(app)
        .get('/api/v1/admin/security-policies')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.policy).toBeDefined();
      expect(res.body.policy.tenantPolicy.strictTenantIsolation).toBe(true);
      expect(res.body.policy.annotations.strictTenantIsolation.enforced).toBe(true);
    });

    it('blocks tenant admin from modifying platform security policies (403)', async () => {
      const res = await request(app)
        .put('/api/v1/admin/security-policies')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({
          passwordPolicy: { minLength: 8 }
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('SUPERADMIN_REQUIRED');
    });

    it('allows SuperAdmin to update configurable settings and audits the change', async () => {
      const res = await request(app)
        .put('/api/v1/admin/security-policies')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          passwordPolicy: { minLength: 14 },
          sessionPolicy: { sessionTimeoutMinutes: 90 }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.policy.passwordPolicy.minLength).toBe(14);
      expect(res.body.policy.sessionPolicy.sessionTimeoutMinutes).toBe(90);

      // Verify audit log entry
      const audit = await AuditLog.findOne({ action: 'SECURITY_POLICY_UPDATED' }).sort({ timestamp: -1 });
      expect(audit).not.toBeNull();
      expect(audit.actor.email).toBe(superAdminUser.email);
    });

    it('rejects attempt to disable strict tenant isolation even by SuperAdmin (400)', async () => {
      const res = await request(app)
        .put('/api/v1/admin/security-policies')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantPolicy: { strictTenantIsolation: false }
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TENANT_ISOLATION_IMMUTABLE');
    });
  });
});
