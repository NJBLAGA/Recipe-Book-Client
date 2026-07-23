import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiError, api } from '@/lib/api';

// Mock the query module to prevent circular import side-effects
vi.mock('@/lib/query', () => ({
  queryClient: { clear: vi.fn() },
}));

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('ApiError', () => {
  it('carries the HTTP status code', () => {
    const err = new ApiError(404, 'Not found');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not found');
  });

  it('is instanceof Error', () => {
    expect(new ApiError(500, 'Oops')).toBeInstanceOf(Error);
  });
});

describe('api.get', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('makes a GET request with credentials: include', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, { id: '1' }));

    await api.get('/api/users/me');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/users/me');
    expect(init.credentials).toBe('include');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns parsed JSON on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, { name: 'Alice' }));

    const result = await api.get<{ name: string }>('/api/users/me');
    expect(result.name).toBe('Alice');
  });

  it('throws ApiError with status on non-ok response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeResponse(400, { error: 'Bad request' })
    );

    await expect(api.get('/api/test')).rejects.toMatchObject({
      status: 400,
      message: 'Bad request',
    });
  });

  it('uses body.message over body.error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeResponse(422, { message: 'Custom message', error: 'Generic error' })
    );

    await expect(api.get('/api/test')).rejects.toMatchObject({
      message: 'Custom message',
    });
  });

  it('falls back to statusText if no body.message or body.error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('{}', { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'application/json' } })
    );

    await expect(api.get('/api/test')).rejects.toMatchObject({
      status: 503,
      message: 'Service Unavailable',
    });
  });
});

describe('api.post', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends POST with JSON body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(201, { id: 'new-id' }));

    await api.post('/api/households', { name: 'My House' });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ name: 'My House' });
  });

  it('handles POST with no body (body is undefined)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, {}));

    await api.post('/api/cook-sessions/abc/complete');

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    // JSON.stringify(undefined) === undefined — body is omitted
    expect(init.body).toBeUndefined();
  });
});

describe('api.patch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends PATCH with JSON body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, { id: '1', name: 'Updated' }));

    await api.patch('/api/users/me', { firstName: 'Alice' });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ firstName: 'Alice' });
  });
});

describe('api.delete', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends DELETE with no body by default', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, { message: 'Deleted' }));

    await api.delete('/api/recipe-book/recipes/123');

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
  });

  it('sends DELETE with body when provided', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, { message: 'Done' }));

    await api.delete('/api/pantry/categories/123', { targetCategoryId: 'other-uuid' });

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ targetCategoryId: 'other-uuid' });
  });
});

describe('api.put', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends PUT with JSON body', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeResponse(200, {}));

    await api.put('/api/recipe-book/pins', [{ position: 1, recipeId: 'r-uuid' }]);

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual([{ position: 1, recipeId: 'r-uuid' }]);
  });
});
