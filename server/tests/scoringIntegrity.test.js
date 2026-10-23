/**
 * Lumina LMS — Scoring Integrity & Assessment Submission Hardening Test Suite
 * 6th Civilians Corporation
 *
 * Verifies without connecting to remote Atlas:
 * 1. Ordinary submission without trusted grading data remains ungraded (score: null, percentage: null, status: 'submitted').
 * 2. Verified disqualification receives zero marks (score: 0, percentage: 0, status: 'disqualified').
 * 3. Client-supplied fake scores and evaluation fields are ignored.
 * 4. Submitted code/answers are persisted in AssessmentAttempt without storing client score claims.
 * 5. Duplicate and concurrent submissions cannot overwrite an accepted attempt.
 * 6. Missing or invalid assessment configuration fails safely without inventing a maximum score.
 * 7. Trainer reports return real stored marks or null, never synthetic 45/50 or 90% values.
 * 8. Non-submitting students with proctoring events do not have fabricated attempts manufactured.
 * 9. Strict tenant isolation on trainer reports.
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

import {
  finalizeAssessmentSubmission,
  setAssessmentRedisClientOverride,
  SharedMemoryStore
} from '../services/assessmentSessionService.js';
import Assessment from '../models/Assessment.js';
import AssessmentAttempt from '../models/AssessmentAttempt.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import User from '../models/User.js';
import assessmentRoutes from '../routes/assessmentRoutes.js';

describe('Lumina LMS — Assessment Scoring Integrity & Remediation (Isolated Mock Layer)', () => {
  const JWT_SECRET = 'scoring-integrity-test-secret-with-more-than-32-chars';
  let app;
  let sharedMemoryStore;

  const tenantAId = new mongoose.Types.ObjectId();
  const tenantBId = new mongoose.Types.ObjectId();
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const trainerAId = new mongoose.Types.ObjectId();
  const trainerBId = new mongoose.Types.ObjectId();

  let studentTokenA;
  let trainerTokenA;
  let trainerTokenB;

  // In-memory mock databases
  let mockAssessments = {};
  let mockAttempts = {};
  let mockEvents = [];

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;

    studentTokenA = jwt.sign(
      { id: studentAId.toString(), role: 'student', tenantId: tenantAId.toString(), name: 'Alice Student' },
      JWT_SECRET
    );
    trainerTokenA = jwt.sign(
      { id: trainerAId.toString(), role: 'trainer', tenantId: tenantAId.toString(), name: 'Trainer Oakridge' },
      JWT_SECRET
    );
    trainerTokenB = jwt.sign(
      { id: trainerBId.toString(), role: 'trainer', tenantId: tenantBId.toString(), name: 'Trainer StMarys' },
      JWT_SECRET
    );

    // Ensure readyState is 1 for Mongoose lookup path
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    const mockUsers = {
      [studentAId.toString()]: { _id: studentAId, role: 'student', tenantId: tenantAId, name: 'Alice Student' },
      [studentBId.toString()]: { _id: studentBId, role: 'student', tenantId: tenantAId, name: 'Bob Student' },
      [trainerAId.toString()]: { _id: trainerAId, role: 'trainer', tenantId: tenantAId, name: 'Trainer Oakridge' },
      [trainerBId.toString()]: { _id: trainerBId, role: 'trainer', tenantId: tenantBId, name: 'Trainer StMarys' }
    };

    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const u = mockUsers[id?.toString()];
      return {
        select: () => Promise.resolve(u ? { ...u } : null)
      };
    });

    // Mock Assessment.findOne
    jest.spyOn(Assessment, 'findOne').mockImplementation((query) => {
      return {
        lean: async () => {
          const tenantIdStr = query.tenantId?.toString();
          for (const a of Object.values(mockAssessments)) {
            if (a.tenantId.toString() !== tenantIdStr) continue;
            if (query.$or) {
              const matches = query.$or.some((cond) => {
                if (cond.id && a.id === cond.id) return true;
                if (cond._id && a._id.toString() === cond._id.toString()) return true;
                return false;
              });
              if (matches) return { ...a };
            } else if (query.id && a.id === query.id) {
              return { ...a };
            }
          }
          return null;
        }
      };
    });

    // Mock AssessmentAttempt.findOne
    jest.spyOn(AssessmentAttempt, 'findOne').mockImplementation((query) => {
      const exec = async () => {
        const tenantIdStr = query.tenantId?.toString();
        const studentIdStr = query.studentId?.toString();
        const assessmentId = query.assessmentId;

        for (const att of Object.values(mockAttempts)) {
          if (tenantIdStr && att.tenantId.toString() !== tenantIdStr) continue;
          if (studentIdStr && att.studentId.toString() !== studentIdStr) continue;
          if (assessmentId && att.assessmentId !== assessmentId) continue;
          return { ...att };
        }
        return null;
      };
      return {
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    // Mock AssessmentAttempt.findById
    jest.spyOn(AssessmentAttempt, 'findById').mockImplementation((id) => {
      const exec = async () => {
        const att = mockAttempts[id?.toString()];
        return att ? { ...att } : null;
      };
      return {
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    // Mock AssessmentAttempt.find
    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((query) => {
      const exec = async () => {
        const tenantIdStr = query.tenantId?.toString();
        const assessmentIds = query.assessmentId?.$in || (query.assessmentId ? [query.assessmentId] : null);

        const results = [];
        for (const att of Object.values(mockAttempts)) {
          if (tenantIdStr && att.tenantId.toString() !== tenantIdStr) continue;
          if (assessmentIds && !assessmentIds.includes(att.assessmentId)) continue;
          results.push({ ...att });
        }
        return results;
      };
      return {
        sort: () => ({ lean: exec, then: (resolve) => exec().then(resolve) }),
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    // Mock AssessmentAttempt.findOneAndUpdate
    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation((query, update) => {
      return {
        lean: async () => {
          let target = null;
          if (query._id) {
            target = mockAttempts[query._id.toString()];
          } else {
            for (const att of Object.values(mockAttempts)) {
              if (query.tenantId && att.tenantId.toString() !== query.tenantId.toString()) continue;
              if (query.studentId && att.studentId.toString() !== query.studentId.toString()) continue;
              if (query.assessmentId && att.assessmentId !== query.assessmentId) continue;
              target = att;
              break;
            }
          }

          if (!target) return null;

          // Check conditional status update
          if (query.status?.$in && !query.status.$in.includes(target.status)) {
            return null; // Conditional update failed (e.g. already submitted)
          }

          if (update.$set) {
            Object.assign(target, update.$set);
          } else {
            Object.assign(target, update);
          }
          return { ...target };
        }
      };
    });

    // Mock AssessmentAttempt.create
    jest.spyOn(AssessmentAttempt, 'create').mockImplementation((doc) => {
      const _id = doc._id || new mongoose.Types.ObjectId();
      const newDoc = {
        _id,
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockAttempts[_id.toString()] = newDoc;
      return Promise.resolve(newDoc);
    });

    // Mock AssessmentEvent.find
    jest.spyOn(AssessmentEvent, 'find').mockImplementation((query) => {
      const exec = async () => {
        return mockEvents.filter((ev) => {
          if (query.tenantId && ev.tenantId !== query.tenantId.toString()) return false;
          if (query.assessmentId?.$in && !query.assessmentId.$in.includes(ev.assessmentId)) return false;
          return true;
        });
      };
      return {
        sort: () => ({ lean: exec, then: (resolve) => exec().then(resolve) }),
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    // Express app mounting routes
    app = express();
    app.use(express.json());
    app.use('/api/v1/assessments', assessmentRoutes);
  });

  const setupDefaultMocks = () => {
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    const mockUsers = {
      [studentAId.toString()]: { _id: studentAId, role: 'student', tenantId: tenantAId, name: 'Alice Student' },
      [studentBId.toString()]: { _id: studentBId, role: 'student', tenantId: tenantAId, name: 'Bob Student' },
      [trainerAId.toString()]: { _id: trainerAId, role: 'trainer', tenantId: tenantAId, name: 'Trainer Oakridge' },
      [trainerBId.toString()]: { _id: trainerBId, role: 'trainer', tenantId: tenantBId, name: 'Trainer StMarys' }
    };

    jest.spyOn(User, 'findById').mockImplementation((id) => {
      const u = mockUsers[id?.toString()];
      return {
        select: () => Promise.resolve(u ? { ...u } : null)
      };
    });

    jest.spyOn(Assessment, 'findOne').mockImplementation((query) => {
      return {
        lean: async () => {
          const tenantIdStr = query.tenantId?.toString();
          for (const a of Object.values(mockAssessments)) {
            if (a.tenantId.toString() !== tenantIdStr) continue;
            if (query.$or) {
              const matches = query.$or.some((cond) => {
                if (cond.id && a.id === cond.id) return true;
                if (cond._id && a._id.toString() === cond._id.toString()) return true;
                return false;
              });
              if (matches) return { ...a };
            } else if (query.id && a.id === query.id) {
              return { ...a };
            }
          }
          return null;
        }
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOne').mockImplementation((query) => {
      const exec = async () => {
        const tenantIdStr = query.tenantId?.toString();
        const studentIdStr = query.studentId?.toString();
        const assessmentId = query.assessmentId;

        for (const att of Object.values(mockAttempts)) {
          if (tenantIdStr && att.tenantId.toString() !== tenantIdStr) continue;
          if (studentIdStr && att.studentId.toString() !== studentIdStr) continue;
          if (assessmentId && att.assessmentId !== assessmentId) continue;
          return { ...att };
        }
        return null;
      };
      return {
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    jest.spyOn(AssessmentAttempt, 'findById').mockImplementation((id) => {
      const exec = async () => {
        const att = mockAttempts[id?.toString()];
        return att ? { ...att } : null;
      };
      return {
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    jest.spyOn(AssessmentAttempt, 'find').mockImplementation((query) => {
      const exec = async () => {
        const tenantIdStr = query.tenantId?.toString();
        const assessmentIds = query.assessmentId?.$in || (query.assessmentId ? [query.assessmentId] : null);

        const results = [];
        for (const att of Object.values(mockAttempts)) {
          if (tenantIdStr && att.tenantId.toString() !== tenantIdStr) continue;
          if (assessmentIds && !assessmentIds.includes(att.assessmentId)) continue;
          results.push({ ...att });
        }
        return results;
      };
      return {
        sort: () => ({ lean: exec, then: (resolve) => exec().then(resolve) }),
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });

    jest.spyOn(AssessmentAttempt, 'findOneAndUpdate').mockImplementation((query, update) => {
      return {
        lean: async () => {
          let target = null;
          if (query._id) {
            target = mockAttempts[query._id.toString()];
          } else {
            for (const att of Object.values(mockAttempts)) {
              if (query.tenantId && att.tenantId.toString() !== query.tenantId.toString()) continue;
              if (query.studentId && att.studentId.toString() !== query.studentId.toString()) continue;
              if (query.assessmentId && att.assessmentId !== query.assessmentId) continue;
              target = att;
              break;
            }
          }

          if (!target) return null;

          if (query.status?.$in && !query.status.$in.includes(target.status)) {
            return null;
          }

          if (update.$set) {
            Object.assign(target, update.$set);
          } else {
            Object.assign(target, update);
          }
          return { ...target };
        }
      };
    });

    jest.spyOn(AssessmentAttempt, 'create').mockImplementation((doc) => {
      const _id = doc._id || new mongoose.Types.ObjectId();
      const newDoc = {
        _id,
        ...doc,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockAttempts[_id.toString()] = newDoc;
      return Promise.resolve(newDoc);
    });

    jest.spyOn(AssessmentEvent, 'find').mockImplementation((query) => {
      const exec = async () => {
        return mockEvents.filter((ev) => {
          if (query.tenantId && ev.tenantId !== query.tenantId.toString()) return false;
          if (query.assessmentId?.$in && !query.assessmentId.$in.includes(ev.assessmentId)) return false;
          return true;
        });
      };
      return {
        sort: () => ({ lean: exec, then: (resolve) => exec().then(resolve) }),
        lean: exec,
        then: (resolve) => exec().then(resolve)
      };
    });
  };

  beforeEach(() => {
    setupDefaultMocks();
    sharedMemoryStore = new SharedMemoryStore();
    setAssessmentRedisClientOverride(sharedMemoryStore);

    // Reset in-memory databases
    const exam1Id = new mongoose.Types.ObjectId();
    mockAssessments = {
      [exam1Id.toString()]: {
        _id: exam1Id,
        id: 'exam-py-diag',
        title: 'Python Diagnostic Test',
        subject: 'Python Programming',
        tenantId: tenantAId,
        totalMarks: 30,
        durationMinutes: 45,
        status: 'active'
      }
    };
    mockAttempts = {};
    mockEvents = [];
  });

  afterEach(() => {
    setAssessmentRedisClientOverride(null);
  });

  // ─── 1. Fail-Closed Durable Persistence (Fix 1) ───────────────────────────
  describe('1. Fail-Closed Durable Persistence', () => {
    it('should reject submission if tenantId is missing', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: null,
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def test(): pass'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Tenant and student identity context are required');
      expect(Object.keys(mockAttempts).length).toBe(0);
    });

    it('should reject submission if userId is missing', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: null,
        assessmentId: 'exam-py-diag',
        code: 'def test(): pass'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Tenant and student identity context are required');
      expect(Object.keys(mockAttempts).length).toBe(0);
    });

    it('should fail closed when MongoDB is unavailable (readyState !== 1)', async () => {
      try {
        Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });

        const result = await finalizeAssessmentSubmission({
          tenantId: tenantAId.toString(),
          userId: studentAId.toString(),
          assessmentId: 'exam-py-diag',
          code: 'def test(): pass'
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe('failed');
        expect(result.message).toContain('storage is unavailable');
        expect(Object.keys(mockAttempts).length).toBe(0);
      } finally {
        Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
      }
    });

    it('should distinguish a database lookup error from a non-existent assessment', async () => {
      // Spy on Assessment.findOne to throw a network/connection error
      jest.spyOn(Assessment, 'findOne').mockImplementationOnce(() => ({
        lean: async () => {
          throw new Error('MongoNetworkTimeoutError: connection timed out');
        }
      }));

      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def test(): pass'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Database error occurred while verifying assessment configuration');
      expect(Object.keys(mockAttempts).length).toBe(0);

      // Verify HTTP endpoint returns 503 for database error
      jest.spyOn(Assessment, 'findOne').mockImplementationOnce(() => ({
        lean: async () => {
          throw new Error('MongoNetworkTimeoutError: connection timed out');
        }
      }));

      const httpRes = await request(app)
        .post('/api/v1/assessments/exam-py-diag/submit')
        .set('Authorization', `Bearer ${studentTokenA}`)
        .send({ code: 'def test(): pass' });

      expect(httpRes.status).toBe(503);
      expect(httpRes.body.success).toBe(false);
    });

    it('should return 400 when assessment does not exist for authenticated tenant', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'non-existent-assessment',
        code: 'def test(): pass'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Assessment configuration not found or unauthorized');

      const httpRes = await request(app)
        .post('/api/v1/assessments/non-existent-assessment/submit')
        .set('Authorization', `Bearer ${studentTokenA}`)
        .send({ code: 'def test(): pass' });

      expect(httpRes.status).toBe(400);
      expect(httpRes.body.success).toBe(false);
    });

    it('should fail closed if AssessmentAttempt persistence throws a database error', async () => {
      // Spy on AssessmentAttempt.create to throw an unhandled DB error
      jest.spyOn(AssessmentAttempt, 'create').mockImplementationOnce(() => {
        return Promise.reject(new Error('MongoWriteException: Disk write failure'));
      });

      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def test(): pass'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.message).toContain('Failed to record assessment submission in permanent storage');

      // Verify HTTP route returns 503
      jest.spyOn(AssessmentAttempt, 'create').mockImplementationOnce(() => {
        return Promise.reject(new Error('MongoWriteException: Disk write failure'));
      });

      const httpRes = await request(app)
        .post('/api/v1/assessments/exam-py-diag/submit')
        .set('Authorization', `Bearer ${studentTokenA}`)
        .send({ code: 'def test(): pass' });

      expect(httpRes.status).toBe(503);
      expect(httpRes.body.success).toBe(false);
    });

    it('should persist successful submission with score: null, percentage: null, and status: submitted', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def test(): return True',
        answers: [{ questionId: 'q1', code: 'def test(): return True', language: 'python' }],
        isTerminated: false,
        submissionReason: 'NORMAL'
      });

      expect(result.success).toBe(true);
      expect(result.isTerminated).toBe(false);
      expect(result.status).toBe('submitted');

      const attempts = Object.values(mockAttempts);
      expect(attempts.length).toBe(1);
      const attempt = attempts[0];
      expect(attempt.status).toBe('submitted');
      expect(attempt.score).toBeNull();
      expect(attempt.percentage).toBeNull();
      expect(attempt.maxScore).toBe(30);
    });

    it('should preserve existing disqualification behavior with score: 0 and percentage: 0', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def cheated(): pass',
        isTerminated: true,
        submissionReason: 'TERMINATED_MAX_WARNINGS'
      });

      expect(result.success).toBe(true);
      expect(result.isTerminated).toBe(true);
      expect(result.status).toBe('disqualified');

      const attempt = Object.values(mockAttempts)[0];
      expect(attempt.status).toBe('disqualified');
      expect(attempt.score).toBe(0);
      expect(attempt.percentage).toBe(0);
      expect(attempt.maxScore).toBe(30);
      expect(attempt.integrityStatus).toBe('review_required');
    });
  });

  // ─── 2. Preserve Legitimate Answers & Strip Grading Claims (Fix 2) ──────────
  describe('2. Preserve Legitimate Answers while Stripping Grading Claims', () => {
    it('should preserve MCQ selected answers and question IDs on read-back', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        answers: [
          {
            questionId: 'q-mcq-1',
            selectedOption: 2,
            answer: 'Option C: Binary Search'
          },
          {
            questionId: 'q-mcq-2',
            selectedOption: 0,
            answer: 'Option A: O(1)'
          }
        ]
      });

      expect(result.success).toBe(true);
      const attempt = Object.values(mockAttempts)[0];
      expect(attempt.answers).toHaveLength(2);
      expect(attempt.answers[0]).toEqual({
        questionId: 'q-mcq-1',
        selectedOption: 2,
        answer: 'Option C: Binary Search'
      });
      expect(attempt.answers[1]).toEqual({
        questionId: 'q-mcq-2',
        selectedOption: 0,
        answer: 'Option A: O(1)'
      });
    });

    it('should preserve free text and essay answers on read-back', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        answers: [
          {
            questionId: 'q-text-essay',
            text: 'Mitochondria is the powerhouse of the cell.',
            response: 'It generates most of the chemical energy needed by the cell.'
          }
        ]
      });

      expect(result.success).toBe(true);
      const attempt = Object.values(mockAttempts)[0];
      expect(attempt.answers[0]).toEqual({
        questionId: 'q-text-essay',
        text: 'Mitochondria is the powerhouse of the cell.',
        response: 'It generates most of the chemical energy needed by the cell.'
      });
    });

    it('should preserve coding source, language, and question ID', async () => {
      const codeSnippet = 'def fibonacci(n):\n    return n if n <= 1 else fibonacci(n-1) + fibonacci(n-2)';
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: codeSnippet,
        answers: [
          {
            questionId: 'q-code-fib',
            code: codeSnippet,
            language: 'python'
          }
        ]
      });

      expect(result.success).toBe(true);
      const attempt = Object.values(mockAttempts)[0];
      expect(attempt.answers[0]).toEqual({
        questionId: 'q-code-fib',
        code: codeSnippet,
        language: 'python'
      });
    });

    it('should strip all client-supplied grading claims while retaining answer contents', async () => {
      const result = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        answers: [
          {
            questionId: 'q-mcq-tampered',
            selectedOption: 3,
            answer: 'Option D',
            // Untrusted grading fields that must be stripped:
            score: 10,
            marks: 10,
            percentage: 100,
            passed: true,
            grade: 'A+',
            questionResults: [{ testCase: 1, passed: true }],
            evalResults: { status: 'passed' }
          }
        ],
        // Client attempting to supply root-level evaluation results:
        questionResults: [{ questionId: 'q-mcq-tampered', passed: true, score: 10 }]
      });

      expect(result.success).toBe(true);
      const attempt = Object.values(mockAttempts)[0];

      // Stored attempt root grading must remain null
      expect(attempt.score).toBeNull();
      expect(attempt.percentage).toBeNull();

      // Untrusted grading claims inside the answer object must be stripped
      const savedAns = attempt.answers[0];
      expect(savedAns.questionId).toBe('q-mcq-tampered');
      expect(savedAns.selectedOption).toBe(3);
      expect(savedAns.answer).toBe('Option D');

      expect(savedAns.score).toBeUndefined();
      expect(savedAns.marks).toBeUndefined();
      expect(savedAns.percentage).toBeUndefined();
      expect(savedAns.passed).toBeUndefined();
      expect(savedAns.grade).toBeUndefined();
      expect(savedAns.questionResults).toBeUndefined();
      expect(savedAns.evalResults).toBeUndefined();
    });
  });

  // ─── 3. Concurrent Request Protection (Fix 3) ──────────────────────────────
  describe('3. Concurrency Protection & Duplicate Submissions', () => {
    it('should handle genuine concurrent duplicate requests via Promise.all with unique index race resolution', async () => {
      // Simulate MongoDB unique compound index race:
      // When two requests call AssessmentAttempt.create simultaneously, the first creates the doc,
      // and the second throws E11000 duplicate key error.
      let createCallCount = 0;
      const originalCreate = AssessmentAttempt.create;

      jest.spyOn(AssessmentAttempt, 'create').mockImplementation(async (doc) => {
        createCallCount++;
        if (createCallCount === 1) {
          // First winner creates the doc
          const _id = doc._id || new mongoose.Types.ObjectId();
          const newDoc = {
            _id,
            ...doc,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          mockAttempts[_id.toString()] = newDoc;
          return newDoc;
        } else {
          // Competing concurrent thread encounters duplicate key violation
          const dupErr = new Error('E11000 duplicate key error collection: assessmentattempts index: tenantId_1_assessmentId_1_studentId_1 dup key');
          dupErr.code = 11000;
          throw dupErr;
        }
      });

      const [res1, res2] = await Promise.all([
        finalizeAssessmentSubmission({
          tenantId: tenantAId.toString(),
          userId: studentAId.toString(),
          assessmentId: 'exam-py-diag',
          code: 'def run1(): pass',
          answers: [{ code: 'def run1(): pass', language: 'python' }]
        }),
        finalizeAssessmentSubmission({
          tenantId: tenantAId.toString(),
          userId: studentAId.toString(),
          assessmentId: 'exam-py-diag',
          code: 'def run2(): pass',
          answers: [{ code: 'def run2(): pass', language: 'python' }]
        })
      ]);

      // Exactly one attempt created
      const attempts = Object.values(mockAttempts);
      expect(attempts.length).toBe(1);

      // One response was the original creator, the second safely recognized the winning duplicate
      const successResults = [res1, res2].filter((r) => r.success === true);
      expect(successResults.length).toBe(2);

      const dupResult = [res1, res2].find((r) => r.isDuplicate === true);
      expect(dupResult).toBeDefined();
      expect(dupResult.status).toBe('submitted');
      expect(dupResult.message).toContain('already been received');
    });

    it('should not report duplicate success if competing insert races on an attempt that is not submitted or evaluated', async () => {
      // 1. Initial AssessmentAttempt.findOne returns null (no existing attempt observed before insert)
      // 2. AssessmentAttempt.create throws E11000 duplicate key error
      // 3. Concurrency read-back AssessmentAttempt.findOne returns winning attempt that is still 'in_progress'
      jest.spyOn(AssessmentAttempt, 'findOne')
        .mockImplementationOnce(() => ({ lean: async () => null }))
        .mockImplementationOnce(() => ({ lean: async () => ({ status: 'in_progress' }) }));

      jest.spyOn(AssessmentAttempt, 'create').mockImplementationOnce(() => {
        const dupErr = new Error('E11000 duplicate key error');
        dupErr.code = 11000;
        return Promise.reject(dupErr);
      });

      const res = await finalizeAssessmentSubmission({
        tenantId: tenantAId.toString(),
        userId: studentAId.toString(),
        assessmentId: 'exam-py-diag',
        code: 'def race(): pass'
      });

      // Must fail closed because winning attempt was not yet submitted/evaluated!
      expect(res.success).toBe(false);
      expect(res.status).toBe('failed');
      expect(res.message).toContain('Failed to record assessment submission in permanent storage');
    });
  });

  // ─── 4. Remove Unsupported Question-Level Metrics (Fix 4) ───────────────────
  describe('4. Remove Unsupported Question-Level Metrics', () => {
    it('should return null for correctCount, incorrectCount, unansweredCount in submissions-detailed', async () => {
      const attId = new mongoose.Types.ObjectId();
      mockAttempts[attId.toString()] = {
        _id: attId,
        tenantId: tenantAId,
        studentId: studentAId,
        studentIdentifier: 'STU-001',
        studentName: 'Alice Student',
        className: 'Class 10 - Section A',
        assessmentId: 'exam-py-diag',
        assessmentTitle: 'Python Diagnostic Test',
        startedAt: new Date(Date.now() - 30 * 60000),
        submittedAt: new Date(Date.now()),
        status: 'submitted',
        score: null,
        maxScore: 30,
        percentage: null,
        timeUsedMinutes: 30,
        violationCount: 0
      };

      const res = await request(app)
        .get('/api/v1/assessments/exam-py-diag/submissions-detailed')
        .set('Authorization', `Bearer ${trainerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.submissions).toHaveLength(1);

      const sub = res.body.submissions[0];
      // Unsupported question-level metrics must be strictly null
      expect(sub.correctCount).toBeNull();
      expect(sub.incorrectCount).toBeNull();
      expect(sub.unansweredCount).toBeNull();

      // Real persisted fields preserved
      expect(sub.marksObtained).toBeNull();
      expect(sub.totalMarks).toBe(30);
      expect(sub.percentage).toBeNull();
      expect(sub.attemptStatus).toBe('Submitted (Awaiting Marks)');
      expect(Array.isArray(sub.environmentEvents)).toBe(true);
    });

    it('should preserve actual evaluated marks without fabricating question-level counts', async () => {
      const attId = new mongoose.Types.ObjectId();
      mockAttempts[attId.toString()] = {
        _id: attId,
        tenantId: tenantAId,
        studentId: studentAId,
        studentIdentifier: 'STU-001',
        studentName: 'Alice Student',
        className: 'Class 10 - Section A',
        assessmentId: 'exam-py-diag',
        assessmentTitle: 'Python Diagnostic Test',
        startedAt: new Date(Date.now() - 30 * 60000),
        submittedAt: new Date(Date.now()),
        status: 'evaluated',
        score: 25,
        maxScore: 30,
        percentage: 83,
        timeUsedMinutes: 30,
        violationCount: 0
      };

      const res = await request(app)
        .get('/api/v1/assessments/exam-py-diag/submissions-detailed')
        .set('Authorization', `Bearer ${trainerTokenA}`);

      expect(res.status).toBe(200);
      const sub = res.body.submissions[0];

      expect(sub.marksObtained).toBe(25);
      expect(sub.totalMarks).toBe(30);
      expect(sub.percentage).toBe(83);
      expect(sub.correctCount).toBeNull(); // No fabricated question counts
      expect(sub.incorrectCount).toBeNull();
      expect(sub.unansweredCount).toBeNull();
    });

    it('should NOT manufacture an attempt for a student with only proctoring events', async () => {
      mockEvents.push({
        tenantId: tenantAId.toString(),
        assessmentId: 'exam-py-diag',
        studentId: new mongoose.Types.ObjectId().toString(),
        studentIdentifier: 'STU-GHOST',
        studentName: 'Ghost Student',
        eventType: 'FULLSCREEN_ENTERED',
        timestamp: new Date()
      });

      const res = await request(app)
        .get('/api/v1/assessments/exam-py-diag/submissions-detailed')
        .set('Authorization', `Bearer ${trainerTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.submissions).toHaveLength(0);
    });

    it('should maintain strict tenant isolation in submissions-detailed', async () => {
      const attId = new mongoose.Types.ObjectId();
      mockAttempts[attId.toString()] = {
        _id: attId,
        tenantId: tenantAId,
        studentId: studentAId,
        assessmentId: 'exam-py-diag',
        status: 'evaluated',
        score: 28,
        maxScore: 30,
        percentage: 93
      };

      const res = await request(app)
        .get('/api/v1/assessments/exam-py-diag/submissions-detailed')
        .set('Authorization', `Bearer ${trainerTokenB}`); // Trainer B from Tenant B

      expect(res.status).toBe(200);
      expect(res.body.submissions).toHaveLength(0);
    });
  });
});
