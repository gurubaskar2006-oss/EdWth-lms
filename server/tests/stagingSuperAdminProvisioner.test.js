/**
 * Lumina LMS — Staging Super-Admin Provisioner Safety Test Suite
 * 6th Civilians Corporation
 *
 * Verifies strict safety constraints:
 * - Rejection of Atlas and remote URIs
 * - Rejection of unapproved email domains (freemail)
 * - Password complexity enforcement (14+ characters, uppercase, lowercase, digit, symbol)
 * - Dry-run mode produces zero database records
 * - Atomic rollback on audit failure (tested against isolated test database)
 * - Active staging database (lumina_staging) remains 100% untouched with 0 users.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

import {
  provisionStagingSuperAdmin,
  validatePasswordComplexity,
  loadStagingEnvironment
} from '../scripts/provisionStagingSuperAdmin.mjs';
import { validateStagingMongoUri } from '../utils/stagingUriValidator.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';

const LOCAL_STAGING_REPL_SET_URI = 'mongodb://127.0.0.1:27018/lumina_staging?replicaSet=rs0';
const ISOLATED_TEST_DB_NAME = 'lumina_staging_test_temp';
const ISOLATED_TEST_URI = `mongodb://127.0.0.1:27018/${ISOLATED_TEST_DB_NAME}?replicaSet=rs0`;

describe('Lumina LMS — Staging Super-Admin Provisioner Safety Audit Suite', () => {
  beforeAll(async () => {
    // Ensure clean state in isolated test database
    const client = new MongoClient(ISOLATED_TEST_URI);
    await client.connect();
    await client.db(ISOLATED_TEST_DB_NAME).dropDatabase().catch(() => {});
    await client.close();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    // Clean up temporary test database
    const client = new MongoClient(ISOLATED_TEST_URI);
    await client.connect();
    await client.db(ISOLATED_TEST_DB_NAME).dropDatabase().catch(() => {});
    await client.close();
  });

  describe('1. Environment & Target Database URI Safety', () => {
    it('accepts exact local staging replica set URI on port 27018', () => {
      const res = validateStagingMongoUri(LOCAL_STAGING_REPL_SET_URI, 27018);
      expect(res.valid).toBe(true);
      expect(res.hosts).toEqual(['127.0.0.1:27018']);
      expect(res.database).toBe('lumina_staging');
    });

    it('rejects MongoDB Atlas SRV URI', () => {
      const atlasUri = 'mongodb+srv://admin:pass@cluster0.mongodb.net/lumina_staging';
      const res = validateStagingMongoUri(atlasUri, 27018);
      expect(res.valid).toBe(false);
      expect(res.reason).toMatch(/Atlas SRV protocol/i);
    });

    it('rejects remote database hosts and default port 27017', () => {
      expect(validateStagingMongoUri('mongodb://192.168.1.100:27018/lumina_staging', 27018).valid).toBe(false);
      expect(validateStagingMongoUri('mongodb://127.0.0.1:27017/lumina_staging', 27018).valid).toBe(false);
      expect(validateStagingMongoUri('mongodb://127.0.0.1:27018,remote.com:27018/lumina_staging', 27018).valid).toBe(false);
    });

    it('loadStagingEnvironment loads exclusively server/.env.staging', () => {
      const env = loadStagingEnvironment();
      expect(env.mongoUri).toMatch(/^mongodb:\/\/127\.0\.0\.1:27018/);
      expect(env.database).toBe('lumina_staging');
    });
  });

  describe('2. Privileged Email Identity Restrictions', () => {
    it('accepts approved corporate email identity (edwthacademyadmin@6c.com)', async () => {
      // Dry-run should accept valid corporate email
      const result = await provisionStagingSuperAdmin({
        email: 'edwthacademyadmin@6c.com',
        name: 'Corporate SuperAdmin',
        password: 'StagingAdmin@2026!Secure',
        dryRun: true,
        customTargetDb: ISOLATED_TEST_DB_NAME,
        mongoUri: ISOLATED_TEST_URI
      });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });

    it('rejects public freemail domains (gmail, yahoo, outlook)', async () => {
      const publicEmails = [
        'attacker@gmail.com',
        'operator@yahoo.com',
        'admin@outlook.com',
        'super@hotmail.com'
      ];

      for (const email of publicEmails) {
        await expect(
          provisionStagingSuperAdmin({
            email,
            password: 'StagingAdmin@2026!Secure',
            dryRun: true,
            customTargetDb: ISOLATED_TEST_DB_NAME,
            mongoUri: ISOLATED_TEST_URI
          })
        ).rejects.toThrow(/Privileged identity policy violation/i);
      }
    });

    it('rejects malformed email formats', async () => {
      await expect(
        provisionStagingSuperAdmin({
          email: 'not-an-email',
          password: 'StagingAdmin@2026!Secure',
          dryRun: true,
          customTargetDb: ISOLATED_TEST_DB_NAME,
          mongoUri: ISOLATED_TEST_URI
        })
      ).rejects.toThrow();
    });
  });

  describe('3. Password Complexity Enforcement', () => {
    it('enforces minimum 14 characters, uppercase, lowercase, digit, and symbol', () => {
      expect(validatePasswordComplexity('Short1!Aa')).toMatch(/at least 14 characters/i);
      expect(validatePasswordComplexity('nouppercase123456789!@#')).toMatch(/uppercase/i);
      expect(validatePasswordComplexity('NOLOWERCASE123456789!@#')).toMatch(/lowercase/i);
      expect(validatePasswordComplexity('NoDigitsHereAtAll!@#$')).toMatch(/digit/i);
      expect(validatePasswordComplexity('NoSpecialSymbols1234567')).toMatch(/special symbol/i);
      expect(validatePasswordComplexity('ValidComplexity@2026!Pass')).toBeNull();
    });

    it('rejects weak passwords in provisionStagingSuperAdmin', async () => {
      await expect(
        provisionStagingSuperAdmin({
          email: 'edwthacademyadmin@6c.com',
          password: 'weakpassword',
          dryRun: true,
          customTargetDb: ISOLATED_TEST_DB_NAME,
          mongoUri: ISOLATED_TEST_URI
        })
      ).rejects.toThrow(/Password policy violation/i);
    });
  });

  describe('4. Dry-Run Safety: Zero Database Records', () => {
    it('dry-run passes all validations but creates ZERO documents in the database', async () => {
      const result = await provisionStagingSuperAdmin({
        email: 'edwthacademyadmin@6c.com',
        name: 'DryRun Test Admin',
        password: 'ValidComplexity@2026!Pass',
        dryRun: true,
        confirm: false,
        customTargetDb: ISOLATED_TEST_DB_NAME,
        mongoUri: ISOLATED_TEST_URI
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);

      // Verify ZERO records created in the database
      const client = new MongoClient(ISOLATED_TEST_URI);
      await client.connect();
      const testDb = client.db(ISOLATED_TEST_DB_NAME);
      const userCount = await testDb.collection('users').countDocuments();
      const auditCount = await testDb.collection('auditlogs').countDocuments();
      await client.close();

      expect(userCount).toBe(0);
      expect(auditCount).toBe(0);
    });
  });

  describe('5. Atomic Rollback on Audit Failure', () => {
    it('deletes newly created user record if audit log insertion fails', async () => {
      // Connect mongoose to test DB
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(ISOLATED_TEST_URI);
      }

      // Spy on AuditLog.create and simulate an unexpected failure
      const auditSpy = jest.spyOn(AuditLog, 'create').mockRejectedValueOnce(
        new Error('Simulated audit database write failure')
      );

      await expect(
        provisionStagingSuperAdmin({
          email: 'edwthacademyadmin@6c.com',
          name: 'Rollback Test Admin',
          password: 'ValidComplexity@2026!Pass',
          dryRun: false,
          confirm: true,
          customTargetDb: ISOLATED_TEST_DB_NAME,
          mongoUri: ISOLATED_TEST_URI
        })
      ).rejects.toThrow(/Audit log creation failed.*rolled back/i);

      // Verify that user was deleted by atomic rollback
      const userAfterRollback = await User.findOne({ email: 'edwthacademyadmin@6c.com' });
      expect(userAfterRollback).toBeNull();

      auditSpy.mockRestore();
    });
  });

  describe('6. Duplicate Email Conflict Detection', () => {
    it('rejects provisioning when an account with the same email already exists', async () => {
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(ISOLATED_TEST_URI);
      }

      // Insert pre-existing user in isolated test DB
      await User.create({
        studentId: 'PRE-EXISTING-001',
        email: 'edwthacademyadmin@6c.com',
        name: 'Existing Admin',
        password: '$2b$12$DummyHashedPasswordForTest000000000000000000000000000000000',
        role: 'superadmin'
      });

      await expect(
        provisionStagingSuperAdmin({
          email: 'edwthacademyadmin@6c.com',
          password: 'ValidComplexity@2026!Pass',
          dryRun: true,
          customTargetDb: ISOLATED_TEST_DB_NAME,
          mongoUri: ISOLATED_TEST_URI
        })
      ).rejects.toThrow(/Account conflict: an account with email "edwthacademyadmin@6c.com" already exists/i);

      // Clean up test DB
      await User.deleteMany({});
    });
  });

  describe('7. Active Staging Database (lumina_staging) Inviolability', () => {
    it('verifies that the active staging database lumina_staging has zero user accounts', async () => {
      const client = new MongoClient(LOCAL_STAGING_REPL_SET_URI);
      await client.connect();
      const stagingDb = client.db('lumina_staging');
      const userCount = await stagingDb.collection('users').countDocuments();
      const auditCount = await stagingDb.collection('auditlogs').countDocuments();
      await client.close();

      expect(userCount).toBe(0);
      expect(auditCount).toBe(0);
    });
  });
});
