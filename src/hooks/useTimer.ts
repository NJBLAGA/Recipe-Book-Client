import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export const MUTE_KEY = 'rba-timer-muted';
export const PREV_TIMER_KEY = 'rba-timer-prev';

type StoredTimer =
  | {
      status: 'running';
      timerId: string;
      reminderTimerIds: string[];
      endsAt: number;
      label: string;
      reminders: number[]; // ms-remaining thresholds, e.g. [300000, 60000]
    }
  | { status: 'paused'; remainingMs: number; label: string; reminders: number[] };

export const TIMER_STORAGE_KEY = 'rba-timer';

function readStorage(): StoredTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTimer) : null;
  } catch {
    return null;
  }
}

function writeStorage(s: StoredTimer) {
  localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(s));
}

function clearStorage() {
  localStorage.removeItem(TIMER_STORAGE_KEY);
}

function isMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === 'true'; } catch { return false; }
}

function playSound(type: 'done' | 'warning') {
  if (isMuted()) return;
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    if (type === 'done') {
      const burstDuration = 3 * 0.28;
      const burstGap = 0.5;
      for (let rep = 0; rep < 3; rep++) {
        const repOffset = rep * (burstDuration + burstGap);
        [880, 1100, 1320].forEach((freq, i) => {
          const t = now + repOffset + i * 0.28;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.45, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
          osc.start(t);
          osc.stop(t + 0.28);
        });
      }
    } else {
      const toneDuration = 0.5;
      const toneGap = 0.35;
      for (let rep = 0; rep < 3; rep++) {
        const t = now + rep * (toneDuration + toneGap);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + toneDuration);
        osc.start(t);
        osc.stop(t + toneDuration);
      }
    }
  } catch {
    // AudioContext not available
  }
}

function formatReminderMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export interface TimerState {
  status: TimerStatus;
  remainingMs: number;
  label: string;
  timerId: string | null;
  reminderTimerIds: string[];
  reminders: number[];
}

