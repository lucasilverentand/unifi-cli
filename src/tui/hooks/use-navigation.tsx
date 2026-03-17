import { useState, useCallback, useContext, createContext } from "react";
import type { ReactNode } from "react";
import type { ViewId } from "../types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavigationActions {
  activeView: ViewId;
  navigate: (view: ViewId) => void;
  goBack: () => void;
  history: ViewId[];
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const NavigationContext = createContext<NavigationActions | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function NavigationProvider({
  initialView = "dashboard",
  children,
}: {
  initialView?: ViewId;
  children: ReactNode;
}) {
  const [history, setHistory] = useState<ViewId[]>([initialView]);

  const activeView = history[history.length - 1];

  const navigate = useCallback((view: ViewId) => {
    setHistory((prev) => [...prev, view]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) return prev;
      return prev.slice(0, -1);
    });
  }, []);

  return (
    <NavigationContext.Provider value={{ activeView, navigate, goBack, history }}>
      {children}
    </NavigationContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNavigation(): NavigationActions {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}
