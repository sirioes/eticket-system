"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, errorMessage, isUnauthorized } from "@/lib/api";
import { listTicketMessages } from "@/lib/tickets";
import type { TicketMessage } from "@/types/ticket.types";

export type MessagesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; messages: TicketMessage[]; stale?: true };

const COMMENTS_POLL_INTERVAL_MS = 10_000;

type StoredState = MessagesState & { ticketId: string };

const LOADING: MessagesState = { status: "loading" };

function isSameList(
  state: StoredState,
  ticketId: string,
  next: TicketMessage[],
): boolean {
  if (state.ticketId !== ticketId || state.status !== "ready" || state.stale)
    return false;
  const current = state.messages;
  return (
    current.length === next.length && current.at(-1)?.id === next.at(-1)?.id
  );
}

interface UseTicketMessagesOptions {
  ticketId: string;
  enabled: boolean;
  polling: boolean;
  onGone: () => void;
}

export function useTicketMessages({
  ticketId,
  enabled,
  polling,
  onGone,
}: UseTicketMessagesOptions) {
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [stored, setStored] = useState<StoredState>({ ticketId, ...LOADING });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    listTicketMessages(ticketId)
      .then((messages) => {
        if (active) {
          setStored((previous) =>
            isSameList(previous, ticketId, messages)
              ? previous
              : { ticketId, status: "ready", messages },
          );
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        if (caught instanceof ApiError && caught.status === 404) {
          onGone();
          return;
        }
        setStored((previous) => {
          if (previous.ticketId === ticketId && previous.status === "ready") {
            return previous.stale ? previous : { ...previous, stale: true };
          }
          return { ticketId, status: "error", message: errorMessage(caught) };
        });
      });
    return () => {
      active = false;
    };
  }, [enabled, ticketId, tick, router, onGone]);

  useEffect(() => {
    if (!polling) return;
    const refresh = () => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    };
    const timer = window.setInterval(refresh, COMMENTS_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [polling]);

  const state: MessagesState = stored.ticketId === ticketId ? stored : LOADING;
  return { state, refresh: () => setTick((value) => value + 1) };
}
