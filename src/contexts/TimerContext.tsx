import { createContext, useContext, useEffect, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import type { TimerState } from '@/hooks/useTimer';

interface TimerContextValue {
  state: TimerState;
  start: (durationMs: number, label: string, reminders?: number[]) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  reset: () => Promise<void>;
  timerOpen: boolean;
  setTimerOpen: (open: boolean) => void;
  muted: boolean;
  toggleMute: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const timer = useTimer();
  const [timerOpen, setTimerOpen] = useState(false);

  // Bring up the modal automatically when the timer fires
  useEffect(() => {
    if (timer.state.status === 'done') {
      setTimerOpen(true);
    }
  }, [timer.state.status]);

  return (
    <TimerContext.Provider value={{ ...timer, timerOpen, setTimerOpen }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimerContext() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimerContext must be used within TimerProvider');
  return ctx;
}
