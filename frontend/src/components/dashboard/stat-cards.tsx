"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { TicketStats } from "@/types/ticket.types";

const COUNT_UP_MS = 800;

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = reduced ? 0 : COUNT_UP_MS;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress =
        duration === 0 ? 1 : Math.min((now - startedAt) / duration, 1);
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

interface CardSpec {
  key: keyof TicketStats;
  label: string;
  caption: string;
  href: string | null;
  chip: string;
  icon: ReactNode;
}

const CARDS: CardSpec[] = [
  {
    key: "outgoing",
    label: "Pengaduan Keluar",
    caption: "Diajukan divisimu",
    href: "/daftar-pengaduan/keluar",
    chip: "bg-aqua text-ink",
    icon: (
      <Icon>
        <path d="M7 17 17 7M8 7h9v9" />
      </Icon>
    ),
  },
  {
    key: "incoming",
    label: "Pengaduan Masuk",
    caption: "Ditujukan ke divisimu",
    href: "/daftar-pengaduan/masuk",
    chip: "bg-yellow text-ink",
    icon: (
      <Icon>
        <path d="M17 7 7 17M16 17H7V8" />
      </Icon>
    ),
  },
  {
    key: "selesai",
    label: "Sudah Kami Tuntaskan",
    caption: "Masuk yang selesai",
    href: "/daftar-pengaduan/masuk?status=SELESAI",
    chip: "bg-green text-ink",
    icon: (
      <Icon>
        <path d="m5 12.5 4.5 4.5L19 7.5" />
      </Icon>
    ),
  },
  {
    key: "total",
    label: "Total",
    caption: "Keluar ditambah masuk",
    href: null,
    chip: "bg-teal text-mist",
    icon: (
      <Icon>
        <path d="M8 4h8l3 3v13H5V4zM8 12h8M8 16h5" />
      </Icon>
    ),
  },
];

const CARD_CLASS =
  "group flex flex-col justify-between gap-6 rounded-3xl bg-mist p-5 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] transition-transform duration-300 ease-spring";

const LINK_CARD_CLASS = `${CARD_CLASS} hover:-translate-y-1 active:scale-[0.98]`;

function CardBody({ spec, value }: { spec: CardSpec; value: number }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
          {spec.label}
        </p>
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl transition-transform duration-300 ease-spring group-hover:-rotate-6 group-hover:scale-110 ${spec.chip}`}
        >
          {spec.icon}
        </span>
      </div>
      <div>
        <p className="font-mono text-4xl font-semibold tracking-tight">
          <CountUp value={value} />
        </p>
        <p className="mt-1 text-sm text-ink/70">{spec.caption}</p>
      </div>
    </>
  );
}

export function StatCards({ stats }: { stats: TicketStats }) {
  return (
    <ul
      aria-label="Ringkasan pengaduan"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {CARDS.map((spec, index) => (
        <li
          key={spec.key}
          style={{ animationDelay: `${index * 70}ms` }}
          className="flex animate-fade-up"
        >
          {spec.href === null ? (
            <div className={`${CARD_CLASS} w-full`}>
              <CardBody spec={spec} value={stats[spec.key]} />
            </div>
          ) : (
            <Link href={spec.href} className={`${LINK_CARD_CLASS} w-full`}>
              <CardBody spec={spec} value={stats[spec.key]} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
