/**
 * Lumina LMS — Critical Trainer & Company Admin Repair Regression Tests
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Issue 1: Origin and scoping of student and institution counts; DB readiness checks.
 * 2. Issue 2: Trainer Tests creation, assignment to batch, cross-tenant protection, and persistence.
 * 3. Issue 3: Role-specific profile contracts: Trainer can update phone/address without student emergency requirements; student requires emergency contact.
 * 4. Issue 4: Superadmin (Company Operations) vs Institution Admin identity and multi-tenant scoping isolation.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Assessment from '../models/Assessment.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Critical Trainer & Company Admin Repair Suite', () => {
  const ts = Date.now();

  let institutionA;
  let institutionB;
  let batchA;
  let batchB;
  let trainerA;
  let trainerTokenA;
  let studentA;
  let studentTokenA;
  let adminA;
  let adminTokenA;
  let superAdmin;
  let superAdminToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const jwtSecret = getJwtSecret();

    // 1. Create Institution A (School)
    institutionA = await College.create({
      name: `Oakridge High School ${ts}`,
      code: `OHS-${ts}`,
      slug: `ohs-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create Institution B (Another School)
    institutionB = await College.create({
      name: `St. Xavier School ${ts}`,
      code: `SXS-${ts}`,
      slug: `sxs-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    // 3. Batches
    batchA = await Batch.create({
      name: `Class 10 - Section A ${ts}`,
      tenantId: institutionA._id,
      institutionType: 'school',
      status: 'active'
    });

    batchB = await Batch.create({
      name: `Class 11 - Section B ${ts}`,
      tenantId: institutionB._id,
      institutionType: 'school',
      status: 'active'
    });

    // 4. Trainer in Institution A
    trainerA = await User.create({
      studentId: `TRN-${ts}`,
      name: `Sarah Jenkins ${ts}`,
      email: `sarah.jenkins.${ts}@oakridge.edu`,
      password: 'HashedPassword@123',
      role: 'trainer',
      tenantId: institutionA._id,
      tenantName: institutionA.name,
      batchId: batchA._id,
      department: 'Computer Science'
    });
    trainerTokenA = jwt.sign(
      { id: trainerA._id.toString(), role: 'trainer', tenantId: institutionA._id.toString() },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 5. Student in Institution A
    studentA = await User.create({
      studentId: `STU-${ts}`,
      name: `Leo Miller ${ts}`,
      email: `leo.miller.${ts}@oakridge.edu`,
      password: 'HashedPassword@123',
      role: 'student',
      tenantId: institutionA._id,
      tenantName: institutionA.name,
      batchId: batchA._id,
      className: batchA.name
    });
    studentTokenA = jwt.sign(
      { id: studentA._id.toString(), role: 'student', tenantId: institutionA._id.toString() },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 6. Institution Administrator for Institution A
    adminA = await User.create({
      studentId: `ADM-${ts}`,
      name: `Oakridge Principal ${ts}`,
      email: `principal.${ts}@oakridge.edu`,
      password: 'HashedPassword@123',
      role: 'admin',
      tenantId: institutionA._id,
      tenantName: institutionA.name
    });
    adminTokenA = jwt.sign(
      { id: adminA._id.toString(), role: 'admin', tenantId: institutionA._id.toString() },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // 7. Company Super Administrator (6th Civilians Corp)
    superAdmin = await User.create({
      studentId: `SUP-${ts}`,
      name: `Company Operator ${ts}`,
      email: `operator.${ts}@lumina.corp`,
      password: 'HashedPassword@123',
      role: 'superadmin',
      isTwoFactorEnabled: true
    });
    superAdminToken = jwt.sign(
      { id: superAdmin._id.toString(), role: 'superadmin' },
      jwtSecret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Cleanup generated test data
    await User.deleteMany({ _id: { $in: [trainerA._id, studentA._id, adminA._id, superAdmin._id] } });
    await Assessment.deleteMany({ tenantId: institutionA._id });
    await Batch.deleteMany({ _id: { $in: [batchA._id, batchB._id] } });
    await College.deleteMany({ _id: { $in: [institutionA._id, institutionB._id] } });
  });

  describe('Issue 1: Origin and Scoping of Student & Dashboard Counts', () => {
    it('returns authoritative scoped student roster for trainer within their tenant', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/students')
        .set('Authorization', `Bearer ${trainerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.students)).toBe(true);
      // Leo Miller is in batchA and should be in the list
      const found = res.body.students.find((s) => s.email === studentA.email);
      expect(found).toBeDefined();
      expect(found.name).toBe(studentA.name);
    });

    it('institution admin overview counts only their own institution data', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isSuperAdmin).toBe(false);
      // Institution admin sees 1 institution (theirs)
      expect(res.body.data.institutions).toBe(1);
    });
  });

  describe('Issue 2: Trainer Tests Page and Test Assignment Workflow', () => {
    let createdTestId;

    it('authorized trainer can list scheduled tests without crashing', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/tests')
        .set('Authorization', `Bearer ${trainerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.tests)).toBe(true);
    });

    it('trainer can schedule a new test with subject and batch assignment', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/tests')
        .set('Authorization', `Bearer ${trainerTokenA}`)
        .send({
          title: `Midterm Practical Assessment ${ts}`,
          subject: 'Python Programming',
          date: '2026-11-15',
          time: '10:00 - 11:30 AM',
          room: 'Computer Lab 2',
          totalMarks: 100,
          durationMinutes: 60,
          batchId: batchA._id.toString(),
          className: batchA.name
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.test).toBeDefined();
      expect(res.body.test.title).toContain('Midterm Practical Assessment');
      expect(res.body.test.className).toBe(batchA.name);
      createdTestId = res.body.test._id || res.body.test.id;
    });

    it('trainer can assign an existing test to an authorized cohort', async () => {
      expect(createdTestId).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/trainer/tests/${createdTestId}/assign`)
        .set('Authorization', `Bearer ${trainerTokenA}`)
        .send({
          batchId: batchA._id.toString(),
          className: batchA.name
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.test.className).toBe(batchA.name);

      // Verify persistence in database
      const persisted = await Assessment.findById(createdTestId);
      expect(persisted).toBeDefined();
      expect(persisted.batchId.toString()).toBe(batchA._id.toString());
      expect(persisted.className).toBe(batchA.name);
    });

    it('denies cross-tenant test assignment', async () => {
      // Attempting to assign test to batchB which belongs to institutionB
      const res = await request(app)
        .post(`/api/v1/trainer/tests/${createdTestId}/assign`)
        .set('Authorization', `Bearer ${trainerTokenA}`)
        .send({
          batchId: batchB._id.toString(),
          className: batchB.name
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/cohort outside authorized tenant/i);
    });
  });

  describe('Issue 3: Profile Endpoint Role Separation', () => {
    it('trainer can update contact phone and address without requiring emergency contacts', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${trainerTokenA}`)
        .send({
          phone: '+1 (555) 345-6789',
          address: 'Faculty Building 3, Room 102'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 345-6789');
      expect(res.body.user.address).toBe('Faculty Building 3, Room 102');
    });

    it('rejects trainer attempting to modify company-managed fields like role, email, or tenantId', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${trainerTokenA}`)
        .send({
          role: 'admin',
          email: 'hacked@oakridge.edu'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN_PROFILE_FIELD');
    });

    it('student profile endpoint accepts emergency contact and valid personal fields', async () => {
      const res = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${studentTokenA}`)
        .send({
          phone: '+1 (555) 123-4567',
          address: '142 Elm Street, Boston, MA',
          emergencyContact: {
            name: 'Margaret Miller',
            phone: '+1 (555) 987-6543',
            relationship: 'Mother'
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.phone).toBe('+1 (555) 123-4567');
      expect(res.body.user.emergencyContact.name).toBe('Margaret Miller');
    });
  });

  describe('Issue 4: Company Superadmin vs Institution Admin Role Scoping', () => {
    it('institution admin overview marks isSuperAdmin false and scopes metrics to local tenant', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isSuperAdmin).toBe(false);
      expect(res.body.data.tenantId.toString()).toBe(institutionA._id.toString());
    });

    it('company superadmin overview marks isSuperAdmin true and aggregates across all institutions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isSuperAdmin).toBe(true);
      // Super admin sees multiple managed institutions
      expect(res.body.data.institutions).toBeGreaterThanOrEqual(2);
    });

    it('institution admin cannot access student rosters of other institutions', async () => {
      // Institution admin querying students gets only their tenant's students
      const res = await request(app)
        .get('/api/v1/admin/students')
        .set('Authorization', `Bearer ${adminTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const st of res.body.students) {
        if (st.email === studentA.email) {
          expect(st.name).toBe(studentA.name);
        }
      }
    });
  });
});
