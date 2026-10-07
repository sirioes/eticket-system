import {
  ATTACHMENT_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
} from "@/lib/ticket-rules";

interface FileSelection {
  files: File[];
  errors: string[];
}

const LIMIT_MESSAGE = `Maksimum ${MAX_ATTACHMENTS_PER_TICKET} lampiran per pengaduan`;

const sizeFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function rejectionReason(file: File, accepted: File[]): string | null {
  if (!ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name))) {
    return "hanya PDF, JPG, PNG, atau WEBP";
  }
  if (file.size === 0) return "file kosong";
  if (file.size > MAX_ATTACHMENT_BYTES) return "ukuran melebihi 5 MB";
  if (accepted.some((item) => item.name === file.name && item.size === file.size)) {
    return "sudah ditambahkan";
  }
  return null;
}

export function addFiles(current: File[], incoming: File[]): FileSelection {
  const files = [...current];
  const errors: string[] = [];
  let limitReached = false;

  for (const file of incoming) {
    const reason = rejectionReason(file, files);
    if (reason) {
      errors.push(`${file.name}: ${reason}`);
    } else if (files.length >= MAX_ATTACHMENTS_PER_TICKET) {
      limitReached = true;
    } else {
      files.push(file);
    }
  }

  if (limitReached) errors.push(LIMIT_MESSAGE);
  return { files, errors };
}

export function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${sizeFormat.format(Math.max(1, Math.round(kb)))} KB`;
  return `${sizeFormat.format(kb / 1024)} MB`;
}
