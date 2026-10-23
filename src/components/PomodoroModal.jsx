import React, { useState, useEffect, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import { Play, Pause, RotateCcw, X, Flame, Coffee, Settings2, Check, AlertCircle } from 'lucide-react';

export const PomodoroModal = () => {
  const { pomodoroOpen, setPomodoroOpen, focusTimer, addToast } = useLMS();

  const {
    timerState,
    focusDuration,
    breakDuration,
    completedSessions,
    formattedTime,
    progressPct,
    toggleTimer,
    resetTimer,
    switchMode,
    updateDurations
  } = focusTimer;

  const mode = timerState.mode;
  const isRunning = timerState.status === 'running';
  const timeLeft = timerState.remainingSeconds;

  // Settings customize panel toggle and edit inputs
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customFocusInput, setCustomFocusInput] = useState(String(focusDuration));
  const [customBreakInput, setCustomBreakInput] = useState(String(breakDuration));
  const [validationError, setValidationError] = useState('');

  // Keep inputs synced when customizing toggles
  useEffect(() => {
    if (isCustomizing) {
      setCustomFocusInput(String(focusDuration));
      setCustomBreakInput(String(breakDuration));
    }
  }, [isCustomizing, focusDuration, breakDuration]);

  const handleSaveCustomDurations = (e) => {
    e.preventDefault();
    setValidationError('');

    const focusVal = Number(customFocusInput.trim());
    const breakVal = Number(customBreakInput.trim());

    if (!customFocusInput.trim() || isNaN(focusVal) || !Number.isInteger(focusVal)) {
      setValidationError('Focus duration must be a valid whole number (1 - 120 minutes).');
      return;
    }
    if (focusVal < 1 || focusVal > 120) {
      setValidationError('Focus duration must be between 1 and 120 minutes.');
      return;
    }

    if (!customBreakInput.trim() || isNaN(breakVal) || !Number.isInteger(breakVal)) {
      setValidationError('Break duration must be a valid whole number (1 - 30 minutes).');
      return;
    }
    if (breakVal < 1 || breakVal > 30) {
      setValidationError('Break duration must be between 1 and 30 minutes.');
      return;
    }

    updateDurations(focusVal, breakVal);
    setIsCustomizing(false);
    addToast?.('Durations Updated', `Focus: ${focusVal}m · Break: ${breakVal}m`, 'emerald');
  };

  if (!pomodoroOpen) return null;

  const totalDuration = (mode === 'focus' ? focusDuration : breakDuration) * 60;

  return (
    <div className="modal-overlay" onClick={() => setPomodoroOpen(false)}>
      <div
        className="modal-content"
        style={{ maxWidth: '440px', padding: '1.75rem', textAlign: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flame size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Student Focus Timer
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              onClick={() => {
                setCustomFocusInput(String(focusDuration));
                setCustomBreakInput(String(breakDuration));
                setValidationError('');
                setIsCustomizing(!isCustomizing);
              }}
              className="btn-ghost"
              style={{ padding: '6px', borderRadius: '8px' }}
              title="Customise Durations"
            >
              <Settings2 size={18} color={isCustomizing ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
            </button>
            <button onClick={() => setPomodoroOpen(false)} className="btn-ghost" style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Customization Panel */}
        {isCustomizing && (
          <form
            onSubmit={handleSaveCustomDurations}
            noValidate
            style={{
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
              marginBottom: '1.25rem',
              textAlign: 'left'
            }}
          >
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
              Customise Timer Durations
            </div>

            {validationError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.78rem',
                  color: '#EF4444',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  marginBottom: '0.65rem'
                }}
              >
                <AlertCircle size={14} />
                <span>{validationError}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.85rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Focus Duration (1 - 120m)
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={customFocusInput}
                  onChange={(e) => setCustomFocusInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', fontWeight: 600 }}>
                  Break Duration (1 - 30m)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={customBreakInput}
                  onChange={(e) => setCustomBreakInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setIsCustomizing(false)}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                formNoValidate
                className="btn-primary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={14} />
                <span>Apply Settings</span>
              </button>
            </div>
          </form>
        )}

        {/* Mode Selector */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-full)',
            padding: '4px',
            marginBottom: '1.75rem',
            border: '1px solid var(--border-default)'
          }}
        >
          <button
            onClick={() => switchMode('focus')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'focus' ? 'var(--accent-primary)' : 'transparent',
              color: mode === 'focus' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            🔥 Deep Work ({focusDuration}m)
          </button>
          <button
            onClick={() => switchMode('break')}
            style={{
              flex: 1,
              padding: '0.45rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 700,
              fontSize: '0.85rem',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: mode === 'break' ? '#059669' : 'transparent',
              color: mode === 'break' ? '#FFFFFF' : 'var(--text-secondary)',
              transition: 'all 0.2s ease'
            }}
          >
            ☕ Quick Rest ({breakDuration}m)
          </button>
        </div>

        {/* Timer Radial Display */}
        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto 1.5rem' }}>
          <svg width="200" height="200" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke="var(--border-default)"
              strokeWidth="10"
            />
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke={mode === 'focus' ? 'var(--accent-primary)' : '#059669'}
              strokeWidth="10"
              strokeDasharray={2 * Math.PI * 85}
              strokeDashoffset={2 * Math.PI * 85 * (1 - progressPct / 100)}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 1s linear'
              }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2.5rem',
                fontWeight: 800,
                color: 'var(--text-primary)'
              }}
            >
              {formattedTime}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {mode === 'focus' ? 'Study Block' : 'Relax & Hydrate'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={resetTimer}
            className="btn-icon"
            style={{ width: '44px', height: '44px' }}
            title="Reset Timer"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={toggleTimer}
            className="btn-primary"
            style={{
              padding: '0.75rem 2rem',
              fontSize: '1rem',
              backgroundColor: mode === 'break' ? '#059669' : undefined,
              borderColor: mode === 'break' ? '#059669' : undefined
            }}
          >
            {isRunning ? (
              <>
                <Pause size={18} /> Pause
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" /> {timeLeft === totalDuration ? 'Start Focus' : 'Resume'}
              </>
            )}
          </button>
        </div>

        {/* Sessions Completed Today */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-surface-subtle)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>Today's Pomodoros</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {[...Array(Math.max(4, completedSessions))].map((_, i) => (
              <span
                key={i}
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: i < completedSessions ? 'var(--accent-primary)' : 'var(--border-default)'
                }}
              />
            ))}
            <span style={{ marginLeft: '6px', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {completedSessions} {completedSessions === 1 ? 'block' : 'blocks'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
