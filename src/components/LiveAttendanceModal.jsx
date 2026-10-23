import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { socketService } from '../services/socketService';

export const LiveAttendanceModal = ({ session, onClose, onConfirmed }) => {
  const [timeLeft, setTimeLeft] = useState(session.durationSeconds || 60);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleConfirm = async () => {
    if (submitting || confirmed) return;
    setSubmitting(true);

    try {
      const result = await socketService.markAttendance(session.sessionId);
      if (result && result.success) {
        setConfirmed(true);
        setStatusMessage(result.message || 'Attendance Confirmed!');
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (onConfirmed) onConfirmed();
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        setStatusMessage(result.message || 'Could not record attendance');
      }
    } catch (e) {
      setStatusMessage('Network issue recording attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const percentage = Math.max(0, Math.min(100, (timeLeft / (session.durationSeconds || 60)) * 100));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 24, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'linear-gradient(145deg, #111827, #0b0f19)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: '1.25rem',
          boxShadow: '0 20px 40px -15px rgba(16, 185, 129, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          overflow: 'hidden'
        }}
      >
        {/* Progress Bar */}
        <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)' }}>
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: percentage < 25 ? '#ef4444' : 'linear-gradient(90deg, #10b981, #06b6d4)',
              transition: 'width 1s linear'
            }}
          />
        </div>

        <div style={{ padding: '2rem', textAlign: 'center' }}>
          {/* Animated Status Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              margin: '0 auto 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: confirmed
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(6, 182, 212, 0.15)',
              border: `2px solid ${confirmed ? '#10b981' : '#06b6d4'}`,
              boxShadow: confirmed
                ? '0 0 20px rgba(16, 185, 129, 0.4)'
                : '0 0 20px rgba(6, 182, 212, 0.3)'
            }}
          >
            {confirmed ? (
              <CheckCircle2 size={32} color="#10b981" />
            ) : (
              <UserCheck size={32} color="#06b6d4" />
            )}
          </div>

          <span
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: 'var(--accent-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              marginBottom: '0.5rem'
            }}
          >
            <Sparkles size={14} /> Live Classroom Pulse
          </span>

          <h3
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}
          >
            {confirmed ? 'Attendance Verified!' : 'Confirm Your Attendance'}
          </h3>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
            {session.topic || 'Classroom Session'} • Hosted by{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{session.trainerName || 'Trainer'}</strong>
          </p>

          {/* Countdown Display */}
          {!confirmed && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: timeLeft < 15 ? '#FEF2F2' : 'var(--bg-surface-subtle)',
                border: timeLeft < 15 ? '1px solid #FECACA' : '1px solid var(--border-default)',
                padding: '0.5rem 1rem',
                borderRadius: '2rem',
                color: timeLeft < 15 ? 'var(--accent-urgent)' : 'var(--text-primary)',
                fontWeight: 700,
                fontSize: '0.95rem',
                marginBottom: '1.75rem'
              }}
            >
              <Clock size={16} />
              <span>{timeLeft}s remaining</span>
            </div>
          )}

          {statusMessage && !confirmed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: '#ef4444',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}
            >
              <AlertCircle size={16} />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Action Button */}
          {!confirmed ? (
            <button
              onClick={handleConfirm}
              disabled={submitting || timeLeft === 0}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: timeLeft === 0 ? 'var(--surface-light)' : 'linear-gradient(135deg, #10b981, #059669)',
                cursor: timeLeft === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCircle2 size={20} />
              {timeLeft === 0 ? 'Window Expired' : submitting ? 'Recording...' : 'I Am Present'}
            </button>
          ) : (
            <div
              style={{
                padding: '0.85rem',
                borderRadius: '0.75rem',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                fontWeight: 700,
                fontSize: '0.95rem'
              }}
            >
              ✓ Recorded in Real-Time System
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
