/**
 * Lumina LMS — Server-Enforced Session Lifecycle Test Suite
 * 6th Civilians Corporation
 */

import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import User from '../models/User.js';
import College from '../models/College.js';
import Session from '../models/Session.js';
import SecurityPolicy from '../models/SecurityPolicy.js';
import AuditLog from '../models/AuditLog.js';
import { getJwtSecret } from '../config/environment.js';

describe('Lumina LMS — Server-Enforced Session Lifecycle & Concurrency', () => {
  const runId = Date.now();
  let jwtSecret;
  let testTenant;
  let testUser1;
  let testUser2;
  let originalSessionPolicy;

  const createdUserIds = [];

  beforeAll(async () => {
    let retries = 0;
    while (mongoose.connection.readyState !== 1 && retries < 60) {
      await new Promise((r) => setTimeout(r, 500));
      retries++;
    }

    jwtSecret = getJwtSecret();

    // Preserve original SecurityPolicy
    const existing = await SecurityPolicy.findOne({ key: 'global_security_policy' }).lean();
    if (existing) {
      originalSessionPolicy = existing.sessionPolicy;
    }

    // Configure test session policy: 60 min session timeout, 30 min idle, max 3 concurrent sessions
    await SecurityPolicy.findOneAndUpdate(
      { key: 'global_security_policy' },
      {
        $set: {
          'sessionPolicy.sessionTimeoutMinutes': 60,
          'sessionPolicy.idleTimeoutMinutes': 30,
          'sessionPolicy.maxConcurrentSessions': 3
        }
      },
      { upsert: true, new: true }
    );

    // Create test college tenant
    testTenant = await College.create({
      name: `Session Test Academy ${runId}`,
      code: `STA${String(runId).slice(-4)}`,
      slug: `sta-${runId}`,
      institutionType: 'school',
      status: 'active'
    });

    // Create Test User 1
    const passwordHash1 = await bcrypt.hash('SessionPass1#2026', 10);
    testUser1 = await User.create({
      name: `Session User 1 ${runId}`,
      email: `session-user1-${runId}@edwthacademy.com`,
      password: passwordHash1,
      role: 'trainer',
      tenantId: testTenant._id,
      studentId: `SES-U1-${runId}`
    });
    createdUserIds.push(testUser1._id);

    // Create Test User 2 (for user-isolation verification)
    const passwordHash2 = await bcrypt.hash('SessionPass2#2026', 10);
    testUser2 = await User.create({
      name: `Session User 2 ${runId}`,
      email: `session-user2-${runId}@edwthacademy.com`,
      password: passwordHash2,
      role: 'trainer',
      tenantId: testTenant._id,
      studentId: `SES-U2-${runId}`
    });
    createdUserIds.push(testUser2._id);
  });

  afterAll(async () => {
    // Restore original SecurityPolicy
    if (originalSessionPolicy) {
      await SecurityPolicy.updateOne(
        { key: 'global_security_policy' },
        { $set: { sessionPolicy: originalSessionPolicy } }
      );
    }

    // Clean up sessions and users
    if (createdUserIds.length > 0) {
      await Session.deleteMany({ userId: { $in: createdUserIds } });
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (testTenant?._id) {
      await College.deleteOne({ _id: testTenant._id });
    }
  });

  describe('1. Session Creation and Policy Alignment on Login', () => {
    it('creates active Session record in DB with configured timeout on successful login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser1.email,
          password: 'SessionPass1#2026'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();

      const decoded = jwt.verify(res.body.token, jwtSecret);
      expect(decoded.sessionId).toBeDefined();
      expect(decoded.id).toBe(testUser1._id.toString());

      // Verify Session document in MongoDB
      const sessionDoc = await Session.findOne({ sessionId: decoded.sessionId });
      expect(sessionDoc).not.toBeNull();
      expect(sessionDoc.userId.toString()).toBe(testUser1._id.toString());
      expect(sessionDoc.isRevoked).toBe(false);
      expect(sessionDoc.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify protected route access succeeds
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${res.body.token}`);

      expect(profileRes.status).toBe(200);
      expect(profileRes.body.user._id).toBe(testUser1._id.toString());
    });
  });

  describe('2. Server-Enforced Immediate Logout Revocation', () => {
    it('revokes session on server upon logout and rejects subsequent requests (401)', async () => {
      // 1. Log in
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser1.email,
          password: 'SessionPass1#2026'
        });
      const token = loginRes.body.token;
      const decoded = jwt.verify(token, jwtSecret);

      // 2. Log out
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Verify Session record marked revoked in MongoDB
      const sessionDoc = await Session.findOne({ sessionId: decoded.sessionId });
      expect(sessionDoc).not.toBeNull();
      expect(sessionDoc.isRevoked).toBe(true);
      expect(sessionDoc.revocationReason).toBe('logout');

      // 3. Attempt protected access with the same token -> MUST BE REJECTED 401
      const profileRes = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(profileRes.status).toBe(401);
      expect(profileRes.body.code).toBe('SESSION_REVOKED');
    });
  });

  describe('3. Deterministic FIFO Concurrent Session Limit & User Isolation', () => {
    it('deterministically evicts oldest session when limit (3) is exceeded, leaving other sessions active', async () => {
      // Clean prior sessions for User 1
      await Session.deleteMany({ userId: testUser1._id });

      // Session 1
      const s1Res = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const token1 = s1Res.body.token;
      const id1 = jwt.verify(token1, jwtSecret).sessionId;
      await new Promise((r) => setTimeout(r, 50)); // stagger createdAt

      // Session 2
      const s2Res = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const token2 = s2Res.body.token;
      const id2 = jwt.verify(token2, jwtSecret).sessionId;
      await new Promise((r) => setTimeout(r, 50));

      // Session 3
      const s3Res = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const token3 = s3Res.body.token;
      const id3 = jwt.verify(token3, jwtSecret).sessionId;
      await new Promise((r) => setTimeout(r, 50));

      // Verify all 3 sessions active
      expect((await Session.find({ userId: testUser1._id, isRevoked: false })).length).toBe(3);

      // Session 4 -> MUST trigger FIFO eviction of Session 1
      const s4Res = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const token4 = s4Res.body.token;
      const id4 = jwt.verify(token4, jwtSecret).sessionId;

      // Check Session 1 in DB
      const s1Doc = await Session.findOne({ sessionId: id1 });
      expect(s1Doc.isRevoked).toBe(true);
      expect(s1Doc.revocationReason).toBe('concurrent_limit_exceeded');

      // Request with Token 1 -> 401 SESSION_REVOKED
      const req1 = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token1}`);
      expect(req1.status).toBe(401);
      expect(req1.body.code).toBe('SESSION_REVOKED');

      // Requests with Token 2, Token 3, Token 4 -> 200 OK
      const req2 = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token2}`);
      expect(req2.status).toBe(200);

      const req3 = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token3}`);
      expect(req3.status).toBe(200);

      const req4 = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${token4}`);
      expect(req4.status).toBe(200);

      // Verify audit log recorded eviction
      const audit = await AuditLog.findOne({
        action: 'SESSION_CONCURRENT_LIMIT_EVICTED',
        'details.evictedSessionId': id1
      });
      expect(audit).not.toBeNull();
    });

    it('strictly isolates concurrent session limits to the specific user (no cross-user eviction)', async () => {
      // User 2 logs in
      const u2Login = await request(app).post('/api/v1/auth/login').send({ email: testUser2.email, password: 'SessionPass2#2026' });
      const u2Token = u2Login.body.token;

      // Verify User 2 session is active
      const u2Profile = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${u2Token}`);
      expect(u2Profile.status).toBe(200);

      // Verify User 1's active sessions remain unchanged
      const u1ActiveSessions = await Session.find({ userId: testUser1._id, isRevoked: false });
      expect(u1ActiveSessions.length).toBe(3);
    });
  });

  describe('4. Password Change Session Invalidation', () => {
    it('revokes all other active sessions for user upon password change', async () => {
      // 1. Establish two sessions for User 1: Session A and Session B
      const sARes = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const tokenA = sARes.body.token;
      const idA = jwt.verify(tokenA, jwtSecret).sessionId;

      const sBRes = await request(app).post('/api/v1/auth/login').send({ email: testUser1.email, password: 'SessionPass1#2026' });
      const tokenB = sBRes.body.token;
      const idB = jwt.verify(tokenB, jwtSecret).sessionId;

      // Both should be valid initially
      expect((await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${tokenA}`)).status).toBe(200);
      expect((await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${tokenB}`)).status).toBe(200);

      // 2. Change password using Token A
      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          currentPassword: 'SessionPass1#2026',
          newPassword: 'BrandNew#Password2026!',
          confirmPassword: 'BrandNew#Password2026!'
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      const newSessionToken = changeRes.body.token;

      // 3. Verify Session B was revoked
      const sBDoc = await Session.findOne({ sessionId: idB });
      expect(sBDoc.isRevoked).toBe(true);
      expect(sBDoc.revocationReason).toBe('password_change');

      // Request with Token B -> 401 SESSION_REVOKED
      const reqB = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${tokenB}`);
      expect(reqB.status).toBe(401);
      expect(reqB.body.code).toBe('SESSION_REVOKED');

      // Request with newSessionToken -> 200 OK
      const reqNew = await request(app).get('/api/v1/auth/profile').set('Authorization', `Bearer ${newSessionToken}`);
      expect(reqNew.status).toBe(200);
    });
  });

  describe('5. Absolute and Idle Timeout Enforcement', () => {
    it('rejects expired session when absolute lifetime is exceeded (401 SESSION_EXPIRED)', async () => {
      // Create an expired session in DB
      const expiredSessionId = 'expired-test-sess-' + Date.now();
      await Session.create({
        sessionId: expiredSessionId,
        userId: testUser1._id,
        role: testUser1.role,
        createdAt: new Date(Date.now() - 3600 * 1000 * 5),
        lastActivityAt: new Date(Date.now() - 3600 * 1000 * 4),
        expiresAt: new Date(Date.now() - 1000 * 60), // expired 1 min ago
        isRevoked: false
      });

      const expiredToken = jwt.sign(
        { id: testUser1._id, sessionId: expiredSessionId },
        jwtSecret,
        { expiresIn: '1h' } // JWT itself still has valid signature
      );

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('SESSION_EXPIRED');
    });

    it('revokes and rejects session when idle inactivity exceeds threshold (401 SESSION_IDLE_TIMEOUT)', async () => {
      // Create session whose last activity was 45 minutes ago (idleTimeoutMinutes is 30)
      const idleSessionId = 'idle-test-sess-' + Date.now();
      await Session.create({
        sessionId: idleSessionId,
        userId: testUser1._id,
        role: testUser1.role,
        createdAt: new Date(Date.now() - 3600 * 1000),
        lastActivityAt: new Date(Date.now() - 45 * 60 * 1000), // inactive for 45 mins
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),     // absolute lifetime still fine
        isRevoked: false
      });

      const idleToken = jwt.sign(
        { id: testUser1._id, sessionId: idleSessionId },
        jwtSecret,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${idleToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('SESSION_IDLE_TIMEOUT');

      // Verify marked revoked in DB
      const sessionDoc = await Session.findOne({ sessionId: idleSessionId });
      expect(sessionDoc.isRevoked).toBe(true);
      expect(sessionDoc.revocationReason).toBe('idle_timeout');
    });
  });
});
