import { useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';
import { useTimerContext } from '@/contexts/TimerContext';
import { cn } from '@/lib/utils';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcPos(timerEl: HTMLElement | null): { left: number; top: number } | null {
  const vw = window.innerWidth;
  if (vw < 640) return null;
  const anchor = document.querySelector<HTMLElement>('[data-timer-align]');
  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const tw = timerEl?.offsetWidth ?? 160;
  // right edge of timer aligns exactly with right edge of page content container
  return { left: rect.right - tw, top: 12 };
}

export function FloatingTimer() {
  const { state, timerOpen, setTimerOpen, reset } = useTimerContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [wasDragged, setWasDragged] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const timerRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(state.status);
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const dragMovedRef = useRef(false);

  // When a new timer starts (idle → running), allow repositioning even after a drag
  useEffect(() => {
    if (prevStatusRef.current === 'idle' && state.status === 'running') {
      setWasDragged(false);
    }
    prevStatusRef.current = state.status;
  }, [state.status]);

  // Reposition after navigation, status change, or modal open/close.
  // Uses rAF so the page's content container is fully laid out before we read its position.
  useEffect(() => {
    if (state.status === 'idle' || wasDragged) return;
    const raf = requestAnimationFrame(() => {
      const next = calcPos(timerRef.current);
      if (next) setPos(next);
      else setPos(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, wasDragged, state.status, timerOpen]);

  // Reposition on window resize
  useEffect(() => {
    if (wasDragged) return;
    function handler() {
      const next = calcPos(timerRef.current);
      setPos(next);
    }
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [wasDragged]);

  // Global pointer move/up handlers for dragging
  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragRef.current) return;
      const clientX = 'touches' in e ? e.touches[0]!.clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0]!.clientY : (e as MouseEvent).clientY;
      const dx = clientX - dragRef.current.startX;
      const dy = clientY - dragRef.current.startY;
      if (!dragMovedRef.current && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      dragMovedRef.current = true;
      setIsDragging(true);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tw = timerRef.current?.offsetWidth ?? 160;
      setPos({
        left: Math.max(0, Math.min(vw - tw, dragRef.current.origLeft + dx)),
        top: Math.max(0, Math.min(vh - 50, dragRef.current.origTop + dy)),
      });
    }
    function onUp() {
      const moved = dragMovedRef.current;
      dragRef.current = null;
      setIsDragging(false);
      if (moved) setWasDragged(true);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  function handlePointerDown(e: React.MouseEvent | React.TouchEvent) {
    if ((e.target as HTMLElement).closest('[data-dismiss]')) return;
    const rect = timerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = 'touches' in e ? e.touches[0]!.clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0]!.clientY : (e as React.MouseEvent).clientY;
    dragMovedRef.current = false;
    dragRef.current = { startX: clientX, startY: clientY, origLeft: rect.left, origTop: rect.top };
    if (!('touches' in e)) (e as React.MouseEvent).preventDefault();
  }

  if (timerOpen || state.status === 'idle') return null;

  const isDone = state.status === 'done';
  const isPaused = state.status === 'paused';

  return (
    <div
      ref={timerRef}
      style={pos ? { left: pos.left, top: pos.top } : undefined}
      className={cn(
        'fixed z-40 flex items-center gap-1 select-none',
        pos ? '' : 'top-3 right-3',
        isDragging && 'opacity-90',
      )}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
    >
      <button
        type="button"
        title={state.label && state.label !== 'Timer' ? state.label : undefined}
        onClick={() => { if (!dragMovedRef.current) setTimerOpen(true); }}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg border transition-colors duration-150',
          isDone
            ? 'bg-green-500 text-white border-green-400 cursor-pointer'
            : cn(
                'bg-card border-border text-foreground hover:bg-accent',
                isDragging ? 'cursor-grabbing' : 'cursor-grab',
              ),
        )}>
        {isDone ? (
          <span className="text-sm">⏰</span>
        ) : (
          <Clock className={cn('h-3.5 w-3.5 shrink-0 text-primary', !isPaused && 'animate-pulse')} />
        )}

        <span className={cn('text-sm font-semibold tabular-nums', isPaused && 'opacity-50')}>
          {isDone ? "Time's up!" : formatMs(state.remainingMs)}
        </span>
      </button>

      {/* Cancel (running/paused) or dismiss (done) */}
      <button
        type="button"
        data-dismiss="true"
        onClick={() => void reset()}
        title={isDone ? 'Dismiss' : 'Cancel timer'}
        className="flex h-7 w-7 items-center justify-center rounded-full shadow-md border bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150 cursor-pointer shrink-0">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
