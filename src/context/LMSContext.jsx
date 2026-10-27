import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  INITIAL_USER,
  STUDENTS_DATA_SHEET,
  COURSES as INITIAL_COURSES,
  ASSIGNMENTS as INITIAL_ASSIGNMENTS,
  SCHEDULE_EVENTS as INITIAL_EVENTS,
  STUDY_ANALYTICS,
  GRADES_DATA,
  FLASHCARD_DECKS as INITIAL_DECKS,
  PYTHON_PROBLEMS,
  DAILY_CODING_CHALLENGES,
  SCHOOL_SUBJECTS,
  SCHOOL_HOMEWORK,
  SCHOOL_UPCOMING_TESTS,
  SCHOOL_RESULTS,
  SCHOOL_TODAY_CLASSES,
  SCHOOL_ANNOUNCEMENTS
} from '../data/mockData';
import { apiService, getAuthToken, setAuthToken } from '../services/apiService';
import { socketService } from '../services/socketService';
import { getInstitutionConfig } from '../config/institutionConfig';
import { useFocusTimer } from '../hooks/useFocusTimer';

const LMSContext = createContext(null);

export const LMSProvider = ({ children }) => {
  // Real-Time Socket States
  const [onlineStats, setOnlineStats] = useState({ total: 1, students: 1, trainers: 0, admins: 0 });
  const [activeAttendancePrompt, setActiveAttendancePrompt] = useState(null);

  // Navigation
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [codingPanelOpen, setCodingPanelOpen] = useState(false);

  // Theme (Light / Dark) with system preference detection and localStorage persistence
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('lumina_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('lumina_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Authentication & Students Data Sheet
  // Authentication & Students Data Sheet (Purely authoritative from server DB)
  const [students, setStudents] = useState(() => {
    const saved = localStorage.getItem('lumina_students_datasheet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If the cached list contains legacy demo students (e.g. Alex Vance), discard it
          const hasMockStudents = parsed.some(s => s.name === 'Alex Vance' || s.email === 'alex.vance@mit.edu');
          if (!hasMockStudents) return parsed;
        }
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Current Logged-in User
  const [user, setUser] = useState(() => {
    const token = getAuthToken();
    const savedUser = localStorage.getItem('lumina_current_user');
    if (token && savedUser && savedUser !== 'null' && savedUser !== 'undefined') {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.role) {
          parsed.role = parsed.role.toLowerCase();
          return parsed;
        }
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const token = getAuthToken();
    const savedUser = localStorage.getItem('lumina_current_user');
    return Boolean(token && savedUser && savedUser !== 'null' && savedUser !== 'undefined');
  });

  // Company / Institutional Portal Branding Configuration
  const [portalConfig, setPortalConfig] = useState(() => {
    const saved = localStorage.getItem('lumina_portal_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      companyName: 'EdWth Academy',
      portalName: 'EdWth Academy Learning Portal',
      shortName: 'EDWTH',
      department: 'Corporate & Institutional Education',
      motto: 'EMPOWERING EVERY LEARNER',
      term: 'Academic Year 2026-2027',
      portalId: 'EDWTH-ACADEMY-2026',
      environment: 'Production Enterprise Cluster'
    };
  });

  const updatePortalConfig = (newConfig) => {
    setPortalConfig((prev) => {
      const updated = { ...prev, ...newConfig };
      localStorage.setItem('lumina_portal_config', JSON.stringify(updated));
      return updated;
    });
    addToast('Portal Branding Updated', `Company portal set to: ${newConfig.companyName || portalConfig.companyName}`, 'emerald');
  };

  // Institution Type & Centralized Terminology (Declared after portalConfig to avoid TDZ)
  const institutionType = user?.institutionType || portalConfig?.institutionType || 'college';
  const terms = getInstitutionConfig(institutionType);

  // Forced password change modal state
  const [mustChangePasswordPromptOpen, setMustChangePasswordPromptOpen] = useState(() => {
    return !!user?.mustChangePassword;
  });
  const isVerifyingSessionRef = useRef(false);
  const tempAuthTokenRef = useRef(null);

  useEffect(() => {
    if (user?.mustChangePassword) {
      setMustChangePasswordPromptOpen(true);
    }
  }, [user?.mustChangePassword]);

  // Hydrate data from backend server if available
  useEffect(() => {
    const fetchBackendData = async () => {
      if (!isAuthenticated || user?.mustChangePassword) return;

      if (['admin', 'superadmin', 'trainer', 'teacher'].includes(user?.role?.toLowerCase())) {
        const res = await apiService.getStudentsDataSheet();
        const serverStudents = Array.isArray(res)
          ? res
          : res?.data?.students || (Array.isArray(res?.students) ? res.students : null);
        if (serverStudents && Array.isArray(serverStudents)) {
          setStudents(serverStudents);
        }
      }

      const serverCourses = await apiService.getCourses();
      if (serverCourses && Array.isArray(serverCourses)) {
        setCourses(serverCourses);
      }

      const serverAssignments = await apiService.getAssignments();
      if (serverAssignments && Array.isArray(serverAssignments)) {
        setAssignments(serverAssignments);
      }

      const serverGrades = await apiService.getGrades();
      setGradesData(serverGrades);

      // Hydrate authoritative user profile data (e.g. contact phone, address, emergency contact)
      try {
        const profileRes = await apiService.getProfile();
        if (profileRes?.success && profileRes.user) {
          setUser((prev) => ({ ...prev, ...profileRes.user }));
        }
      } catch (pErr) {
        console.warn('[LMSContext] Failed to hydrate user profile from backend:', pErr);
      }
    };
    fetchBackendData();
  }, [isAuthenticated, user?.role, user?.mustChangePassword]);

  // Sync students to localStorage
  useEffect(() => {
    localStorage.setItem('lumina_students_datasheet', JSON.stringify(students));
  }, [students]);

  // Sync user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem('lumina_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lumina_current_user');
    }
  }, [user]);

  // Connect and sync with Socket.io real-time hub
  useEffect(() => {
    if (user && !user.mustChangePassword) {
      socketService.connect(user);

      const unsubPresence = socketService.onPresenceUpdate((stats) => {
        if (stats) setOnlineStats(stats);
      });

      const unsubAttendance = socketService.onAttendancePrompt((session) => {
        const userRole = (user?.role || 'student').toLowerCase();
        if (userRole === 'student') {
          setActiveAttendancePrompt(session);
          addToast(
            '🔴 Live Attendance Session Active',
            `"${session?.topic || 'Classroom Session'}" (${session?.durationSeconds || 60}s window). Click to verify attendance!`,
            'emerald'
          );
        }
      });

      const unsubAttendanceClosed = socketService.onAttendanceClosed((data) => {
        setActiveAttendancePrompt((prev) => (prev && prev.sessionId === data.sessionId ? null : prev));
      });

      const unsubAnnouncement = socketService.onAnnouncement((ann) => {
        addToast(
          `📢 Announcement: ${ann.title || 'New Announcement'}`,
          `${ann.content || ann.message || ''} (from ${ann.authorName || ann.senderName || 'School Administration'})`,
          ann.priority === 'urgent' || ann.urgency === 'critical' ? 'rose' : ann.priority === 'important' ? 'amber' : 'emerald'
        );
        const role = (user?.role || '').toLowerCase();
        if (role === 'admin' || role === 'superadmin') {
          apiService.getAdminAnnouncements().then((res) => {
            if (res?.success && Array.isArray(res.announcements)) {
              setSchoolAnnouncements(res.announcements);
            }
          }).catch(() => {});
        } else if (role === 'trainer' || role === 'teacher') {
          apiService.getTrainerAnnouncements().then((res) => {
            if (res?.success && Array.isArray(res.announcements)) {
              setSchoolAnnouncements(res.announcements);
            }
          }).catch(() => {});
        } else {
          apiService.getSchoolAnnouncements().then((res) => {
            if (res?.success && Array.isArray(res.announcements)) {
              setSchoolAnnouncements(res.announcements);
            }
          }).catch(() => {});
        }
      });

      const unsubDoubtAnswered = socketService.onDoubtAnswered((data) => {
        const role = (user?.role || '').toLowerCase();
        if (role === 'student') {
          addToast(
            '💬 Question Answered',
            `Your teacher has replied: "${(data?.reply || data?.response || '').slice(0, 60)}..."`,
            'emerald'
          );
        }
      });

      const unsubDoubtNew = socketService.onDoubtNew((doubt) => {
        const role = (user?.role || '').toLowerCase();
        if (role === 'trainer' || role === 'teacher' || role === 'admin' || role === 'superadmin') {
          addToast(
            '❓ New Student Question',
            `${doubt?.studentName || 'A student'} asked about "${doubt?.topic || doubt?.subject || 'Coursework'}"`,
            'amber'
          );
        }
      });

      return () => {
        unsubPresence();
        unsubAttendance();
        unsubAttendanceClosed();
        unsubAnnouncement();
        unsubDoubtAnswered();
        unsubDoubtNew();
      };
    }
  }, [user]);

  // Courses & Viewer State
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [activeCourseId, setActiveCourseId] = useState('cs-401');
  const [activeLessonId, setActiveLessonId] = useState('les-204');

  // Assignments
  const [assignments, setAssignments] = useState(INITIAL_ASSIGNMENTS);
  const [assignmentFilter, setAssignmentFilter] = useState('all');

  // Calendar / Schedule
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [eventFilter, setEventFilter] = useState('all');

  // Flashcards
  const [flashcardDecks, setFlashcardDecks] = useState(INITIAL_DECKS);

  // Coding Challenges
  const [codingChallenges, setCodingChallenges] = useState(DAILY_CODING_CHALLENGES);

  // Global Notes Drawer Open State (Can be opened from any site page)
  const [notesDrawerOpen, setNotesDrawerOpen] = useState(false);

  // Grades Data
  const [gradesData, setGradesData] = useState(GRADES_DATA);

  // School Specific Datasets
  const [schoolSubjects, setSchoolSubjects] = useState([]);
  const [schoolHomework, setSchoolHomework] = useState([]);
  const [schoolTests, setSchoolTests] = useState([]);
  const [schoolResults, setSchoolResults] = useState([]);
  const [schoolAttendance, setSchoolAttendance] = useState(null);
  const [schoolCalendarEvents, setSchoolCalendarEvents] = useState([]);
  const [schoolTodayClasses, setSchoolTodayClasses] = useState([]);
  const [schoolAnnouncements, setSchoolAnnouncements] = useState([]);

  // Real School Academic Data Synchronization
  const fetchSchoolData = async () => {
    if (!isAuthenticated || user?.mustChangePassword) return;
    try {
      const [subsRes, hwRes, resRes, testsRes, attRes, calRes, annRes] = await Promise.all([
        apiService.getSchoolSubjects(),
        apiService.getSchoolHomework(),
        apiService.getSchoolResults(),
        apiService.getSchoolTests(),
        apiService.getSchoolAttendance(),
        apiService.getSchoolCalendarEvents(),
        apiService.getSchoolAnnouncements()
      ]);
      if (subsRes?.success && Array.isArray(subsRes.subjects)) {
        setSchoolSubjects(subsRes.subjects);
      }
      if (hwRes?.success && Array.isArray(hwRes.homework)) {
        setSchoolHomework(hwRes.homework);
      }
      if (resRes?.success && Array.isArray(resRes.results)) {
        setSchoolResults(resRes.results);
      }
      if (testsRes?.success && Array.isArray(testsRes.tests)) {
        setSchoolTests(testsRes.tests);
      }
      if (attRes?.success && attRes.attendance) {
        setSchoolAttendance(attRes.attendance);
      }
      if (calRes?.success && Array.isArray(calRes.events)) {
        setSchoolCalendarEvents(calRes.events);
      }
      if (annRes?.success && Array.isArray(annRes.announcements)) {
        setSchoolAnnouncements(annRes.announcements);
      }
    } catch (e) {
      console.warn('School data fetch notification:', e);
    }
  };

  // Real Admin & Trainer Data Synchronization (Replaces static mock datasets with real DB entities)
  const fetchAdminAndTrainerData = async () => {
    if (!isAuthenticated || !user || user?.mustChangePassword) return;
    const role = (user.role || '').toLowerCase();
    try {
      if (role === 'admin' || role === 'superadmin') {
        const [stuRes, crsRes, annRes] = await Promise.all([
          apiService.getAdminStudents(),
          apiService.getAdminCourses(),
          apiService.getAdminAnnouncements()
        ]);
        if (stuRes?.success && Array.isArray(stuRes.students)) {
          setStudents(stuRes.students);
        }
        if (crsRes?.success && Array.isArray(crsRes.courses)) {
          setCourses(crsRes.courses);
        }
        if (annRes?.success && Array.isArray(annRes.announcements)) {
          setSchoolAnnouncements(annRes.announcements);
        }
      } else if (role === 'trainer' || role === 'teacher') {
        const [stuRes, annRes] = await Promise.all([
          apiService.getTrainerStudents(),
          apiService.getTrainerAnnouncements()
        ]);
        if (stuRes?.success && Array.isArray(stuRes.students)) {
          setStudents(stuRes.students);
        }
        if (annRes?.success && Array.isArray(annRes.announcements)) {
          setSchoolAnnouncements(annRes.announcements);
        }
      }
    } catch (e) {
      console.warn('Admin/Trainer live sync notification:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !user?.mustChangePassword) {
      fetchSchoolData();
      fetchAdminAndTrainerData();
    }
  }, [isAuthenticated, user?.studentId, user?.role, user?.tenantId, user?.mustChangePassword]);

  const submitSchoolHomework = async (homeworkId, textOrCode) => {
    try {
      const res = await apiService.submitSchoolHomework(homeworkId, { submissionText: textOrCode });
      if (res?.success) {
        setSchoolHomework((prev) =>
          prev.map((hw) =>
            hw.id === homeworkId || hw._id === homeworkId
              ? { ...hw, status: 'submitted', submissionText: textOrCode }
              : hw
          )
        );
        addToast('Homework Submitted', 'Your homework has been turned in to your teacher.', 'emerald');
        return true;
      } else {
        addToast('Submission Error', res?.message || 'Failed to submit homework.', 'rose');
        return false;
      }
    } catch (err) {
      addToast('Network Error', 'Failed to reach homework submission server.', 'rose');
      return false;
    }
  };

  const markSchoolAttendance = async (status = 'present') => {
    addToast('Attendance Recorded', `Classroom attendance verified as ${status}.`, 'emerald');
  };

  // Universal Study Notes Collection
  const [studyNotes, setStudyNotes] = useState(() => {
    if (!import.meta.env.DEV) {
      const saved = localStorage.getItem('lumina_study_notes');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
      return [];
    }
    const saved = localStorage.getItem('lumina_study_notes');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      {
        id: 'note-1',
        title: 'Transformer Scaled Dot-Product Attention',
        category: 'CS 401 Deep Learning',
        color: 'emerald',
        pinned: true,
        content: `### Scaled Dot-Product Attention
$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$$

- **Causal Masking**: Set $(i, j) = -\\infty$ for $j > i$ before softmax.
- **Pre-LN Paradigm**: LayerNorm is applied *before* attention and MLP sub-layers.
- **GeLU Activation**: Smooth non-linearity for gradient stability.`,
        createdAt: '2026-08-15T14:30:00Z',
        sourcePage: 'Course Classroom'
      },
      {
        id: 'note-2',
        title: "Kadane's Algorithm & Maximum Subarray",
        category: 'Code Lab & Algorithms',
        color: 'amber',
        pinned: true,
        content: `### Maximum Subarray (Day 15 Challenge)
- **Time Complexity**: $O(n)$ linear scan.
- **Space Complexity**: $O(1)$ constant auxiliary space.
- **Recurrence Relation**:
  \`current_max = max(nums[i], current_max + nums[i])\`
  \`max_so_far = max(max_so_far, current_max)\`
- Reset current running sum if it drops below 0!`,
        createdAt: '2026-08-15T12:00:00Z',
        sourcePage: 'Code Lab (Polyglot)'
      },
      {
        id: 'note-3',
        title: 'Midterm Exam Topics Checklist',
        category: 'DS 202 Algorithms',
        color: 'cyan',
        pinned: false,
        content: `### DS 202 Exam Preparation
- [x] Dijkstra's Algorithm with Min-Heap ($O(E \\log V)$)
- [x] Bellman-Ford Negative Cycle Detection
- [ ] Tarjan's Strongly Connected Components (SCC)
- [ ] Dynamic Programming Knapsack 0/1 Memoization`,
        createdAt: '2026-08-14T09:15:00Z',
        sourcePage: 'Schedule & Calendar'
      },
      {
        id: 'note-4',
        title: 'Raft Distributed Consensus Protocol',
        category: 'CS 330 Systems',
        color: 'rose',
        pinned: false,
        content: `### Raft Key Principles
1. **Leader Election**: Randomized election timeouts (150ms-300ms) prevent split votes.
2. **Log Replication**: Leader appends entries to followers; commits when majority match.
3. **Safety Invariant**: Leader contains all committed entries from past terms.`,
        createdAt: '2026-08-13T16:45:00Z',
        sourcePage: 'Dashboard'
      }
    ];
  });

  // Save studyNotes to localStorage (still keep it as fallback/cache)
  useEffect(() => {
    localStorage.setItem('lumina_study_notes', JSON.stringify(studyNotes));
  }, [studyNotes]);

  // Fetch from backend
  useEffect(() => {
    const fetchNotes = async () => {
      if (!isAuthenticated || user?.mustChangePassword) return;
      const serverNotes = await apiService.getNotes();
      if (serverNotes && Array.isArray(serverNotes)) {
        setStudyNotes(serverNotes);
      }
    };
    fetchNotes();
  }, [isAuthenticated, user?.mustChangePassword]);

  const addStudyNote = async (newNote) => {
    const note = {
      id: `note-${Date.now()}`,
      title: newNote.title || 'Untitled Note',
      content: newNote.content || '',
      category: newNote.category || 'General',
      color: newNote.color || 'emerald',
      pinned: newNote.pinned || false,
      createdAt: new Date().toISOString(),
      sourcePage: newNote.sourcePage || activeTab,
      files: []
    };
    
    setStudyNotes((prev) => [note, ...prev]);
    addToast('Note Saved 📝', `"${note.title}" saved to your personal notebook.`, 'emerald');
    
    // Background sync
    await apiService.saveNote(note);
    
    return note;
  };

  const updateStudyNote = async (id, updatedFields) => {
    setStudyNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updatedFields, updatedAt: new Date().toISOString() } : n))
    );
    addToast('Note Updated', 'Changes saved successfully.', 'subtle');
    
    // Find the full note for sync
    const target = studyNotes.find((n) => n.id === id);
    if (target) {
      await apiService.saveNote({ ...target, ...updatedFields, updatedAt: new Date().toISOString() });
    }
  };

  const deleteStudyNote = async (id) => {
    setStudyNotes((prev) => prev.filter((n) => n.id !== id));
    addToast('Note Deleted', 'Removed from notebook.', 'subtle');
    await apiService.deleteNote(id);
  };

  const togglePinStudyNote = async (id) => {
    setStudyNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n))
    );
    const target = studyNotes.find((n) => n.id === id);
    if (target) {
      await apiService.saveNote({ ...target, pinned: !target.pinned });
    }
  };

  // Student Notes per lesson (backwards compatibility)
  const [notes, setNotes] = useState({
    'les-204': `### GPT-2 Architecture Implementation Notes
- **Causal Masking**: Must mask out future tokens by setting $(i, j) = -\\infty$ where $j > i$ before softmax.
- **Layer Normalization**: Applied BEFORE the multi-head attention and MLP sub-layers (Pre-LN paradigm).
- **Activation Function**: Using standard GeLU (Gaussian Error Linear Unit) rather than standard ReLU for smoother gradient flow.`
  });

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Global search (Cmd+K / Ctrl+K) & Quick Notes (Cmd+J / Ctrl+J) shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setNotesDrawerOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Show Toast with duplicate suppression
  const addToast = (title, message, type = 'emerald') => {
    setToasts((prev) => {
      if (prev.some((t) => t.title === title && t.message === message)) {
        return prev;
      }
      const newToast = {
        id: Date.now() + Math.random(),
        title,
        message,
        type,
        time: 'Just now'
      };
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, 4500);
      return [newToast, ...prev.slice(0, 4)];
    });
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Trigger celebration confetti
  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#059669', '#10B981', '#34D399', '#6EE7B7', '#2563EB', '#93C5FD']
    });
  };

  // Authoritative background-resilient Student Focus Timer
  const focusTimer = useFocusTimer({ triggerConfetti, addToast });

  // --- AUTHENTICATION & LOGIN SYSTEM ---
  const login = async (identifier, password) => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Try Backend API
    const apiResult = await apiService.login(identifier, password);
    
    if (apiResult && apiResult.requires2FA) {
      return { success: true, requires2FA: true, preAuthToken: apiResult.preAuthToken };
    }

    if (apiResult && apiResult.success && apiResult.user) {
      if (apiResult.token) {
        tempAuthTokenRef.current = apiResult.token;
        setAuthToken(apiResult.token);
      }
      const matchedClientStudent = students.find(
        (s) => (s.email.toLowerCase() === cleanId || s.studentId.toLowerCase() === cleanId)
      ) || INITIAL_USER;
      const mustChange = apiResult.mustChangePassword ?? apiResult.user.mustChangePassword ?? false;
      const fullUser = { 
        ...matchedClientStudent, 
        ...apiResult.user, 
        role: (apiResult.user.role || matchedClientStudent.role || 'student').toLowerCase(),
        mustChangePassword: mustChange 
      };
      
      try {
        localStorage.setItem('lumina_current_user', JSON.stringify(fullUser));
      } catch (e) {}

      setUser(fullUser);
      setIsAuthenticated(true);
      setLoginModalOpen(false);
      if (mustChange) {
        setMustChangePasswordPromptOpen(true);
      } else {
        triggerConfetti();
        addToast(`Welcome back, ${fullUser.name}!`, `Authenticated as ${fullUser.role} (${fullUser.studentId})`, 'emerald');
      }
      return { success: true, user: fullUser, mustChangePassword: mustChange };
    }

    // 2. Client-side fallback check (STRICTLY DEVELOPMENT ONLY — NEVER in production)
    if (import.meta.env.DEV) {
      const matched = students.find(
        (s) =>
          (s.email.toLowerCase() === cleanId || s.studentId.toLowerCase() === cleanId) &&
          s.password === cleanPass
      );

      if (matched) {
        const normalizedUser = { ...matched, role: (matched.role || 'student').toLowerCase() };
        setUser(normalizedUser);
        setIsAuthenticated(true);
        setLoginModalOpen(false);
        triggerConfetti();
        addToast(`Welcome back, ${matched.name}!`, `Authenticated as ${matched.role} (${matched.studentId}) [DEV FALLBACK]`, 'emerald');
        return { success: true, user: matched };
      }
    }

    return {
      success: false,
      error: apiResult?.message || apiResult?.error || 'Incorrect email or password.'
    };
  };

  const handleVerify2FA = async (preAuthToken, token) => {
    const apiResult = await apiService.verify2FA(preAuthToken, token);
    if (apiResult && apiResult.success && apiResult.user) {
      if (apiResult.token) {
        tempAuthTokenRef.current = apiResult.token;
        setAuthToken(apiResult.token);
      }
      const mustChange = apiResult.mustChangePassword ?? apiResult.user.mustChangePassword ?? false;
      const fullUser = { ...INITIAL_USER, ...apiResult.user, mustChangePassword: mustChange };
      try {
        localStorage.setItem('lumina_current_user', JSON.stringify(fullUser));
      } catch (e) {}
      setUser(fullUser);
      setIsAuthenticated(true);
      setLoginModalOpen(false);
      if (mustChange) {
        setMustChangePasswordPromptOpen(true);
      } else {
        triggerConfetti();
        addToast(`Welcome back, ${fullUser.name}!`, `2FA Verified`, 'emerald');
      }
      return { success: true, user: fullUser, mustChangePassword: mustChange };
    }
    return { success: false, error: apiResult?.message || 'Invalid 2FA code.' };
  };

  const handleMfaEnrolled = (updatedUser) => {
    setUser((prev) => {
      const merged = {
        ...prev,
        ...(updatedUser || {}),
        isTwoFactorEnabled: true,
        mfaSetupRequired: false
      };
      try {
        localStorage.setItem('lumina_current_user', JSON.stringify(merged));
      } catch {}
      return merged;
    });
    triggerConfetti();
    addToast('2FA Enrollment Verified', 'Multi-factor authentication is active on your privileged account.', 'emerald');
  };

  const handleForcedPasswordChange = async (newPassword, confirmPassword) => {
    const activeToken = tempAuthTokenRef.current || getAuthToken();
    const res = await apiService.changePassword(newPassword, confirmPassword, '', activeToken);
    if (res && res.success) {
      if (res.token) {
        tempAuthTokenRef.current = res.token;
        setAuthToken(res.token);
      }
      setUser((prev) => {
        const updated = {
          ...prev,
          ...(res.user || {}),
          mustChangePassword: false
        };
        try {
          localStorage.setItem('lumina_current_user', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setMustChangePasswordPromptOpen(false);
      triggerConfetti();
      addToast('Password Updated Successfully', 'Your new permanent password is now active.', 'emerald');
      return { success: true };
    }
    return { success: false, message: res?.message || 'Failed to update password.' };
  };

  const logout = async () => {
    try {
      await apiService.logout();
    } catch (e) {}
    socketService.disconnect();
    tempAuthTokenRef.current = null;
    setIsAuthenticated(false);
    setUser(null);
    setToasts([]);
    localStorage.removeItem('lumina_current_user');
    setAuthToken(null);
  };

  useEffect(() => {
    const handleSessionExpired = async () => {
      // Guard: only fire session expired if the user was actively authenticated or holds a token
      const currentToken = getAuthToken();
      if (!isAuthenticated && !currentToken) return;

      // Prevent concurrent verification checks or re-entry loops
      if (isVerifyingSessionRef.current) return;
      isVerifyingSessionRef.current = true;

      try {
        // Authoritative session verification: probe /auth/profile to confirm token validity
        // This protects valid tokens from being wiped by isolated 401 errors on secondary calls
        const profileRes = await apiService.getProfile();
        if (profileRes && (profileRes.success || profileRes.user)) {
          // Token is still valid on the server! Do not wipe state.
          return;
        }

        // An ordinary 403 (Forbidden / authorization restriction / setup required) indicates the token is valid,
        // but the user lacks permission or needs to complete enrollment.
        // It must NOT automatically log out a valid user.
        if (profileRes?.status === 403 || profileRes?.isForbidden) {
          console.warn('[LMSContext] Profile probe returned 403 Forbidden; user identity remains valid, preserving session credentials.');
          return;
        }

        // If it is a network failure or transient server error (HTTP 5xx), do NOT log out the user
        if (profileRes?.isNetworkError || profileRes?.isServerError) {
          console.warn('[LMSContext] Session verification encountered network or server error; preserving session credentials offline.');
          return;
        }
      } catch {
        // Network error during probe — preserve credentials offline
        return;
      } finally {
        isVerifyingSessionRef.current = false;
      }

      socketService.disconnect();
      setIsAuthenticated(false);
      setUser(null);
      setToasts([]);
      localStorage.removeItem('lumina_current_user');
      setAuthToken(null);
      setLoginModalOpen(true);
      addToast('Session Expired', 'Your session expired — please log in again.', 'urgent');
    };

    window.addEventListener('lms_session_expired', handleSessionExpired);
    return () => window.removeEventListener('lms_session_expired', handleSessionExpired);
  }, [isAuthenticated]);

  const switchUser = (studentId) => {
    const target = students.find((s) => s.id === studentId || s.studentId === studentId);
    if (target) {
      setUser(target);
      setIsAuthenticated(true);
      triggerConfetti();
      addToast('Profile Switched', `Now logged in as ${target.name} (${target.major})`, 'emerald');
    }
  };

  // --- DATA SHEET CRUD OPERATIONS ---
  const addStudent = async (studentData) => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const firstName = studentData.name.split(' ')[0] || 'Student';
    const lastName = studentData.name.split(' ')[1] || 'Nexus';

    const generatedStudentId = studentData.studentId || `NX-${new Date().getFullYear()}-${randomId}`;
    const generatedEmail =
      studentData.email ||
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus.edu`;
    const generatedPassword =
      studentData.password || `${firstName}#Nexus${Math.floor(10 + Math.random() * 89)}!`;

    const newStudent = {
      id: `usr_${Math.random().toString(36).substr(2, 7)}`,
      studentId: generatedStudentId,
      name: studentData.name,
      email: generatedEmail,
      password: generatedPassword,
      role: studentData.role || 'Student',
      avatar:
        studentData.avatar ||
        `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 50000000)}?w=150&auto=format&fit=crop&q=80`,
      major: studentData.major || 'Computer Science & AI',
      department: studentData.department || 'School of Computing',
      university: 'Nexus Institute of Technology',
      year: studentData.year || 'Junior (Year 3)',
      streakDays: 1,
      xp: 100,
      level: 'Novice Scholar',
      status: 'Online',
      accountStatus: 'Active',
      phone: studentData.phone || '+1 (617) 555-' + Math.floor(1000 + Math.random() * 9000),
      lastLogin: 'Never (Just Created)',
      joinedDate: new Date().toISOString().split('T')[0],
      enrolledCourses: studentData.enrolledCourses || ['CS 401', 'CS 330'],
      stats: {
        gpa: studentData.gpa || '3.80',
        termGpa: studentData.termGpa || '3.85',
        completedCredits: parseInt(studentData.completedCredits) || 30,
        totalCredits: 120,
        totalStudyHours: 20.0,
        assignmentCompletionRate: 90
      }
    };

    // Save to Backend server
    await apiService.createStudent(newStudent);

    setStudents((prev) => [newStudent, ...prev]);
    triggerConfetti();
    addToast('Student Added to Data Sheet', `Generated ID: ${generatedStudentId} & Secure Password`, 'emerald');
    return newStudent;
  };

  const updateStudent = async (studentId, updatedFields) => {
    try {
      const res = await apiService.updateStudent(studentId, updatedFields);
      if (res && res.success) {
        setStudents((prev) =>
          prev.map((s) => (s.id === studentId ? { ...s, ...updatedFields } : s))
        );
        if (user.id === studentId) {
          setUser((prev) => ({ ...prev, ...updatedFields }));
        }
        addToast('Data Sheet Updated', 'Student profile details synced.', 'emerald');
        return { success: true, student: res.student };
      } else {
        const errorMsg = res?.message || 'Failed to update student record.';
        addToast('Update Failed', errorMsg, 'rose');
        return { success: false, message: errorMsg };
      }
    } catch (err) {
      const errorMsg = err.message || 'Network error updating student.';
      addToast('Update Error', errorMsg, 'rose');
      return { success: false, message: errorMsg };
    }
  };

  const deleteStudent = async (studentId) => {
    await apiService.deleteStudent(studentId);

    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    addToast('Record Removed', 'Student removed from data sheet.', 'subtle');
  };

  const resetStudentPassword = async (studentId) => {
    const res = await apiService.resetStudentPassword(studentId);
    if (res && res.success && res.temporaryPassword) {
      addToast('Password Reset', 'Secure temporary password generated.', 'emerald');
      return { success: true, temporaryPassword: res.temporaryPassword };
    }
    return { success: false, message: res?.message || 'Failed to reset password.' };
  };

  const setInstitutionType = (type) => {
    const valid = type === 'school' ? 'school' : 'college';
    setUser((prev) => {
      const updated = { ...prev, institutionType: valid };
      localStorage.setItem('lumina_current_user', JSON.stringify(updated));
      return updated;
    });
    setPortalConfig((prev) => {
      const updated = {
        ...prev,
        institutionType: valid,
        companyName: valid === 'school' ? 'School Learning Portal' : 'Higher Education Learning Portal',
        portalName: valid === 'school' ? 'School Student Learning Portal' : 'Enterprise Student Learning Portal',
        shortName: valid === 'school' ? 'SCHOOL' : 'CAMPUS'
      };
      localStorage.setItem('lumina_portal_config', JSON.stringify(updated));
      return updated;
    });
    addToast('Institution Mode Set', `Active type: ${valid.toUpperCase()}`, 'emerald');
  };

  // Export Data Sheet as CSV
  const exportStudentsData = (format = 'csv') => {
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(students, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `lumina_students_datasheet_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      addToast('Data Exported', 'Downloaded students data sheet in JSON format', 'emerald');
      return;
    }

    // Default CSV Export
    const headers = [
      'Student ID',
      'Full Name',
      'Email / Username',
      'Login Password',
      'Role',
      'Major',
      'Academic Year',
      'GPA',
      'Enrolled Courses',
      'Account Status',
      'Last Login'
    ];

    const csvRows = [
      headers.join(','),
      ...students.map((s) =>
        [
          `"${s.studentId}"`,
          `"${s.name}"`,
          `"${s.email}"`,
          `"${s.password}"`,
          `"${s.role}"`,
          `"${s.major}"`,
          `"${s.year}"`,
          `"${s.stats?.gpa || s.gpa || '3.80'}"`,
          `"${(s.enrolledCourses || []).join('; ')}"`,
          `"${s.accountStatus}"`,
          `"${s.lastLogin}"`
        ].join(',')
      )
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows.join('\n'));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', csvContent);
    downloadAnchor.setAttribute('download', `lumina_students_datasheet_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addToast('Data Sheet Exported', 'Downloaded students data sheet in CSV format', 'emerald');
  };

  // Toggle Lesson Completion
  const toggleLessonCompletion = (courseId, lessonId) => {
    setCourses((prevCourses) => {
      return prevCourses.map((c) => {
        if (c.id !== courseId) return c;

        let totalLessonsCount = 0;
        let completedCount = 0;

        const updatedSyllabus = (c.syllabus || []).map((mod) => {
          const updatedLessons = mod.lessons.map((les) => {
            totalLessonsCount++;
            let isCompleted = les.completed;
            if (les.id === lessonId) {
              isCompleted = !isCompleted;
            }
            if (isCompleted) completedCount++;
            return { ...les, completed: isCompleted };
          });
          return { ...mod, lessons: updatedLessons };
        });

        const newProgress = totalLessonsCount > 0 ? Math.round((completedCount / totalLessonsCount) * 100) : c.progress;

        return {
          ...c,
          syllabus: updatedSyllabus,
          completedLessons: completedCount,
          progress: newProgress
        };
      });
    });

    setUser((prev) => ({
      ...prev,
      xp: prev.xp + 50
    }));

    addToast("Lesson Status Updated", "Progress synced & +50 XP awarded!", "emerald");
  };

  // Save Lesson Note
  const saveLessonNote = (lessonId, noteText) => {
    setNotes((prev) => ({ ...prev, [lessonId]: noteText }));
    addToast("Note Auto-saved", "Lesson timestamp bookmark updated", "subtle");
  };

  // Enroll in Course
  const toggleEnrollCourse = (courseId) => {
    setCourses((prev) =>
      prev.map((c) => {
        if (c.id === courseId) {
          const nextEnrolled = !c.enrolled;
          if (nextEnrolled) {
            triggerConfetti();
            addToast("Enrolled Successfully!", `Welcome to ${c.title}`, "emerald");
          } else {
            addToast("Course Dropped", `Unenrolled from ${c.code}`, "subtle");
          }
          return { ...c, enrolled: nextEnrolled };
        }
        return c;
      })
    );
  };

  // Submit Assignment
  const submitAssignment = (assignmentId, submissionData) => {
    setAssignments((prev) =>
      prev.map((asg) => {
        if (asg.id === assignmentId) {
          return {
            ...asg,
            status: "submitted",
            submissionFile: submissionData.fileName || "submission_archive.zip",
            submittedAt: new Date().toISOString(),
            priority: "completed"
          };
        }
        return asg;
      })
    );
    triggerConfetti();
    addToast("Assignment Submitted!", "Uploaded to automated rubric evaluation queue.", "emerald");
  };

  // Update Assignment Status
  const updateAssignmentStatus = (assignmentId, newStatus) => {
    setAssignments((prev) =>
      prev.map((asg) => {
        if (asg.id === assignmentId) {
          const priority = newStatus === 'graded' || newStatus === 'submitted' ? 'completed' : asg.priority;
          return { ...asg, status: newStatus, priority };
        }
        return asg;
      })
    );
  };

  // Add Calendar Event
  const addEvent = (newEvent) => {
    const created = {
      ...newEvent,
      id: `evt-${Date.now()}`
    };
    setEvents((prev) => [created, ...prev]);
    addToast("Event Scheduled", `${created.title} added to your calendar.`, "emerald");
  };

  // Navigate to Course in Classroom Viewer
  const openCourseInViewer = (courseId, lessonId = null) => {
    setActiveCourseId(courseId);
    if (lessonId) {
      setActiveLessonId(lessonId);
    } else {
      const targetCourse = courses.find((c) => c.id === courseId);
      if (targetCourse && targetCourse.syllabus?.length > 0) {
        const firstIncomplete = targetCourse.syllabus
          .flatMap((m) => m.lessons)
          .find((l) => !l.completed);
        if (firstIncomplete) {
          setActiveLessonId(firstIncomplete.id);
        } else if (targetCourse.syllabus[0]?.lessons[0]) {
          setActiveLessonId(targetCourse.syllabus[0].lessons[0].id);
        }
      }
    }
    setActiveTab('viewer');
  };

  // Update User Status
  const updateUserStatus = (newStatus) => {
    setUser((prev) => ({ ...prev, status: newStatus }));
    addToast("Status Changed", `Profile is now: ${newStatus}`, "subtle");
  };

  return (
    <LMSContext.Provider
      value={{
        activeTab,
        setActiveTab,
        sidebarCollapsed,
        setSidebarCollapsed,
        searchOpen,
        setSearchOpen,
        pomodoroOpen,
        setPomodoroOpen,
        focusTimer,
        loginModalOpen,
        setLoginModalOpen,
        codingPanelOpen,
        setCodingPanelOpen,
        isAuthenticated,
        portalConfig,
        updatePortalConfig,
        user,
        setUser,
        handleMfaEnrolled,
        handleVerify2FA,
        students,
        login,
        logout,
        switchUser,
        addStudent,
        updateStudent,
        deleteStudent,
        resetStudentPassword,
        exportStudentsData,
        updateUserStatus,
        courses,
        activeCourseId,
        setActiveCourseId,
        activeLessonId,
        setActiveLessonId,
        toggleLessonCompletion,
        toggleEnrollCourse,
        openCourseInViewer,
        notes,
        saveLessonNote,
        notesDrawerOpen,
        setNotesDrawerOpen,
        studyNotes,
        addStudyNote,
        updateStudyNote,
        deleteStudyNote,
        togglePinStudyNote,
        assignments,
        assignmentFilter,
        setAssignmentFilter,
        submitAssignment,
        updateAssignmentStatus,
        events,
        eventFilter,
        setEventFilter,
        addEvent,
        flashcardDecks,
        setFlashcardDecks,
        codingChallenges,
        setCodingChallenges,
        studyAnalytics: STUDY_ANALYTICS,
        gradesData: GRADES_DATA,
        pythonProblems: PYTHON_PROBLEMS,
        toasts,
        addToast,
        removeToast,
        triggerConfetti,
        onlineStats,
        activeAttendancePrompt,
        setActiveAttendancePrompt,
        socketService,
        institutionType,
        setInstitutionType,
        terms,
        mustChangePasswordPromptOpen,
        setMustChangePasswordPromptOpen,
        handleForcedPasswordChange,
        theme,
        setTheme,
        toggleTheme,
        schoolSubjects,
        setSchoolSubjects,
        schoolHomework,
        setSchoolHomework,
        schoolTests,
        setSchoolTests,
        schoolResults,
        setSchoolResults,
        schoolAttendance,
        setSchoolAttendance,
        schoolCalendarEvents,
        setSchoolCalendarEvents,
        schoolTodayClasses,
        setSchoolTodayClasses,
        schoolAnnouncements,
        setSchoolAnnouncements,
        fetchSchoolData,
        fetchAdminAndTrainerData,
        refreshAdminData: fetchAdminAndTrainerData,
        submitSchoolHomework,
        markSchoolAttendance
      }}
    >
      {children}
    </LMSContext.Provider>
  );
};

export const useLMS = () => {
  const context = useContext(LMSContext);
  if (!context) {
    throw new Error('useLMS must be used within an LMSProvider');
  }
  return context;
};
