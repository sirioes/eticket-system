"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AttachmentDropzone } from "@/components/tickets/attachment-dropzone";
import {
  AttachmentPreviewDialog,
  previewKind,
  type PreviewKind,
} from "@/components/tickets/attachment-preview-dialog";
import { OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_CLASS } from "@/components/ui/card-class";
import { errorMessage, isUnauthorized } from "@/lib/api";
import { addFiles, formatFileSize } from "@/lib/attachment-files";
import { saveBlob } from "@/lib/download";
import { DIVISI_LABEL } from "@/lib/labels";
import { MAX_ATTACHMENTS_PER_TICKET } from "@/lib/ticket-rules";
import { downloadAttachment, uploadAttachment } from "@/lib/tickets";
import type { TicketAttachment, TicketDetail } from "@/types/ticket.types";

interface Previewing {
  attachment: TicketAttachment;
  kind: PreviewKind;
}

interface UploadReport {
  uploaded: number;
  failures: string[];
}

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
};

function typeLabel(mimeType: string): string {
  return Object.hasOwn(TYPE_LABEL, mimeType) ? TYPE_LABEL[mimeType] : "File";
}

const FILE_ICON_PATH = "M6 3h9l4 4v14H6zM15 3v4h4";
const DOWNLOAD_ICON_PATH = "M12 4v11M7 10l5 5 5-5M5 20h14";
const EYE_ICON_PATH = "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z";

function IconPath({ path, className }: { path: string; className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

function AttachmentSummary({
  attachment,
  onPreview,
}: {
  attachment: TicketAttachment;
  onPreview: (kind: PreviewKind) => void;
}) {
  const meta = `${typeLabel(attachment.mimeType)} · ${formatFileSize(attachment.size)}`;
  const kind = previewKind(attachment.mimeType);
  const text = (
    <span className="min-w-0">
      <span className="block text-sm font-medium wrap-break-word transition-colors duration-200 group-hover:text-teal">
        {attachment.fileName}
      </span>
      <span className="mt-0.5 block font-mono text-xs text-ink/70">{meta}</span>
    </span>
  );

  if (kind === null) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-mist">
          <IconPath path={FILE_ICON_PATH} className="size-5" />
        </span>
        {text}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPreview(kind)}
      aria-haspopup="dialog"
      aria-label={`Lihat pratinjau ${attachment.fileName}`}
      title="Lihat pratinjau"
      className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
    >
      <span aria-hidden="true" className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-teal text-mist transition-[background-color,transform] duration-200 ease-spring group-hover:scale-110 group-hover:bg-ink group-focus-visible:bg-ink">
        <IconPath path={FILE_ICON_PATH} className="size-5 transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0" />
        <IconPath path={EYE_ICON_PATH} className="absolute size-5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100" />
      </span>
      {text}
    </button>
  );
}

interface TicketAttachmentsProps {
  ticket: TicketDetail;
  refreshing: boolean;
  onChanged: () => void;
}

