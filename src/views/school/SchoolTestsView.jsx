import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Calendar, Clock, MapPin, Award, CheckCircle2, AlertCircle, Shield, Code2, Play, HelpCircle } from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

export const SchoolTestsView = ({ onOpenAssessmentModal }) => {
  usePageTitle('Tests & Assessments');
  const { schoolTests, schoolResults } = useLMS();
  const [showHelp, setShowHelp] = useState(false);

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
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-primary)' }}>
            Scheduled Upcoming Tests
          </h2>
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
            ) : (
              (schoolTests || []).map((t) => (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: '1.5rem',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
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
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#D97706' }}>
                      {t.day}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 0.75rem', color: 'var(--text-primary)' }}>
                    {t.title}
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Calendar size={15} />
                      <span>{t.date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <Clock size={15} />
                      <span>{t.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <MapPin size={15} />
                      <span>Exam Venue: {t.room}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.9rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      fontSize: '0.78rem',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Shield size={14} color="#059669" />
                    <span>Assessment Environment: Fullscreen & Window Monitoring</span>
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
                  
                  {t.status === 'Evaluated' ? (
                    <span style={{ color: '#059669', fontWeight: 800, fontSize: '0.85rem' }}>
                      ✓ Evaluated: {t.score}/{t.totalMarks} ({t.percentage}%)
                    </span>
                  ) : t.status === 'Submitted' ? (
                    <span style={{ color: '#2563EB', fontWeight: 700, fontSize: '0.82rem' }}>
                      ⏳ Submitted (Awaiting Marks)
                    </span>
                  ) : t.status === 'Disqualified' ? (
                    <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '0.82rem' }}>
                      ⚠️ Disqualified
                    </span>
                  ) : t.status === 'Missed' ? (
                    <span style={{ color: '#EF4444', fontWeight: 600, fontSize: '0.82rem' }}>
                      Missed Window
                    </span>
                  ) : t.challenge ? (
                    <button
                      onClick={() => onOpenAssessmentModal && onOpenAssessmentModal({
                        ...t.challenge,
                        durationMinutes: t.durationMinutes || (t.isCodingExam ? 90 : 45)
                      })}
                      className="btn-primary"
                      style={{
                        padding: '0.45rem 1.1rem',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>Start Coding Test</span>
                    </button>
                  ) : (
                    <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.82rem' }}>Scheduled: {t.date}</span>
                  )}
                </div>
              </div>
            )))}
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
