import React from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  FileCheck2,
  Award,
  Calendar,
  Bell,
  Code2,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const SECTION_HELP_DATA = {
  dashboard: {
    title: 'Student Dashboard Guidance',
    badge: 'Home Overview',
    icon: HelpCircle,
    summary: 'Your centralized academic command center for school daily activities.',
    tips: [
      {
        title: 'Daily Class Schedule',
        detail: 'Shows today\'s instructional periods, room numbers, and teachers. Non-working days clearly reflect scheduled school holidays.'
      },
      {
        title: 'Actionable Homework Cards',
        detail: 'View homework due soon. Click "Submit Homework" to paste or write your code solution and submit to your teacher.'
      },
      {
        title: 'Tests & Assessments',
        detail: 'Monitor upcoming scheduled examinations and review recently evaluated test marks.'
      }
    ]
  },
  subjects: {
    title: 'My Subjects & Curriculum Help',
    badge: 'Subjects Workspace',
    icon: BookOpen,
    summary: 'Browse all enrolled computer science and technical subjects, faculty details, and course modules.',
    tips: [
      {
        title: 'Subject Specific Work',
        detail: 'Select any subject card to view linked homework tasks, upcoming class tests, and syllabus progress.'
      },
      {
        title: 'Hands-on Practice',
        detail: 'Click "Open Code Practice" from any subject to launch Code Lab with the relevant language environment (Python, C++, or SQL).'
      },
      {
        title: 'Teacher Contact',
        detail: 'Subject cards display your assigned teacher\'s name and room for office hours assistance.'
      }
    ]
  },
  homework: {
    title: 'Homework & Assignments Help',
    badge: 'Homework Guide',
    icon: FileCheck2,
    summary: 'Track pending tasks, submit programming solutions, and review teacher remarks.',
    tips: [
      {
        title: 'Submitting Assignments',
        detail: 'Click "Submit Homework" on any pending assignment. Enter your code or explanation and click "Submit to Teacher".'
      },
      {
        title: 'Due Dates & Status',
        detail: 'Assignments marked with yellow badges are pending. Submitted homework moves to Graded once evaluated by your teacher.'
      },
      {
        title: 'Teacher Feedback',
        detail: 'Graded homework displays your marks and teacher comments directly on the card.'
      }
    ]
  },
  tests: {
    title: 'Tests & Proctored Assessments Help',
    badge: 'Assessment Guide',
    icon: Award,
    summary: 'Guidelines for taking online coding assessments under secure proctoring.',
    tips: [
      {
        title: 'Authoritative Timer',
        detail: 'Assessment duration is strictly managed by the server. Refreshing or reconnecting will NOT reset or extend your timer.'
      },
      {
        title: 'Automatic Submission',
        detail: 'When the timer reaches 0:00, your code and test assertions are submitted automatically to ensure fairness.'
      },
      {
        title: 'Focused Assessment Mode',
        detail: 'Assessments require full-screen view. Exiting full-screen, minimizing, or switching tabs logs an environment warning sent directly to your teacher.'
      },
      {
        title: 'Strict 3-Warning Auto-Termination',
        detail: 'Crossing 3 environment warnings permanently locks you out of the exam. The system will automatically terminate and submit your test session, and immediately notify your trainer.'
      },
      {
        title: 'Viewing Graded Marks',
        detail: 'Evaluated tests appear under "Completed Test Marks" with scores, percentage, and remarks.'
      }
    ]
  },
  schedule: {
    title: 'Class Timetable & Working Days Help',
    badge: 'Schedule Guide',
    icon: Calendar,
    summary: 'Understanding your instructional week and daily timetable periods.',
    tips: [
      {
        title: 'Institution Working Days',
        detail: 'The schedule adheres strictly to official school working days (e.g. Monday - Friday). Saturdays and Sundays are designated rest days.'
      },
      {
        title: 'Current Day Identification',
        detail: 'Today\'s active day is automatically highlighted with a live indicator for quick navigation.'
      },
      {
        title: 'Breaks & Recesses',
        detail: 'Recess and Lunch breaks are clearly labeled between instructional periods.'
      }
    ]
  },
  announcements: {
    title: 'School Announcements Help',
    badge: 'Circulars & Notices',
    icon: Bell,
    summary: 'Official communications from administration and faculty.',
    tips: [
      {
        title: 'Priority Notices',
        detail: 'High priority announcements regarding examination dates, lab closures, or schedule updates are marked in red.'
      },
      {
        title: 'Subject Specific Notices',
        detail: 'Teachers post notifications about assignment due date extensions and extra-curricular coding workshops here.'
      }
    ]
  },
  codelab: {
    title: 'Code Lab (Practice) Help',
    badge: 'Coding Environment',
    icon: Code2,
    summary: 'Interactive compiler and code runner for practicing Python, C++, and SQL.',
    tips: [
      {
        title: 'Independent Practice',
        detail: 'Code written here is for practice and does not affect your graded assessment scores.'
      },
      {
        title: 'Execution Output',
        detail: 'Click "Run Code" to compile and execute in our isolated execution sandbox.'
      },
      {
        title: 'Keyboard Shortcuts',
        detail: 'Press Ctrl+Enter / Cmd+Enter inside the editor to quickly run your program.'
      }
    ]
  }
};

export const SchoolContextualHelpModal = ({ section = 'dashboard', onClose }) => {
  const help = SECTION_HELP_DATA[section] || SECTION_HELP_DATA.dashboard;
  const IconComponent = help.icon;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '20px',
          padding: '1.75rem',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  {help.title}
                </h2>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--accent-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {help.badge}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-icon"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary Description */}
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {help.summary}
        </p>

        {/* Actionable Tips List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {help.tips.map((tip, idx) => (
            <div
              key={idx}
              style={{
                padding: '0.95rem 1.1rem',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem'
              }}
            >
              <CheckCircle2 size={16} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.2rem', color: 'var(--text-primary)' }}>
                  {tip.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {tip.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '0.55rem 1.5rem', fontSize: '0.85rem', fontWeight: 700 }}
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