export function TicketAttachments({ ticket, refreshing, onChanged }: TicketAttachmentsProps) {
  const router = useRouter();
  const [previewing, setPreviewing] = useState<Previewing | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState<UploadReport | null>(null);

  const remaining = Math.max(0, MAX_ATTACHMENTS_PER_TICKET - ticket.attachments.length);
  const canUpload = ticket.canUploadAttachment && remaining > 0;

  function expire() {
    router.replace("/login?reason=expired");
  }

  async function handleDownload(attachment: TicketAttachment) {
    if (downloading) return;
    setDownloading(attachment.id);
    setDownloadError(null);
    try {
      const { blob } = await downloadAttachment(ticket.id, attachment.id);
      saveBlob(blob, attachment.fileName);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        expire();
        return;
      }
      setDownloadError(`${attachment.fileName}: ${errorMessage(caught)}`);
    } finally {
      setDownloading(null);
    }
  }

  function handleAdd(incoming: File[]) {
    const selection = addFiles(files, incoming, remaining);
    setFiles(selection.files);
    setFileErrors(selection.errors);
    setReport(null);
  }

  function handleRemove(file: File) {
    setFiles((current) => current.filter((item) => item !== file));
    setFileErrors([]);
  }

  async function handleUpload() {
    if (uploading || files.length === 0) return;
    setUploading(true);
    setReport(null);
    const failures: string[] = [];
    let uploaded = 0;
    try {
      for (const file of files) {
        try {
          await uploadAttachment(ticket.id, file);
          uploaded += 1;
        } catch (caught) {
          if (isUnauthorized(caught)) {
            expire();
            return;
          }
          failures.push(`${file.name}: ${errorMessage(caught)}`);
        }
      }
      setFiles([]);
      setFileErrors([]);
      setReport({ uploaded, failures });
      onChanged();
    } finally {
      setUploading(false);
    }
  }

  return (
    <section
      aria-labelledby="attachments-title"
      className={`${CARD_CLASS} flex animate-fade-up flex-col gap-5 [animation-delay:240ms]`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="attachments-title" className="text-lg font-semibold">
          Lampiran
        </h2>
        <span className="font-mono text-xs text-ink/70">
          {ticket.attachments.length}/{MAX_ATTACHMENTS_PER_TICKET} file
        </span>
      </div>

      {ticket.attachments.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-teal/25 p-5 text-center text-sm text-ink/70">
          Pengaduan ini belum memiliki lampiran.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ticket.attachments.map((attachment, index) => (
            <li
              key={attachment.id}
              style={{ animationDelay: `${280 + index * 50}ms` }}
              className="flex animate-fade-up items-center gap-3 rounded-2xl border border-ink/10 p-3 sm:p-4"
            >
              <AttachmentSummary attachment={attachment} onPreview={(kind) => setPreviewing({ attachment, kind })} />
              <button
                type="button"
                onClick={() => handleDownload(attachment)}
                disabled={downloading !== null}
                aria-busy={downloading === attachment.id}
                aria-label={`Unduh ${attachment.fileName}`}
                title="Unduh"
                className={`${OUTLINE_BUTTON_CLASS} size-10 shrink-0 text-sm sm:w-auto sm:px-4`}
              >
                {downloading === attachment.id ? (
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-teal/30 border-t-teal" />
                ) : (
                  <IconPath path={DOWNLOAD_ICON_PATH} className="size-4 sm:hidden" />
                )}
                <span className="hidden sm:inline">Unduh</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {downloadError && (
        <p role="alert" className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine wrap-break-word">
          {downloadError}
        </p>
      )}

      {report && report.uploaded > 0 && (
        <p role="status" className="animate-pop-in rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-ink">
          {report.uploaded} lampiran berhasil diunggah.
        </p>
      )}
      {report && report.failures.length > 0 && (
        <div role="alert" className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm text-wine">
          <p className="font-medium">Lampiran berikut gagal diunggah:</p>
          <ul className="mt-2 list-disc pl-5">
            {report.failures.map((failure, index) => (
              <li key={index} className="wrap-break-word">
                {failure}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canUpload && (
        <div className="flex flex-col gap-4 border-t border-ink/10 pt-5">
          <div>
            <h3 className="font-semibold">Tambah lampiran</h3>
            <p className="mt-1 text-sm text-ink/70">
              Lampiran masih bisa ditambahkan sampai manajer Divisi {DIVISI_LABEL[ticket.fromDivisi]}{" "}
              menyetujui pengaduan. Sisa {remaining} file.
            </p>
          </div>
          <AttachmentDropzone
            files={files}
            errors={fileErrors}
            disabled={uploading || refreshing}
            maxFiles={remaining}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
          {files.length > 0 && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || refreshing}
              aria-busy={uploading}
              className={`${PRIMARY_BUTTON_CLASS} self-end`}
            >
              {uploading && (
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-mist/40 border-t-mist" />
              )}
              {uploading ? "Mengunggah…" : `Unggah ${files.length} lampiran`}
            </button>
          )}
        </div>
      )}
      {previewing && (
        <AttachmentPreviewDialog
          key={previewing.attachment.id}
          ticketId={ticket.id}
          attachment={previewing.attachment}
          kind={previewing.kind}
          onClose={() => setPreviewing(null)}
        />
      )}
    </section>
  );
}
