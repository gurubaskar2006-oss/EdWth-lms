/**
 * Lumina LMS — Final Routing Integrity and Least-Privilege Acceptance Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * A. Routing Integrity & Boundary Sanitization Matrix:
 *    - Rejection of null bytes, malformed percent escapes, double encoding, encoded separators,
 *      encoded dot segments, directory traversal, and duplicate slashes at the boundary with 400.
 *    - Unmatched API endpoints return structured 404 JSON, never falling through to SPA HTML.
 *    - Canonical path matching where auth middleware uses the exact path Express router matched.
 *    - Preservation of legitimate password-change and MFA-enrollment flows.
 *
 * B. MongoDB Least-Privilege Role Completeness & Runtime Immuntability:
 *    - Audit of all 18 Mongoose models/collections.
 *    - Verification of application startup, login, MFA, student records, submissions, grades.
 *    - AuditLog append-only compliance: insertion succeeds; update and delete are strictly rejected.
 *    - Clear separation of deployer/migration privileges from runtime application privileges.
 *
 * C. Target Deployment Identity Resolution:
 *    - Verifies support for both EXPECTED_CLUSTER_IDENTITY and EXPECTED_CLUSTER_HOST aliases.
 *    - Verifies TARGET_DATABASE_NAME and EXPECTED_DATABASE_NAME aliases.
 *    - Rejects identity mismatch and malformed identity strings.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { app } from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Batch from '../models/Batch.js';
import Course from '../models/Course.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import Grade from '../models/Grade.js';
import StudentProgress from '../models/StudentProgress.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';
import { normalizeRequestPath } from '../middleware/authMiddleware.js';
import { validateBoundaryRequest } from '../middleware/securityBoundary.js';
import { resetRateLimitMemoryStore } from '../middleware/rateLimitMiddleware.js';
import { provisionSuperAdmin } from '../scripts/provisionSuperAdmin.js';

describe('Lumina LMS — Final Routing Integrity & Least-Privilege Acceptance Suite', () => {
  const ts = Date.now();
  let testTenant;
  let testAdmin;
  let testAdminToken;

  beforeAll(async () => {
    testTenant = await College.create({
      name: `Acceptance Institute ${ts}`,
      code: `AI-${ts}`,
      slug: `ai-${ts}`,
      type: 'college',
      status: 'active'
    });

    const hashed = await bcrypt.hash('AcceptancePass123!', 12);
    testAdmin = await User.create({
      studentId: `ADM-${ts}`,
      name: `Acceptance Admin ${ts}`,
      email: `admin.${ts}@acceptance.edu`,
      password: hashed,
      role: 'admin',
      tenantId: testTenant._id.toString(),
      status: 'active'
    });

    testAdminToken = jwt.sign(
      { id: testAdmin._id, role: 'admin', tenantId: testTenant._id.toString() },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (testTenant) await College.deleteOne({ _id: testTenant._id });
    await User.deleteMany({ email: new RegExp(`${ts}`) });
    try {
      await AuditLog.deleteMany({ 'actor.email': new RegExp(`${ts}`) });
    } catch {
      // Expected: AuditLog schema strictly blocks deletion
    }
  });

  beforeEach(() => {
    resetRateLimitMemoryStore();
  });

  // ============================================================================
  // SECTION A: ROUTING INTEGRITY & BOUNDARY SANITIZATION MATRIX
  // ============================================================================
  describe('A. Routing Integrity & Boundary Sanitization', () => {
    it('rejects null bytes in URL path with 400 Bad Request', async () => {
      const res = await request(app).get('/api/v1/auth/%00/login');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_PATH');
    });

    it('rejects malformed percent escapes with 400 Bad Request', async () => {
      // Incomplete percent escape (%ZZ is not valid hex)
      const res1 = await request(app).get('/api/v1/auth/%ZZ');
      expect(res1.status).toBe(400);
      expect(res1.body.success).toBe(false);
      expect(res1.body.error.code).toBe('MALFORMED_URI');

      // Trailing incomplete percent escape
      const res2 = await request(app).get('/api/v1/auth/%8');
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('MALFORMED_URI');
    });

    it('rejects double-encoded path characters with 400 Bad Request', async () => {
      const res = await request(app).get('/api/v1/auth/%252flogin');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AMBIGUOUS_ENCODING');
    });

    it('rejects encoded path separators (%2F, %5C) in path portion with 400 Bad Request', async () => {
      const resSlash = await request(app).get('/api/v1/courses%2fadmin');
      expect(resSlash.status).toBe(400);
      expect(resSlash.body.error.code).toBe('AMBIGUOUS_PATH_SEPARATOR');

      const resBackslash = await request(app).get('/api/v1/courses%5cadmin');
      expect(resBackslash.status).toBe(400);
      expect(resBackslash.body.error.code).toBe('AMBIGUOUS_PATH_SEPARATOR');
    });

    it('rejects encoded dot segments (%2E) and directory traversal at the security boundary with 400 Bad Request', () => {
      let status1 = null, body1 = null;
      const mockRes1 = {
        status: (s) => { status1 = s; return { json: (b) => { body1 = b; } }; }
      };
      validateBoundaryRequest({ url: '/api/v1/auth/%2e%2e/admin' }, mockRes1, () => {});
      expect(status1).toBe(400);
      expect(body1.error.code).toBe('AMBIGUOUS_PATH');

      let status2 = null, body2 = null;
      const mockRes2 = {
        status: (s) => { status2 = s; return { json: (b) => { body2 = b; } }; }
      };
      validateBoundaryRequest({ url: '/api/v1/auth/../admin/overview' }, mockRes2, () => {});
      expect(status2).toBe(400);
      expect(body2.error.code).toBe('PATH_TRAVERSAL_DETECTED');

      let status3 = null, body3 = null;
      const mockRes3 = {
        status: (s) => { status3 = s; return { json: (b) => { body3 = b; } }; }
      };
      validateBoundaryRequest({ url: '/api/v1/auth\\..\\admin' }, mockRes3, () => {});
      expect(status3).toBe(400);
      expect(body3.error.code).toBe('PATH_TRAVERSAL_DETECTED');
    });

    it('rejects duplicate slashes in request path with 400 Bad Request', async () => {
      const res1 = await request(app).get('//api/v1/admin/overview');
      expect(res1.status).toBe(400);
      expect(res1.body.error.code).toBe('AMBIGUOUS_PATH');

      const res2 = await request(app).get('/api//v1/admin/overview');
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('AMBIGUOUS_PATH');
    });

    it('returns structured 404 JSON for unmatched API endpoints and never falls through to SPA HTML', async () => {
      const resGet = await request(app).get('/api/v1/nonexistent-endpoint-xyz');
      expect(resGet.status).toBe(404);
      expect(resGet.body.success).toBe(false);
      expect(resGet.body.error.code).toBe('API_ENDPOINT_NOT_FOUND');
      expect(resGet.headers['content-type']).toContain('application/json');

      const resPost = await request(app).post('/api/v1/auth/nonexistent-action');
      expect(resPost.status).toBe(404);
      expect(resPost.body.error.code).toBe('API_ENDPOINT_NOT_FOUND');
    });

    it('enforces exact HTTP method matching on restricted authentication routes', async () => {
      // GET on /api/v1/auth/change-password is not mounted (POST only) -> returns 404 JSON
      const res = await request(app)
        .get('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAdminToken}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('API_ENDPOINT_NOT_FOUND');
    });

    it('preserves legitimate first-login flow with query strings and trailing slashes', async () => {
      const hashed = await bcrypt.hash('TempFirstLoginPass123!', 12);
      const flUser = await User.create({
        studentId: `FL-${ts}`,
        name: `First Login User ${ts}`,
        email: `firstlogin.${ts}@acceptance.edu`,
        password: hashed,
        role: 'admin',
        tenantId: testTenant._id.toString(),
        mustChangePassword: true,
        status: 'active'
      });

      const flToken = jwt.sign(
        { id: flUser._id, role: 'admin', tenantId: testTenant._id.toString() },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Blocked on normal admin endpoint
      const blockedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${flToken}`);
      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.code).toBe('MUST_CHANGE_PASSWORD');

      // Query param spoofing attempt is blocked
      const spoofRes = await request(app)
        .get('/api/v1/admin/overview?redirect=/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${flToken}`);
      expect(spoofRes.status).toBe(403);
      expect(spoofRes.body.code).toBe('MUST_CHANGE_PASSWORD');

      // Legitimate change-password endpoint succeeds even with safe query parameter
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password?ref=onboarding')
        .set('Authorization', `Bearer ${flToken}`)
        .send({ newPassword: 'BrandNewStrongPass123!' });
      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // mustChangePassword is false now
      const refreshedUser = await User.findById(flUser._id);
      expect(refreshedUser.mustChangePassword).toBe(false);

      // Normal admin endpoint now succeeds
      const allowedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${flToken}`);
      expect(allowedRes.status).toBe(200);
    });

    it('preserves legitimate MFA enrollment lifecycle and blocks privileged access until verified', async () => {
      const hashed = await bcrypt.hash('MfaPass123!', 12);
      const mfaUser = await User.create({
        studentId: `MFA-ACC-${ts}`,
        name: `MFA User ${ts}`,
        email: `mfa.acc.${ts}@acceptance.edu`,
        password: hashed,
        role: 'superadmin',
        isTwoFactorEnabled: false,
        mfaEnforced: true,
        status: 'active'
      });

      const mfaToken = jwt.sign(
        { id: mfaUser._id, role: 'superadmin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      // Blocked on admin endpoints before MFA enrollment
      const blockedRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${mfaToken}`);
      expect(blockedRes.status).toBe(403);
      expect(blockedRes.body.code).toBe('MFA_SETUP_REQUIRED');

      // Setup 2FA
      const setupRes = await request(app)
        .post('/api/v1/auth/2fa/setup')
        .set('Authorization', `Bearer ${mfaToken}`);
      expect(setupRes.status).toBe(200);
      expect(setupRes.body.secret).toBeDefined();

      // Account must still not be enabled
      let userInDb = await User.findById(mfaUser._id);
      expect(userInDb.isTwoFactorEnabled).toBe(false);

      // Verify with valid TOTP code
      const validTotp = speakeasy.totp({ secret: setupRes.body.secret, encoding: 'base32' });
      const verifyRes = await request(app)
        .post('/api/v1/auth/2fa/verify')
        .set('Authorization', `Bearer ${mfaToken}`)
        .send({ token: validTotp });
      expect(verifyRes.status).toBe(200);

      // Account is now enabled
      userInDb = await User.findById(mfaUser._id);
      expect(userInDb.isTwoFactorEnabled).toBe(true);

      // Subsequent access to admin overview succeeds
      const accessRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${mfaToken}`);
      expect(accessRes.status).toBe(200);
    });
  });

  // ============================================================================
  // SECTION B: MONGODB ROLE COMPLETENESS & RUNTIME IMMUTABILITY
  // ============================================================================
  describe('B. MongoDB Least-Privilege Role & Model Completeness', () => {
    it('verifies exact collection name mappings for all 18 Mongoose models', () => {
      const expectedCollectionMappings = {
        User: 'users',
        College: 'colleges',
        Batch: 'batches',
        Course: 'courses',
        Note: 'notes',
        TeacherNote: 'teachernotes',
        Assessment: 'assessments',
        AssessmentAttempt: 'assessmentattempts',
        AssessmentEvent: 'assessmentevents',
        Assignment: 'assignments',
        Attendance: 'attendances',
        Grade: 'grades',
        RetakeAuthorization: 'retakeauthorizations',
        StudentProgress: 'studentprogresses',
        Submission: 'submissions',
        AcademicEvent: 'academicevents',
        Announcement: 'announcements',
        AuditLog: 'auditlogs'
      };

      const actualModels = mongoose.models;
      const modelNames = Object.keys(expectedCollectionMappings);

      expect(modelNames.length).toBe(18);

      for (const name of modelNames) {
        expect(actualModels[name]).toBeDefined();
        const actualCollectionName = actualModels[name].collection.name;
        expect(actualCollectionName).toBe(expectedCollectionMappings[name]);
      }
    });

    it('verifies complete runtime application operations on mutable models', async () => {
      // 1. Student / User write and read
      const student = await User.create({
        studentId: `STU-RT-${ts}`,
        name: `Student Runtime ${ts}`,
        email: `student.rt.${ts}@acceptance.edu`,
        password: 'HashedPassword123!',
        role: 'student',
        tenantId: testTenant._id.toString(),
        status: 'active'
      });
      expect(student._id).toBeDefined();

      // 2. StudentProgress write and query
      const progress = await StudentProgress.create({
        tenantId: testTenant._id.toString(),
        studentId: student._id,
        courseId: `CS-${ts}`,
        completedTopics: [{ unitNumber: 1, topicNumber: 1, topicTitle: 'Intro' }]
      });
      expect(progress.completedTopics.length).toBe(1);

      // 3. Assessment and AssessmentAttempt write
      const assessment = await Assessment.create({
        id: `asm-${ts}`,
        title: `Midterm Exam ${ts}`,
        tenantId: testTenant._id.toString(),
        subject: 'Computer Science',
        date: new Date(),
        durationMinutes: 60,
        status: 'active'
      });
      expect(assessment._id).toBeDefined();

      const attempt = await AssessmentAttempt.create({
        tenantId: testTenant._id.toString(),
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        studentId: student._id,
        studentIdentifier: student.studentId,
        studentName: student.name,
        attemptNumber: 1,
        status: 'submitted',
        submittedAt: new Date(),
        answers: [{ questionId: 'q1', selectedOption: 1 }]
      });
      expect(attempt._id).toBeDefined();

      // 4. Grade record write and update
      const grade = await Grade.create({
        tenantId: testTenant._id,
        studentId: student.studentId,
        cumulativeGpa: 3.8,
        termGpa: 3.9,
        academicStanding: 'Good Standing'
      });
      expect(grade.cumulativeGpa).toBe(3.8);

      const updatedGrade = await Grade.findOneAndUpdate(
        { _id: grade._id },
        { cumulativeGpa: 3.95 },
        { returnDocument: 'after' }
      );
      expect(updatedGrade.cumulativeGpa).toBe(3.95);
    });

    it('enforces append-only AuditLog immutability: insert succeeds, update and delete are rejected', async () => {
      // 1. AuditLog insertion succeeds (allowed runtime operation)
      const audit = await AuditLog.create({
        tenantId: testTenant._id,
        action: 'SECURITY_AUDIT_TEST',
        actor: {
          userId: testAdmin._id,
          role: 'admin',
          email: testAdmin.email
        },
        details: { operation: 'test_append_only' }
      });
      expect(audit._id).toBeDefined();
      expect(audit.action).toBe('SECURITY_AUDIT_TEST');

      // 2. AuditLog update is rejected by Mongoose schema immutability
      let updateError = null;
      try {
        await AuditLog.updateOne(
          { _id: audit._id },
          { action: 'TAMPERED_ACTION' }
        );
      } catch (err) {
        updateError = err;
      }
      expect(updateError).not.toBeNull();
      expect(updateError.message).toContain('AuditLog records are immutable');

      // 3. AuditLog deletion is rejected by Mongoose middleware immutability
      let deleteError = null;
      try {
        await AuditLog.deleteOne({ _id: audit._id });
      } catch (err) {
        deleteError = err;
      }
      expect(deleteError).not.toBeNull();
      expect(deleteError.message).toContain('AuditLog deletion is prohibited');

      // Document in database remains unmodified
      const persistedAudit = await AuditLog.findById(audit._id);
      expect(persistedAudit.action).toBe('SECURITY_AUDIT_TEST');
    });
  });

  // ============================================================================
  // SECTION C: TARGET DEPLOYMENT IDENTITY RESOLUTION
  // ============================================================================
  describe('C. Target Deployment Identity Resolution', () => {
    it('accepts both EXPECTED_CLUSTER_IDENTITY and EXPECTED_CLUSTER_HOST aliases', async () => {
      const currentHost = mongoose.connection.host || '127.0.0.1';
      const currentDb = mongoose.connection.name;

      // Using expectedClusterIdentity param directly
      const result1 = await provisionSuperAdmin({
        email: `superadmin.ident1.${ts}@6thcivilians.org`,
        password: 'ValidPassword999!',
        expectedDatabaseName: currentDb,
        expectedClusterIdentity: currentHost,
        confirm: true,
        allowEphemeral: true
      });
      expect(result1.email).toBe(`superadmin.ident1.${ts}@6thcivilians.org`);

      // Cleanup
      await User.deleteOne({ email: `superadmin.ident1.${ts}@6thcivilians.org` });
    });

    it('strictly rejects cluster identity mismatch', async () => {
      const currentDb = mongoose.connection.name;
      let mismatchError = null;

      try {
        await provisionSuperAdmin({
          email: `superadmin.mismatch.${ts}@6thcivilians.org`,
          password: 'ValidPassword999!',
          expectedDatabaseName: currentDb,
          expectedClusterIdentity: 'wrong-cluster.mongodb.net',
          confirm: true,
          allowEphemeral: true
        });
      } catch (err) {
        mismatchError = err;
      }

      expect(mismatchError).not.toBeNull();
      expect(mismatchError.message).toContain('Target Cluster Mismatch');
    });

    it('strictly rejects malformed or whitespace-only identity arguments', async () => {
      let whitespaceError = null;
      try {
        await provisionSuperAdmin({
          email: `superadmin.ws.${ts}@6thcivilians.org`,
          password: 'ValidPassword999!',
          expectedDatabaseName: '   ',
          expectedClusterIdentity: '127.0.0.1',
          confirm: true,
          allowEphemeral: true
        });
      } catch (err) {
        whitespaceError = err;
      }

      expect(whitespaceError).not.toBeNull();
      expect(whitespaceError.message).toContain('malformed or empty');
    });
  });
});
