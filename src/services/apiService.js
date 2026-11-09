import { executeInBrowserSandbox } from './browserCodeRunner.js';

const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : '').replace(/\/$/, '');
const API_BASE_URL = `${BACKEND_URL}/api/v1`;

let sessionExpiredDebounce = 0;

let activeSessionToken = null;
let isSessionStaleFlag = false;
let activeUserFingerprint = null;
const activeAbortControllers = new Set();

export const setActiveSessionToken = (token) => {
  activeSessionToken = token || null;
};

export const getActiveSessionToken = () => activeSessionToken;

export const isSessionStale = () => isSessionStaleFlag;

export const markSessionStale = (stale = true, reason = 'Cross-tab identity change') => {
  isSessionStaleFlag = Boolean(stale);
  if (isSessionStaleFlag) {
    // Abort all cancellable in-flight protected requests safely
    for (const controller of activeAbortControllers) {
      try {
        controller.abort('SESSION_STALE_IDENTITY_MISMATCH');
      } catch {}
    }
    activeAbortControllers.clear();
    // Drop active in-memory session token to halt further request dispatch
    activeSessionToken = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lms_session_stale', { detail: { reason } }));
    }
  }
};

export const setActiveUserFingerprint = (fingerprint) => {
  activeUserFingerprint = fingerprint || null;
};

export const getActiveUserFingerprint = () => activeUserFingerprint;

/**
 * Universal token resolver: reads exclusively from in-memory activeSessionToken or canonical lumina_auth_token.
 * Purges legacy token keys (token, jwt) from browser storage to ensure single-source authority.
 */
export const getAuthToken = () => {
  try {
    if (typeof window === 'undefined') return activeSessionToken || null;

    if (activeSessionToken && typeof activeSessionToken === 'string' && activeSessionToken !== 'null' && activeSessionToken !== 'undefined') {
      return activeSessionToken;
    }

    const canonicalToken = localStorage.getItem('lumina_auth_token');
    if (canonicalToken && typeof canonicalToken === 'string' && canonicalToken !== 'null' && canonicalToken !== 'undefined') {
      return canonicalToken;
    }

    const sessionToken = sessionStorage.getItem('lumina_auth_token');
    if (sessionToken && typeof sessionToken === 'string' && sessionToken !== 'null' && sessionToken !== 'undefined') {
      return sessionToken;
    }

    try {
      const storedUser = JSON.parse(localStorage.getItem('lumina_current_user') || '{}');
      if (storedUser?.token && typeof storedUser.token === 'string' && storedUser.token !== 'null' && storedUser.token !== 'undefined') {
        return storedUser.token;
      }
    } catch {}

    return null;
  } catch {
    return activeSessionToken || null;
  }
};

export const setAuthToken = (token) => {
  try {
    setActiveSessionToken(token);
    if (token && typeof token === 'string' && token !== 'null' && token !== 'undefined') {
      // Re-arming session on deliberate new token acquisition
      isSessionStaleFlag = false;
    } else {
      activeUserFingerprint = null;
    }

    if (typeof window === 'undefined') return;
    if (token && typeof token === 'string' && token !== 'null' && token !== 'undefined') {
      localStorage.setItem('lumina_auth_token', token);
      sessionStorage.setItem('lumina_auth_token', token);
    } else {
      localStorage.removeItem('lumina_auth_token');
      sessionStorage.removeItem('lumina_auth_token');
    }
  } catch {}
};

/**
 * Authoritatively resolves the active tenant ID from session storage or authenticated user.
 */
