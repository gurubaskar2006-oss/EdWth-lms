import React from 'react';
import { useLMS } from '../context/LMSContext';
import { CircularProgress } from './CircularProgress';
import { Play, Clock, BookOpen, User, CheckCircle2 } from 'lucide-react';

export const CourseCard = ({ course, variant = "horizontal" }) => {
  const { openCourseInViewer, toggleEnrollCourse } = useLMS();

  // Find next lesson to resume
  let nextLessonTitle = "Module 1: Getting Started";
  let nextLessonDuration = "20 min";
  if (course.syllabus && course.syllabus.length > 0) {
    const incompleteLesson = course.syllabus
      .flatMap((m) => m.lessons)
      .find((l) => !l.completed);
    if (incompleteLesson) {
      nextLessonTitle = incompleteLesson.title;
      nextLessonDuration = incompleteLesson.duration;
    } else {
      nextLessonTitle = "Course Completed 🎉";
      nextLessonDuration = "Done";
    }
  }

  if (variant === "compact") {
    return (
      <div
        className="card card-interactive"
        onClick={() => openCourseInViewer(course.id)}
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '210px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="badge badge-info">{course.code}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{course.category}</span>
          </div>
          <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
            {course.title}
          </h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <img
              src={course.instructor.avatar}
              alt={course.instructor.name}
              style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span>{course.instructor.name}</span>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Syllabus Completion</span>
            <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{course.progress}%</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${course.progress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  // Standard Continue Learning Horizontal Card
  return (
    <div
      className="card card-interactive"
      onClick={() => openCourseInViewer(course.id)}
      style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem',
        flexWrap: 'wrap'
      }}
    >
      {/* Course Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flex: 1, minWidth: '280px' }}>
        <img
          src={course.thumbnail}
          alt={course.title}
          style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-md)',
            objectFit: 'cover',
            border: '1px solid var(--border-default)',
            flexShrink: 0
          }}
        />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {course.code}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{course.level}</span>
          </div>

          <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.4rem', fontWeight: 700 }}>
            {course.title}
          </h4>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Next:</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '280px' }}>
              {nextLessonTitle}
            </span>
            <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={12} /> {nextLessonDuration}
            </span>
          </div>
        </div>
      </div>

      {/* Radial Progress & Resume Action */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <CircularProgress progress={course.progress} size={58} strokeWidth={5} />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lessons</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {course.completedLessons}/{course.totalLessons} Done
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            openCourseInViewer(course.id);
          }}
          className="btn-blue"
          style={{ padding: '0.55rem 1.15rem', fontSize: '0.84rem' }}
        >
          <Play size={15} fill="currentColor" />
          <span>Resume</span>
        </button>
      </div>
    </div>
  );
};
