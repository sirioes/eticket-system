"use client";

const TODAY_FORMAT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function Topbar({
  menuOpen,
  onMenu,
}: {
  menuOpen: boolean;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-haze/85 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 backdrop-blur sm:px-6 lg:px-10 lg:pt-6">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Buka menu"
        aria-expanded={menuOpen}
        aria-controls="sidebar"
        className="grid size-10 place-items-center rounded-xl bg-mist text-teal shadow-sm transition-colors duration-200 hover:bg-teal hover:text-mist lg:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
      </button>
      <p
        className="ml-auto animate-fade-in rounded-xl bg-mist px-3 py-2 text-xs font-medium text-ink/70 shadow-sm sm:text-sm"
        suppressHydrationWarning
      >
        Hari ini: {TODAY_FORMAT.format(new Date())}
      </p>
    </header>
  );
}