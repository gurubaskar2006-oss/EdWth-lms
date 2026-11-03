import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck, X, Eye, EyeOff, User, Mail, Hash } from 'lucide-react';

/**
 * Lumina LMS — Credential Confirmation Modal
 * 6th Civilians Corporation
 *
 * Secure one-time credential handover for newly provisioned student accounts.
 * Displays generated temporary password or initial password once, with copy
 * utilities, and clears all sensitive data when dismissed.
 */
export const CredentialConfirmationModal = ({
  isOpen,
  credentialData,
  onClose
}) => {
  const [copiedField, setCopiedField] = useState(null);
  const [showPassword, setShowPassword] = useState(true);

  if (!isOpen || !credentialData) return null;

  const {
    studentName = 'Student',
    studentId = '',
    email = '',
    temporaryPassword = '',
    isTemporaryPassword = true
  } = credentialData;

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2500);
  };

  const handleCopyAll = () => {
    const summary = [
      `Lumina LMS Student Credentials:`,
      `Name: ${studentName}`,
      `Student ID: ${studentId}`,
      `Email / Username: ${email}`,
      `Temporary Password: ${temporaryPassword}`,
      `Notice: You will be prompted to choose a new password upon first sign-in.`
    ].join('\n');

    copyToClipboard(summary, 'all');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credential-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99995,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(5, 11, 20, 0.82)',
        backdropFilter: 'blur(8px)',
        padding: '1rem'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--bg-card, #0f172a)',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          color: 'var(--text-primary, #f8fafc)'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(16, 185, 129, 0.1), transparent)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ShieldCheck size={20} color="#10b981" />
            </div>
            <div>
              <h3 id="credential-modal-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                Student Account Provisioned
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                One-time credential handover for student onboarding
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close credentials dialog"
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Student Identifiers Card */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                <User size={15} />
                <span>Full Name:</span>
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f1f5f9' }}>{studentName}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                <Hash size={15} />
                <span>Student ID:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <code style={{ fontSize: '0.88rem', color: '#38bdf8', fontWeight: 600 }}>{studentId}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(studentId, 'studentId')}
                  title="Copy Student ID"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedField === 'studentId' ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                >
                  {copiedField === 'studentId' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                <Mail size={15} />
                <span>Email / Username:</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <code style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{email}</code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(email, 'email')}
                  title="Copy Email"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: copiedField === 'email' ? '#10b981' : '#64748b',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex'
                  }}
                >
                  {copiedField === 'email' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Temporary Password Highlight Box */}
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1.1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, color: '#34d399' }}>
                <KeyRound size={16} />
                <span>{isTemporaryPassword ? 'One-Time Temporary Password' : 'Initial Student Password'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6ee7b7',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.78rem'
                }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                <span>{showPassword ? 'Hide' : 'Reveal'}</span>
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(0, 0, 0, 0.35)',
                borderRadius: '8px',
                padding: '0.65rem 0.9rem',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}
            >
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: '1.1rem',
                  letterSpacing: showPassword ? '0.08em' : '0.2em',
                  fontWeight: 700,
                  color: '#f8fafc',
                  userSelect: 'all'
                }}
              >
                {showPassword ? temporaryPassword : '••••••••••••'}
              </span>

              <button
                type="button"
                onClick={() => copyToClipboard(temporaryPassword, 'password')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: copiedField === 'password' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: copiedField === 'password' ? '#34d399' : '#f8fafc',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {copiedField === 'password' ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedField === 'password' ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Security Notice */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              fontSize: '0.8rem',
              lineHeight: 1.45
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Single-Handover Notice:</strong> This password cannot be retrieved once this window is closed.
              The student will be prompted to create their own secure password immediately upon first login.
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <button
            type="button"
            onClick={handleCopyAll}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: copiedField === 'all' ? '#34d399' : '#e2e8f0',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copiedField === 'all' ? <Check size={15} /> : <Copy size={15} />}
            <span>{copiedField === 'all' ? 'All Details Copied!' : 'Copy All Details'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-primary, #10b981)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            I have recorded these credentials
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialConfirmationModal;

