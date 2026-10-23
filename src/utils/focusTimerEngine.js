/**
 * Lumina LMS — Focus Timer Engine
 * Wall-clock timestamp-based state calculations.
 * Completely immune to browser setInterval background tab throttling.
 *
 * 6th Civilians Corporation
 */

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

export const STORAGE_TIMER_STATE = 'lumina_focus_timer_state';
export const STORAGE_FOCUS_DUR = 'pomodoro_focus_dur';
export const STORAGE_BREAK_DUR = 'pomodoro_break_dur';

export const getTodayKey = () => `pomodoro_completed_${new Date().toISOString().slice(0, 10)}`;

/**
 * Calculates remaining seconds strictly from the absolute deadline (endsAt).
 * Immune to setInterval delays or background throttling.
 */
export const calculateRemainingSeconds = (endsAt, now = Date.now()) => {
  if (!endsAt) return 0;
  const remainingMs = endsAt - now;
  return Math.max(0, Math.ceil(remainingMs / 1000));
};

/**
 * Checks whether the timer has expired based on wall-clock time.
 */
export const isTimerExpired = (endsAt, now = Date.now()) => {
  if (!endsAt) return false;
  return now >= endsAt;
};

/**
 * Creates initial idle timer state.
 */
export const createInitialTimerState = (mode = 'focus', durationMinutes = DEFAULT_FOCUS_MINUTES) => {
  const durationSeconds = Math.max(1, Math.round(durationMinutes * 60));
  return {
    status: 'idle', // 'idle' | 'running' | 'paused' | 'completed'
    mode, // 'focus' | 'break'
    durationSeconds,
    startedAt: null,
    endsAt: null,
    pausedAt: null,
    remainingSeconds: durationSeconds
  };
};

/**
 * Calculates new running state from starting the timer.
 */
export const calculateStartedState = (currentMode, durationMinutes, now = Date.now()) => {
  const durationSeconds = Math.max(1, Math.round(durationMinutes * 60));
  const endsAt = now + durationSeconds * 1000;
  return {
    status: 'running',
    mode: currentMode,
    durationSeconds,
    startedAt: now,
    endsAt,
    pausedAt: null,
    remainingSeconds: durationSeconds
  };
};

/**
 * Calculates paused state based on exact elapsed wall-clock time at pause moment.
 */
export const calculatePausedState = (timerState, now = Date.now()) => {
  if (timerState.status !== 'running' || !timerState.endsAt) {
    return timerState;
  }
  const remainingSeconds = calculateRemainingSeconds(timerState.endsAt, now);
  return {
    ...timerState,
    status: 'paused',
    pausedAt: now,
    remainingSeconds
  };
};

/**
 * Calculates resumed state, projecting a fresh endsAt deadline from current now + remainingSeconds.
 */
export const calculateResumedState = (timerState, now = Date.now()) => {
  if (timerState.status !== 'paused') {
    return timerState;
  }
  const remainingSec = timerState.remainingSeconds > 0 
    ? timerState.remainingSeconds 
    : timerState.durationSeconds;
  const endsAt = now + remainingSec * 1000;
  return {
    ...timerState,
    status: 'running',
    startedAt: now - (timerState.durationSeconds - remainingSec) * 1000,
    endsAt,
    pausedAt: null,
    remainingSeconds: remainingSec
  };
};

/**
 * Re-evaluates active timer state against current wall-clock time.
 * Called on visibilitychange, window focus, interval ticks, and cross-tab storage events.
 */
export const evaluateTimerOnTick = (timerState, now = Date.now()) => {
  if (timerState.status !== 'running' || !timerState.endsAt) {
    return timerState;
  }
  if (isTimerExpired(timerState.endsAt, now)) {
    return {
      ...timerState,
      status: 'completed',
      remainingSeconds: 0
    };
  }
  const remainingSeconds = calculateRemainingSeconds(timerState.endsAt, now);
  if (remainingSeconds === timerState.remainingSeconds) {
    return timerState;
  }
  return {
    ...timerState,
    remainingSeconds
  };
};
