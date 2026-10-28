"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { LoginCardHeader } from "@/components/auth/login-card-header";
import { LoginForm } from "@/components/auth/login-form";
import { markIntroSeen } from "@/lib/login-intro";

const LoginIntro = dynamic(() =>
  import("@/components/auth/login-intro").then((module) => module.LoginIntro),
);

type Phase = "intro" | "leave" | "form";

const LEAVE_MS = 900;
const INTRO_FALLBACK_MS = 6000;
const SWIPE_THRESHOLD_PX = 24;
const ADVANCE_KEYS = new Set(["ArrowDown", "PageDown", " "]);

interface LoginExperienceProps {
  skipIntro: boolean;
  expired: boolean;
  fontClassName: string;
}

export function LoginExperience({
  skipIntro,
  expired,
  fontClassName,
}: LoginExperienceProps) {
  const [phase, setPhase] = useState<Phase>(skipIntro ? "form" : "intro");
  const [focusSignal, setFocusSignal] = useState(0);
  const [introMounted, setIntroMounted] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const introRef = useRef<HTMLDivElement>(null);

  const handleIntroMount = useCallback(() => setIntroMounted(true), []);

  const advance = useCallback(() => {
    markIntroSeen();
    setPhase((current) => (current === "intro" ? "leave" : current));
  }, []);

  useEffect(() => {
    if (phase !== "intro") return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced && !introMounted) return;

    let cancelled = false;
    const animations = reduced
      ? []
      : (introRef.current?.getAnimations({ subtree: true }) ?? []);

    Promise.all(animations.map((animation) => animation.finished))
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        if (reduced) {
          markIntroSeen();
          setPhase("form");
          return;
        }
        setIntroDone(true);
      });

    return () => {
      cancelled = true;
    };
  }, [phase, introMounted]);

  useEffect(() => {
    if (phase !== "intro" || introMounted) return;
    const timer = window.setTimeout(() => setPhase("form"), INTRO_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase, introMounted]);

  useEffect(() => {
    if (phase !== "intro" || !introDone) return;

    let touchStartY: number | null = null;

    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0) advance();
    };
    const onTouchStart = (event: TouchEvent) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (touchStartY === null || y === undefined) return;
      if (touchStartY - y > SWIPE_THRESHOLD_PX) advance();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!ADVANCE_KEYS.has(event.key)) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return;
      const interactive =
        event.target instanceof Element &&
        event.target.closest("button, a, input, textarea, select");
      if (event.key === " " && interactive) return;
      advance();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, introDone, advance]);

  useEffect(() => {
    if (phase !== "leave") return;
    const timer = window.setTimeout(() => {
      setPhase("form");
      setFocusSignal((value) => value + 1);
    }, LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  return (
    <main
      data-phase={phase}
      className="group relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-haze px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-48 -right-40 size-88 rounded-full bg-aqua/16 md:-top-52 md:-right-40 md:size-156" />
        <div className="absolute -bottom-36 -left-32 size-76 rounded-full bg-teal/10 md:-bottom-56 md:-left-36 md:size-128" />
      </div>

      <div className="relative w-full max-w-110 transition-[opacity,translate] duration-900 ease-smooth group-data-[phase=intro]:translate-y-24 group-data-[phase=intro]:opacity-0 group-data-[phase=intro]:motion-reduce:translate-y-0 group-data-[phase=intro]:motion-reduce:opacity-100">
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 rounded-[28px] bg-mist shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_28%,transparent)]"
        />
        <div
          inert={phase !== "form"}
          className="relative z-40 px-5.5 pt-7 pb-6 sm:px-9 sm:pt-9 sm:pb-7.5"
        >
          <LoginCardHeader />
          <LoginForm expired={expired} focusSignal={focusSignal} />
        </div>
      </div>

      {phase !== "form" && (
        <LoginIntro
          rootRef={introRef}
          fontClassName={fontClassName}
          ready={introDone}
          onAdvance={advance}
          onMount={handleIntroMount}
        />
      )}
    </main>
  );
}
