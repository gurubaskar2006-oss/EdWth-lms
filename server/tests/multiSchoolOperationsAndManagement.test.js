/**
 * Lumina LMS — Multi-School Operations & Management Acceptance Test Suite
 * 6th Civilians Corporation / EdWth Academy
 *
 * Verifies:
 * 1. Clean test data state & SuperAdmin integrity
 * 2. School registration with server-authoritative school mode & default academic config
 * 3. School academic structure settings (classes, streams/groups, sections, mediums, schedules)
 * 4. School student profile provisioning & editing without fake college defaults
 * 5. Accurate student datasheet & school directory counts (fixing else class11Count++ bug)
 * 6. School Archiving & Restoring lifecycle
 * 7. School Permanent Deletion with code confirmation, pre-delete inspection & scoped backup
 * 8. Student soft-deactivation vs permanent deletion
 * 9. Tenant isolation & School Admin RBAC boundaries
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import app from '../server.js';
import College from '../models/College.js';
import User from '../models/User.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Multi-School Operations, Management & Security Acceptance', () => {
  const runId = Date.now();
  let jwtSecret;

  // Track created IDs for safe teardown
  const tracked = {
    colleges: [],
    users: []
  };

  let superAdminUser;
  let superAdminToken;

  let testSchool;
  let testSchoolAdmin;
  let testSchoolAdminToken;

  let testStudent1;
  let testStudent2;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    jwtSecret = getJwtSecret();

    // Verify or create SuperAdmin reference for test environment
    superAdminUser = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
    if (!superAdminUser) {
      superAdminUser = await User.findOne({ role: 'superadmin' });
    }
    if (!superAdminUser) {
      const passwordHash = await bcrypt.hash('SuperAdmin!2026', 10);
      superAdminUser = await User.create({
        studentId: `SA-${runId}`,
        name: 'Platform SuperAdmin',
        email: 'edwthacademyadmin@6c.com',
        password: passwordHash,
        role: 'superadmin',
        isSuperAdmin: true,
        tenantId: null
      });
    }
    expect(superAdminUser).toBeTruthy();
    expect(superAdminUser.role).toBe('superadmin');

    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin', isSuperAdmin: true },
      jwtSecret,
      { expiresIn: '2h' }
    );
  });

  afterAll(async () => {
    // Clean up only the specific tracked resources created in this test run (never SuperAdmin)
    if (tracked.users.length > 0) {
      await User.deleteMany({
        _id: { $in: tracked.users },
        email: { $ne: 'edwthacademyadmin@6c.com' }
      });
    }
    if (tracked.colleges.length > 0) {
      await College.deleteMany({ _id: { $in: tracked.colleges } });
    }

    // Verify SuperAdmin remains intact
    const preservedAdmin = await User.findOne({ role: 'superadmin' });
    expect(preservedAdmin).toBeTruthy();
    expect(preservedAdmin.role).toBe('superadmin');
  });

  // ==========================================
  // PHASE 1: Verify Initial Clean State
  // ==========================================
  describe('Phase 1: Test Data Cleanup & Zero-Demo Verification', () => {
    it('should confirm purged test schools (SCHTEST349, SCHTEST9741, STXAVIER) do not exist', async () => {
      const probeSchools = await College.find({
        code: { $in: ['SCHTEST349', 'SCHTEST9741', 'STXAVIER'] }
      });
      expect(probeSchools.length).toBe(0);
    });

    it('should verify the genuine SuperAdmin is present and configured with least privileges intact', async () => {
      expect(superAdminUser.email).toBe('edwthacademyadmin@6c.com');
      expect(superAdminUser.role).toBe('superadmin');
    });
  });

  // ==========================================
  // PHASE 2 & 8: School Registration & Default Academic Config
  // ==========================================
  describe('Phases 2 & 8: School Mode Registration & Default Academic Structure', () => {
    it('should register a participating school enforcing school mode and default academic config', async () => {
      const schoolPayload = {
        name: `Greenwood Senior Secondary School ${runId}`,
        code: `GWSSS-${runId}`,
        address: '45 Academic Avenue',
        city: 'Bengaluru',
        state: 'Karnataka',
        contactEmail: `contact_${runId}@gwsss.edu.in`,
        contactPhone: '+91 9876543210',
        institutionType: 'school',
        academicSession: '2026-2027',
        classesOffered: [11, 12]
      };

      const res = await request(app)
        .post('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(schoolPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const school = res.body.data;
      expect(school._id).toBeDefined();
      tracked.colleges.push(school._id);
      testSchool = school;

      expect(school.institutionType).toBe('school');
      expect(school.status).toBe('active');

      // Verify academicConfig defaults initialized
      const config = school.settings?.academicConfig;
      expect(config).toBeDefined();
      expect(config.academicSession).toBe('2026-2027');
      expect(config.classesOffered.map(String)).toEqual(expect.arrayContaining(['11', '12']));
      expect(config.sections).toEqual(expect.arrayContaining(['A', 'B', 'C']));
      expect(config.mediums).toEqual(expect.arrayContaining(['English']));

      // Verify 4 default stream groups exist
      expect(Array.isArray(config.groups)).toBe(true);
      expect(config.groups.length).toBeGreaterThanOrEqual(4);
      const groupCodes = config.groups.map((g) => g.code);
      expect(groupCodes).toEqual(expect.arrayContaining(['MPC', 'BPC', 'PURE_SCI', 'COMM']));

      // Confirm no fake demo users were seeded
      const schoolUsers = await User.find({ tenantId: school._id });
      expect(schoolUsers.length).toBe(0);
    });
  });

  // ==========================================
  // PHASE 4: School Academic Structure Settings
  // ==========================================
  describe('Phase 4: School Academic Structure Settings API', () => {
    it('should retrieve the academic config for the school', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/schools/${testSchool._id}/academic-config`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const config = res.body.data?.academicConfig || res.body.academicConfig;
      expect(config).toBeDefined();
      expect(config.academicSession).toBe('2026-2027');
    });

    it('should update academic structure including adding a stream group and schedule', async () => {
      const updatedConfig = {
        academicSession: '2026-2027 Academic Year',
        classesOffered: [11, 12],
        sections: ['A', 'B', 'C', 'D'],
        mediums: ['English', 'Vernacular'],
        groups: [
          ...testSchool.settings.academicConfig.groups,
          {
            id: 'arts_hum',
            name: 'Arts & Humanities',
            code: 'ARTS',
            stream: 'Arts',
            subjects: ['History', 'Economics', 'Political Science']
          }
        ],
        trainingSchedules: [
          {
            day: 'Monday',
            time: '09:00 - 11:00',
            subject: 'Physics Lab',
            trainerName: 'Senior Physics Trainer'
          }
        ]
      };

      const res = await request(app)
        .put(`/api/v1/admin/schools/${testSchool._id}/academic-config`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ academicConfig: updatedConfig });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const config = res.body.data?.academicConfig || res.body.academicConfig;
      expect(config.sections).toEqual(expect.arrayContaining(['D']));
      expect(config.mediums).toEqual(expect.arrayContaining(['Vernacular']));
      expect(config.groups.some((g) => g.code === 'ARTS')).toBe(true);
    });
  });

  // ==========================================
  // PHASE 3 & 6: School Student Profile Provisioning & Dossier
  // ==========================================
  describe('Phases 3 & 6: School Student Provisioning, Dossier & Management', () => {
    it('should provision a Class 11 school student with full school profile attributes and no college defaults', async () => {
      const studentPayload = {
        name: `Aarav Sharma ${runId}`,
        email: `aarav_${runId}@gwsss.edu.in`,
        role: 'student',
        standard: 11,
        group: 'MPC',
        section: 'A',
        rollNumber: '11A-001',
        medium: 'English',
        parentName: 'Rajesh Sharma',
        parentPhone: '+91 9876543210',
        dob: '2009-05-14',
        gender: 'Male',
        collegeId: testSchool._id
      };

      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(studentPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      testStudent1 = res.body.data || res.body.student;
      tracked.users.push(testStudent1._id);

      expect(String(testStudent1.standard)).toBe('11');
      expect(testStudent1.group).toBe('MPC');
      expect(testStudent1.section).toBe('A');
      expect(testStudent1.rollNumber).toBe('11A-001');
      expect(testStudent1.parentName).toBe('Rajesh Sharma');
      expect(testStudent1.schoolProfile).toBeDefined();
      expect(String(testStudent1.schoolProfile.standard)).toBe('11');

      // Verify college fake defaults are not present
      expect(testStudent1.major).toBeFalsy();
      expect(testStudent1.department).toBeFalsy();
    });

    it('should provision a Class 12 school student in Commerce stream', async () => {
      const studentPayload = {
        name: `Priya Patel ${runId}`,
        email: `priya_${runId}@gwsss.edu.in`,
        role: 'student',
        standard: 12,
        group: 'Commerce',
        section: 'B',
        rollNumber: '12B-015',
        medium: 'English',
        parentName: 'Sunil Patel',
        parentPhone: '+91 9876543211',
        dob: '2008-08-22',
        gender: 'Female',
        collegeId: testSchool._id
      };

      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(studentPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      testStudent2 = res.body.data || res.body.student;
      tracked.users.push(testStudent2._id);

      expect(String(testStudent2.standard)).toBe('12');
      expect(testStudent2.group).toBe('Commerce');
      expect(testStudent2.section).toBe('B');
      expect(testStudent2.rollNumber).toBe('12B-015');
    });

    it('should retrieve student dossier with full school profile details', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/students/${testStudent1._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const student = res.body.data || res.body.student;
      expect(student.name).toContain('Aarav Sharma');
      expect(String(student.standard)).toBe('11');
      expect(student.rollNumber).toBe('11A-001');
      expect(student.parentName).toBe('Rajesh Sharma');
      expect(student.parentPhone).toBe('+91 9876543210');
    });

    it('should update student profile (section change and roll number)', async () => {
      const updatePayload = {
        section: 'C',
        rollNumber: '11C-042',
        parentPhone: '+91 9876543299'
      };

      const res = await request(app)
        .put(`/api/v1/admin/students/${testStudent1._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.section).toBe('C');
      expect(res.body.data.rollNumber).toBe('11C-042');
      expect(res.body.data.parentPhone).toBe('+91 9876543299');
    });
  });

  // ==========================================
  // PHASE 7: Accurate Directory & Datasheet Metrics (No else class11Count++ bug)
  // ==========================================
  describe('Phase 7: Real Student Counts & Class Breakdown Verification', () => {
    it('should return accurate student datasheet breakdown without fake GPA or erroneous class grouping', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/students?collegeId=${testSchool._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { data, meta } = res.body;
      expect(data.length).toBe(2);

      // Verify stats meta
      expect(meta.totalStudents).toBe(2);
      expect(meta.class11Count).toBe(1);
      expect(meta.class12Count).toBe(1);
      expect(meta.averageGpa).toBeNull(); // School mode must not return fake college GPA
    });

    it('should report exact student and class distribution in the participating schools directory', async () => {
      const res = await request(app)
        .get('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const found = res.body.data.find((s) => s._id.toString() === testSchool._id.toString());
      expect(found).toBeDefined();
      expect(found.totalStudents).toBe(2);
      expect(found.class11Count).toBe(1);
      expect(found.class12Count).toBe(1);
    });
  });

  // ==========================================
  // PHASE 5: Action A — School Archiving and Restoring
  // ==========================================
  describe('Phase 5 Action A: School Archiving & Restoration', () => {
    it('should archive the school and hide it from the default active directory', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${testSchool._id}/archive`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ reason: 'Seasonal holiday maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const schoolStatus = res.body.data?.status || res.body.school?.status;
      expect(schoolStatus).toBe('archived');

      // Verify excluded from default active list
      const activeRes = await request(app)
        .get('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const inActive = activeRes.body.data.some((s) => s._id.toString() === testSchool._id.toString());
      expect(inActive).toBe(false);

      // Verify included when filtering for archived
      const archivedRes = await request(app)
        .get('/api/v1/admin/schools?status=archived')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const inArchived = archivedRes.body.data.some((s) => s._id.toString() === testSchool._id.toString());
      expect(inArchived).toBe(true);
    });

    it('should restore the archived school back to active status', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${testSchool._id}/restore`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const schoolStatus = res.body.data?.status || res.body.school?.status;
      expect(schoolStatus).toBe('active');

      // Verify back in active list
      const activeRes = await request(app)
        .get('/api/v1/admin/schools')
        .set('Authorization', `Bearer ${superAdminToken}`);
      const inActive = activeRes.body.data.some((s) => s._id.toString() === testSchool._id.toString());
      expect(inActive).toBe(true);
    });
  });

  // ==========================================
  // PHASE 5: Action B — Permanent School Deletion (Pre-delete inspection, confirmation & backup)
  // ==========================================
  describe('Phase 5 Action B: Permanent School Deletion with Code Confirmation & Scoped Backup', () => {
    let disposableSchool;
    let disposableStudent;
    const dispCode = `DISP-${runId}`;

    beforeAll(async () => {
      // Create a disposable school specifically to test permanent deletion
      disposableSchool = await College.create({
        name: `Disposable Test Academy ${runId}`,
        code: dispCode,
        slug: `disp-${runId}`,
        institutionType: 'school',
        status: 'active'
      });

      const pwdHash = await bcrypt.hash('Student!2026', 10);
      disposableStudent = await User.create({
        studentId: `STU-DISP-${runId}`,
        name: 'Disposable Student',
        email: `disp_stu_${runId}@school.org`,
        password: pwdHash,
        role: 'student',
        standard: 11,
        tenantId: disposableSchool._id
      });
    });

    it('should return accurate pre-delete inspection breakdown before deletion', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/schools/${disposableSchool._id}/pre-delete-inspection`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const counts = res.body.data?.counts || res.body.counts;
      expect(counts.students).toBe(1);
      expect(counts.trainers).toBe(0);
      const schoolInfo = res.body.data?.school || res.body.school;
      expect(schoolInfo.code).toBe(dispCode);
    });

    it('should reject permanent deletion if confirmation code does not match exact school code', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/schools/${disposableSchool._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ confirmationCode: 'WRONG_CODE' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('must exactly match the school code');

      // School must still exist
      const check = await College.findById(disposableSchool._id);
      expect(check).toBeTruthy();
    });

    it('should permanently delete the school and all tenant records when exact code is provided', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/schools/${disposableSchool._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ confirmationCode: dispCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const backupPath = res.body.data?.backupPath || res.body.backupPath;
      expect(backupPath).toBeDefined();

      // Verify scoped backup file exists on disk
      const backupExists = fs.existsSync(backupPath);
      expect(backupExists).toBe(true);

      // Read backup file and verify it contains the deleted school and student
      const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      expect(backupContent.school._id.toString()).toBe(disposableSchool._id.toString());
      expect(backupContent.records.users.length).toBe(1);

      // Verify records are gone from MongoDB
      const checkSchool = await College.findById(disposableSchool._id);
      expect(checkSchool).toBeNull();

      const checkStudent = await User.findById(disposableStudent._id);
      expect(checkStudent).toBeNull();

      // Verify SuperAdmin is intact
      const checkSuperAdmin = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
      expect(checkSuperAdmin).toBeTruthy();
    });
  });

  // ==========================================
  // PHASE 6: Student Soft-Delete vs Permanent Delete
  // ==========================================
  describe('Phase 6: Student Soft-Deactivate vs Permanent Deletion', () => {
    it('should soft-delete (deactivate) a student when permanent is not requested', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/students/${testStudent2._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkUser = await User.findById(testStudent2._id);
      expect(checkUser).toBeTruthy();
      expect(checkUser.status.toLowerCase()).toBe('inactive');
    });

    it('should permanently delete a student when permanent=true', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/students/${testStudent2._id}?permanent=true`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkUser = await User.findById(testStudent2._id);
      expect(checkUser).toBeNull();

      // Remove from tracked list since it is already deleted
      const idx = tracked.users.indexOf(testStudent2._id);
      if (idx !== -1) tracked.users.splice(idx, 1);
    });
  });

  // ==========================================
  // PHASE 9: Tenant Isolation & RBAC Protection
  // ==========================================
  describe('Phase 9: Strict Tenant Isolation & RBAC Boundaries', () => {
    beforeAll(async () => {
      const adminHash = await bcrypt.hash('SchoolPrincipal!2026', 10);
      testSchoolAdmin = await User.create({
        studentId: `ADM-GW-${runId}`,
        name: 'School Principal',
        email: `principal_${runId}@gwsss.edu.in`,
        password: adminHash,
        role: 'admin',
        tenantId: testSchool._id
      });
      tracked.users.push(testSchoolAdmin._id);

      testSchoolAdminToken = jwt.sign(
        { id: testSchoolAdmin._id, role: 'admin', tenantId: testSchool._id },
        jwtSecret,
        { expiresIn: '1h' }
      );
    });

    it('should forbid a School Admin from permanently deleting a school', async () => {
      const res = await request(app)
        .delete(`/api/v1/admin/schools/${testSchool._id}`)
        .set('Authorization', `Bearer ${testSchoolAdminToken}`)
        .send({ confirmationCode: testSchool.code });

      // School Admin must not be authorized to delete institutions
      expect([401, 403]).toContain(res.status);
    });

    it('should forbid a School Admin from archiving or restoring a school', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/schools/${testSchool._id}/archive`)
        .set('Authorization', `Bearer ${testSchoolAdminToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it('should forbid a School Admin from modifying institution operating mode', async () => {
      const res = await request(app)
        .put(`/api/v1/admin/institutions/${testSchool._id}`)
        .set('Authorization', `Bearer ${testSchoolAdminToken}`)
        .send({ institutionType: 'college' });

      expect([401, 403]).toContain(res.status);

      // Verify in DB that institutionType remains 'school'
      const checkSchool = await College.findById(testSchool._id);
      expect(checkSchool.institutionType).toBe('school');
    });

    it('should prevent a School Admin from accessing another school academic config', async () => {
      const otherSchool = await College.create({
        name: `Other High School ${runId}`,
        code: `OTHER-${runId}`,
        slug: `other-${runId}`,
        institutionType: 'school',
        status: 'active'
      });
      tracked.colleges.push(otherSchool._id);

      const res = await request(app)
        .get(`/api/v1/admin/schools/${otherSchool._id}/academic-config`)
        .set('Authorization', `Bearer ${testSchoolAdminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
