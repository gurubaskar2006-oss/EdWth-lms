import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Building2,
  Award,
  ShieldCheck,
  CheckCircle2,
  X,
  ChevronRight,
  Settings2,
  Sparkles
} from 'lucide-react';

export const HeroBanner = () => {
  const { user, portalConfig, updatePortalConfig, setActiveTab } = useLMS();

  const [editPortalModalOpen, setEditPortalModalOpen] = useState(false);
  const [tempCompanyName, setTempCompanyName] = useState(portalConfig?.companyName || 'Nexus Institute of Technology');
  const [tempPortalName, setTempPortalName] = useState(portalConfig?.portalName || 'Lumina Enterprise Learning Platform');
  const [tempMotto, setTempMotto] = useState(portalConfig?.motto || 'Empowering World-Class AI Engineers & Scholars');

  // Dynamic time-based greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  const handleSavePortalConfig = (e) => {
    e.preventDefault();
    updatePortalConfig({
      companyName: tempCompanyName,
      portalName: tempPortalName,
      motto: tempMotto
    });
    setEditPortalModalOpen(false);
  };

  const handlePresetSelect = (company, portal, motto) => {
    setTempCompanyName(company);
    setTempPortalName(portal);
    setTempMotto(motto);
  };

  return (
    <>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem 2.25rem',
          position: 'relative',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}
        >
          {/* Left: Opening Academic Context Section */}
          <div style={{ maxWidth: '780px' }}>
            {/* Institution Badge & Term */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                marginBottom: '0.85rem',
                flexWrap: 'wrap'
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--accent-primary-subtle)',
                  border: '1px solid rgba(5, 150, 105, 0.2)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.76rem',
                  fontWeight: 600
                }}
              >
                <Building2 size={13} />
                <span>6th Civilians Corporation</span>
              </div>

              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-default)'
                }}
              >
                {user.major || 'Computer Science & AI'} · Fall 2026
              </span>
            </div>

            {/* Main Welcome Heading */}
            <h1
              style={{
                fontSize: '1.85rem',
                color: 'var(--text-primary)',
                marginBottom: '0.45rem',
                fontWeight: 700,
                letterSpacing: '-0.025em',
                lineHeight: 1.2
              }}
            >
              {greeting}, {user.name.split(' ')[0]}
            </h1>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.94rem',
                lineHeight: 1.55,
                marginBottom: '1.25rem'
              }}
            >
              Your academic activity at a glance. Track syllabus progress, submit assignments, or resume your active coursework.
            </p>

            {/* Academic Context Strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <ShieldCheck size={14} color="var(--accent-primary)" />
                <span>Student ID: <strong style={{ color: 'var(--text-primary)' }}>{user.studentId || 'NX-2026-4401'}</strong></span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <Award size={14} color="var(--accent-indigo)" />
                <span>Cumulative GPA: <strong style={{ color: 'var(--text-primary)' }}>{user.stats?.gpa || user.gpa || '3.92'}</strong></span>
              </div>

              <button
                onClick={() => setActiveTab('sandbox')}
                className="btn-secondary"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>Code Lab</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Right: Institutional Settings Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setEditPortalModalOpen(true)}
              className="btn-ghost"
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '0.35rem 0.7rem'
              }}
              title="Customize Institution Portal Name"
            >
              <Settings2 size={13} />
              <span>Institution Portal</span>
            </button>
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
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--accent-primary-subtle)',
                    color: 'var(--accent-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(5, 150, 105, 0.2)'
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                    Customize Institution Portal
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Configure the institutional branding displayed across Lumina
                  </p>
                </div>
              </div>
              <button onClick={() => setEditPortalModalOpen(false)} className="btn-icon" style={{ width: '32px', height: '32px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                Quick Presets:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() =>
                    handlePresetSelect(
                      'Nexus Institute of Technology',
                      'Lumina Enterprise Learning Platform',
                      'Empowering World-Class AI Engineers & Scholars'
                    )
                  }
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  🏛️ Nexus Institute
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handlePresetSelect(
                      'Google Cloud Learning Academy',
                      'Lumina Enterprise Cloud LMS',
                      'Mastering Scalable Cloud & Machine Learning Systems'
                    )
                  }
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  ☁️ Google Cloud Academy
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handlePresetSelect(
                      'Stanford Online AI Lab',
                      'Lumina Advanced Academic Portal',
                      'Advancing Fundamental Computer Science & Intelligence'
                    )
                  }
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
                  Institution / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                  placeholder="e.g. Nexus Institute of Technology"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Portal Title *
                </label>
                <input
                  type="text"
                  required
                  value={tempPortalName}
                  onChange={(e) => setTempPortalName(e.target.value)}
                  placeholder="e.g. Lumina Enterprise Learning Platform"
                  style={{ width: '100%', fontSize: '0.88rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Tagline / Motto
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
                  <span>Update Portal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
