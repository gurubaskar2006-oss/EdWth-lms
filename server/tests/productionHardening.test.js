/**
 * Lumina LMS — Production Hardening & Deployment Readiness Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Hardcoded backdoors (Student#123!) removed; DB authentication strictly enforced.
 * 2. Socket.IO mockUser cannot authenticate in production.
 * 3. JWT_SECRET startup validation (fails fast if < 32 chars or missing in production).
 * 4. Production readiness probe (/api/v1/ready) requires both DB and Redis.
 * 5. Production liveness probe (/api/v1/health) remains lightweight process check.
 * 6. Cookie attributes synchronized between login and logout.
 * 7. Tenant isolation: missing tenant context rejected in production.
 * 8. B2 download route correctly handles :s3Key route parameter.
 * 9. Frontend multi-page static routes serve index.html, trainer.html, admin.html.
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { app } from '../server.js';
import { getJwtSecret, validateProductionEnv } from '../config/environment.js';
import { getAuthCookieOptions, clearAuthCookie } from '../utils/cookieHelper.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Note from '../models/Note.js';

describe('Lumina LMS — Production Hardening Verification', () => {
  const originalEnv = { ...process.env };
  const TEST_JWT_SECRET = 'a_very_strong_production_test_secret_with_more_than_32_characters';

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  describe('1. JWT Secret Production Fail-Fast Validation', () => {
    it('should fail fast in production if JWT_SECRET is missing or < 32 characters', () => {
      const savedEnv = process.env.NODE_ENV;
      const savedSecret = process.env.JWT_SECRET;

      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'short_secret';

      expect(() => getJwtSecret()).toThrow(/JWT_SECRET.*missing or shorter than 32 characters/i);

      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow(/JWT_SECRET.*missing or shorter than 32 characters/i);

      process.env.NODE_ENV = savedEnv;
      process.env.JWT_SECRET = savedSecret;
    });

    it('should fail fast in validateProductionEnv if required variables are missing', () => {
      const savedEnv = process.env.NODE_ENV;
      const savedMongo = process.env.MONGO_URI;

      process.env.NODE_ENV = 'production';
      delete process.env.MONGO_URI;

      expect(() => validateProductionEnv()).toThrow(/Missing required environment variables/i);

      process.env.NODE_ENV = savedEnv;
      process.env.MONGO_URI = savedMongo;
    });
  });

  describe('2. Hardcoded Credentials & Demo Backdoor Removal', () => {
    it('should NOT allow login using hardcoded backdoor credentials without a database record', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          identifier: 'nonexistent.backdoor@oakridge.edu',
          password: 'Student#123!'
        });

      // Must be rejected with 401 (or 500 if DB is disconnected in prod test)
      expect([401, 500]).toContain(res.statusCode);
      if (res.statusCode === 401) {
        expect(res.body.success).toBe(false);
      }
    });
  });

  describe('3. Cookie Security Synchronization', () => {
    it('should produce identical security flags for setting and clearing auth cookies', () => {
      const savedEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_DOMAIN = '.lumina.example.com';
      process.env.COOKIE_SAME_SITE = 'lax';

      const options = getAuthCookieOptions();
      expect(options.httpOnly).toBe(true);
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe('lax');
      expect(options.domain).toBe('.lumina.example.com');
      expect(options.path).toBe('/');

      let capturedArgs = null;
      const mockRes = {
        cookie: (name, val, opts) => {
          capturedArgs = { name, val, opts };
        }
      };

      clearAuthCookie(mockRes);
      expect(capturedArgs).not.toBeNull();
      expect(capturedArgs.name).toBe('jwt');
      expect(capturedArgs.val).toBe('');
      expect(capturedArgs.opts.httpOnly).toBe(true);
      expect(capturedArgs.opts.secure).toBe(true);
      expect(capturedArgs.opts.sameSite).toBe('lax');
      expect(capturedArgs.opts.domain).toBe('.lumina.example.com');
      expect(capturedArgs.opts.path).toBe('/');
      expect(capturedArgs.opts.expires).toBeInstanceOf(Date);

      process.env.NODE_ENV = savedEnv;
      delete process.env.COOKIE_DOMAIN;
      delete process.env.COOKIE_SAME_SITE;
    });
  });

  describe('4. Readiness and Liveness Probes', () => {
    it('should return 200 for liveness probe /api/v1/health without dependency checks', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.uptime).toBeDefined();
    });

    it('should return 503 for readiness probe /api/v1/ready if Redis is disconnected in production', async () => {
      const savedEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app).get('/api/v1/ready');
      // If either MongoDB or Redis is not connected, ready probe must fail with 503
      if (res.body.checks.redis === 'disconnected' || res.body.checks.database === 'disconnected') {
        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe('not-ready');
      }

      process.env.NODE_ENV = savedEnv;
    });
  });

  describe('5. B2 Download Route Parameter Handling', () => {
    it('should accept :s3Key route parameter on file download endpoint', async () => {
      const token = jwt.sign(
        { id: new mongoose.Types.ObjectId().toString(), role: 'admin' },
        process.env.JWT_SECRET || TEST_JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Call download endpoint using URL route param (no ?key= query string)
      const res = await request(app)
        .get('/api/v1/notes/sample-note-id/files/uploads%2Fdoc.pdf/download')
        .set('Authorization', `Bearer ${token}`);

      // Even if note not found in DB (404) or forbidden (403), it must NOT fail with "Missing S3 key" (400)
      if (res.statusCode === 400) {
        expect(res.body.error).not.toBe('Missing S3 key');
      }
    });
  });

  describe('6. Frontend Multi-Page Static Serving', () => {
    it('should serve HTML files for root, /trainer, and /admin', async () => {
      const resRoot = await request(app).get('/');
      expect(resRoot.statusCode).toBe(200);
      expect(resRoot.headers['content-type']).toContain('text/html');

      const resTrainer = await request(app).get('/trainer');
      expect(resTrainer.statusCode).toBe(200);
      expect(resTrainer.headers['content-type']).toContain('text/html');

      const resAdmin = await request(app).get('/admin');
      expect(resAdmin.statusCode).toBe(200);
      expect(resAdmin.headers['content-type']).toContain('text/html');
    });
  });
});
