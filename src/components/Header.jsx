import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Search,
  Bell,
  Timer,
  Plus,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Menu,
  Sparkles,
  KeyRound,
  Users,
  StickyNote,
  Sun,
  Moon
} from 'lucide-react';

export const Header = ({ onOpenAddEvent }) => {
  const {
    setSearchOpen,
    setPomodoroOpen,
    focusTimer,
    setLoginModalOpen,
    setNotesDrawerOpen,
    studyNotes,
    sidebarCollapsed,
    setSidebarCollapsed,
    toasts,
    user,
    setActiveTab,
    portalConfig,
    onlineStats,
    theme,
    toggleTheme,
    institutionType,
    schoolHomework,
    schoolResults
  } = useLMS();

  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <header
      style={{
        height: '70px',
        backgroundColor: 'var(--bg-header)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 90,
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Left: Quick Search Bar trigger & Company Portal Tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '580px' }}>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="btn-icon menu-toggle"
          style={{ display: 'none' }}
        >
          <Menu size={18} />
        </button>

        <div
          onClick={() => setSearchOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            padding: '0.5rem 0.9rem',
            width: '100%',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-hover)';
            e.currentTarget.style.backgroundColor = 'var(--bg-card)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-default)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
          }}
        >
          <Search size={16} color="var(--text-secondary)" />
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', flex: 1 }}>
            {user?.role === 'admin'
              ? 'Search batches, faculty, students, security audit logs...'
              : user?.role === 'trainer'
              ? 'Search students, attendance records, code submissions...'
              : 'Search courses, lessons, assignments, topics...'}
          </span>
          <kbd
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              border: '1px solid var(--border-default)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Action Icons & Badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Real-time Presence Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
            fontWeight: 600
          }}
          title={`Real-Time Active: ${onlineStats?.total || 1} connected users`}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: user?.role === 'admin' ? '#D97706' : user?.role === 'trainer' ? '#6366F1' : 'var(--accent-primary)',
              display: 'inline-block'
            }}
          />
          <span style={{ color: 'var(--text-primary)' }}>{onlineStats?.total || 1} Active</span>
        </div>

        {/* Student Tools: Shown for student or general user */}
        {(!user?.role || user.role.toLowerCase() === 'student') && (
          <>
            {/* Pomodoro Focus Tool */}
            <button
              onClick={() => setPomodoroOpen(true)}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.8rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: focusTimer?.timerState?.status === 'running' ? 'rgba(37, 99, 235, 0.12)' : undefined,
                borderColor: focusTimer?.timerState?.status === 'running' ? 'var(--accent-primary)' : undefined,
                color: focusTimer?.timerState?.status === 'running' ? 'var(--accent-primary)' : undefined,
                fontWeight: focusTimer?.timerState?.status === 'running' ? 700 : 500
              }}
              title={
                focusTimer?.timerState?.status === 'running'
                  ? `Focus Timer Active (${focusTimer.formattedTime})`
                  : focusTimer?.timerState?.status === 'paused'
                  ? `Focus Timer Paused (${focusTimer.formattedTime})`
                  : 'Student Focus Timer'
              }
            >
              <Timer size={14} color="var(--accent-primary)" />
              <span>
                {focusTimer?.timerState?.status === 'running'
                  ? `Focus (${focusTimer.formattedTime})`
                  : focusTimer?.timerState?.status === 'paused'
                  ? `Paused (${focusTimer.formattedTime})`
                  : 'Timer'}
              </span>
            </button>

            {/* Global Quick Notes Trigger */}
            <button
              onClick={() => setNotesDrawerOpen(true)}
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.8rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="Open Quick Notes Drawer (Ctrl+J)"
            >
              <StickyNote size={14} color="var(--accent-indigo)" />
              <span>Notes</span>
            </button>
          </>
        )}

        {/* Dynamic Badge for Admin/Superadmin/Trainer */}
        {(user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'trainer' || user?.role === 'teacher') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              fontWeight: 600
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: user?.role === 'superadmin' ? '#6366F1' : user?.role === 'admin' ? '#D97706' : '#2563EB'
              }}
            />
            <span>
              {user?.role === 'superadmin'
                ? '6th Civilians Corporation · Company Operations'
                : user?.role === 'admin'
                ? `${user?.tenantName || 'Institution'} Administration`
                : (user?.tenantName || user?.institutionName || 'Academic Institution')}
            </span>
          </div>
        )}

        {/* Quick Add Schedule Event - shown only if trainer or admin */}
        {(user?.role === 'trainer' || user?.role === 'admin') && (
          <button
            onClick={onOpenAddEvent}
            className="btn-primary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem' }}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Event</span>
          </button>
        )}

        {/* Theme Toggle Button (Light / Dark) */}
        <button
          onClick={toggleTheme}
          className="btn-icon"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          style={{
            color: 'var(--text-secondary)',
            borderColor: 'var(--border-default)',
            transition: 'all 0.2s ease'
          }}
        >
          {theme === 'dark' ? <Sun size={17} color="#FBBF24" /> : <Moon size={17} color="var(--accent-indigo)" />}
        </button>

        {/* Notification Bell with Badge */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="btn-icon"
            style={{
              position: 'relative',
              borderColor: notificationOpen ? 'var(--accent-blue)' : 'var(--border-default)'
            }}
          >
            <Bell size={17} />
            <span
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-primary)'
              }}
            />
          </button>

          {/* Notifications Dropdown */}
          {notificationOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '340px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.1rem',
                boxShadow: 'var(--shadow-elevation)',
                zIndex: 250,
                animation: 'scaleUp 0.18s ease-out'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.85rem',
                  paddingBottom: '0.6rem',
                  borderBottom: '1px solid var(--border-default)'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                  Notifications
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600, cursor: 'pointer' }}>
                  Mark all read
                </span>
              </div>

              {/* Dynamic Notifications based on Real Records */}
              {(() => {
                const pendingItems = (institutionType === 'school' ? schoolHomework : [])
                  ?.filter((h) => h.status === 'pending' || h.status === 'needs_revision') || [];
                const evaluatedItems = (institutionType === 'school' ? schoolHomework : [])
                  ?.filter((h) => h.status === 'graded') || [];
                const hasItems = pendingItems.length > 0 || evaluatedItems.length > 0;

                if (!hasItems) {
                  return (
                    <div style={{ padding: '1.25rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      <CheckCircle2 size={24} color="#059669" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
                      All caught up! No urgent notifications.
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {pendingItems.slice(0, 2).map((hw, idx) => (
                      <div
                        key={`hw-${idx}`}
                        style={{
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(220, 38, 38, 0.05)',
                          border: '1px solid rgba(220, 38, 38, 0.2)',
                          display: 'flex',
                          gap: '0.65rem'
                        }}
                      >
                        <AlertTriangle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {hw.status === 'needs_revision' ? 'Revision Needed' : 'Homework Due'}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {hw.title} ({hw.subject})
                          </div>
                        </div>
                      </div>
                    ))}
                    {evaluatedItems.slice(0, 2).map((hw, idx) => (
                      <div
                        key={`eval-${idx}`}
                        style={{
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'rgba(5, 150, 105, 0.05)',
                          border: '1px solid rgba(5, 150, 105, 0.2)',
                          display: 'flex',
                          gap: '0.65rem'
                        }}
                      >
                        <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Grade Recorded
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {hw.title}: {hw.score}/{hw.maxScore} marks
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* User Mini Avatar */}
        <div
          onClick={() => setActiveTab('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            cursor: 'pointer',
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            transition: 'border-color var(--transition-fast)'
          }}
          title={user?.role === 'superadmin' ? 'Open Security & Access Controls' : user?.role === 'admin' ? 'Open Administrator Profile' : (user?.role === 'trainer' || user?.role === 'teacher') ? 'Open Faculty Profile' : 'Open Student Profile'}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user?.name || 'User'}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
              }}
              style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : null}
          <div
            style={{
              display: user?.avatar ? 'none' : 'flex',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: '#2563EB',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 800,
              flexShrink: 0
            }}
          >
            {(user?.name || 'U').slice(0, 2).toUpperCase()}
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {user?.name ? user.name.split(' ')[0] : 'User'}
          </span>
        </div>
      </div>
    </header>
  );
};