export const getActiveTenantId = () => {
  try {
    if (typeof window === 'undefined') return null;
    const storedInst = sessionStorage.getItem('lumina_selected_institution');
    if (storedInst) {
      const parsed = JSON.parse(storedInst);
      const instId = parsed?._id || parsed?.id;
      if (instId && typeof instId === 'string' && instId !== 'null' && instId !== 'undefined') {
        return instId;
      }
    }
    const storedUser = localStorage.getItem('lumina_current_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      const userTenant = parsedUser?.tenantId?._id || parsedUser?.tenantId;
      if (userTenant && typeof userTenant === 'string' && userTenant !== 'null' && userTenant !== 'undefined') {
        return userTenant;
      }
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Normalizes relative and absolute API request targets against the configured backend.
 */
export const normalizeApiUrl = (url) => {
  if (typeof url !== 'string') return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return BACKEND_URL ? `${BACKEND_URL}${url}` : url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${cleanPath}`;
};

export const apiService = {
  // Use credentials to send httpOnly cookies automatically and include Bearer token
  _fetch: async (url, options = {}) => {
    const targetUrl = normalizeApiUrl(url);

    // Auth resolution, recovery, and login endpoints must bypass staleness checks
    const isAuthRevalidationUrl = 
      targetUrl.includes('/auth/login') ||
      targetUrl.includes('/auth/passkeys/login') ||
      targetUrl.includes('/auth/2fa/verify') ||
      targetUrl.includes('/auth/recovery') ||
      targetUrl.includes('/auth/logout') ||
      targetUrl.includes('/auth/change-password');

    // DISPATCH PROTECTION: Prevent stale context from dispatching protected API requests
    if (isSessionStaleFlag && !isAuthRevalidationUrl) {
      console.warn(`[apiService] Blocked protected request to ${targetUrl}: session context is marked stale.`);
      const stalePayload = {
        success: false,
        code: 'SESSION_STALE_IDENTITY_MISMATCH',
        message: 'Authentication session context is stale due to identity change in another tab. Re-authentication required.'
      };
      if (typeof Response !== 'undefined') {
        return new Response(JSON.stringify(stalePayload), {
          status: 403,
          statusText: 'Forbidden: Session Stale',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden: Session Stale',
        json: async () => stalePayload,
        text: async () => JSON.stringify(stalePayload),
        clone: function() { return this; }
      };
    }

    const token = getAuthToken();
    const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

    const activeTenantId = getActiveTenantId();
    const tenantHeader = activeTenantId ? { 'x-tenant-id': activeTenantId } : {};

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

    const abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (abortController) {
      activeAbortControllers.add(abortController);
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          try { abortController.abort(options.signal.reason); } catch {}
        });
      }
    }

    const effectiveSignal = abortController ? abortController.signal : options.signal;

    let res;
    try {
      res = await fetch(targetUrl, {
        ...options,
        signal: effectiveSignal,
        credentials: 'include',
        headers: {
          ...defaultHeaders,
          ...authHeader,
          ...tenantHeader,
          ...options.headers,
        }
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        const abortedPayload = {
          success: false,
          code: 'REQUEST_ABORTED',
          message: 'Request was cancelled due to session staleness or client cancellation.'
        };
        if (typeof Response !== 'undefined') {
          return new Response(JSON.stringify(abortedPayload), {
            status: 499,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return {
          ok: false,
          status: 499,
          json: async () => abortedPayload,
          text: async () => JSON.stringify(abortedPayload),
          clone: function() { return this; }
        };
      }
      throw fetchErr;
    } finally {
      if (abortController) {
        activeAbortControllers.delete(abortController);
      }
    }

    if (res.status === 401 && !targetUrl.includes('/auth/login') && !targetUrl.includes('/auth/profile') && !targetUrl.includes('/students/datasheet') && !targetUrl.includes('/auth/change-password')) {
      const isUserCached = !!localStorage.getItem('lumina_current_user');
      const hasToken = !!getAuthToken();
      const now = Date.now();
      // Only dispatch session expired if the user was actively authenticated with a token and throttle by 5 seconds
      if (isUserCached && hasToken && now - sessionExpiredDebounce > 5000) {
        sessionExpiredDebounce = now;
        try {
          const resObj = typeof res.clone === 'function' ? res.clone() : res;
          if (typeof resObj.json === 'function') {
            resObj.json().then(data => {
              const msg = (data?.message || '').toLowerCase();
              const isAuthTermination = !data || data?.code === 'SESSION_INVALID' || data?.code === 'TOKEN_EXPIRED' || msg.includes('expired') || msg.includes('revoked') || msg.includes('not authorized') || msg.includes('unauthorized') || msg.includes('token failed');
              if (isAuthTermination) {
                window.dispatchEvent(new CustomEvent('lms_session_expired'));
              }
            }).catch(() => {});
          } else {
            window.dispatchEvent(new CustomEvent('lms_session_expired'));
          }
        } catch {}
      }
    }

    if (res.status === 403 && !targetUrl.includes('/auth/2fa')) {
      try {
        const clone = res.clone();
        clone.json().then(data => {
          if (data && data.code === 'MFA_VERIFICATION_REQUIRED') {
            // Pre-auth challenge token cannot access protected APIs; invalidate and reset unauthenticated state
            localStorage.removeItem('lumina_auth_token');
            window.dispatchEvent(new CustomEvent('lms_session_expired'));
          } else if (data && (data.code === 'MFA_SETUP_REQUIRED' || (data.message && data.message.includes('Multi-factor authentication enrollment')))) {
            window.dispatchEvent(new CustomEvent('lms_mfa_setup_required', { detail: data }));
          } else if (data && (data.code === 'MUST_CHANGE_PASSWORD' || (data.message && data.message.includes('Password change is required')))) {
            window.dispatchEvent(new CustomEvent('lms_must_change_password', { detail: data }));
          } else if (data && data.code === 'INSUFFICIENT_PRIVILEGES') {
            window.dispatchEvent(new CustomEvent('lms_insufficient_privileges', { detail: { url: targetUrl, data } }));
          }
        }).catch(() => {});
      } catch {}
    }
    
    return res;
  },

  async login(identifier, password) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (data && data.success && data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (e) {
      console.error('Login error:', e);
      return { success: false, error: 'Network error during login' };
    }
  },

  async setup2FA(credentials) {
    try {
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      if (credentials) {
        options.body = JSON.stringify(credentials);
      }
      const res = await this._fetch(`${API_BASE_URL}/auth/2fa/setup`, options);
      return await res.json();
    } catch (e) {
      console.error('Setup 2FA error:', e);
      return { success: false, message: 'Network error' };
    }
  },

  async verify2FA(preAuthToken, token) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/2fa/verify`, {
        method: 'POST',
        body: JSON.stringify({ preAuthToken, token }),
      });
      const data = await res.json();
      if (data && data.success) {
        if (data.token) {
          setAuthToken(data.token);
        }
        if (data.user || data.isTwoFactorEnabled) {
          try {
            const rawUser = localStorage.getItem('lumina_current_user');
            if (rawUser) {
              const parsed = JSON.parse(rawUser);
              const merged = { ...parsed, ...(data.user || {}), isTwoFactorEnabled: true, mfaSetupRequired: false };
              localStorage.setItem('lumina_current_user', JSON.stringify(merged));
            }
          } catch {}
        }
      }
      return data;
    } catch (e) {
      console.error('Verify 2FA error:', e);
      return { success: false, message: 'Network error' };
    }
  },

  // --- SuperAdmin Passkey (WebAuthn) APIs ---
  async getPasskeyRegisterOptions() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys/register/options`, {
        method: 'POST'
      });
      return await res.json();
    } catch (e) {
      console.error('getPasskeyRegisterOptions error:', e);
      return { success: false, message: 'Network error getting passkey registration options' };
    }
  },

  async verifyPasskeyRegister(response, deviceLabel) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys/register/verify`, {
        method: 'POST',
        body: JSON.stringify({ response, deviceLabel })
      });
      return await res.json();
    } catch (e) {
      console.error('verifyPasskeyRegister error:', e);
      return { success: false, message: 'Network error verifying passkey registration' };
    }
  },

  async getPasskeyLoginOptions(email) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys/login/options`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      return await res.json();
    } catch (e) {
      console.error('getPasskeyLoginOptions error:', e);
      return { success: false, message: 'Network error getting passkey login options' };
    }
  },

  async verifyPasskeyLogin(response) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys/login/verify`, {
        method: 'POST',
        body: JSON.stringify({ response })
      });
      const data = await res.json();
      if (data && data.success && data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (e) {
      console.error('verifyPasskeyLogin error:', e);
      return { success: false, message: 'Network error during passkey login' };
    }
  },

  async getPasskeys() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys`);
      return await res.json();
    } catch (e) {
      console.error('getPasskeys error:', e);
      return { success: false, passkeys: [] };
    }
  },

  async deletePasskey(id, { currentPassword, secondFactorCode }) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/passkeys/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ currentPassword, secondFactorCode })
      });
      return await res.json();
    } catch (e) {
      console.error('deletePasskey error:', e);
      return { success: false, message: 'Network error removing passkey' };
    }
  },

  // --- SuperAdmin Security Email Binding APIs ---
  async getSecurityEmailStatus() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/superadmin/security-email/status`);
      return await res.json();
    } catch (e) {
      console.error('getSecurityEmailStatus error:', e);
      return { success: false };
    }
  },

  async sendSecurityEmailOtp() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/superadmin/security-email/send-otp`, {
        method: 'POST'
      });
      return await res.json();
    } catch (e) {
      console.error('sendSecurityEmailOtp error:', e);
      return { success: false, message: 'Network error sending OTP' };
    }
  },

  async verifySecurityEmailOtp(code) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/superadmin/security-email/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      return await res.json();
    } catch (e) {
      console.error('verifySecurityEmailOtp error:', e);
      return { success: false, message: 'Network error verifying OTP' };
    }
  },

  // --- SuperAdmin Passkey Account Recovery APIs ---
  async requestPasskeyRecovery(identifier) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/recovery/request`, {
        method: 'POST',
        body: JSON.stringify({ identifier })
      });
      return await res.json();
    } catch (e) {
      console.error('requestPasskeyRecovery error:', e);
      return { success: false, message: 'Network error requesting recovery' };
    }
  },

  async verifyPasskeyRecovery(token) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/recovery/verify`, {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data && data.success && data.recoverySessionToken) {
        setAuthToken(data.recoverySessionToken);
      }
      return data;
    } catch (e) {
      console.error('verifyPasskeyRecovery error:', e);
      return { success: false, message: 'Network error verifying recovery token' };
    }
  },

  async logout() {
    try {
      const currentToken = getAuthToken();
      let res;
      try {
        res = await this._fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}
        });
      } catch (fetchErr) {
        console.warn('Backend logout request encountered network error:', fetchErr.message);
      }

      setAuthToken(null);
      try {
        localStorage.removeItem('lumina_auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('jwt');
        localStorage.removeItem('lumina_current_user');
        sessionStorage.removeItem('lumina_selected_institution');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('jwt');
        sessionStorage.removeItem('lumina_auth_token');
      } catch {}

      return res ? await res.json() : { success: true };
    } catch (e) {
      console.error('Logout error:', e);
      return { success: false };
    }
  },

  async getProfile() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/profile`);
      let data = null;
      try {
        data = await res.json();
      } catch (_) {}

      // HTTP 304 Not Modified: Cached session is verified as active and valid on the server
      if (res.status === 304) {
        let cachedUser = null;
        try {
          cachedUser = JSON.parse(localStorage.getItem('lumina_current_user') || 'null');
        } catch (_) {}
        return {
          success: true,
          status: 304,
          user: cachedUser,
          cached: true
        };
      }

      if (res.ok) {
        return {
          success: true,
          status: res.status,
          user: data?.user || data,
          ...data
        };
      }

      return {
        success: false,
        status: res.status,
        isAuthError: res.status === 401,
        isForbidden: res.status === 403,
        isServerError: res.status >= 500,
        isNetworkError: false,
        message: data?.message || (res.status === 401 ? 'Session expired or invalid token' : `Request failed with status ${res.status}`)
      };
    } catch (e) {
      console.error('getProfile error:', e);
      return {
        success: false,
        status: 0,
        isAuthError: false,
        isServerError: false,
        isNetworkError: true,
        message: 'Network error fetching profile'
      };
    }
  },

  async updateStudentProfile(profileData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });
      return await res.json();
    } catch (e) {
      console.error('updateStudentProfile error:', e);
      return { success: false, message: 'Network error updating profile.' };
    }
  },

  async updateProfile(profileData) {
    return this.updateStudentProfile(profileData);
  },

  async getStudentsDataSheet(tenantId) {
    try {
      let url = `${API_BASE_URL}/students/datasheet`;
      if (tenantId) {
        const id = typeof tenantId === 'object' ? (tenantId.tenantId || tenantId.collegeId || tenantId._id || tenantId.id) : tenantId;
        if (id) {
          url += `?tenantId=${encodeURIComponent(id)}`;
        }
      }
      const res = await this._fetch(url);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch datasheet:', e);
      return null;
    }
  },

  async createStudent(studentData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students`, {
        method: 'POST',
        body: JSON.stringify(studentData),
      });
      return await res.json();
    } catch (e) {
      console.error('Create student error:', e);
      return { success: false };
    }
  },

  async updateStudent(studentId, updatedFields) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields),
      });
      return await res.json();
    } catch (e) {
      console.error('Update student error:', e);
      return { success: false };
    }
  },

  async deleteStudent(studentId, permanent = false) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}${permanent ? '?permanent=true' : ''}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, ...data };
      }

      // If standard student route returned 403 or 404, fallback to administrative endpoint /admin/students/:id
      if (res.status === 403 || res.status === 404) {
        const adminRes = await this._fetch(`${API_BASE_URL}/admin/students/${studentId}${permanent ? '?permanent=true' : ''}`, {
          method: 'DELETE',
        });
        const adminData = await adminRes.json().catch(() => ({}));
        if (adminRes.ok) {
          return { success: true, ...adminData };
        }
      }

      return { success: false, status: res.status, message: data?.message || `Failed to delete student (HTTP ${res.status})` };
    } catch (e) {
      console.error('Delete student error:', e);
      return { success: false, message: e.message };
    }
  },

  async bulkDeleteStudents(studentIds, permanent = false) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ studentIds, permanent })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, ...data };
      }
      return { success: false, status: res.status, message: data?.message || `Failed to delete students (HTTP ${res.status})` };
    } catch (e) {
      console.error('bulkDeleteStudents error:', e);
      return { success: false, message: e.message };
    }
  },

  async restoreStudent(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}/restore`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, ...data };
      }
      return { success: false, status: res.status, message: data?.message || 'Failed to restore student.' };
    } catch (e) {
      console.error('restoreStudent error:', e);
      return { success: false, message: e.message };
    }
  },

  async restoreAdminStudent(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/students/${studentId}/restore`, {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        return { success: true, ...data };
      }
      return { success: false, status: res.status, message: data?.message || 'Failed to restore student.' };
    } catch (e) {
      console.error('restoreAdminStudent error:', e);
      return { success: false, message: e.message };
    }
  },

  async getStudentDetail(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}`);
      return await res.json();
    } catch (e) {
      console.error('getStudentDetail error:', e);
      return { success: false, message: e.message };
    }
  },

  async changePassword(newPassword, confirmPassword, currentPassword = '', tokenOverride = null) {
    try {
      let token = tokenOverride || getAuthToken();
      if (!token) {
        try {
          const storedUser = JSON.parse(localStorage.getItem('lumina_current_user') || '{}');
          if (storedUser?.token) token = storedUser.token;
        } catch {}
      }
      if (token) {
        setAuthToken(token);
      }
      const headers = token ? {
        'Authorization': `Bearer ${token}`,
        'x-auth-token': token
      } : {};
      const res = await this._fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ newPassword, confirmPassword, currentPassword, token: token || undefined }),
      });
      const data = await res.json();
      if (data && data.success && data.token) {
        setAuthToken(data.token);
      }
      return data;
    } catch (e) {
      console.error('Change password error:', e);
      return { success: false, message: 'Network error during password change.' };
    }
  },

  async resetStudentPassword(studentId, newPassword) {
    try {
      const payload = newPassword ? { newPassword } : undefined;
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}/reset-password`, {
        method: 'POST',
        ...(payload ? { body: JSON.stringify(payload) } : {})
      });
      if (res.status === 404) {
        // Fallback to trainer route if student record is scoped under trainer endpoint
        const fallbackRes = await this._fetch(`${API_BASE_URL}/trainer/students/${studentId}/reset-password`, {
          method: 'POST',
          ...(payload ? { body: JSON.stringify(payload) } : {})
        });
        return await fallbackRes.json();
      }
      return await res.json();
    } catch (e) {
      console.error('Reset password error:', e);
      return { success: false, message: 'Network error during password reset.' };
    }
  },

  async resetPassword(studentId) {
    const res = await this.resetStudentPassword(studentId);
    return res.success ? (res.temporaryPassword || res.newPassword) : null;
  },
  
  async executeCode(language, code) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/execute`, {
        method: 'POST',
        body: JSON.stringify({
          language,
          files: [{ name: 'main', content: code }]
        })
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success && !data?.data?.run?.output?.includes('[Dev Notice')) {
        return data;
      }
      // If backend runner is unavailable (503 / ISOLATED_RUNNER_UNAVAILABLE / offline notice), fall back to browser sandbox
      const clientResult = await executeInBrowserSandbox(language, code);
      if (clientResult?.success) {
        return clientResult;
      }
      return data || { success: false, message: 'Execution runner unavailable.' };
    } catch (e) {
      console.warn('Backend execution unavailable, switching to browser sandbox:', e.message);
      const clientResult = await executeInBrowserSandbox(language, code);
      if (clientResult?.success) {
        return clientResult;
      }
      return { success: false, message: 'Network error during code execution.' };
    }
  },

  async executeCodeTest(language, code, functionName, testCases) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/execute/test`, {
        method: 'POST',
        body: JSON.stringify({
          language,
          code,
          functionName,
          testCases
        })
      });
      return await res.json();
    } catch (e) {
      console.error('Test execution error:', e);
      return { success: false, message: 'Network error during test execution.' };
    }
  },

  async getNotes(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.subject) params.append('subject', filters.subject);
      if (filters.batchId) params.append('batchId', filters.batchId);
      if (filters.category) params.append('category', filters.category);
      if (filters.resourceType) params.append('resourceType', filters.resourceType);
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await this._fetch(`${API_BASE_URL}/notes${queryStr}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch notes:', e);
      return null;
    }
  },

  async saveNote(noteData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/notes`, {
        method: 'POST',
        body: JSON.stringify(noteData),
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) {
      console.error('Failed to save note:', e);
      return null;
    }
  },

  async uploadNoteFile(formData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/notes/upload`, {
        method: 'POST',
        body: formData,
      });
      return await res.json();
    } catch (e) {
      console.error('Upload note file error:', e);
      return { success: false, error: 'Network error during upload' };
    }
  },

  async getNoteFileUrl(noteId, s3Key) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/notes/${noteId}/files/download?key=${encodeURIComponent(s3Key)}`);
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
      return null;
    } catch (e) {
      console.error('Get note file URL error:', e);
      return null;
    }
  },

  async deleteNote(noteId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/notes/${noteId}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e) {
      console.error('Delete note error:', e);
      return { success: false };
    }
  },

  async deleteNoteAttachment(noteId, s3Key) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/notes/${noteId}/files?key=${encodeURIComponent(s3Key)}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e) {
      console.error('Delete note attachment error:', e);
      return { success: false };
    }
  },

  async getStorageDownloadUrl(s3Key) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/storage/download?key=${encodeURIComponent(s3Key)}`);
      return await res.json();
    } catch (e) {
      console.error('getStorageDownloadUrl error:', e);
      return { success: false, message: 'Failed to request download URL.' };
    }
  },

  async getAuditLogs() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/audit/logs`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
      return null;
    }
  },

  async getCourses() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/data/courses`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch courses:', e);
      return null;
    }
  },

  async getAssignments() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/data/assignments`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch assignments:', e);
      return null;
    }
  },

  async getGrades() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/data/grades`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch grades:', e);
      return null;
    }
  },

  async startAssessment(assessmentId, durationMinutes) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/start`, {
        method: 'POST',
        body: JSON.stringify({ assessmentId, durationMinutes })
      });
      return await res.json();
    } catch (e) {
      console.error('startAssessment error:', e);
      return { success: false, message: 'Network error starting assessment' };
    }
  },

  async getAssessmentSession(assessmentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/${assessmentId}/session`);
      return await res.json();
    } catch (e) {
      console.error('getAssessmentSession error:', e);
      return { success: false, message: 'Network error checking assessment session' };
    }
  },

  async submitAssessment(assessmentId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/${assessmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('submitAssessment error:', e);
      return { success: false, message: 'Network error submitting assessment' };
    }
  },

  async getTrainerStudents(query = '') {
    try {
      const qs = query ? `?${query}` : '';
      const res = await this._fetch(`${API_BASE_URL}/trainer/students${qs}`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerStudents error:', e);
      return { success: false, students: [], message: 'Network error fetching trainer students' };
    }
  },

  async recordAssessmentEvent(assessmentId, eventPayload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/${assessmentId}/events`, {
        method: 'POST',
        body: JSON.stringify(eventPayload)
      });
      return await res.json();
    } catch (e) {
      console.warn('recordAssessmentEvent network note:', e);
      return { success: false, message: 'Network error logging assessment event' };
    }
  },

  async getActiveAssessmentMonitoring() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/active-monitoring`);
      return await res.json();
    } catch (e) {
      console.error('getActiveAssessmentMonitoring error:', e);
      return { success: false, activeSessions: [] };
    }
  },

  async getDetailedSubmissions(assessmentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/${assessmentId}/submissions-detailed`);
      return await res.json();
    } catch (e) {
      console.error('getDetailedSubmissions error:', e);
      return { success: false, submissions: [] };
    }
  },

  async getAssessmentEvents(assessmentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/assessments/${assessmentId}/events`);
      return await res.json();
    } catch (e) {
      console.error('getAssessmentEvents error:', e);
      return { success: false, events: [] };
    }
  },

  async getTeacherNote(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/teacher-notes/${studentId}`);
      return await res.json();
    } catch (e) {
      console.error('getTeacherNote error:', e);
      return { success: false, note: null };
    }
  },

  async saveTeacherNote(studentId, content) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/teacher-notes/${studentId}`, {
        method: 'PUT',
        body: JSON.stringify({ content })
      });
      return await res.json();
    } catch (e) {
      console.error('saveTeacherNote error:', e);
      return { success: false, message: 'Failed to persist teacher note' };
    }
  },

  async getSchoolSubjects() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/subjects`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolSubjects error:', e);
      return { success: false, subjects: [] };
    }
  },

  async getSchoolSubjectDetail(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/subjects/${id}`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolSubjectDetail error:', e);
      return { success: false, subject: null };
    }
  },

  async completeSchoolTopic(courseId, unitNumber, topicNumber, topicTitle) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/topics/complete`, {
        method: 'POST',
        body: JSON.stringify({ courseId, unitNumber, topicNumber, topicTitle })
      });
      return await res.json();
    } catch (e) {
      console.error('completeSchoolTopic error:', e);
      return { success: false, message: 'Network error completing topic' };
    }
  },

  async getSchoolHomework() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/homework`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolHomework error:', e);
      return { success: false, homework: [] };
    }
  },

  async submitSchoolHomework(assignmentId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/homework/${assignmentId}/submit`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('submitSchoolHomework error:', e);
      return { success: false, message: 'Network error submitting homework' };
    }
  },

  async getSchoolTests() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/tests`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolTests error:', e);
      return { success: false, tests: [] };
    }
  },

  async getSchoolAttendance() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/attendance`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolAttendance error:', e);
      return { success: false, attendance: null };
    }
  },

  async getSchoolResults() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/results`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolResults error:', e);
      return { success: false, results: [] };
    }
  },

  async updateCurrentTeachingTopic(courseId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/subjects/${courseId}/current-topic`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateCurrentTeachingTopic error:', e);
      return { success: false, message: 'Network error updating current topic' };
    }
  },

  async getTrainerCourses() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/courses`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerCourses error:', e);
      return { success: false, courses: [], subjects: [] };
    }
  },

  async createTrainerCourse(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/courses`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createTrainerCourse error:', e);
      return { success: false, message: 'Network error creating course' };
    }
  },

  async deleteTrainerCourse(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/courses/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteTrainerCourse error:', e);
      return { success: false, message: 'Network error deleting course' };
    }
  },

  async gradeSubmission(submissionId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/assignments/${submissionId}/grade`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('gradeSubmission error:', e);
      return { success: false, message: 'Network error recording grade' };
    }
  },

  async getTrainerClasses() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/classes`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerClasses error:', e);
      return { success: false, classes: [] };
    }
  },

  async getStudentDossier(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/students/${studentId}/dossier`);
      return await res.json();
    } catch (e) {
      console.error('getStudentDossier error:', e);
      return { success: false, message: 'Network error retrieving student dossier' };
    }
  },

  async getTrainerTests() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/tests`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerTests error:', e);
      return { success: false, tests: [] };
    }
  },

  async scheduleAssessment(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/tests`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('scheduleAssessment error:', e);
      return { success: false, message: 'Network error scheduling assessment' };
    }
  },

  async assignTrainerTest(testId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/tests/${testId}/assign`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('assignTrainerTest error:', e);
      return { success: false, message: 'Network error assigning assessment' };
    }
  },

  async getTrainerCalendarEvents() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/calendar/events`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerCalendarEvents error:', e);
      return { success: false, events: [] };
    }
  },

  async createTrainerCalendarEvent(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/calendar/events`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createTrainerCalendarEvent error:', e);
      return { success: false, message: 'Network error scheduling academic event' };
    }
  },

  async updateTrainerCalendarEvent(id, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/calendar/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateTrainerCalendarEvent error:', e);
      return { success: false, message: 'Network error updating academic event' };
    }
  },

  async cancelTrainerCalendarEvent(id, cancellationReason) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/calendar/events/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ cancellationReason })
      });
      return await res.json();
    } catch (e) {
      console.error('cancelTrainerCalendarEvent error:', e);
      return { success: false, message: 'Network error cancelling academic event' };
    }
  },

  async deleteTrainerCalendarEvent(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/calendar/events/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteTrainerCalendarEvent error:', e);
      return { success: false, message: 'Network error deleting academic event' };
    }
  },

  async getSchoolCalendarEvents() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/calendar/events`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolCalendarEvents error:', e);
      return { success: false, events: [] };
    }
  },

  // ─── Announcements Endpoints (Phase 3) ──────────────────────────────────
  async getSchoolAnnouncements() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/announcements`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolAnnouncements error:', e);
      return { success: false, announcements: [] };
    }
  },

  async getSchoolAnnouncementDetail(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/announcements/${id}`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolAnnouncementDetail error:', e);
      return { success: false, announcement: null };
    }
  },

  async getTrainerAnnouncements(params) {
    try {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      const res = await this._fetch(`${API_BASE_URL}/trainer/announcements${qs}`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerAnnouncements error:', e);
      return { success: false, announcements: [] };
    }
  },

  async createAnnouncement(data) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/announcements`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.error('createAnnouncement error:', e);
      return { success: false, message: 'Network error creating announcement' };
    }
  },

  async updateAnnouncement(id, data) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/announcements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAnnouncement error:', e);
      return { success: false, message: 'Network error updating announcement' };
    }
  },

  async updateAnnouncementStatus(id, status) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/announcements/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return await res.json();
    } catch (e) {
      console.error('updateAnnouncementStatus error:', e);
      return { success: false, message: 'Network error updating announcement status' };
    }
  },

  async deleteAnnouncement(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/announcements/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAnnouncement error:', e);
      return { success: false, message: 'Network error deleting announcement' };
    }
  },

  // Announcement Aliases for Trainer Sections
  async createTrainerAnnouncement(data) {
    return this.createAnnouncement(data);
  },

  async updateTrainerAnnouncement(id, data) {
    return this.updateAnnouncement(id, data);
  },

  async updateTrainerAnnouncementStatus(id, status) {
    return this.updateAnnouncementStatus(id, status);
  },

  async deleteTrainerAnnouncement(id) {
    return this.deleteAnnouncement(id);
  },

  // ─── Student Doubts & Academic Contacts (Phase 4) ──────────────────────
  async getSchoolAcademicContacts() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/academic-contacts`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolAcademicContacts error:', e);
      return { success: false, configured: false, contacts: null };
    }
  },

  async getStudentDoubts() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/doubts`);
      return await res.json();
    } catch (e) {
      console.error('getStudentDoubts error:', e);
      return { success: false, doubts: [] };
    }
  },

  async submitStudentDoubt(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/school/doubts`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('submitStudentDoubt error:', e);
      return { success: false, message: 'Network error submitting question' };
    }
  },

  async getTrainerDoubts() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/doubts`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerDoubts error:', e);
      return { success: false, doubts: [] };
    }
  },

  async replyTrainerDoubt(id, replyText) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/doubts/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply: replyText })
      });
      return await res.json();
    } catch (e) {
      console.error('replyTrainerDoubt error:', e);
      return { success: false, message: 'Network error submitting reply' };
    }
  },

  // ─── Homework Endpoints (Phase 2) ────────────────────────────────────────
  async getTrainerHomework() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerHomework error:', e);
      return { success: false, assignments: [] };
    }
  },

  async createTrainerHomework(data) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.error('createTrainerHomework error:', e);
      return { success: false, message: 'Network error publishing homework' };
    }
  },

  async updateTrainerHomework(id, data) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
      console.error('updateTrainerHomework error:', e);
      return { success: false, message: 'Network error updating homework' };
    }
  },

  async archiveTrainerHomework(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('archiveTrainerHomework error:', e);
      return { success: false, message: 'Network error archiving homework' };
    }
  },

  // ─── Storage Endpoints (Phase 5) ─────────────────────────────────────────
  async getStorageStatus() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/storage/status`);
      return await res.json();
    } catch (e) {
      return { success: false, configured: false };
    }
  },

  async uploadStorageFile(file, folder = 'general') {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch(`${API_BASE_URL}/storage/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return await res.json();
    } catch (e) {
      console.error('uploadStorageFile error:', e);
      return { success: false, message: 'Network error during file upload' };
    }
  },

  // ─── Admin Endpoints (6th Civilians Corporation Governance) ────────────────
  async getAdminOverview() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/overview`);
      return await res.json();
    } catch (e) {
      console.error('getAdminOverview error:', e);
      return { success: false, message: 'Network error fetching admin overview' };
    }
  },

  async getAdminBatches() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/batches`);
      return await res.json();
    } catch (e) {
      console.error('getAdminBatches error:', e);
      return { success: false, batches: [] };
    }
  },

  async createAdminBatch(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/batches`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminBatch error:', e);
      return { success: false, message: 'Network error creating batch' };
    }
  },

  async deleteAdminBatch(id, force = false) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/batches/${id}${force ? '?force=true' : ''}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminBatch error:', e);
      return { success: false, message: 'Network error deleting batch' };
    }
  },

  async getAdminTrainers() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers`);
      return await res.json();
    } catch (e) {
      console.error('getAdminTrainers error:', e);
      return { success: false, trainers: [] };
    }
  },

  async createAdminTrainer(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminTrainer error:', e);
      return { success: false, message: 'Network error provisioning trainer' };
    }
  },

  async getAdminTrainerDetail(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers/${id}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminTrainerDetail error:', e);
      return { success: false, message: 'Network error fetching trainer details' };
    }
  },

  async updateAdminTrainer(id, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAdminTrainer error:', e);
      return { success: false, message: 'Network error updating trainer' };
    }
  },

  async deleteAdminTrainer(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminTrainer error:', e);
      return { success: false, message: 'Network error deactivating trainer' };
    }
  },

  async reassignAdminTrainer(id, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers/${id}/reassign`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('reassignAdminTrainer error:', e);
      return { success: false, message: 'Network error reassigning trainer' };
    }
  },

  async getTrainerAnalytics() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/analytics`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerAnalytics error:', e);
      return { success: false, message: 'Network error fetching trainer analytics' };
    }
  },

  async getTrainerSubmissions() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/submissions`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerSubmissions error:', e);
      return { success: false, submissions: [] };
    }
  },

  async gradeTrainerSubmission(submissionId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/assignments/${submissionId}/grade`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('gradeTrainerSubmission error:', e);
      return { success: false, message: 'Network error grading submission' };
    }
  },

  async getAdminInstitutions() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/institutions`);
      return await res.json();
    } catch (e) {
      console.error('getAdminInstitutions error:', e);
      return { success: false, institutions: [] };
    }
  },

  async getAdminAdministrators() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/administrators`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAdministrators error:', e);
      return { success: false, administrators: [] };
    }
  },

  async getAdminCourses() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/courses`);
      return await res.json();
    } catch (e) {
      console.error('getAdminCourses error:', e);
      return { success: false, courses: [] };
    }
  },

  async getAdminAuditLogs(params = {}) {
    try {
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
      );
      const query = new URLSearchParams(cleanParams).toString();
      const res = await this._fetch(`${API_BASE_URL}/admin/audit-logs${query ? `?${query}` : ''}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAuditLogs error:', e);
      return { success: false, logs: [] };
    }
  },

  async getSecurityPolicies() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/security-policies`);
      return await res.json();
    } catch (e) {
      console.error('getSecurityPolicies error:', e);
      return { success: false, message: 'Network error loading security policies' };
    }
  },

  async updateSecurityPolicies(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/security-policies`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateSecurityPolicies error:', e);
      return { success: false, message: 'Network error updating security policies' };
    }
  },

  async getAdminInstitutionProfile(tenantId) {
    try {
      const url = tenantId 
        ? `${API_BASE_URL}/admin/institution-profile?tenantId=${tenantId}`
        : `${API_BASE_URL}/admin/institution-profile`;
      const res = await this._fetch(url);
      return await res.json();
    } catch (e) {
      console.error('getAdminInstitutionProfile error:', e);
      return { success: false, message: 'Network error loading institution profile' };
    }
  },

  async getAdminAnalytics() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/analytics`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAnalytics error:', e);
      return { success: false, message: 'Network error fetching admin analytics' };
    }
  },

  // ─── Company Operations (Courses, Institutions & Operations) ───────────────
  async createAdminCourse(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/courses`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminCourse error:', e);
      return { success: false, message: 'Network error creating course' };
    }
  },

  async updateAdminCourse(id, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/courses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAdminCourse error:', e);
      return { success: false, message: 'Network error updating course' };
    }
  },

  async deleteAdminCourse(id, force = false) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/courses/${id}${force ? '?force=true' : ''}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminCourse error:', e);
      return { success: false, message: 'Network error deleting course' };
    }
  },

  async createAdminInstitution(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/institutions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminInstitution error:', e);
      return { success: false, message: 'Network error creating institution' };
    }
  },

  async updateAdminInstitution(id, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/institutions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAdminInstitution error:', e);
      return { success: false, message: 'Network error updating institution' };
    }
  },

  async getAdminInstitutionDetail(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/institutions/${id}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminInstitutionDetail error:', e);
      return { success: false, message: 'Network error fetching institution detail' };
    }
  },

  async getAdminAttendanceStats() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/attendance-stats`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAttendanceStats error:', e);
      return { success: false, message: 'Network error fetching attendance stats' };
    }
  },

  async getAdminAcademicOps() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/academic-ops`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAcademicOps error:', e);
      return { success: false, message: 'Network error fetching academic operations' };
    }
  },

  async getAdminIncompleteProfiles() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/incomplete-profiles`);
      return await res.json();
    } catch (e) {
      console.error('getAdminIncompleteProfiles error:', e);
      return { success: false, message: 'Network error fetching profile completion report' };
    }
  },

  async getAdminStudents() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/students`);
      return await res.json();
    } catch (e) {
      console.error('getAdminStudents error:', e);
      return { success: false, count: 0, students: [] };
    }
  },

  async createAdminStudent(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/students`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminStudent error:', e);
      return { success: false, message: 'Network error provisioning student' };
    }
  },

  async deleteAdminStudent(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/students/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminStudent error:', e);
      return { success: false, message: 'Network error deactivating student' };
    }
  },

  async getAdminAnnouncements() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/announcements`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAnnouncements error:', e);
      return { success: false, count: 0, announcements: [] };
    }
  },

  async createAdminAnnouncement(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/announcements`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminAnnouncement error:', e);
      return { success: false, message: 'Network error publishing announcement' };
    }
  },

  async deleteAdminAnnouncement(id) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/announcements/${id}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminAnnouncement error:', e);
      return { success: false, message: 'Network error deleting announcement' };
    }
  },

  async getAdminDoubts() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/doubts`);
      return await res.json();
    } catch (e) {
      console.error('getAdminDoubts error:', e);
      return { success: false, count: 0, doubts: [] };
    }
  },

  async replyAdminDoubt(id, replyText) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/doubts/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply: replyText })
      });
      return await res.json();
    } catch (e) {
      console.error('replyAdminDoubt error:', e);
      return { success: false, message: 'Network error sending reply' };
    }
  },

  // =========================================================================
  // MULTI-SCHOOL PLATFORM & LEADERBOARD SERVICES
  // =========================================================================

  async getSchoolLeaderboard(params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await this._fetch(`${API_BASE_URL}/school/leaderboard${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (e) {
      console.error('getSchoolLeaderboard error:', e);
      return { success: false, leaderboard: [], count: 0 };
    }
  },

  async getAdminSchools() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchools error:', e);
      return { success: false, schools: [], count: 0, code: 'FETCH_FAILED', message: e.message || 'Failed to fetch schools' };
    }
  },

  async getAdminSchoolDetail(schoolId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolDetail error:', e);
      return { success: false, message: 'Failed to retrieve school details' };
    }
  },

  async createAdminSchool(schoolData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools`, {
        method: 'POST',
        body: JSON.stringify(schoolData)
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await res.json();
      }
      const text = await res.text();
      return { success: res.ok, message: text || `Server returned HTTP ${res.status}` };
    } catch (e) {
      console.error('createAdminSchool error:', e);
      return { success: false, message: e.message || 'Network error registering school' };
    }
  },

  async createAdminSchoolCohort(schoolId, cohortData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/cohorts`, {
        method: 'POST',
        body: JSON.stringify(cohortData)
      });
      return await res.json();
    } catch (e) {
      console.error('createAdminSchoolCohort error:', e);
      return { success: false, message: 'Network error creating training cohort' };
    }
  },

  async updateAdminSchoolCohort(schoolId, cohortId, cohortData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/cohorts/${cohortId}`, {
        method: 'PUT',
        body: JSON.stringify(cohortData)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAdminSchoolCohort error:', e);
      return { success: false, message: 'Network error updating cohort' };
    }
  },

  async assignAdminSchoolMembers(schoolId, payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/assign`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('assignAdminSchoolMembers error:', e);
      return { success: false, message: 'Network error assigning members' };
    }
  },

  async getAdminSchoolsComparison() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/comparison`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolsComparison error:', e);
      return { success: false, comparison: [], count: 0 };
    }
  },

  async getAdminSchoolLeaderboard(schoolId, params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/leaderboard${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolLeaderboard error:', e);
      return { success: false, leaderboard: [], count: 0 };
    }
  },

  async getAdminSchoolPerformance(schoolId, params = {}) {
    try {
      const q = new URLSearchParams(params).toString();
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/performance${q ? `?${q}` : ''}`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolPerformance error:', e);
      return { success: false, message: 'Failed to retrieve school performance report' };
    }
  },

  async assignAdminSchoolContent(schoolId, contentData) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/assign-content`, {
        method: 'POST',
        body: JSON.stringify(contentData)
      });
      return await res.json();
    } catch (e) {
      console.error('assignAdminSchoolContent error:', e);
      return { success: false, message: 'Network error assigning cohort content' };
    }
  },

  async getAdminSchoolAcademicConfig(schoolId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/academic-config`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolAcademicConfig error:', e);
      return { success: false, message: e.message };
    }
  },

  async updateAdminSchoolAcademicConfig(schoolId, config) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/academic-config`, {
        method: 'PUT',
        body: JSON.stringify(config)
      });
      return await res.json();
    } catch (e) {
      console.error('updateAdminSchoolAcademicConfig error:', e);
      return { success: false, message: e.message };
    }
  },

  async archiveAdminSchool(schoolId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/archive`, {
        method: 'POST'
      });
      return await res.json();
    } catch (e) {
      console.error('archiveAdminSchool error:', e);
      return { success: false, message: e.message };
    }
  },

  async restoreAdminSchool(schoolId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/restore`, {
        method: 'POST'
      });
      return await res.json();
    } catch (e) {
      console.error('restoreAdminSchool error:', e);
      return { success: false, message: e.message };
    }
  },

  async getAdminSchoolPreDeleteInspection(schoolId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}/pre-delete-inspection`);
      return await res.json();
    } catch (e) {
      console.error('getAdminSchoolPreDeleteInspection error:', e);
      return { success: false, message: e.message };
    }
  },

  async deleteAdminSchool(schoolId, confirmationCode) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/schools/${schoolId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmationCode })
      });
      return await res.json();
    } catch (e) {
      console.error('deleteAdminSchool error:', e);
      return { success: false, message: e.message };
    }
  }
};


