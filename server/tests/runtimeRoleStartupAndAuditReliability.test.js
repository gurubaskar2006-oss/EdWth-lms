/**
 * Lumina LMS — Runtime Role Startup Compatibility & Critical Audit Reliability Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * Task 1:
 *   1. getProductionConnectionOptions() returns { autoIndex: false, autoCreate: false }.
 *   2. Authenticated MongoDB runtime user with canonical role boots with autoIndex: false and executes CRUD.
 *   3. Runtime user has zero index-creation privilege (code 13 Unauthorized on createIndex).
 * Task 2:
 *   4. Super-admin event with tenantId: null persists a company-wide audit record (isPlatform: true, tenantId: null).
 *   5. Tenant-scoped audit events persist with valid tenantId and isPlatform: false.
 *   6. Password rotation failure: audit failure aborts changePassword, rolls back password, and preserves mustChangePassword.
 *   7. 2FA activation failure: audit failure aborts verify2FA, rolls back isTwoFactorEnabled and mfaSetupRequired.
 *   8. Trainer creation failure: audit failure aborts trainer creation and executes rollback deletion.
 *   9. Rollback failure surfaces CRITICAL UNRESOLVED STATE without leaking secrets or credentials.
 */

import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { getProductionConnectionOptions } from '../database/mongoose.js';
import {
  LUMINA_APP_ROLE_NAME,
  MUTABLE_COLLECTIONS,
  getLuminaAppRoleDefinition
} from '../config/databaseRoles.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';
import College from '../models/College.js';
import {
  writeAuditLog,
  createCriticalAuditLog,
  createAuditLog
} from '../utils/auditLogger.js';
import { changePassword, verify2FA } from '../controllers/authController.js';
import adminRouter from '../routes/adminRoutes.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Runtime Role Startup Compatibility & Audit Reliability', () => {
  let mongod;
  let adminClient;
  let appConn;
  const dbName = 'lumina_runtime_remediation_test';

  beforeAll(async () => {
    // 1. Launch isolated in-memory MongoDB instance with authentication enabled natively
    mongod = await MongoMemoryServer.create({
      auth: {
        enable: true,
        customRootName: 'clusterRootAdmin',
        customRootPwd: 'ClusterRootPassword123!'
      }
    });
    const baseUri = mongod.getUri();

    // 2. Connect with cluster admin credentials
    const authedAdminUri = baseUri.replace('mongodb://', 'mongodb://clusterRootAdmin:ClusterRootPassword123!@') + '?authSource=admin';
    adminClient = new MongoClient(authedAdminUri);
    await adminClient.connect();
    const adminTargetDb = adminClient.db(dbName);

    // 3. Create canonical least-privilege role on target database
    const roleDef = getLuminaAppRoleDefinition(dbName);
    await adminTargetDb.command({
      createRole: roleDef.role,
      privileges: roleDef.privileges,
      roles: roleDef.roles
    });

    // 4. Create runtime service user with luminaAppServiceRole
    await adminTargetDb.command({
      createUser: 'luminaRuntimeUser',
      pwd: 'RuntimeUserSecret123!',
      roles: [{ role: LUMINA_APP_ROLE_NAME, db: dbName }]
    });

    // 5. Connect Mongoose using canonical production connection options
    const authedAppUri = baseUri.replace('mongodb://', 'mongodb://luminaRuntimeUser:RuntimeUserSecret123!@') + `${dbName}?authSource=${dbName}`;
    const prodOpts = getProductionConnectionOptions();
    appConn = await mongoose.createConnection(authedAppUri, prodOpts).asPromise();

    // Ensure models are registered on this connection or default connection
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(authedAppUri, prodOpts);
    }
  }, 60000);

  afterAll(async () => {
    if (appConn) await appConn.close();
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
    if (adminClient) await adminClient.close();
    if (mongod) await mongod.stop();
  });

  // ─── TASK 1: RUNTIME STARTUP & LEAST-PRIVILEGE COMPATIBILITY ───────────────

  describe('Task 1: Runtime MongoDB Startup Compatibility', () => {
    it('1.1. getProductionConnectionOptions() strictly enforces autoIndex: false and autoCreate: false', () => {
      const opts = getProductionConnectionOptions();
      expect(opts.autoIndex).toBe(false);
      expect(opts.autoCreate).toBe(false);
      expect(opts.maxPoolSize).toBe(50);
      expect(opts.minPoolSize).toBe(10);
      expect(opts.serverSelectionTimeoutMS).toBeGreaterThanOrEqual(1000);
      expect(opts.socketTimeoutMS).toBe(45000);
    });

    it('1.2. boots and executes CRUD under restricted runtime user without index-creation privileges', async () => {
      const db = appConn.db;

      // Insert and find in a mutable collection
      const insertResult = await db.collection('users').insertOne({
        name: 'Runtime Test User',
        email: 'runtime.startup.test@lumina.internal',
        role: 'trainer'
      });
      expect(insertResult.acknowledged).toBe(true);

      const found = await db.collection('users').findOne({ _id: insertResult.insertedId });
      expect(found).not.toBeNull();
      expect(found.email).toBe('runtime.startup.test@lumina.internal');

      // Update
      const updateResult = await db.collection('users').updateOne(
        { _id: insertResult.insertedId },
        { $set: { status: 'verified' } }
      );
      expect(updateResult.modifiedCount).toBe(1);

      // Clean up
      await db.collection('users').deleteOne({ _id: insertResult.insertedId });
    });

    it('1.3. confirms runtime user is strictly rejected when attempting index creation (code 13 Unauthorized)', async () => {
      const db = appConn.db;
      let indexErr = null;

      try {
        await db.collection('users').createIndex({ runtimeTestField: 1 });
      } catch (err) {
        indexErr = err;
      }

      expect(indexErr).not.toBeNull();
      expect(indexErr.code).toBe(13);
      expect(indexErr.message).toMatch(/not authorized on.*to execute command.*createIndexes/i);
    });
  });

  // ─── TASK 2: CRITICAL AUDIT LOGGING RELIABILITY & FAIL-CLOSED ROLLBACK ──────

  describe('Task 2: Critical Audit Logging Reliability', () => {
    it('2.1. persists company-wide audit records when tenantId is null (superadmin event)', async () => {
      const result = await createCriticalAuditLog({
        tenantId: null,
        actor: {
          userId: new mongoose.Types.ObjectId(),
          role: 'superadmin',
          email: 'superadmin@6thcivilians.org'
        },
        action: 'PLATFORM_GOVERNANCE_AUDIT_TEST',
        details: { scope: 'platform_wide', testRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.logId).toBeDefined();

      const doc = await AuditLog.findById(result.logId).lean();
      expect(doc).not.toBeNull();
      expect(doc.tenantId).toBeNull();
      expect(doc.isPlatform).toBe(true);
      expect(doc.action).toBe('PLATFORM_GOVERNANCE_AUDIT_TEST');
      expect(doc.actor.role).toBe('superadmin');
    });

    it('2.2. persists tenant-scoped audit records with valid tenantId and isPlatform: false', async () => {
      const tenantId = new mongoose.Types.ObjectId();
      const result = await createCriticalAuditLog({
        tenantId,
        actor: {
          userId: new mongoose.Types.ObjectId(),
          role: 'admin',
          email: 'admin@college.edu'
        },
        action: 'TENANT_ADMIN_AUDIT_TEST',
        details: { collegeAction: true }
      });

      expect(result.success).toBe(true);
      const doc = await AuditLog.findById(result.logId).lean();
      expect(doc).not.toBeNull();
      expect(doc.tenantId.toString()).toBe(tenantId.toString());
      expect(doc.isPlatform).toBe(false);
    });

    it('2.3. changePassword aborts, rolls back password, and preserves mustChangePassword on audit failure', async () => {
      const initialPasswordPlain = 'InitialSecurePwd123!';
      const initialHashed = await bcrypt.hash(initialPasswordPlain, 12);

      const testUser = await User.create({
        studentId: `STU-PWD-${Date.now()}`,
        name: 'Password Rotation Rollback User',
        email: `pwd.rollback.${Date.now()}@test.edu`,
        password: initialHashed,
        role: 'admin',
        tenantId: new mongoose.Types.ObjectId(),
        mustChangePassword: true
      });

      // Mock AuditLog.create to throw on next invocation
      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValueOnce(new Error('Simulated Audit Database Network Partition'));

      const req = {
        user: { _id: testUser._id },
        body: {
          currentPassword: initialPasswordPlain,
          newPassword: 'NewReplacementPassword123!'
        }
      };

      let statusCode = 200;
      let responseBody = {};
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { responseBody = data; return data; }
          };
        }
      };

      try {
        await changePassword(req, res);
      } finally {
        AuditLog.create = originalCreate;
      }

      // Must fail closed with 500
      expect(statusCode).toBe(500);
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toContain('Security audit logging failed');

      // Verify state was rolled back
      const refreshedUser = await User.findById(testUser._id);
      expect(refreshedUser.mustChangePassword).toBe(true);
      const isOriginalPasswordStillValid = await bcrypt.compare(initialPasswordPlain, refreshedUser.password);
      expect(isOriginalPasswordStillValid).toBe(true);
    });

    it('2.4. verify2FA (activation) aborts and rolls back isTwoFactorEnabled on audit failure', async () => {
      const testUser = await User.create({
        studentId: `STU-MFA-${Date.now()}`,
        name: '2FA Activation Rollback User',
        email: `mfa.rollback.${Date.now()}@test.edu`,
        password: 'HashedPassword123!',
        role: 'admin',
        tenantId: new mongoose.Types.ObjectId(),
        isTwoFactorEnabled: false,
        mfaSetupRequired: true,
        twoFactorSecret: 'MOCKSECRETBASE32'
      });

      // Generate a mock auth token with preAuth
      const preAuthToken = jwt.sign(
        { id: testUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      // Mock verifyTotpToken to return true
      const authModule = await import('../controllers/authController.js');
      
      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValueOnce(new Error('Simulated Audit Write Disk Full Error'));

      const req = {
        headers: { authorization: `Bearer ${preAuthToken}` },
        body: { token: '123456' } // valid format
      };

      let statusCode = 200;
      let responseBody = {};
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { responseBody = data; return data; }
          };
        }
      };

      // Since verify2FA validates TOTP using speakeasy, mock speakeasy.totp.verify
      const speakeasy = (await import('speakeasy')).default;
      const originalVerify = speakeasy.totp.verify;
      speakeasy.totp.verify = jest.fn().mockReturnValue(true);

      try {
        await verify2FA(req, res);
      } finally {
        speakeasy.totp.verify = originalVerify;
        AuditLog.create = originalCreate;
      }

      expect(statusCode).toBe(500);
      expect(responseBody.success).toBe(false);
      expect(responseBody.message).toContain('Security audit logging failed');

      // Verify state rollback
      const refreshedUser = await User.findById(testUser._id);
      expect(refreshedUser.isTwoFactorEnabled).toBe(false);
      expect(refreshedUser.mfaSetupRequired).toBe(true);
    });

    it('2.5. admin trainer creation aborts and rolls back User record on audit log failure', async () => {
      const college = await College.create({
        name: 'Trainer Rollback College',
        code: `TRC-${Date.now()}`,
        slug: `trc-${Date.now()}`,
        institutionType: 'college'
      });

      const adminUser = await User.create({
        studentId: `ADM-${Date.now()}`,
        name: 'College Admin',
        email: `admin.${Date.now()}@college.edu`,
        password: 'AdminPassword123!',
        role: 'admin',
        tenantId: college._id
      });

      const adminToken = jwt.sign(
        { id: adminUser._id, role: 'admin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const app = express();
      app.use(express.json());
      app.use('/api/v1/admin', adminRouter);

      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValueOnce(new Error('Simulated Audit DB Timeout'));

      const newTrainerEmail = `trainer.rollback.${Date.now()}@college.edu`;

      let res;
      try {
        res = await request(app)
          .post('/api/v1/admin/trainers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            studentId: `TRN-${Date.now()}`,
            name: 'Rollback Trainer Candidate',
            email: newTrainerEmail,
            password: 'TrainerPassword123!'
          });
      } finally {
        AuditLog.create = originalCreate;
      }

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Security audit logging failed');

      // Verify trainer was removed via rollback
      const persistedTrainer = await User.findOne({ email: newTrainerEmail });
      expect(persistedTrainer).toBeNull();
    });

    it('2.6. superadmin with tenantId: null persists company-wide audit log on 2FA activation', async () => {
      const superUser = await User.create({
        studentId: `6CC-SA-${Date.now()}`,
        name: 'SuperAdmin 2FA Test',
        email: `superadmin.2fa.${Date.now()}@6thcivilians.org`,
        password: 'HashedPassword123!',
        role: 'superadmin',
        tenantId: null, // Legitimate platform-wide governance
        isTwoFactorEnabled: false,
        mfaSetupRequired: true,
        twoFactorSecret: 'MOCKSUPERSECRETBASE32'
      });

      const preAuthToken = jwt.sign(
        { id: superUser._id, preAuth: true },
        getJwtSecret(),
        { expiresIn: '5m' }
      );

      const speakeasy = (await import('speakeasy')).default;
      const originalVerify = speakeasy.totp.verify;
      speakeasy.totp.verify = jest.fn().mockReturnValue(true);

      const req = {
        headers: { authorization: `Bearer ${preAuthToken}` },
        body: { token: '654321' }
      };

      let statusCode = 200;
      let responseBody = {};
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { responseBody = data; return data; }
          };
        }
      };

      try {
        await verify2FA(req, res);
      } finally {
        speakeasy.totp.verify = originalVerify;
      }

      expect(statusCode).toBe(200);
      expect(responseBody.success).toBe(true);

      // Verify that a persistent company-wide audit log was created (NOT skipped!)
      const auditLog = await AuditLog.findOne({
        'actor.userId': superUser._id,
        action: 'AUTH_2FA_ENABLED'
      }).lean();

      expect(auditLog).not.toBeNull();
      expect(auditLog.tenantId).toBeNull();
      expect(auditLog.isPlatform).toBe(true);
      expect(auditLog.actor.role).toBe('superadmin');
    });

    it('2.7. logs CRITICAL UNRESOLVED STATE without leaking secrets when rollback save also fails', async () => {
      const initialHashed = await bcrypt.hash('SecretInitialPwd123!', 12);
      const testUser = await User.create({
        studentId: `STU-UNRES-${Date.now()}`,
        name: 'Unresolved State User',
        email: `unres.${Date.now()}@test.edu`,
        password: initialHashed,
        role: 'admin',
        tenantId: new mongoose.Types.ObjectId(),
        mustChangePassword: true
      });

      // Capture console.error output
      const errorLogs = [];
      const originalConsoleError = console.error;
      console.error = (...args) => {
        errorLogs.push(args.join(' '));
        originalConsoleError(...args);
      };

      // Mock AuditLog.create to throw
      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValueOnce(new Error('Audit DB Down'));

      // Mock user.save to succeed on first call (password change) but throw on rollback call
      let saveCount = 0;
      const originalSave = User.prototype.save;
      User.prototype.save = function(...args) {
        saveCount++;
        if (saveCount === 2) {
          // Rollback save failure
          return Promise.reject(new Error('Rollback Save Failed Connection Timeout'));
        }
        return originalSave.apply(this, args);
      };

      const req = {
        user: { _id: testUser._id },
        body: {
          currentPassword: 'SecretInitialPwd123!',
          newPassword: 'BrandNewSuperSecret456!'
        }
      };

      let statusCode = 200;
      let responseBody = {};
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { responseBody = data; return data; }
          };
        }
      };

      try {
        await changePassword(req, res);
      } finally {
        console.error = originalConsoleError;
        AuditLog.create = originalCreate;
        User.prototype.save = originalSave;
      }

      expect(statusCode).toBe(500);
      expect(responseBody.success).toBe(false);

      // Verify that the critical unresolved state was logged
      const unresolvedLog = errorLogs.find(l => l.includes('CRITICAL UNRESOLVED STATE'));
      expect(unresolvedLog).toBeDefined();
      expect(unresolvedLog).toContain(testUser._id.toString());

      // Ensure NO plaintext passwords or hashes were leaked in the log
      expect(unresolvedLog).not.toContain('SecretInitialPwd123!');
      expect(unresolvedLog).not.toContain('BrandNewSuperSecret456!');
      expect(unresolvedLog).not.toContain(initialHashed);
    });

    it('2.8. admin student password reset aborts and rolls back password on audit failure', async () => {
      const college = await College.create({
        name: 'Student Reset Rollback College',
        code: `SRRC-${Date.now()}`,
        slug: `srrc-${Date.now()}`,
        institutionType: 'college'
      });

      const initialStudentPasswordPlain = 'InitialStudentPwd123!';
      const initialStudentHashed = await bcrypt.hash(initialStudentPasswordPlain, 12);

      const student = await User.create({
        studentId: `STU-RST-${Date.now()}`,
        name: 'Reset Candidate Student',
        email: `student.reset.${Date.now()}@college.edu`,
        password: initialStudentHashed,
        role: 'student',
        tenantId: college._id,
        mustChangePassword: false
      });

      const adminUser = await User.create({
        studentId: `ADM-RST-${Date.now()}`,
        name: 'Reset Admin',
        email: `admin.reset.${Date.now()}@college.edu`,
        password: 'AdminPassword123!',
        role: 'admin',
        tenantId: college._id
      });

      const adminToken = jwt.sign(
        { id: adminUser._id, role: 'admin' },
        getJwtSecret(),
        { expiresIn: '1h' }
      );

      const app = express();
      app.use(express.json());
      app.use('/api/v1/admin', adminRouter);

      const originalCreate = AuditLog.create;
      AuditLog.create = jest.fn().mockRejectedValueOnce(new Error('Audit DB Connection Drop'));

      let res;
      try {
        res = await request(app)
          .post(`/api/v1/admin/students/${student._id}/reset-password`)
          .set('Authorization', `Bearer ${adminToken}`);
      } finally {
        AuditLog.create = originalCreate;
      }

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Security audit logging failed');

      // Verify that student password was restored to the original hashed password
      const refreshedStudent = await User.findById(student._id);
      expect(refreshedStudent.mustChangePassword).toBe(false);
      const isInitialPasswordValid = await bcrypt.compare(initialStudentPasswordPlain, refreshedStudent.password);
      expect(isInitialPasswordValid).toBe(true);
    });
  });
});
