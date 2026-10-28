"use client";

import { useId, useState, type FormEvent } from "react";
import { AttachmentDropzone } from "@/components/tickets/attachment-dropzone";
import { ModalDialog } from "@/components/ui/modal-dialog";
import { addCompletionFiles } from "@/lib/attachment-files";
import { COMPLETION_ACCEPT, MAX_COMPLETION_FILES } from "@/lib/ticket-rules";

interface CompleteDialogProps {
  ticketId: string;
  busy: boolean;
  error: string | null;
  onSubmit: (files: File[]) => void;
  onClose: () => void;
}

const HINT = "PDF, Excel, Word, atau gambar. Maks. 10 MB per file.";

export function CompleteDialog({ ticketId, busy, error, onSubmit, onClose }: CompleteDialogProps) {
  const titleId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  function handleAdd(incoming: File[]) {
    const selection = addCompletionFiles(files, incoming);
    setFiles(selection.files);
    setErrors(selection.errors);
  }

  function handleRemove(file: File) {
    setFiles((current) => current.filter((item) => item !== file));
    setErrors([]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    onSubmit(files);
  }

  return (
    <ModalDialog titleId={titleId} busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="p-6" noValidate>
        <h2 id={titleId} className="text-lg font-semibold">
          Selesaikan pengaduan ini?
        </h2>
        <p className="mt-1 font-mono text-sm font-semibold wrap-break-word">{ticketId}</p>
        <p className="mt-3 text-sm text-ink/70">
          Status pengaduan akan berubah menjadi Selesai. Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <p className="text-sm font-medium">Dokumen penyelesaian</p>
          <p className="text-sm text-ink/70">
            Opsional, maksimal {MAX_COMPLETION_FILES} file, misalnya LPJ, CAPEX, atau hasil pekerjaan.
          </p>
          <AttachmentDropzone
            files={files}
            errors={errors}
            disabled={busy}
            maxFiles={MAX_COMPLETION_FILES}
            accept={COMPLETION_ACCEPT}
            inputLabel="Pilih file dokumen penyelesaian"
            hint={HINT}
            removeLabel="Hapus"
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>

        <p className="mt-4 text-sm text-ink/70">
          Dokumen dapat dilihat dan diunduh oleh semua pengguna yang dapat membuka pengaduan ini. Setelah dikirim,
          dokumen tidak dapat diganti.
        </p>

        {error && (
          <p key={error} role="alert" className="mt-4 animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine wrap-break-word">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 rounded-xl border border-ink/15 px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink/5 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-teal px-5 text-sm font-semibold text-mist transition-[background-color,transform] duration-200 ease-spring hover:bg-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && (
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
            )}
            {busy ? "Menyimpan…" : "Selesaikan pengaduan"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
