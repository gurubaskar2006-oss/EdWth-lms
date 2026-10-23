import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  LayoutDashboard,
  BookOpen,
  PlayCircle,
  FileCheck2,
  CalendarDays,
  Award,
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  StickyNote,
  BrainCircuit,
  Trophy,
  Sparkles,
  ArrowRight,
  Users,
  Shield
} from 'lucide-react';

export const Sidebar = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    user,
    updateUserStatus,
    courses,
    assignments,
    studyNotes,
    logout,
    terms
  } = useLMS();

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  // Derived counts for dynamic badges
  const pendingAssignmentsCount = assignments.filter(
    (a) => a.status === 'todo' || a.status === 'in_progress'
  ).length;
  const urgentCount = assignments.filter(
    (a) => a.priority === 'urgent' && a.status !== 'graded'
  ).length;
  const enrolledCoursesCount = courses.filter((c) => c.enrolled).length;
  const notesCount = studyNotes?.length || 4;

  // Primary Workspace Categories with their contextual navigation items
  const CATEGORIES = [
    {
      id: 'home',
      label: 'Home',
      icon: LayoutDashboard,
      description: 'Institutional overview & summary',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Overview & recent updates' }
      ]
    },
    {
      id: 'learning',
      label: 'Learning',
      icon: BookOpen,
      description: `${terms?.coursePlural || 'Courses'}, classroom & assignments`,
      items: [
        { id: 'courses', label: terms?.subjectsMenuLabel || 'My Courses', icon: BookOpen, desc: `${terms?.courseLabel || 'Course'} catalog & curriculum`, badge: enrolledCoursesCount },
        { id: 'viewer', label: 'Classroom', icon: PlayCircle, desc: 'Interactive lecture player' },
        { id: 'assignments', label: 'Assignments', icon: FileCheck2, desc: 'Submissions & challenges', badge: pendingAssignmentsCount, isUrgent: urgentCount > 0 }
      ]
    },
    {
      id: 'academics',
      label: 'Academics',
      icon: CalendarDays,
      description: 'Timeline, records & progress',
      items: [
        { id: 'schedule', label: 'Schedule', icon: CalendarDays, desc: 'Academic calendar & deadlines' },
        { id: 'grades', label: 'Grades & GPA', icon: Award, desc: 'Transcripts & evaluations' }
      ]
    },
    {
      id: 'workspace',
      label: 'Workspace',
      icon: Terminal,
      description: 'Code Lab, synthesis & tools',
      items: [
        { id: 'sandbox', label: 'Code Lab', icon: Terminal, desc: 'Isolated sandbox IDE' },
        { id: 'notes', label: 'Notes', icon: StickyNote, desc: 'Academic notebook', badge: notesCount },
        { id: 'flashcards', label: 'Flashcards', icon: BrainCircuit, desc: 'Active recall decks' }
      ]
    },
    {
      id: 'engagement',
      label: 'Engagement',
      icon: Trophy,
      description: 'Cohorts & peer recognition',
      items: [
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, desc: 'Top scholars & streaks' }
      ]
    },
    {
      id: 'settings',
      label: 'Profile',
      icon: Settings,
      description: 'Profile & preferences',
      items: [
        { id: 'settings', label: 'My Profile & Settings', icon: Settings, desc: 'Student profile & account' }
      ]
    }
  ];

  // Helper: Determine category from active tab
  const getCategoryForTab = (tab) => {
    if (tab === 'profile') return 'settings';
    for (const cat of CATEGORIES) {
      if (cat.items.some((i) => i.id === tab)) {
        return cat.id;
      }
    }
    return 'home';
  };

  // State: Currently selected category (defaults to whichever category contains activeTab)
  const [selectedCatId, setSelectedCatId] = useState(() => getCategoryForTab(activeTab));

  // Sync category when activeTab changes elsewhere
  useEffect(() => {
    const cat = getCategoryForTab(activeTab);
    setSelectedCatId(cat);
  }, [activeTab]);

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCatId) || CATEGORIES[0];

  // Handle clicking a category rail icon
  const handleCategoryClick = (cat) => {
    setSelectedCatId(cat.id);
    if (sidebarCollapsed) {
      setSidebarCollapsed(false);
    }
    const tabInCategory = cat.items.some((i) => i.id === activeTab);
    if (!tabInCategory && cat.items[0]) {
      setActiveTab(cat.items[0].id);
    }
  };

  // Handle clicking a contextual item
  const handleItemClick = (tabId) => {
    setActiveTab(tabId);
    if (window.innerWidth <= 768) {
      setSidebarCollapsed(true);
    }
  };

  return (
    <aside
      className={`sidebar-container ${!sidebarCollapsed ? 'open' : ''}`}
      style={{
        display: 'flex',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        backgroundColor: 'var(--bg-card)',
        borderRight: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'width var(--transition-smooth)'
      }}
    >
      {/* ─── 1. PRIMARY ICON RAIL (Compact, always visible) ─── */}
      <div
        style={{
          width: '68px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRight: sidebarCollapsed ? 'none' : '1px solid var(--border-subtle)',
          backgroundColor: '#FFFFFF',
          padding: '1rem 0',
          gap: '0.5rem'
        }}
      >
        {/* Top: EdWth Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: '100%' }}>
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedCatId('home');
            }}
            title="EdWth LMS — Empowering Every Learner"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: '#171717',
              border: '1px solid #FFB21A44',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(245, 130, 18, 0.28)',
              cursor: 'pointer',
              padding: '4px',
              overflow: 'hidden'
            }}
          >
            <img
              src="/logo-transparent.png"
              alt="EdWth LMS"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </button>

          <div style={{ width: '32px', height: '1px', backgroundColor: 'var(--border-subtle)' }} />

          {/* Category Rail Icons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', alignItems: 'center' }}>
            {CATEGORIES.filter((c) => c.id !== 'settings').map((cat) => {
              const Icon = cat.icon;
              const isCatActive = selectedCatId === cat.id;
              const hasUrgent = cat.items.some((i) => i.isUrgent);

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  title={`${cat.label} — ${cat.description}`}
                  style={{
                    position: 'relative',
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isCatActive ? 'var(--accent-blue-subtle)' : 'transparent',
                    color: isCatActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: '1px solid',
                    borderColor: isCatActive ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCatActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCatActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  {/* Left Active Pillar Indicator */}
                  {isCatActive && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '-8px',
                        top: '12px',
                        bottom: '12px',
                        width: '3.5px',
                        borderRadius: '0 4px 4px 0',
                        backgroundColor: 'var(--accent-blue)'
                      }}
                    />
                  )}

                  <Icon size={19} strokeWidth={isCatActive ? 2.2 : 1.7} />
                  <span style={{ fontSize: '0.58rem', fontWeight: isCatActive ? 700 : 600, marginTop: '2px', letterSpacing: '-0.01em' }}>
                    {cat.label}
                  </span>

                  {/* Urgent indicator dot */}
                  {hasUrgent && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '6px',
                        right: '6px',
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--priority-urgent-text)',
                        border: '1.5px solid #FFFFFF'
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Rail: Settings & Collapse Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <button
            onClick={() => handleCategoryClick(CATEGORIES.find((c) => c.id === 'settings'))}
            title="Settings & Preferences"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selectedCatId === 'settings' ? 'var(--accent-blue-subtle)' : 'transparent',
              color: selectedCatId === 'settings' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              border: '1px solid',
              borderColor: selectedCatId === 'settings' ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
              transition: 'all var(--transition-fast)'
            }}
          >
            <Settings size={18} strokeWidth={selectedCatId === 'settings' ? 2.2 : 1.7} />
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="btn-icon"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--bg-surface)'
            }}
            title={sidebarCollapsed ? 'Expand Contextual Panel' : 'Collapse Contextual Panel'}
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>
      </div>

      {/* ─── 2. CONTEXTUAL PANEL (Expands to reveal active workspace tools) ─── */}
      {!sidebarCollapsed && (
        <div
          style={{
            width: '206px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            padding: '1rem 0.85rem',
            overflowY: 'auto'
          }}
        >
          {/* Top: Section Branding & Context Title */}
          <div>
            <div style={{ marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    color: 'var(--accent-blue)',
                    textTransform: 'uppercase'
                  }}
                >
                  {activeCategory.label}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>• Workspace</span>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3 }}>
                {activeCategory.description}
              </p>
            </div>

            {/* Contextual Navigation Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {activeCategory.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                      color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.84rem',
                      transition: 'all var(--transition-fast)',
                      textAlign: 'left'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '0.1rem 0.45rem',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: item.isUrgent
                            ? 'var(--priority-urgent-bg)'
                            : isActive
                            ? 'rgba(37, 99, 235, 0.15)'
                            : 'var(--bg-surface)',
                          color: item.isUrgent
                            ? 'var(--priority-urgent-text)'
                            : isActive
                            ? 'var(--accent-blue)'
                            : 'var(--text-secondary)',
                          border: '1px solid',
                          borderColor: item.isUrgent ? 'var(--priority-urgent-border)' : 'var(--border-default)'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Contextual Cross-Links */}
            {selectedCatId === 'workspace' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Related Context
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.45rem' }}>
                  <button
                    onClick={() => handleItemClick('assignments')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span>Lab Assignments</span>
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => handleItemClick('schedule')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span>Lab Sprint Schedule</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}

            {selectedCatId === 'academics' && (
              <div style={{ marginTop: '1.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Quick Courses
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.45rem' }}>
                  <button
                    onClick={() => handleItemClick('viewer')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      backgroundColor: 'var(--bg-surface)',
                      width: '100%',
                      textAlign: 'left'
                    }}
                  >
                    <span>Active Classroom</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: User Profile Card & Quick Status */}
          <div
            style={{
              borderTop: '1px solid var(--border-default)',
              paddingTop: '0.85rem',
              position: 'relative'
            }}
          >
            {statusMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '0.6rem',
                  boxShadow: 'var(--shadow-elevation)',
                  zIndex: 200,
                  marginBottom: '8px'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '0.25rem 0.5rem', textTransform: 'uppercase', fontWeight: 700 }}>
                  Study Status
                </div>
                {['Online', 'In Deep Focus', 'Away'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      updateUserStatus(st);
                      setStatusMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.82rem',
                      color: user.status === st ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: user.status === st ? 700 : 500
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          st === 'In Deep Focus' ? '#059669' : st === 'Online' ? '#10b981' : '#94a3b8'
                      }}
                    />
                    {st}
                  </button>
                ))}

                <div style={{ height: '1px', backgroundColor: 'var(--border-default)', margin: '0.5rem 0' }} />
                <button
                  onClick={() => {
                    setStatusMenuOpen(false);
                    setActiveTab('profile');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Settings size={14} />
                  My Profile & Settings
                </button>
                <button
                  onClick={() => {
                    setStatusMenuOpen(false);
                    logout();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    color: '#DC2626',
                    fontWeight: 500
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--priority-urgent-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={14} />
                  Log Out
                </button>
              </div>
            )}

            <div
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                cursor: 'pointer',
                padding: '0.25rem',
                borderRadius: 'var(--radius-md)'
              }}
              title="Click to toggle status & account actions"
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={user.avatar}
                  alt={user.name}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    border: '1px solid var(--border-default)'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor:
                      user.status === 'In Deep Focus'
                        ? '#059669'
                        : user.status === 'Online'
                        ? '#10b981'
                        : '#94a3b8',
                    border: '2px solid var(--bg-card)'
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {user.studentId || user.role} • GPA {user.stats?.gpa || user.gpa || '3.92'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
