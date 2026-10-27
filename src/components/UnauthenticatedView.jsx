/**
 * EdWth LMS Authentication View
 * Brand: EdWth Academy
 * Tagline: Empowering Every Learner
 * Asset: /logo-transparent.png
 */
import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { ForcedPasswordChangeModal } from './ForcedPasswordChangeModal';
import { BrandLogo } from './BrandLogo';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  X,
  GraduationCap,
  Sparkles,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const UnauthenticatedView = ({ portalName }) => {
  const {
    login,
    handleVerify2FA,
    mustChangePasswordPromptOpen
  } = useLMS();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [isVerifying2FA, setIsVerifying2FA] = useState(false);

  // Developer / Demo Accounts Drawer (DEV ONLY - eliminated from production bundles)
  const [showDevAccounts, setShowDevAccounts] = useState(false);
  const isDevMode = import.meta.env.DEV;

  const DEMO_ACCOUNTS = import.meta.env.DEV
    ? [
        {
          label: 'Student (Dev)',
          roleName: 'Student',
          email: 'dev.student@lumina.test',
          pass: 'DevStudent@123!'
        },
        {
          label: 'Trainer / Teacher (Dev)',
          roleName: 'Trainer / Teacher',
          email: 'dev.trainer@lumina.test',
          pass: 'DevTrainer@123!'
        },
        {
          label: 'Admin (Dev)',
          roleName: 'Admin — 6th Civilians Corporation',
          email: 'dev.admin@lumina.test',
          pass: 'DevAdmin@123!'
        }
      ]
    : [];

  const handleSelectDemo = (demo) => {
    if (!import.meta.env.DEV) return;
    setIdentifier(demo.email);
    setPassword(demo.pass);
    setErrorMessage('');
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setErrorMessage('Please enter both your email or username and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await login(cleanId, cleanPass);

      if (res && res.requires2FA) {
        setPreAuthToken(res.preAuthToken);
        setRequires2FA(true);
        setIsSubmitting(false);
        return;
      }

      if (res && res.success && res.user) {
        const userRole = (res.user.role || 'student').toLowerCase();
        const currentPath = window.location.pathname.toLowerCase();

        // Route according to server-authoritative role
        if ((userRole === 'admin' || userRole === 'superadmin') && !currentPath.includes('admin.html')) {
          window.location.href = '/admin.html';
          return;
        }
        if ((userRole === 'trainer' || userRole === 'teacher') && !currentPath.includes('trainer.html')) {
          window.location.href = '/trainer.html';
          return;
        }
        if (userRole === 'student' && (currentPath.includes('admin.html') || currentPath.includes('trainer.html'))) {
          window.location.href = '/';
          return;
        }
      } else {
        setErrorMessage(res?.error || 'Incorrect email or password.');
      }
    } catch (err) {
      console.error('[Login] Submission error:', err);
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handle2FASubmit = async (e) => {
    if (e) e.preventDefault();
    if (isVerifying2FA) return;

    if (!totpToken.trim()) {
      setErrorMessage('Please enter your 6-digit authentication code.');
      return;
    }

    setErrorMessage('');
    setIsVerifying2FA(true);

    try {
      const res = await handleVerify2FA(preAuthToken, totpToken.trim());
      if (res && res.success && res.user) {
        const userRole = (res.user.role || 'student').toLowerCase();
        const currentPath = window.location.pathname.toLowerCase();

        if ((userRole === 'admin' || userRole === 'superadmin') && !currentPath.includes('admin.html')) {
          window.location.href = '/admin.html';
          return;
        }
        if ((userRole === 'trainer' || userRole === 'teacher') && !currentPath.includes('trainer.html')) {
          window.location.href = '/trainer.html';
          return;
        }
        if (userRole === 'student' && (currentPath.includes('admin.html') || currentPath.includes('trainer.html'))) {
          window.location.href = '/';
          return;
        }
      } else {
        setErrorMessage(res?.error || 'Invalid authentication code. Please try again.');
      }
    } catch (err) {
      console.error('[2FA] Verification error:', err);
      setErrorMessage('Verification failed. Please try again.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-main)',
        padding: '2rem 1rem',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(245, 130, 18, 0.08) 0%, transparent 65%)'
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <BrandLogo
          variant="full"
          size="lg"
          productBadge="LMS"
          subtitle={portalName || 'Institutional Learning Portal'}
          showTagline={true}
        />
      </div>

      {/* Main Authentication Card */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '2.25rem 2rem',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.06), 0 4px 12px -2px rgba(0, 0, 0, 0.03)'
        }}
      >
        {!requires2FA ? (
          /* Primary Username & Password Form */
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: '0 0 0.35rem 0'
                }}
              >
                Sign In
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Enter your institutional credentials to continue.
              </p>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#DC2626',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  animation: 'scaleUp 0.15s ease-out'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Identifier Field */}
            <div>
              <label
                htmlFor="login-identifier"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.4rem'
                }}
              >
                Email or Student ID
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Mail size={17} />
                </div>
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@institution.edu or ID"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.85rem 0.75rem 2.45rem',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label
                  htmlFor="login-password"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)'
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(true)}
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    textDecoration: 'none'
                  }}
                >
                  Need help signing in?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Lock size={17} />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.6rem 0.75rem 2.45rem',
                    fontSize: '0.9rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--accent-primary)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '2px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--accent-primary)',
                  cursor: 'pointer'
                }}
              />
              <label
                htmlFor="remember-me"
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                Keep me signed in on this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                borderColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(245, 130, 18, 0.3)',
                opacity: isSubmitting ? 0.75 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.4)',
                      borderTopColor: '#ffffff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block'
                    }}
                  />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Two-Factor Authentication Step */
          <form onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245, 130, 18, 0.12)',
                  color: 'var(--accent-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.75rem'
                }}
              >
                <ShieldCheck size={24} />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                Two-Factor Verification
              </h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                Enter the 6-digit verification code from your authenticator app.
              </p>
            </div>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(220, 38, 38, 0.08)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  color: '#DC2626',
                  fontSize: '0.84rem',
                  fontWeight: 500
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="totp-code"
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.4rem',
                  textAlign: 'center'
                }}
              >
                Verification Code
              </label>
              <input
                id="totp-code"
                type="text"
                maxLength="8"
                autoFocus
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/\s+/g, ''))}
                placeholder="123456"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  letterSpacing: '0.3em',
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying2FA}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                borderColor: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isVerifying2FA ? 'not-allowed' : 'pointer'
              }}
            >
              {isVerifying2FA ? 'Verifying...' : 'Confirm & Continue'}
            </button>

            <button
              type="button"
              onClick={() => {
                setRequires2FA(false);
                setTotpToken('');
                setErrorMessage('');
              }}
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                textAlign: 'center'
              }}
            >
              ← Back to login
            </button>
          </form>
        )}

        {/* ─── ISOLATED DEV / EVALUATION DRAWER (DEV MODE ONLY) ───────────────── */}
        {isDevMode && DEMO_ACCOUNTS.length > 0 && (
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-default)'
            }}
          >
            <button
              type="button"
              onClick={() => setShowDevAccounts(!showDevAccounts)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Terminal size={14} color="#D97706" />
                <span>Developer / Evaluation Access</span>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--text-muted)' }}>
                {showDevAccounts ? 'Hide' : 'Select Development Role'}
                {showDevAccounts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>

            {showDevAccounts && (
              <div
                style={{
                  marginTop: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  animation: 'scaleUp 0.15s ease-out'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Select development role:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectDemo(acc)}
                      style={{
                        padding: '0.55rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-default)',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-main)';
                      }}
                      title={acc.roleTitle}
                    >
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {acc.label}
                      </span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.1 }}>
                        {acc.roleTitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Assurance */}
      <div
        style={{
          marginTop: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)'
        }}
      >
        <ShieldCheck size={15} color="#F58212" />
        <span>EdWth Academy • Enterprise Academic Security</span>
      </div>

      {/* Need Help Signing In Modal */}
      {showHelpModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowHelpModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '100%',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-default)',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-elevation)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 130, 18, 0.12)',
                    color: '#F58212',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <HelpCircle size={20} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Password Recovery & Help
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              <p style={{ margin: '0 0 0.75rem 0' }}>
                To safeguard student records and institutional security, EdWth LMS does not provide public, unauthenticated password reset links.
              </p>
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.82rem',
                  color: 'var(--text-primary)'
                }}
              >
                <strong>How to reset your password:</strong>
                <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  <li><strong>Students:</strong> Contact your class Teacher, Course Trainer, or Department Coordinator.</li>
                  <li><strong>Faculty & Staff:</strong> Contact your Institution System Administrator.</li>
                </ul>
              </div>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Your educator or administrator will issue a secure, one-time temporary password. You will be prompted to set a new permanent password immediately upon signing in.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.65rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent-primary)',
                borderColor: 'var(--accent-primary)'
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Forced Password Change Modal */}
      <ForcedPasswordChangeModal isOpen={mustChangePasswordPromptOpen} />
    </div>
  );
};
