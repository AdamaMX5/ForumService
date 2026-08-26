import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCursorPaginated } from './useCursorPaginated';
import type { Paginated } from '../api/types';

function page<T>(data: T[], nextCursor: string | null): Paginated<T> {
  return { data, nextCursor };
}

describe('useCursorPaginated', () => {
  it('loads the first page on mount', async () => {
    const fetchPage = vi.fn(async (cursor: string | null) => {
      expect(cursor).toBeNull();
      return page([1, 2], 'cursor-2');
    });

    const { result } = renderHook(() => useCursorPaginated({ fetchPage }));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('loadMore appends the next page to the existing items, passing the current cursor', async () => {
    const fetchPage = vi.fn(async (cursor: string | null) => {
      if (cursor === null) return page([1, 2], 'cursor-2');
      if (cursor === 'cursor-2') return page([3, 4], null);
      throw new Error(`unexpected cursor ${cursor}`);
    });

    const { result } = renderHook(() => useCursorPaginated({ fetchPage }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.isLoadingMore).toBe(false));

    expect(result.current.items).toEqual([1, 2, 3, 4]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-2');
  });

  it('stops once nextCursor is null: hasMore becomes false and loadMore is a no-op', async () => {
    const fetchPage = vi.fn(async () => page([1], null));

    const { result } = renderHook(() => useCursorPaginated({ fetchPage }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hasMore).toBe(false);

    act(() => result.current.loadMore());

    // No additional fetch should be triggered - loadMore bails out when hasMore is false.
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([1]);
  });

  it('resets to the first page and clears items when resetKey changes', async () => {
    let call = 0;
    const fetchPage = vi.fn(async () => {
      call += 1;
      return call === 1 ? page(['a'], null) : page(['b'], null);
    });

    const { result, rerender } = renderHook(({ key }) => useCursorPaginated({ fetchPage, resetKey: key }), {
      initialProps: { key: 'first' },
    });
    await waitFor(() => expect(result.current.items).toEqual(['a']));

    rerender({ key: 'second' });
    await waitFor(() => expect(result.current.items).toEqual(['b']));

    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('does not fetch while disabled', async () => {
    const fetchPage = vi.fn(async () => page([1], null));

    renderHook(() => useCursorPaginated({ fetchPage, enabled: false }));
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('surfaces a fetch error via the error field', async () => {
    const fetchPage = vi.fn(async () => {
      throw new Error('boom');
    });

    const { result } = renderHook(() => useCursorPaginated({ fetchPage }));

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.isLoading).toBe(false);
  });
});
