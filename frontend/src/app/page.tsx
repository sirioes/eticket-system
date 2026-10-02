export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
      <section className="w-full max-w-md animate-fade-up rounded-2xl border border-ink/10 bg-mist p-6 shadow-sm sm:p-8">
        <p className="text-sm font-medium text-teal">E-Ticket Internal</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Sedang disiapkan</h1>
        <p className="mt-3 text-ink/70">
          Halaman login dan dashboard akan tersedia setelah tahap berikutnya selesai.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-lg bg-teal px-4 py-3 font-medium text-mist transition-transform duration-200 ease-spring hover:-translate-y-0.5 active:scale-95 sm:w-auto"
        >
          Tombol contoh
        </button>
      </section>
    </main>
  );
}