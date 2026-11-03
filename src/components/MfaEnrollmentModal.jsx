import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { useLMS } from '../context/LMSContext';
import { BrandLogo } from './BrandLogo';
import {
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  KeyRound,
  AlertTriangle,
  QrCode,
  Lock
} from 'lucide-react';

export const MfaEnrollmentModal = ({ isOpen, onSuccess }) => {
  const { user, logout, handleMfaEnrolled, addToast } = useLMS();
  const [loading, setLoading] = useState(true);
  const [setupData, setSetupData] = useState(null);
  const [error, setError] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [isAlreadyEnrolled, setIsAlreadyEnrolled] = useState(false);
  const [showReconfigForm, setShowReconfigForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [reconfigLoading, setReconfigLoading] = useState(false);
  const [reconfigError, setReconfigError] = useState('');

  // Fetch 2FA setup credentials when modal opens
  const fetchSetup = async () => {
    try {
      setLoading(true);
      setError('');
      setIsAlreadyEnrolled(false);
      const res = await apiService.setup2FA();
      if (res && res.success && res.qrCode) {
        setSetupData(res);
      } else if (res && (res.code === 'MFA_ALREADY_ENROLLED' || res.status === 403 || (res.message && res.message.includes('already enrolled')))) {
        setIsAlreadyEnrolled(true);
        setError(res?.message || 'Two-factor authentication is already enrolled for this account.');
      } else {
        setError(res?.message || 'Failed to initialize two-factor authentication credentials.');
      }
    } catch (err) {
      setError(err?.message || 'Network error initializing two-factor credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthorizeReconfig = async (e) => {
    e.preventDefault();
    if (!currentPassword.trim()) {
      setReconfigError('Current password is required.');
      return;
    }
    if (!currentCode.trim()) {
      setReconfigError('Active 6-digit MFA code or 8-character recovery backup code is required.');
      return;
    }
    try {
      setReconfigLoading(true);
      setReconfigError('');
      const res = await apiService.setup2FA({
        currentPassword: currentPassword.trim(),
        currentToken: currentCode.trim()
      });
      if (res && res.success && res.qrCode) {
        setSetupData(res);
        setIsAlreadyEnrolled(false);
        setShowReconfigForm(false);
        if (addToast) addToast('Re-authentication Verified', 'Scan the replacement QR code with your authenticator app.', 'emerald');
      } else {
        setReconfigError(res?.message || 'Re-authentication failed. Please check your password and MFA code.');
      }
    } catch (err) {
      setReconfigError(err?.message || 'Network error authorizing reconfiguration.');
    } finally {
      setReconfigLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !setupData && !verifiedSuccess) {
      fetchSetup();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
      if (addToast) addToast('Copied to Clipboard', 'Authenticator setup key copied.', 'emerald');
    }
  };

  const handleCopyBackupCodes = () => {
    if (setupData?.backupCodes && setupData.backupCodes.length > 0) {
      const formatted = setupData.backupCodes.join('\n');
      navigator.clipboard.writeText(formatted);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2500);
      if (addToast) addToast('Backup Codes Copied', 'Store them safely in a password manager.', 'emerald');
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    const cleanCode = verificationCode.replace(/\s+/g, '');
    if (!cleanCode) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (cleanCode.length < 6) {
      setError('Verification code must be 6 digits.');
      return;
    }

    try {
      setVerifying(true);
      setError('');
      // Call verify2FA without preAuthToken since this is an authenticated privileged session enrollment
      const res = await apiService.verify2FA(null, cleanCode);
      if (res && res.success) {
        setVerifiedSuccess(true);
        if (typeof handleMfaEnrolled === 'function') {
          handleMfaEnrolled(res.user);
        } else if (addToast) {
          addToast('2FA Activated', 'Multi-factor authentication successfully enabled.', 'emerald');
        }
        setTimeout(() => {
          if (onSuccess) onSuccess(res);
        }, 1200);
      } else {
        setError(res?.message || 'Invalid verification code. Check your authenticator app and try again.');
      }
    } catch (err) {
      setError(err?.message || 'Error verifying two-factor code.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(10, 10, 12, 0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          backgroundColor: 'var(--bg-surface, #1E1E24)',
          border: '1px solid #FFB21A33',
          borderRadius: '18px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 130, 18, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.75rem 2rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(245, 130, 18, 0.12) 0%, rgba(255, 178, 26, 0.04) 100%)',
            borderBottom: '1px solid var(--border-default, #2D3748)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              backgroundColor: '#171717',
              border: '1px solid #F58212',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 130, 18, 0.25)',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={26} color="#F58212" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#F58212', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                EdWth Academy • Security Enforcement
              </span>
            </div>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary, #FFFFFF)', margin: 0, letterSpacing: '0.01em' }}>
              {isAlreadyEnrolled ? 'Two-Factor Authentication Active' : 'Privileged MFA Enrollment Required'}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #94A3B8)', margin: '4px 0 0' }}>
              {isAlreadyEnrolled
                ? 'Your privileged SuperAdmin account has verified multi-factor protection active.'
                : 'SuperAdmin access requires mandatory two-factor authentication before unlocking administrative controls.'}
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <RefreshCw size={28} className="spin" color="#F58212" />
              <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary, #94A3B8)' }}>
                Generating cryptographic two-factor authentication credentials...
              </div>
            </div>
          ) : isAlreadyEnrolled && !setupData ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(5, 150, 105, 0.1)',
                  border: '1px solid rgba(5, 150, 105, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheck size={20} color="#059669" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary, #FFFFFF)' }}>
                    Two-Factor Authentication Already Active
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary, #94A3B8)', lineHeight: 1.5 }}>
                  This privileged account is already protected by multi-factor authentication. To protect against session hijacking, existing cryptographic secrets cannot be viewed or overwritten without re-authentication.
                </p>
              </div>

              {!showReconfigForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (logout) logout();
                      }}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-default, #2D3748)',
                        backgroundColor: 'var(--bg-secondary, #121217)',
                        color: 'var(--text-primary, #FFFFFF)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <LogOut size={16} />
                      <span>Sign In with MFA Code</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReconfigForm(true)}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border-default, #2D3748)',
                        backgroundColor: 'var(--bg-secondary, #121217)',
                        color: 'var(--text-primary, #FFFFFF)',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <KeyRound size={16} color="#F58212" />
                      <span>Replace Authenticator</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAuthorizeReconfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#F58212' }}>
                    Authorize MFA Reconfiguration
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)', margin: 0 }}>
                    Enter your current password and your active MFA code (or a single-use recovery backup code) to stage a replacement authenticator:
                  </p>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '0.25rem' }}>
                      Current Account Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      disabled={reconfigLoading}
                      required
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary, #121217)',
                        border: '1px solid var(--border-default, #334155)',
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.88rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-secondary, #94A3B8)', marginBottom: '0.25rem' }}>
                      Current 6-Digit Code or 8-Char Backup Code
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={currentCode}
                      onChange={(e) => setCurrentCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      placeholder="123456 or a1b2c3d4"
                      disabled={reconfigLoading}
                      required
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-secondary, #121217)',
                        border: '1px solid var(--border-default, #334155)',
                        color: 'var(--text-primary, #FFFFFF)',
                        fontSize: '0.92rem',
                        fontFamily: 'var(--font-mono, monospace)',
                        fontWeight: 700
                      }}
                    />
                  </div>

                  {reconfigError && (
                    <div style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                      <span>{reconfigError}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReconfigForm(false);
                        setReconfigError('');
                      }}
                      className="btn-secondary"
                      style={{ flex: 1, padding: '0.65rem', fontSize: '0.82rem' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reconfigLoading || !currentPassword.trim() || !currentCode.trim()}
                      className="btn-primary"
                      style={{
                        flex: 2,
                        padding: '0.65rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        backgroundColor: '#F58212',
                        borderColor: '#F58212',
                        color: '#FFFFFF',
                        cursor: reconfigLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {reconfigLoading ? 'Authorizing...' : 'Authorize Replacement'}
                    </button>
                  </div>
                </form>
              )}

              <div
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 178, 26, 0.08)',
                  border: '1px solid rgba(255, 178, 26, 0.2)',
                  fontSize: '0.73rem',
                  color: 'var(--text-secondary, #94A3B8)',
                  lineHeight: 1.45
                }}
              >
                <strong>Lost your authenticator & backup codes?</strong> MFA cannot be disabled or bypassed via self-service. Contact your institution administrator or 6th Civilians Corporation platform operations for audited manual identity recovery.
              </div>
            </div>
          ) : error && !setupData ? (
            <div style={{ padding: '1.25rem', borderRadius: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#EF4444', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} />
                <span style={{ fontWeight: 700 }}>Initialization Error</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
              <button
                type="button"
                onClick={fetchSetup}
                className="btn-secondary"
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', marginTop: '0.25rem' }}
              >
                <RefreshCw size={14} /> Retry Enrollment
              </button>
            </div>
          ) : verifiedSuccess ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(5, 150, 105, 0.15)',
                  border: '2px solid #059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#059669'
                }}
              >
                <Check size={32} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #FFFFFF)', margin: 0 }}>
                2FA Successfully Activated!
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #94A3B8)', maxWidth: '380px', margin: 0 }}>
                Your administrator account is now cryptographically secured. Unlocking full platform administration...
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Scan QR Code */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#F58212', color: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                    1
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                    Scan QR Code in Authenticator App
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary, #121217)',
                    border: '1px solid var(--border-default, #2D3748)'
                  }}
                >
                  {setupData?.qrCode ? (
                    <img
                      src={setupData.qrCode}
                      alt="Authenticator QR Code"
                      style={{
                        width: '135px',
                        height: '135px',
                        borderRadius: '8px',
                        backgroundColor: '#FFFFFF',
                        padding: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{ width: '135px', height: '135px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={40} color="#94A3B8" />
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94A3B8)', margin: 0, lineHeight: 1.45 }}>
                      This QR code is generated for initial enrollment or authorized replacement. Scan with <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong>, or <strong>Authy</strong>.
                    </p>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748B)', marginBottom: '0.25rem', fontWeight: 600 }}>
                        Manual Entry Secret Key:
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: 'var(--bg-surface, #1E1E24)',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default, #334155)'
                        }}
                      >
                        <code
                          style={{
                            fontSize: '0.78rem',
                            color: '#FFB21A',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1
                          }}
                        >
                          {setupData?.secret}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          title="Copy setup key"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedKey ? '#059669' : 'var(--text-secondary, #94A3B8)',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Emergency Recovery Codes */}
              {setupData?.backupCodes && setupData.backupCodes.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#F58212', color: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                        2
                      </span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                        Save Emergency Recovery Codes
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyBackupCodes}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: copiedCodes ? '#059669' : '#F58212',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '2px 6px'
                      }}
                    >
                      {copiedCodes ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedCodes ? 'Copied Codes' : 'Copy All'}</span>
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      backgroundColor: 'var(--bg-secondary, #121217)',
                      border: '1px solid var(--border-default, #2D3748)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                      gap: '0.5rem'
                    }}
                  >
                    {setupData.backupCodes.map((code, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '0.3rem 0.5rem',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-surface, #1E1E24)',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textAlign: 'center',
                          color: 'var(--text-primary, #F8FAFC)',
                          border: '1px solid rgba(255, 178, 26, 0.15)'
                        }}
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--text-muted, #64748B)', marginTop: '0.35rem' }}>
                    ⚠️ Each backup code is single-use. Store them in a secure password vault.
                  </div>
                </div>
              )}

              {/* Step 3: Enter 6-digit TOTP token */}
              <form onSubmit={handleVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#F58212', color: '#171717', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                    3
                  </span>
                  <label htmlFor="mfa-verify-input" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary, #FFFFFF)' }}>
                    Enter 6-Digit Authenticator Code
                  </label>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', margin: '-0.35rem 0 0.15rem' }}>
                  ⚠️ Codes expire every 30 seconds. Enter the current active code from your authenticator app to finalize activation.
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    id="mfa-verify-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9\s]/g, ''))}
                    placeholder="123456"
                    disabled={verifying}
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: '1.25rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 700,
                      letterSpacing: '0.3em',
                      textAlign: 'center',
                      padding: '0.65rem 1rem',
                      borderRadius: '10px',
                      border: error ? '1px solid #EF4444' : '1px solid #F58212',
                      backgroundColor: 'var(--bg-secondary, #121217)',
                      color: 'var(--text-primary, #FFFFFF)',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="submit"
                    disabled={verifying || !verificationCode.trim()}
                    style={{
                      padding: '0 1.5rem',
                      borderRadius: '10px',
                      backgroundColor: '#F58212',
                      border: '1px solid #F58212',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: verifying || !verificationCode.trim() ? 'not-allowed' : 'pointer',
                      opacity: verifying || !verificationCode.trim() ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(245, 130, 18, 0.35)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {verifying ? (
                      <>
                        <RefreshCw size={16} className="spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={16} />
                        <span>Verify & Activate</span>
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#EF4444',
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 2rem',
            backgroundColor: 'var(--bg-secondary, #121217)',
            borderTop: '1px solid var(--border-default, #2D3748)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #64748B)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Lock size={12} color="#F58212" />
            <span>EdWth LMS Enterprise Security Policy</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (logout) logout();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#EF4444',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.5rem'
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
