import React, { useState } from 'react';
import { KeyRound, Copy, Check, AlertTriangle, ShieldCheck, X } from 'lucide-react';

export const ResetStudentPasswordModal = ({
  isOpen,
  student,
  educatorLabel = 'Educator',
  onClose,
  onConfirmReset
}) => {
  const [stage, setStage] = useState('confirm'); // 'confirm' | 'display'
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !student) return null;

  const handleReset = async () => {
    setLoading(true);
    setError('');
    try {
      const targetIdentifier = student._id || student.id || student.studentId;
      const res = await onConfirmReset(targetIdentifier);
      if (res && res.success && res.temporaryPassword) {
        setTemporaryPassword(res.temporaryPassword);
        setStage('display');
      } else {
        setError(res?.message || 'Failed to generate temporary password.');
      }
    } catch (e) {
      setError(e.message || 'Error executing password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleModalClose = () => {
    // Clear temporary password from memory immediately upon closing
    setTemporaryPassword('');
    setStage('confirm');
    setCopied(false);
    setError('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99990,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(5, 11, 20, 0.75)',
      backdropFilter: 'blur(8px)',
      padding: '1rem'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--bg-card, #0f172a)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        overflow: 'hidden',
        color: 'var(--text-primary, #f8fafc)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-default, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <KeyRound size={18} color="var(--accent-primary, #059669)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              {stage === 'confirm' ? 'Reset Student Password' : 'Password Reset Successfully'}
            </h3>
          </div>
          <button
            onClick={handleModalClose}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.2rem' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem',
              borderRadius: '7px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.82rem',
              marginBottom: '1rem'
            }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {stage === 'confirm' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to reset the password for{' '}
                <strong style={{ color: 'var(--text-primary, #fff)' }}>{student.name}</strong> ({student.studentId})?
              </p>

              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                border: '1px solid rgba(217, 119, 6, 0.25)',
                fontSize: '0.8rem',
                color: '#fbbf24',
                lineHeight: 1.45
              }}>
                A cryptographically secure temporary password will be generated. The student will be required to create a new permanent password on next login.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleModalClose}
                  style={{
                    padding: '0.55rem 1rem',
                    borderRadius: '7px',
                    border: '1px solid var(--border-default, #334155)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary, #94a3b8)',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '7px',
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
                  }}
                >
                  {loading ? 'Generating...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                <ShieldCheck size={18} />
                <span>Temporary credential generated</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '0.4rem' }}>
                  Temporary Password
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(5, 150, 105, 0.4)',
                  fontFamily: 'monospace',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  color: '#34d399',
                  letterSpacing: '0.08em'
                }}>
                  <span>{temporaryPassword}</span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: copied ? '#059669' : 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div style={{
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                lineHeight: 1.5
              }}>
                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.2rem' }}>
                  ⚠️ Give this password directly to the student.
                </div>
                This temporary password is displayed <strong>only once</strong> and will never be shown again. The student will be forced to choose their own password upon login.
              </div>

              <button
                type="button"
                onClick={handleModalClose}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                I Have Given The Password To The Student
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetStudentPasswordModal;
