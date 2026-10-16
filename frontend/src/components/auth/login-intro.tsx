import { useEffect, type Ref } from "react";

const STAGES = [
  { label: "Diajukan", at: 100 },
  { label: "Ditinjau", at: 1000 },
  { label: "Disetujui", at: 1600 },
  { label: "Diproses", at: 2200 },
  { label: "Selesai", at: 2800 },
] as const;

function CheckIcon({ delay }: { delay: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-4 animate-check-in"
      style={{ animationDelay: `${delay}ms` }}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

interface LoginIntroProps {
  rootRef: Ref<HTMLDivElement>;
  fontClassName: string;
  ready: boolean;
  onAdvance: () => void;
  onMount: () => void;
}

export function LoginIntro({
  rootRef,
  fontClassName,
  ready,
  onAdvance,
  onMount,
}: LoginIntroProps) {
  useEffect(() => onMount(), [onMount]);

  return (
    <div
      className={`${fontClassName} pointer-events-none fixed inset-0 z-20 overflow-hidden text-ink motion-reduce:hidden`}
    >
      <div
        ref={rootRef}
        aria-hidden="true"
        className="absolute inset-0 transition-[opacity,filter,translate] duration-700 ease-smooth group-data-[phase=leave]:-translate-y-20 group-data-[phase=leave]:opacity-0"
      >
        <div className="flex h-full flex-col items-center justify-center px-6 pt-8 pb-28 text-center">
          <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.035em] md:text-[58px]">
            <span className="block overflow-hidden pb-1.5">
              <span
                className="block animate-rise"
                style={{ animationDelay: "100ms" }}
              >
                Satu alur kerja
              </span>
            </span>
            <span className="block overflow-hidden pb-1.5 text-teal">
              <span
                className="block animate-rise"
                style={{ animationDelay: "300ms" }}
              >
                untuk seluruh divisi.
              </span>
            </span>
          </h1>

          <p
            className="mt-3.5 max-w-80 animate-fade-up text-[15px] leading-normal font-medium text-ink/75 md:max-w-none md:text-[17px] [@media(max-height:720px)]:hidden"
            style={{ animationDelay: "500ms" }}
          >
            Ajukan, setujui, kerjakan, dan selesaikan di satu tempat.
          </p>

          <div className="relative mt-10 w-[300px] md:mt-[88px] md:w-[min(880px,calc(100vw-96px))]">
            <ol className="relative flex flex-col gap-5 md:flex-row md:justify-between">
              <span className="absolute top-[18px] bottom-[18px] left-4 w-1 rounded-sm bg-teal/15 md:hidden" />
              <span className="absolute top-[18px] bottom-[18px] left-4 w-1 origin-top animate-line-fill-y rounded-sm bg-teal md:hidden" />
              <span className="absolute top-4 right-[18px] left-[18px] hidden h-1 rounded-sm bg-teal/15 md:block" />
              <span className="absolute top-4 right-[18px] left-[18px] hidden h-1 origin-left animate-line-fill-x rounded-sm bg-teal md:block" />

              {STAGES.map((stage) => (
                <li
                  key={stage.label}
                  className="relative flex items-center gap-4 md:block"
                >
                  <span
                    style={{ animationDelay: `${stage.at}ms` }}
                    className="relative z-10 grid size-9 shrink-0 animate-node-light place-items-center rounded-full border-2 border-teal/30 bg-mist text-mist"
                  >
                    <CheckIcon delay={stage.at} />
                  </span>
                  <span
                    style={{ animationDelay: `${stage.at}ms` }}
                    className="animate-label-light text-[15px] font-semibold text-ink/45 md:absolute md:top-12 md:left-1/2 md:w-36 md:-translate-x-1/2 md:text-center md:text-[13.5px]"
                  >
                    {stage.label}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {ready && (
        <button
          type="button"
          onClick={onAdvance}
          aria-label="Lanjut ke halaman masuk"
          className="pointer-events-auto absolute bottom-10 left-1/2 grid size-11 -translate-x-1/2 animate-fade-up place-items-center rounded-full border border-teal/30 text-teal transition-[opacity,background-color] duration-300 hover:bg-teal/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal group-data-[phase=leave]:opacity-0 md:bottom-14"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-5 animate-bounce"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
