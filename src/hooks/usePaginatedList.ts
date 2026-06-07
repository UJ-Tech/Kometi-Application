// src/hooks/usePaginatedList.ts
// Generic paginated list hook — handles loading, infinite scroll, refresh.

import { useState, useCallback, useRef } from "react";
import type { PaginationMeta } from "../types";
import { APP_CONFIG } from "../constants/config";

interface UsePaginatedListOptions<T> {
  fetcher: (page: number, limit: number) => Promise<{ data: T[]; meta: PaginationMeta }>;
  limit?:  number;
}

export function usePaginatedList<T>({ fetcher, limit = APP_CONFIG.PAGE_SIZE }: UsePaginatedListOptions<T>) {
  const [items,      setItems]      = useState<T[]>([]);
  const [isLoading,  setIsLoading]  = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [meta,       setMeta]       = useState<PaginationMeta>({
    total: 0, page: 1, limit, hasMore: false,
  });

  const currentPage = useRef(1);

  const load = useCallback(async (page: number, replace: boolean) => {
    try {
      const result = await fetcher(page, limit);
      setItems((prev) => replace ? result.data : [...prev, ...result.data]);
      setMeta(result.meta);
      currentPage.current = page;
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
    }
  }, [fetcher, limit]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(1, true);
    setIsRefreshing(false);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (isLoading || !meta.hasMore) return;
    setIsLoading(true);
    await load(currentPage.current + 1, false);
    setIsLoading(false);
  }, [isLoading, meta.hasMore, load]);

  const initialLoad = useCallback(async () => {
    setIsLoading(true);
    await load(1, true);
    setIsLoading(false);
  }, [load]);

  return { items, isLoading, isRefreshing, error, meta, refresh, loadMore, initialLoad };
}
