"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { OUTLINE_BUTTON_CLASS } from "@/components/ui/button-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { formatFileSize } from "@/lib/attachment-files";
import { saveBlob } from "@/lib/download";
import { downloadAttachment, downloadCompletionFile } from "@/lib/tickets";

export type PreviewKind = "image" | "pdf";

export type PreviewSource = "attachment" | "completion";

interface PreviewFile {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
}

const PREVIEW_KIND: Record<string, PreviewKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
};

export function previewKind(mimeType: string): PreviewKind | null {
  return Object.hasOwn(PREVIEW_KIND, mimeType) ? PREVIEW_KIND[mimeType] : null;
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; url: string; blob: Blob }
  | { status: "error"; message: string };

interface AttachmentPreviewDialogProps {
  ticketId: string;
  source: PreviewSource;
  file: PreviewFile;
  kind: PreviewKind;
  onClose: () => void;
}

export function AttachmentPreviewDialog({ ticketId, source, file, kind, onClose }: AttachmentPreviewDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    const load = source === "completion" ? downloadCompletionFile : downloadAttachment;
    load(ticketId, file.id)
      .then(({ blob }) => {
        if (!active) return;
        const typed = new Blob([blob], { type: file.mimeType });
        url = URL.createObjectURL(typed);
        setPreview({ status: "ready", url, blob: typed });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        if (isUnauthorized(caught)) {
          router.replace("/login?reason=expired");
          return;
        }
        setPreview({ status: "error", message: errorMessage(caught) });
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ticketId, source, file.id, file.mimeType, router]);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="preview-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-3xl bg-mist text-ink shadow-[0_30px_80px_-24px_color-mix(in_oklab,var(--color-ink)_60%,transparent)] backdrop:bg-ink/50 backdrop:backdrop-blur-sm open:animate-pop-in"
    >
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="preview-title" className="font-semibold wrap-break-word">
              {file.fileName}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-ink/70">{formatFileSize(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Tutup pratinjau"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-ink transition-[background-color,transform] duration-200 ease-spring hover:bg-ink/5 active:scale-95"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="grid h-[60dvh] place-items-center overflow-hidden rounded-2xl bg-ink/5">
          {preview.status === "loading" && (
            <span
              role="status"
              aria-label="Memuat pratinjau"
              className="size-8 animate-spin rounded-full border-3 border-teal/20 border-t-teal"
            />
          )}

          {preview.status === "error" && (
            <p role="alert" className="m-4 rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine">
              {preview.message}
            </p>
          )}

          {preview.status === "ready" && kind === "image" && (
            <div className="relative size-full animate-fade-in">
              <Image
                src={preview.url}
                alt={`Pratinjau ${file.fileName}`}
                fill
                unoptimized
                sizes="(min-width: 56rem) 52rem, 100vw"
                className="object-contain p-2"
              />
            </div>
          )}

          {preview.status === "ready" && kind === "pdf" && (
            <iframe
              src={preview.url}
              title={`Pratinjau ${file.fileName}`}
              className="size-full animate-fade-in"
            />
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink/70">
            {kind === "pdf" ? "PDF tidak tampil di perangkatmu? Unduh file untuk membukanya." : ""}
          </p>
          <button
            type="button"
            disabled={preview.status !== "ready"}
            onClick={() => preview.status === "ready" && saveBlob(preview.blob, file.fileName)}
            className={`${OUTLINE_BUTTON_CLASS} h-11 px-5 text-sm`}
          >
            Unduh
          </button>
        </div>
      </div>
    </dialog>
  );
}
