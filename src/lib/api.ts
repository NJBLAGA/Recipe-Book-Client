export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Session expired — clear any cached state and redirect to sign-in.
      // Import queryClient lazily to avoid a circular import at module load.
      const { queryClient } = await import('./query');
      queryClient.clear();
      window.location.href = '/sign-in';
      throw new ApiError(401, 'Session expired');
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

async function requestForm<T>(path: string, body: FormData, method = 'POST'): Promise<T> {
  const res = await fetch(path, { method, credentials: 'include', body });

  if (!res.ok) {
    if (res.status === 401) {
      const { queryClient } = await import('./query');
      queryClient.clear();
      window.location.href = '/sign-in';
      throw new ApiError(401, 'Session expired');
    }
    const b = await res.json().catch(() => ({}));
    throw new ApiError(res.status, b.message ?? b.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
  postForm: <T>(path: string, body: FormData) => requestForm<T>(path, body),
};
