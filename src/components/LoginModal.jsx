import React, { useState, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  X,
  Lock,
  Mail,
  Eye,
  EyeOff,
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export const LoginModal = ({ isOpen, onClose }) => {
  const { login, handleVerify2FA } = useLMS();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setRequires2FA(false);
      setTotpToken('');
      setIsLoading(false);
      setIsVerifying2FA(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePostLoginNavigation = (authenticatedUser) => {
    const role = (authenticatedUser?.role || 'student').toLowerCase();
    const currentPath = window.location.pathname.toLowerCase();

    if ((role === 'admin' || role === 'superadmin') && !currentPath.includes('admin.html')) {
      window.location.href = '/admin.html';
      return;
    }
    if ((role === 'trainer' || role === 'teacher') && !currentPath.includes('trainer.html')) {
      window.location.href = '/trainer.html';
      return;
    }
    if (role === 'student' && (currentPath.includes('admin.html') || currentPath.includes('trainer.html'))) {
      window.location.href = '/';
      return;
    }

    onClose();
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    if (isLoading) return;

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setErrorMessage('Please enter both your email or username and password.');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await login(cleanId, cleanPass);

      if (res && res.requires2FA) {
        setPreAuthToken(res.preAuthToken);
        setRequires2FA(true);
        setIsLoading(false);
        return;
      }

      if (res && res.success && res.user) {
        handlePostLoginNavigation(res.user);
      } else {
        setErrorMessage(res?.error || 'Incorrect email or password.');
      }
    } catch (err) {
      console.error('[LoginModal] Submission error:', err);
      setErrorMessage('Unable to sign in right now. Please try again.');
    } finally {
      setIsLoading(false);
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
        handlePostLoginNavigation(res.user);
      } else {
        setErrorMessage(res?.error || 'Invalid authentication code. Please try again.');
      }
    } catch (err) {
      console.error('[LoginModal 2FA] Verification error:', err);
      setErrorMessage('Verification failed. Please try again.');
    } finally {
      setIsVerifying2FA(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '460px',
          width: '95%',
          padding: '2rem',
          position: 'relative',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn-icon"
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            width: '32px',
            height: '32px',
            color: 'var(--text-muted)'
          }}
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              backgroundColor: '#171717',
              border: '1.5px solid rgba(245, 130, 18, 0.45)',
              boxShadow: '0 6px 18px -3px rgba(245, 130, 18, 0.35)',
              marginBottom: '0.75rem',
              padding: '6px',
              overflow: 'hidden'
            }}
          >
            <img
              src="/logo-transparent.png"
              alt="EdWth Academy"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = '<span style="font-size:1.3rem;font-weight:900;color:#F58212;">E</span>';
                }
              }}
            />
          </div>
          <h2
            style={{
              fontSize: '1.55rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0
            }}
          >
            EdWth LMS
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#F58212',
                backgroundColor: 'rgba(245, 130, 18, 0.12)',
                padding: '0.1rem 0.45rem',
                borderRadius: '9999px',
                border: '1px solid rgba(245, 130, 18, 0.25)'
              }}
            >
              EdWth Academy
            </span>
          </div>
          <p
            style={{
              fontSize: '0.86rem',
              color: 'var(--text-secondary)',
              marginTop: '0.35rem',
              fontWeight: 500
            }}
          >
            Empowering Every Learner
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '0.75rem 0.9rem',
              marginBottom: '1.25rem',
              color: '#DC2626',
              fontSize: '0.84rem'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form: Standard Login or 2FA */}
        {!requires2FA ? (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '0.35rem'
                }}
              >
                Email or Username
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@institution.edu or student ID"
                  required
                  autoComplete="username"
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem 0.7rem 2.4rem',
                    fontSize: '0.88rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)'
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label
                  style={{
                    fontSize: '0.82rem',
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
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.78rem',
                    color: '#F58212',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Need help signing in?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.4rem 0.7rem 2.4rem',
                    fontSize: '0.88rem',
                    borderRadius: '10px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-surface)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: '#F58212' }}
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '10px',
                backgroundColor: '#F58212',
                borderColor: '#F58212',
                boxShadow: '0 4px 14px rgba(245, 130, 18, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1
              }}
            >
              {isLoading ? (
                <>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#ffffff',
                      animation: 'spin 0.8s linear infinite'
                    }}
                  />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(245, 130, 18, 0.12)',
                  color: '#F58212',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.5rem'
                }}
              >
                <ShieldCheck size={22} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                Two-Factor Authentication
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Enter the 6-digit verification code from your authenticator app
              </p>
            </div>

            <div>
              <input
                type="text"
                maxLength={6}
                value={totpToken}
                onChange={(e) => setTotpToken(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  letterSpacing: '0.35em',
                  textAlign: 'center',
                  borderRadius: '10px',
                  border: '1px solid var(--border-default)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setRequires2FA(false);
                  setTotpToken('');
                  setErrorMessage('');
                }}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.7rem', fontSize: '0.86rem' }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isVerifying2FA || totpToken.length < 6}
                className="btn-primary"
                style={{
                  flex: 2,
                  padding: '0.7rem',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  backgroundColor: '#F58212',
                  borderColor: '#F58212',
                  boxShadow: '0 4px 14px rgba(245, 130, 18, 0.3)',
                  opacity: isVerifying2FA || totpToken.length < 6 ? 0.6 : 1
                }}
              >
                {isVerifying2FA ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
          </form>
        )}

        {/* Development-Only Demo Accounts Drawer */}
        {isDevMode && DEMO_ACCOUNTS.length > 0 && (
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px dashed var(--border-default)'
            }}
          >
            <button
              type="button"
              onClick={() => setShowDevAccounts(!showDevAccounts)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                padding: '0.4rem 0.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '0.76rem',
                fontWeight: 600,
                borderRadius: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Terminal size={13} />
                <span>Developer / Demo Access (Local DEV Only)</span>
              </div>
              {showDevAccounts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showDevAccounts && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  Select development role:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectDemo(acc)}
                      style={{
                        padding: '0.55rem 0.35rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px'
                      }}
                      title={acc.roleName}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.72rem' }}>{acc.label}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.1 }}>{acc.roleName}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help Modal: Student Password Reset Policy */}
      {showHelpModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowHelpModal(false)}
          style={{ zIndex: 10001 }}
        >
          <div
            className="modal-content"
            style={{
              maxWidth: '460px',
              width: '92%',
              padding: '1.75rem',
              borderRadius: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
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
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Need Help Signing In?
                </h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="btn-icon"
                style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <p style={{ margin: 0 }}>
                <strong>Student Accounts:</strong> To safeguard student privacy and academic records, student accounts do not have self-service public password reset.
              </p>
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  fontSize: '0.82rem'
                }}
              >
                <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  How to reset your password:
                </p>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <li>Please contact your <strong>Teacher</strong>, <strong>Trainer</strong>, or <strong>Institution Administrator</strong>.</li>
                  <li>An authorized educator can generate a secure temporary password for your account.</li>
                  <li>Upon logging in with the temporary password, you will be prompted to create your new permanent password.</li>
                </ul>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Educators and Administrators: Please verify your registered institution email or contact IT operations for credentials assistance.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="btn-primary"
                style={{ backgroundColor: '#F58212', borderColor: '#F58212', padding: '0.5rem 1.25rem', fontSize: '0.84rem' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