export function useTimer() {
  const [muted, setMuted] = useState(isMuted);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch {}
      return next;
    });
  }

  const [state, setState] = useState<TimerState>({
    status: 'idle',
    remainingMs: 0,
    label: '',
    timerId: null,
    reminderTimerIds: [],
    reminders: [],
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endsAtRef = useRef<number | null>(null);
  const remindersRef = useRef<number[]>([]);
  const firedRef = useRef<Set<number>>(new Set());
  const labelRef = useRef('');

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(
    (endsAt: number, reminders: number[], label: string, onDone: () => void) => {
      stopInterval();
      endsAtRef.current = endsAt;
      remindersRef.current = reminders;
      labelRef.current = label;
      // Pre-mark reminders that have already passed (e.g. restoring mid-session)
      firedRef.current = new Set(
        reminders.map((rMs, i) => (endsAt - Date.now() <= rMs ? i : -1)).filter((i) => i >= 0),
      );

      intervalRef.current = setInterval(() => {
        const remaining = endsAtRef.current! - Date.now();
        if (remaining <= 0) {
          stopInterval();
          playSound('done');
          onDone();
          return;
        }

        // Check each reminder threshold
        remindersRef.current.forEach((rMs, i) => {
          if (remaining <= rMs && !firedRef.current.has(i)) {
            firedRef.current.add(i);
            playSound('warning');
            const timerName = labelRef.current && labelRef.current !== 'Timer' ? labelRef.current : 'your timer';
            toast.warning(`⏰ Reminder ${i + 1}`, {
              description: `${formatReminderMs(rMs)} remaining on ${timerName}`,
            });
          }
        });

        setState((s) => ({ ...s, remainingMs: remaining }));
      }, 100);
    },
    [stopInterval],
  );

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = readStorage();
    if (!stored) return;

    if (stored.status === 'running') {
      const remaining = stored.endsAt - Date.now();
      if (remaining <= 0) {
        clearStorage();
        setState((s) => ({ ...s, status: 'done', remainingMs: 0, label: stored.label }));
      } else {
        setState({
          status: 'running',
          remainingMs: remaining,
          label: stored.label,
          timerId: stored.timerId,
          reminderTimerIds: stored.reminderTimerIds,
          reminders: stored.reminders,
        });
        startInterval(stored.endsAt, stored.reminders, stored.label, () => {
          clearStorage();
          setState((s) => ({ ...s, status: 'done', remainingMs: 0 }));
        });
      }
    } else if (stored.status === 'paused') {
      setState({
        status: 'paused',
        remainingMs: stored.remainingMs,
        label: stored.label,
        timerId: null,
        reminderTimerIds: [],
        reminders: stored.reminders,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopInterval(), [stopInterval]);

  const start = useCallback(
    async (durationMs: number, label: string, reminders: number[] = []) => {
      if (durationMs <= 0) return;
      try {
        const durationSec = Math.ceil(durationMs / 1000);
        const timer = await api.post<{ id: string; fireAt: string }>('/api/push/timers', {
          label: label || 'Timer',
          duration: durationSec,
        });
        const endsAt = new Date(timer.fireAt).getTime();

        // Create push timers for each reminder
        const reminderTimerIds: string[] = [];
        for (const rMs of reminders) {
          if (rMs > 0 && rMs < durationMs) {
            const warnSec = Math.ceil((durationMs - rMs) / 1000);
            try {
              const wt = await api.post<{ id: string }>('/api/push/timers', {
                label: `⏰ ${label || 'Timer'} — ${formatReminderMs(rMs)} left`,
                duration: warnSec,
              });
              reminderTimerIds.push(wt.id);
            } catch { /* non-critical */ }
          }
        }

        try { localStorage.setItem(PREV_TIMER_KEY, JSON.stringify({ durationMs, label, reminders })); } catch {}
        writeStorage({ status: 'running', timerId: timer.id, reminderTimerIds, endsAt, label, reminders });
        setState({ status: 'running', remainingMs: durationMs, label, timerId: timer.id, reminderTimerIds, reminders });
        startInterval(endsAt, reminders, label, () => {
          clearStorage();
          setState((s) => ({ ...s, status: 'done', remainingMs: 0 }));
        });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to start timer');
      }
    },
    [startInterval],
  );

  const pause = useCallback(async () => {
    if (state.status !== 'running') return;
    stopInterval();
    const remainingMs = endsAtRef.current ? Math.max(0, endsAtRef.current - Date.now()) : state.remainingMs;

    const cancelIds = [state.timerId, ...state.reminderTimerIds].filter(Boolean) as string[];
    await Promise.allSettled(cancelIds.map((id) => api.delete(`/api/push/timers/${id}`)));

    writeStorage({ status: 'paused', remainingMs, label: state.label, reminders: state.reminders });
    setState((s) => ({ ...s, status: 'paused', remainingMs, timerId: null, reminderTimerIds: [] }));
  }, [state, stopInterval]);

  const resume = useCallback(async () => {
    if (state.status !== 'paused') return;
    try {
      const durationSec = Math.ceil(state.remainingMs / 1000);
      const timer = await api.post<{ id: string; fireAt: string }>('/api/push/timers', {
        label: state.label || 'Timer',
        duration: durationSec,
      });
      const endsAt = new Date(timer.fireAt).getTime();

      const reminderTimerIds: string[] = [];
      for (const rMs of state.reminders) {
        if (rMs > 0 && rMs < state.remainingMs) {
          const warnSec = Math.ceil((state.remainingMs - rMs) / 1000);
          try {
            const wt = await api.post<{ id: string }>('/api/push/timers', {
              label: `⏰ ${state.label || 'Timer'} — ${formatReminderMs(rMs)} left`,
              duration: warnSec,
            });
            reminderTimerIds.push(wt.id);
          } catch { /* non-critical */ }
        }
      }

      writeStorage({ status: 'running', timerId: timer.id, reminderTimerIds, endsAt, label: state.label, reminders: state.reminders });
      setState((s) => ({ ...s, status: 'running', timerId: timer.id, reminderTimerIds }));
      startInterval(endsAt, state.reminders, state.label, () => {
        clearStorage();
        setState((s) => ({ ...s, status: 'done', remainingMs: 0 }));
      });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to resume timer');
    }
  }, [state, startInterval]);

  const reset = useCallback(async () => {
    stopInterval();
    const cancelIds = [state.timerId, ...state.reminderTimerIds].filter(Boolean) as string[];
    await Promise.allSettled(cancelIds.map((id) => api.delete(`/api/push/timers/${id}`)));
    clearStorage();
    setState({ status: 'idle', remainingMs: 0, label: '', timerId: null, reminderTimerIds: [], reminders: [] });
  }, [state.timerId, state.reminderTimerIds, stopInterval]);

  return { state, start, pause, resume, reset, muted, toggleMute };
}
