import React, { useState, useEffect } from 'react';
import { useLMS } from './context/LMSContext';
import { Header } from './components/Header';
import { ToastNotifications } from './components/ToastNotifications';
import { NotFoundView } from './views/NotFoundView';
import { SettingsView } from './views/SettingsView';
import { UnauthenticatedView } from './components/UnauthenticatedView';
import { TrainerAttendanceView } from './views/TrainerAttendanceView';
import { StudentsDataSheetView } from './views/StudentsDataSheetView';
import { SchoolTeacherStudentsView } from './views/trainer/SchoolTeacherStudentsView';
import { AcademicCalendarView } from './views/trainer/AcademicCalendarView';
import { apiService } from './services/apiService';
import { socketService } from './services/socketService';
import {
  ClassesView,
  CoursesView,
  AssignmentsManagementView,
  TestsManagementView,
  MaterialsView,
  ProjectsManagementView,
  StudentPerformanceView,
  GradesRegisterView,
  AnnouncementsManagementView,
  DoubtsHelpdeskView,
  EducatorScheduleView,
  AttendanceReportsView,
  AssignmentReportsView,
  AssessmentIntegrityView
} from './views/trainer/TrainerSections';
import {
  LayoutDashboard,
  CheckSquare,
  Radio,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
  Building2,
  Users,
  BookOpen,
  TrendingUp,
  Clock,
  AlertTriangle,
  Shield,
  ShieldAlert,
  GraduationCap,
  UsersRound,
  FileCode,
  Award,
  CheckCircle2,
  X,
  Search,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Send,
  Zap,
  Percent,
  Calendar,
  FileText,
  HelpCircle,
  ListCheck
} from 'lucide-react';

