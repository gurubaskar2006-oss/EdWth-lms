import React, { useState } from 'react';
import { useLMS } from '../context/LMSContext';
import { Lock, ShieldAlert, Check, X, KeyRound, ArrowRight } from 'lucide-react';

export const ForcedPasswordChangeModal = ({ isOpen }) => {
  const { handleForcedPasswordChange, logout, terms } = useLMS();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const minLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const matches = newPassword && newPassword === confirmPassword;

  const isValid = minLength && hasUpper && hasLower && hasNumber && matches;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) {
      setError('Please satisfy all password security criteria before continuing.');
      return;
    }

    setLoading(true);
    setError('');

    const res = await handleForcedPasswordChange(newPassword, confirmPassword);
    if (!res.success) {
      setError(res.message || 'Failed to update password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 11, 20, 0.88)',
      backdropFilter: 'blur(10px)',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: 'var(--bg-card, #0f172a)',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(5, 150, 105, 0.15)',
        overflow: 'hidden',
        color: '#f8fafc'
      }}>
        {/* Banner Header */}
        <div style={{
          padding: '2rem 2rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 20px -5px rgba(5, 150, 105, 0.4)',
            marginBottom: '1rem'
          }}>
            <KeyRound size={26} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
            Create Your New Password
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem', lineHeight: 1.5 }}>
            Your account was issued a temporary credential by your {terms?.educatorLabel || 'educator'}. For your protection, you must establish a permanent secure password.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '2rem' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.82rem',
              marginBottom: '1.25rem'
            }}>
              <ShieldAlert size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter strong new password"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                    borderRadius: '9px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Lock size={15} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem 0.75rem 2.5rem',
                    borderRadius: '9px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <Lock size={15} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              </div>
            </div>

            {/* Password Criteria Checklist */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontSize: '0.76rem'
            }}>
              <div style={{ color: minLength ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {minLength ? <Check size={13} /> : <X size={13} />} At least 8 characters
              </div>
              <div style={{ color: hasUpper ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {hasUpper ? <Check size={13} /> : <X size={13} />} At least one uppercase letter (A-Z)
              </div>
              <div style={{ color: hasLower ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {hasLower ? <Check size={13} /> : <X size={13} />} At least one lowercase letter (a-z)
              </div>
              <div style={{ color: hasNumber ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {hasNumber ? <Check size={13} /> : <X size={13} />} At least one number (0-9)
              </div>
              <div style={{ color: matches ? '#10b981' : '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {matches ? <Check size={13} /> : <X size={13} />} Passwords match
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isValid}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.85rem',
                borderRadius: '9px',
                border: 'none',
                background: isValid
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: isValid ? '#ffffff' : '#64748b',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isValid && !loading ? 'pointer' : 'not-allowed',
                boxShadow: isValid ? '0 10px 25px -5px rgba(5, 150, 105, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {loading ? 'Securing Account...' : 'Set Permanent Password'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.78rem',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Sign out and change later
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForcedPasswordChangeModal;
