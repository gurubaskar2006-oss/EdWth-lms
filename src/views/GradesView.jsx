import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  Award,
  TrendingUp,
  Download,
  CheckCircle2,
  Sparkles,
  BarChart3,
  BookOpen,
  GraduationCap,
  ChevronRight,
  Percent
} from 'lucide-react';

export const GradesView = () => {
  usePageTitle('Grades');
  const { gradesData, addToast } = useLMS();
  const [selectedCourseCode, setSelectedCourseCode] = useState('CS 401');

  if (!gradesData || !gradesData.courses || gradesData.courses.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '1100px', alignItems: 'center', padding: '4rem 1rem' }}>
        <Award size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <h2 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 800 }}>No Grades Available</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You don't have any grades published for this term yet.</p>
      </div>
    );
  }

  const selectedCourse = gradesData.courses.find((c) => c.code === selectedCourseCode) || gradesData.courses[0];

  const handleExportTranscript = () => {
    addToast("Transcript Exported 📄", "Official academic transcript downloaded as PDF.", "emerald");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1100px' }}>
      {/* 1. Header */}
      <div
        style={{
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
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-indigo-subtle)',
              color: 'var(--accent-indigo)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}
          >
            <Award size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.45rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              Grades & Academic GPA
            </h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
              Dean's High Honors List • Fall 2026 Academic Term
            </span>
          </div>
        </div>

        <button
          onClick={handleExportTranscript}
          className="btn-secondary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', gap: '6px' }}
        >
          <Download size={14} />
          <span>Export PDF Transcript</span>
        </button>
      </div>

      {/* 2. GPA Stats Ribbon */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}
      >
        {/* Cumulative GPA */}
        <div
          className="card"
          style={{
            padding: '1.15rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--accent-indigo)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
              Cumulative GPA
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {gradesData.cumulativeGpa}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-indigo)', fontWeight: 700 }}>
                Top 5%
              </span>
            </div>
          </div>
          <Award size={22} color="var(--accent-indigo)" />
        </div>

        {/* Current Term GPA */}
        <div
          className="card"
          style={{
            padding: '1.15rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--accent-primary)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
              Term GPA
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {gradesData.termGpa}.00
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
                Dean's List
              </span>
            </div>
          </div>
          <TrendingUp size={22} color="var(--accent-primary)" />
        </div>

        {/* Earned Credits */}
        <div
          className="card"
          style={{
            padding: '1.15rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderLeft: '4px solid var(--accent-blue)',
            backgroundColor: 'var(--bg-card)'
          }}
        >
          <div>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block' }}>
              Credits Earned
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {gradesData.creditsEarned}
              </span>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                / 120 Total
              </span>
            </div>
          </div>
          <GraduationCap size={22} color="var(--accent-blue)" />
        </div>
      </div>

      {/* 3. 2-Column Split: Course List & Rubric */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: '1.25rem',
          alignItems: 'start'
        }}
      >
        {/* Course Grades Table */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Enrolled Courses ({gradesData.courses.length})
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Select to view breakdown
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {gradesData.courses.map((c) => {
              const isSelected = selectedCourseCode === c.code;

              return (
                <div
                  key={c.code}
                  onClick={() => setSelectedCourseCode(c.code)}
                  style={{
                    padding: '0.85rem 1.25rem',
                    borderBottom: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : 'transparent',
                    borderLeft: isSelected ? '4px solid var(--accent-blue)' : '4px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                    <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>
                      {c.code}
                    </span>

                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        Avg {c.classAvg}% • Rank: {c.rank}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-display)' }}>
                        {c.grade}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {c.score}%
                      </div>
                    </div>
                    <ChevronRight size={15} color={isSelected ? 'var(--accent-blue)' : 'var(--text-muted)'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Course Grade Rubric Breakdown */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.65rem' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedCourse.code} Rubric
              </span>
              <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 800, margin: 0 }}>
                Weight & Scores
              </h4>
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
              {selectedCourse.score}% ({selectedCourse.grade})
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {selectedCourse.breakdown.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.item}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Weight: {item.weight}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      color:
                        item.status === 'Graded'
                          ? 'var(--accent-primary)'
                          : item.status === 'In Grading'
                          ? '#D97706'
                          : 'var(--text-secondary)'
                    }}
                  >
                    {item.status === 'Graded' ? `${item.score}%` : item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
