import React, { useState, useMemo } from 'react';
import { useLMS } from '../../context/LMSContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Send,
  Eye,
  Check,
  X,
  BookOpen,
  Calendar,
  Award
} from 'lucide-react';
import { SchoolContextualHelpModal } from '../../components/school/SchoolContextualHelpModal';

// Modal to inspect student's own submission and teacher feedback
const ViewSubmissionModal = ({ homework, isOpen, onClose }) => {
  if (!isOpen || !homework) return null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '620px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '18px',
          padding: '1.75rem',
          border: '1px solid var(--border-default)',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.15rem 0.5rem',
                borderRadius: '4px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: '#2563EB',
                textTransform: 'uppercase'
              }}
            >
              {homework.subject}
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0.35rem 0 0', color: 'var(--text-primary)' }}>
              {homework.title}
            </h3>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {/* Status & Marks Banner */}
        <div
          style={{
            padding: '0.85rem 1.15rem',
            borderRadius: '12px',
            backgroundColor:
              homework.status === 'graded'
                ? 'rgba(5, 150, 105, 0.08)'
                : homework.status === 'needs_revision'
                ? 'rgba(239, 68, 68, 0.08)'
                : 'rgba(37, 99, 235, 0.08)',
            border: `1px solid ${
              homework.status === 'graded'
                ? 'rgba(5, 150, 105, 0.25)'
                : homework.status === 'needs_revision'
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(37, 99, 235, 0.25)'
            }`,
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}
        >
          <div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Submission State</div>
            <div
              style={{
                fontSize: '0.94rem',
                fontWeight: 800,
                color:
                  homework.status === 'graded'
                    ? '#059669'
                    : homework.status === 'needs_revision'
                    ? '#DC2626'
                    : '#2563EB'
              }}
            >
              {homework.status === 'graded'
                ? 'Graded & Evaluated'
                : homework.status === 'needs_revision'
                ? 'Revision Requested'
                : 'Turned In — Awaiting Teacher Review'}
            </div>
          </div>

          {homework.status === 'graded' && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Awarded Marks</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>
                {homework.score ?? homework.grade} / {homework.points || 20}
              </div>
            </div>
          )}
        </div>

        {/* Teacher Feedback if available */}
        {homework.feedback && (
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              marginBottom: '1rem'
            }}
          >
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>
              Teacher Written Feedback:
            </div>
            <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', fontStyle: 'italic', lineHeight: 1.45 }}>
              "{homework.feedback}"
            </div>
          </div>
        )}

        {/* Submitted Text / Code */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
            Submitted Content:
          </div>
          <pre
            style={{
              padding: '1rem',
              borderRadius: '10px',
              backgroundColor: '#0F172A',
              color: '#E2E8F0',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              maxHeight: '220px',
              overflowY: 'auto',
              border: '1px solid #1E293B',
              margin: 0,
              whiteSpace: 'pre-wrap'
            }}
          >
            {homework.submissionText || '(Submission recorded with attached materials)'}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const SchoolHomeworkView = ({ onOpenHomeworkModal }) => {
  usePageTitle('Homework & Tasks');
  const { schoolHomework } = useLMS();

  // Filters & Search State
  const [statusFilter, setStatusFilter] = useState('all'); // all | todo | submitted | needs_revision | graded | overdue
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('deadline'); // deadline | newest | points
  const [showHelp, setShowHelp] = useState(false);
  const [viewingHomework, setViewingHomework] = useState(null);

  // Derive unique subjects for subject filter dropdown
  const uniqueSubjects = useMemo(() => {
    const set = new Set();
    (schoolHomework || []).forEach((h) => {
      if (h.subject) set.add(h.subject);
    });
    return Array.from(set);
  }, [schoolHomework]);

  // Precise Overdue Calculation (only past due AND not submitted/graded)
  const isHomeworkOverdue = (hw) => {
    if (!hw.dueTimestamp) return false;
    const isPastDue = new Date(hw.dueTimestamp) < new Date();
    return isPastDue && hw.status !== 'submitted' && hw.status !== 'graded';
  };

  // Filtered and Sorted Homework
  const processedHomework = useMemo(() => {
    return (schoolHomework || [])
      .filter((hw) => {
        // Search Filter
        const matchesSearch =
          !searchTerm.trim() ||
          hw.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          hw.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          hw.topic?.toLowerCase().includes(searchTerm.toLowerCase());

        // Subject Filter
        const matchesSubject = subjectFilter === 'ALL' || hw.subject === subjectFilter;

        // Status Filter
        const overdue = isHomeworkOverdue(hw);
        let matchesStatus = true;
        if (statusFilter === 'todo') {
          matchesStatus = hw.status === 'pending' || hw.status === 'needs_revision';
        } else if (statusFilter === 'submitted') {
          matchesStatus = hw.status === 'submitted';
        } else if (statusFilter === 'needs_revision') {
          matchesStatus = hw.status === 'needs_revision';
        } else if (statusFilter === 'graded') {
          matchesStatus = hw.status === 'graded';
        } else if (statusFilter === 'overdue') {
          matchesStatus = overdue;
        }

        return matchesSearch && matchesSubject && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          const dateA = a.dueTimestamp ? new Date(a.dueTimestamp).getTime() : Infinity;
          const dateB = b.dueTimestamp ? new Date(b.dueTimestamp).getTime() : Infinity;
          return dateA - dateB;
        }
        if (sortBy === 'newest') {
          const dateA = a.dueTimestamp ? new Date(a.dueTimestamp).getTime() : 0;
          const dateB = b.dueTimestamp ? new Date(b.dueTimestamp).getTime() : 0;
          return dateB - dateA;
        }
        if (sortBy === 'points') {
          return (b.points || 0) - (a.points || 0);
        }
        return 0;
      });
  }, [schoolHomework, searchTerm, subjectFilter, statusFilter, sortBy]);

  // Aggregate Counts for Filters
  const counts = useMemo(() => {
    const list = schoolHomework || [];
    return {
      all: list.length,
      todo: list.filter((h) => h.status === 'pending' || h.status === 'needs_revision').length,
      submitted: list.filter((h) => h.status === 'submitted').length,
      needs_revision: list.filter((h) => h.status === 'needs_revision').length,
      graded: list.filter((h) => h.status === 'graded').length,
      overdue: list.filter(isHomeworkOverdue).length
    };
  }, [schoolHomework]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* ─── Page Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Homework & Academic Tasks
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
              title="Homework Help & Guidelines"
            >
              <HelpCircle size={17} />
            </button>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Track assigned homework, submit exercises, and view verified teacher marks and feedback.
          </p>
        </div>

        {/* Quick KPI Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(217, 119, 6, 0.1)',
              border: '1px solid rgba(217, 119, 6, 0.25)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Clock size={14} />
            <span>{counts.todo} To Do</span>
          </div>

          {counts.overdue > 0 && (
            <div
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <AlertTriangle size={14} />
              <span>{counts.overdue} Overdue</span>
            </div>
          )}

          <div
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '10px',
              backgroundColor: 'rgba(5, 150, 105, 0.1)',
              border: '1px solid rgba(5, 150, 105, 0.25)',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <CheckCircle2 size={14} />
            <span>{counts.graded} Graded</span>
          </div>
        </div>
      </div>

      {/* ─── Status Filter Tabs ─── */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          backgroundColor: 'var(--bg-secondary)',
          padding: '0.3rem',
          borderRadius: '12px',
          overflowX: 'auto',
          border: '1px solid var(--border-default)'
        }}
      >
        {[
          { key: 'all', label: 'All', count: counts.all },
          { key: 'todo', label: 'To Do', count: counts.todo },
          { key: 'submitted', label: 'Submitted', count: counts.submitted },
          { key: 'needs_revision', label: 'Needs Revision', count: counts.needs_revision },
          { key: 'graded', label: 'Graded', count: counts.graded },
          { key: 'overdue', label: 'Overdue', count: counts.overdue, isAlert: counts.overdue > 0 }
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.95rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: isActive ? 800 : 600,
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{tab.label}</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.05rem 0.4rem',
                  borderRadius: '10px',
                  backgroundColor: tab.isAlert
                    ? '#EF4444'
                    : isActive
                    ? '#2563EB'
                    : 'var(--border-default)',
                  color: tab.isAlert || isActive ? '#FFFFFF' : 'var(--text-secondary)'
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Search, Subject Filter & Sorting Controls ─── */}
      <div
        className="card"
        style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '14px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        {/* Search by Title */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search homework by title, subject or topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.84rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Subject Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Subjects</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                cursor: 'pointer'
              }}
            >
              <option value="deadline">Nearest Deadline</option>
              <option value="newest">Recently Assigned</option>
              <option value="points">Marks / Points</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Compact, Readable Homework List ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {processedHomework.length === 0 ? (
          <div className="card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <FileText size={38} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
              {(!schoolHomework || schoolHomework.length === 0) ? 'No homework has been assigned yet.' : 'No homework matches your filters'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              {(!schoolHomework || schoolHomework.length === 0)
                ? 'When your teacher publishes an assignment for your class, it will appear here.'
                : 'Try adjusting your search query, subject filter, or status tab.'}
            </p>
          </div>
        ) : (
          processedHomework.map((hw) => {
            const isPending = hw.status === 'pending';
            const isNeedsRevision = hw.status === 'needs_revision';
            const isGraded = hw.status === 'graded';
            const isSubmitted = hw.status === 'submitted';
            const isOverdue = isHomeworkOverdue(hw);

            return (
              <div
                key={hw.id || hw._id}
                className="card card-interactive"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-card)',
                  border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-default)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                }}
              >
                {/* Left Block: Subject, Title, Topic & Instructions */}
                <div style={{ flex: 1, minWidth: '300px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        color: '#2563EB',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em'
                      }}
                    >
                      {hw.subject}
                    </span>

                    {hw.topic && (
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        • {hw.topic}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: 'var(--text-muted)'
                      }}
                    >
                      {hw.points || 20} Marks
                    </span>

                    {isOverdue && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(239, 68, 68, 0.12)',
                          color: '#DC2626'
                        }}
                      >
                        OVERDUE
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.3rem', color: 'var(--text-primary)' }}>
                    {hw.title}
                  </h3>

                  <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem', lineHeight: 1.45 }}>
                    {hw.description}
                  </p>

                  {/* Metadata Row: Due Date & Graded Marks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.78rem' }}>
                    <span
                      style={{
                        color: isOverdue ? '#DC2626' : isPending ? '#D97706' : '#059669',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Clock size={13} />
                      <span>Due: {hw.dueDate}</span>
                    </span>

                    {isGraded && (
                      <span style={{ color: '#059669', fontWeight: 800 }}>
                        Score: {hw.score ?? hw.grade} / {hw.points || 20}
                      </span>
                    )}

                    {hw.feedback && (
                      <span style={{ color: '#059669', fontStyle: 'italic', fontSize: '0.76rem' }}>
                        "{hw.feedback}"
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Block: Single Contextual Primary Action Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  {isPending ? (
                    <button
                      onClick={() => onOpenHomeworkModal && onOpenHomeworkModal(hw)}
                      className="btn-primary"
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '9px',
                        backgroundColor: '#2563EB',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                      }}
                    >
                      <Send size={14} />
                      <span>Turn In Homework</span>
                    </button>
                  ) : isNeedsRevision ? (
                    <button
                      onClick={() => onOpenHomeworkModal && onOpenHomeworkModal(hw)}
                      className="btn-primary"
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '9px',
                        backgroundColor: '#DC2626',
                        borderColor: '#DC2626',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <Send size={14} />
                      <span>Revise & Resubmit</span>
                    </button>
                  ) : isGraded ? (
                    <button
                      onClick={() => setViewingHomework(hw)}
                      className="btn-secondary"
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '9px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#059669'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>View Marks & Feedback</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setViewingHomework(hw)}
                      className="btn-secondary"
                      style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '9px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: '#2563EB'
                      }}
                    >
                      <Eye size={15} />
                      <span>View Submission</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Submission Viewer Modal */}
      {viewingHomework && (
        <ViewSubmissionModal
          homework={viewingHomework}
          isOpen={Boolean(viewingHomework)}
          onClose={() => setViewingHomework(null)}
        />
      )}

      {/* Section Contextual Help Modal */}
      {showHelp && (
        <SchoolContextualHelpModal
          section="homework"
          onClose={() => setShowHelp(false)}
        />
      )}
    </div>
  );
};
