const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (res.status === 401) {
    sessionStorage.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login?message=sesi+berakhir,+silakan+masuk+lagi';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  upload: <T>(path: string, formData: FormData) =>
    fetch(`${BASE_URL}${path}`, { method: 'POST', credentials: 'include', body: formData })
      .then((res) => { if (!res.ok) throw new ApiError(res.status, 'Upload failed'); return res.json() as Promise<T>; }),
};

export function getBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}