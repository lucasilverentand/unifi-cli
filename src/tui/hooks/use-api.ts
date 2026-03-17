import { useState, useEffect, useCallback, useContext, createContext, useRef } from "react";
import type { CmdDef } from "../../commands.ts";
import type { ExecuteParams } from "../../execute.ts";
import { executeCommand, executeAllPages } from "../../execute.ts";
import type { AppContext, ApiResult } from "../types.ts";

// ---------------------------------------------------------------------------
// ConfigContext — provides AppContext (Config + UnifiClient) to the tree
// ---------------------------------------------------------------------------

export const ConfigContext = createContext<AppContext | null>(null);

export function useAppContext(): AppContext {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useAppContext must be used within a ConfigContext.Provider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// useApi — generic data fetching hook
// ---------------------------------------------------------------------------

export interface UseApiOptions {
  /** Skip fetching when false (default: true) */
  enabled?: boolean;
  /** Refetch interval in milliseconds */
  pollInterval?: number;
}

export function useApi<T>(
  cmd: CmdDef,
  params: ExecuteParams,
  options?: UseApiOptions,
): ApiResult<T> {
  const { enabled = true, pollInterval } = options ?? {};
  const { client } = useAppContext();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Cache the last successful result to prevent flicker during refetch
  const lastData = useRef<T | null>(null);

  // Stable serialization of params for dependency tracking
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const shouldPaginate =
        cmd.paginatable &&
        params.offset === undefined &&
        params.limit === undefined;

      const result = shouldPaginate
        ? await executeAllPages(cmd, params, client)
        : await executeCommand(cmd, params, client);

      const typed = result as T;
      lastData.current = typed;
      setData(typed);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      // Keep showing last successful data during error
      if (lastData.current) {
        setData(lastData.current);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmd, paramsKey, client]);

  // Initial fetch + refetch when deps change
  useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [enabled, fetchData]);

  // Polling
  useEffect(() => {
    if (!enabled || !pollInterval) return;

    const id = setInterval(fetchData, pollInterval);
    return () => clearInterval(id);
  }, [enabled, pollInterval, fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
