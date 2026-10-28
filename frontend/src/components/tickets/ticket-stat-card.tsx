import type { ReactNode } from "react";

interface TicketStatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  unit: string;
}

export function TicketStatCard({
  icon,
  label,
  value,
  unit,
}: TicketStatCardProps) {
  return (
    <div
      className={`flex min-w-0 flex-col justify-between gap-1.5 rounded-xl border border-ink/10 bg-haze p-3 sm:rounded-2xl sm:p-4`}
    >
      <div className="flex items-start gap-2 text-ink/70">
        <span aria-hidden="true" className="hidden size-4 shrink-0 sm:block">
          {icon}
        </span>
        <span className="text-[11px] leading-tight font-medium sm:text-xs">
          {label}
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-mono text-xl leading-none sm:text-2xl font-semibold">
          {value}
        </span>
        <span className="text-[11px] text-ink/70 sm:text-xs">{unit}</span>
      </p>
    </div>
  );
}
