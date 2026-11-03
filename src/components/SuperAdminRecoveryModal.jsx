/**
 * EdWth LMS — SuperAdmin Account Recovery Modal
 * 6th Civilians Corporation
 *
 * Provides self-service recovery for an authorized SuperAdmin who lost passkey access:
 * 1. Request recovery link dispatched exclusively to the verified security mailbox (thesixthcivilians26@gmail.com).
 * 2. Enter recovery token or click email link.
 * 3. Enters restricted recovery session to register a new passkey authenticator.
 */

import React, { useState } from 'react';
import { apiService } from '../services/apiService';
import { startRegistration } from '@simplewebauthn/browser';
import {
  KeyRound,
  ShieldAlert,
  Mail,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

export const SuperAdminRecoveryModal = ({ isOpen, onClose, initialToken = '' }) => {
  const [step, setStep] = useState(initialToken ? 'verify_token' : 'request');
  const [identifier, setIdentifier] = useState('');
  const [tokenInput, setTokenInput] = useState(initialToken);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [recoveryUser, setRecoveryUser] = useState(null);

  // New Passkey Registration in recovery state
  const [deviceLabel, setDeviceLabel] = useState('');
  const [registering, setRegistering] = useState(false);

  if (!isOpen) return null;

  const handleRequestRecovery = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your SuperAdmin email or ID.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      const res = await apiService.requestPasskeyRecovery(identifier.trim());
      setMessage(res?.message || 'If an authorized account is registered, instructions were sent to the security mailbox.');
      setStep('enter_token');
    } catch (err) {
      setError('Failed to dispatch recovery request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyToken = async (e) => {
    if (e) e.preventDefault();
    const token = tokenInput.trim();
    if (!token || token.length < 32) {
      setError('Please enter a valid 64-character recovery token.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await apiService.verifyPasskeyRecovery(token);
      if (res && res.success) {
        setRecoveryUser(res.user);
        setStep('register_passkey');
        setMessage('Recovery token verified. Restricted recovery session active. Please register a replacement passkey.');
      } else {
        setError(res?.message || 'Recovery token verification failed.');
      }
    } catch (err) {
      setError('Invalid or expired recovery token.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterReplacementPasskey = async (e) => {
    e.preventDefault();
    const label = deviceLabel.trim() || 'Recovery Replacement Passkey';

    try {
      setRegistering(true);
      setError('');

      const optRes = await apiService.getPasskeyRegisterOptions();
      if (!optRes || !optRes.success || !optRes.options) {
        setError(optRes?.message || 'Failed to retrieve registration options.');
        return;
      }

      const attResp = await startRegistration({ optionsJSON: optRes.options });
      const verifyRes = await apiService.verifyPasskeyRegister(attResp, label);

      if (verifyRes && verifyRes.success) {
        setStep('completed');
        setMessage('Replacement passkey successfully registered! You may now sign in using your new passkey.');
      } else {
        setError(verifyRes?.message || 'Passkey verification failed.');
      }
    } catch (err) {
      setError(err?.message || 'Error during passkey registration.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '2rem', width: '90%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.5rem', borderRadius: '8px' }}>
              <ShieldAlert size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>SuperAdmin Account Recovery</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            {message}
          </div>
        )}

        {/* STEP 1: Request Recovery */}
        {step === 'request' && (
          <form onSubmit={handleRequestRecovery}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#64748b' }}>
              Lost access to your passkeys? Recovery instructions can be dispatched exclusively to the verified SuperAdmin security mailbox (<strong>thesixthcivilians26@gmail.com</strong>).
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                SuperAdmin Account Identifier
              </label>
              <input
                type="text"
                placeholder="edwthacademyadmin@6c.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep('enter_token')}
                style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Already have a token?
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.65rem 1.25rem', backgroundColor: '#b91c1c', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {loading ? 'Dispatching...' : 'Send Recovery Link'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Enter Token */}
        {(step === 'enter_token' || step === 'verify_token') && (
          <form onSubmit={handleVerifyToken}>
            <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#64748b' }}>
              Paste the recovery token received in your security mailbox:
            </p>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                Single-Use Recovery Token
              </label>
              <input
                type="text"
                placeholder="64-character hexadecimal token"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep('request')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                Back to Request
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '0.65rem 1.25rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {loading ? 'Verifying Token...' : 'Verify Token'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Register Replacement Passkey in Restricted Recovery Session */}
        {step === 'register_passkey' && (
          <form onSubmit={handleRegisterReplacementPasskey}>
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '0.75rem', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '1rem' }}>
              <strong>Restricted Session Active:</strong> You must register a new passkey before normal access is restored.
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                New Authenticator / Device Label
              </label>
              <input
                type="text"
                placeholder="e.g. New YubiKey, MacBook Touch ID"
                value={deviceLabel}
                onChange={(e) => setDeviceLabel(e.target.value)}
                style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={registering}
              style={{ width: '100%', padding: '0.75rem', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
            >
              {registering ? 'Activating Authenticator...' : 'Enroll Replacement Passkey'}
            </button>
          </form>
        )}

        {/* STEP 4: Completed */}
        {step === 'completed' && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <CheckCircle2 size={48} style={{ color: '#16a34a', marginBottom: '0.75rem' }} />
            <h4 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>Recovery Complete</h4>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.88rem', color: '#64748b' }}>
              Your replacement passkey has been successfully activated. You can now use it to log in.
            </p>
            <button
              onClick={onClose}
              style={{ padding: '0.65rem 1.5rem', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Close and Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminRecoveryModal;

