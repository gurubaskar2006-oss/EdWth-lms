import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { SchoolAttendanceCard } from '../../components/school/SchoolAttendanceCard';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  Award,
  Bell,
  ArrowRight,
  FileText,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Code2,
  AlertTriangle
} from 'lucide-react';

export const SchoolDashboardView = ({ onOpenHomeworkModal }) => {
  usePageTitle('Home');
  const [showHelp, setShowHelp] = useState(false);
  const {
    user,
    portalConfig,
    schoolSubjects,
    schoolHomework,
    schoolTests,
    schoolResults,
    schoolAttendance,
    schoolTodayClasses,
    schoolCalendarEvents,
    schoolAnnouncements,
    setActiveTab
  } = useLMS();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const pendingHomework = (schoolHomework || []).filter((h) => h.status === 'pending');
  const upcomingTestsCount = (schoolTests || []).filter((t) => t.status === 'Upcoming' || t.status === 'Available').length;
  const studentName = user?.name ? user.name.split(' ')[0] : 'Student';

  const isStudent = !user?.role || user.role.toLowerCase() === 'student';
  const hasPhone = Boolean(user?.phone && user.phone.trim());
  const hasAddress = Boolean(user?.address && user.address.trim());
  const hasEmergency = Boolean(user?.emergencyContact?.name?.trim() && user?.emergencyContact?.phone?.trim());
  const missingProfileFields = [];
  if (!hasPhone) missingProfileFields.push('Contact Phone');
  if (!hasAddress) missingProfileFields.push('Address');
  if (!hasEmergency) missingProfileFields.push('Emergency Contact');
  const completedFieldsCount = (hasPhone ? 1 : 0) + (hasAddress ? 1 : 0) + (hasEmergency ? 1 : 0);
  const isProfileComplete = completedFieldsCount === 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
      {/* Profile Completion Alert Banner */}
      {isStudent && !isProfileComplete && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '16px',
            backgroundColor: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <AlertTriangle size={20} color="#D97706" />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#D97706' }}>
                Profile Incomplete ({completedFieldsCount}/3 Details Provided)
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Please submit missing contact details: <strong>{missingProfileFields.join(', ')}</strong>.
              </div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className="btn-primary"
            style={{
              padding: '0.45rem 1rem',
              fontSize: '0.82rem',
              backgroundColor: '#D97706',
              borderColor: '#D97706'
            }}
          >
            Complete Profile
          </button>
        </div>
      )}

      {/* 1. Welcoming Hero Banner */}
      <div
        className="card"
        style={{
          padding: '2rem 2.25rem',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(5, 150, 105, 0.08) 100%)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.2rem 0.65rem',
                borderRadius: '20px',
                backgroundColor: 'rgba(37, 99, 235, 0.12)',
                color: '#2563EB',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                letterSpacing: '0.04em'
              }}
            >
              {user?.tenantName || portalConfig?.companyName || 'Academic Institution'} · {user?.className || user?.major || user?.batchName || 'Academic Cohort'}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Term 2 · Academic Year 2026
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.4rem', color: 'var(--text-primary)' }}>
              {getGreeting()}, {studentName}! 👋
            </h1>
            <button
              onClick={() => setShowHelp(true)}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.8rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '10px'
              }}
              title="Dashboard Help & Guidance"
            >
              <HelpCircle size={15} />
              <span>Section Help</span>
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '560px', lineHeight: 1.5 }}>
            Here is your daily school schedule, homework reminders, and upcoming subject tests. Have a great day learning!
          </p>
        </div>

        {/* Quick Student Badges */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
              minWidth: '110px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#D97706' }}>
              {pendingHomework.length}
            </div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
              Pending Homework
            </div>
          </div>

          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
              minWidth: '110px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#2563EB' }}>
              {upcomingTestsCount}
            </div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
              Upcoming Tests
            </div>
          </div>

          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderRadius: '14px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              textAlign: 'center',
              minWidth: '110px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
            }}
          >
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669' }}>
              {schoolAttendance?.attendanceRate !== null && schoolAttendance?.attendanceRate !== undefined
                ? `${schoolAttendance.attendanceRate}%`
                : '—'}
            </div>
            <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '2px' }}>
              Attendance
            </div>
          </div>
        </div>
      </div>

      {/* 2. Practice Code Lab Spotlight Banner */}
      <div
        className="card card-interactive"
        onClick={() => setActiveTab('codelab')}
        style={{
          padding: '1.35rem 1.75rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.09) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(5, 150, 105, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: '#2563EB',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
              flexShrink: 0
            }}
          >
            <Code2 size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
              <h3 style={{ fontSize: '1.12rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Interactive Practice Code Lab
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '100px',
                  backgroundColor: 'rgba(5, 150, 105, 0.14)',
                  color: '#059669',
                  border: '1px solid rgba(5, 150, 105, 0.3)'
                }}
              >
                Python 3.10 Sandbox Ready
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              Solve guided school exercises across variables, conditionals, loops & functions, and experiment in the safe isolated sandbox.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab('codelab');
            }}
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: '#2563EB',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            <span>Launch Code Lab</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* 3. Today's Classes & Live Attendance (Dual Column on Desktop) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Today's Schedule Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(37, 99, 235, 0.12)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563EB'
                }}
              >
                <Clock size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Today's Classes
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Daily Timetable
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('schedule')}
              className="btn-text"
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              Full Timetable <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(() => {
              const todayYMD = new Date().toISOString().split('T')[0];
              const todayCalEvs = (schoolCalendarEvents || []).filter((e) => {
                const dStr = e.startTime ? new Date(e.startTime).toISOString().split('T')[0] : e.date ? new Date(e.date).toISOString().split('T')[0] : '';
                return dStr === todayYMD;
              });

              const displayItems = todayCalEvs.length > 0
                ? todayCalEvs.map((ev) => ({
                    subject: ev.title,
                    room: ev.room || 'Coding Lab 1',
                    teacher: ev.subject || 'Faculty Instruction',
                    time: ev.startTime && ev.endTime
                      ? `${new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ev.time || '09:00 AM',
                    isCancelled: ev.status === 'cancelled',
                    cancellationReason: ev.cancellationReason
                  }))
                : (schoolTodayClasses || []);

              return displayItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    backgroundColor: item.isCancelled ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-secondary)',
                    border: item.isCancelled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-default)'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: item.isCancelled ? '#EF4444' : 'var(--text-primary)' }}>
                      {item.isCancelled ? `[Cancelled] ${item.subject}` : item.subject}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {item.isCancelled && item.cancellationReason
                        ? `Notice: ${item.cancellationReason}`
                        : `${item.room} · ${item.teacher}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '8px',
                        backgroundColor: item.isCancelled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.08)',
                        color: item.isCancelled ? '#EF4444' : '#2563EB'
                      }}
                    >
                      {item.time.includes('-') ? item.time.split('-')[0].trim() : item.time}
                    </span>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Real-Time Attendance Card */}
        <SchoolAttendanceCard />
      </div>

      {/* 3. My Subjects (Quick Grid) */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              My Subjects
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Enrolled academic subjects for Class 10
            </p>
          </div>
          <div>
            <button
              onClick={() => setActiveTab('subjects')}
              className="btn-text"
              style={{ fontSize: '0.82rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
            >
              View All Subjects <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {(schoolSubjects || []).map((sub) => (
            <div
              key={sub.id}
              onClick={() => setActiveTab('subjects')}
              className="card card-interactive"
              style={{
                padding: '1.25rem',
                borderRadius: '14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '135px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '1.6rem' }}>{sub.icon}</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '12px',
                      backgroundColor: `${sub.color}15`,
                      color: sub.color
                    }}
                  >
                    {sub.progress}% Done
                  </span>
                </div>
                <h4 style={{ fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.2rem', color: 'var(--text-primary)' }}>
                  {sub.name}
                </h4>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {sub.teacher}
                </div>
              </div>

              <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={12} />
                <span>Next: {sub.nextClass}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Homework & Upcoming Tests (Split Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Pending Homework */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Homework
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Assignments due soon
              </p>
            </div>
            <button
              onClick={() => setActiveTab('homework')}
              className="btn-text"
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              All Homework <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(schoolHomework || []).slice(0, 3).map((hw) => {
              const isPending = hw.status === 'pending';
              return (
                <div
                  key={hw.id}
                  style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#2563EB',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {hw.subject}
                    </span>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '2px 0', color: 'var(--text-primary)' }}>
                      {hw.title}
                    </h4>
                    <div style={{ fontSize: '0.76rem', color: isPending ? '#D97706' : '#059669', fontWeight: 600 }}>
                      {isPending ? `Due: ${hw.dueDate}` : `✓ ${hw.grade || 'Submitted'}`}
                    </div>
                  </div>

                  <div>
                    {isPending ? (
                      <button
                        onClick={() => onOpenHomeworkModal && onOpenHomeworkModal(hw)}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: '8px',
                          backgroundColor: '#2563EB',
                          color: '#fff',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        Submit
                      </button>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: '#059669',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <CheckCircle2 size={15} /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Tests */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Upcoming Tests
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Class tests & assessments
              </p>
            </div>
            <button
              onClick={() => setActiveTab('tests')}
              className="btn-text"
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              All Tests <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(schoolTests || []).map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '1rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#7C3AED',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {t.subject}
                  </span>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '2px 0', color: 'var(--text-primary)' }}>
                    {t.title}
                  </h4>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {t.room} · {t.time}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#D97706' }}>
                    {t.day}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {t.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Recent Results & Announcements (Bottom Row) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        {/* Recent Results */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Recent Marks & Results
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Latest graded tests
              </p>
            </div>
            <button
              onClick={() => setActiveTab('tests')}
              className="btn-text"
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              All Marks & Tests <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(schoolResults || []).map((res) => (
              <div
                key={res.id}
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
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                    {res.subject}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {res.assessment}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      color: '#059669',
                      display: 'inline-block'
                    }}
                  >
                    {res.marks} ({res.grade})
                  </span>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {res.date}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* School Announcements */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: '16px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                School Noticeboard
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Important school updates
              </p>
            </div>
            <button
              onClick={() => setActiveTab('announcements')}
              className="btn-text"
              style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              All Notices <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(schoolAnnouncements || []).slice(0, 3).map((notice) => (
              <div
                key={notice.id}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(217, 119, 6, 0.12)',
                      color: '#D97706'
                    }}
                  >
                    {notice.badge}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {notice.date}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  {notice.title}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
                  {notice.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showHelp && (
        <SchoolContextualHelpModal
          section="dashboard"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
