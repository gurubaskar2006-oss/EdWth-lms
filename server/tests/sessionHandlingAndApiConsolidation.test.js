import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiService, normalizeApiUrl, getAuthToken, setAuthToken } from '../../src/services/apiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Session Handling, Resilience & API Method Consolidation', () => {
  const originalFetch = global.fetch;
  const originalLocalStorage = global.localStorage;
  const originalWindow = global.window;
  let mockStorage = {};
  let dispatchedEvents = [];

  beforeEach(() => {
    mockStorage = {};
    dispatchedEvents = [];

    // Mock localStorage
    global.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, val) => { mockStorage[key] = String(val); },
      removeItem: (key) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    };

    // Mock window & event dispatch
    global.window = {
      dispatchEvent: (event) => {
        dispatchedEvents.push(event);
        return true;
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
    global.CustomEvent = class CustomEvent {
      constructor(type, params = {}) {
        this.type = type;
        this.detail = params.detail || null;
      }
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalLocalStorage;
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // Task 1: Session Handling & Error Classification
  // =========================================================================
  describe('Task 1: Session Handling & Profile Probing', () => {
    it('handles valid session and successful profile response (HTTP 200)', async () => {
      const mockUser = {
        _id: 'usr_mock_123',
        name: 'Alice Scholar',
        email: 'alice@edwth.com',
        role: 'student'
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, user: mockUser })
      });

      const result = await apiService.getProfile();
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.user).toBeDefined();
      expect(result.user._id).toBe('usr_mock_123');
      expect(result.user.name).toBe('Alice Scholar');
      expect(result.isAuthError).toBeFalsy();
      expect(result.isServerError).toBeFalsy();
      expect(result.isNetworkError).toBeFalsy();
    });

    it('reports 401 invalid/expired token with isAuthError: true and status: 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Not authorized, token expired' })
      });

      const result = await apiService.getProfile();
      expect(result.success).toBe(false);
      expect(result.status).toBe(401);
      expect(result.isAuthError).toBe(true);
      expect(result.isServerError).toBe(false);
      expect(result.isNetworkError).toBe(false);
      expect(result.message).toContain('token expired');
    });

    it('reports network failure with isNetworkError: true and status: 0 without throwing', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await apiService.getProfile();
      expect(result.success).toBe(false);
      expect(result.status).toBe(0);
      expect(result.isNetworkError).toBe(true);
      expect(result.isAuthError).toBe(false);
      expect(result.isServerError).toBe(false);
      expect(result.message).toContain('Network error fetching profile');
    });

    it('reports 5xx server failure with isServerError: true and status: 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ success: false, message: 'Internal server error in database cluster' })
      });

      const result = await apiService.getProfile();
      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.isServerError).toBe(true);
      expect(result.isAuthError).toBe(false);
      expect(result.isNetworkError).toBe(false);
    });

    it('recovers after connectivity returns: network drop does not wipe session, restored probe confirms validity', async () => {
      // Step 1: User has active cached session and token
      mockStorage['lumina_auth_token'] = 'valid.jwt.token';
      mockStorage['lumina_current_user'] = JSON.stringify({ name: 'Alice Scholar' });

      // Step 2: Network drop occurs
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Network connection lost'));
      const dropResult = await apiService.getProfile();
      expect(dropResult.isNetworkError).toBe(true);
      // In LMSContext, isNetworkError prevents wiping localStorage!
      expect(mockStorage['lumina_auth_token']).toBe('valid.jwt.token');

      // Step 3: Network reconnects — server returns healthy profile
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, user: { name: 'Alice Scholar', email: 'alice@edwth.com' } })
      });
      const restoredResult = await apiService.getProfile();
      expect(restoredResult.success).toBe(true);
      expect(restoredResult.user.email).toBe('alice@edwth.com');
    });

    it('prevents recursive lms_session_expired events when /auth/profile receives 401', async () => {
      mockStorage['lumina_auth_token'] = 'expired.token';
      mockStorage['lumina_current_user'] = JSON.stringify({ name: 'Bob' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Token expired' })
      });

      await apiService.getProfile();
      // Because /auth/profile is explicitly excluded in _fetch from dispatching lms_session_expired,
      // no circular event is dispatched directly by getProfile()!
      const expiredEvents = dispatchedEvents.filter(e => e.type === 'lms_session_expired');
      expect(expiredEvents.length).toBe(0);
    });

    it('throttles secondary 401 calls and prevents concurrent event storm', async () => {
      mockStorage['lumina_auth_token'] = 'active.jwt.token';
      mockStorage['lumina_current_user'] = JSON.stringify({ name: 'Bob' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ success: false, message: 'Not authorized' })
      });

      // Fire 5 concurrent calls that hit 401 on secondary endpoints
      await Promise.all([
        apiService._fetch('/api/v1/data/courses'),
        apiService._fetch('/api/v1/data/assignments'),
        apiService._fetch('/api/v1/admin/analytics'),
        apiService._fetch('/api/v1/trainer/classes'),
        apiService._fetch('/api/v1/trainer/homework')
      ]);

      // Throttling prevents 5 separate session expired bursts
      const expiredEvents = dispatchedEvents.filter(e => e.type === 'lms_session_expired');
      expect(expiredEvents.length).toBe(1);
    });

    it('reports 403 Forbidden with isForbidden: true and isAuthError: false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          code: 'MISSING_TENANT_CONTEXT',
          message: 'Account does not belong to a valid tenant institution.'
        })
      });

      const result = await apiService.getProfile();
      expect(result.success).toBe(false);
      expect(result.status).toBe(403);
      expect(result.isForbidden).toBe(true);
      expect(result.isAuthError).toBe(false);
      expect(result.isServerError).toBe(false);
      expect(result.isNetworkError).toBe(false);
    });

    it('confirms 403 authorization failures on secondary endpoints do not dispatch lms_session_expired', async () => {
      mockStorage['lumina_auth_token'] = 'valid.jwt.token';
      mockStorage['lumina_current_user'] = JSON.stringify({ name: 'Student Alice', role: 'student' });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ success: false, message: 'Forbidden: Insufficient privileges' }),
        clone: () => ({
          json: async () => ({ success: false, message: 'Forbidden: Insufficient privileges' })
        })
      });

      // Student attempts to access admin endpoint -> 403 Forbidden
      const res = await apiService._fetch('/api/v1/admin/overview');
      expect(res.status).toBe(403);

      // Crucial: 403 MUST NOT trigger lms_session_expired
      const expiredEvents = dispatchedEvents.filter(e => e.type === 'lms_session_expired');
      expect(expiredEvents.length).toBe(0);
    });
  });

  // =========================================================================
  // Task 2: Consolidated API Methods Verification
  // =========================================================================
  describe('Task 2: Method Deduplication & Authoritative Contracts', () => {
    it('verifies ZERO duplicate method declarations in apiService.js source code', () => {
      const source = fs.readFileSync(path.resolve(__dirname, '../../src/services/apiService.js'), 'utf8');
      const lines = source.split('\n');
      const keys = [];
      const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'try', 'return', 'else', 'finally']);
      lines.forEach((line, idx) => {
        const m = line.match(/^\s*(async\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*\{/);
        if (m && !KEYWORDS.has(m[2])) {
          keys.push({ name: m[2], line: idx + 1 });
        }
      });
      const counts = {};
      keys.forEach(k => { counts[k.name] = (counts[k.name] || 0) + 1; });
      const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);

      expect(duplicates).toEqual([]);
    });

    it('updateStudentProfile and updateProfile send PUT request to /auth/profile', async () => {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody = '';

      global.fetch = jest.fn().mockImplementation(async (url, opts) => {
        capturedUrl = url;
        capturedMethod = opts.method;
        capturedBody = opts.body;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, message: 'Profile updated' })
        };
      });

      const payload = { phone: '9876543210', address: '123 Tech Park' };
      const res = await apiService.updateProfile(payload);

      expect(capturedUrl).toContain('/auth/profile');
      expect(capturedMethod).toBe('PUT');
      expect(JSON.parse(capturedBody)).toEqual(payload);
      expect(res.success).toBe(true);
    });

    it('getTrainerStudents supports query string and returns students: [] on network error', async () => {
      let capturedUrl = '';
      global.fetch = jest.fn().mockImplementation(async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, students: [{ id: 's1' }] })
        };
      });

      const queryRes = await apiService.getTrainerStudents('batchId=batch123');
      expect(capturedUrl).toContain('/trainer/students?batchId=batch123');
      expect(queryRes.students.length).toBe(1);

      // Verify graceful catch returning students: [] and message
      global.fetch = jest.fn().mockRejectedValue(new Error('Network offline'));
      const errorRes = await apiService.getTrainerStudents();
      expect(errorRes.success).toBe(false);
      expect(Array.isArray(errorRes.students)).toBe(true);
      expect(errorRes.students).toEqual([]);
      expect(errorRes.message).toContain('Network error');
    });

    it('resetStudentPassword supports single studentId and optional newPassword with route fallback', async () => {
      const calls = [];
      global.fetch = jest.fn().mockImplementation(async (url, opts) => {
        calls.push({ url, opts });
        // Simulate 404 on /students/:id/reset-password falling back to /trainer/students/:id/reset-password
        if (url.includes('/students/std_99/reset-password') && !url.includes('/trainer/')) {
          return { status: 404, ok: false, json: async () => ({ success: false }) };
        }
        return {
          status: 200,
          ok: true,
          json: async () => ({ success: true, temporaryPassword: 'TempPassword#2026!' })
        };
      });

      const res = await apiService.resetStudentPassword('std_99');
      expect(res.success).toBe(true);
      expect(res.temporaryPassword).toBe('TempPassword#2026!');
      // Verify both primary and fallback were engaged
      expect(calls.length).toBe(2);
      expect(calls[0].url).toContain('/students/std_99/reset-password');
      expect(calls[1].url).toContain('/trainer/students/std_99/reset-password');
    });

    it('retains single authoritative implementations for homework, analytics, and storage download', () => {
      expect(typeof apiService.getTrainerHomework).toBe('function');
      expect(typeof apiService.createTrainerHomework).toBe('function');
      expect(typeof apiService.updateTrainerHomework).toBe('function');
      expect(typeof apiService.archiveTrainerHomework).toBe('function');
      expect(typeof apiService.getTrainerAnalytics).toBe('function');
      expect(typeof apiService.getStorageDownloadUrl).toBe('function');
    });
  });

  // =========================================================================
  // Task 4: Safety & Production Database Isolation
  // =========================================================================
  describe('Database Isolation & Configuration Safety', () => {
    it('confirms NODE_ENV is test or development and production DB URI is not configured', () => {
      expect(process.env.NODE_ENV).not.toBe('production');
      if (process.env.MONGODB_URI) {
        expect(process.env.MONGODB_URI.toLowerCase()).not.toContain('production');
        expect(process.env.MONGODB_URI.toLowerCase()).not.toContain('prod');
      }
    });
  });
});
