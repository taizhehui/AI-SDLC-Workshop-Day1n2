/**
 * Thin `fetch` wrapper for browser-side API calls.
 *
 * Turns a non-2xx response into a thrown `ApiError` carrying the server's user-facing
 * message, so callers can surface it directly instead of re-deriving one.
 */

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body !== undefined
        ? { 'Content-Type': 'application/json', ...init?.headers }
        : init?.headers,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // Non-JSON error body — keep the status-based fallback.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(url: string): Promise<T> => request<T>(url),

  post: <T>(url: string, body?: unknown): Promise<T> =>
    request<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),

  put: <T>(url: string, body?: unknown): Promise<T> =>
    request<T>(url, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),

  delete: <T>(url: string, body?: unknown): Promise<T> =>
    request<T>(url, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
