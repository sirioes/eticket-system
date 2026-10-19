import { useEffect, useRef } from "react";

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

const STORAGE_KEY = "eticket:last-activity";
const CHECK_INTERVAL_MS = 5_000;
const WRITE_THROTTLE_MS = 1_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "scroll",
  "touchstart",
] as const;

function readLastActivity(fallback: number): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : fallback;
  } catch {
    return fallback;
  }
}

function writeLastActivity(at: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    return;
  }
}

export function useIdleLogout(onIdle: () => void, timeoutMs = IDLE_TIMEOUT_MS) {
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    let lastLocal = Date.now();
    let lastWrite = 0;
    let fired = false;
    writeLastActivity(lastLocal);

    function markActive() {
      const now = Date.now();
      lastLocal = now;
      if (now - lastWrite >= WRITE_THROTTLE_MS) {
        lastWrite = now;
        writeLastActivity(now);
      }
    }

    function check() {
      if (fired) return;
      const last = Math.max(lastLocal, readLastActivity(lastLocal));
      if (Date.now() - last >= timeoutMs) {
        fired = true;
        onIdleRef.current();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") check();
    }

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [timeoutMs]);
}
