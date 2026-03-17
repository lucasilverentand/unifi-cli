import { useEffect, useRef } from "react";

/**
 * Simple setInterval wrapper that calls `callback` immediately and then
 * every `intervalMs` milliseconds. Cleans up on unmount or when `enabled`
 * flips to false.
 */
export function usePolling(
  callback: () => void,
  intervalMs: number,
  enabled = true,
): void {
  const savedCallback = useRef(callback);

  // Keep the ref current so the interval always calls the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // Call immediately
    savedCallback.current();

    const id = setInterval(() => {
      savedCallback.current();
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
