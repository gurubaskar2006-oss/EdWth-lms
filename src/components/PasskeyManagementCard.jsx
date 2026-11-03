/**
 * EdWth LMS — SuperAdmin Passkey & Security Management Card
 * 6th Civilians Corporation
 *
 * Provides SuperAdmin UI for:
 * 1. Security Email Binding to thesixthcivilians26@gmail.com (with OTP verification)
 * 2. Registering new WebAuthn Passkeys (Touch ID, Windows Hello, Security Keys)
 * 3. Listing registered passkeys with device labels and timestamps
 * 4. Removing passkeys with fresh re-authentication
 */

import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { startRegistration } from '@simplewebauthn/browser';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Laptop,
  Trash2,
  Plus,
  RefreshCw,
  Mail,
  AlertTriangle,
  Lock,
  CheckCircle2,
  X
} from 'lucide-react';

export const PasskeyManagementCard = ({ addToast }) => {
  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerError, setRegisterError] = useState('');

  // Security Email Binding State
  const [emailStatus, setEmailStatus] = useState(null);
  const [showBindingModal, setShowBindingModal] = useState(false);
  const [bindingOtp, setBindingOtp] = useState('');
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingError, setBindingError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Deletion Re-authentication State
  const [deletingId, setDeletingId] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteMfaCode, setDeleteMfaCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [pkRes, emailRes] = await Promise.all([
        apiService.getPasskeys(),
        apiService.getSecurityEmailStatus()
      ]);

      if (pkRes && pkRes.success) {
        setPasskeys(pkRes.passkeys || []);
      }
      if (emailRes && emailRes.success) {
        setEmailStatus(emailRes.status);
      }
    } catch (err) {
      console.error('Error loading passkey data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // --- Handlers: Security Email Binding ---
  const handleSendBindingOtp = async () => {
    try {
      setBindingLoading(true);
      setBindingError('');
      const res = await apiService.sendSecurityEmailOtp();
      if (res && res.success) {
        setOtpSent(true);
        setResendCooldown(res.resendAfter || 60);
        if (addToast) addToast('Verification Code Sent', 'Check the authorized security mailbox for your single-use code.', 'emerald');
      } else {
        const errorText = res?.code === 'EMAIL_PROVIDER_NOT_CONFIGURED'
          ? 'Outbound email delivery is not configured. Real verification messages cannot be sent to the authorized mailbox until SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are added to server/.env.'
          : (res?.message || 'Failed to dispatch verification code.');
        setBindingError(errorText);
        if (addToast) addToast('Dispatch Notice', errorText, 'amber');
      }
    } catch (err) {
      setBindingError(err?.message || 'Network error dispatching OTP.');
    } finally {
      setBindingLoading(false);
    }
  };

  const handleVerifyBindingOtp = async (e) => {
    e.preventDefault();
    if (!bindingOtp.trim() || bindingOtp.trim().length !== 6) {
      setBindingError('Please enter the 6-digit verification code.');
      return;
    }

    try {
      setBindingLoading(true);
      setBindingError('');
      const res = await apiService.verifySecurityEmailOtp(bindingOtp.trim());
      if (res && res.success) {
        setShowBindingModal(false);
        setBindingOtp('');
        setOtpSent(false);
        if (addToast) addToast('Security Mailbox Bound', 'Your SuperAdmin account is now bound to the authorized security email.', 'emerald');
        loadData();
      } else {
        setBindingError(res?.message || 'Verification failed. Please check the code.');
      }
    } catch (err) {
      setBindingError(err?.message || 'Network error verifying code.');
    } finally {
      setBindingLoading(false);
    }
  };

  // --- Handlers: Passkey Registration ---
  const handleStartPasskeyRegistration = async (e) => {
    e.preventDefault();
    const label = deviceLabel.trim() || 'Authenticator Passkey';

    try {
      setRegistering(true);
      setRegisterError('');

      // 1. Get options from server
      const optRes = await apiService.getPasskeyRegisterOptions();
      if (!optRes || !optRes.success || !optRes.options) {
        setRegisterError(optRes?.message || 'Failed to retrieve passkey registration options.');
        return;
      }

      // 2. Perform WebAuthn browser ceremony
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: optRes.options });
      } catch (browserErr) {
        setRegisterError(`Passkey ceremony cancelled or not supported: ${browserErr.message}`);
        return;
      }

      // 3. Verify on server
      const verifyRes = await apiService.verifyPasskeyRegister(attResp, label);
      if (verifyRes && verifyRes.success) {
        setShowRegisterModal(false);
        setDeviceLabel('');
        if (addToast) addToast('Passkey Registered', `Passkey "${label}" was successfully registered.`, 'emerald');
        loadData();
      } else {
        setRegisterError(verifyRes?.message || 'Verification of passkey failed.');
      }
    } catch (err) {
      setRegisterError(err?.message || 'Error completing passkey registration.');
    } finally {
      setRegistering(false);
    }
  };

  // --- Handlers: Passkey Deletion ---
  const handleDeletePasskey = async (e) => {
    e.preventDefault();
    if (!deletePassword.trim()) {
      setDeleteError('Current password is required.');
      return;
    }
    if (!deleteMfaCode.trim()) {
      setDeleteError('Active 6-digit MFA code or 8-character recovery code is required.');
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError('');
      const res = await apiService.deletePasskey(deletingId, {
        currentPassword: deletePassword.trim(),
        secondFactorCode: deleteMfaCode.trim()
      });

      if (res && res.success) {
        setDeletingId(null);
        setDeletePassword('');
        setDeleteMfaCode('');
        if (addToast) addToast('Passkey Removed', res.message || 'Passkey was successfully removed.', 'emerald');
        loadData();
      } else {
        setDeleteError(res?.message || 'Failed to remove passkey.');
      }
    } catch (err) {
      setDeleteError(err?.message || 'Error during passkey removal.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '8px', color: '#2563eb' }}>
            <KeyRound size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#0f172a' }}>SuperAdmin Passkeys (FIDO2 / WebAuthn)</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Phishing-resistant biometrics and security keys for administrative access.</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Security Mailbox Binding Status Alert */}
      {emailStatus && (
        <div style={{
          backgroundColor: emailStatus.isSecurityEmailVerified ? '#f0fdf4' : (emailStatus.emailProviderConfigured === false ? '#fef2f2' : '#fffbeb'),
          border: `1px solid ${emailStatus.isSecurityEmailVerified ? '#bbf7d0' : (emailStatus.emailProviderConfigured === false ? '#fecaca' : '#fde68a')}`,
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {emailStatus.isSecurityEmailVerified ? (
                <ShieldCheck size={20} style={{ color: '#16a34a' }} />
              ) : (
                <ShieldAlert size={20} style={{ color: emailStatus.emailProviderConfigured === false ? '#dc2626' : '#d97706' }} />
              )}
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: emailStatus.isSecurityEmailVerified ? '#15803d' : (emailStatus.emailProviderConfigured === false ? '#991b1b' : '#b45309') }}>
                  {emailStatus.isSecurityEmailVerified ? 'Authorized Security Mailbox Verified' : 'Security Mailbox Verification Required'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  Authorized destination: <strong>{emailStatus.authorizedSecurityEmail || 'thesixthcivilians26@gmail.com'}</strong>
                  {emailStatus.emailProviderConfigured === false && (
                    <span style={{ marginLeft: '0.5rem', color: '#b91c1c', fontWeight: 500, fontSize: '0.78rem' }}>
                      (Outbound SMTP not configured in server/.env)
                    </span>
                  )}
                </div>
              </div>
            </div>
            {emailStatus.requiresBinding && (
              <button
                onClick={() => {
                  setShowBindingModal(true);
                  handleSendBindingOtp();
                }}
                style={{
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Verify & Bind Email
              </button>
            )}
          </div>
          {emailStatus.emailProviderConfigured === false && !emailStatus.isSecurityEmailVerified && (
            <div style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #fee2e2',
              fontSize: '0.8rem',
              color: '#7f1d1d'
            }}>
              <strong>Outbound Mailbox Notice:</strong> Outbound SMTP credentials are not configured in <code>server/.env</code>. To receive live verification codes at <code>thesixthcivilians26@gmail.com</code>, add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> (e.g. Gmail App Password).
            </div>
          )}
        </div>
      )}

      {/* Registered Passkeys List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>Registered Security Keys & Biometrics</h4>
          <button
            onClick={() => {
              if (emailStatus && emailStatus.requiresBinding) {
                alert('Please bind and verify the authorized SuperAdmin security mailbox before enrolling passkeys.');
                return;
              }
              setShowRegisterModal(true);
              setDeviceLabel('');
              setRegisterError('');
            }}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Plus size={16} />
            Register Passkey
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading registered authenticators...</div>
        ) : passkeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '8px', color: '#64748b' }}>
            <KeyRound size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
            <p style={{ margin: '0 0 0.5rem', fontWeight: 500 }}>No passkeys registered yet.</p>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>Enroll Touch ID, Windows Hello, or a hardware security key (YubiKey) for fast, passwordless login.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ color: '#2563eb', backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    {pk.deviceType === 'multiDevice' ? <Smartphone size={18} /> : <Laptop size={18} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.92rem' }}>{pk.deviceLabel || 'Security Passkey'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Registered: {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString() : 'Active'} {pk.lastUsedAt ? `• Last used: ${new Date(pk.lastUsedAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeletingId(pk.id);
                    setDeletePassword('');
                    setDeleteMfaCode('');
                    setDeleteError('');
                  }}
                  title="Remove passkey"
                  style={{
                    color: '#ef4444',
                    background: 'none',
                    border: '1px solid #fecaca',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.8rem'
                  }}
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Register Passkey */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.75rem', width: '90%', maxWidth: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Register New Passkey</h3>
              <button onClick={() => setShowRegisterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            {registerError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {registerError}
              </div>
            )}
            <form onSubmit={handleStartPasskeyRegistration}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                  Device Name / Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. MacBook Pro TouchID, YubiKey 5C"
                  value={deviceLabel}
                  onChange={(e) => setDeviceLabel(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  style={{ padding: '0.6rem 1rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {registering ? 'Activating Authenticator...' : 'Continue with Biometric/Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bind Security Email */}
      {showBindingModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.75rem', width: '90%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Verify Security Mailbox</h3>
              <button onClick={() => setShowBindingModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              Authorized security mailbox: <br />
              <strong style={{ color: '#0f172a' }}>{emailStatus?.authorizedSecurityEmail || 'thesixthcivilians26@gmail.com'}</strong>
            </p>
            {emailStatus?.emailProviderConfigured === false && (
              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.65rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                ⚠️ <strong>Outbound Provider Unconfigured:</strong> Live email delivery requires <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and <code>SMTP_PASS</code> in <code>server/.env</code>.
              </div>
            )}
            {bindingError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {bindingError}
              </div>
            )}
            <form onSubmit={handleVerifyBindingOtp}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={bindingOtp}
                  onChange={(e) => setBindingOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '4px', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleSendBindingOtp}
                  disabled={resendCooldown > 0 || bindingLoading}
                  style={{ background: 'none', border: 'none', color: resendCooldown > 0 ? '#94a3b8' : '#2563eb', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer', fontSize: '0.82rem' }}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowBindingModal(false)}
                    style={{ padding: '0.55rem 0.9rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bindingLoading}
                    style={{ padding: '0.55rem 1.1rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    {bindingLoading ? 'Verifying...' : 'Verify & Bind'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Re-authenticate to Delete Passkey */}
      {deletingId && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.75rem', width: '90%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#b91c1c' }}>Authorize Passkey Removal</h3>
              <button onClick={() => setDeletingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: '#64748b' }}>
              Removing an administrative passkey requires fresh verification with another factor.
            </p>
            {deleteError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {deleteError}
              </div>
            )}
            <form onSubmit={handleDeletePasskey}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.35rem' }}>
                  Current Account Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.35rem' }}>
                  Active MFA Code or Backup Code
                </label>
                <input
                  type="text"
                  placeholder="6-digit TOTP or 8-char backup code"
                  value={deleteMfaCode}
                  onChange={(e) => setDeleteMfaCode(e.target.value.trim())}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setDeletingId(null)}
                  style={{ padding: '0.55rem 0.9rem', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  style={{ padding: '0.55rem 1.1rem', backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {deleteLoading ? 'Verifying...' : 'Confirm Removal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasskeyManagementCard;

