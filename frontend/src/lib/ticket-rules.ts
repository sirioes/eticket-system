export const DESCRIPTION_MIN_LENGTH = 10;
export const DESCRIPTION_MAX_LENGTH = 2000;

export const MAX_ATTACHMENTS_PER_TICKET = 5;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_EXTENSIONS: readonly string[] = ["png", "jpg", "jpeg", "webp", "pdf"];

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");
