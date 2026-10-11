import { useCallback, useEffect, useRef, useState } from "react";

/** A cancellable snapshot. Identity changes discard previous data and late responses. */
export function useApiResource<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  pollMs = 0,
) {
  const loader = useRef(load);
  loader.current = load;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    key: string | null;
    data?: T;
    error?: Error;
    loading: boolean;
  }>({ key, loading: key !== null });
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (key === null) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const run = async () => {
      setState((old) => ({
        key,
        data: old.key === key ? old.data : undefined,
        loading: true,
      }));
      try {
        const data = await loader.current(controller.signal);
        if (!disposed) setState({ key, data, loading: false });
      } catch (error) {
        if (!disposed)
          setState((old) => ({
            key,
            data: old.key === key ? old.data : undefined,
            error: error instanceof Error ? error : new Error("Request failed"),
            loading: false,
          }));
      }
      if (!disposed && pollMs > 0) timer = setTimeout(run, pollMs);
    };
    void run();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [key, revision, pollMs]);
  if (key === null)
    return { data: undefined, error: undefined, loading: false, refresh };
  return state.key === key
    ? { ...state, refresh }
    : { data: undefined, error: undefined, loading: true, refresh };
}
