/**
 * Lumina LMS — Phase 1 Single-Server Operational Readiness & Regression Test Suite
 * 6th Civilians Corporation
 *
 * Verifies all 10 Mandatory Scenarios under Part 1:
 * 1. Attendance session creation without Redis.
 * 2. Attendance marking without Redis.
 * 3. Duplicate attendance prevention without Redis.
 * 4. Session expiration without Redis.
 * 5. Cross-tenant attendance isolation without Redis.
 * 6. Unauthorized attendance operations (unauthorized stop, stopped session mark, batch mismatch).
 * 7. Readiness probe with MongoDB connected and Redis unavailable (HTTP 200, in-memory-single-node).
 * 8. Readiness probe with MongoDB disconnected (HTTP 503, database: disconnected).
 * 9. Readiness probe with REQUIRE_REDIS=true and Redis unavailable (HTTP 503, redis: disconnected).
 * 10. Existing Redis-enabled behavior intact (Redis override client and fail-closed safety when required).
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../server.js';
import {
  startSession,
  getSession,
  markAttendance,
  stopSession,
  getActiveSessionsForTenant,
  getSessionConfirmedStudents,
  setRedisClientOverride,
  getEffectiveClient,
  AttendanceServiceUnavailableError
} from '../services/attendanceSessionService.js';
import { requireIdempotency } from '../middleware/idempotencyMiddleware.js';

describe('Lumina LMS — Phase 1 Single-Server Operational Verification', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    // Allow any initial async background connection attempt to fully settle
    await new Promise((resolve) => setTimeout(resolve, 1500));
    mongoose.connection.readyState = 1;
  });

  afterAll(() => {
    process.env = { ...originalEnv };
    setRedisClientOverride(null);
  });

  beforeEach(() => {
    delete process.env.REQUIRE_REDIS;
    setRedisClientOverride(null);
    mongoose.connection.readyState = 1;
  });

  // =========================================================================
  // SCENARIO 1: Attendance session creation without Redis
  // =========================================================================
  describe('Scenario 1: Attendance Session Creation without Redis', () => {
    it('should create an active attendance session using in-memory store when Redis is unavailable', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_01';
      const trainerId = 'trainer_01';
      const topic = 'Single Server Architecture & Memory Fallback';

      const session = await startSession({
        tenantId,
        trainerId,
        trainerName: 'Dr. Grace Hopper',
        topic,
        durationSeconds: 120
      });

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^att-/);
      expect(session.status).toBe('active');
      expect(session.tenantId).toBe(tenantId);
      expect(session.trainerId).toBe(trainerId);
      expect(session.topic).toBe(topic);
      expect(session.durationSeconds).toBe(120);
      expect(session.expiresAt).toBeGreaterThan(session.startedAt);

      // Verify retrieval from fallback store
      const retrieved = await getSession(tenantId, session.sessionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.sessionId).toBe(session.sessionId);
      expect(retrieved.status).toBe('active');
    });
  });

  // =========================================================================
  // SCENARIO 2: Attendance marking without Redis
  // =========================================================================
  describe('Scenario 2: Attendance Marking without Redis', () => {
    it('should successfully record student attendance and increment count in-memory', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_02';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_02',
        topic: 'Data Structures',
        durationSeconds: 180
      });

      const markResult = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_john_von_neumann',
        studentName: 'John von Neumann',
        studentEmail: 'john@ias.edu'
      });

      expect(markResult.success).toBe(true);
      expect(markResult.alreadyRecorded).toBe(false);
      expect(markResult.count).toBe(1);
      expect(markResult.latestStudent).toBeDefined();
      expect(markResult.latestStudent.name).toBe('John von Neumann');
      expect(markResult.latestStudent.studentId).toBe('student_john_von_neumann');

      // Verify confirmed student roster
      const roster = await getSessionConfirmedStudents(tenantId, session.sessionId);
      expect(roster.length).toBe(1);
      expect(roster[0].studentId).toBe('student_john_von_neumann');
      expect(roster[0].name).toBe('John von Neumann');
    });
  });

  // =========================================================================
  // SCENARIO 3: Duplicate attendance prevention without Redis
  // =========================================================================
  describe('Scenario 3: Duplicate Attendance Prevention without Redis', () => {
    it('should atomically deduplicate multiple mark requests from the same student', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_03';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_03',
        topic: 'Concurrency Control',
        durationSeconds: 180
      });

      // First mark
      const firstMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_shannon',
        studentName: 'Claude Shannon'
      });
      expect(firstMark.success).toBe(true);
      expect(firstMark.alreadyRecorded).toBe(false);
      expect(firstMark.count).toBe(1);

      // Duplicate mark attempt
      const duplicateMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_shannon',
        studentName: 'Claude Shannon'
      });
      expect(duplicateMark.success).toBe(true);
      expect(duplicateMark.alreadyRecorded).toBe(true);
      expect(duplicateMark.message).toBe('Attendance already recorded!');
      expect(duplicateMark.count).toBe(1); // Count did NOT increment

      // Total roster must still be exactly 1
      const roster = await getSessionConfirmedStudents(tenantId, session.sessionId);
      expect(roster.length).toBe(1);
    });
  });

  // =========================================================================
  // SCENARIO 4: Session expiration without Redis
  // =========================================================================
  describe('Scenario 4: Session Expiration without Redis', () => {
    it('should reject attendance marking once session duration expires', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_04';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_04',
        topic: 'Ephemeral State Testing',
        durationSeconds: 1 // 1-second window
      });

      // Wait 1.1s for session window to elapse
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const lateMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_late_arriver',
        studentName: 'Late Arriver'
      });

      expect(lateMark.success).toBe(false);
      expect(lateMark.code).toBe('SESSION_EXPIRED');
      expect(lateMark.message).toMatch(/closed/i);
    });
  });

  // =========================================================================
  // SCENARIO 5: Cross-tenant attendance isolation without Redis
  // =========================================================================
  describe('Scenario 5: Cross-Tenant Attendance Isolation without Redis', () => {
    it('should strictly reject mark attempts across different tenants', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantA = 'tenant_institution_alpha';
      const tenantB = 'tenant_institution_beta';

      // Trainer in Tenant A creates a session
      const sessionA = await startSession({
        tenantId: tenantA,
        trainerId: 'trainer_alpha',
        topic: 'Tenant Isolated Class',
        durationSeconds: 120
      });

      // Student from Tenant B tries to mark on Tenant A session
      const crossMark = await markAttendance({
        tenantId: tenantB,
        sessionId: sessionA.sessionId,
        studentId: 'student_beta_intruder',
        studentName: 'Intruder Student'
      });

      // Must be rejected - cross-tenant access prohibited
      expect(crossMark.success).toBe(false);
      expect(crossMark.code).toBe('SESSION_NOT_FOUND'); // Tenant key separation prevents finding foreign session

      // Active prompt query from Tenant B must NOT reveal Tenant A session
      const promptsTenantB = await getActiveSessionsForTenant(tenantB);
      expect(promptsTenantB.some((s) => s.sessionId === sessionA.sessionId)).toBe(false);

      // Active prompt query from Tenant A MUST reveal Tenant A session
      const promptsTenantA = await getActiveSessionsForTenant(tenantA);
      expect(promptsTenantA.some((s) => s.sessionId === sessionA.sessionId)).toBe(true);
    });
  });

  // =========================================================================
  // SCENARIO 6: Unauthorized attendance operations without Redis
  // =========================================================================
  describe('Scenario 6: Unauthorized Attendance Operations', () => {
    it('Sub-case 6A: should reject session termination by non-owner, non-admin requester', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_06';
      const trainerId = 'trainer_legitimate_owner';

      const session = await startSession({
        tenantId,
        trainerId,
        topic: 'Authorization Governance',
        durationSeconds: 180
      });

      // Unauthorized trainer tries to close session
      const unauthorizedStop = await stopSession({
        tenantId,
        sessionId: session.sessionId,
        requesterId: 'trainer_imposter',
        requesterRole: 'trainer'
      });

      expect(unauthorizedStop.success).toBe(false);
      expect(unauthorizedStop.code).toBe('UNAUTHORIZED');

      // Student tries to close session
      const studentStop = await stopSession({
        tenantId,
        sessionId: session.sessionId,
        requesterId: 'student_007',
        requesterRole: 'student'
      });

      expect(studentStop.success).toBe(false);
      expect(studentStop.code).toBe('UNAUTHORIZED');
    });

    it('Sub-case 6B: should reject marking attendance on a closed session', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_06';
      const trainerId = 'trainer_owner';

      const session = await startSession({
        tenantId,
        trainerId,
        topic: 'Session Termination State',
        durationSeconds: 180
      });

      // Legitimate trainer closes the session
      const legitimateStop = await stopSession({
        tenantId,
        sessionId: session.sessionId,
        requesterId: trainerId,
        requesterRole: 'trainer'
      });
      expect(legitimateStop.success).toBe(true);

      // Student tries to mark on the closed session
      const markClosed = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_trying_closed',
        studentName: 'Student'
      });

      expect(markClosed.success).toBe(false);
      expect(markClosed.code).toBe('SESSION_CLOSED');
    });

    it('Sub-case 6C: should reject marking when student is in a different batch', async () => {
      process.env.REQUIRE_REDIS = 'false';
      setRedisClientOverride(null);

      const tenantId = 'tenant_single_node_06';
      const session = await startSession({
        tenantId,
        batchId: 'batch_computer_science_2026',
        trainerId: 'trainer_batch',
        topic: 'Batch Scoped Lecture',
        durationSeconds: 180
      });

      // Student from mechanical engineering tries to mark
      const wrongBatchMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_mech_101',
        studentName: 'Mech Student',
        studentBatchId: 'batch_mechanical_2026'
      });

      expect(wrongBatchMark.success).toBe(false);
      expect(wrongBatchMark.code).toBe('BATCH_MISMATCH');
    });
  });

  // =========================================================================
  // SCENARIO 7: Readiness probe with MongoDB connected & Redis unavailable
  // =========================================================================
  describe('Scenario 7: Readiness with MongoDB Connected & Redis Unavailable', () => {
    it('should return HTTP 200 OK and report in-memory-single-node when REQUIRE_REDIS is optional/false', async () => {
      delete process.env.REQUIRE_REDIS; // Default single-server behavior
      mongoose.connection.readyState = 1;

      const res = await request(app).get('/api/v1/ready');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('connected');
      expect(res.body.checks.redis).toBe('in-memory-single-node');
      // Crucial requirement: offline Redis must NEVER be reported as 'connected'
      expect(res.body.checks.redis).not.toBe('connected');
    });

    it('should return HTTP 200 OK when REQUIRE_REDIS=false explicitly', async () => {
      process.env.REQUIRE_REDIS = 'false';
      mongoose.connection.readyState = 1;

      const res = await request(app).get('/api/v1/ready');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('connected');
      expect(res.body.checks.redis).toBe('in-memory-single-node');
    });
  });

  // =========================================================================
  // SCENARIO 8: Readiness probe with MongoDB disconnected
  // =========================================================================
  describe('Scenario 8: Readiness with MongoDB Disconnected', () => {
    it('should return HTTP 503 and report database: disconnected when MongoDB connection is down', async () => {
      process.env.REQUIRE_REDIS = 'false';
      
      const originalState = mongoose.connection.readyState;
      mongoose.connection.readyState = 0; // Simulate DB disconnect

      try {
        const res = await request(app).get('/api/v1/ready');

        expect(res.statusCode).toBe(503);
        expect(res.body.status).toBe('not-ready');
        expect(res.body.checks.database).toBe('disconnected');
      } finally {
        mongoose.connection.readyState = originalState; // Restore connection state
      }
    });
  });

  // =========================================================================
  // SCENARIO 9: Readiness probe with REQUIRE_REDIS=true & Redis unavailable
  // =========================================================================
  describe('Scenario 9: Readiness with REQUIRE_REDIS=true & Redis Unavailable', () => {
    it('should return HTTP 503 and report redis: disconnected when Redis is mandatory but unavailable', async () => {
      process.env.REQUIRE_REDIS = 'true';
      mongoose.connection.readyState = 1;

      const res = await request(app).get('/api/v1/ready');

      expect(res.statusCode).toBe(503);
      expect(res.body.status).toBe('not-ready');
      expect(res.body.checks.database).toBe('connected');
      expect(res.body.checks.redis).toBe('disconnected');
    });
  });

  // =========================================================================
  // SCENARIO 10: Existing Redis-enabled behavior remains intact
  // =========================================================================
  describe('Scenario 10: Existing Redis-Enabled Behavior Intact', () => {
    it('Part 10A: should route operations to custom Redis client when override is provided', async () => {
      const mockCalls = {
        set: 0,
        sadd: 0,
        scard: 0,
        hset: 0,
        get: 0,
        expire: 0
      };

      const mockRedisClient = {
        status: 'ready',
        set: async () => { mockCalls.set++; return 'OK'; },
        get: async () => { mockCalls.get++; return JSON.stringify({ sessionId: 'att-redis-test', tenantId: 'tenant_redis', status: 'active', startedAt: Date.now(), expiresAt: Date.now() + 60000 }); },
        sadd: async () => { mockCalls.sadd++; return 1; },
        scard: async () => { mockCalls.scard++; return 1; },
        hset: async () => { mockCalls.hset++; return 1; },
        expire: async () => { mockCalls.expire++; return 1; }
      };

      setRedisClientOverride(mockRedisClient);

      // Effective client must be the Redis client
      const effectiveClient = getEffectiveClient();
      expect(effectiveClient).toBe(mockRedisClient);

      // Starting session should use mockRedisClient.set and mockRedisClient.sadd
      const session = await startSession({
        tenantId: 'tenant_redis',
        trainerId: 'trainer_redis',
        topic: 'Redis Route Verification'
      });

      expect(session).toBeDefined();
      expect(mockCalls.set).toBeGreaterThanOrEqual(1);
      expect(mockCalls.sadd).toBeGreaterThanOrEqual(1);

      setRedisClientOverride(null);
    });

    it('Part 10B: should fail closed and throw AttendanceServiceUnavailableError when REQUIRE_REDIS=true and Redis is offline', async () => {
      process.env.REQUIRE_REDIS = 'true';
      setRedisClientOverride(null); // Redis is unavailable

      // Verify effective client is null
      expect(getEffectiveClient()).toBeNull();

      // Attendance session start must fail closed
      await expect(
        startSession({
          tenantId: 'tenant_strict_prod',
          trainerId: 'trainer_strict',
          topic: 'Strict Cluster Mode'
        })
      ).rejects.toThrow(AttendanceServiceUnavailableError);

      // Attendance marking must fail closed
      await expect(
        markAttendance({
          tenantId: 'tenant_strict_prod',
          sessionId: 'att-12345',
          studentId: 'student_strict'
        })
      ).rejects.toThrow(AttendanceServiceUnavailableError);
    });

    it('Part 10C: should verify Idempotency Middleware behavior with REQUIRE_REDIS_IDEMPOTENCY', async () => {
      // With REQUIRE_REDIS_IDEMPOTENCY=false (or unset), in-memory lock works
      process.env.REQUIRE_REDIS_IDEMPOTENCY = 'false';
      const mw = requireIdempotency();

      let nextCalled = false;
      const mockReq = {
        method: 'POST',
        headers: { 'x-idempotency-key': 'idem-test-key-01' },
        body: { test: 'payload' },
        tenantId: 'tenant_idem_01',
        user: { _id: 'user_idem_01' }
      };
      const mockRes = {
        statusCode: 200,
        status: function(code) { this.statusCode = code; return this; },
        json: function(data) { this.body = data; return this; },
        on: () => {}
      };
      const mockNext = () => { nextCalled = true; };

      await mw(mockReq, mockRes, mockNext);
      expect(nextCalled).toBe(true);

      // With REQUIRE_REDIS_IDEMPOTENCY=true and Redis disconnected, request fails closed with 503
      process.env.REQUIRE_REDIS_IDEMPOTENCY = 'true';
      let errorStatus = null;
      let errorBody = null;
      const mockRes503 = {
        statusCode: 200,
        status: function(code) {
          errorStatus = code;
          this.statusCode = code;
          return this;
        },
        json: function(data) {
          errorBody = data;
          this.body = data;
          return this;
        }
      };
      nextCalled = false;

      await mw(mockReq, mockRes503, mockNext);
      expect(nextCalled).toBe(false);
      expect(errorStatus).toBe(503);
      expect(errorBody.code).toBe('DISTRIBUTED_IDEMPOTENCY_UNAVAILABLE');
    });
  });
});
