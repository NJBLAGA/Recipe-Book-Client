import { useState, useEffect, useCallback } from 'react';

export type MeasureSystem = 'metric' | 'imperial';

const STORAGE_KEY = 'measurementSystem';
const EVENT_NAME = 'measurechange';

export function getMeasureDefault(): MeasureSystem {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'imperial') return 'imperial';
  } catch {}
  return 'metric';
}

export function useMeasureSystem(): [MeasureSystem, (s: MeasureSystem) => void] {
  const [system, setSystemState] = useState<MeasureSystem>(() => getMeasureDefault());

  useEffect(() => {
    const handler = (e: Event) => {
      setSystemState((e as CustomEvent<MeasureSystem>).detail);
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  const setSystem = useCallback((s: MeasureSystem) => {
    localStorage.setItem(STORAGE_KEY, s);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: s }));
  }, []);

  return [system, setSystem];
}
