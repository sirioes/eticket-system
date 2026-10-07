"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/layout/user-context";
import { AttachmentDropzone } from "@/components/tickets/attachment-dropzone";
import { DivisiDropdown } from "@/components/tickets/divisi-dropdown";
import { INPUT_CLASS, TEXTAREA_CLASS } from "@/components/ui/input-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { addFiles } from "@/lib/attachment-files";
import { DIVISI_LABEL } from "@/lib/labels";
import { DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH } from "@/lib/ticket-rules";
import { createTicket, uploadAttachment } from "@/lib/tickets";
import type { Divisi } from "@/types/auth.types";

interface FailedUpload {
  fileName: string;
  message: string;
}

interface SubmitResult {
  ticketId: string;
  failedUploads: FailedUpload[];
}

const ALL_DIVISI = Object.keys(DIVISI_LABEL) as Divisi[];

const LABEL_CLASS = "text-sm font-medium";

const PRIMARY_BUTTON_CLASS =
  "flex h-12 items-center justify-center gap-2 rounded-xl bg-teal px-6 font-semibold text-mist transition-[background-color,transform] duration-200 ease-smooth hover:bg-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80";

function characterCount(text: string): number {
  return [...text].length;
}

export function CreateTicketForm() {
  const user = useUser();

  if (user.divisi === null) {
    return (
      <p className="mt-6 rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-red">
        Akun superadmin tidak dapat membuat pengaduan.
      </p>
    );
  }

  return <TicketForm fromDivisi={user.divisi} />;
}

function TicketForm({ fromDivisi }: { fromDivisi: Divisi }) {
  const router = useRouter();
  const divisiRef = useRef<HTMLButtonElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [toDivisi, setToDivisi] = useState<Divisi | "">("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [busy, setBusy] = useState(false);

  const targets = ALL_DIVISI.filter((divisi) => divisi !== fromDivisi);
  const descriptionLength = characterCount(description.trim());

  function reset() {
    setToDivisi("");
    setDescription("");
    setFiles([]);
    setFileErrors([]);
    setError(null);
    setResult(null);
  }

  function handleAdd(incoming: File[]) {
    const selection = addFiles(files, incoming);
    setFiles(selection.files);
    setFileErrors(selection.errors);
  }

  function handleRemove(file: File) {
    setFiles((current) => current.filter((item) => item !== file));
    setFileErrors([]);
  }

  async function uploadAll(ticketId: string): Promise<FailedUpload[] | null> {
    const failed: FailedUpload[] = [];
    for (const file of files) {
      try {
        await uploadAttachment(ticketId, file);
      } catch (caught) {
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return null;
        }
        failed.push({ fileName: file.name, message: errorMessage(caught) });
      }
    }
    return failed;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const text = description.trim();
    if (toDivisi === "" || !targets.includes(toDivisi)) {
      setError("Pilih divisi tujuan.");
      divisiRef.current?.focus();
      return;
    }
    if (characterCount(text) < DESCRIPTION_MIN_LENGTH || characterCount(text) > DESCRIPTION_MAX_LENGTH) {
      setError(`Keterangan harus ${DESCRIPTION_MIN_LENGTH}–${DESCRIPTION_MAX_LENGTH} karakter.`);
      descriptionRef.current?.focus();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ticket = await createTicket({ toDivisi, description: text });
      const failedUploads = await uploadAll(ticket.id);
      if (failedUploads) setResult({ ticketId: ticket.id, failedUploads });
    } catch (caught) {
      if (isUnauthorized(caught)) {
        router.replace("/login?reason=expired");
        return;
      }
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mt-6 max-w-3xl animate-fade-up rounded-3xl bg-mist p-6 sm:p-8">
        <p role="status" className="rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-teal">
          Pengaduan <span className="font-mono">{result.ticketId}</span> berhasil dikirim.
        </p>
        {result.failedUploads.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl bg-red/10 px-4 py-3 text-sm text-red">
            <p className="font-medium">
              Pengaduan sudah tercatat, tetapi lampiran berikut gagal diunggah:
            </p>
            <ul className="mt-2 list-disc pl-5">
              {result.failedUploads.map((failure, index) => (
                <li key={index}>
                  {failure.fileName}: {failure.message}
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Lampiran yang gagal dapat ditambahkan lagi dari halaman detail pengaduan selama
              pengaduan masih menunggu manajer divisi pengirim.
            </p>
          </div>
        )}
        <button type="button" onClick={reset} className={`${PRIMARY_BUTTON_CLASS} mt-6`}>
          Buat pengaduan baru
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 max-w-3xl animate-fade-up [animation-delay:80ms]">
      <form
        method="post"
        noValidate
        onSubmit={handleSubmit}
        className="flex flex-col gap-5 rounded-3xl bg-mist p-6 shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--color-ink)_35%,transparent)] sm:p-8"
      >
        {error && (
          <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-red">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="fromDivisi" className={LABEL_CLASS}>
            Divisi Asal
          </label>
          <input
            id="fromDivisi"
            type="text"
            readOnly
            value={DIVISI_LABEL[fromDivisi]}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="toDivisi" className={LABEL_CLASS}>
            Divisi Tujuan
          </label>
          <DivisiDropdown
            id="toDivisi"
            value={toDivisi}
            options={targets}
            disabled={busy}
            triggerRef={divisiRef}
            onChange={setToDivisi}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className={LABEL_CLASS}>
            Keterangan
          </label>
          <textarea
            ref={descriptionRef}
            id="description"
            name="description"
            value={description}
            disabled={busy}
            maxLength={DESCRIPTION_MAX_LENGTH}
            placeholder="Tuliskan keterangan pengaduan Anda di sini…"
            onChange={(event) => setDescription(event.target.value)}
            className={TEXTAREA_CLASS}
          />
          <p className="text-right font-mono text-xs text-ink/60">
            {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className={LABEL_CLASS}>Lampiran</span>
          <AttachmentDropzone
            files={files}
            errors={fileErrors}
            disabled={busy}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="h-12 rounded-xl px-5 text-sm font-semibold text-ink/70 transition-colors duration-200 hover:bg-ink/5 disabled:opacity-60"
          >
            Reset
          </button>
          <button type="submit" disabled={busy} aria-busy={busy} className={PRIMARY_BUTTON_CLASS}>
            {busy && (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist"
              />
            )}
            {busy ? "Mengirim…" : "Kirim pengaduan"}
          </button>
        </div>
      </form>
    </div>
  );
}
