import { useState } from 'react';
import { Bell, BellOff, RotateCcw, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTimerContext } from '@/contexts/TimerContext';
import { usePushSubscription } from '@/hooks/usePushSubscription';
import { PREV_TIMER_KEY } from '@/hooks/useTimer';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function Spinner({
  value,
  onChange,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  max: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => onChange((value + 1) % (max + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground text-base leading-none">
        ▲
      </button>
      <input
        type="number"
        min={0}
        max={max}
        value={String(value).padStart(2, '0')}
        onChange={(e) => {
          const v = Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0));
          onChange(v);
        }}
        className="w-14 text-center text-3xl font-bold bg-transparent border-none outline-none focus:bg-accent/20 rounded-lg p-1 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange((value - 1 + max + 1) % (max + 1))}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground text-base leading-none">
        ▼
      </button>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function NumInput({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={String(value).padStart(2, '0')}
      onChange={(e) => onChange(Math.min(max, Math.max(0, parseInt(e.target.value, 10) || 0)))}
      className="w-11 text-center text-sm font-semibold rounded-lg border border-border bg-card/50 px-1 py-1.5 outline-none focus:ring-1 focus:ring-primary/30 tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

interface ReminderEntry {
  mins: number;
  secs: number;
}

export function TimerWidget() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [labelInput, setLabelInput] = useState('');
  const [reminders, setReminders] = useState<ReminderEntry[]>([]);

  const { state, start, pause, resume, reset, muted, toggleMute } = useTimerContext();
  const { permission, isSubscribed, subscribe } = usePushSubscription();

  const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
  const reminderMsList = reminders.map((r) => (r.mins * 60 + r.secs) * 1000);
  const hasInvalidReminder = reminderMsList.some((rMs) => rMs === 0 || rMs >= totalMs);

  const pushSupported =
    typeof Notification !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  function addReminder() {
    setReminders((prev) => [...prev, { mins: 5, secs: 0 }]);
  }

  function removeReminder(i: number) {
    setReminders((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateReminder(i: number, field: 'mins' | 'secs', value: number) {
    setReminders((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function handleStart() {
    await start(totalMs, labelInput || 'Timer', reminderMsList);
  }

  // ── Idle ─────────────────────────────────────────────────────────────────────
  if (state.status === 'idle') {
    return (
      <div className="space-y-4">
        {/* Time spinners */}
        <div className="flex items-center justify-center gap-3">
          <Spinner value={hours} onChange={setHours} max={23} label="hrs" />
          <span className="text-4xl font-bold text-muted-foreground mb-7">:</span>
          <Spinner value={minutes} onChange={setMinutes} max={59} label="min" />
          <span className="text-4xl font-bold text-muted-foreground mb-7">:</span>
          <Spinner value={seconds} onChange={setSeconds} max={59} label="sec" />
        </div>

        {/* Label */}
        <input
          type="text"
          placeholder="Label (optional — e.g. Pasta boiling)"
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          maxLength={60}
          className="w-full rounded-xl border border-border bg-card/50 px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />

        {/* Reminders */}
        <div className="space-y-2">
          {reminders.map((r, i) => {
            const rMs = (r.mins * 60 + r.secs) * 1000;
            const invalid = rMs === 0 || (totalMs > 0 && rMs >= totalMs);
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground w-[72px] shrink-0">
                  Reminder {i + 1}
                </span>
                <NumInput value={r.mins} max={99} onChange={(v) => updateReminder(i, 'mins', v)} />
                <span className="text-xs text-muted-foreground">m</span>
                <NumInput value={r.secs} max={59} onChange={(v) => updateReminder(i, 'secs', v)} />
                <span className="text-xs text-muted-foreground">s</span>
                {invalid && totalMs > 0 && (
                  <span className="text-[10px] text-rose-500 flex-1">before end</span>
                )}
                <button
                  type="button"
                  onClick={() => removeReminder(i)}
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addReminder}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
            <Plus className="h-3.5 w-3.5" />
            Set a reminder
          </button>
        </div>

        <Button
          className="w-full"
          disabled={totalMs === 0 || hasInvalidReminder}
          onClick={handleStart}>
          Start Timer
        </Button>

        {/* Notification opt-in */}
        {pushSupported && (
          <div className="text-center">
            {permission === 'denied' ? (
              <p className="text-[11px] text-muted-foreground">
                🔕 Notifications blocked in browser settings
              </p>
            ) : isSubscribed || permission === 'granted' ? (
              <p className="text-[11px] text-muted-foreground">
                🔔 Notifications on — you'll be alerted even if the app is closed
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void subscribe()}
                className="text-[11px] text-primary hover:text-primary/80 transition-colors underline underline-offset-2">
                Enable notifications to be alerted when done
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (state.status === 'done') {
    const hasPrev = (() => { try { return !!localStorage.getItem(PREV_TIMER_KEY); } catch { return false; } })();

    async function handleNewTimer() {
      setHours(0);
      setMinutes(5);
      setSeconds(0);
      setLabelInput('');
      setReminders([]);
      await reset();
    }

    async function handleUsePrevious() {
      try {
        const raw = localStorage.getItem(PREV_TIMER_KEY);
        if (raw) {
          const { durationMs, label: prevLabel, reminders: prevRems } = JSON.parse(raw) as {
            durationMs: number;
            label: string;
            reminders: number[];
          };
          const totalSec = Math.round(durationMs / 1000);
          setHours(Math.floor(totalSec / 3600));
          setMinutes(Math.floor((totalSec % 3600) / 60));
          setSeconds(totalSec % 60);
          setLabelInput(prevLabel === 'Timer' ? '' : prevLabel);
          setReminders(
            prevRems.map((rMs) => {
              const s = Math.round(rMs / 1000);
              return { mins: Math.floor(s / 60), secs: s % 60 };
            }),
          );
        }
      } catch {}
      await reset();
    }

    return (
      <div className="flex flex-col items-center gap-5 py-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-4xl">
          ⏰
        </div>
        <div className="text-center space-y-1">
          <p className="text-xl font-bold">Time's up!</p>
          {state.label && state.label !== 'Timer' && (
            <p className="text-sm text-muted-foreground">{state.label}</p>
          )}
        </div>
        <div className="flex gap-2 w-full">
          <Button className="flex-1 gap-2" onClick={handleNewTimer}>
            <Plus className="h-4 w-4" />New Timer
          </Button>
          {hasPrev && (
            <Button variant="outline" className="flex-1 gap-2" onClick={handleUsePrevious}>
              <RotateCcw className="h-4 w-4" />Use Previous
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Running / Paused ─────────────────────────────────────────────────────────
  // Find the next upcoming reminder (largest threshold still ahead of current remaining)
  const nextReminder = state.reminders
    .filter((rMs) => state.remainingMs > rMs)
    .reduce<number | null>((best, rMs) => (best === null || rMs > best ? rMs : best), null);

  return (
    <div className="flex flex-col items-center gap-5">
      {state.label && state.label !== 'Timer' && (
        <p className="text-sm font-medium text-muted-foreground">{state.label}</p>
      )}

      <div
        className={cn(
          'text-6xl font-bold tabular-nums tracking-tight',
          state.status === 'paused' && 'opacity-40',
        )}>
        {formatMs(state.remainingMs)}
      </div>

      {state.status === 'paused' && (
        <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider -mt-2">
          Paused
        </span>
      )}

      {nextReminder !== null && state.status === 'running' && (
        <p className="text-[11px] text-muted-foreground -mt-2">
          Next reminder in {formatMs(state.remainingMs - nextReminder)}
        </p>
      )}

      <div className="flex gap-2 w-full">
        {state.status === 'running' ? (
          <Button variant="outline" className="flex-1" onClick={pause}>Pause</Button>
        ) : (
          <Button className="flex-1" onClick={resume}>Resume</Button>
        )}
        <Button variant="outline" size="icon" onClick={reset} title="Reset timer">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Sound + push status row */}
      <div className="flex items-center justify-between w-full">
        {/* Sound toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={!muted}
          onClick={toggleMute}
          className="flex items-center gap-2 group cursor-pointer">
          <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Sound
          </span>
          <div className={cn(
            'relative w-9 h-5 rounded-full transition-colors duration-200',
            !muted ? 'bg-primary' : 'bg-muted-foreground/30',
          )}>
            <div className={cn(
              'absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
              !muted ? 'translate-x-[19px]' : 'translate-x-[3px]',
            )} />
          </div>
        </button>

        {/* Push notification status */}
        {state.status === 'running' && (
          isSubscribed ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Bell className="h-3.5 w-3.5 shrink-0" />
              <span>Notified when done</span>
            </div>
          ) : pushSupported && permission !== 'denied' ? (
            <button
              type="button"
              onClick={() => void subscribe()}
              className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium underline underline-offset-2">
              <BellOff className="h-3.5 w-3.5 shrink-0" />
              <span>Enable notifications</span>
            </button>
          ) : permission === 'denied' ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <BellOff className="h-3.5 w-3.5 shrink-0" />
              <span>Notifications blocked</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
