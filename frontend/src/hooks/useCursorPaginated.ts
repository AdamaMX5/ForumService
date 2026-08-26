import { useCallback, useEffect, useRef, useState } from 'react';
import type { Paginated } from '../api/types';

interface UseCursorPaginatedOptions<T> {
  /** Called with the current cursor (null for the first page). Must be stable/memoized by the caller. */
  fetchPage: (cursor: string | null) => Promise<Paginated<T>>;
  /** Bump this to force a full reset + refetch from the first page (e.g. sort mode changed). */
  resetKey?: unknown;
  /** If false, no fetch is performed (e.g. a collapsed tree branch not yet expanded). */
  enabled?: boolean;
}

interface UseCursorPaginatedResult<T> {
  items: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/**
 * Generic cursor-based "load more" pagination, matching the { data, nextCursor } shape shared
 * by GET /themen, GET /nodes/:id/kinder and GET /nodes/:id/kommentare.
 */
export function useCursorPaginated<T>({
  fetchPage,
  resetKey,
  enabled = true,
}: UseCursorPaginatedOptions<T>): UseCursorPaginatedResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a stale in-flight request overwriting fresher state after a reset.
  const requestIdRef = useRef(0);

  const fetchFirstPage = useCallback(() => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    fetchPage(null)
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setItems(page.data);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fetchPage]);

  useEffect(() => {
    fetchFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resetKey, fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (!enabled || isLoadingMore || !hasMore || cursor === null) return;
    const requestId = ++requestIdRef.current;
    setIsLoadingMore(true);
    setError(null);
    fetchPage(cursor)
      .then((page) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => [...prev, ...page.data]);
        setCursor(page.nextCursor);
        setHasMore(page.nextCursor !== null);
      })
      .catch((err) => {
        if (requestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen');
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoadingMore(false);
      });
  }, [enabled, isLoadingMore, hasMore, cursor, fetchPage]);

  return { items, isLoading, isLoadingMore, error, hasMore, loadMore, reload: fetchFirstPage };
}
