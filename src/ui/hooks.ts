import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { DEFAULT_PREFS } from '../db/repo';
import { db, type Prefs } from '../db/schema';

export function usePrefs(): Prefs {
  const row = useLiveQuery(() => db.settings.get('prefs'), []);
  return { ...DEFAULT_PREFS, ...((row?.value as Partial<Prefs>) ?? {}) };
}

/** Keep the screen awake while a game is on (where the browser supports it). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        lock = null;
      }
      if (cancelled) lock?.release().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

/** A ticking clock for timers. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// Service worker "update ready" state, set from main.tsx.
let updateReady: (() => void) | null = null;
const listeners = new Set<() => void>();
export function setUpdateReady(fn: (() => void) | null) {
  updateReady = fn;
  listeners.forEach((l) => l());
}
export function useUpdateReady() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => updateReady,
  );
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
