import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { useHousehold } from '@/hooks/useHousehold';

vi.mock('@/lib/query', () => ({
  queryClient: new QueryClient(),
}));

const originalFetch = global.fetch;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe('useHousehold', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns household data on successful 200', async () => {
    const household = { id: 'h-1', name: 'My House', role: 'OWNER' as const };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(household), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );

    const { result } = renderHook(() => useHousehold(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.household).toEqual(household);
  });

  it('returns null when API returns 404 (no household)', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ error: 'No household' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useHousehold(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.household).toBeNull();
  });

  it('does not fire the query when enabled=false', async () => {
    const { result } = renderHook(() => useHousehold(false), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.household).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('isLoading is true initially while fetching', () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useHousehold(), { wrapper: makeWrapper() });

    expect(result.current.isLoading).toBe(true);
  });
});
