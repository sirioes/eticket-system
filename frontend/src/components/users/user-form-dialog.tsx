"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { SelectField } from "@/components/ui/select-field";
import {
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@/components/ui/button-class";
import { INPUT_CLASS } from "@/components/ui/input-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { DIVISI_LABEL } from "@/lib/labels";
import {
  divisiAfterRoleChange,
  divisiRuleFor,
  FULL_NAME_MAX_LENGTH,
  managerWarning,
  MIN_PASSWORD_LENGTH,
  ROLE_LABEL,
  ROLES,
} from "@/lib/user-rules";
import { createUser, updateUser } from "@/lib/users";
import type { Divisi, Role } from "@/types/auth.types";
import type { ManagedUser, UpdateUserInput } from "@/types/user.types";

export type UserFormTarget =
  { kind: "create" } | { kind: "edit"; user: ManagedUser };

interface UserFormDialogProps {
  target: UserFormTarget;
  users: ManagedUser[];
  onClose: () => void;
  onSaved: (user: ManagedUser, created: boolean) => void;
}

function buildChanges(
  user: ManagedUser,
  next: { role: Role; divisi: Divisi | null; isActive: boolean },
): UpdateUserInput {
  const changes: UpdateUserInput = {};
  if (next.role !== user.role) {
    changes.role = next.role;
    changes.divisi = next.divisi;
  } else if (next.divisi !== user.divisi) {
    changes.divisi = next.divisi;
  }
  if (next.isActive !== user.isActive) changes.isActive = next.isActive;
  return changes;
}

export function UserFormDialog({
  target,
  users,
  onClose,
  onSaved,
}: UserFormDialogProps) {
  const router = useRouter();
  const ids = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const editing = target.kind === "edit" ? target.user : null;

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role | "">(editing?.role ?? "");
  const [divisi, setDivisi] = useState<Divisi | null>(editing?.divisi ?? null);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; tick: number } | null>(
    null,
  );

  const rule = role === "" ? null : divisiRuleFor(role);
  const title = editing ? "Ubah akun" : "Tambah akun";
  const noChanges =
    editing !== null &&
    role !== "" &&
    Object.keys(buildChanges(editing, { role, divisi, isActive })).length === 0;
  const warning =
    editing !== null && role !== ""
      ? managerWarning(editing, { role, divisi, isActive }, users)
      : null;

  function fail(text: string, field?: string) {
    setError((current) => ({ text, tick: (current?.tick ?? 0) + 1 }));
    if (field) {
      const element = formRef.current?.elements.namedItem(field);
      if (element instanceof HTMLElement) element.focus();
    }
  }

  function changeRole(next: Role | "") {
    setRole(next);
    setDivisi(next === "" ? null : divisiAfterRoleChange(next, divisi));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = fullName.trim();
    const password = passwordRef.current?.value ?? "";
    if (!editing && name === "")
      return fail("Nama lengkap wajib diisi.", `${ids}-name`);
    if (role === "") return fail("Pilih role akun.", `${ids}-role`);
    if (rule?.kind !== "none" && divisi === null)
      return fail("Pilih divisi akun.", `${ids}-divisi`);
    if (!editing && password.length < MIN_PASSWORD_LENGTH)
      return fail(
        `Password awal minimal ${MIN_PASSWORD_LENGTH} karakter.`,
        `${ids}-password`,
      );

    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const saved = await updateUser(
          editing.id,
          buildChanges(editing, { role, divisi, isActive }),
        );
        onSaved(saved, false);
      } else {
        const saved = await createUser({
          fullName: name,
          role,
          divisi,
          password,
        });
        onSaved(saved, true);
      }
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      fail(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <ModalDialog titleId={`${ids}-title`} busy={busy} onClose={onClose}>
      <form
        ref={formRef}
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 p-6 sm:p-8"
      >
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-teal uppercase">
            Kelola akun
          </p>
          <h2
            id={`${ids}-title`}
            className="mt-1 text-xl font-semibold tracking-tight"
          >
            {title}
          </h2>
        </div>

        {error && (
          <p
            key={error.tick}
            role="alert"
            className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine"
          >
            {error.text}
          </p>
        )}

        {editing ? (
          <div className="animate-fade-up rounded-xl bg-ink/5 px-4 py-3">
            <p className="font-mono text-xs tracking-[0.15em] text-ink/70 uppercase">
              Nama lengkap
            </p>
            <p className="mt-0.5 font-semibold wrap-break-word">
              {editing.fullName}
            </p>
          </div>
        ) : (
          <div className="flex animate-fade-up flex-col gap-2">
            <label htmlFor={`${ids}-name`} className="text-sm font-medium">
              Nama lengkap
            </label>
            <input
              id={`${ids}-name`}
              name={`${ids}-name`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={FULL_NAME_MAX_LENGTH}
              value={fullName}
              disabled={busy}
              aria-describedby={`${ids}-name-hint`}
              onChange={(event) => setFullName(event.target.value)}
              className={INPUT_CLASS}
            />
            <p id={`${ids}-name-hint`} className="text-xs text-ink/70">
              Akhiri dengan kode unik seperti akun lain, contoh: Rina Wulandari
              TX01. Nama lengkap inilah yang dipakai untuk masuk.
            </p>
          </div>
        )}

        <SelectField
          id={`${ids}-role`}
          label="Role"
          value={role}
          disabled={busy}
          onChange={(event) => changeRole(event.target.value as Role | "")}
          className="animate-fade-up [animation-delay:60ms]"
        >
          <option value="">Pilih role</option>
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABEL[option]}
            </option>
          ))}
        </SelectField>

        {rule?.kind === "choose" && (
          <SelectField
            id={`${ids}-divisi`}
            label="Divisi"
            value={divisi ?? ""}
            disabled={busy}
            onChange={(event) =>
              setDivisi((event.target.value || null) as Divisi | null)
            }
            className="animate-fade-up"
          >
            <option value="">Pilih divisi</option>
            {rule.options.map((option) => (
              <option key={option} value={option}>
                {DIVISI_LABEL[option]}
              </option>
            ))}
          </SelectField>
        )}

        {rule?.kind === "fixed" && (
          <div className="animate-fade-up rounded-xl bg-ink/5 px-4 py-3 text-sm">
            Divisi otomatis{" "}
            <span className="font-semibold">{DIVISI_LABEL[rule.divisi]}</span>{" "}
            untuk role ini.
          </div>
        )}

        {rule?.kind === "none" && (
          <div className="animate-fade-up rounded-xl bg-ink/5 px-4 py-3 text-sm">
            Superadmin tidak terikat pada divisi mana pun.
          </div>
        )}

        {editing && (
          <label className="flex animate-fade-up cursor-pointer items-start gap-3 rounded-xl border border-ink/15 px-4 py-3 transition-colors duration-200 [animation-delay:120ms] hover:bg-teal/5 has-focus-visible:outline-2 has-focus-visible:outline-teal">
            <input
              type="checkbox"
              role="switch"
              checked={isActive}
              disabled={busy}
              onChange={(event) => setIsActive(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-teal"
            />
            <span>
              <span className="block text-sm font-semibold">
                {isActive ? "Akun aktif" : "Akun nonaktif"}
              </span>
              <span className="mt-0.5 block text-xs text-ink/70">
                Akun nonaktif langsung keluar dari semua sesi dan tidak bisa
                masuk sampai diaktifkan lagi.
              </span>
            </span>
          </label>
        )}

        {warning && (
          <p
            role="status"
            className="animate-fade-in rounded-xl bg-yellow/40 px-4 py-3 text-sm text-ink"
          >
            {warning}
          </p>
        )}

        {!editing && (
          <PasswordInput
            ref={passwordRef}
            id={`${ids}-password`}
            label="Password awal"
            autoComplete="new-password"
            disabled={busy}
            invalid={false}
            className="animate-fade-up [animation-delay:120ms]"
          />
        )}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={SECONDARY_BUTTON_CLASS}
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy || noChanges}
            aria-busy={busy}
            className={PRIMARY_BUTTON_CLASS}
          >
            {busy && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
              />
            )}
            {busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat akun"}
          </button>
        </div>
        {noChanges && (
          <p className="-mt-2 text-right text-xs text-ink/70">
            Belum ada yang diubah.
          </p>
        )}
      </form>
    </ModalDialog>
  );
}
