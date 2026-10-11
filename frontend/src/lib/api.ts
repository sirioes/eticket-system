const BASE_URL = "/api";
const FALLBACK_MESSAGE = "Terjadi kesalahan, silakan coba lagi";
const NETWORK_MESSAGE = "Tidak dapat terhubung ke server";
const THROTTLED_MESSAGE = "Terlalu banyak percobaan. Tunggu 1 menit, lalu coba lagi.";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function extractMessage(body: unknown): string {
  if (typeof body !== "object" || body === null || !("message" in body)) {
    return FALLBACK_MESSAGE;
  }
  const { message } = body;
  if (typeof message === "string" && message.trim() !== "") return message;
  if (Array.isArray(message)) {
    const first = message.find((item) => typeof item === "string" && item.trim() !== "");
    if (typeof first === "string") return first;
  }
  return FALLBACK_MESSAGE;
}

async function send(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE);
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, extractMessage(body));
  }
  return res;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface DownloadedFile {
  blob: Blob;
  fileName: string | null;
}

const SAFE_FILE_NAME = /^[A-Za-z0-9._-]{1,150}$/;

function attachmentFileName(disposition: string | null): string | null {
  const match = disposition?.match(/filename="([^"]+)"/);
  const name = match?.[1];
  return name !== undefined && SAFE_FILE_NAME.test(name) ? name : null;
}

async function download(path: string): Promise<DownloadedFile> {
  const res = await send(path, { method: "GET" });
  return {
    blob: await res.blob(),
    fileName: attachmentFileName(res.headers.get("Content-Disposition")),
  };
}

function jsonInit(method: string, data?: unknown): RequestInit {
  if (data === undefined) return { method };
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) => request<T>(path, jsonInit("POST", data)),
  patch: <T>(path: string, data?: unknown) => request<T>(path, jsonInit("PATCH", data)),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
  download,
};

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return FALLBACK_MESSAGE;
  if (error.status === 429) return THROTTLED_MESSAGE;
  return error.message;
}