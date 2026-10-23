import React from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { HeroBanner } from '../components/HeroBanner';
import { CourseCard } from '../components/CourseCard';
import {
  BookOpen,
  FileCheck2,
  Award,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Play,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';

export const DashboardView = ({ onOpenSubmitModal }) => {
  usePageTitle('Dashboard');
  const {
    user,
    courses,
    assignments,
    studyAnalytics,
    setActiveTab,
    openCourseInViewer
  } = useLMS();

  const enrolledCourses = courses.filter((c) => c.enrolled);
  const pendingAssignments = assignments.filter((a) => a.status === 'todo' || a.status === 'in_progress');
  const urgentAssignments = assignments.filter((a) => a.priority === 'urgent' && a.status !== 'graded');

  // Overall completion score calculation
  const totalLessonsAllCourses = enrolledCourses.reduce((acc, c) => acc + (c.totalLessons || 0), 0);
  const completedLessonsAllCourses = enrolledCourses.reduce((acc, c) => acc + (c.completedLessons || 0), 0);
  const overallProgress = totalLessonsAllCourses > 0
    ? Math.round((completedLessonsAllCourses / totalLessonsAllCourses) * 100)
    : 0;

  // Primary active course for Continue Learning Hero Card
  // Student profile completion check
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
  // Primary active course for Continue Learning Hero Card
  const activeCourse = enrolledCourses[0] || courses[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Profile Completion Alert Banner */}
      {isStudent && !isProfileComplete && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
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

      {/* 1. Academic Context Banner */}
      <HeroBanner />

      {/* 2. CONTINUE LEARNING — HERO CARD (Highest Visual Weight) */}
      {activeCourse && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Continue Learning
              </span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Active Module In Progress
            </span>
          </div>

          <div
            className="card"
            style={{
              padding: '2rem 2.25rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Subtle brand indicator line at top */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                backgroundColor: 'var(--accent-blue)'
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '2rem'
              }}
            >
              {/* Left Details */}
              <div style={{ flex: 1, minWidth: '320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span className="badge badge-info" style={{ fontSize: '0.74rem', padding: '0.25rem 0.75rem' }}>
                    {activeCourse.code} · Module 6 of 8
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {activeCourse.category || 'Core Computer Science'}
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: '1.45rem',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.3
                  }}
                >
                  {activeCourse.title}
                </h2>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '1.35rem'
                  }}
                >
                  <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Next:</span>
                  <span>Attention Mechanisms & GPT-2 Architecture</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                    <Clock size={13} /> 25 min lecture
                  </span>
                </div>

                {/* Progress Bar & Percentage */}
                <div style={{ maxWidth: '520px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.45rem' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Overall Course Completion</span>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>
                      {activeCourse.progress}% Complete
                    </span>
                  </div>
                  <div className="progress-bar-bg" style={{ height: '8px' }}>
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${activeCourse.progress}%`, backgroundColor: 'var(--accent-blue)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Right Hero Action */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem', flexShrink: 0 }}>
                <button
                  onClick={() => openCourseInViewer(activeCourse.id)}
                  className="btn-blue"
                  style={{
                    padding: '0.85rem 1.85rem',
                    fontSize: '0.96rem',
                    borderRadius: 'var(--radius-lg)',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.22)'
                  }}
                >
                  <Play size={17} fill="currentColor" />
                  <span>Continue Learning →</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={14} color="var(--accent-primary)" />
                  <span>{activeCourse.completedLessons} of {activeCourse.totalLessons} lessons verified</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. ACADEMIC OVERVIEW — 4 SPACIOUS KPI CARDS */}
      <section>
        <div style={{ marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
            Academic Overview
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Key performance metrics for the active term
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* KPI 1: Active Courses */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('courses')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Active Courses</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-blue-subtle)',
                    color: 'var(--accent-blue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <BookOpen size={18} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                {enrolledCourses.length < 10 ? `0${enrolledCourses.length}` : enrolledCourses.length}
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)', paddingTop: '0.65rem' }}>
              <span>15 registered credits this term</span>
            </div>
          </div>

          {/* KPI 2: Tasks & Deadlines */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('assignments')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Tasks</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <FileCheck2 size={18} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                {pendingAssignments.length < 10 ? `0${pendingAssignments.length}` : pendingAssignments.length}
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: urgentAssignments.length > 0 ? '#DC2626' : 'var(--text-secondary)', borderTop: '1px solid var(--border-default)', paddingTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {urgentAssignments.length > 0 && <AlertTriangle size={13} />}
              <span>{urgentAssignments.length > 0 ? `${urgentAssignments.length} urgent deadline this week` : 'All assignments on schedule'}</span>
            </div>
          </div>

          {/* KPI 3: Cumulative GPA */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('grades')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cumulative GPA</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-indigo-subtle)',
                    color: 'var(--accent-indigo)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Award size={18} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                {user.stats?.gpa || user.gpa || '3.92'}
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', borderTop: '1px solid var(--border-default)', paddingTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={13} />
              <span>Dean's Academic Honors</span>
            </div>
          </div>

          {/* KPI 4: Syllabus Progress */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('courses')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Syllabus Progress</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--accent-primary-subtle)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <TrendingUp size={18} />
                </div>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                {overallProgress}%
              </div>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)', paddingTop: '0.65rem' }}>
              <span>{completedLessonsAllCourses} of {totalLessonsAllCourses} curriculum units</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MY COURSES SECTION */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>My Courses</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Active enrolled curriculum and modular roadmaps
            </p>
          </div>
          <button
            onClick={() => setActiveTab('courses')}
            className="btn-ghost"
            style={{ fontSize: '0.82rem', color: 'var(--accent-blue)', gap: '4px', fontWeight: 600 }}
          >
            <span>All Courses</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {enrolledCourses.map((course) => (
            <CourseCard key={course.id} course={course} variant="horizontal" />
          ))}
        </div>
      </section>

      {/* 5 & 6. UPCOMING TASKS & LEARNING ANALYTICS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem' }}>
        {/* Tier 6: Weekly Study Log & Analytics */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>Weekly Study Log</h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                41.8 hours total verified study time this term
              </p>
            </div>
            <span className="badge badge-emerald">On Track</span>
          </div>

          {/* Bar Chart Visualization */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              height: '160px',
              paddingTop: '0.5rem',
              borderBottom: '1px solid var(--border-default)',
              paddingBottom: '0.5rem',
              gap: '0.75rem'
            }}
          >
            {studyAnalytics.weeklyHours.map((item, idx) => {
              const maxHours = 9;
              const barHeightPct = (item.hours / maxHours) * 100;
              const isToday = item.day === 'Fri';

              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.4rem',
                    height: '100%',
                    justifyContent: 'flex-end'
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {item.hours}h
                  </span>
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '34px',
                      height: `${barHeightPct}%`,
                      backgroundColor: isToday ? 'var(--accent-blue)' : '#E2E8F0',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.4s ease'
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent-blue)' : 'var(--text-secondary)'
                    }}
                  >
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Subject Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginTop: '1.25rem' }}>
            {studyAnalytics.subjectDistribution.map((sub, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.76rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sub.color }} />
                <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sub.subject}
                </span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                  {sub.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 5: Upcoming Tasks & Deadlines */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="#D97706" />
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>Upcoming Work</h4>
            </div>
            <button onClick={() => setActiveTab('assignments')} className="btn-ghost" style={{ fontSize: '0.76rem', padding: '3px 8px', color: 'var(--accent-blue)', fontWeight: 600 }}>
              View All
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
            {assignments
              .filter((a) => a.status !== 'graded')
              .slice(0, 3)
              .map((asg) => (
                <div
                  key={asg.id}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`badge ${asg.priority === 'urgent' ? 'badge-urgent' : asg.priority === 'high' ? 'badge-high' : 'badge-emerald'}`}>
                      {asg.priority === 'urgent' ? '⚠ Urgent' : asg.priority}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {asg.dueRelative}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {asg.title}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {asg.courseCode} • {asg.points} pts
                    </span>

                    <button
                      onClick={() => onOpenSubmitModal(asg)}
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.75rem', fontSize: '0.76rem' }}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 7. SECONDARY ENGAGEMENT (Demoted to footer bar) */}
      <section style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Academic Engagement
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                <Clock size={15} color="var(--accent-primary)" />
                <span>Attendance: <strong style={{ color: 'var(--text-primary)' }}>96% Verified</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                <TrendingUp size={15} color="var(--accent-primary)" />
                <span>Study Streak: <strong style={{ color: 'var(--text-primary)' }}>{user.streakDays || 7} Days</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem' }}>
                <Award size={15} color="var(--accent-indigo)" />
                <span>Engagement Credits: <strong style={{ color: 'var(--text-primary)' }}>{user.xp || 3450} XP</strong></span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('leaderboard')}
            className="btn-secondary"
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.85rem' }}
          >
            <span>Cohort Leaderboard</span>
          </button>
        </div>
      </section>
    </div>
  );
};
