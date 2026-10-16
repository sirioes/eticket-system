import { TicketIcon } from "@/components/auth/ticket-icon";

export function LoginCardHeader() {
  return (
    <header>
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-teal text-mist">
          <TicketIcon className="size-5" />
        </span>
        <span className="text-lg font-semibold tracking-tight">E-Ticket</span>
      </div>
      <h1 className="mt-7 text-2xl font-semibold tracking-[-0.025em] sm:text-[26px]">
        Masuk ke E-Ticket
      </h1>
      <p className="mt-1.5 text-[14.5px] text-ink/65">
        Gunakan username dan password Anda.
      </p>
    </header>
  );
}