// ─── Interactive Grade Submission Modal ──────────────────────────────────────
const GradeSubmissionModal = ({ isOpen, onClose, submission, onGraded }) => {
  const maxScore = submission?.maxScore || 20;
  const [score, setScore] = useState(submission?.score != null ? submission.score : '');
  const [feedback, setFeedback] = useState(submission?.feedback || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (submission) {
      setScore(submission.score != null ? submission.score : '');
      setFeedback(submission.feedback || '');
      setError('');
    }
  }, [submission]);

  if (!isOpen || !submission) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > maxScore) {
      setError(`Score must be a number between 0 and ${maxScore}.`);
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiService._fetch(`/api/v1/trainer/assignments/${submission._id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: submission.studentId,
          score: numScore,
          feedback: feedback.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onGraded({ ...submission, score: numScore, feedback: feedback.trim(), status: 'graded' });
        onClose();
      } else {
        setError(data.message || 'Failed to submit grade.');
      }
    } catch {
      setError('Network error while submitting grade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnForRevision = async () => {
    if (!feedback.trim()) {
      setError('Constructive instructor feedback is required when returning work for revision.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await apiService._fetch(`/api/v1/trainer/assignments/${submission._id}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: submission.studentId,
          score: score !== '' ? Number(score) : null,
          feedback: feedback.trim(),
          status: 'needs_revision'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onGraded({ ...submission, score: score !== '' ? Number(score) : null, feedback: feedback.trim(), status: 'needs_revision' });
        onClose();
      } else {
        setError(data.message || 'Failed to return submission for revision.');
      }
    } catch {
      setError('Network error while returning submission for revision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '620px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={20} color="#6366F1" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                Grade Student Submission
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                {submission.studentName} ({submission.studentId}) · {submission.assignmentTitle}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" style={{ width: '32px', height: '32px' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ padding: '0.65rem 0.85rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={15} /><span>{error}</span>
          </div>
        )}

        {/* Submission Content Preview */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Submitted Work ({submission.courseCode || 'School Homework'})
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              {submission.codeSnippet ? 'Code Solution' : 'Student Submission'}
            </span>
          </div>
          <pre style={{
            padding: '1rem',
            borderRadius: '8px',
            backgroundColor: '#0F172A',
            color: '#E2E8F0',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            overflowX: 'auto',
            maxHeight: '180px',
            border: '1px solid #1E293B',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0
          }}>
            <code>{submission.codeSnippet || submission.submissionText || '(No text content provided)'}</code>
          </pre>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Score (out of {maxScore})
            </label>
            <input
              type="number"
              min="0"
              max={maxScore}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              required
              style={{ width: '120px', fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Instructor Feedback
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide constructive feedback for the student..."
              required
              style={{ width: '100%', fontSize: '0.86rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
            <button
              type="button"
              onClick={handleReturnForRevision}
              className="btn-secondary"
              disabled={isSubmitting}
              style={{ borderColor: 'rgba(217, 119, 6, 0.4)', color: '#D97706', backgroundColor: 'rgba(217, 119, 6, 0.08)' }}
            >
              Return for Revision
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ backgroundColor: '#6366F1', borderColor: '#6366F1' }}>
              {isSubmitting ? 'Submitting Grade...' : 'Publish Verified Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Trainer Dashboard ────────────────────────────────────────────────────────
const TrainerDashboard = ({ onNavigateTab, onOpenGradingModal }) => {
  const { user, onlineStats, terms } = useLMS();
  const [analytics, setAnalytics] = useState(null);
  const [classesList, setClassesList] = useState([]);
  const [homeworkList, setHomeworkList] = useState([]);
  const [testsList, setTestsList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiService._fetch('/api/v1/trainer/analytics').then(r => r.ok ? r.json() : null),
      apiService.getTrainerClasses(),
      apiService.getTrainerHomework(),
      apiService.getTrainerTests(),
      apiService.getTrainerStudents()
    ])
      .then(([aData, cData, hwData, tData, sData]) => {
        if (aData?.success) setAnalytics(aData.data);
        if (cData?.success && Array.isArray(cData.classes)) setClassesList(cData.classes);
        if (hwData?.success && Array.isArray(hwData.assignments)) setHomeworkList(hwData.assignments);
        if (tData?.success && Array.isArray(tData.tests)) setTestsList(tData.tests);
        if (sData?.success && Array.isArray(sData.students)) setStudentsList(sData.students);
      })
      .catch((err) => console.error('Error loading trainer overview:', err))
      .finally(() => setLoading(false));
  }, []);

  // Authoritative calculations from real persisted records
  const totalAssignedStudents = analytics?.totalStudents ?? studentsList.length;

  // Real count of homework submissions awaiting teacher review
  const awaitingReviewSubmissions = homeworkList.reduce((acc, hw) => {
    const pendingSubs = (hw.submissions || []).filter(s => s.status === 'submitted').length;
    return acc + pendingSubs;
  }, 0);

  // Fallback to analytics pending if submissions array is unpopulated
  const pendingSubmissionsCount = awaitingReviewSubmissions > 0
    ? awaitingReviewSubmissions
    : (analytics?.totalSubmissions !== undefined && analytics?.gradedSubmissions !== undefined)
    ? Math.max(0, analytics.totalSubmissions - analytics.gradedSubmissions)
    : 0;

  // Real count of upcoming scheduled tests
  const upcomingTestsCount = testsList.length;

  // Real students needing academic attention (attendance < 75% or testAverage < 60% or status !== 'Active')
  const studentsNeedingAttention = studentsList.filter(
    s => (s.attendanceRate !== null && s.attendanceRate < 75) || (s.testAverage !== null && s.testAverage < 60) || s.status !== 'Active'
  ).length;

  // Real cohort attendance average
  const avgAttendance = classesList.length > 0
    ? Math.round(classesList.reduce((acc, c) => acc + (c.attendanceRate || 0), 0) / classesList.length)
    : (analytics?.attendanceRate != null ? analytics.attendanceRate : null);

  // Submission review rate (% of submitted homework that has been evaluated)
  const submissionReviewRate = (analytics?.totalSubmissions && analytics.totalSubmissions > 0)
    ? Math.round((analytics.gradedSubmissions / analytics.totalSubmissions) * 100)
    : null;

  const kpis = [
    {
      icon: Users,
      label: 'Assigned Students',
      value: totalAssignedStudents,
      sub: classesList[0]?.name || 'Active Cohort',
      color: '#059669',
      onClick: () => onNavigateTab('students')
    },
    {
      icon: Radio,
      label: 'Live Active Learners',
      value: onlineStats?.students ?? 0,
      sub: 'Real-time presence',
      color: '#6366F1',
      onClick: () => onNavigateTab('attendance')
    },
    {
      icon: CheckSquare,
      label: 'Submissions to Review',
      value: pendingSubmissionsCount,
      sub: 'Awaiting grading',
      color: '#D97706',
      onClick: () => onNavigateTab('homework')
    },
    {
      icon: Award,
      label: 'Upcoming Tests',
      value: upcomingTestsCount,
      sub: 'Scheduled exams',
      color: '#7C3AED',
      onClick: () => onNavigateTab('tests')
    },
    {
      icon: Percent,
      label: 'Cohort Attendance',
      value: avgAttendance != null ? `${avgAttendance}%` : '—',
      sub: avgAttendance != null ? 'Term average' : 'No records yet',
      color: '#2563EB',
      onClick: () => onNavigateTab('attendance')
    },
    {
      icon: AlertTriangle,
      label: 'Needing Attention',
      value: studentsNeedingAttention,
      sub: 'Low attendance / marks',
      color: studentsNeedingAttention > 0 ? '#DC2626' : '#059669',
      onClick: () => onNavigateTab('students')
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1360px', margin: '0 auto' }}>
      {/* 1. Welcome & Faculty Command Header */}
      <div
        className="card"
        style={{
          padding: '1.75rem 2rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(37, 99, 235, 0.08) 50%, rgba(5, 150, 105, 0.06) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 4px 18px rgba(0,0,0,0.03)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#6366F1',
                border: '1px solid rgba(99, 102, 241, 0.3)'
              }}
            >
              FACULTY CONSOLE ACTIVE
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {user?.tenantName || user?.institution || user?.organization || 'Academic Institution'} · {classesList[0]?.name || 'All Assigned Cohorts'}
            </span>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 0.35rem', color: 'var(--text-primary)' }}>
            Welcome back, {user?.name || terms?.educatorLabel || 'Educator'}! 👋
          </h1>
          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.5 }}>
            Here is your daily instruction console: track student attendance, grade incoming homework, schedule assessments, and review cohort mastery.
          </p>
        </div>

        {/* Primary Command Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="btn-primary"
            style={{
              backgroundColor: '#059669',
              borderColor: '#059669',
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.55rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
            }}
          >
            <Radio size={16} />
            <span>Launch Live Attendance</span>
          </button>

          <button
            onClick={() => onNavigateTab('homework')}
            className="btn-primary"
            style={{
              backgroundColor: '#6366F1',
              borderColor: '#6366F1',
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.55rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)'
            }}
          >
            <CheckSquare size={16} />
            <span>Review Submissions ({pendingSubmissionsCount})</span>
          </button>

          <button
            onClick={() => onNavigateTab('calendar')}
            className="btn-secondary"
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '0.55rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Calendar size={16} />
            <span>Academic Calendar</span>
          </button>
        </div>
      </div>

      {/* 2. Responsive 6-Card KPI Grid with Stable Dimensions & No Awkward Wrapping */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
          gap: '1rem'
        }}
      >
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div
              key={i}
              onClick={k.onClick}
              className="card card-interactive"
              style={{
                padding: '1.25rem 1.35rem',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '125px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {k.label}
                </span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: `${k.color}15`,
                    color: k.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={18} />
                </div>
              </div>

              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {loading ? '—' : k.value}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
                  {k.sub}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Balanced Dual Work Panels (Connected Instruction & Timetable Schedule) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Left Panel: Today's Classes & Next Deadlines */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Clock size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Today's Instruction & Deadlines
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Daily timetable and upcoming deliverables
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('calendar')}
                className="btn-text"
                style={{ fontSize: '0.78rem', color: '#2563EB', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span>Full Calendar</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Teaching Schedule Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {classesList && classesList.length > 0 ? (
                classesList.slice(0, 3).map((cls, idx) => (
                  <div
                    key={cls.id || idx}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cls.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {cls.studentCount || cls.students || 0} Learners Enrolled · Room {cls.room || '101'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: '#2563EB'
                        }}
                      >
                        {cls.schedule || 'Active Cohort'}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border-default)', borderRadius: '10px' }}>
                  No scheduled teaching sessions for today. Classes assigned to your profile will appear here.
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Next Assignment Deadline:{' '}
              {(() => {
                const upcomingHw = (homeworkList || [])
                  .filter((h) => h.dueDate || h.dueTimestamp)
                  .sort((a, b) => new Date(a.dueDate || a.dueTimestamp) - new Date(b.dueDate || b.dueTimestamp))[0];
                return upcomingHw ? (
                  <strong>
                    {upcomingHw.title} ({upcomingHw.dueDate ? new Date(upcomingHw.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Upcoming'})
                  </strong>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>No upcoming deadlines</span>
                );
              })()}
            </span>
            <button onClick={() => onNavigateTab('homework')} className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem' }}>
              View Homework
            </button>
          </div>
        </div>

        {/* Right Panel: Active Cohorts & Instruction Velocity Summary */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99, 102, 241, 0.12)',
                    color: '#6366F1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Building2 size={19} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Active Cohorts Under Instruction
                  </h3>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Assigned class enrollment and progress
                  </span>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab('students')}
                className="btn-text"
                style={{ fontSize: '0.78rem', color: '#6366F1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <span>Student Roster</span>
                <ArrowRight size={13} />
              </button>
            </div>

            {/* Active Classes Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {classesList.length === 0 ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No active cohorts assigned.
                </div>
              ) : (
                classesList.map((c, i) => (
                  <div
                    key={c.id || i}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {c.students || c.studentCount || 0} Registered Students · Room {c.room || '101'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#059669' }}>
                        {c.attendanceRate != null ? `${c.attendanceRate}%` : '—'}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Attendance</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Instruction Summary Velocity Bars */}
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Homework Review Velocity</span>
                  <span style={{ fontWeight: 800, color: '#6366F1' }}>
                    {submissionReviewRate !== null ? `${submissionReviewRate}% Evaluated` : 'No submissions yet'}
                  </span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div className="progress-bar-fill" style={{ width: `${submissionReviewRate || 0}%`, backgroundColor: '#6366F1' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.25rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Term Attendance Consistency</span>
                  <span style={{ fontWeight: 800, color: '#059669' }}>
                    {avgAttendance !== null ? `${avgAttendance}% Benchmark` : 'No attendance logged'}
                  </span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px' }}>
                  <div className="progress-bar-fill" style={{ width: `${avgAttendance || 0}%`, backgroundColor: '#059669' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => onNavigateTab('attendance')} className="btn-secondary" style={{ fontSize: '0.76rem', padding: '0.35rem 0.75rem' }}>
              Attendance Records
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Grading & Submissions View ───────────────────────────────────────────────
const GradingView = ({ onSelectSubmission }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchSubmissions = () => {
    setLoading(true);
    setError(null);
    apiService._fetch('/api/v1/trainer/submissions')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data?.submissions) {
          setSubmissions(data.submissions);
        } else {
          setSubmissions([]);
        }
      })
      .catch(err => {
        setError(err.message || 'Failed to load assignment submissions.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const isPending = (s) => s.status === 'submitted' || s.status === 'pending' || s.status === 'needs_revision';
  const isGraded = (s) => s.status === 'graded';

  const filtered = submissions.filter(s => {
    if (filter === 'pending') return isPending(s);
    if (filter === 'graded') return isGraded(s);
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Grading & Assignment Submissions
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Review student code implementations, inspect solutions, and submit verified evaluations.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {[
            { id: 'all', label: `ALL (${submissions.length})` },
            { id: 'pending', label: `AWAITING EVALUATION (${submissions.filter(isPending).length})` },
            { id: 'graded', label: `GRADED (${submissions.filter(isGraded).length})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                backgroundColor: filter === f.id ? '#6366F1' : undefined,
                borderColor: filter === f.id ? '#6366F1' : undefined
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
          Submissions Queue ({filtered.length})
        </h3>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading submissions…</p>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid #EF4444', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
            <AlertTriangle size={32} color="#EF4444" style={{ marginBottom: '0.5rem' }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>Error loading submissions</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 1rem' }}>{error}</p>
            <button onClick={fetchSubmissions} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem' }}>
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', border: '2px dashed var(--border-default)', borderRadius: '12px' }}>
            <CheckSquare size={32} color="var(--text-muted)" style={{ marginBottom: '0.75rem' }} />
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>No submissions found</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0 }}>
              All submitted assignments for this filter have been processed.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filtered.map(s => {
              const graded = isGraded(s);
              return (
                <div
                  key={s._id}
                  style={{
                    padding: '1.15rem 1.25rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: graded ? 'rgba(5, 150, 105, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                      border: `1px solid ${graded ? 'rgba(5, 150, 105, 0.3)' : 'rgba(217, 119, 6, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileCode size={20} color={graded ? '#059669' : '#D97706'} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                          {s.assignmentTitle}
                        </span>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                          {s.courseCode}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Student: <strong>{s.studentName}</strong> ({s.studentId}) · Submitted {new Date(s.submittedAt).toLocaleDateString()}
                      </div>
                      {s.feedback && (
                        <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: '4px', fontStyle: 'italic' }}>
                          Feedback: "{s.feedback}"
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {graded ? (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>
                          {s.score != null ? `${s.score}/${s.maxScore || 20}` : '—'}
                        </span>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>VERIFIED GRADE</div>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.65rem',
                        borderRadius: '100px',
                        backgroundColor: 'rgba(217, 119, 6, 0.12)',
                        color: '#D97706',
                        border: '1px solid rgba(217, 119, 6, 0.25)'
                      }}>
                        PENDING EVALUATION
                      </span>
                    )}

                    <button
                      onClick={() => onSelectSubmission(s)}
                      className="btn-primary"
                      style={{
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.8rem',
                        backgroundColor: isGraded ? 'var(--bg-card)' : '#6366F1',
                        color: isGraded ? 'var(--text-primary)' : '#FFF',
                        borderColor: isGraded ? 'var(--border-default)' : '#6366F1'
                      }}
                    >
                      {isGraded ? 'Review / Edit' : 'Grade Submission'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Cohort Performance Analytics View ────────────────────────────────────────
const BatchProgressView = () => {
  const [analytics, setAnalytics] = useState(null);
  const [coursesList, setCoursesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.getTrainerAnalytics(),
      apiService.getTrainerCourses().catch(() => ({ courses: [] }))
    ])
      .then(([data, courseRes]) => {
        if (data?.success) setAnalytics(data.data);
        if (courseRes?.courses) setCoursesList(courseRes.courses);
      })
      .catch(err => {
        setError(err.message || 'Failed to load cohort analytics.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Cohort Performance Analytics
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Aggregated learning metrics on assignment pass rates, attendance consistency, and skill milestones.
          </p>
        </div>
        <button onClick={fetchAnalytics} className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {error ? (
        <div style={{ padding: '2rem', textAlign: 'center', border: '1px solid #EF4444', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <AlertTriangle size={32} color="#EF4444" style={{ marginBottom: '0.5rem' }} />
          <h4 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.35rem' }}>Could Not Load Analytics</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0 0 1rem' }}>{error}</p>
          <button onClick={fetchAnalytics} className="btn-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.9rem' }}>
            Retry Request
          </button>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Enrolled Learners', value: analytics ? (analytics.totalStudents ?? 0) : '—', sub: analytics?.totalStudents ? 'In assigned cohort' : 'No students enrolled', color: '#6366F1' },
              { label: 'Attendance Rate', value: analytics?.attendanceRate != null ? `${analytics.attendanceRate}%` : '—', sub: analytics?.attendanceRate != null ? 'Term benchmark' : 'No attendance recorded', color: '#059669' },
              { label: 'Submissions Graded', value: analytics ? `${analytics.gradedSubmissions || 0} / ${analytics.totalSubmissions || 0}` : '—', sub: 'Evaluated work', color: '#2563EB' },
              { label: 'Average Score', value: analytics?.averageScore != null ? `${analytics.averageScore}%` : '—', sub: analytics?.averageScore != null ? 'Evaluated average' : 'No graded attempts', color: '#D97706' }
            ].map((k, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : k.value}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  {k.label}
                </div>
                <div style={{ fontSize: '0.72rem', color: k.color, fontWeight: 700, marginTop: '0.25rem' }}>
                  {k.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Analytics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.25rem' }}>
                Course-by-Course Milestone Completion
              </h3>

              {coursesList.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                  {coursesList.map((c, i) => {
                    const progress = c.progress || 0;
                    return (
                      <div key={c.id || i}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '0.35rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.code || c.id}</span>
                            <span style={{ color: 'var(--text-secondary)' }}>— {c.title}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#6366F1' }}>{progress}% complete</span>
                        </div>
                        <div className="progress-bar-bg" style={{ height: '8px' }}>
                          <div className="progress-bar-fill" style={{ width: `${progress}%`, backgroundColor: '#6366F1' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '2.5rem', textAlign: 'center', border: '1px dashed var(--border-default)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No course curriculum records assigned to this cohort.
                </div>
              )}
            </div>

            <div className="card" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1rem' }}>
                Learner Engagement Highlights
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total Students Enrolled</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
                    {analytics?.totalStudents ?? 0} Active Learners
                  </div>
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verified Attendance Sessions</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6366F1', marginTop: '2px' }}>
                    {analytics?.totalAttendance ?? 0} Attendances Logged
                  </div>
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Submissions Requiring Evaluation</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563EB', marginTop: '2px' }}>
                    {analytics ? Math.max(0, (analytics.totalSubmissions || 0) - (analytics.gradedSubmissions || 0)) : 0} Pending
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─── TrainerApp Root ──────────────────────────────────────────────────────────
export const TrainerApp = () => {
  const { activeTab, setActiveTab, isAuthenticated, user, logout, terms, addToast } = useLMS();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [assessmentAlerts, setAssessmentAlerts] = useState([]);

  useEffect(() => {
    const unsub = socketService._addListener('assessment:alert', (alert) => {
      setAssessmentAlerts(prev => [alert, ...prev].slice(0, 20));
      if (addToast) {
        if (alert.isTerminated || alert.eventType === 'MAX_WARNINGS_EXCEEDED' || alert.eventType === 'ASSESSMENT_FORCE_TERMINATED') {
          addToast(
            '🚨 Student Auto-Terminated (3 Strikes)',
            `${alert.studentName || 'Student'} (${alert.className || alert.classSection || 'Class'}) reached 3 warnings in "${alert.assessmentTitle || 'Assessment'}" and was automatically removed.`,
            'red'
          );
        } else {
          addToast(
            'Assessment Alert',
            `${alert.studentName || 'Student'} (${alert.className || alert.classSection || 'Class'}): ${alert.eventType?.replace(/_/g, ' ') || 'Assessment Window Exited'}`,
            'amber'
          );
        }
      }
    });
    return unsub;
  }, [addToast]);

  const isSchool = user?.institutionType === 'school' || terms?.institutionType === 'school';
  const currentRole = (user?.role || '').toLowerCase();
  if (!isAuthenticated) {
    return <UnauthenticatedView portalName={`${terms?.educatorLabel || 'Trainer'} Portal`} role="trainer" />;
  }

  // Server-authoritative role redirection
  if (currentRole === 'student') {
    window.location.replace('/');
    return null;
  }
  if (currentRole === 'admin' || currentRole === 'superadmin') {
    window.location.replace('/admin.html');
    return null;
  }
  if (currentRole !== 'trainer' && currentRole !== 'teacher') {
    return <UnauthenticatedView portalName={`${terms?.educatorLabel || 'Trainer'} Portal`} role="trainer" />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <TrainerDashboard
            onNavigateTab={(t) => setActiveTab(t)}
            onOpenGradingModal={(sub) => setSelectedSubmission(sub)}
          />
        );
      case 'students':
        return isSchool ? <SchoolTeacherStudentsView /> : <StudentsDataSheetView />;
      case 'homework':
      case 'assignments':
        return (
          <AssignmentsManagementView
            onNavigateTab={(t) => setActiveTab(t)}
            onOpenGradingModal={(sub) => setSelectedSubmission(sub)}
          />
        );
      case 'tests':
        return <TestsManagementView />;
      case 'calendar':
      case 'schedule':
        return <AcademicCalendarView onNavigateTab={(t) => setActiveTab(t)} />;
      case 'courses':
        return <CoursesView onNavigateTab={(t) => setActiveTab(t)} />;
      case 'attendance':
        return <TrainerAttendanceView />;
      case 'integrity':
        return (
          <AssessmentIntegrityView
            alerts={assessmentAlerts}
            onClearAlerts={() => setAssessmentAlerts([])}
            onNavigateTab={(t) => setActiveTab(t)}
          />
        );
      case 'classes':
        return <ClassesView onNavigateTab={(t) => setActiveTab(t)} />;
      case 'materials':
        return <MaterialsView />;
      case 'projects':
        return <ProjectsManagementView />;
      case 'student-performance':
        return <StudentPerformanceView />;
      case 'grading':
        return (
          <AssignmentsManagementView
            onNavigateTab={(t) => setActiveTab(t)}
            onOpenGradingModal={(sub) => setSelectedSubmission(sub)}
          />
        );
      case 'grades':
        return <GradesRegisterView />;
      case 'announcements':
        return <AnnouncementsManagementView />;
      case 'doubts':
        return <DoubtsHelpdeskView />;
      case 'analytics':
        return <BatchProgressView />;
      case 'attendance-reports':
        return <AttendanceReportsView />;
      case 'assignment-reports':
        return <AssignmentReportsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <NotFoundView />;
    }
  };

  return (
    <div className="app-container">
      {/* Trainer Sidebar with Professional Indigo Accent Styling */}
      <aside className="sidebar">
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: '#171717',
            border: '1px solid rgba(245, 130, 18, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            padding: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <img src="/logo-transparent.png" alt="EdWth" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <h2 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.95rem', margin: 0, letterSpacing: '0.03em' }}>EDWTH LMS</h2>
              <span style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(245, 130, 18, 0.15)', color: '#F58212', fontWeight: 700 }}>
                {terms?.educatorLabel?.toUpperCase() || 'EDUCATOR'}
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '1px' }}>
              EdWth Academy • {terms?.portalSubtitle || 'Faculty Instruction'}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-title">Academic Workflow</div>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`nav-item ${activeTab === 'dashboard' ? 'active active-trainer' : ''}`}
          >
            <LayoutDashboard size={17} /><span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`nav-item ${activeTab === 'students' ? 'active active-trainer' : ''}`}
          >
            <Users size={17} /><span>Students</span>
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`nav-item ${activeTab === 'courses' ? 'active active-trainer' : ''}`}
          >
            <BookOpen size={17} /><span>{terms?.subjectsMenuLabel || (isSchool ? 'Subjects / Curriculum' : 'Courses')}</span>
          </button>
          <button
            onClick={() => setActiveTab('homework')}
            className={`nav-item ${activeTab === 'homework' || activeTab === 'grading' ? 'active active-trainer' : ''}`}
          >
            <CheckSquare size={17} /><span>Homework</span>
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            className={`nav-item ${activeTab === 'tests' ? 'active active-trainer' : ''}`}
          >
            <Award size={17} />
            <span>Tests</span>
            {assessmentAlerts.length > 0 && (
              <span style={{
                marginLeft: 'auto',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                lineHeight: 1.2
              }}>
                {assessmentAlerts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`nav-item ${activeTab === 'calendar' || activeTab === 'schedule' ? 'active active-trainer' : ''}`}
          >
            <Calendar size={17} /><span>Academic Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`nav-item ${activeTab === 'attendance' ? 'active active-trainer' : ''}`}
          >
            <Radio size={17} /><span>Attendance</span>
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`nav-item ${activeTab === 'announcements' ? 'active active-trainer' : ''}`}
          >
            <Zap size={17} /><span>Announcements</span>
          </button>
          <button
            onClick={() => setActiveTab('grades')}
            className={`nav-item ${activeTab === 'grades' ? 'active active-trainer' : ''}`}
          >
            <Percent size={17} /><span>Results / Progress</span>
          </button>

          <div className="sidebar-section-title">Cohort Operations</div>
          <button
            onClick={() => setActiveTab('classes')}
            className={`nav-item ${activeTab === 'classes' ? 'active active-trainer' : ''}`}
          >
            <Building2 size={17} /><span>{terms?.classesMenuLabel || (isSchool ? 'My Classes' : 'My Batches')}</span>
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`nav-item ${activeTab === 'materials' ? 'active active-trainer' : ''}`}
          >
            <FileText size={17} /><span>{terms?.materialsLabel || 'Materials / Notes'}</span>
          </button>
          <button
            onClick={() => setActiveTab('integrity')}
            className={`nav-item ${activeTab === 'integrity' ? 'active active-trainer' : ''}`}
          >
            <ShieldAlert size={17} />
            <span>Assessment Integrity</span>
          </button>
          {!isSchool && (
            <button
              onClick={() => setActiveTab('projects')}
              className={`nav-item ${activeTab === 'projects' ? 'active active-trainer' : ''}`}
            >
              <FileCode size={17} /><span>Projects & Repos</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('doubts')}
            className={`nav-item ${activeTab === 'doubts' ? 'active active-trainer' : ''}`}
          >
            <HelpCircle size={17} /><span>Student Doubts & Q&A</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`nav-item ${activeTab === 'analytics' ? 'active active-trainer' : ''}`}
          >
            <BarChart3 size={17} /><span>Cohort Analytics</span>
          </button>

          <div className="sidebar-section-title">Account</div>
          <button
            onClick={() => setActiveTab('settings')}
            className={`nav-item ${activeTab === 'settings' ? 'active active-trainer' : ''}`}
          >
            <Settings size={17} /><span>Preferences & Profile</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={15} color="#6366F1" />
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.name}</span>
          </div>
          <button
            onClick={() => logout()}
            className="nav-item"
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', padding: '0.45rem 0.65rem' }}
          >
            <LogOut size={15} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <Header />
        {assessmentAlerts.length > 0 && activeTab !== 'tests' && (
          <div style={{
            margin: '1rem 1.5rem 0',
            padding: '0.75rem 1.25rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertTriangle size={15} />
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {assessmentAlerts.length} Active Assessment Alert{assessmentAlerts.length > 1 ? 's' : ''} Received
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Latest: <strong>{assessmentAlerts[0]?.studentName || 'Learner'}</strong> ({assessmentAlerts[0]?.classSection || 'Class'}) — {assessmentAlerts[0]?.eventType?.replace(/_/g, ' ') || 'Assessment Window Exited'} at {new Date(assessmentAlerts[0]?.timestamp || Date.now()).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <button
                onClick={() => setActiveTab('tests')}
                className="btn-primary"
                style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem', backgroundColor: '#ef4444', borderColor: '#ef4444' }}
              >
                Inspect Live Monitor
              </button>
              <button
                onClick={() => setAssessmentAlerts([])}
                className="btn-ghost"
                style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <main className="page-body">
          {renderActiveView()}
        </main>
      </div>

      {/* Grade Modal */}
      <GradeSubmissionModal
        isOpen={Boolean(selectedSubmission)}
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        onGraded={() => {
          addToast('Grade Submitted', 'Verified evaluation recorded successfully.', 'emerald');
        }}
      />

      <ToastNotifications />
    </div>
  );
};
