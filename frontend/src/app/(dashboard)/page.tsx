import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="animate-fade-up">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-ink/60 sm:text-base">
        Pantau pengaduan keluar dan masuk divisimu di sini.
      </p>
      <section className="mt-6 grid min-h-64 place-items-center rounded-3xl border-2 border-dashed border-teal/25 bg-mist/60 p-8 text-center">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-teal uppercase">
            Belum ada data
          </p>
          <p className="mt-2 max-w-sm text-sm text-ink/60">
            Ringkasan dan daftar pengaduan akan tampil di sini.
          </p>
        </div>
      </section>
    </div>
  );
}