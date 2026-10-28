"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { EmptyState } from "@/components/tickets/empty-state";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/ui/button-class";
import { INPUT_CLASS } from "@/components/ui/input-class";
import { SelectField } from "@/components/ui/select-field";
import { ResetPasswordDialog } from "@/components/users/reset-password-dialog";
import {
  UserFormDialog,
  type UserFormTarget,
} from "@/components/users/user-form-dialog";
import { UserTable, type RowHighlight } from "@/components/users/user-table";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { ROLE_LABEL, ROLES } from "@/lib/user-rules";
import { listUsers } from "@/lib/users";
import type { Role } from "@/types/auth.types";
import type { ManagedUser } from "@/types/user.types";

type LoadState =
  | { status: "idle"; key: null }
  | { status: "error"; key: string; message: string }
  | { status: "ready"; key: string; users: ManagedUser[] };

type ActiveFilter = "" | "active" | "inactive";

const SEARCH_MAX_LENGTH = 191;

function byName(a: ManagedUser, b: ManagedUser): number {
  return a.fullName.localeCompare(b.fullName, "id");
}

export function UsersPage() {
  const me = useUser();
  const router = useRouter();
  const ids = useId();
  const isSuperadmin = me.role === "SUPERADMIN";

  const [attempt, setAttempt] = useState(0);
  const requestKey = String(attempt);
  const [load, setLoad] = useState<LoadState>({ status: "idle", key: null });
  const settled = load.key === requestKey;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("");

  const [formTarget, setFormTarget] = useState<UserFormTarget | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [notice, setNotice] = useState<{ text: string; tick: number } | null>(
    null,
  );
  const [highlight, setHighlight] = useState<RowHighlight | null>(null);

  useEffect(() => {
    if (!isSuperadmin) return;
    let active = true;
    listUsers()
      .then((users) => {
        if (active) setLoad({ status: "ready", key: requestKey, users });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        setLoad({
          status: "error",
          key: requestKey,
          message: errorMessage(caught),
        });
      });
    return () => {
      active = false;
    };
  }, [isSuperadmin, router, requestKey]);

  const allUsers = useMemo(
    () => (load.status === "ready" ? load.users : []),
    [load],
  );

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allUsers.filter(
      (user) =>
        (needle === "" || user.fullName.toLowerCase().includes(needle)) &&
        (roleFilter === "" || user.role === roleFilter) &&
        (activeFilter === "" || user.isActive === (activeFilter === "active")),
    );
  }, [allUsers, search, roleFilter, activeFilter]);

  const filtered =
    search.trim() !== "" || roleFilter !== "" || activeFilter !== "";

  function announce(text: string) {
    setNotice((current) => ({ text, tick: (current?.tick ?? 0) + 1 }));
  }

  function handleSaved(saved: ManagedUser, created: boolean) {
    setLoad((current) => {
      if (current.status !== "ready") return current;
      const users = created
        ? [...current.users, saved]
        : current.users.map((user) => (user.id === saved.id ? saved : user));
      return { ...current, users: users.sort(byName) };
    });
    setHighlight((current) => ({
      id: saved.id,
      tick: (current?.tick ?? 0) + 1,
    }));
    setFormTarget(null);
    announce(
      created
        ? `Akun ${saved.fullName} berhasil dibuat.`
        : `Perubahan akun ${saved.fullName} berhasil disimpan.`,
    );
  }

  function handleResetDone(user: ManagedUser) {
    setResetTarget(null);
    announce(
      `Password ${user.fullName} berhasil direset. Sesinya sudah keluar.`,
    );
  }

  function clearFilters() {
    setSearch("");
    setRoleFilter("");
    setActiveFilter("");
  }

  if (!isSuperadmin) {
    return (
      <div className="animate-fade-up">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Kelola Akun
        </h1>
        <p className="mt-6 rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
          Halaman ini hanya untuk superadmin.
        </p>
      </div>
    );
  }

  const showSpinner =
    load.status === "idle" || (load.status === "error" && !settled);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Kelola Akun
          </h1>
          <p className="mt-1 text-sm text-ink/70 sm:text-base">
            Tambah akun, ubah role dan divisi, nonaktifkan akun, atau reset
            password.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget({ kind: "create" })}
          className={PRIMARY_BUTTON_CLASS}
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
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tambah akun
        </button>
      </header>

      {notice && (
        <p
          key={notice.tick}
          role="status"
          className="animate-pop-in rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-teal"
        >
          {notice.text}
        </p>
      )}

      <section
        aria-label="Daftar akun"
        className="flex animate-fade-up flex-col gap-6 rounded-3xl bg-mist p-4 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] [animation-delay:80ms] sm:p-6 lg:p-8"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
            <label htmlFor={`${ids}-search`} className="text-sm font-medium">
              Cari nama
            </label>
            <input
              id={`${ids}-search`}
              type="search"
              autoComplete="off"
              spellCheck={false}
              maxLength={SEARCH_MAX_LENGTH}
              placeholder="Contoh: Rina"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <SelectField
            id={`${ids}-role`}
            label="Role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | "")}
          >
            <option value="">Semua role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </SelectField>
          <SelectField
            id={`${ids}-status`}
            label="Status"
            value={activeFilter}
            onChange={(event) =>
              setActiveFilter(event.target.value as ActiveFilter)
            }
          >
            <option value="">Semua status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </SelectField>
        </div>

        {showSpinner && (
          <div className="grid min-h-48 place-items-center">
            <span
              role="status"
              aria-label="Memuat daftar akun"
              className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
            />
          </div>
        )}

        {load.status === "error" && settled && (
          <div
            role="alert"
            className="flex animate-fade-in flex-col items-start gap-3 rounded-xl bg-red/10 px-4 py-3 text-sm text-wine sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-medium">{load.message}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className={`${SECONDARY_BUTTON_CLASS} h-10 bg-mist text-ink`}
            >
              Coba lagi
            </button>
          </div>
        )}

        {load.status === "ready" && visibleUsers.length === 0 && filtered && (
          <EmptyState
            eyebrow="Tidak ada hasil"
            message="Tidak ada akun yang cocok dengan pencarian atau filter."
          >
            <button
              type="button"
              onClick={clearFilters}
              className={`${SECONDARY_BUTTON_CLASS} border border-ink/15`}
            >
              Hapus pencarian dan filter
            </button>
          </EmptyState>
        )}

        {load.status === "ready" && allUsers.length === 0 && !filtered && (
          <EmptyState
            eyebrow="Masih kosong"
            message="Belum ada akun yang terdaftar."
          >
            <button
              type="button"
              onClick={() => setFormTarget({ kind: "create" })}
              className={PRIMARY_BUTTON_CLASS}
            >
              Tambah akun
            </button>
          </EmptyState>
        )}

        {load.status === "ready" && visibleUsers.length > 0 && (
          <div className="flex flex-col gap-6">
            <UserTable
              users={visibleUsers}
              selfId={me.id}
              highlight={highlight}
              onEdit={(user) => setFormTarget({ kind: "edit", user })}
              onReset={setResetTarget}
            />
            <footer className="border-t border-ink/10 pt-4">
              <p className="text-sm text-ink/70" aria-live="polite">
                Menampilkan{" "}
                <span className="font-mono font-semibold text-ink">
                  {visibleUsers.length}
                </span>{" "}
                dari{" "}
                <span className="font-mono font-semibold text-ink">
                  {allUsers.length}
                </span>{" "}
                akun
              </p>
            </footer>
          </div>
        )}
      </section>

      {formTarget && (
        <UserFormDialog
          key={formTarget.kind === "edit" ? formTarget.user.id : "create"}
          target={formTarget}
          users={allUsers}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      )}

      {resetTarget && (
        <ResetPasswordDialog
          key={resetTarget.id}
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onDone={handleResetDone}
        />
      )}
    </div>
  );
}
