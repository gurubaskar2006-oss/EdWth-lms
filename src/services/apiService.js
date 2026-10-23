const BACKEND_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : '').replace(/\/$/, '');
const API_BASE_URL = `${BACKEND_URL}/api/v1`;

let sessionExpiredDebounce = 0;

export const apiService = {
  // Use credentials to send httpOnly cookies automatically and include Bearer token
  _fetch: async (url, options = {}) => {
    const token = localStorage.getItem('lumina_auth_token');
    const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...options.headers,
      }
    });

    if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/students/datasheet')) {
      const isUserCached = !!localStorage.getItem('lumina_current_user');
      const hasToken = !!localStorage.getItem('lumina_auth_token');
      const now = Date.now();
      // Only dispatch session expired if the user was actively authenticated with a token and throttle by 5 seconds
      if (isUserCached && hasToken && now - sessionExpiredDebounce > 5000) {
        sessionExpiredDebounce = now;
        window.dispatchEvent(new CustomEvent('lms_session_expired'));
      }
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
        localStorage.setItem('lumina_auth_token', data.token);
      }
      return data;
    } catch (e) {
      console.error('Login error:', e);
      return { success: false, error: 'Network error during login' };
    }
  },

  async setup2FA() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/2fa/setup`, { method: 'POST' });
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
      if (data && data.success && data.token) {
        localStorage.setItem('lumina_auth_token', data.token);
      }
      return data;
    } catch (e) {
      console.error('Verify 2FA error:', e);
      return { success: false, message: 'Network error' };
    }
  },

  async logout() {
    try {
      localStorage.removeItem('lumina_auth_token');
      const res = await this._fetch(`${API_BASE_URL}/auth/logout`, { method: 'POST' });
      return await res.json();
    } catch (e) {
      console.error('Logout error:', e);
      return { success: false };
    }
  },

  async getProfile() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/profile`);
      if (res.ok) {
        return await res.json();
      }
      return await res.json().catch(() => ({ success: false, message: 'Failed to fetch student profile.' }));
    } catch (e) {
      console.error('getProfile error:', e);
      return { success: false, message: 'Network error fetching profile.' };
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

  async getStudentsDataSheet() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/datasheet`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch (e) {
      console.error('Failed to fetch datasheet:', e);
      return null;
    }
  },

  async getTrainerStudents() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/students`);
      return await res.json();
    } catch (e) {
      console.error('Failed to fetch trainer students:', e);
      return { success: false, students: [] };
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

  async deleteStudent(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}`, {
        method: 'DELETE',
      });
      return await res.json();
    } catch (e) {
      console.error('Delete student error:', e);
      return { success: false };
    }
  },

  async changePassword(newPassword, confirmPassword, currentPassword = '') {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword, confirmPassword, currentPassword }),
      });
      return await res.json();
    } catch (e) {
      console.error('Change password error:', e);
      return { success: false, message: 'Network error during password change.' };
    }
  },

  async resetStudentPassword(studentId) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/students/${studentId}/reset-password`, {
        method: 'POST',
      });
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
      return await res.json();
    } catch (e) {
      console.error('Execution error:', e);
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
      const headers = {};
      const token = localStorage.getItem('lumina_auth_token') || localStorage.getItem('token') || localStorage.getItem('jwt');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // For FormData, omit Content-Type so browser sets boundary
      const res = await fetch(`${API_BASE_URL}/notes/upload`, {
        method: 'POST',
        credentials: 'include',
        headers,
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
      return { success: false, message: 'Network error fetching trainer students' };
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

  async getTrainerHomework() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework`);
      return await res.json();
    } catch (e) {
      console.error('getTrainerHomework error:', e);
      return { success: false, assignments: [] };
    }
  },

  async createTrainerHomework(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/homework`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('createTrainerHomework error:', e);
      return { success: false, message: 'Network error publishing homework' };
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

  async getTrainerAnalytics() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/trainer/analytics`);
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.message) msg = body.message;
        } catch (_) {}
        throw new Error(msg);
      }
      return await res.json();
    } catch (e) {
      console.error('getTrainerAnalytics error:', e);
      throw e;
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

  async getStorageDownloadUrl(s3Key) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/storage/download?key=${encodeURIComponent(s3Key)}`);
      return await res.json();
    } catch (e) {
      console.error('getStorageDownloadUrl error:', e);
      return { success: false, message: 'Network error retrieving download link' };
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

  async getAdminTrainers() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/trainers`);
      return await res.json();
    } catch (e) {
      console.error('getAdminTrainers error:', e);
      return { success: false, trainers: [] };
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

  async getAdminAuditLogs() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/admin/audit-logs`);
      return await res.json();
    } catch (e) {
      console.error('getAdminAuditLogs error:', e);
      return { success: false, logs: [] };
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

  // ─── Student Profile Self-Service ──────────────────────────────────────────
  async getProfile() {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/profile`);
      return await res.json();
    } catch (e) {
      console.error('getProfile error:', e);
      return { success: false, message: 'Network error fetching profile' };
    }
  },

  async updateStudentProfile(payload) {
    try {
      const res = await this._fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.error('updateStudentProfile error:', e);
      return { success: false, message: 'Network error saving student profile' };
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
      return { success: false, schools: [], count: 0 };
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
      return await res.json();
    } catch (e) {
      console.error('createAdminSchool error:', e);
      return { success: false, message: 'Network error registering school' };
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
  }
};


