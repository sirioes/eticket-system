"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { formatFileSize } from "@/lib/attachment-files";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
} from "@/lib/ticket-rules";

interface AttachmentDropzoneProps {
  files: File[];
  errors: string[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (file: File) => void;
}

export function AttachmentDropzone({
  files,
  errors,
  disabled,
  onAdd,
  onRemove,
}: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (picked.length > 0) onAdd(picked);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length > 0) onAdd(dropped);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`grid place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors duration-200 ${dragging ? "border-teal bg-teal/10" : "border-teal/25 bg-mist/60"}`}
      >
        <div>
          <p className="text-sm text-ink/70">Seret file ke sini, atau</p>
          <input
            ref={inputRef}
            aria-label="Pilih file lampiran"
            type="file"
            multiple
            accept={ATTACHMENT_ACCEPT}
            disabled={disabled}
            onChange={handlePick}
            className="sr-only"
            tabIndex={-1}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-2 rounded-xl border border-ink/15 bg-mist px-4 py-2 text-sm font-semibold transition-colors duration-200 hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-60"
          >
            Pilih File
          </button>
        </div>
      </div>

      <p className="text-xs text-ink/60">
        Format: PDF, JPG, PNG, WEBP. Maksimal {MAX_ATTACHMENT_BYTES / 1024 / 1024} MB per file,{" "}
        {MAX_ATTACHMENTS_PER_TICKET} file.
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-red">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {files.map((file) => (
            <li
              key={`${file.name}:${file.size}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-mist px-4 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 font-mono text-xs text-ink/60">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemove(file)}
                aria-label={`Buang ${file.name}`}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red transition-colors duration-200 hover:bg-red/10 disabled:opacity-60"
              >
                Buang
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
