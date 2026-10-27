/**
 * Lumina LMS — Admin Portal Real Data Restoration, Governance & RBAC Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Institution Admin tenant isolation on /overview, /batches, /trainers, /courses, /audit-logs.
 * 2. Elimination of synthetic fallback numbers (courses=6, batches=4, etc.) on 0-record counts.
 * 3. Elimination of default mock batches/trainers arrays when tenant has 0 batches/trainers.
 * 4. Company Super-admin cross-tenant oversight and institution directory access.
 * 5. Strict rejection of student and trainer roles on privileged admin endpoints.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';
import { normalizeRequestPath } from '../middleware/authMiddleware.js';
import { resetRateLimitMemoryStore } from '../middleware/rateLimitMiddleware.js';

describe('Lumina LMS — Admin Real-Data Restoration & RBAC', () => {
  const ts = Date.now();

  let collegeTenant;
  let schoolTenant;

  let collegeAdmin;
  let collegeAdminToken;

  let schoolAdmin;
  let schoolAdminToken;

  let superAdmin;
  let superAdminToken;

  let studentUser;
  let studentToken;

  let trainerUser;
  let trainerToken;

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create two distinct tenants
    collegeTenant = await College.create({
      name: `Nexus Tech College ${ts}`,
      code: `NTC-${ts}`,
      slug: `ntc-${ts}`,
      institutionType: 'college',
      status: 'active'
    });

    schoolTenant = await College.create({
      name: `Oakridge Academy ${ts}`,
      code: `OAK-${ts}`,
      slug: `oak-${ts}`,
      institutionType: 'school',
      status: 'active'
    });

    const secret = getJwtSecret();

    // 2. Create College Admin
    collegeAdmin = await User.create({
      studentId: `ADM-COL-${ts}`,
      name: `College Admin ${ts}`,
      email: `admin.college.${ts}@nexus.edu`,
      password: 'HashedPassword123!',
      role: 'admin',
      tenantId: collegeTenant._id.toString(),
      institutionType: 'college',
      status: 'active'
    });
    collegeAdminToken = jwt.sign(
      { id: collegeAdmin._id, role: 'admin', tenantId: collegeTenant._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    // 3. Create School Admin
    schoolAdmin = await User.create({
      studentId: `ADM-SCH-${ts}`,
      name: `School Admin ${ts}`,
      email: `admin.school.${ts}@oakridge.edu`,
      password: 'HashedPassword123!',
      role: 'admin',
      tenantId: schoolTenant._id.toString(),
      institutionType: 'school',
      status: 'active'
    });
    schoolAdminToken = jwt.sign(
      { id: schoolAdmin._id, role: 'admin', tenantId: schoolTenant._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    // 4. Create Company Super-Admin (6th Civilians Corp)
    superAdmin = await User.create({
      studentId: `ADM-CORP-${ts}`,
      name: `Corp SuperAdmin ${ts}`,
      email: `superadmin.${ts}@6thcivilians.org`,
      password: 'HashedPassword123!',
      role: 'superadmin',
      tenantId: null,
      status: 'active',
      isTwoFactorEnabled: true
    });
    superAdminToken = jwt.sign(
      { id: superAdmin._id, role: 'superadmin', tenantId: null },
      secret,
      { expiresIn: '1h' }
    );

    // 5. Create unauthorized student & trainer
    studentUser = await User.create({
      studentId: `STU-${ts}`,
      name: `Student User ${ts}`,
      email: `student.${ts}@nexus.edu`,
      password: 'HashedPassword123!',
      role: 'student',
      tenantId: collegeTenant._id.toString(),
      status: 'active'
    });
    studentToken = jwt.sign(
      { id: studentUser._id, role: 'student', tenantId: collegeTenant._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    trainerUser = await User.create({
      studentId: `TRN-${ts}`,
      name: `Trainer User ${ts}`,
      email: `trainer.${ts}@nexus.edu`,
      password: 'HashedPassword123!',
      role: 'trainer',
      tenantId: collegeTenant._id.toString(),
      status: 'active'
    });
    trainerToken = jwt.sign(
      { id: trainerUser._id, role: 'trainer', tenantId: collegeTenant._id.toString() },
      secret,
      { expiresIn: '1h' }
    );

    // 6. Provision 1 course & 1 batch for College Tenant ONLY
    await Course.create({
      id: `course-${ts}`,
      title: `Computer Science ${ts}`,
      code: `CS-${ts}`,
      tenantId: collegeTenant._id.toString(),
      status: 'active'
    });

    await Batch.create({
      name: `Batch Alpha ${ts}`,
      code: `BA-${ts}`,
      collegeId: collegeTenant._id,
      tenantId: collegeTenant._id.toString(),
      status: 'active'
    });

    // 7. Insert AuditLog for College Tenant
    await AuditLog.create({
      tenantId: collegeTenant._id,
      action: 'SECURITY_LOGIN',
      actor: {
        userId: collegeAdmin._id,
        role: 'admin',
        email: collegeAdmin.email
      },
      details: { status: 'Allowed' }
    });
  });

  afterAll(async () => {
    if (collegeTenant) await College.deleteOne({ _id: collegeTenant._id });
    if (schoolTenant) await College.deleteOne({ _id: schoolTenant._id });
    await User.deleteMany({ email: new RegExp(`${ts}`) });
    await Course.deleteMany({ code: new RegExp(`${ts}`) });
    try {
      await AuditLog.deleteMany({ 'actor.email': new RegExp(`${ts}`) });
    } catch {
      // Expected: AuditLog deletion is strictly blocked
    }
  });

  describe('1. Security & RBAC Boundary Enforcement', () => {
    it('rejects unauthenticated requests to /api/v1/admin/overview with 401', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
    });

    it('rejects student role on /api/v1/admin/overview with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
    });

    it('rejects trainer role on /api/v1/admin/batches with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${trainerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Institution Admin Tenant Scoping & Zero-Fallback Verification', () => {
    it('returns exact tenant counts for college admin without fallback defaults', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.courses).toBe(1);
      expect(res.body.data.batches).toBe(1);
      // Fallback defaults were courses: 6, batches: 4. Ensure real values are returned.
      expect(res.body.data.courses).not.toBe(6);
      expect(res.body.data.batches).not.toBe(4);
    });

    it('returns 0 courses and 0 batches for school admin without fake fallback numbers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // School tenant has 0 courses and 0 batches.
      // Prior bug: returned counts[3] || 6 and counts[4] || 4.
      expect(res.body.data.courses).toBe(0);
      expect(res.body.data.batches).toBe(0);
    });

    it('returns empty array when tenant has no batches, without falling back to defaultBatches', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(Array.isArray(res.body.batches)).toBe(true);
      expect(res.body.batches.length).toBe(0);
    });

    it('returns empty array when tenant has no trainers, without falling back to defaultTrainers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.trainers.length).toBe(0);
    });

    it('scopes courses strictly to tenant', async () => {
      const collegeRes = await request(app)
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(collegeRes.status).toBe(200);
      expect(collegeRes.body.courses.length).toBe(1);
      expect(collegeRes.body.courses[0].code).toBe(`CS-${ts}`);

      const schoolRes = await request(app)
        .get('/api/v1/admin/courses')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(schoolRes.status).toBe(200);
      expect(schoolRes.body.courses.length).toBe(0);
    });

    it('scopes audit logs strictly to tenant', async () => {
      const collegeRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(collegeRes.status).toBe(200);
      expect(collegeRes.body.logs.length).toBeGreaterThanOrEqual(1);

      const schoolRes = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(schoolRes.status).toBe(200);
      expect(schoolRes.body.logs.length).toBe(0);
    });
  });

  describe('3. Company Super-Admin Cross-Tenant Oversight', () => {
    it('allows superadmin to see multi-tenant platform overview and institution counts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.institutions).toBeGreaterThanOrEqual(2);
      expect(res.body.data.courses).toBeGreaterThanOrEqual(1);
      expect(res.body.data.batches).toBeGreaterThanOrEqual(1);
    });

    it('allows superadmin to retrieve platform-wide institutions directory', async () => {
      const res = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.institutions.length).toBeGreaterThanOrEqual(2);
      const slugs = res.body.institutions.map((i) => i.slug);
      expect(slugs).toContain(`ntc-${ts}`);
      expect(slugs).toContain(`oak-${ts}`);
    });

    it('returns multi-tenant administrator accounts', async () => {
      const res = await request(app)
        .get('/api/v1/admin/administrators')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const emails = res.body.administrators.map((a) => a.email);
      expect(emails).toContain(`admin.college.${ts}@nexus.edu`);
      expect(emails).toContain(`admin.school.${ts}@oakridge.edu`);
      expect(emails).toContain(`superadmin.${ts}@6thcivilians.org`);
    });
  });

  describe('4. Security Hardening, Sensitive Credential Protection & Immutability', () => {
    it('prevents tenant boundary breach when ordinary admin manipulates ?tenantId query param', async () => {
      // College Admin attempts to query School Tenant data by supplying schoolTenant ID as query parameter
      const res = await request(app)
        .get(`/api/v1/admin/courses?tenantId=${schoolTenant._id}`)
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Must NOT switch context to school tenant: still strictly returns college courses
      expect(res.body.courses.length).toBe(1);
      expect(res.body.courses[0].code).toBe(`CS-${ts}`);
    });

    it('rejects cross-tenant batch modification by ordinary admin', async () => {
      // Create a batch in School Tenant
      const schoolBatch = await Batch.create({
        name: `School Batch ${ts}`,
        code: `SB-${ts}`,
        collegeId: schoolTenant._id,
        tenantId: schoolTenant._id.toString(),
        status: 'active'
      });

      // College admin attempts to modify school batch
      const res = await request(app)
        .put(`/api/v1/admin/batches/${schoolBatch._id}`)
        .set('Authorization', `Bearer ${collegeAdminToken}`)
        .send({ name: 'Hacked Batch Name' });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Batch not found');

      // Verify batch was untouched
      const untouched = await Batch.findById(schoolBatch._id);
      expect(untouched.name).toBe(`School Batch ${ts}`);

      await Batch.deleteOne({ _id: schoolBatch._id });
    });

    it('strictly excludes passwords, twoFactorSecret, and twoFactorBackupCodes from administrator listings', async () => {
      // Set 2FA secrets on college admin in DB to test leak prevention
      await User.updateOne(
        { _id: collegeAdmin._id },
        {
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          twoFactorBackupCodes: ['hash1', 'hash2']
        }
      );

      const res = await request(app)
        .get('/api/v1/admin/administrators')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.administrators.length).toBeGreaterThanOrEqual(1);

      res.body.administrators.forEach((adm) => {
        expect(adm.password).toBeUndefined();
        expect(adm.twoFactorSecret).toBeUndefined();
        expect(adm.twoFactorBackupCodes).toBeUndefined();
      });
    });

    it('strictly excludes passwords, twoFactorSecret, and twoFactorBackupCodes from trainer listings', async () => {
      const res = await request(app)
        .get('/api/v1/admin/trainers')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      res.body.trainers.forEach((trn) => {
        expect(trn.password).toBeUndefined();
        expect(trn.twoFactorSecret).toBeUndefined();
        expect(trn.twoFactorBackupCodes).toBeUndefined();
      });
    });

    it('protects audit logs from unauthorized mutation or deletion (immutable audit log)', async () => {
      // Attempt to POST, PUT, DELETE audit logs directly
      const postRes = await request(app)
        .post('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${collegeAdminToken}`)
        .send({ action: 'FORGED_LOG' });
      expect([404, 405]).toContain(postRes.status);

      const deleteRes = await request(app)
        .delete('/api/v1/admin/audit-logs/123')
        .set('Authorization', `Bearer ${collegeAdminToken}`);
      expect([404, 405]).toContain(deleteRes.status);
    });

    it('returns authentic real analytics stats and live batchBreakdown', async () => {
      const res = await request(app)
        .get('/api/v1/admin/analytics')
        .set('Authorization', `Bearer ${collegeAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.coursesCount).toBe(1);
      expect(res.body.stats.batchesCount).toBe(1);
      expect(Array.isArray(res.body.batchBreakdown)).toBe(true);
      expect(res.body.batchBreakdown.length).toBe(1);
      expect(res.body.batchBreakdown[0].name).toBe(`Batch Alpha ${ts}`);
    });
  });

  describe('5. Pre-Provisioning Safety, Password Rotation & Mongoose Immutability', () => {
    it('enforces Mongoose schema-level immutability on AuditLog preventing update operations', async () => {
      const log = await AuditLog.create({
        tenantId: collegeTenant._id,
        action: 'TEST_IMMUTABILITY',
        actor: { userId: collegeAdmin._id, role: 'admin', email: collegeAdmin.email }
      });

      // Attempt updateOne on audit record
      await expect(
        AuditLog.updateOne({ _id: log._id }, { action: 'ALTERED_ACTION' })
      ).rejects.toThrow('Security Violation: AuditLog records are immutable and cannot be modified.');

      // Attempt findOneAndUpdate on audit record
      await expect(
        AuditLog.findOneAndUpdate({ _id: log._id }, { action: 'ALTERED_ACTION' })
      ).rejects.toThrow('Security Violation: AuditLog records are immutable and cannot be modified.');
    });

    it('enforces mustChangePassword lockdown on all protected portal endpoints', async () => {
      // Create user with mustChangePassword: true
      const tempAdmin = await User.create({
        studentId: `TEMP-ADM-${ts}`,
        name: `Temp Admin ${ts}`,
        email: `temp.admin.${ts}@nexus.edu`,
        password: 'HashedPassword123!',
        role: 'admin',
        tenantId: collegeTenant._id.toString(),
        mustChangePassword: true,
        status: 'active'
      });

      const tempToken = jwt.sign(
        { id: tempAdmin._id, role: 'admin', tenantId: collegeTenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Attempting to access admin overview must be blocked
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MUST_CHANGE_PASSWORD');

      // But accessing whitelisted endpoint /api/v1/auth/profile must be allowed
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.success).toBe(true);
      expect(profileRes.body.user.mustChangePassword).toBe(true);
    });

    it('validates super-admin provisioning password policy and safety constraints', async () => {
      const { validatePasswordComplexity } = await import('../scripts/provisionSuperAdmin.js');

      // Too short (< 14)
      expect(validatePasswordComplexity('Short123!')).toContain('at least 14 characters');

      // Missing digits
      expect(validatePasswordComplexity('NoDigitsHereAtAll!#')).toContain('at least one digit');

      // Missing special symbols
      expect(validatePasswordComplexity('NoSymbolsHere12345')).toContain('at least one special symbol');

      // Valid complexity
      expect(validatePasswordComplexity('ValidStr0ngP@ssword123!')).toBeNull();
    });

    it('super-admin provisioning rejects target database mismatch', async () => {
      const { provisionSuperAdmin } = await import('../scripts/provisionSuperAdmin.js');

      await expect(
        provisionSuperAdmin({
          email: `superadmin.mismatch.${ts}@6thcivilians.org`,
          password: 'ValidStr0ngP@ssword123!',
          expectedDatabaseName: 'production_wrong_cluster_name',
          confirm: true,
          allowEphemeral: true
        })
      ).rejects.toThrow('Target Database Mismatch');
    });

    it('super-admin provisioning reports critical unresolved state when both audit and rollback deletion fail', async () => {
      const { provisionSuperAdmin } = await import('../scripts/provisionSuperAdmin.js');
      const testEmail = `superadmin.critical.${ts}@6thcivilians.org`;
      const secretPassword = 'ValidStr0ngP@ssword123!';

      // Spy on AuditLog.create to simulate audit write failure
      const auditSpy = jest.spyOn(AuditLog, 'create').mockImplementationOnce(() => {
        throw new Error('Audit collection partition failure');
      });

      // Spy on User.findByIdAndDelete to simulate catastrophic rollback deletion failure
      const deleteSpy = jest.spyOn(User, 'findByIdAndDelete').mockImplementationOnce(() => {
        throw new Error('Database write lock / replica set timeout');
      });

      let caughtError = null;
      try {
        await provisionSuperAdmin({
          email: testEmail,
          password: secretPassword,
          confirm: true,
          allowEphemeral: true
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toContain('CRITICAL UNRESOLVED STATE');
      expect(caughtError.message).toContain('Audit collection partition failure');
      expect(caughtError.message).toContain('Database write lock / replica set timeout');
      expect(caughtError.message).toContain(testEmail);
      // NEVER leak secrets or password in error message
      expect(caughtError.message).not.toContain(secretPassword);

      auditSpy.mockRestore();
      deleteSpy.mockRestore();

      // Clean up manually for subsequent tests
      await User.deleteOne({ email: testEmail });
    });

    it('super-admin provisioning rejects cluster identity mismatch and enforces identity in production', async () => {
      const { provisionSuperAdmin, extractUriClusterHost, sanitizeErrorMessage } = await import('../scripts/provisionSuperAdmin.js');

      // 1. SRV cluster host extraction helper
      expect(extractUriClusterHost('mongodb+srv://adminUser:SecretPass123@cluster0.mongodb.net/production?retryWrites=true')).toBe('cluster0.mongodb.net');
      expect(extractUriClusterHost('mongodb://127.0.0.1:27017/test_db')).toBe('127.0.0.1:27017');

      // 2. Error message credential sanitization helper
      const sanitized = sanitizeErrorMessage('Error: failed to connect to mongodb+srv://admin:TopSecretPwd@cluster0.mongodb.net/?password=PlainSecret');
      expect(sanitized).not.toContain('TopSecretPwd');
      expect(sanitized).not.toContain('PlainSecret');
      expect(sanitized).toContain('[REDACTED_CREDENTIALS]');

      // 3. Malformed cluster identity or database name must fail closed
      await expect(
        provisionSuperAdmin({
          email: `superadmin.malformed.${ts}@6thcivilians.org`,
          password: 'ValidStr0ngP@ssword123!',
          expectedClusterIdentity: '   ',
          confirm: true,
          allowEphemeral: true
        })
      ).rejects.toThrow('Target Identity Error: Provided expectedClusterIdentity is malformed or empty.');

      await expect(
        provisionSuperAdmin({
          email: `superadmin.malformed.${ts}@6thcivilians.org`,
          password: 'ValidStr0ngP@ssword123!',
          expectedDatabaseName: '',
          confirm: true,
          allowEphemeral: true
        })
      ).rejects.toThrow('Target Identity Error: Provided expectedDatabaseName is malformed or empty.');

      // 4. Mismatched cluster identity must abort
      await expect(
        provisionSuperAdmin({
          email: `superadmin.cluster.${ts}@6thcivilians.org`,
          password: 'ValidStr0ngP@ssword123!',
          expectedClusterIdentity: 'unmatched-production-atlas-cluster-shard-00',
          confirm: true,
          allowEphemeral: true
        })
      ).rejects.toThrow('Target Cluster Mismatch');

      // 5. In production, missing target cluster must fail closed
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(
          provisionSuperAdmin({
            email: `superadmin.prod.${ts}@6thcivilians.org`,
            password: 'ValidStr0ngP@ssword123!',
            expectedDatabaseName: 'lumina_production',
            confirm: true,
            confirmProduction: true,
            allowEphemeral: true
          })
        ).rejects.toThrow('Operational Safety: In production (NODE_ENV=production), --target-cluster');
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });

    it('enforces mandatory MFA enrollment state transitions and backup code one-time use', async () => {
      const speakeasy = (await import('speakeasy')).default;
      const bcrypt = (await import('bcrypt')).default;

      // 1. Create a privileged user with mfaEnforced=true and isTwoFactorEnabled=false
      const privilegedUser = await User.create({
        studentId: `MFA-REQ-${ts}`,
        name: `Privileged Admin ${ts}`,
        email: `priv.mfa.${ts}@nexus.edu`,
        password: await bcrypt.hash('HashedPassword123!', 12),
        role: 'superadmin',
        mustChangePassword: false,
        mfaEnforced: true,
        mfaSetupRequired: true,
        isTwoFactorEnabled: false,
        status: 'active'
      });

      const privToken = jwt.sign(
        { id: privilegedUser._id, role: 'superadmin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Attempting to access admin overview must be blocked with MFA_SETUP_REQUIRED
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${privToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_SETUP_REQUIRED');

      // Step A: Calling 2FA setup returns secret & QR code
      const setupRes = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${privToken}`);

      expect(setupRes.status).toBe(200);
      expect(setupRes.body.success).toBe(true);
      expect(setupRes.body.secret).toBeDefined();
      expect(setupRes.body.qrCode).toBeDefined();
      expect(setupRes.body.backupCodes.length).toBe(5);

      // CRITICAL ASSERTION: Generating secret/QR code MUST NOT activate MFA!
      const userAfterSetup = await User.findById(privilegedUser._id);
      expect(userAfterSetup.isTwoFactorEnabled).toBe(false);

      // Admin overview MUST STILL BE BLOCKED!
      const stillBlockedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${privToken}`);
      expect(stillBlockedRes.status).toBe(403);
      expect(stillBlockedRes.body.code).toBe('MFA_SETUP_REQUIRED');

      // Step B: Attempting verification with an invalid code must reject
      const invalidVerifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${privToken}`)
        .send({ token: '000000' });
      expect(invalidVerifyRes.status).toBe(401);

      // isTwoFactorEnabled must still be false
      const userAfterInvalid = await User.findById(privilegedUser._id);
      expect(userAfterInvalid.isTwoFactorEnabled).toBe(false);

      // Step C: Verify with valid TOTP code
      const validCode = speakeasy.totp({
        secret: setupRes.body.secret,
        encoding: 'base32'
      });

      const validVerifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${privToken}`)
        .send({ token: validCode });

      expect(validVerifyRes.status).toBe(200);
      expect(validVerifyRes.body.success).toBe(true);
      expect(validVerifyRes.body.isTwoFactorEnabled).toBe(true);

      // Database record must now have isTwoFactorEnabled: true
      const userAfterValid = await User.findById(privilegedUser._id);
      expect(userAfterValid.isTwoFactorEnabled).toBe(true);
      expect(userAfterValid.mfaSetupRequired).toBe(false);

      // Overview must now be accessible
      const overviewRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${privToken}`);

      expect(overviewRes.status).toBe(200);
      expect(overviewRes.body.success).toBe(true);

      // Step D: Verify subsequent login challenge with backup code and enforce single-use
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `priv.mfa.${ts}@nexus.edu`,
          password: 'HashedPassword123!'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.requires2FA).toBe(true);
      expect(loginRes.body.preAuthToken).toBeDefined();

      const singleUseBackupCode = setupRes.body.backupCodes[0];

      // Verify with the first backup code
      const backupVerifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({
          preAuthToken: loginRes.body.preAuthToken,
          token: singleUseBackupCode
        });

      expect(backupVerifyRes.status).toBe(200);
      expect(backupVerifyRes.body.success).toBe(true);
      expect(backupVerifyRes.body.token).toBeDefined();

      // Check remaining backup codes in database (must be 4 now)
      const userAfterBackupUse = await User.findById(privilegedUser._id).select('+twoFactorBackupCodes');
      expect(userAfterBackupUse.twoFactorBackupCodes.length).toBe(4);

      // Attempting to re-use the SAME backup code on next login must fail
      const loginRes2 = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `priv.mfa.${ts}@nexus.edu`,
          password: 'HashedPassword123!'
        });

      const reuseBackupRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({
          preAuthToken: loginRes2.body.preAuthToken,
          token: singleUseBackupCode
        });

      expect(reuseBackupRes.status).toBe(401);
      expect(reuseBackupRes.body.message).toContain('Invalid 2FA code');
    });

    it('verifies first-login mustChangePassword restriction and successful rotation flow', async () => {
      const bcrypt = (await import('bcrypt')).default;
      const initialHashed = await bcrypt.hash('InitialTempPass123!', 12);

      const firstLoginUser = await User.create({
        studentId: `ROTATION-${ts}`,
        name: `Rotation User ${ts}`,
        email: `rotation.${ts}@nexus.edu`,
        password: initialHashed,
        role: 'admin',
        tenantId: collegeTenant._id.toString(),
        mustChangePassword: true,
        status: 'active'
      });

      const rotToken = jwt.sign(
        { id: firstLoginUser._id, role: 'admin', tenantId: collegeTenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // 1. Overview is blocked
      const blockedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${rotToken}`);
      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.code).toBe('MUST_CHANGE_PASSWORD');

      // Substring spoofing attempt via query params (e.g. /batches?redirect=/auth/change-password) must be blocked
      const spoofRes = await request(app)
        .get('/api/v1/admin/batches?redirect=/auth/change-password')
        .set('Authorization', `Bearer ${rotToken}`);
      expect(spoofRes.status).toBe(403);
      expect(spoofRes.body.code).toBe('MUST_CHANGE_PASSWORD');

      // 2. Calling change-password endpoint succeeds
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${rotToken}`)
        .send({
          newPassword: 'BrandNewStrongPass999!'
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // 3. Database record is updated: mustChangePassword is false
      const updatedUser = await User.findById(firstLoginUser._id);
      expect(updatedUser.mustChangePassword).toBe(false);

      // 4. Subsequent overview request succeeds
      const allowedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${rotToken}`);
      expect(allowedRes.status).toBe(200);
    });

    it('enforces exact path and HTTP method normalization matrix against bypass attempts', async () => {
      // 1. Direct unit assertions on normalizeRequestPath
      expect(normalizeRequestPath('/API//v1///auth//change-password/?token=abc#hash')).toBe('/api/v1/auth/change-password');
      expect(normalizeRequestPath('//api///v1////auth//2FA//verify/')).toBe('/api/v1/auth/2fa/verify');
      expect(normalizeRequestPath('/api/%761/auth/change-password')).toBe('/api/v1/auth/change-password');
      expect(normalizeRequestPath('///')).toBe('/');
      expect(normalizeRequestPath(null)).toBe('');
      expect(normalizeRequestPath(undefined)).toBe('');

      // 2. Integration route testing with mustChangePassword restriction
      const bcrypt = (await import('bcrypt')).default;
      const initialHashed = await bcrypt.hash('MatrixTempPass123!', 12);

      const matrixUser = await User.create({
        studentId: `MATRIX-${ts}`,
        name: `Matrix User ${ts}`,
        email: `matrix.${ts}@nexus.edu`,
        password: initialHashed,
        role: 'admin',
        tenantId: collegeTenant._id.toString(),
        mustChangePassword: true,
        status: 'active'
      });

      const matrixToken = jwt.sign(
        { id: matrixUser._id, role: 'admin', tenantId: collegeTenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Query param spoofing attempt: /api/v1/admin/overview?redirect=/api/v1/auth/change-password must be blocked
      const spoofRes = await request(app)
        .get('/api/v1/admin/overview?redirect=/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${matrixToken}`);
      expect(spoofRes.status).toBe(403);
      expect(spoofRes.body.code).toBe('MUST_CHANGE_PASSWORD');

      // Duplicate slashes in request path: rejected at security boundary with 400 Bad Request
      const dupSlashBlocked = await request(app)
        .get('//api/v1/admin/overview')
        .set('Authorization', `Bearer ${matrixToken}`);
      expect(dupSlashBlocked.status).toBe(400);
      expect(dupSlashBlocked.body.error.code).toBe('AMBIGUOUS_PATH');

      // Whitelisted change-password request with trailing slash succeeds
      const trailingSlashAllowed = await request(app)
        .post('/api/v1/auth/change-password/')
        .set('Authorization', `Bearer ${matrixToken}`)
        .send({
          newPassword: 'MatrixNewStrongPass999!'
        });
      expect(trailingSlashAllowed.status).toBe(200);
      expect(trailingSlashAllowed.body.success).toBe(true);

      // Subsequent overview request now succeeds
      const allowedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${matrixToken}`);
      expect(allowedRes.status).toBe(200);
    });

    it('rejects unauthenticated 2FA setup and verifies repeated setup secret replacement', async () => {
      const speakeasy = (await import('speakeasy')).default;

      // 1. Unauthenticated 2FA setup must return 401
      const unauthSetupRes = await request(app)
        .post('/api/v1/auth/2fa/setup');
      expect(unauthSetupRes.status).toBe(401);

      // 2. Setup 2FA for an authenticated user
      const setupUser = await User.create({
        studentId: `SETUP-ROT-${ts}`,
        name: `Setup Rot User ${ts}`,
        email: `setuprot.${ts}@nexus.edu`,
        password: 'HashedPassword123!',
        role: 'admin',
        tenantId: collegeTenant._id.toString(),
        status: 'active'
      });

      const userToken = jwt.sign(
        { id: setupUser._id, role: 'admin', tenantId: collegeTenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // First setup call
      const setup1Res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${userToken}`);
      expect(setup1Res.status).toBe(200);
      const secret1 = setup1Res.body.secret;
      expect(secret1).toBeDefined();

      // User must NOT be marked enabled yet
      let dbUser = await User.findById(setupUser._id);
      expect(dbUser.isTwoFactorEnabled).toBe(false);

      // Second setup call (user re-requests before completing first setup)
      const setup2Res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${userToken}`);
      expect(setup2Res.status).toBe(200);
      const secret2 = setup2Res.body.secret;
      expect(secret2).toBeDefined();
      expect(secret2).not.toBe(secret1);

      // Code generated from the first secret must now be rejected
      const oldTokenCode = speakeasy.totp({ secret: secret1, encoding: 'base32' });
      const verifyOldRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token: oldTokenCode });
      expect(verifyOldRes.status).toBe(401);
      expect(verifyOldRes.body.message).toContain('Invalid 2FA code');

      // Valid code from current secret2 succeeds
      const newTokenCode = speakeasy.totp({ secret: secret2, encoding: 'base32' });
      const verifyNewRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ token: newTokenCode });
      expect(verifyNewRes.status).toBe(200);
      expect(verifyNewRes.body.success).toBe(true);

      dbUser = await User.findById(setupUser._id);
      expect(dbUser.isTwoFactorEnabled).toBe(true);
    });

    it('enforces atomic single-use backup code consumption under concurrent verification requests', async () => {
      // Clear in-memory rate limiter so this test starts with a clean window
      resetRateLimitMemoryStore();

      const bcrypt = (await import('bcrypt')).default;

      // Create a user with 2FA enabled and 2 known backup codes (hashed with bcrypt like setup2FA)
      const rawCode = 'RACE-CODE-1234';
      const codeHash = await bcrypt.hash(rawCode, 12);
      const dummyHash = await bcrypt.hash('DUMMY-CODE-9999', 12);

      const speakeasy = (await import('speakeasy')).default;
      const dummySecret = speakeasy.generateSecret().base32;

      const passHash = await bcrypt.hash('RacePass123!', 12);
      const raceUser = await User.create({
        studentId: `RACE-${ts}`,
        name: `Race User ${ts}`,
        email: `race.${ts}@nexus.edu`,
        password: passHash,
        role: 'superadmin',
        twoFactorSecret: dummySecret,
        isTwoFactorEnabled: true,
        twoFactorBackupCodes: [codeHash, dummyHash],
        status: 'active'
      });

      // Issue preAuthToken with preAuth: true
      const preAuthToken = jwt.sign(
        { id: raceUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      // Fire 2 concurrent verify requests using the exact same backup code
      const [res1, res2] = await Promise.all([
        request(app)
          .post('/api/v1/auth/2fa/verify')
          .send({ preAuthToken, token: rawCode }),
        request(app)
          .post('/api/v1/auth/2fa/verify')
          .send({ preAuthToken, token: rawCode })
      ]);

      const statuses = [res1.status, res2.status];
      // Exactly one request must succeed (200), and the other must fail (401)
      expect(statuses).toContain(200);
      expect(statuses).toContain(401);

      // In the database, the backup code must have been removed exactly once, leaving 1 code
      const updatedRaceUser = await User.findById(raceUser._id).select('+twoFactorBackupCodes');
      expect(updatedRaceUser.twoFactorBackupCodes.length).toBe(1);
      expect(updatedRaceUser.twoFactorBackupCodes[0]).toBe(dummyHash);
    });
  });
});
