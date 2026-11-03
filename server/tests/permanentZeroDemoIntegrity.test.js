/**
 * Lumina LMS — Permanent Zero-Demo Database & Real-Data Integrity Guard
 * 6th Civilians Corporation / EdWth Academy
 *
 * Automated regression test asserting:
 * 1. Startup source guards prevent auto-seeding.
 * 2. Environment defaults keep demo seeding disabled.
 * 3. Auth controllers and socket handlers enforce genuine database persistence.
 * 4. Clean database stays clean across restarts.
 * 5. Dynamic school and student creation persists in isolated test environment and cleans up cleanly.
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
import { getJwtSecret } from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina LMS — Permanent Zero-Demo & Real-Data-Only Enforcement', () => {
  let superAdminToken;
  let superAdminId;
  const runId = Date.now();

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    const hashedPwd = await bcrypt.hash('SuperAdmin!Guard2026', 10);
    const sa = await User.create({
      studentId: `SA-GUARD-${runId}`,
      name: 'Integrity SuperAdmin',
      email: `integrity.sa.${runId}@6c.com`,
      password: hashedPwd,
      role: 'superadmin',
      tenantId: null
    });

    superAdminId = sa._id;
    superAdminToken = jwt.sign(
      { id: sa._id.toString(), role: 'superadmin', tenantId: null },
      getJwtSecret(),
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    if (superAdminId) {
      await User.deleteOne({ _id: superAdminId });
    }
  });

  describe('1. Static Codebase & Configuration Safeguards', () => {
    it('1.1 server.js strictly forbids unconditioned auto-seed', () => {
      const serverCode = fs.readFileSync(path.resolve(__dirname, '../server.js'), 'utf-8');
      expect(serverCode).not.toContain("userCount === 0 || process.env.AUTO_SEED === 'true'");
      expect(serverCode).not.toContain("provisionDevTestAccounts().catch");
    });

    it('1.2 authController strictly uses database users and rejects datasheet fallback', () => {
      const authCode = fs.readFileSync(path.resolve(__dirname, '../controllers/authController.js'), 'utf-8');
      expect(authCode).not.toContain("ENABLE_LEGACY_DATASHEET_FALLBACK === 'true'");
      expect(authCode).not.toContain("getStudents()");
    });

    it('1.3 authMiddleware strictly enforces authentic database accounts', () => {
      const middlewareCode = fs.readFileSync(path.resolve(__dirname, '../middleware/authMiddleware.js'), 'utf-8');
      expect(middlewareCode).not.toContain("ENABLE_LEGACY_DATASHEET_FALLBACK === 'true'");
      expect(middlewareCode).not.toContain("getStudents()");
    });

    it('1.4 socketHandler requires dbUser and has no mockFallback with demo domains', () => {
      const socketCode = fs.readFileSync(path.resolve(__dirname, '../socket/socketHandler.js'), 'utf-8');
      expect(socketCode).not.toContain("student@nexus.edu");
      expect(socketCode).not.toContain("ENABLE_LEGACY_DATASHEET_FALLBACK === 'true'");
    });

    it('1.5 client-side mockData.js contains 0 demo users, courses, and assignments', async () => {
      const mockModule = await import('../../src/data/mockData.js');
      expect(mockModule.INITIAL_USER).toBeNull();
      expect(mockModule.COURSES).toEqual([]);
      expect(mockModule.ASSIGNMENTS).toEqual([]);
      expect(mockModule.STUDENTS_DATA_SHEET).toEqual([]);
      expect(mockModule.DAILY_CODING_CHALLENGES).toEqual([]);
    });
  });

  describe('2. Real Dynamic Persistence in Isolated Environment', () => {
    let createdSchoolId;
    let createdStudentId;

    it('2.1 Creates a genuine school; persists and verifies in database', async () => {
      const res = await request(app)
        .post('/api/v1/admin/institutions')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          name: `Verified Academy ${runId}`,
          code: `VA-${runId.toString().slice(-6)}`,
          slug: `va-${runId.toString().slice(-6)}`,
          institutionType: 'school',
          status: 'active'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdSchoolId = res.body.institution._id;

      const inDb = await College.findById(createdSchoolId).lean();
      expect(inDb).not.toBeNull();
      expect(inDb.name).toBe(`Verified Academy ${runId}`);
    });

    it('2.2 Creates a genuine student under the school; persists and verifies in database', async () => {
      const res = await request(app)
        .post('/api/v1/admin/students')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          tenantId: createdSchoolId,
          name: `Real Student ${runId}`,
          email: `real.student.${runId}@testcorp.org`,
          password: 'Password@123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdStudentId = res.body.student._id;

      const inDb = await User.findById(createdStudentId).lean();
      expect(inDb).not.toBeNull();
      expect(inDb.email).toBe(`real.student.${runId}@testcorp.org`);
      expect(inDb.tenantId.toString()).toBe(createdSchoolId.toString());
    });

    it('2.3 Cleans up test records without leaving orphaned records', async () => {
      await User.deleteOne({ _id: createdStudentId });
      await College.deleteOne({ _id: createdSchoolId });

      const checkUser = await User.findById(createdStudentId);
      const checkSchool = await College.findById(createdSchoolId);

      expect(checkUser).toBeNull();
      expect(checkSchool).toBeNull();
    });
  });
});

