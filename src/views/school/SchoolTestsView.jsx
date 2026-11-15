import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Calendar, Clock, MapPin, Award, CheckCircle2, AlertCircle, Shield, Code2, Play, HelpCircle } from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

export const SchoolTestsView = ({ onOpenAssessmentModal }) => {
  usePageTitle('Tests & Assessments');
  const { schoolTests, schoolResults } = useLMS();
  const [showHelp, setShowHelp] = useState(false);
  const [testFilter, setTestFilter] = useState('all'); // 'all' | 'available' | 'upcoming' | 'past'

  const getStudentTestStatus = (t) => {
    if (t.status === 'Evaluated' || t.status === 'Submitted' || t.status === 'Disqualified') {
      return t.status;
    }
    if (t.isAvailableToday || t.status === 'Available') return 'Available';
    if (t.status === 'Missed' || t.status === 'Concluded') return 'Missed';
    if (t.status === 'Upcoming') return 'Upcoming';

    const raw = t.rawDate || t.date;
    if (!raw) return 'Upcoming';
    const examDate = new Date(raw);
    if (isNaN(examDate.getTime())) return t.status || 'Upcoming';

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

    const startOfExam = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate(), 0, 0, 0, 0).getTime();
    const endOfExam = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate(), 23, 59, 59, 999).getTime();

    if (endOfExam < startOfToday) return 'Missed';
    if (startOfExam > endOfToday) return 'Upcoming';
    return 'Available';
  };

  const getStatusBadge = (status, dateStr) => {
    switch (status) {
      case 'Available':
        return { label: '● Available Today', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.3)' };
      case 'Upcoming':
        return { label: '⏳ Upcoming', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)' };
      case 'Submitted':
        return { label: '✓ Submitted', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.1)', border: 'rgba(37, 99, 235, 0.25)' };
      case 'Evaluated':
        return { label: '★ Graded', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: 'rgba(5, 150, 105, 0.3)' };
      case 'Disqualified':
        return { label: '⚠️ Disqualified', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'Missed':
      case 'Concluded':
      default:
        return { label: 'Closed / Past', color: '#6B7280', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.25)' };
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Tests & Assessments
            </h1>
            <button
              onClick={() => setShowHelp(true)}
              className="btn-icon"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              }}
              title="Assessment Rules & Guidance"
            >
              <HelpCircle size={17} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Upcoming computer science examinations, proctored code assessments, and performance history
          </p>
        </div>

        {/* Proctoring Banner Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.5rem 1rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            fontSize: '0.78rem',
            color: '#2563EB',
            fontWeight: 700
          }}
        >
          <Shield size={16} />
          <span>Focused Assessment Mode: Fullscreen Required</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Assigned Assessments
            </h2>

            {/* Student Filter Tabs */}
            {schoolTests && schoolTests.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Tests', count: schoolTests.length },
                  { id: 'available', label: 'Available Today', count: schoolTests.filter((t) => getStudentTestStatus(t) === 'Available').length, color: '#059669' },
                  { id: 'upcoming', label: 'Upcoming', count: schoolTests.filter((t) => getStudentTestStatus(t) === 'Upcoming').length, color: '#2563EB' },
                  { id: 'past', label: 'Completed / Past', count: schoolTests.filter((t) => ['Submitted', 'Evaluated', 'Missed', 'Disqualified'].includes(getStudentTestStatus(t))).length, color: '#6B7280' }
                ].map((tab) => {
                  const isActive = testFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setTestFilter(tab.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: isActive ? `1.5px solid ${tab.color || '#2563EB'}` : '1px solid var(--border-default)',
                        backgroundColor: isActive ? (tab.color ? `${tab.color}15` : 'rgba(37, 99, 235, 0.1)') : 'var(--bg-secondary)',
                        color: isActive ? (tab.color || '#2563EB') : 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          padding: '1px 5px',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: isActive ? (tab.color || '#2563EB') : 'var(--border-default)',
                          color: isActive ? '#FFFFFF' : 'var(--text-secondary)'
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {(!schoolTests || schoolTests.length === 0) ? (
              <div className="card" style={{ padding: '2.5rem', textAlign: 'center', gridColumn: '1 / -1' }}>
                <Calendar size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                  No assessments are available.
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>
                  You are all caught up on examinations and class assessments.
                </p>
              </div>
            ) : (() => {
              const filteredTests = schoolTests.filter((t) => {
                const status = getStudentTestStatus(t);
                if (testFilter === 'available') return status === 'Available';
                if (testFilter === 'upcoming') return status === 'Upcoming';
                if (testFilter === 'past') return ['Submitted', 'Evaluated', 'Missed', 'Disqualified'].includes(status);
                return true;
              });

              if (filteredTests.length === 0) {
                return (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center', gridColumn: '1 / -1' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: 0 }}>
                      No assessments matching the "<strong>{testFilter}</strong>" category.
                    </p>
                  </div>
                );
              }

              return filteredTests.map((t) => {
                const status = getStudentTestStatus(t);
                const badge = getStatusBadge(status, t.date);
                const isAvailable = status === 'Available';
                const isUpcoming = status === 'Upcoming';

                return (
                  <div
                    key={t.id || t._id}
                    className="card"
                    style={{
                      padding: '1.5rem',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-card)',
                      border: isAvailable ? '1.5px solid #059669' : '1px solid var(--border-default)',
                      boxShadow: isAvailable ? '0 4px 20px rgba(5, 150, 105, 0.12)' : '0 4px 14px rgba(0, 0, 0, 0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563EB',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          {t.subject}
                        </span>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          {badge.label}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>
                        {t.title}
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Calendar size={15} />
                          <span>Exam Date: <strong>{t.date}</strong></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <Clock size={15} />
                          <span>Duration: <strong>{t.durationMinutes || 45} mins</strong> ({t.time})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <MapPin size={15} />
                          <span>Venue: {t.room}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: '0.9rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.08)' : 'rgba(37, 99, 235, 0.05)',
                          border: isAvailable ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(37, 99, 235, 0.15)',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <Shield size={14} color={isAvailable ? '#059669' : '#2563EB'} />
                        <span>Assessment Mode: Fullscreen Proctoring & Question Progress Saved</span>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '1.25rem',
                        paddingTop: '0.9rem',
                        borderTop: '1px solid var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 600 }}>Max: {t.totalMarks} Marks</span>

                      {status === 'Evaluated' ? (
                        <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.85rem' }}>
                          ✓ Evaluated: {t.score}/{t.totalMarks} ({t.percentage}%)
                        </span>
                      ) : status === 'Submitted' ? (
                        <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.82rem' }}>
                          ⏳ Submitted (Awaiting Marks)
                        </span>
                      ) : status === 'Disqualified' ? (
                        <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>
                          ⚠️ Disqualified
                        </span>
                      ) : status === 'Missed' ? (
                        <span style={{ color: '#6B7280', fontWeight: 700, fontSize: '0.82rem', padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: 'rgba(107, 114, 128, 0.1)' }}>
                          Window Closed
                        </span>
                      ) : isUpcoming ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: '#2563EB',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            padding: '0.4rem 0.8rem',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(37, 99, 235, 0.08)',
                            border: '1px solid rgba(37, 99, 235, 0.2)'
                          }}
                        >
                          <Clock size={13} />
                          <span>Opens on {t.date}</span>
                        </div>
                      ) : isAvailable ? (
                        <button
                          onClick={() => {
                            const codingQ = (t.questions || []).find((q) => q.type === 'coding');
                            const challengePayload = t.challenge || {
                              id: t.id || t._id,
                              title: t.title,
                              subject: t.subject,
                              language: t.language || codingQ?.language || 'python',
                              description: t.description || `${t.title} (${t.subject})`,
                              questions: t.questions || [],
                              testCases: codingQ?.testCases || [],
                              codeSnippets: codingQ?.starterCode ? { [codingQ.language || 'python']: codingQ.starterCode } : undefined,
                              durationMinutes: t.durationMinutes || 45,
                              totalMarks: t.totalMarks || 100
                            };
                            if (onOpenAssessmentModal) {
                              onOpenAssessmentModal({
                                ...challengePayload,
                                durationMinutes: t.durationMinutes || challengePayload.durationMinutes || 45
                              });
                            }
                          }}
                          className="btn-primary"
                          style={{
                            padding: '0.45rem 1.1rem',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#059669',
                            borderColor: '#059669'
                          }}
                        >
                          <Play size={13} fill="currentColor" />
                          <span>Start Test</span>
                        </button>
                      ) : (
                        <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.82rem' }}>Scheduled: {t.date}</span>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Recently Graded Section */}
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
            Completed Test Marks (AssessmentAttempt)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {(() => {
              const testResultsOnly = (schoolResults || []).filter((r) => r.type === 'test' || (!r.type && !r.remarks?.includes('Homework')));
              if (!testResultsOnly || testResultsOnly.length === 0) {
                return (
                  <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <Award size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                      No graded assessments yet
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', margin: 0 }}>
                      Official test scores and evaluations from AssessmentAttempt records will be published here.
                    </p>
                  </div>
                );
              }
              return testResultsOnly.map((res) => (
                <div
                  key={res.id}
                  className="card"
                  style={{
                    padding: '1.1rem 1.4rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {res.subject} · {res.assessment || res.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Evaluated on {res.date} · {res.remarks}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                      {res.marks}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Grade {res.grade} ({res.percentage}%)
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {showHelp && (
        <SchoolContextualHelpModal
          section="tests"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
