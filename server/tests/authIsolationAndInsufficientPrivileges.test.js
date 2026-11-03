import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { requireRole } from '../middleware/authMiddleware.js';
import {
  apiService,
  isSessionStale,
  markSessionStale,
  setAuthToken,
  getAuthToken
} from '../../src/services/apiService.js';
import { socketService } from '../../src/services/socketService.js';

describe('Lumina LMS — Authentication Context Isolation & INSUFFICIENT_PRIVILEGES Suite', () => {

  describe('1. Backend requireRole Middleware RBAC & Response Structure', () => {
    it('returns HTTP 403 with structured code INSUFFICIENT_PRIVILEGES when user role is not allowed', () => {
      const middleware = requireRole('admin', 'superadmin');
      
      const req = {
        user: {
          _id: 'user_trainer_123',
          role: 'trainer',
          email: 'trainer@example.com'
        }
      };

      let statusSent = null;
      let jsonSent = null;
      const res = {
        status: (code) => {
          statusSent = code;
          return {
            json: (payload) => {
              jsonSent = payload;
              return payload;
            }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusSent).toBe(403);
      expect(jsonSent).toEqual({
        success: false,
        code: 'INSUFFICIENT_PRIVILEGES',
        message: 'Forbidden: Insufficient privileges'
      });
    });

    it('returns HTTP 403 INSUFFICIENT_PRIVILEGES when student role attempts to access admin endpoint', () => {
      const middleware = requireRole('admin', 'superadmin');
      
      const req = {
        user: {
          _id: 'user_student_456',
          role: 'student',
          email: 'student@example.com'
        }
      };

      let statusSent = null;
      let jsonSent = null;
      const res = {
        status: (code) => {
          statusSent = code;
          return {
            json: (payload) => {
              jsonSent = payload;
              return payload;
            }
          };
        }
      };
      let nextCalled = false;
      const next = () => { nextCalled = true; };

      middleware(req, res, next);

      expect(nextCalled).toBe(false);
      expect(statusSent).toBe(403);
      expect(jsonSent.code).toBe('INSUFFICIENT_PRIVILEGES');
    });

    it('invokes next() without error when user holds the permitted role', () => {
      const middleware = requireRole('admin', 'superadmin');
      
      const req = {
        user: {
          _id: 'user_superadmin_789',
          role: 'superadmin',
          email: 'edwthacademyadmin@6c.com'
        }
      };

      let nextCalled = false;
      const next = () => { nextCalled = true; };
      const res = {};

      middleware(req, res, next);

      expect(nextCalled).toBe(true);
    });
  });

  describe('2. Frontend apiService Session Staleness & Request Dispatch Guard', () => {
    beforeEach(() => {
      markSessionStale(false);
    });

    afterEach(() => {
      markSessionStale(false);
    });

    it('allows marking session stale and accurately reports isSessionStale', () => {
      expect(isSessionStale()).toBe(false);
      markSessionStale(true, 'Test identity change');
      expect(isSessionStale()).toBe(true);
      markSessionStale(false);
      expect(isSessionStale()).toBe(false);
    });

    it('intercepts and blocks protected API calls when session context is stale', async () => {
      markSessionStale(true, 'Cross-tab identity change');

      const res = await apiService._fetch('/api/v1/admin/schools');
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data).toEqual({
        success: false,
        code: 'SESSION_STALE_IDENTITY_MISMATCH',
        message: 'Authentication session context is stale due to identity change in another tab. Re-authentication required.'
      });
    });

    it('re-arms session validity when a deliberate setAuthToken occurs with a valid token', () => {
      markSessionStale(true);
      expect(isSessionStale()).toBe(true);

      setAuthToken('valid_new_superadmin_token_jwt');
      expect(isSessionStale()).toBe(false);
    });
  });

  describe('3. Socket.io Connection Guard on Stale Session', () => {
    beforeEach(() => {
      markSessionStale(false);
      socketService.disconnect();
    });

    afterEach(() => {
      markSessionStale(false);
      socketService.disconnect();
    });

    it('refuses to connect when in-memory session is stale', () => {
      markSessionStale(true, 'Stale session test');

      const user = { id: 'usr-1', name: 'Super Admin', role: 'superadmin' };
      const socket = socketService.connect(user);

      expect(socket).toBeNull();
      expect(socketService.isConnected).toBe(false);
    });

    it('disconnects cleanly and clears credentials on socketService.disconnect()', () => {
      socketService.connectedUserId = 'usr-1';
      socketService.connectedRole = 'superadmin';
      socketService.connectedToken = 'fake-token';

      socketService.disconnect();

      expect(socketService.socket).toBeNull();
      expect(socketService.isConnected).toBe(false);
      expect(socketService.connectedUserId).toBeNull();
      expect(socketService.connectedRole).toBeNull();
      expect(socketService.connectedToken).toBeNull();
    });
  });
});

