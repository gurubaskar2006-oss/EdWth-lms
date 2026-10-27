import React, { useState, useEffect, useMemo } from 'react';
import { useLMS } from '../../context/LMSContext';
import { apiService } from '../../services/apiService';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  BookOpen,
  FileCheck2,
  Award,
  X,
  KeyRound,
  Mail,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  ShieldAlert,
  FileText,
  Check
} from 'lucide-react';

export const SchoolTeacherStudentsView = () => {
  const { addToast } = useLMS();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dossier, setDossier] = useState(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [dossierTab, setDossierTab] = useState('overview'); // 'overview' | 'tests' | 'homework' | 'integrity' | 'notes'
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [teacherNote, setTeacherNote] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!selectedStudent) {
      setDossier(null);
      setTeacherNote('');
      return;
    }
    const studentId = selectedStudent._id || selectedStudent.studentId;
    let isCancelled = false;
    setLoadingDossier(true);
    setDossierTab('overview');

    apiService.getStudentDossier(studentId)
      .then((res) => {
        if (!isCancelled && res?.success && res.dossier) {
          setDossier(res.dossier);
          if (res.dossier.teacherNote) {
            setTeacherNote(res.dossier.teacherNote);
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching dossier:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoadingDossier(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedStudent]);

  const handleSaveTeacherNote = async (contentToSave) => {
    if (!selectedStudent) return;
    const studentId = selectedStudent._id || selectedStudent.studentId;
    setSavingNote(true);
    try {
      const res = await apiService.saveTeacherNote(studentId, contentToSave);
      if (res?.success) {
        setTeacherNote(contentToSave);
        addToast('Teacher Note Saved', 'Instructional note persisted to database.', 'emerald');
      } else {
        addToast('Notice', res?.message || 'Failed to persist note.', 'amber');
      }
    } catch (e) {
      addToast('Error', 'Network error persisting teacher note.', 'red');
    } finally {
      setSavingNote(false);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getTrainerStudents();
      if (res?.success && Array.isArray(res.students)) {
        setStudents(res.students);
      } else {
        setError(res?.message || 'Failed to load students.');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while loading student roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Unique classes for filter dropdown
  const uniqueClasses = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    return Array.from(set);
  }, [students]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      const matchClass = classFilter === 'ALL' || s.className === classFilter;

      return matchSearch && matchStatus && matchClass;
    });
  }, [students, searchTerm, statusFilter, classFilter]);

  // Handle student password reset
  const handleResetStudentPassword = async (studentId) => {
    setIsResettingPassword(true);
    try {
      const data = await apiService.resetStudentPassword(studentId);
      if (data?.success) {
        addToast(
          'Password Reset',
          data.temporaryPassword
            ? `Temporary password: ${data.temporaryPassword}`
            : 'Temporary password generated.',
          'emerald'
        );
      } else {
        addToast('Reset Failed', data?.message || 'Could not reset password.', 'rose');
      }
    } catch (err) {
      addToast('Reset Error', 'Network error during password reset.', 'rose');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Active':
        return { bg: 'rgba(5, 150, 105, 0.12)', color: '#059669', border: 'rgba(5, 150, 105, 0.3)' };
      case 'Needs Attention':
        return { bg: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.3)' };
      case 'Pending Work':
        return { bg: 'rgba(217, 119, 6, 0.12)', color: '#D97706', border: 'rgba(217, 119, 6, 0.3)' };
      case 'Low Attendance':
        return { bg: 'rgba(244, 63, 94, 0.12)', color: '#F43F5E', border: 'rgba(244, 63, 94, 0.3)' };
      default:
        return { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: 'var(--border-default)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Class Students & Academic Status
            </h2>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.6rem',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB'
              }}
            >
              {students.length} Enrolled
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Authorized students across your assigned instructional classes and subjects
          </p>
        </div>

        <button
          onClick={fetchStudents}
          className="btn-secondary"
          style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          title="Refresh student records"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-secondary)" />
          <input
            type="text"
            placeholder="Search by student name, ID, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '0.86rem',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Filter Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Class Filter */}
          {uniqueClasses.length > 1 && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              <option value="ALL">All Classes</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          )}

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 600
            }}
          >
            <option value="ALL">All Academic Statuses</option>
            <option value="Active">Active</option>
            <option value="Needs Attention">Needs Attention</option>
            <option value="Pending Work">Pending Work</option>
            <option value="Low Attendance">Low Attendance</option>
          </select>
        </div>
      </div>

      {/* Students Table or Loading / Error State */}
      {loading ? (
        <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <RefreshCw size={32} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            Loading Student Records...
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            Fetching verified academic data and attendance logs.
          </p>
        </div>
      ) : error ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center', borderColor: '#EF4444' }}>
          <AlertCircle size={36} color="#EF4444" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            Could Not Load Students
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
            {error}
          </p>
          <button onClick={fetchStudents} className="btn-primary" style={{ padding: '0.45rem 1.25rem' }}>
            Retry Request
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <Users size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
            {(!students || students.length === 0) ? 'No students have been enrolled.' : 'No Students Found'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
            {searchTerm || statusFilter !== 'ALL' || classFilter !== 'ALL'
              ? 'No student matches your current search or status filter.'
              : 'No students have been enrolled into your assigned classes yet.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Student Name & ID</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Class</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Attendance Rate</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Homework Status</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Test Average</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Academic Status</th>
                  <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => {
                  const statusStyle = getStatusBadgeStyle(st.status);
                  const isLowAttendance = st.attendanceRate !== null && st.attendanceRate < 75;

                  return (
                    <tr
                      key={st._id || st.studentId}
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        transition: 'background-color 0.15s ease'
                      }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          {st.studentId} · {st.email}
                        </div>
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {st.className}
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color: st.attendanceRate === null ? 'var(--text-muted)' : isLowAttendance ? '#EF4444' : st.attendanceRate >= 90 ? '#059669' : '#D97706'
                          }}
                        >
                          {st.attendanceRate !== null ? `${st.attendanceRate}%` : 'Not enough data'}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        {st.totalAssignments === 0 ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                            No Assignments
                          </span>
                        ) : st.homeworkPending > 0 ? (
                          <span style={{ color: '#D97706', fontWeight: 700, fontSize: '0.8rem' }}>
                            ⚠️ {st.homeworkPending} Pending Task{st.homeworkPending > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.8rem' }}>
                            ✓ All Work Submitted
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {st.testAverage !== null ? `${st.testAverage}%` : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Not enough data</span>}
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.65rem',
                            borderRadius: '6px',
                            backgroundColor: statusStyle.bg,
                            color: statusStyle.color,
                            border: `1px solid ${statusStyle.border}`,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {st.status}
                        </span>
                      </td>

                      <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedStudent(st)}
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                        >
                          Student Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Academic Dossier Modal */}
      {selectedStudent && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '860px',
              maxHeight: '92vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: '20px',
              padding: '1.75rem',
              boxShadow: '0 24px 50px rgba(0, 0, 0, 0.22)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.3rem'
                  }}
                >
                  {selectedStudent.name?.charAt(0)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {selectedStudent.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        ...getStatusBadgeStyle(dossier?.overview?.status || selectedStudent.status)
                      }}
                    >
                      {dossier?.overview?.status || selectedStudent.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                    {selectedStudent.studentId} • {selectedStudent.className} • Teacher: {dossier?.student?.teacherName || 'Instructional Faculty'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                className="btn-icon"
                style={{ width: '34px', height: '34px', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Diagnostic Guidance Banner */}
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '12px',
                backgroundColor:
                  (dossier?.overview?.status === 'Needs Attention' || dossier?.overview?.status === 'Low Attendance')
                    ? 'rgba(239, 68, 68, 0.08)'
                    : dossier?.overview?.status === 'Pending Work'
                    ? 'rgba(217, 119, 6, 0.08)'
                    : 'rgba(5, 150, 105, 0.08)',
                border: `1px solid ${
                  (dossier?.overview?.status === 'Needs Attention' || dossier?.overview?.status === 'Low Attendance')
                    ? 'rgba(239, 68, 68, 0.25)'
                    : dossier?.overview?.status === 'Pending Work'
                    ? 'rgba(217, 119, 6, 0.25)'
                    : 'rgba(5, 150, 105, 0.25)'
                }`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                {(dossier?.overview?.status === 'Needs Attention' || dossier?.overview?.status === 'Low Attendance') ? (
                  <AlertCircle size={16} color="#EF4444" />
                ) : dossier?.overview?.status === 'Pending Work' ? (
                  <AlertTriangle size={16} color="#D97706" />
                ) : (
                  <CheckCircle2 size={16} color="#059669" />
                )}
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color:
                      (dossier?.overview?.status === 'Needs Attention' || dossier?.overview?.status === 'Low Attendance')
                        ? '#DC2626'
                        : dossier?.overview?.status === 'Pending Work'
                        ? '#B45309'
                        : '#047857'
                  }}
                >
                  Diagnostic Status: {dossier?.overview?.status || selectedStudent.status}
                </span>
              </div>

              {/* Explicit Reasons List */}
              <ul style={{ margin: '0 0 0.5rem 1.25rem', padding: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(dossier?.overview?.statusReasons || selectedStudent.statusReasons || [
                  selectedStudent.testAverage !== null && selectedStudent.testAverage < 60
                    ? `Recent test performance average (${selectedStudent.testAverage}%) is below academic standard.`
                    : selectedStudent.attendanceRate !== null && selectedStudent.attendanceRate < 75
                    ? `Attendance (${selectedStudent.attendanceRate}%) is below the 75% minimum threshold.`
                    : selectedStudent.homeworkPending > 0
                    ? `${selectedStudent.homeworkPending} homework assignment(s) are pending submission.`
                    : 'Meeting all attendance, testing, and assignment benchmarks.'
                ]).map((reason, rIdx) => (
                  <li key={rIdx}>{reason}</li>
                ))}
              </ul>

              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px dashed var(--border-default)', paddingTop: '0.4rem' }}>
                <strong>Recommended Educator Action: </strong>
                {dossier?.overview?.recommendedAction || selectedStudent.recommendedAction || 'Continue active instructional monitoring.'}
              </div>
            </div>

            {/* 6 Key Metrics Overview Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '0.75rem',
                padding: '1rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Attendance Rate</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (dossier?.overview?.attendanceRate ?? selectedStudent.attendanceRate) < 75 ? '#EF4444' : '#059669', marginTop: '2px' }}>
                  {(dossier?.overview?.attendanceRate ?? selectedStudent.attendanceRate) !== null ? `${dossier?.overview?.attendanceRate ?? selectedStudent.attendanceRate}%` : '—'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {dossier?.overview?.presentSessions != null ? `${dossier.overview.presentSessions} / ${dossier.overview.totalAttendanceSessions} sessions` : 'Live records'}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Curriculum Mastery</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                  {(dossier?.overview?.curriculumCompletion ?? selectedStudent.curriculumCompletion) !== null ? `${dossier?.overview?.curriculumCompletion ?? selectedStudent.curriculumCompletion}%` : '—'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {dossier?.overview?.completedTopicsCount != null ? `${dossier.overview.completedTopicsCount} / ${dossier.overview.totalTopicsCount} topics` : 'Live topics'}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Average Test Score</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (dossier?.overview?.averageTestScore ?? selectedStudent.testAverage) < 60 ? '#EF4444' : 'var(--accent-primary)', marginTop: '2px' }}>
                  {(dossier?.overview?.averageTestScore ?? selectedStudent.testAverage) !== null ? `${dossier?.overview?.averageTestScore ?? selectedStudent.testAverage}%` : '—'}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {dossier?.tests?.length ? `${dossier.tests.length} test(s) taken` : 'Strictly tests'}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Homework Submitted</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                  {dossier?.overview?.homeworkSubmitted ?? selectedStudent.homeworkSubmitted ?? 0} / {dossier?.overview?.totalHomework ?? selectedStudent.totalAssignments ?? 4}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Submitted & Graded</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Homework</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (dossier?.overview?.pendingHomework ?? selectedStudent.homeworkPending) > 0 ? '#D97706' : '#059669', marginTop: '2px' }}>
                  {dossier?.overview?.pendingHomework ?? selectedStudent.homeworkPending ?? 0}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Awaiting Submission</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Integrity Events</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: (dossier?.overview?.violationCount ?? selectedStudent.violationCount) > 0 ? '#EF4444' : '#059669', marginTop: '2px' }}>
                  {dossier?.overview?.violationCount ?? selectedStudent.violationCount ?? 0}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Exam Telemetry</div>
              </div>
            </div>

            {/* Dossier Tabs Navigation */}
            <div
              style={{
                display: 'flex',
                gap: '0.4rem',
                borderBottom: '1px solid var(--border-default)',
                paddingBottom: '0.5rem',
                overflowX: 'auto'
              }}
            >
              {[
                { id: 'overview', label: 'Subject Progress & Units' },
                { id: 'tests', label: `Tests & Examinations (${dossier?.tests?.length || 0})` },
                { id: 'homework', label: `Homework Tasks (${dossier?.homework?.length || 0})` },
                { id: 'integrity', label: `Assessment Integrity (${dossier?.integrityEvents?.length || 0})` },
                { id: 'notes', label: 'Teacher Notes' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDossierTab(tab.id)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: dossierTab === tab.id ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
                    color: dossierTab === tab.id ? '#2563EB' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB 1: Subject Progress & Unit Breakdown */}
            {dossierTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(dossier?.subjectProgress || []).map((subj, sIdx) => (
                  <div key={sIdx} className="card" style={{ padding: '1.25rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {subj.subject} ({subj.code})
                        </h4>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Teacher: {subj.teacher}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563EB' }}>
                          {subj.curriculumCompletion}% Complete
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {subj.completedTopics} of {subj.totalTopics} topics mastered
                        </div>
                      </div>
                    </div>

                    {/* Unit Breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {(subj.units || []).map((u, uIdx) => (
                        <div
                          key={uIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-secondary)',
                            fontSize: '0.8rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {u.status === 'completed' ? (
                              <CheckCircle2 size={16} color="#059669" />
                            ) : u.status === 'in_progress' ? (
                              <Clock size={16} color="#2563EB" />
                            ) : (
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--text-muted)' }} />
                            )}
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              Unit {u.unitNumber}: {u.unitName}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              {u.completedCount} / {u.topicsCount} topics
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor:
                                  u.status === 'completed'
                                    ? 'rgba(5, 150, 105, 0.12)'
                                    : u.status === 'in_progress'
                                    ? 'rgba(37, 99, 235, 0.12)'
                                    : 'rgba(100, 116, 139, 0.12)',
                                color:
                                  u.status === 'completed'
                                    ? '#059669'
                                    : u.status === 'in_progress'
                                    ? '#2563EB'
                                    : 'var(--text-muted)'
                              }}
                            >
                              {u.status === 'completed' ? '✓ Mastered' : u.status === 'in_progress' ? 'Current Unit' : 'Upcoming'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: Tests & Examinations */}
            {dossierTab === 'tests' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!dossier?.tests || dossier.tests.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                    No recorded assessment attempts for this student.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Assessment</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Score</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Date</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Integrity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossier.tests.map((t, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {t.title}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{t.subject}</td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: t.percentage != null && t.percentage < 60 ? '#EF4444' : '#059669' }}>
                              {t.score != null ? `${t.score} / ${t.maxScore} (${t.percentage}%)` : '—'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(5, 150, 105, 0.1)', color: '#059669', textTransform: 'capitalize' }}>
                                {t.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{t.date}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              {t.violationCount > 0 ? (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#EF4444' }}>
                                  ⚠️ {t.violationCount} event(s)
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.7rem', color: '#059669' }}>Clean</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Homework Tasks */}
            {dossierTab === 'homework' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!dossier?.homework || dossier.homework.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem' }}>
                    No homework assigned to this cohort.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Assignment</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Due Date</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Score</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossier.homework.map((h, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {h.title}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{h.subject}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{h.dueDate}</td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor:
                                    h.status === 'graded'
                                      ? 'rgba(5, 150, 105, 0.12)'
                                      : h.status === 'submitted'
                                      ? 'rgba(37, 99, 235, 0.12)'
                                      : h.status === 'needs_revision'
                                      ? 'rgba(239, 68, 68, 0.12)'
                                      : 'rgba(217, 119, 6, 0.12)',
                                  color:
                                    h.status === 'graded'
                                      ? '#059669'
                                      : h.status === 'submitted'
                                      ? '#2563EB'
                                      : h.status === 'needs_revision'
                                      ? '#EF4444'
                                      : '#D97706',
                                  textTransform: 'capitalize'
                                }}
                              >
                                {h.status === 'graded' ? 'Graded' : h.status === 'submitted' ? 'Submitted' : h.status === 'needs_revision' ? 'Revision Needed' : 'Pending'}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: h.score != null ? '#059669' : 'var(--text-muted)' }}>
                              {h.score != null ? `${h.score} / ${h.maxScore}` : '—'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)', fontSize: '0.76rem' }}>
                              {h.feedback || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Assessment Integrity Telemetry Log */}
            {dossierTab === 'integrity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(!dossier?.integrityEvents || dossier.integrityEvents.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#059669', fontSize: '0.84rem', backgroundColor: 'rgba(5, 150, 105, 0.05)', borderRadius: '10px' }}>
                    <CheckCircle2 size={24} style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                    Zero integrity violations recorded across all proctored assessments.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-default)', textAlign: 'left' }}>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Event Type</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Severity</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Reason / Observation</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Assessment</th>
                          <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dossier.integrityEvents.map((ev, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-default)' }}>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {ev.eventType}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem' }}>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor:
                                    ev.severity === 'high' || ev.severity === 'critical'
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : ev.severity === 'medium'
                                      ? 'rgba(217, 119, 6, 0.15)'
                                      : 'rgba(100, 116, 139, 0.12)',
                                  color:
                                    ev.severity === 'high' || ev.severity === 'critical'
                                      ? '#DC2626'
                                      : ev.severity === 'medium'
                                      ? '#D97706'
                                      : 'var(--text-secondary)',
                                  textTransform: 'uppercase'
                                }}
                              >
                                {ev.severity}
                              </span>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)' }}>{ev.reason}</td>
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ev.assessmentTitle}</td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{ev.timestamp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: Teacher Instructional Notes */}
            {dossierTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Persistent Instructional Observations & Action Plan
                  </label>
                  <span style={{ fontSize: '0.72rem', color: savingNote ? '#2563EB' : 'var(--text-muted)' }}>
                    {savingNote ? 'Saving to MongoDB...' : 'Persisted in MongoDB with Tenant Isolation'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Record student interventions, parent communications, or specific conceptual weaknesses..."
                  value={teacherNote}
                  disabled={loadingNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    resize: 'vertical'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => handleSaveTeacherNote(teacherNote)}
                    disabled={savingNote || loadingNote}
                    className="btn-primary"
                    style={{ fontSize: '0.78rem', padding: '0.4rem 1rem', borderRadius: '8px' }}
                  >
                    {savingNote ? 'Saving...' : 'Save Note to Database'}
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-default)' }}>
              <button
                onClick={() => handleResetStudentPassword(selectedStudent._id || selectedStudent.studentId)}
                disabled={isResettingPassword}
                className="btn-secondary"
                style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <KeyRound size={14} />
                <span>{isResettingPassword ? 'Resetting...' : 'Reset Student Password'}</span>
              </button>

              <button
                onClick={() => setSelectedStudent(null)}
                className="btn-primary"
                style={{ fontSize: '0.84rem', padding: '0.5rem 1.25rem' }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
