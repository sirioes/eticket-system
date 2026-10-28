import { DIVISI_LABEL, formatDateWita } from "@/lib/labels";
import type { ProgressStep, ProgressStepState } from "@/lib/ticket-progress";
import type { TicketPerson } from "@/types/ticket.types";

const MARKER_CLASS: Record<ProgressStepState, string> = {
  done: "bg-teal text-mist",
  rejected: "bg-red text-mist",
  current: "bg-yellow text-ink",
  upcoming: "border-2 border-ink/30 bg-mist text-ink/70",
  skipped: "border-2 border-dashed border-ink/30 bg-mist text-ink/70",
};

const NOTE_CLASS: Record<ProgressStepState, string> = {
  done: "text-teal",
  rejected: "text-wine",
  current: "text-ink",
  upcoming: "text-ink/70",
  skipped: "text-ink/70",
};

function personLabel(person: TicketPerson): string {
  return person.divisi === null
    ? person.fullName
    : `${person.fullName} (${DIVISI_LABEL[person.divisi]})`;
}

function isReached(state: ProgressStepState): boolean {
  return state === "done" || state === "rejected" || state === "current";
}

function MarkerIcon({
  state,
  index,
}: {
  state: ProgressStepState;
  index: number;
}) {
  if (state === "done") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 12 5 5 9-10" />
      </svg>
    );
  }
  if (state === "rejected") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  }
  return <span className="font-mono text-xs font-semibold">{index + 1}</span>;
}

export function TicketTimeline({ steps }: { steps: ProgressStep[] }) {
  return (
    <ol className="flex flex-col md:flex-row">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        return (
          <li
            key={index}
            aria-current={step.state === "current" ? "step" : undefined}
            style={{ animationDelay: `${120 + index * 70}ms` }}
            className="relative flex animate-fade-up gap-4 pb-7 last:pb-0 md:flex-1 md:flex-col md:gap-3 md:pr-4 md:pb-0 md:last:pr-0"
          >
            {next && (
              <span
                aria-hidden="true"
                className={`absolute top-10 bottom-2 left-[15px] w-0.5 rounded-full md:top-[15px] md:right-2 md:bottom-auto md:left-10 md:h-0.5 md:w-auto ${isReached(next.state) ? "bg-teal" : "bg-ink/15"}`}
              />
            )}
            <span className="relative grid size-8 shrink-0 place-items-center">
              {step.state === "current" && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-full bg-yellow/70"
                />
              )}
              <span
                className={`relative grid size-8 animate-pop-in place-items-center rounded-full ${MARKER_CLASS[step.state]}`}
                style={{ animationDelay: `${160 + index * 70}ms` }}
              >
                <MarkerIcon state={step.state} index={index} />
              </span>
            </span>
            <div className="flex min-w-0 flex-col gap-1 pt-1 md:pt-0">
              <p className="font-semibold wrap-break-word">{step.title}</p>
              <p
                className={`font-mono text-xs font-semibold tracking-[0.1em] uppercase ${NOTE_CLASS[step.state]}`}
              >
                {step.note}
              </p>
              {step.entry && (
                <>
                  <p className="text-sm wrap-break-word">
                    {personLabel(step.entry.actor)}
                  </p>
                  <p className="font-mono text-xs text-ink/70">
                    <time dateTime={step.entry.createdAt}>
                      {formatDateWita(step.entry.createdAt)}
                    </time>
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
