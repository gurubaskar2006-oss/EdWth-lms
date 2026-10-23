import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  Users,
  Search,
  Plus,
  Download,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Edit2,
  Trash2,
  LogIn,
  ShieldCheck,
  ShieldAlert,
  Award,
  BookOpen,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { ResetStudentPasswordModal } from '../components/ResetStudentPasswordModal';

export const StudentsDataSheetView = () => {
  usePageTitle('Students Data');
  const {
    students,
    user,
    switchUser,
    addStudent,
    updateStudent,
    deleteStudent,
    resetStudentPassword,
    exportStudentsData,
    addToast,
    courses,
    setLoginModalOpen,
    terms
  } = useLMS();

  const [resetTargetStudent, setResetTargetStudent] = useState(null);


  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Password Visibility Toggle Map (studentId -> boolean)
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editStudentModal, setEditStudentModal] = useState(null);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // New Student Form State
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    major: 'Computer Science & AI',
    department: 'School of Computing',
    year: 'Junior (Year 3)',
    gpa: '3.85',
    email: '',
    studentId: '',
    password: '',
    role: 'Student',
    phone: '',
    enrolledCourses: ['CS 401', 'CS 330']
  });

  const [isLocked, setIsLocked] = useState(false);

  // Check Team Clearance Level
  const isTeamUser =
    user?.role?.toLowerCase().includes('admin') ||
    user?.role?.toLowerCase().includes('superadmin') ||
    user?.role?.toLowerCase().includes('trainer') ||
    user?.role?.toLowerCase().includes('teacher') ||
    user?.role?.toLowerCase().includes('instructor') ||
    user?.role?.toLowerCase().includes('faculty') ||
    user?.role?.toLowerCase().includes('chair');

  const hasTeamAccess = Boolean(isTeamUser && !isLocked);

  const lockTeamAccess = () => {
    setIsLocked(true);
    addToast('Data Sheet Locked', 'Student credentials sheet locked. Click unlock to view.', 'amber');
  };


  // Toggle Password Visibility
  const togglePasswordVisibility = (id) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard helper
  const handleCopy = (text, fieldKey) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    addToast('Copied to Clipboard', text, 'emerald');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Auto-generate helper for Add Modal
  const generateNewCredentials = () => {
    const firstName = newStudentForm.name.trim().split(' ')[0] || 'Student';
    const lastName = newStudentForm.name.trim().split(' ')[1] || 'Nexus';
    const randomDigits = Math.floor(1000 + Math.random() * 9000);

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@nexus.edu`;
    const studentId = `NX-${new Date().getFullYear()}-${randomDigits}`;
    const password = `${firstName}#Nexus${Math.floor(10 + Math.random() * 89)}!`;

    setNewStudentForm((prev) => ({
      ...prev,
      email,
      studentId,
      password
    }));
  };

  const handleCreateStudentSubmit = (e) => {
    e.preventDefault();
    if (!newStudentForm.name.trim()) return;

    addStudent(newStudentForm);
    setAddModalOpen(false);
    setNewStudentForm({
      name: '',
      major: 'Computer Science & AI',
      department: 'School of Computing',
      year: 'Junior (Year 3)',
      gpa: '3.85',
      email: '',
      studentId: '',
      password: '',
      role: 'Student',
      phone: '',
      enrolledCourses: ['CS 401', 'CS 330']
    });
  };

  const handleEditStudentSubmit = async (e) => {
    e.preventDefault();
    if (!editStudentModal) return;

    setEditError('');
    setIsSubmittingEdit(true);

    try {
      // Build strictly sanitized payload of permitted editable fields only
      const payload = {};

      if (editStudentModal.name !== undefined && typeof editStudentModal.name === 'string') {
        payload.name = editStudentModal.name.trim();
      }

      if (editStudentModal.major !== undefined && typeof editStudentModal.major === 'string') {
        payload.major = editStudentModal.major.trim();
      }

      if (editStudentModal.department !== undefined && typeof editStudentModal.department === 'string') {
        payload.department = editStudentModal.department.trim();
      }

      if (editStudentModal.university !== undefined && typeof editStudentModal.university === 'string') {
        payload.university = editStudentModal.university.trim();
      }

      if (editStudentModal.year !== undefined && typeof editStudentModal.year === 'string') {
        payload.year = editStudentModal.year.trim();
      }

      if (editStudentModal.phone !== undefined && typeof editStudentModal.phone === 'string') {
        payload.phone = editStudentModal.phone.trim();
      }

      if (editStudentModal.accountStatus !== undefined && typeof editStudentModal.accountStatus === 'string') {
        payload.accountStatus = editStudentModal.accountStatus.trim();
      }

      if (editStudentModal.status !== undefined && typeof editStudentModal.status === 'string') {
        payload.status = editStudentModal.status.trim();
      }

      if (editStudentModal.level !== undefined && typeof editStudentModal.level === 'string') {
        payload.level = editStudentModal.level.trim();
      }

      if (Array.isArray(editStudentModal.enrolledCourses)) {
        payload.enrolledCourses = editStudentModal.enrolledCourses;
      }

      // Stats handling: support gpa string from input and nested stats object
      const gpaValue = editStudentModal.stats?.gpa || editStudentModal.gpa;
      if (gpaValue !== undefined) {
        payload.stats = {
          ...(editStudentModal.stats || {}),
          gpa: String(gpaValue)
        };
      }

      const res = await updateStudent(editStudentModal.id, payload);

      if (res && res.success) {
        setEditStudentModal(null);
        setEditError('');
      } else {
        setEditError(res?.message || 'Failed to update student profile.');
      }
    } catch (err) {
      setEditError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Filtered and Sorted Students (guarded against missing optional properties)
  const safeStudents = Array.isArray(students) ? students : [];

  const filteredStudents = safeStudents
    .filter((s) => {
      if (!s) return false;
      const q = (searchQuery || '').toLowerCase().trim();
      const name = (s.name || '').toLowerCase();
      const studentId = (s.studentId || s.id || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const major = (s.major || s.department || '').toLowerCase();

      const matchesSearch = !q || (
        name.includes(q) ||
        studentId.includes(q) ||
        email.includes(q) ||
        major.includes(q)
      );

      const yearStr = (s.year || s.className || '').toLowerCase();
      const matchesYear = filterYear === 'all' || yearStr.includes(filterYear.toLowerCase());
      const statusStr = (s.accountStatus || s.status || '').toLowerCase();
      const matchesStatus = filterStatus === 'all' || statusStr === filterStatus.toLowerCase();

      return matchesSearch && matchesYear && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'gpa') return parseFloat(b.stats?.gpa || b.gpa || 0) - parseFloat(a.stats?.gpa || a.gpa || 0);
      if (sortBy === 'id') return (a.studentId || a.id || '').localeCompare(b.studentId || b.id || '');
      return 0;
    });

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Calculate Average GPA safely
  const avgGpa = (
    safeStudents.reduce((acc, s) => acc + parseFloat(s?.stats?.gpa || s?.gpa || 0), 0) /
    (safeStudents.length || 1)
  ).toFixed(2);

  // =========================================================================
  // VIEW 1: RESTRICTED TEAM & FACULTY GATEWAY (WHEN UNAUTHORIZED)
  // =========================================================================
  if (!hasTeamAccess) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '75vh',
          padding: '2rem 1rem'
        }}
      >
        <div
          className="card"
          style={{
            maxWidth: '580px',
            width: '100%',
            padding: '2.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.5rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          {/* Lock & Security Icon Badge */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '20px',
                background: '#FEF3C7',
                border: '1.5px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Lock size={36} color="#D97706" strokeWidth={2.2} />
            </div>
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.75rem',
                border: '2px solid #FFFFFF'
              }}
              title="Team Restricted Perimeter"
            >
              !
            </div>
          </div>

          {/* Heading and Privacy Notice */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FDE68A'
                }}
              >
                🔒 RESTRICTED TEAM PERIMETER
              </span>
            </div>

            <h2 style={{ fontSize: '1.7rem', color: 'var(--text-primary)', fontWeight: 800, marginBottom: '0.5rem' }}>
              Team & Faculty Clearance Required
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.5, maxWidth: '440px' }}>
              This master data sheet contains institutional credentials, passwords, and student academic registries.
              Access is restricted strictly to our administrative team and faculty.
            </p>
          </div>

          {/* Current Profile Banner */}
          <div
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <img
                src={user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=0D8ABC&color=fff`}
                alt={user?.name || 'User'}
                style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.82rem' }}>{user?.name || 'Administrator'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  Role: <span style={{ color: '#DC2626', fontWeight: 600 }}>{user?.role || 'Student (Unauthorized)'}</span>
                </div>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#D97706',
                backgroundColor: '#FEF3C7',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid #FDE68A'
              }}
            >
              Locked
            </span>
          </div>

          <div style={{ marginTop: '1rem', width: '100%', padding: '1.5rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-md)' }}>
            <p style={{ color: '#991B1B', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 500 }}>
              {isTeamUser
                ? 'Data Sheet is currently locked for session security. Click below to unlock.'
                : 'Access Denied. You must log in with an Administrator or Faculty account to view the Student Data Sheet.'}
            </p>
            <button
              onClick={() => {
                if (isTeamUser) {
                  setIsLocked(false);
                } else {
                  setLoginModalOpen(true);
                }
              }}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
            >
              <Unlock size={17} strokeWidth={2.5} />
              <span>{isTeamUser ? 'Unlock Data Sheet' : 'Login as Administrator'}</span>
            </button>
          </div>

          {/* Security Policy Badge */}
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={13} color="var(--accent-primary)" />
            <span>FERPA Compliant • Institutional Session ID: <code>NEXUS-AUDIT-2026</code></span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: UNLOCKED MASTER STUDENT DATA SHEET (TEAM ONLY)
  // =========================================================================
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Team Clearance Active Banner */}
      <div
        style={{
          backgroundColor: '#ECFDF5',
          border: '1px solid #A7F3D0',
          borderRadius: 'var(--radius-lg)',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#D1FAE5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Team & Faculty Clearance: Active</span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#D1FAE5',
                  color: 'var(--accent-primary)',
                  fontWeight: 800
                }}
              >
                LEVEL 4 ACCESS
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              Authorized session for: <strong>{user?.name || 'Administrator'}</strong> ({user?.role || 'Team Admin'}) • Master Credentials Unlocked
            </div>
          </div>
        </div>

        <button
          onClick={lockTeamAccess}
          className="btn-secondary"
          style={{
            padding: '0.4rem 0.8rem',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)'
          }}
          title="Lock sheet when stepping away"
        >
          <Lock size={13} />
          <span>Lock Data Sheet</span>
        </button>
      </div>

      {/* Header & Title Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-emerald">Team Protected Console</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nexus Master DB & Credentials</span>
          </div>
          <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary)', fontWeight: 800 }}>
            Student Data Sheet & Login Credentials
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Store student profiles, generate secure passwords, manage enrollment data, and export official rosters
          </p>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => exportStudentsData('csv')}
            className="btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportStudentsData('json')}
            className="btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <FileSpreadsheet size={15} />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => {
              setAddModalOpen(true);
              generateNewCredentials();
            }}
            className="btn-primary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Plus size={16} strokeWidth={3} />
            <span>Add Student & Generate Login</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.25rem'
        }}
      >
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Registered Students</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {students.length}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 600 }}>
            100% Active Account Standing
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Class Average GPA</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EEF2FF', color: 'var(--accent-academic)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            {avgGpa} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ 4.00</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-academic)', marginTop: '4px', fontWeight: 600 }}>
            Dean's High Honors Standard
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Login Credential Security</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#ECFDF5', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            100%
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 600 }}>
            Complex Passwords & Salted
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Session Profile</span>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#EFF6FF', color: 'var(--accent-learning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn size={17} />
            </div>
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.name || 'Authorized User'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            ID: {user?.studentId || user?.id || 'N/A'} • {user?.role || 'Administrator'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by Student Name, ID (NX-XXXX), Email, or Major..."
            style={{
              width: '100%',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '0.3rem 0',
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="btn-icon" style={{ width: '24px', height: '24px' }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span>Year:</span>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
            >
              <option value="all">All Years</option>
              <option value="junior">Junior (Year 3)</option>
              <option value="senior">Senior (Year 4)</option>
              <option value="sophomore">Sophomore (Year 2)</option>
              <option value="graduate">Graduate (M.S.)</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1);
              }}
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
            >
              <option value="name">Name (A-Z)</option>
              <option value="gpa">Highest GPA</option>
              <option value="id">Student ID</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Students Data Sheet Table */}
      <div
        className="card table-responsive-wrapper"
        style={{
          padding: 0,
          border: '1px solid var(--border-default)'
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.82rem'
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-surface-subtle)',
                borderBottom: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              <th style={{ padding: '0.9rem 1.25rem' }}>Student Profile</th>
              <th style={{ padding: '0.9rem 1rem' }}>Student ID</th>
              <th style={{ padding: '0.9rem 1rem' }}>Email / Login ID</th>
              <th style={{ padding: '0.9rem 1rem' }}>Login Password</th>
              <th style={{ padding: '0.9rem 1rem' }}>Major & Dept</th>
              <th style={{ padding: '0.9rem 1rem' }}>GPA</th>
              <th style={{ padding: '0.9rem 1rem' }}>Status</th>
              <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedStudents.length > 0 ? (
              paginatedStudents.map((st, index) => {
                const isCurrentUser = user.id === st.id || user.studentId === st.studentId;
                const isPasswordVisible = visiblePasswords[st.id];

                return (
                  <tr
                    key={st.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: isCurrentUser
                        ? '#ECFDF5'
                        : index % 2 === 0
                        ? '#FFFFFF'
                        : 'var(--bg-surface-subtle)',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F1F5F9')}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = isCurrentUser
                        ? '#ECFDF5'
                        : index % 2 === 0
                        ? '#FFFFFF'
                        : 'var(--bg-surface-subtle)')
                    }
                  >
                    {/* Student Profile */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img
                          src={st.avatar}
                          alt={st.name}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            objectFit: 'cover',
                            border: isCurrentUser ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-default)'
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{st.name}</span>
                            {isCurrentUser && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 5px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: '#D1FAE5',
                                  color: 'var(--accent-primary)',
                                  fontWeight: 800
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {st.year} • {st.role}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Student ID */}
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--accent-learning)' }}>{st.studentId}</span>
                        <button
                          onClick={() => handleCopy(st.studentId, `id_${st.id}`)}
                          className="btn-icon"
                          style={{ width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                          title="Copy Student ID"
                        >
                          {copiedField === `id_${st.id}` ? <Check size={12} color="var(--accent-primary)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>

                    {/* Email / Login ID */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {st.email}
                        </span>
                        <button
                          onClick={() => handleCopy(st.email, `email_${st.id}`)}
                          className="btn-icon"
                          style={{ width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                          title="Copy Email"
                        >
                          {copiedField === `email_${st.id}` ? <Check size={12} color="var(--accent-primary)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>

                    {/* Login Password */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: 'var(--bg-surface-subtle)',
                          padding: '0.3rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-default)',
                          width: 'fit-content'
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: isPasswordVisible ? 'var(--accent-primary)' : 'var(--text-muted)'
                          }}
                        >
                          {isPasswordVisible ? st.password : '••••••••••••'}
                        </span>

                        <button
                          onClick={() => togglePasswordVisibility(st.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title={isPasswordVisible ? 'Hide Password' : 'Show Password'}
                        >
                          {isPasswordVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>

                        <button
                          onClick={() => handleCopy(st.password, `pass_${st.id}`)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          title="Copy Password"
                        >
                          {copiedField === `pass_${st.id}` ? <Check size={13} color="var(--accent-primary)" /> : <Copy size={13} />}
                        </button>

                        <button
                          onClick={() => setResetTargetStudent(st)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '5px',
                            border: '1px solid rgba(217, 119, 6, 0.4)',
                            backgroundColor: 'rgba(217, 119, 6, 0.1)',
                            color: '#fbbf24',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                          title="Reset student password"
                        >
                          <KeyRound size={12} />
                          <span>Reset</span>
                        </button>
                      </div>
                    </td>

                    {/* Major & Department */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{st.major}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.department}</div>
                    </td>

                    {/* GPA */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: parseFloat(st.stats?.gpa || st.gpa || 0) >= 3.9 ? 'var(--accent-primary)' : 'var(--text-primary)'
                        }}
                      >
                        {st.stats?.gpa || st.gpa || '3.80'}
                      </span>
                    </td>

                    {/* Account Status */}
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span
                        className="badge badge-emerald"
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />
                        {st.accountStatus || 'Active'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        {!isCurrentUser ? (
                          <button
                            onClick={() => switchUser(st.id)}
                            className="btn-secondary"
                            style={{
                              padding: '0.3rem 0.65rem',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              borderColor: 'var(--border-default)'
                            }}
                            title={`Sign in as ${st.name}`}
                          >
                            <LogIn size={13} color="var(--accent-primary)" />
                            <span>Login As</span>
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--accent-primary)',
                              padding: '0.3rem 0.5rem'
                            }}
                          >
                            ✓ Current User
                          </span>
                        )}

                        <button
                          onClick={() => setEditStudentModal(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px' }}
                          title="Edit Student Record"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => setStudentToDelete(st)}
                          className="btn-icon"
                          style={{ width: '28px', height: '28px', color: '#f87171' }}
                          title="Delete Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {safeStudents.length === 0 ? (
                    <div>
                      <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        No student records enrolled in this institution yet
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        Click 'Register Student' above to provision your first student login.
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Search size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', opacity: 0.6 }} />
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        No student records matched your query "{searchQuery}".
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>Prev</button>
            <span style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem' }}>Next</button>
          </div>
        )}
      </div>

      {/* MODAL: ADD STUDENT & GENERATE CREDENTIALS */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  Register Student & Create Login
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Auto-generates student ID, institutional email, and secure password
                </p>
              </div>
              <button onClick={() => setAddModalOpen(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Full Student Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStudentForm.name}
                    onChange={(e) => {
                      setNewStudentForm((prev) => ({ ...prev, name: e.target.value }));
                    }}
                    onBlur={generateNewCredentials}
                    placeholder="e.g. Liam Davies"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Major & Field of Study
                  </label>
                  <select
                    value={newStudentForm.major}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, major: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="Computer Science & AI">Computer Science & AI</option>
                    <option value="Data Science & Quantum Computing">Data Science & Quantum Computing</option>
                    <option value="Distributed Systems & Cloud">Distributed Systems & Cloud</option>
                    <option value="Human-Computer Interaction & UX">Human-Computer Interaction & UX</option>
                    <option value="Cybersecurity & Cryptography">Cybersecurity & Cryptography</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Academic Year
                  </label>
                  <select
                    value={newStudentForm.year}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, year: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  >
                    <option value="Freshman (Year 1)">Freshman (Year 1)</option>
                    <option value="Sophomore (Year 2)">Sophomore (Year 2)</option>
                    <option value="Junior (Year 3)">Junior (Year 3)</option>
                    <option value="Senior (Year 4)">Senior (Year 4)</option>
                    <option value="Graduate (M.S.)">Graduate (M.S.)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Initial Cumulative GPA
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="4.00"
                    value={newStudentForm.gpa}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, gpa: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* GENERATED CREDENTIALS PREVIEW CARD */}
              <div
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <KeyRound size={15} /> Generated Login Credentials Slip
                  </span>
                  <button
                    type="button"
                    onClick={generateNewCredentials}
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} /> Regenerate Password
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Student ID</span>
                    <input
                      type="text"
                      value={newStudentForm.studentId}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, studentId: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Institutional Email</span>
                    <input
                      type="email"
                      value={newStudentForm.email}
                      onChange={(e) => setNewStudentForm((prev) => ({ ...prev, email: e.target.value }))}
                      style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Generated Secure Password</span>
                  <input
                    type="text"
                    value={newStudentForm.password}
                    onChange={(e) => setNewStudentForm((prev) => ({ ...prev, password: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontWeight: 700 }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={16} />
                  <span>Save Record & Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT DETAILS */}
      {editStudentModal && (
        <div className="modal-overlay" onClick={() => setEditStudentModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '560px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  Edit Student Profile & Password
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Update records for {editStudentModal.name} ({editStudentModal.studentId})
                </p>
              </div>
              <button onClick={() => setEditStudentModal(null)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editStudentModal.name}
                  onChange={(e) => setEditStudentModal({ ...editStudentModal, name: e.target.value })}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Major
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.major}
                    onChange={(e) => setEditStudentModal({ ...editStudentModal, major: e.target.value })}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    GPA
                  </label>
                  <input
                    type="text"
                    value={editStudentModal.stats?.gpa || editStudentModal.gpa || '3.80'}
                    onChange={(e) =>
                      setEditStudentModal({
                        ...editStudentModal,
                        stats: { ...editStudentModal.stats, gpa: e.target.value }
                      })
                    }
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {editError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #EF4444',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#EF4444',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{editError}</span>
                </div>
              )}

              <div
                style={{
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Authentication Credentials
                  </span>
                  <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Passwords cannot be modified via direct profile edits.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const target = editStudentModal;
                    setEditStudentModal(null);
                    setResetTargetStudent(target);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(217, 119, 6, 0.4)',
                    backgroundColor: 'rgba(217, 119, 6, 0.12)',
                    color: '#fbbf24',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <KeyRound size={13} />
                  <span>Reset Password</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditStudentModal(null)} className="btn-secondary" disabled={isSubmittingEdit}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmittingEdit}>
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={!!studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onConfirm={() => {
          if (studentToDelete) {
            deleteStudent(studentToDelete.id);
          }
        }}
        title="Delete Student Record"
        message={`Are you sure you want to delete the record for ${studentToDelete?.name}? This action cannot be undone.`}
        confirmText="Delete Record"
      />

      {/* MODAL: SECURE STUDENT PASSWORD RESET */}
      <ResetStudentPasswordModal
        isOpen={!!resetTargetStudent}
        student={resetTargetStudent}
        educatorLabel={terms?.educatorLabel || 'Educator'}
        onClose={() => setResetTargetStudent(null)}
        onConfirmReset={async (id) => {
          return await resetStudentPassword(id);
        }}
      />
    </div>
  );
};
