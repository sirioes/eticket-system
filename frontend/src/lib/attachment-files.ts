import {
  ATTACHMENT_EXTENSIONS,
  COMPLETION_EXTENSIONS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
  MAX_COMPLETION_FILE_BYTES,
  MAX_COMPLETION_FILES,
} from "@/lib/ticket-rules";

interface FileSelection {
  files: File[];
  errors: string[];
}

interface FileRules {
  extensions: readonly string[];
  maxBytes: number;
  maxFiles: number;
  typeMessage: string;
  sizeMessage: string;
  limitMessage: string;
}

const ATTACHMENT_RULES: FileRules = {
  extensions: ATTACHMENT_EXTENSIONS,
  maxBytes: MAX_ATTACHMENT_BYTES,
  maxFiles: MAX_ATTACHMENTS_PER_TICKET,
  typeMessage: "hanya PDF, JPG, PNG, atau WEBP",
  sizeMessage: "ukuran melebihi 5 MB",
  limitMessage: `Maksimum ${MAX_ATTACHMENTS_PER_TICKET} dokumen pengaduan per pengaduan`,
};

const COMPLETION_RULES: FileRules = {
  extensions: COMPLETION_EXTENSIONS,
  maxBytes: MAX_COMPLETION_FILE_BYTES,
  maxFiles: MAX_COMPLETION_FILES,
  typeMessage: "hanya PDF, Excel, Word, atau gambar",
  sizeMessage: "ukuran melebihi 10 MB",
  limitMessage: `Maksimum ${MAX_COMPLETION_FILES} dokumen penyelesaian per pengaduan`,
};

const sizeFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function rejectionReason(
  rules: FileRules,
  file: File,
  accepted: File[],
): string | null {
  if (!rules.extensions.includes(extensionOf(file.name)))
    return rules.typeMessage;
  if (file.size === 0) return "file kosong";
  if (file.size > rules.maxBytes) return rules.sizeMessage;
  if (
    accepted.some((item) => item.name === file.name && item.size === file.size)
  ) {
    return "sudah ditambahkan";
  }
  return null;
}

function select(
  rules: FileRules,
  current: File[],
  incoming: File[],
  limit: number,
): FileSelection {
  const files = [...current];
  const errors: string[] = [];
  let limitReached = false;

  for (const file of incoming) {
    const reason = rejectionReason(rules, file, files);
    if (reason) {
      errors.push(`${file.name}: ${reason}`);
    } else if (files.length >= limit) {
      limitReached = true;
    } else {
      files.push(file);
    }
  }

  if (limitReached) errors.push(rules.limitMessage);
  return { files, errors };
}

export function addFiles(
  current: File[],
  incoming: File[],
  limit: number = MAX_ATTACHMENTS_PER_TICKET,
): FileSelection {
  return select(ATTACHMENT_RULES, current, incoming, limit);
}

export function addCompletionFiles(
  current: File[],
  incoming: File[],
): FileSelection {
  return select(COMPLETION_RULES, current, incoming, MAX_COMPLETION_FILES);
}

export function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${sizeFormat.format(Math.max(1, Math.round(kb)))} KB`;
  return `${sizeFormat.format(kb / 1024)} MB`;
}
