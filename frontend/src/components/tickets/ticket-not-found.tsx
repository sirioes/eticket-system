import Link from "next/link";
import { PRIMARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_CLASS } from "@/components/ui/card-class";

export function TicketNotFound() {
  return (
    <div className="grid min-h-[60dvh] animate-fade-up place-items-center">
      <div
        className={`${CARD_CLASS} flex max-w-md flex-col items-center gap-3 text-center`}
      >
        <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">
          Tidak ditemukan
        </p>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Pengaduan tidak ditemukan
        </h1>
        <p className="text-sm text-ink/70">
          Pengaduan ini tidak ada atau tidak dapat dibuka dengan akunmu. Periksa
          kembali ID pengaduan dari daftar.
        </p>
        <Link href="/" className={`${PRIMARY_BUTTON_CLASS} mt-3`}>
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  );
}
