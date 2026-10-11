'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type LoadState<T> = {
  data: T | null;
  error: string | null;
  /** True while the first load, or a load for new deps, is in flight. */
  loading: boolean;
  /** True while a reload of the same deps is in flight (data stays on screen). */
  refreshing: boolean;
  reload: () => void;
};

function messageOf(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const res = (err as { response?: { status?: number; data?: { message?: unknown } } }).response;
    if (typeof res?.data?.message === 'string' && res.data.message) return res.data.message;
    if (res?.status) return `The API answered ${res.status}.`;
  }
  if (err instanceof Error && /network/i.test(err.message)) return 'The API is unreachable.';
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong.';
}

/**
 * Fetch on mount and whenever `key` changes. Stale responses are dropped,
 * errors are kept as a message, and `reload` re-runs without blanking the data.
 */
export function useLoad<T>(fetcher: () => Promise<T>, key: string = ''): LoadState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [settledTick, setSettledTick] = useState(-1);
  const fetcherRef = useRef(fetcher);

  // Declared before the load effect so it always sees the latest fetcher.
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    fetcherRef
      .current()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(messageOf(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoadedKey(key);
        setSettledTick(tick);
      });
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const loading = loadedKey !== key;

  return { data: loading ? null : data, error: loading ? null : error, loading, refreshing: !loading && settledTick !== tick, reload };
}
