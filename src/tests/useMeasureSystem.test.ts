import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMeasureSystem, getMeasureDefault, MeasureSystem } from '@/hooks/useMeasureSystem';

describe('getMeasureDefault', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns metric when nothing is stored', () => {
    expect(getMeasureDefault()).toBe('metric');
  });

  it('returns imperial when stored as imperial', () => {
    localStorage.setItem('measurementSystem', 'imperial');
    expect(getMeasureDefault()).toBe('imperial');
  });

  it('returns metric for any unrecognised stored value', () => {
    localStorage.setItem('measurementSystem', 'stones-and-pints');
    expect(getMeasureDefault()).toBe('metric');
  });
});

describe('useMeasureSystem', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to metric when localStorage is empty', () => {
    const { result } = renderHook(() => useMeasureSystem());
    const [system] = result.current;
    expect(system).toBe('metric');
  });

  it('reads imperial from localStorage on mount', () => {
    localStorage.setItem('measurementSystem', 'imperial');
    const { result } = renderHook(() => useMeasureSystem());
    const [system] = result.current;
    expect(system).toBe('imperial');
  });

  it('switches to imperial when setSystem("imperial") is called', () => {
    const { result } = renderHook(() => useMeasureSystem());

    act(() => {
      const [, setSystem] = result.current;
      setSystem('imperial');
    });

    const [system] = result.current;
    expect(system).toBe('imperial');
  });

  it('persists the chosen system to localStorage', () => {
    const { result } = renderHook(() => useMeasureSystem());

    act(() => {
      result.current[1]('imperial');
    });

    expect(localStorage.getItem('measurementSystem')).toBe('imperial');
  });

  it('switches back to metric', () => {
    localStorage.setItem('measurementSystem', 'imperial');
    const { result } = renderHook(() => useMeasureSystem());

    act(() => {
      result.current[1]('metric');
    });

    expect(result.current[0]).toBe('metric');
    expect(localStorage.getItem('measurementSystem')).toBe('metric');
  });

  it('syncs across hook instances via the custom event', () => {
    const { result: r1 } = renderHook(() => useMeasureSystem());
    const { result: r2 } = renderHook(() => useMeasureSystem());

    act(() => {
      r1.current[1]('imperial');
    });

    expect(r2.current[0]).toBe('imperial');
  });

  it('returns a stable setSystem reference across renders', () => {
    const { result, rerender } = renderHook(() => useMeasureSystem());
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });
});

describe('MeasureSystem type coverage', () => {
  it('accepts both valid values without TypeScript error', () => {
    const metric: MeasureSystem = 'metric';
    const imperial: MeasureSystem = 'imperial';
    expect(['metric', 'imperial']).toContain(metric);
    expect(['metric', 'imperial']).toContain(imperial);
  });
});
