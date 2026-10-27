import React from 'react';
import { useLMS } from '../../context/LMSContext';
import { BrandLogo } from '../BrandLogo';
import {
  Home,
  BookOpen,
  FileCheck2,
  Calendar,
  Award,
  Bell,
  HelpCircle,
  GraduationCap,
  LogOut,
  User,
  School,
  CheckCircle2,
  Clock,
  Code2,
  FileText
} from 'lucide-react';

export const SchoolSidebar = () => {
  const {
    activeTab,
    setActiveTab,
    user,
    logout,
    portalConfig,
    schoolHomework,
    schoolTests,
    terms
  } = useLMS();

  const pendingHomeworkCount = (schoolHomework || []).filter((h) => h.status === 'pending').length;

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'subjects', label: 'My Subjects', icon: BookOpen },
    { id: 'materials', label: terms?.materialsLabel || 'Study Material', icon: FileText },
    { id: 'codelab', label: 'Practice Code Lab', icon: Code2, badge: 'Python • C++ • SQL' },
    { id: 'homework', label: 'Homework', icon: FileCheck2, badge: pendingHomeworkCount > 0 ? pendingHomeworkCount : null },
    { id: 'tests', label: 'Tests & Assessments', icon: Award, badge: schoolTests?.length > 0 ? schoolTests.length : null },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'announcements', label: 'Announcements', icon: Bell },
    { id: 'help', label: 'Help', icon: HelpCircle }
  ];

  return (
    <aside className="sidebar" style={{ width: '250px', backgroundColor: 'var(--bg-secondary)' }}>
      {/* Brand Header */}
      <div className="sidebar-header" style={{ padding: '1.25rem 1rem 1rem' }}>
        <BrandLogo
          variant="header"
          productBadge="SCHOOL"
          subtitle={user?.tenantName || portalConfig?.companyName || 'EdWth Academy • Junior Scholars'}
        />
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav" style={{ padding: '0.75rem' }}>
        <div className="sidebar-section-title" style={{ padding: '0.4rem 0.6rem', fontSize: '0.68rem' }}>
          Learning
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'profile' && activeTab === 'settings');
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                marginBottom: '0.2rem',
                fontSize: '0.88rem',
                fontWeight: isActive ? 700 : 500
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '10px',
                    backgroundColor: isActive ? '#ffffff' : '#2563EB',
                    color: isActive ? '#2563EB' : '#ffffff'
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile & Sign Out */}
      <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid var(--border-default)' }}>
        <div
          onClick={() => setActiveTab('profile')}
          role="button"
          tabIndex={0}
          title="Click to view & edit your student profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            marginBottom: '0.75rem',
            cursor: 'pointer',
            padding: '0.4rem',
            borderRadius: '10px',
            transition: 'background-color 0.2s',
            backgroundColor: (activeTab === 'profile' || activeTab === 'settings') ? 'rgba(37, 99, 235, 0.12)' : 'transparent'
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.84rem'
            }}
          >
            {user?.name ? user.name.charAt(0) : 'S'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.name || 'Student'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {user?.major || 'Class 10-A'}
            </div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="nav-item"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#f87171',
            padding: '0.5rem 0.75rem',
            borderRadius: '8px',
            fontSize: '0.82rem'
          }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
