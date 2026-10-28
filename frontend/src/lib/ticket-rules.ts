export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;

export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

export const COMMENT_MAX_LENGTH = 1000;

export const MAX_ATTACHMENTS_PER_TICKET = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_EXTENSIONS: readonly string[] = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "pdf",
];

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");

export const MAX_COMPLETION_FILES = 5;
export const MAX_COMPLETION_FILE_BYTES = 10 * 1024 * 1024;

export const COMPLETION_EXTENSIONS: readonly string[] = [
  "pdf",
  "xlsx",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp",
];

export const COMPLETION_ACCEPT = COMPLETION_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");
