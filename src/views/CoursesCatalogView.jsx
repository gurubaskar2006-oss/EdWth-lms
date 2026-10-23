import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { CourseCard } from '../components/CourseCard';
import { CircularProgress } from '../components/CircularProgress';
import {
  BookOpen,
  Search,
  Filter,
  Sparkles,
  CheckCircle2,
  Clock,
  UserPlus,
  Play,
  Layers,
  GraduationCap
} from 'lucide-react';

export const CoursesCatalogView = () => {
  usePageTitle('Courses');
  const { courses, toggleEnrollCourse, openCourseInViewer } = useLMS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCourseModal, setSelectedCourseModal] = useState(null);

  const categories = ['All', 'Enrolled', 'Artificial Intelligence', 'Systems Engineering', 'Computer Science', 'UI/UX & Design', 'Web Engineering'];

  const filteredCourses = courses.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Enrolled') return c.enrolled;
    return c.category === selectedCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Academic Course Catalog
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Explore state-of-the-art computer science, deep learning, and enterprise engineering curriculum
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem 0.9rem',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Search size={16} color="var(--text-secondary)" />
            <input
              type="text"
              placeholder="Search courses, topics, code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'transparent', border: 'none', padding: 0, width: '220px', fontSize: '0.86rem' }}
            />
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.8rem',
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? 'var(--accent-blue)' : 'var(--bg-card)',
                color: isSelected ? 'var(--text-on-primary)' : 'var(--text-secondary)',
                border: `1px solid ${isSelected ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)'
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Courses Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {filteredCourses.map((course) => (
          <div
            key={course.id}
            className="card card-interactive"
            style={{
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-card)'
            }}
            onClick={() => {
              if (course.enrolled) {
                openCourseInViewer(course.id);
              } else {
                setSelectedCourseModal(course);
              }
            }}
          >
            {/* Thumbnail Header */}
            <div style={{ position: 'relative', width: '100%', height: '160px', overflow: 'hidden', backgroundColor: 'var(--bg-surface)' }}>
              <img
                src={course.thumbnail}
                alt={course.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '6px' }}>
                <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>{course.code}</span>
                <span className="badge badge-subtle">{course.level}</span>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  {course.category}
                </div>
                <h3
                  style={{
                    fontSize: '1.1rem',
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    lineHeight: 1.35
                  }}
                >
                  {course.title}
                </h3>
                <p
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {course.description}
                </p>
              </div>

              {/* Instructor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                <img
                  src={course.instructor.avatar}
                  alt={course.instructor.name}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {course.instructor.name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {course.instructor.role}
                  </div>
                </div>
              </div>

              {/* Footer / Status */}
              <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '1rem' }}>
                {course.enrolled ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '0.45rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Syllabus Progress</span>
                      <span style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{course.progress}%</span>
                    </div>
                    <div className="progress-bar-bg" style={{ marginBottom: '1rem', height: '6px' }}>
                      <div className="progress-bar-fill" style={{ width: `${course.progress}%`, backgroundColor: 'var(--accent-blue)' }} />
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCourseInViewer(course.id);
                      }}
                      className="btn-blue"
                      style={{ width: '100%', padding: '0.55rem', fontSize: '0.84rem' }}
                    >
                      <Play size={14} fill="currentColor" /> Resume Course
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {course.totalLessons} Lessons • {course.estimatedHours}h
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEnrollCourse(course.id);
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.45rem 0.95rem', fontSize: '0.82rem' }}
                    >
                      <UserPlus size={14} color="var(--accent-blue)" />
                      <span style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>Enroll</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Course Detail Modal */}
      {selectedCourseModal && (
        <div className="modal-overlay" onClick={() => setSelectedCourseModal(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: '640px', padding: '2rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>
                  {selectedCourseModal.code}
                </span>
                <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', fontWeight: 700 }}>{selectedCourseModal.title}</h2>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {selectedCourseModal.description}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
              <img
                src={selectedCourseModal.instructor.avatar}
                alt={selectedCourseModal.instructor.name}
                style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedCourseModal.instructor.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{selectedCourseModal.instructor.role}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setSelectedCourseModal(null)} className="btn-secondary">
                Close
              </button>
              <button
                onClick={() => {
                  toggleEnrollCourse(selectedCourseModal.id);
                  setSelectedCourseModal(null);
                }}
                className="btn-primary"
              >
                <UserPlus size={16} /> Enroll in Course
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
