import type { Metadata, Viewport } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { DIVISI_LABEL } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Masuk",
};

export const viewport: Viewport = {
  themeColor: "#d0dcdc",
};

const DIVISIONS = Object.values(DIVISI_LABEL);

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { reason } = await searchParams;

  return (
    <main className="relative isolate flex min-h-dvh flex-1 items-center justify-center overflow-hidden bg-haze px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -inset-6 animate-drift bg-[radial-gradient(color-mix(in_oklab,var(--color-teal)_18%,transparent)_1px,transparent_1px)] bg-size-[22px_22px]" />
        <div className="absolute -top-40 -left-40 size-[32rem] animate-float rounded-full bg-aqua/25 blur-3xl" />
        <div className="absolute -right-40 -bottom-48 size-[36rem] animate-float rounded-full bg-teal/20 blur-3xl [animation-delay:-8s]" />
      </div>

      <LoginForm expired={reason === "expired"}>
        <p className="font-mono text-xs font-medium tracking-[0.2em] text-mist/75 uppercase">
          E-Ticket Internal
        </p>
        <h1 className="mt-3 text-2xl leading-snug font-semibold tracking-tight text-balance sm:text-3xl">
          Pengajuan antar divisi, tercatat dari awal sampai selesai.
        </h1>
        <div className="mt-auto hidden pt-10 lg:block">
          <p className="font-mono text-xs tracking-[0.2em] text-mist/75 uppercase">
            {DIVISIONS.length} divisi terhubung
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {DIVISIONS.map((label, index) => (
              <li
                key={label}
                style={{ animationDelay: `${260 + index * 40}ms` }}
                className="animate-pop-in rounded-full bg-mist/12 px-2.5 py-1 text-xs font-medium text-mist"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </LoginForm>
    </main>
  );
}