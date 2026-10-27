/**
 * EdWth LMS — MFA Security & Tenant Isolation Audit Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Authenticated user can only enroll MFA for their own account (identity from token, not body/params).
 * 2. Setup endpoint requires valid authentication and rejects unauthenticated requests with 401.
 * 3. Audit of setup2FA on an already-enrolled user (identifies whether secret replacement is blocked or permitted).
 * 4. Enrollment is activated ONLY after backend verifies authentic TOTP token.
 * 5. TOTP secrets are protected and excluded from profile, admin, trainer, and student endpoints.
 * 6. Recovery codes are hashed at rest, single-use, and consumed atomically.
 * 7. Backend strictly enforces MFA requirement on privileged routes (fail-closed).
 * 8. Role-Based Access Control: Student and Tenant Admin cannot access SuperAdmin endpoints.
 * 9. Tenant Isolation: Admin of Tenant A cannot view or access batches, students, or data of Tenant B.
 * 10. Dashboard counts reflect persisted MongoDB documents.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import speakeasy from 'speakeasy';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import { getJwtSecret } from '../config/environment.js';
import { decryptTotpSecret } from '../utils/mfaCrypto.js';

describe('EdWth LMS — Critical MFA Security & Tenant Isolation Audit', () => {
  let tenantA;
  let tenantB;
  let superadminUser;
  let superadminToken;
  let adminAUser;
  let adminAToken;
  let adminBUser;
  let adminBToken;
  let studentAUser;
  let studentAToken;
  let batchA;
  let batchB;

  const testRunId = Date.now();

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    // 1. Create two separate tenants
    tenantA = await College.create({
      name: `Audit Tenant Alpha ${testRunId}`,
      code: `AUDIT-A-${testRunId}`,
      slug: `audit-a-${testRunId}`,
      institutionType: 'college',
      status: 'active'
    });

    tenantB = await College.create({
      name: `Audit Tenant Beta ${testRunId}`,
      code: `AUDIT-B-${testRunId}`,
      slug: `audit-b-${testRunId}`,
      institutionType: 'school',
      status: 'active'
    });

    // 2. Create SuperAdmin
    superadminUser = await User.create({
      name: `SuperAdmin Audit ${testRunId}`,
      email: `superadmin.${testRunId}@edwth.audit`,
      studentId: `SA-AUD-${testRunId}`,
      password: await bcrypt.hash('SuperAdminPass!2026', 10),
      role: 'superadmin',
      tenantId: null,
      mfaEnforced: true,
      mfaSetupRequired: true,
      isTwoFactorEnabled: false
    });
    superadminToken = jwt.sign(
      { id: superadminUser._id, role: 'superadmin', tenantId: null },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 3. Create Admin for Tenant A
    adminAUser = await User.create({
      name: `Admin Tenant A ${testRunId}`,
      email: `adminA.${testRunId}@edwth.audit`,
      studentId: `ADM-A-${testRunId}`,
      password: await bcrypt.hash('AdminAPass!2026', 10),
      role: 'admin',
      tenantId: tenantA._id,
      mfaEnforced: false,
      isTwoFactorEnabled: false
    });
    adminAToken = jwt.sign(
      { id: adminAUser._id, role: 'admin', tenantId: tenantA._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 4. Create Admin for Tenant B
    adminBUser = await User.create({
      name: `Admin Tenant B ${testRunId}`,
      email: `adminB.${testRunId}@edwth.audit`,
      studentId: `ADM-B-${testRunId}`,
      password: await bcrypt.hash('AdminBPass!2026', 10),
      role: 'admin',
      tenantId: tenantB._id,
      mfaEnforced: false,
      isTwoFactorEnabled: false
    });
    adminBToken = jwt.sign(
      { id: adminBUser._id, role: 'admin', tenantId: tenantB._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 5. Create Student in Tenant A
    studentAUser = await User.create({
      name: `Student A ${testRunId}`,
      email: `studentA.${testRunId}@edwth.audit`,
      studentId: `STU-A-${testRunId}`,
      password: await bcrypt.hash('StudentAPass!2026', 10),
      role: 'student',
      tenantId: tenantA._id,
      mfaEnforced: false,
      isTwoFactorEnabled: false
    });
    studentAToken = jwt.sign(
      { id: studentAUser._id, role: 'student', tenantId: tenantA._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );

    // 6. Create distinct Batches
    batchA = await Batch.create({
      tenantId: tenantA._id,
      name: `Batch Alpha ${testRunId}`,
      code: `BA-${testRunId}`,
      status: 'active'
    });

    batchB = await Batch.create({
      tenantId: tenantB._id,
      name: `Batch Beta ${testRunId}`,
      code: `BB-${testRunId}`,
      status: 'active'
    });
  });

  afterAll(async () => {
    const tenantIds = [tenantA?._id, tenantB?._id].filter(Boolean);
    if (tenantIds.length) await College.deleteMany({ _id: { $in: tenantIds } });
    const userIds = [superadminUser?._id, adminAUser?._id, adminBUser?._id, studentAUser?._id].filter(Boolean);
    if (userIds.length) await User.deleteMany({ _id: { $in: userIds } });
    const batchIds = [batchA?._id, batchB?._id].filter(Boolean);
    if (batchIds.length) await Batch.deleteMany({ _id: { $in: batchIds } });
  });

  // ─── PART A: MFA SECURITY AUDIT ───────────────────────────────────────────

  describe('Part A: MFA Security Invariants', () => {
    it('A1: Rejects unauthenticated requests to POST /api/v1/auth/2fa/setup with 401', async () => {
      const res = await request(app).post('/api/v1/auth/2fa/setup');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('A2: Setup strictly binds to authenticated session identity (cannot setup for another user via payload tampering)', async () => {
      // Admin A attempts to submit Admin B ID in body
      const res = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ userId: adminBUser._id.toString(), email: adminBUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify DB: Admin A's record was updated with the encrypted secret, NOT Admin B's
      const refreshedA = await User.findById(adminAUser._id).select('+twoFactorSecret');
      const refreshedB = await User.findById(adminBUser._id).select('+twoFactorSecret');

      expect(decryptTotpSecret(refreshedA.twoFactorSecret)).toBe(res.body.secret);
      expect(refreshedB.twoFactorSecret).toBeUndefined(); // Admin B untouched
    });

    it('A3: Verify enrollment activation occurs ONLY upon valid TOTP verification', async () => {
      let userInDb = await User.findById(adminAUser._id).select('+twoFactorSecret');
      expect(userInDb.isTwoFactorEnabled).toBe(false);

      // Attempt verification with invalid code
      const invalidRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ token: '999999' });

      expect(invalidRes.status).toBe(401);
      userInDb = await User.findById(adminAUser._id).select('+twoFactorSecret');
      expect(userInDb.isTwoFactorEnabled).toBe(false);

      // Verify with authentic TOTP code
      const validCode = speakeasy.totp({
        secret: decryptTotpSecret(userInDb.twoFactorSecret),
        encoding: 'base32'
      });

      const validRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ token: validCode });

      expect(validRes.status).toBe(200);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.isTwoFactorEnabled).toBe(true);

      userInDb = await User.findById(adminAUser._id).select('+twoFactorSecret');
      expect(userInDb.isTwoFactorEnabled).toBe(true);
    });

    it('A4: Strictly blocks unauthorized secret replacement on already-enrolled accounts (prevents MFA downgrade)', async () => {
      // Admin A is now enrolled (isTwoFactorEnabled = true)
      const enrolledUserBefore = await User.findById(adminAUser._id).select('+twoFactorSecret');
      expect(enrolledUserBefore.isTwoFactorEnabled).toBe(true);
      const originalSecret = enrolledUserBefore.twoFactorSecret;

      // Attempt to call ordinary setup without re-authentication
      const setupRes = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(setupRes.status).toBe(403);
      expect(setupRes.body.success).toBe(false);
      expect(setupRes.body.code).toBe('MFA_ALREADY_ENROLLED');

      const enrolledUserAfter = await User.findById(adminAUser._id).select('+twoFactorSecret');

      // VULNERABILITY REMEDIATED:
      // Secret is NOT replaced, and MFA is NOT disabled
      expect(enrolledUserAfter.twoFactorSecret).toBe(originalSecret);
      expect(enrolledUserAfter.isTwoFactorEnabled).toBe(true);
    });

    it('A5: twoFactorSecret and twoFactorBackupCodes are never returned in public user profile or listings', async () => {
      // 1. Profile endpoint
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user).toBeDefined();
      expect(profileRes.body.user.twoFactorSecret).toBeUndefined();
      expect(profileRes.body.user.twoFactorBackupCodes).toBeUndefined();
      expect(profileRes.body.user.password).toBeUndefined();

      // 2. Administrators listing endpoint
      const adminsRes = await request(app)
        .get('/api/v1/admin/administrators')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(adminsRes.status).toBe(200);
      if (Array.isArray(adminsRes.body.administrators)) {
        adminsRes.body.administrators.forEach(adm => {
          expect(adm.twoFactorSecret).toBeUndefined();
          expect(adm.twoFactorBackupCodes).toBeUndefined();
          expect(adm.password).toBeUndefined();
        });
      }
    });

    it('A6: Recovery backup codes are hashed with bcrypt and consumed single-use', async () => {
      // Generate setup for superadminUser
      const setupRes = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(setupRes.status).toBe(200);
      const backupCodes = setupRes.body.backupCodes;
      expect(backupCodes.length).toBe(5);

      // Verify that DB stores bcrypt hashes, NOT the plaintext codes
      const dbSuper = await User.findById(superadminUser._id).select('+twoFactorBackupCodes');
      expect(dbSuper.twoFactorBackupCodes.length).toBe(5);
      for (const hash of dbSuper.twoFactorBackupCodes) {
        expect(hash).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash pattern
        expect(backupCodes).not.toContain(hash); // Plaintext is not stored
      }

      // Activate 2FA first
      const validCode = speakeasy.totp({ secret: setupRes.body.secret, encoding: 'base32' });
      await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ token: validCode });

      // Create a login preAuthToken to simulate login 2FA verification using a backup code
      const preAuthToken = jwt.sign(
        { id: superadminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      const codeToUse = backupCodes[0];

      // First use of backup code: must succeed
      const use1Res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken, token: codeToUse });

      expect(use1Res.status).toBe(200);
      expect(use1Res.body.success).toBe(true);
      expect(use1Res.body.token).toBeDefined();

      // Second use of same backup code: must fail (single-use consumed)
      const preAuthToken2 = jwt.sign(
        { id: superadminUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      const use2Res = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .send({ preAuthToken: preAuthToken2, token: codeToUse });

      expect(use2Res.status).toBe(401);
      expect(use2Res.body.message).toContain('Invalid 2FA code');

      // Verify DB now has 4 backup codes left
      const dbSuperAfter = await User.findById(superadminUser._id).select('+twoFactorBackupCodes');
      expect(dbSuperAfter.twoFactorBackupCodes.length).toBe(4);
    });

    it('A7: Backend enforces MFA for unenrolled SuperAdmin regardless of frontend requests', async () => {
      // Set superadmin to unenrolled in DB
      await User.findByIdAndUpdate(superadminUser._id, { isTwoFactorEnabled: false, mfaEnforced: true });

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('MFA_SETUP_REQUIRED');
    });

    it('A8: Ordinary student and tenant admin cannot access SuperAdmin functions', async () => {
      // 1. Student access to admin route blocked
      const stuRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${studentAToken}`);

      expect(stuRes.status).toBe(403);
      expect(stuRes.body.message).toContain('Insufficient privileges');

      // 2. Tenant Admin access to SuperAdmin-only institution creation blocked
      const adminInstRes = await request(app)
        .post('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${adminAToken}`)
        .send({ name: 'Malicious Inst', code: 'MAL-01' });

      expect(adminInstRes.status).toBe(403);
      expect(adminInstRes.body.message).toContain('Super-Administrators can register new institutions');
    });
  });

  // ─── PART B & C: TENANT ISOLATION AUDIT ───────────────────────────────────

  describe('Part B & C: Multi-Tenant Data Segregation Invariants', () => {
    it('C1: Each institution possesses a unique immutable MongoDB _id and tenant identifier', () => {
      expect(tenantA._id.toString()).not.toBe(tenantB._id.toString());
      expect(tenantA.code).not.toBe(tenantB.code);
      expect(tenantA.slug).not.toBe(tenantB.slug);
    });

    it('C2: Admin of Tenant A cannot read Batches belonging to Tenant B', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const batchIds = res.body.batches.map(b => b._id.toString());
      expect(batchIds).toContain(batchA._id.toString());
      expect(batchIds).not.toContain(batchB._id.toString()); // Isolated!
    });

    it('C3: Admin of Tenant B cannot read Batches belonging to Tenant A', async () => {
      const res = await request(app)
        .get('/api/v1/admin/batches')
        .set('Authorization', `Bearer ${adminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const batchIds = res.body.batches.map(b => b._id.toString());
      expect(batchIds).toContain(batchB._id.toString());
      expect(batchIds).not.toContain(batchA._id.toString()); // Isolated!
    });

    it('C4: Admin of Tenant A cannot see institutions other than their own in /admin/institutions', async () => {
      const res = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${adminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const instIds = res.body.institutions.map(i => i._id.toString());
      expect(instIds).toContain(tenantA._id.toString());
      expect(instIds).not.toContain(tenantB._id.toString()); // Isolated!
    });

    it('C5: SuperAdmin cross-tenant access returns both institutions for central platform oversight', async () => {
      // Re-enable 2FA for superadmin to access admin routes
      await User.findByIdAndUpdate(superadminUser._id, { isTwoFactorEnabled: true });

      const res = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superadminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const instIds = res.body.institutions.map(i => i._id.toString());
      expect(instIds).toContain(tenantA._id.toString());
      expect(instIds).toContain(tenantB._id.toString());
    });

    it('C6: Institution student counts reflect persisted MongoDB User records matching tenantId', async () => {
      // Student A belongs to tenantA
      const countA = await User.countDocuments({ tenantId: tenantA._id, role: 'student' });
      const countB = await User.countDocuments({ tenantId: tenantB._id, role: 'student' });

      expect(countA).toBeGreaterThanOrEqual(1);
      expect(countB).toBe(0);

      // Verify the /institutions endpoint accurately reflects these counts
      const res = await request(app)
        .get('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superadminToken}`);

      const instAData = res.body.institutions.find(i => i._id.toString() === tenantA._id.toString());
      const instBData = res.body.institutions.find(i => i._id.toString() === tenantB._id.toString());

      expect(instAData.studentsCount).toBe(countA);
      expect(instBData.studentsCount).toBe(0);
    });
  });
});
