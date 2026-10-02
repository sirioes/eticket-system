const BASE_URL = "/api";
const FALLBACK_MESSAGE = "Terjadi kesalahan, silakan coba lagi";
const NETWORK_MESSAGE = "Tidak dapat terhubung ke server";

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
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
};

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}