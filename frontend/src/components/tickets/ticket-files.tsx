"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AttachmentDropzone } from "@/components/tickets/attachment-dropzone";
import {
  AttachmentPreviewDialog,
  type PreviewKind,
  type PreviewSource,
} from "@/components/tickets/attachment-preview-dialog";
import { TicketFileRow } from "@/components/tickets/ticket-file-row";
import { PRIMARY_BUTTON_CLASS } from "@/components/ui/button-class";
import { CARD_CLASS } from "@/components/ui/card-class";
import { errorMessage, isUnauthorized, type DownloadedFile } from "@/lib/api";
import { addFiles, formatFileSize } from "@/lib/attachment-files";
import { saveBlob } from "@/lib/download";
import { DIVISI_LABEL } from "@/lib/labels";
import { MAX_ATTACHMENTS_PER_TICKET, MAX_COMPLETION_FILES } from "@/lib/ticket-rules";
import { downloadAttachment, downloadCompletionFile, uploadAttachment } from "@/lib/tickets";
import type { TicketAttachment, TicketDetail } from "@/types/ticket.types";

interface Previewing {
  source: PreviewSource;
  file: TicketAttachment;
  kind: PreviewKind;
}

interface UploadReport {
  uploaded: number;
  failures: string[];
}

function completionEmptyMessage(ticket: TicketDetail): string {
  if (ticket.stage === "SELESAI" || ticket.stage === "DITOLAK") {
    return "Tidak ada dokumen penyelesaian.";
  }
  return `Dokumen penyelesaian dapat diunggah oleh staf divisi ${DIVISI_LABEL[ticket.toDivisi]} saat pengaduan diselesaikan.`;
}

interface TicketFilesProps {
  ticket: TicketDetail;
  refreshing: boolean;
  onChanged: () => void;
}

export function TicketFiles({ ticket, refreshing, onChanged }: TicketFilesProps) {
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

  async function handleDownload(file: { id: string; fileName: string }, load: () => Promise<DownloadedFile>) {
    if (downloading) return;
    setDownloading(file.id);
    setDownloadError(null);
    try {
      const { blob } = await load();
      saveBlob(blob, file.fileName);
    } catch (caught) {
      if (isUnauthorized(caught)) {
        expire();
        return;
      }
      setDownloadError(`${file.fileName}: ${errorMessage(caught)}`);
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
      aria-labelledby="files-title"
      className={`${CARD_CLASS} flex animate-fade-up flex-col gap-5 [animation-delay:240ms]`}
    >
      <h2 id="files-title" className="text-lg font-semibold">
        Berkas
      </h2>

      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">Dokumen Pengaduan</h3>
          <span className="font-mono text-xs text-ink/70">
            {ticket.attachments.length}/{MAX_ATTACHMENTS_PER_TICKET} file
          </span>
        </div>

        {ticket.attachments.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-teal/25 p-4 text-center text-sm text-ink/70">
            Pengaduan ini belum memiliki dokumen pengaduan.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ticket.attachments.map((attachment) => (
              <TicketFileRow
                key={attachment.id}
                fileName={attachment.fileName}
                mimeType={attachment.mimeType}
                meta={formatFileSize(attachment.size)}
                downloading={downloading === attachment.id}
                downloadDisabled={downloading !== null}
                onPreview={(kind) => setPreviewing({ source: "attachment", file: attachment, kind })}
                onDownload={() => void handleDownload(attachment, () => downloadAttachment(ticket.id, attachment.id))}
              />
            ))}
          </ul>
        )}

        {report && report.uploaded > 0 && (
          <p role="status" className="animate-pop-in rounded-xl bg-green/15 px-4 py-3 text-sm font-medium text-ink">
            {report.uploaded} dokumen pengaduan berhasil diunggah.
          </p>
        )}
        {report && report.failures.length > 0 && (
          <div role="alert" className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm text-wine">
            <p className="font-medium">Dokumen pengaduan berikut gagal diunggah:</p>
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
          <div className="flex flex-col gap-4 pt-2">
            <div>
              <h4 className="text-sm font-semibold">Tambah dokumen pengaduan</h4>
              <p className="mt-1 text-sm text-ink/70">
                Dokumen masih bisa ditambahkan sampai manajer Divisi {DIVISI_LABEL[ticket.fromDivisi]}{" "}
                menyetujui pengaduan. Sisa {remaining} file.
              </p>
            </div>
            <AttachmentDropzone
              files={files}
              errors={fileErrors}
              disabled={uploading || refreshing}
              maxFiles={remaining}
              inputLabel="Pilih file dokumen pengaduan"
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
                {uploading ? "Mengunggah…" : `Unggah ${files.length} dokumen`}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold">Dokumen Penyelesaian</h3>
          <span className="font-mono text-xs text-ink/70">
            {ticket.completionFiles.length}/{MAX_COMPLETION_FILES} file
          </span>
        </div>

        {ticket.completionFiles.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-teal/25 p-4 text-center text-sm text-ink/70">
            {completionEmptyMessage(ticket)}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ticket.completionFiles.map((file) => (
              <TicketFileRow
                key={file.id}
                fileName={file.fileName}
                mimeType={file.mimeType}
                meta={formatFileSize(file.size)}
                downloading={downloading === file.id}
                downloadDisabled={downloading !== null}
                onPreview={(kind) => setPreviewing({ source: "completion", file, kind })}
                onDownload={() => void handleDownload(file, () => downloadCompletionFile(ticket.id, file.id))}
              />
            ))}
          </ul>
        )}
      </div>

      {downloadError && (
        <p role="alert" className="animate-shake rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-wine wrap-break-word">
          {downloadError}
        </p>
      )}

      {previewing && (
        <AttachmentPreviewDialog
          key={`${previewing.source}:${previewing.file.id}`}
          ticketId={ticket.id}
          source={previewing.source}
          file={previewing.file}
          kind={previewing.kind}
          onClose={() => setPreviewing(null)}
        />
      )}
    </section>
  );
}
