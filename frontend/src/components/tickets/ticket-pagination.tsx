import { pageSlots } from "@/lib/ticket-list-params";

interface TicketPaginationProps {
  page: number;
  totalPages: number;
  disabled: boolean;
  onChange: (page: number) => void;
}

const PAGE_CLASS =
  "grid size-10 place-items-center rounded-xl font-mono text-sm transition-[background-color,color,transform] duration-200 ease-spring active:scale-90 disabled:cursor-not-allowed disabled:opacity-40";

function Arrow({ direction }: { direction: "left" | "right" }) {
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
      <path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

export function TicketPagination({ page, totalPages, disabled, onChange }: TicketPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Halaman daftar pengaduan">
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <button
            type="button"
            aria-label="Halaman sebelumnya"
            disabled={disabled || page <= 1}
            onClick={() => onChange(page - 1)}
            className={`${PAGE_CLASS} text-teal hover:bg-teal/10`}
          >
            <Arrow direction="left" />
          </button>
        </li>
        {pageSlots(page, totalPages).map((slot, index) =>
          slot === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 font-mono text-ink/70">
              …
            </li>
          ) : (
            <li key={slot}>
              <button
                type="button"
                aria-label={`Halaman ${slot}`}
                aria-current={slot === page ? "page" : undefined}
                disabled={disabled}
                onClick={() => onChange(slot)}
                className={`${PAGE_CLASS} ${slot === page ? "bg-teal text-mist" : "text-ink hover:bg-teal/10"}`}
              >
                {slot}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            aria-label="Halaman berikutnya"
            disabled={disabled || page >= totalPages}
            onClick={() => onChange(page + 1)}
            className={`${PAGE_CLASS} text-teal hover:bg-teal/10`}
          >
            <Arrow direction="right" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
