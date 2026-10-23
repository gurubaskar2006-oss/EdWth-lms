/**
 * Lumina LMS — useFocusTimer Hook
 * Wall-clock timestamp-based student focus timer.
 * Completely immune to background tab throttling, suspensions, and inactive window drift.
 *
 * 6th Civilians Corporation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_FOCUS_MINUTES,
  DEFAULT_BREAK_MINUTES,
  STORAGE_TIMER_STATE,
  STORAGE_FOCUS_DUR,
  STORAGE_BREAK_DUR,
  getTodayKey,
  calculateRemainingSeconds,
  isTimerExpired,
  createInitialTimerState,
  calculateStartedState,
  calculatePausedState,
  calculateResumedState
} from '../utils/focusTimerEngine';

export const useFocusTimer = ({ triggerConfetti, addToast } = {}) => {
  // 1. Configured Durations (in minutes)
  const [focusDuration, setFocusDuration] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_FOCUS_MINUTES;
    const saved = localStorage.getItem(STORAGE_FOCUS_DUR);
    return saved ? Math.max(1, Math.min(120, Number(saved) || DEFAULT_FOCUS_MINUTES)) : DEFAULT_FOCUS_MINUTES;
  });

  const [breakDuration, setBreakDuration] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_BREAK_MINUTES;
    const saved = localStorage.getItem(STORAGE_BREAK_DUR);
    return saved ? Math.max(1, Math.min(30, Number(saved) || DEFAULT_BREAK_MINUTES)) : DEFAULT_BREAK_MINUTES;
  });

  // 2. Authoritative Timer State Model
  const [timerState, setTimerState] = useState(() => {
    if (typeof window === 'undefined') {
      return createInitialTimerState('focus', DEFAULT_FOCUS_MINUTES);
    }
    const savedRaw = localStorage.getItem(STORAGE_TIMER_STATE);
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw);
        if (parsed && typeof parsed === 'object') {
          const now = Date.now();
          if (parsed.status === 'running' && parsed.endsAt) {
            // Check if already elapsed during page reload/absence
            if (now >= parsed.endsAt) {
              return {
                ...parsed,
                status: 'completed',
                remainingSeconds: 0
              };
            }
            return {
              ...parsed,
              remainingSeconds: calculateRemainingSeconds(parsed.endsAt, now)
            };
          }
          return parsed;
        }
      } catch (_) {}
    }
    return createInitialTimerState('focus', DEFAULT_FOCUS_MINUTES);
  });

  // 3. Daily Completed Sessions Count
  const [completedSessions, setCompletedSessions] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem(getTodayKey());
    return saved !== null ? Number(saved) || 0 : 0;
  });

  const completionInProgressRef = useRef(false);

  // Helper to persist and broadcast state
  const saveTimerState = useCallback((state) => {
    try {
      localStorage.setItem(STORAGE_TIMER_STATE, JSON.stringify(state));
    } catch (_) {}
  }, []);

  // Optional background browser notification (no audio, no nag)
  const sendBackgroundNotification = useCallback((title, body) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/favicon.ico' });
      } catch (_) {}
    }
  }, []);

  // 4. Session Completion Handler
  const handleSessionComplete = useCallback((currentState) => {
    if (completionInProgressRef.current) return;
    completionInProgressRef.current = true;

    const isFocus = currentState.mode === 'focus';
    const nextMode = isFocus ? 'break' : 'focus';
    const nextDurationMinutes = nextMode === 'focus' ? focusDuration : breakDuration;
    const nextDurationSec = nextDurationMinutes * 60;

    if (isFocus) {
      const todayKey = getTodayKey();
      const current = Number(localStorage.getItem(todayKey) || 0);
      const nextCount = current + 1;
      localStorage.setItem(todayKey, String(nextCount));
      setCompletedSessions(nextCount);

      triggerConfetti?.();
      addToast?.(
        'Focus Session Complete! 🎯',
        `Great work! Take a ${breakDuration}-minute break to recharge.`,
        'emerald'
      );
      sendBackgroundNotification(
        'Lumina Focus Complete! 🎯',
        `Great job! Time for a ${breakDuration}-minute break.`
      );
    } else {
      addToast?.(
        'Break Complete! ⚡',
        `Ready to start your next ${focusDuration}-minute focus block.`,
        'emerald'
      );
      sendBackgroundNotification(
        'Break Complete! ⚡',
        `Ready to start your next ${focusDuration}-minute focus block.`
      );
    }

    const completedState = {
      status: 'completed',
      mode: nextMode,
      durationSeconds: nextDurationSec,
      startedAt: null,
      endsAt: null,
      pausedAt: null,
      remainingSeconds: nextDurationSec
    };

    saveTimerState(completedState);
    setTimerState(completedState);

    setTimeout(() => {
      completionInProgressRef.current = false;
    }, 500);
  }, [focusDuration, breakDuration, triggerConfetti, addToast, saveTimerState, sendBackgroundNotification]);

  // 5. Visibility Change & Window Focus: Instant Recalculation from endsAt
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        setTimerState((prev) => {
          if (prev.status !== 'running' || !prev.endsAt) return prev;
          const now = Date.now();
          if (isTimerExpired(prev.endsAt, now)) {
            // Immediate completion on tab return without waiting for next interval tick
            setTimeout(() => handleSessionComplete(prev), 0);
            return {
              ...prev,
              status: 'completed',
              remainingSeconds: 0
            };
          }
          const updatedSec = calculateRemainingSeconds(prev.endsAt, now);
          const next = { ...prev, remainingSeconds: updatedSec };
          saveTimerState(next);
          return next;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [handleSessionComplete, saveTimerState]);

  // 6. Display Refresh Loop (The interval is solely for UI refresh, not source of truth)
  useEffect(() => {
    if (timerState.status === 'running' && timerState.endsAt) {
      const interval = setInterval(() => {
        setTimerState((prev) => {
          if (prev.status !== 'running' || !prev.endsAt) return prev;
          const now = Date.now();
          if (isTimerExpired(prev.endsAt, now)) {
            clearInterval(interval);
            setTimeout(() => handleSessionComplete(prev), 0);
            return {
              ...prev,
              status: 'completed',
              remainingSeconds: 0
            };
          }
          const updatedSec = calculateRemainingSeconds(prev.endsAt, now);
          if (updatedSec === prev.remainingSeconds) return prev;
          return { ...prev, remainingSeconds: updatedSec };
        });
      }, 500);

      return () => clearInterval(interval);
    }
  }, [timerState.status, timerState.endsAt, handleSessionComplete]);

  // 7. Multi-Tab Synchronization via Storage Events
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_TIMER_STATE && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            const now = Date.now();
            if (parsed.status === 'running' && parsed.endsAt) {
              if (now >= parsed.endsAt) {
                parsed.status = 'completed';
                parsed.remainingSeconds = 0;
              } else {
                parsed.remainingSeconds = calculateRemainingSeconds(parsed.endsAt, now);
              }
            }
            setTimerState(parsed);
          }
        } catch (_) {}
      }
      if (e.key === STORAGE_FOCUS_DUR && e.newValue) {
        setFocusDuration(Number(e.newValue) || DEFAULT_FOCUS_MINUTES);
      }
      if (e.key === STORAGE_BREAK_DUR && e.newValue) {
        setBreakDuration(Number(e.newValue) || DEFAULT_BREAK_MINUTES);
      }
      if (e.key === getTodayKey() && e.newValue) {
        setCompletedSessions(Number(e.newValue) || 0);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ─── Actions ─────────────────────────────────────────────────────────────

  // Start (or resume if paused)
  const startTimer = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status === 'running') return prev; // Prevent multiple running timers

      if (prev.status === 'paused') {
        const resumed = calculateResumedState(prev, Date.now());
        saveTimerState(resumed);
        return resumed;
      }

      const currentMins = prev.mode === 'focus' ? focusDuration : breakDuration;
      const started = calculateStartedState(prev.mode, currentMins, Date.now());
      saveTimerState(started);
      return started;
    });
  }, [focusDuration, breakDuration, saveTimerState]);

  // Pause
  const pauseTimer = useCallback(() => {
    setTimerState((prev) => {
      if (prev.status !== 'running') return prev;
      const paused = calculatePausedState(prev, Date.now());
      saveTimerState(paused);
      return paused;
    });
  }, [saveTimerState]);

  // Toggle
  const toggleTimer = useCallback(() => {
    if (timerState.status === 'running') {
      pauseTimer();
    } else {
      startTimer();
    }
  }, [timerState.status, pauseTimer, startTimer]);

  // Reset
  const resetTimer = useCallback(() => {
    setTimerState((prev) => {
      const currentMins = prev.mode === 'focus' ? focusDuration : breakDuration;
      const initial = createInitialTimerState(prev.mode, currentMins);
      saveTimerState(initial);
      return initial;
    });
  }, [focusDuration, breakDuration, saveTimerState]);

  // Switch Mode ('focus' | 'break')
  const switchMode = useCallback((newMode) => {
    setTimerState((prev) => {
      const currentMins = newMode === 'focus' ? focusDuration : breakDuration;
      const initial = createInitialTimerState(newMode, currentMins);
      saveTimerState(initial);
      return initial;
    });
  }, [focusDuration, breakDuration, saveTimerState]);

  // Update Custom Durations
  const updateDurations = useCallback((newFocusMins, newBreakMins) => {
    setFocusDuration(newFocusMins);
    setBreakDuration(newBreakMins);
    localStorage.setItem(STORAGE_FOCUS_DUR, String(newFocusMins));
    localStorage.setItem(STORAGE_BREAK_DUR, String(newBreakMins));

    setTimerState((prev) => {
      const currentMins = prev.mode === 'focus' ? newFocusMins : newBreakMins;
      const initial = createInitialTimerState(prev.mode, currentMins);
      saveTimerState(initial);
      return initial;
    });
  }, [saveTimerState]);

  // Formatted Output Helpers
  const remainingSec = timerState.remainingSeconds ?? (timerState.durationSeconds || 1500);
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  const totalDuration = timerState.durationSeconds || (focusDuration * 60);
  const progressPct = totalDuration > 0 ? Math.min(100, Math.max(0, ((totalDuration - remainingSec) / totalDuration) * 100)) : 0;

  return {
    timerState,
    focusDuration,
    breakDuration,
    completedSessions,
    formattedTime,
    progressPct,
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    switchMode,
    updateDurations
  };
};
