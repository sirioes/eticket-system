"use client";

import { useEffect, useState } from "react";
import { getActionCounts } from "@/lib/tickets";
import type { ActionCounts } from "@/types/ticket.types";

const ACTION_COUNTS_INTERVAL_MS = 60_000;

const EMPTY: ActionCounts = { outgoing: 0, incoming: 0 };

const REFRESH_EVENT = "action-counts:refresh";

export function refreshActionCounts(): void {
  window.dispatchEvent(new Event(REFRESH_EVENT));
}

export function useActionCounts(enabled: boolean, refreshKey: string): ActionCounts {
  const [counts, setCounts] = useState<ActionCounts>(EMPTY);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const refresh = () => {
      if (document.hidden) return;
      getActionCounts()
        .then((next) => {
          if (active) setCounts(next);
        })
        .catch(() => undefined);
    };

    refresh();
    const timer = window.setInterval(refresh, ACTION_COUNTS_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(REFRESH_EVENT, refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(REFRESH_EVENT, refresh);
    };
  }, [enabled, refreshKey]);

  return enabled ? counts : EMPTY;
}
