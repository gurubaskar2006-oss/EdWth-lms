/**
 * Lumina LMS — Multi-Node Attendance State & Concurrency Test Suite
 * 6th Civilians Corporation
 *
 * Verifies:
 * 1. Multi-Node Shared State (Node A starts, Node B retrieves & marks, Node A reads updated tally)
 * 2. Concurrency & Deduplication (duplicate marks from same student return alreadyRecorded: true)
 * 3. High-Concurrency Simultaneous Marks (Promise.all across simulated nodes without tally corruption)
 * 4. Strict Tenant Isolation (Cross-tenant mark attempts fail with TENANT_MISMATCH)
 * 5. Batch Membership Boundaries (Cross-batch mark attempts fail with BATCH_MISMATCH)
 * 6. Session Lifecycle & Expiry (Manual stop and expired window fail with appropriate codes)
 * 7. Production Fail-Closed Safety (Redis unavailable in production throws 503 without process crash)
 */

import {
  startSession,
  getSession,
  markAttendance,
  stopSession,
  getActiveSessionsForTenant,
  getSessionConfirmedStudents,
  setRedisClientOverride,
  SharedMemoryStore,
  AttendanceServiceUnavailableError
} from '../services/attendanceSessionService.js';

describe('Lumina Multi-Node Safe Attendance Suite', () => {
  let sharedRedisBus;

  beforeEach(() => {
    // Shared Redis coordination bus shared between simulated API Node A and Node B
    sharedRedisBus = new SharedMemoryStore();
    setRedisClientOverride(sharedRedisBus);
  });

  afterEach(() => {
    setRedisClientOverride(null);
  });

  describe('1. Multi-Node State Sharing Simulation', () => {
    it('should allow Node A to start attendance and Node B to retrieve and mark it', async () => {
      const tenantId = 'tenant_oxford_101';
      const batchId = 'batch_cs_2026';
      const trainerId = 'trainer_alan_turing';

      // --- SIMULATE API NODE A: Trainer starts session ---
      const sessionFromNodeA = await startSession({
        tenantId,
        batchId,
        trainerId,
        trainerName: 'Prof. Alan Turing',
        topic: 'Distributed Consensus & Raft',
        durationSeconds: 60
      });

      expect(sessionFromNodeA).toBeDefined();
      expect(sessionFromNodeA.sessionId).toMatch(/^att-/);
      expect(sessionFromNodeA.status).toBe('active');

      // --- SIMULATE API NODE B: Student connects and checks active prompts ---
      const activePromptsOnNodeB = await getActiveSessionsForTenant(tenantId, batchId);
      expect(activePromptsOnNodeB.length).toBe(1);
      expect(activePromptsOnNodeB[0].sessionId).toBe(sessionFromNodeA.sessionId);

      // --- SIMULATE API NODE B: Student marks attendance ---
      const markResultFromNodeB = await markAttendance({
        tenantId,
        sessionId: sessionFromNodeA.sessionId,
        studentId: 'student_ada_lovelace',
        studentName: 'Ada Lovelace',
        studentEmail: 'ada@oxford.edu',
        studentBatchId: batchId
      });

      expect(markResultFromNodeB.success).toBe(true);
      expect(markResultFromNodeB.alreadyRecorded).toBe(false);
      expect(markResultFromNodeB.count).toBe(1);
      expect(markResultFromNodeB.latestStudent.name).toBe('Ada Lovelace');

      // --- SIMULATE API NODE A: Trainer inspects live confirmed roster ---
      const confirmedRosterOnNodeA = await getSessionConfirmedStudents(tenantId, sessionFromNodeA.sessionId);
      expect(confirmedRosterOnNodeA.length).toBe(1);
      expect(confirmedRosterOnNodeA[0].studentId).toBe('student_ada_lovelace');
      expect(confirmedRosterOnNodeA[0].name).toBe('Ada Lovelace');
    });
  });

  describe('2. Concurrency & Deduplication', () => {
    it('should atomically deduplicate multiple mark requests from the same student', async () => {
      const tenantId = 'tenant_cambridge_202';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_newton',
        topic: 'Classical Mechanics',
        durationSeconds: 60
      });

      // First mark attempt
      const firstMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_halley',
        studentName: 'Edmond Halley'
      });
      expect(firstMark.success).toBe(true);
      expect(firstMark.alreadyRecorded).toBe(false);
      expect(firstMark.count).toBe(1);

      // Immediate duplicate mark attempt (e.g. double click or multi-node race)
      const duplicateMark = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_halley',
        studentName: 'Edmond Halley'
      });
      expect(duplicateMark.success).toBe(true);
      expect(duplicateMark.alreadyRecorded).toBe(true);
      expect(duplicateMark.message).toBe('Attendance already recorded!');
      expect(duplicateMark.count).toBe(1); // Count must NOT increment to 2

      const roster = await getSessionConfirmedStudents(tenantId, session.sessionId);
      expect(roster.length).toBe(1);
    });

    it('should handle simultaneous concurrent marks across nodes without lost updates', async () => {
      const tenantId = 'tenant_mit_303';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_shannon',
        topic: 'Information Theory',
        durationSeconds: 90
      });

      const students = Array.from({ length: 25 }, (_, i) => ({
        tenantId,
        sessionId: session.sessionId,
        studentId: `student_${i + 1}`,
        studentName: `Student ${i + 1}`,
        studentEmail: `student${i + 1}@mit.edu`
      }));

      // Fire 25 concurrent requests simultaneously across nodes
      const results = await Promise.all(students.map((s) => markAttendance(s)));

      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.alreadyRecorded === false)).toBe(true);

      const finalRoster = await getSessionConfirmedStudents(tenantId, session.sessionId);
      expect(finalRoster.length).toBe(25);
    });
  });

  describe('3. Strict Tenant Isolation', () => {
    it('should reject mark attempts from a student of a different tenant', async () => {
      const tenantA = 'tenant_harvard_404';
      const tenantB = 'tenant_yale_505';

      const sessionOfTenantA = await startSession({
        tenantId: tenantA,
        trainerId: 'trainer_emerson',
        topic: 'Transcendental Philosophy',
        durationSeconds: 60
      });

      // Student from Tenant B tries to mark attendance for Tenant A's session
      const crossTenantAttempt = await markAttendance({
        tenantId: tenantB, // Student belongs to Tenant B
        sessionId: sessionOfTenantA.sessionId,
        studentId: 'student_intruder',
        studentName: 'Intruder Student'
      });

      expect(crossTenantAttempt.success).toBe(false);
      // Key lookup for tenantB fails or tenantId mismatch occurs
      expect(['SESSION_NOT_FOUND', 'TENANT_MISMATCH']).toContain(crossTenantAttempt.code);

      const rosterA = await getSessionConfirmedStudents(tenantA, sessionOfTenantA.sessionId);
      expect(rosterA.length).toBe(0);
    });
  });

  describe('4. Batch Membership Isolation', () => {
    it('should reject a student trying to mark a session restricted to a different batch', async () => {
      const tenantId = 'tenant_stanford_606';
      const session = await startSession({
        tenantId,
        batchId: 'batch_ai_advanced',
        trainerId: 'trainer_ng',
        topic: 'Deep Learning Architectures',
        durationSeconds: 60
      });

      const mismatchAttempt = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_web_dev',
        studentName: 'Bob Web',
        studentBatchId: 'batch_frontend_intro' // Enrolled in different batch!
      });

      expect(mismatchAttempt.success).toBe(false);
      expect(mismatchAttempt.code).toBe('BATCH_MISMATCH');
      expect(mismatchAttempt.message).toContain('not enrolled');
    });
  });

  describe('5. Session Expiry & Manual Stop', () => {
    it('should reject marks after the trainer stops the session', async () => {
      const tenantId = 'tenant_berkeley_707';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_oppenheimer',
        topic: 'Quantum Field Theory',
        durationSeconds: 120
      });

      // Trainer stops session early
      const stopResult = await stopSession({
        tenantId,
        sessionId: session.sessionId,
        requesterId: 'trainer_oppenheimer',
        requesterRole: 'trainer'
      });

      expect(stopResult.success).toBe(true);
      expect(stopResult.session.status).toBe('closed');

      // Student tries to mark closed session
      const markClosed = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_late',
        studentName: 'Late Student'
      });

      expect(markClosed.success).toBe(false);
      expect(markClosed.code).toBe('SESSION_CLOSED');
    });

    it('should reject marks after expiration timestamp', async () => {
      const tenantId = 'tenant_princeton_808';
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_einstein',
        topic: 'General Relativity',
        durationSeconds: 1 // 1-second session
      });

      // Wait 1.1s for session window to elapse
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const markExpired = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_past_deadline',
        studentName: 'Past Deadline Student'
      });

      expect(markExpired.success).toBe(false);
      expect(markExpired.code).toBe('SESSION_EXPIRED');
    });
  });

  describe('6. Production Fail-Closed Resilience', () => {
    it('should strictly throw AttendanceServiceUnavailableError in production when Redis is null', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      // Simulate Redis disconnect / null client
      setRedisClientOverride(null);

      try {
        await expect(
          startSession({
            tenantId: 'tenant_prod_909',
            trainerId: 'trainer_prod',
            topic: 'Production Safety'
          })
        ).rejects.toThrow(AttendanceServiceUnavailableError);

        await expect(
          markAttendance({
            tenantId: 'tenant_prod_909',
            sessionId: 'att-12345',
            studentId: 'student_prod'
          })
        ).rejects.toThrow(AttendanceServiceUnavailableError);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('7. Focused Verification: Node A Crash, Grace TTL, and Cross-Node Stop', () => {
    it('Point 1 & 2: should reject mark on Node B when Node A crashes and expiresAt has elapsed, even during Redis 5-minute grace period', async () => {
      const tenantId = 'tenant_grace_audit';
      
      // Node A starts a session with 1s duration
      const session = await startSession({
        tenantId,
        trainerId: 'trainer_crash_test',
        topic: 'Fault Tolerance Under Crash',
        durationSeconds: 1
      });

      // Node A crashes! (Its local setTimeout never fires, session.status in Redis remains 'active')
      // Node B remains alive.
      // Wait 1.1s so expiresAt has elapsed, but we are well within the 300s Redis grace TTL
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Key still exists in Redis during grace period:
      const rawSessionInRedis = await getSession(tenantId, session.sessionId);
      expect(rawSessionInRedis).toBeDefined();
      expect(rawSessionInRedis.sessionId).toBe(session.sessionId);

      // Node B receives a mark request:
      const markOnNodeB = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_late_post_crash',
        studentName: 'Late Student'
      });

      // Must be rejected with SESSION_EXPIRED despite status being 'active' and key existing in Redis
      expect(markOnNodeB.success).toBe(false);
      expect(markOnNodeB.code).toBe('SESSION_EXPIRED');

      // Node B checks active prompts — must discover it is expired and return 0 active prompts
      const activePromptsOnNodeB = await getActiveSessionsForTenant(tenantId);
      expect(activePromptsOnNodeB.length).toBe(0);
    });

    it('Point 3: Cross-Node Stop: Node A starts session, Node B stops it, all nodes reject subsequent marks', async () => {
      const tenantId = 'tenant_cross_stop';
      const trainerId = 'trainer_stop_tester';

      // Node A starts session
      const session = await startSession({
        tenantId,
        trainerId,
        topic: 'Distributed Stop Signaling',
        durationSeconds: 180
      });

      // Node B executes stopSession
      const stopResultOnNodeB = await stopSession({
        tenantId,
        sessionId: session.sessionId,
        requesterId: trainerId,
        requesterRole: 'trainer'
      });
      expect(stopResultOnNodeB.success).toBe(true);
      expect(stopResultOnNodeB.session.status).toBe('closed');

      // Node A tries to process a mark
      const markOnNodeA = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_stopped_nodeA'
      });
      expect(markOnNodeA.success).toBe(false);
      expect(markOnNodeA.code).toBe('SESSION_CLOSED');

      // Node B tries to process a mark
      const markOnNodeB = await markAttendance({
        tenantId,
        sessionId: session.sessionId,
        studentId: 'student_stopped_nodeB'
      });
      expect(markOnNodeB.success).toBe(false);
      expect(markOnNodeB.code).toBe('SESSION_CLOSED');
    });
  });
});
