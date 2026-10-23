import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Terminal,
  FileCheck2,
  Users,
  Award,
  Flame,
  Layers,
  Calendar,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Play,
  KeyRound,
  Edit3,
  X
} from 'lucide-react';

export const WelcomePortalView = () => {
  usePageTitle('Welcome');
  const {
    user,
    portalConfig,
    updatePortalConfig,
    setActiveTab,
    courses,
    assignments,
    students,
    setLoginModalOpen,
    triggerConfetti
  } = useLMS();

  const [editPortalModalOpen, setEditPortalModalOpen] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState(portalConfig?.companyName || 'Nexus Institute of Technology');
  const [tempPortalName, setTempPortalName] = useState(portalConfig?.portalName || 'Nexus Enterprise Student Learning Portal');
  const [tempMotto, setTempMotto] = useState(portalConfig?.motto || 'Empowering World-Class AI Engineers & Scholars');

  // Dynamic Time Greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const enrolledCount = courses.filter((c) => c.enrolled).length;
  const pendingAssignmentsCount = assignments.filter((a) => a.status === 'todo' || a.status === 'in_progress').length;

  const handleSavePortalConfig = (e) => {
    e.preventDefault();
    updatePortalConfig({
      companyName: tempCompanyName,
      portalName: tempPortalName,
      motto: tempMotto
    });
    setEditPortalModalOpen(false);
  };

  const handleEnterDashboard = () => {
    triggerConfetti();
    setActiveTab('dashboard');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.25rem', paddingBottom: '2.5rem' }}>
      {/* 1. HERO OPENING WELCOME BANNER BASED ON COMPANY PORTAL */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          padding: '2.75rem 2.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        {/* Subtle decorative accent wave */}
        <div
          style={{
            position: 'absolute',
            top: '-80px',
            right: '-60px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.06), transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '780px' }}>
          {/* Company Portal Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                padding: '0.35rem 0.9rem',
                borderRadius: 'var(--radius-full)',
                color: 'var(--accent-primary)',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.03em'
              }}
            >
              <Building2 size={16} />
              <span>{portalConfig?.companyName || 'EdWth Academy'}</span>
            </div>

            <span
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-surface-subtle)',
                padding: '0.3rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-default)'
              }}
            >
              {portalConfig?.term || 'Fall 2026 Academic Term'}
            </span>

            {user?.role === 'admin' && (
              <button
                onClick={() => setEditPortalModalOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  padding: '3px 8px',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                <Edit3 size={13} />
                <span>Change Portal Name</span>
              </button>
            )}
          </div>

          {/* Main Welcome Heading */}
          <h1
            style={{
              fontSize: '2.5rem',
              color: 'var(--text-primary)',
              fontWeight: 900,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem'
            }}
          >
            {greeting}, {user.name.split(' ')[0]}!
          </h1>

          <div
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: 'var(--accent-learning)',
              marginBottom: '1rem',
              lineHeight: 1.3
            }}
          >
            Welcome to {portalConfig?.portalName || 'EdWth LMS Student Platform'}
          </div>

          <p
            style={{
              fontSize: '0.96rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
              maxWidth: '680px',
              marginBottom: '1.75rem'
            }}
          >
            {portalConfig?.motto || 'Empowering World-Class AI Engineers & Scholars'}.
            Your institutional profile is synchronized for the {portalConfig?.term || '2026 Academic Term'} with{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{enrolledCount} active courses</strong> and a{' '}
            <strong style={{ color: '#D97706' }}>{user.streakDays || 7}-day learning streak</strong>.
          </p>

          {/* Action Gateways */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleEnterDashboard}
              className="btn-primary"
              style={{
                padding: '0.8rem 1.6rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem'
              }}
            >
              <span>Enter Student Dashboard</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => setActiveTab('sandbox')}
              className="btn-secondary"
              style={{
                padding: '0.8rem 1.35rem',
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderColor: 'var(--border-default)'
              }}
            >
              <Flame size={17} color="#D97706" />
              <span>Daily Challenge</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PORTAL ECOSYSTEM QUICK-ACCESS GATEWAYS */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 800 }}>
              {portalConfig?.companyName || 'EdWth Academy'} Academic Hub
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Direct access to classrooms, polyglot compiler labs, rosters, and GPA analytics
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem'
          }}
        >
          {/* Card 1: My Courses */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('courses')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#EFF6FF',
                  color: 'var(--accent-learning)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <BookOpen size={22} />
              </div>
              <span className="badge badge-blue">{enrolledCount} Enrolled</span>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Course Classrooms
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Interactive syllabi, video lectures, markdown notes, and progress tracking for CS 401, DS 202 & more.
              </p>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--accent-learning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
              <span>Launch Classroom</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 2: Code Lab & Sandbox */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('sandbox')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Terminal size={22} />
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                7 Languages • Day 15
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Multi-Language Code Lab
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Compile and run algorithms in Python, JS, C++, Java, Rust, Go & SQL with live Day-by-Day streak challenges.
              </p>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
              <span>Open Compiler Sandbox</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 4: Assignments & Autograder */}
          <div
            className="card card-interactive"
            onClick={() => setActiveTab('assignments')}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileCheck2 size={22} />
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)'
                }}
              >
                {pendingAssignmentsCount} Due
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                Assignments & Evaluation
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Upload solutions via drag-and-drop or GitHub, inspect rubric matrices, and view autograder execution logs.
              </p>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#DC2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: 'auto' }}>
              <span>Review Assignments</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: CUSTOMIZE COMPANY PORTAL NAME */}
      {editPortalModalOpen && (
        <div className="modal-overlay" onClick={() => setEditPortalModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '540px', padding: '1.75rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: '#ECFDF5',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #A7F3D0'
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                    Customize Company Portal Name
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Change the institutional name displayed on the opening welcome screen
                  </p>
                </div>
              </div>
              <button onClick={() => setEditPortalModalOpen(false)} className="btn-icon" style={{ width: '30px', height: '30px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                ⚡ Quick Presets:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setTempCompanyName('Nexus Institute of Technology');
                    setTempPortalName('Nexus Enterprise Student Learning Portal');
                    setTempMotto('Empowering World-Class AI Engineers & Scholars');
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  🏛️ Nexus Institute
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTempCompanyName('Google Cloud Learning Academy');
                    setTempPortalName('Google Cloud Enterprise LMS Portal');
                    setTempMotto('Mastering Scalable Cloud & Machine Learning Systems');
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  ☁️ Google Cloud Academy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTempCompanyName('Stanford Online AI Lab');
                    setTempPortalName('Stanford Online Student Learning Portal');
                    setTempMotto('Advancing Fundamental Computer Science & Intelligence');
                  }}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  🌲 Stanford Online
                </button>
              </div>
            </div>

            {/* Form Inputs */}
            <form onSubmit={handleSavePortalConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Company / Institution Name *
                </label>
                <input
                  type="text"
                  required
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp Academy or Harvard Online"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Portal Title / Gateway Name *
                </label>
                <input
                  type="text"
                  required
                  value={tempPortalName}
                  onChange={(e) => setTempPortalName(e.target.value)}
                  placeholder="e.g. Enterprise Student Learning Portal"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Portal Tagline / Motto
                </label>
                <input
                  type="text"
                  value={tempMotto}
                  onChange={(e) => setTempMotto(e.target.value)}
                  placeholder="e.g. Empowering Next-Generation Innovators"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setEditPortalModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <CheckCircle2 size={15} />
                  <span>Update Portal Welcome</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
