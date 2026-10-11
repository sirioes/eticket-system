import type { ReactNode } from "react";

export function EmptyState({
  eyebrow,
  message,
  children,
}: {
  eyebrow: string;
  message: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-48 animate-fade-in place-items-center rounded-2xl border-2 border-dashed border-teal/25 p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">{eyebrow}</p>
        <p className="max-w-sm font-medium">{message}</p>
        {children}
      </div>
    </div>
  );
}
