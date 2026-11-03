import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Attendance from '../models/Attendance.js';
import Submission from '../models/Submission.js';
import Assignment from '../models/Assignment.js';
import Note from '../models/Note.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Tenant Isolation & Trainer Provisioning Security Suite', () => {
  let tenantA;
  let tenantB;
  let superAdminUser;
  let superAdminToken;
  let adminAUser;
  let adminAToken;
  let trainerAUser;
  let trainerAToken;
  let trainerNoTenantUser;
  let trainerNoTenantToken;

  const testSuffix = Date.now();

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create two isolated colleges
    tenantA = await College.create({
      name: `Isolation College A ${testSuffix}`,
      code: `ICA-${testSuffix}`,
      slug: `ica-${testSuffix}`,
      institutionType: 'college',
      status: 'active'
    });

    tenantB = await College.create({
      name: `Isolation College B ${testSuffix}`,
      code: `ICB-${testSuffix}`,
      slug: `icb-${testSuffix}`,
      institutionType: 'college',
      status: 'active'
    });

    const passwordHash = await bcrypt.hash('SecurePassword!123', 10);

    // 2. Create SuperAdmin
    superAdminUser = await User.create({
      name: 'SuperAdmin Test',
      email: `sa.${testSuffix}@6c.com`,
      password: passwordHash,
      role: 'superadmin',
      tenantId: null,
      studentId: `SA-${testSuffix}`
    });
    superAdminToken = jwt.sign(
      { id: superAdminUser._id, role: 'superadmin', tenantId: null },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 3. Create Admin for Tenant A
    adminAUser = await User.create({
      name: 'Admin Tenant A',
      email: `adminA.${testSuffix}@6c.com`,
      password: passwordHash,
      role: 'admin',
      tenantId: tenantA._id,
      studentId: `ADM-A-${testSuffix}`
    });
    adminAToken = jwt.sign(
      { id: adminAUser._id, role: 'admin', tenantId: tenantA._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 4. Create Trainer bound to Tenant A
    trainerAUser = await User.create({
      name: 'Trainer Tenant A',
      email: `trainerA.${testSuffix}@alpha.edu`,
      password: passwordHash,
      role: 'trainer',
      tenantId: tenantA._id,
      studentId: `TRN-A-${testSuffix}`
    });
    trainerAToken = jwt.sign(
      { id: trainerAUser._id, role: 'trainer', tenantId: tenantA._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 5. Create Trainer with null tenantId
    trainerNoTenantUser = await User.create({
      name: 'Trainer No Tenant',
      email: `trainerNull.${testSuffix}@alpha.edu`,
      password: passwordHash,
      role: 'trainer',
      tenantId: null,
      studentId: `TRN-NULL-${testSuffix}`
    });
    trainerNoTenantToken = jwt.sign(
      { id: trainerNoTenantUser._id, role: 'trainer', tenantId: null },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (tenantA?._id) await College.deleteMany({ _id: { $in: [tenantA._id, tenantB._id] } });
    await User.deleteMany({ email: new RegExp(`.*${testSuffix}.*`) });
    await Attendance.deleteMany({ tenantId: { $in: [tenantA?._id, tenantB?._id] } });
    await Submission.deleteMany({ tenantId: { $in: [tenantA?._id, tenantB?._id] } });
    await Assignment.deleteMany({ tenantId: { $in: [tenantA?._id, tenantB?._id] } });
    await Note.deleteMany({ tenantId: { $in: [tenantA?._id, tenantB?._id] } });
  });

  describe('1. SuperAdmin Trainer Provisioning Validation', () => {
    it('rejects trainer provisioning when tenantId is missing for SuperAdmin with 400 MISSING_TENANT_ASSIGNMENT', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Orphan Trainer',
          email: `orphan.${testSuffix}@alpha.edu`,
          department: 'School of Computing',
          password: 'ValidPassword!123'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_TENANT_ASSIGNMENT');
      expect(res.body.success).toBe(false);
    });

    it('rejects trainer provisioning when tenantId is not a valid ObjectId', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Invalid Tenant Trainer',
          email: `invalid.${testSuffix}@alpha.edu`,
          department: 'School of Computing',
          password: 'ValidPassword!123',
          tenantId: 'not-an-object-id'
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_TENANT_ASSIGNMENT');
    });

    it('rejects trainer provisioning when tenantId does not exist or is inactive', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Nonexistent Tenant Trainer',
          email: `nonexistent.${testSuffix}@alpha.edu`,
          department: 'School of Computing',
          password: 'ValidPassword!123',
          tenantId: fakeId
        });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('TENANT_NOT_FOUND_OR_INACTIVE');
    });

    it('successfully provisions trainer when valid active tenantId is provided by SuperAdmin', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: 'Valid Provisioned Trainer',
          email: `valid.trn.${testSuffix}@alpha.edu`,
          department: 'School of Computing',
          password: 'ValidPassword!123',
          tenantId: tenantA._id.toString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.trainer).toBeDefined();
      expect(res.body.trainer.tenantId.toString()).toBe(tenantA._id.toString());
      expect(res.body.trainer.role).toBe('trainer');
    });
  });

  describe('2. Ordinary Institution Admin Trainer Provisioning Boundaries', () => {
    it('prevents ordinary admin from provisioning into another tenant, strictly assigning admin tenant', async () => {
      const res = await request(app)
        .post('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({
          name: 'Admin A Trainer',
          email: `adminA.trn.${testSuffix}@alpha.edu`,
          department: 'School of Computing',
          password: 'ValidPassword!123',
          tenantId: tenantB._id.toString() // Attempt to inject Tenant B
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Backend must strictly ignore client-supplied tenantId and use adminAToken's tenantA
      expect(res.body.trainer.tenantId.toString()).toBe(tenantA._id.toString());
      expect(res.body.trainer.tenantId.toString()).not.toBe(tenantB._id.toString());
    });
  });

  describe('3. Null-Tenant Protection on Trainer Routes', () => {
    it('rejects trainer without tenantId from retrieving submissions with 403 MISSING_TENANT_CONTEXT', async () => {
      const res = await request(app)
        .get('/api/v1/trainer/submissions')
        .set('Authorization', `Bearer ${trainerNoTenantToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MISSING_TENANT_CONTEXT');
    });

    it('rejects trainer without tenantId from posting attendance with 403 MISSING_TENANT_CONTEXT', async () => {
      const res = await request(app)
        .post('/api/v1/trainer/attendance')
        .set('Authorization', `Bearer ${trainerNoTenantToken}`)
        .send({
          date: '2026-10-31',
          classId: 'Class 11-A',
          records: []
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MISSING_TENANT_CONTEXT');
    });
  });

  describe('4. Cross-Tenant Record Isolation', () => {
    it('prevents Trainer A from deleting attendance record belonging to Tenant B', async () => {
      // Create attendance in Tenant B
      const attB = await Attendance.create({
        trainerId: superAdminUser._id,
        tenantId: tenantB._id,
        studentId: new mongoose.Types.ObjectId(),
        batchId: new mongoose.Types.ObjectId(),
        date: new Date(),
        status: 'present'
      });

      // Trainer A attempts to delete it
      const res = await request(app)
        .delete(`/api/v1/trainer/attendance/${attB._id}`)
        .set('Authorization', `Bearer ${trainerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found or unauthorized');

      // Verify record still exists in Tenant B
      const check = await Attendance.findById(attB._id);
      expect(check).not.toBeNull();
    });

    it('prevents Trainer A from retrieving submissions belonging to Tenant B', async () => {
      const assignmentB = await Assignment.create({
        title: 'Assignment Tenant B',
        tenantId: tenantB._id,
        courseCode: 'CS-201',
        points: 20
      });

      await Submission.create({
        assignmentId: assignmentB._id,
        studentId: new mongoose.Types.ObjectId(),
        tenantId: tenantB._id,
        submissionText: 'Tenant B confidential submission',
        status: 'submitted'
      });

      const res = await request(app)
        .get('/api/v1/trainer/submissions')
        .set('Authorization', `Bearer ${trainerAToken}`);

      expect(res.status).toBe(200);
      // Submissions returned must NOT include Tenant B's submission
      const tenantBItems = (res.body.submissions || []).filter(
        (s) => s.assignmentId?.toString() === assignmentB._id.toString()
      );
      expect(tenantBItems.length).toBe(0);
    });

    it('prevents User in Tenant A from downloading private study note belonging to Tenant B', async () => {
      const noteB = await Note.create({
        id: `note-b-${testSuffix}`,
        title: 'Confidential Notes Tenant B',
        owner: new mongoose.Types.ObjectId(),
        tenantId: tenantB._id,
        visibility: 'private',
        files: [{ s3Key: 'tenantB/confidential.pdf', originalName: 'confidential.pdf', sizeBytes: 1024 }]
      });

      const res = await request(app)
        .get(`/api/v1/notes/${noteB.id}/files/download?key=tenantB/confidential.pdf`)
        .set('Authorization', `Bearer ${trainerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });
});
