import React, { useState, useEffect, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Search,
  BookOpen,
  FileCheck2,
  CalendarDays,
  Terminal,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';

export const QuickSearchModal = () => {
  const { searchOpen, setSearchOpen, courses, assignments, events, openCourseInViewer, setActiveTab } = useLMS();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const filteredAssignments = assignments.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.courseCode.toLowerCase().includes(query.toLowerCase())
  );

  const filteredEvents = events.filter((e) =>
    e.title.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={() => setSearchOpen(false)}>
      <div
        className="modal-content"
        style={{ maxWidth: '640px', padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-surface)'
          }}
        >
          <Search size={20} color="var(--accent-primary)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a course title, assignment, lecture topic, or lab..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '1rem',
              color: 'var(--text-primary)'
            }}
          />
          <button
            onClick={() => setSearchOpen(false)}
            className="btn-ghost"
            style={{ padding: '0.25rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Results Body */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '1rem' }}>
          {/* Quick Shortcuts if query is empty */}
          {!query && (
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.6rem', padding: '0 0.5rem' }}>
                Quick Navigation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  onClick={() => {
                    setActiveTab('sandbox');
                    setSearchOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <Terminal size={18} color="var(--accent-primary)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Python Lab</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Live Code Runner</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('flashcards');
                    setSearchOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <Layers size={18} color="var(--accent-secondary)" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Flashcards</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Spaced Repetition</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Courses Matches */}
          {filteredCourses.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', padding: '0 0.5rem' }}>
                Courses ({filteredCourses.length})
              </div>
              {filteredCourses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => {
                    openCourseInViewer(c.id);
                    setSearchOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    backgroundColor: 'transparent'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <BookOpen size={17} color="var(--accent-primary)" />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span style={{ color: 'var(--accent-primary)', marginRight: '0.4rem' }}>{c.code}</span>
                        {c.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {c.category} • {c.progress}% completed
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--text-muted)" />
                </div>
              ))}
            </div>
          )}

          {/* Assignments Matches */}
          {filteredAssignments.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem', padding: '0 0.5rem' }}>
                Assignments ({filteredAssignments.length})
              </div>
              {filteredAssignments.map((a) => (
                <div
                  key={a.id}
                  onClick={() => {
                    setActiveTab('assignments');
                    setSearchOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FileCheck2 size={17} color={a.priority === 'urgent' ? 'var(--accent-urgent)' : 'var(--accent-secondary)'} />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        {a.courseCode} • {a.dueRelative}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${a.priority === 'urgent' ? 'badge-urgent' : 'badge-emerald'}`}>
                    {a.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Footer */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderTop: '1px solid var(--border-default)',
            background: 'var(--bg-surface-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}
        >
          <span>Use <strong>ESC</strong> to close</span>
          <span>Press <strong>↵ Enter</strong> to select</span>
        </div>
      </div>
    </div>
  );
};
