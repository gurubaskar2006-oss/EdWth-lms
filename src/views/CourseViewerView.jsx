import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { VideoPlayer } from '../components/VideoPlayer';
import { ModuleSyllabus } from '../components/ModuleSyllabus';
import { LessonNotes } from '../components/LessonNotes';
import { LessonQuiz } from '../components/LessonQuiz';
import { CircularProgress } from '../components/CircularProgress';
import {
  BookOpen,
  FileText,
  HelpCircle,
  Download,
  Share2,
  FolderArchive,
  Terminal,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';

export const CourseViewerView = () => {
  usePageTitle('Course Viewer');
  const {
    courses,
    activeCourseId,
    activeLessonId,
    setActiveLessonId,
    toggleLessonCompletion,
    setActiveTab
  } = useLMS();

  const [activeBottomTab, setActiveBottomTab] = useState('overview'); // overview, notes, quiz, resources

  const currentCourse = courses.find((c) => c.id === activeCourseId) || courses[0];

  // Find active lesson object
  let currentLesson = null;
  if (currentCourse && currentCourse.syllabus) {
    for (const mod of currentCourse.syllabus) {
      const match = mod.lessons.find((l) => l.id === activeLessonId);
      if (match) {
        currentLesson = match;
        break;
      }
    }
  }

  // Fallback to first lesson if not found
  if (!currentLesson && currentCourse?.syllabus?.[0]?.lessons?.[0]) {
    currentLesson = currentCourse.syllabus[0].lessons[0];
  }

  const handleLessonSelect = (lessonId) => {
    setActiveLessonId(lessonId);
  };

  const handleToggleComplete = (lessonId = null) => {
    const targetId = lessonId || currentLesson?.id;
    if (targetId) {
      toggleLessonCompletion(currentCourse.id, targetId);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header / Breadcrumbs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '1rem 1.5rem',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('courses')}
            className="btn-icon"
            style={{ width: '36px', height: '36px' }}
            title="Back to All Courses"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
              <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)' }}>{currentCourse.code}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {currentCourse.category} • Instructor: {currentCourse.instructor.name}
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: 700 }}>
              {currentCourse.title}
            </h2>
          </div>
        </div>

        {/* Course Global Progress Gauge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Course Completion</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
              {currentCourse.completedLessons} / {currentCourse.totalLessons} Lessons
            </div>
          </div>
          <CircularProgress progress={currentCourse.progress} size={48} strokeWidth={5} />
        </div>
      </div>

      {/* Main Two-Column Classroom Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1fr)',
          gap: '1.5rem',
          alignItems: 'start'
        }}
      >
        {/* LEFT COLUMN: Video Player + Interactive Lesson Workspace Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          {/* Video Player */}
          <VideoPlayer
            lesson={currentLesson}
            onComplete={handleToggleComplete}
            isCompleted={currentLesson?.completed}
            courseTitle={currentCourse.title}
          />

          {/* Lesson Metadata Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              borderBottom: '1px solid var(--border-default)',
              paddingBottom: '1rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.74rem', color: 'var(--accent-blue)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Current Lesson
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginTop: '2px', fontWeight: 700 }}>
                {currentLesson?.title || 'Select a lesson from syllabus'}
              </h3>
            </div>

            {/* Tab Switches */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '3px'
              }}
            >
              {[
                { id: 'overview', label: 'Overview', icon: BookOpen },
                { id: 'notes', label: 'My Notes', icon: FileText },
                { id: 'quiz', label: 'Quiz Check', icon: HelpCircle },
                { id: 'resources', label: 'Files', icon: FolderArchive }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = activeBottomTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveBottomTab(tab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 700 : 500,
                      backgroundColor: isSelected ? 'var(--accent-blue-subtle)' : 'transparent',
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      border: isSelected ? '1px solid rgba(37, 99, 235, 0.2)' : '1px solid transparent'
                    }}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content Display */}
          {activeBottomTab === 'overview' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 700 }}>
                Lesson Objective & Key Concepts
              </h4>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                In this lecture, we dissect high-performance tensor computing primitives, focusing on self-attention computational graphs, numerical stability in GPU SRAM caching, and automatic differentiation invariants.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estimated Duration</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentLesson?.duration || '25 min'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prerequisites</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Linear Algebra & PyTorch Primitives
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lesson Type</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'capitalize' }}>
                    {currentLesson?.type || 'Video Lecture'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeBottomTab === 'notes' && (
            <LessonNotes
              lessonId={currentLesson?.id || 'les-default'}
              lessonTitle={currentLesson?.title}
            />
          )}

          {activeBottomTab === 'quiz' && (
            <LessonQuiz
              lessonId={currentLesson?.id || 'les-default'}
              onCompleteLesson={handleToggleComplete}
            />
          )}

          {activeBottomTab === 'resources' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 700 }}>
                Downloadable Attachments & Starters
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { name: "Lecture_04_Transformer_Math_Slides.pdf", size: "4.8 MB", type: "PDF" },
                  { name: "pytorch_transformer_starter_template.py", size: "12 KB", type: "Code" },
                  { name: "attention_benchmark_dataset.parquet", size: "24.5 MB", type: "Data" }
                ].map((res, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FileText size={18} color="var(--accent-blue)" />
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {res.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {res.size} • {res.type}
                        </div>
                      </div>
                    </div>

                    <button className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                      <Download size={13} /> Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Collapsible Syllabus & Progress Checklist */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem',
            position: 'sticky',
            top: '90px',
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>Course Syllabus</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Interactive curriculum checklist
              </p>
            </div>
            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
              {currentCourse.completedLessons}/{currentCourse.totalLessons} Done
            </span>
          </div>

          <ModuleSyllabus
            syllabus={currentCourse.syllabus || []}
            activeLessonId={currentLesson?.id}
            onSelectLesson={handleLessonSelect}
            onToggleComplete={handleToggleComplete}
          />
        </div>
      </div>
    </div>
  );
};
