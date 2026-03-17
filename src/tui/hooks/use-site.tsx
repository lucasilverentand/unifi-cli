import { useState, useEffect, useCallback, useContext, createContext } from "react";
import type { ReactNode } from "react";
import { COMMANDS } from "../../commands.ts";
import { executeAllPages } from "../../execute.ts";
import type { Site } from "../types.ts";
import { useAppContext } from "./use-api.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SiteActions {
  currentSite: Site | null;
  sites: Site[];
  loading: boolean;
  switchSite: (siteId: string) => void;
  /** The resolved UUID for the current site (never "default") */
  resolvedSiteId: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SiteContext = createContext<SiteActions | null>(null);

// ---------------------------------------------------------------------------
// Find the sites list command from the registry
// ---------------------------------------------------------------------------

const sitesCmd = COMMANDS.find((c) => c.operationId === "getSiteOverviewPage")!;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SiteProvider({
  initialSite = "default",
  children,
}: {
  initialSite?: string;
  children: ReactNode;
}) {
  const { client } = useAppContext();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSite, setCurrentSite] = useState<Site | null>(null);
  const [resolvedSiteId, setResolvedSiteId] = useState(initialSite);

  // Fetch all sites on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchSites() {
      setLoading(true);
      try {
        const result = (await executeAllPages(sitesCmd, { args: {} }, client)) as {
          data: Site[];
        };
        if (cancelled) return;

        const siteList = Array.isArray(result.data) ? result.data : [];
        setSites(siteList);

        // Resolve initial site
        const resolved = resolveSite(siteList, initialSite);
        if (resolved) {
          setCurrentSite(resolved);
          setResolvedSiteId(resolved.id);
        } else if (siteList.length > 0) {
          // Fallback to first site
          setCurrentSite(siteList[0]);
          setResolvedSiteId(siteList[0].id);
        }
      } catch {
        // Sites fetch failed — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSites();
    return () => {
      cancelled = true;
    };
  }, [client, initialSite]);

  const switchSite = useCallback(
    (siteId: string) => {
      const site = sites.find((s) => s.id === siteId);
      if (site) {
        setCurrentSite(site);
        setResolvedSiteId(site.id);
      }
    },
    [sites],
  );

  return (
    <SiteContext.Provider
      value={{ currentSite, sites, loading, switchSite, resolvedSiteId }}
    >
      {children}
    </SiteContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSite(): SiteActions {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Resolve a site identifier (UUID or internalReference like "default") to a Site */
function resolveSite(sites: Site[], identifier: string): Site | undefined {
  // Try exact ID match first
  const byId = sites.find((s) => s.id === identifier);
  if (byId) return byId;

  // Try internalReference match (e.g. "default")
  return sites.find((s) => s.internalReference === identifier);
}
