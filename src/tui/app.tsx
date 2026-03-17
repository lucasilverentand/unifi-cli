import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { Config } from "../config.ts";
import type { UnifiClient } from "../client.ts";
import type { AppContext, ViewId } from "./types.ts";
import { colors } from "./theme.ts";
import { NAV_KEYS, nextView, GLOBAL_KEYS, LIST_KEYS } from "./keys.ts";
import { ConfigContext } from "./hooks/use-api.ts";
import { NavigationProvider, useNavigation } from "./hooks/use-navigation.tsx";
import { SiteProvider, useSite } from "./hooks/use-site.tsx";
import { Header } from "./components/header.tsx";
import { StatusBar } from "./components/status-bar.tsx";
import { SpinnerView } from "./components/spinner.tsx";
import { ErrorBox } from "./components/error-box.tsx";
import { DashboardView } from "./views/dashboard.tsx";
import { DevicesView } from "./views/devices.tsx";
import { NetworkView } from "./views/network.tsx";
import { ClientsView } from "./views/clients.tsx";

interface AppProps {
  config: Config & { url: string; apiKey: string };
  client: UnifiClient;
}

export function App({ config, client }: AppProps): React.ReactElement {
  const ctx = useMemo<AppContext>(() => ({ config, client }), [config, client]);

  return (
    <ConfigContext.Provider value={ctx}>
      <NavigationProvider>
        <SiteProvider>
          <AppShell />
        </SiteProvider>
      </NavigationProvider>
    </ConfigContext.Provider>
  );
}

function AppShell(): React.ReactElement {
  const { exit } = useApp();
  const { activeView, navigate } = useNavigation();
  const { currentSite, loading: siteLoading, sites } = useSite();
  const [showHelp, setShowHelp] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showSiteSwitcher, setShowSiteSwitcher] = useState(false);

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date());
  }, []);

  useInput((input, key) => {
    if (showHelp) {
      setShowHelp(false);
      return;
    }

    if (showSiteSwitcher) {
      if (key.escape) setShowSiteSwitcher(false);
      return;
    }

    // Global keys
    if (input === "q") {
      exit();
      return;
    }
    if (input === "?") {
      setShowHelp(true);
      return;
    }
    if (input === "r") {
      handleRefresh();
      return;
    }
    if (input === "s") {
      setShowSiteSwitcher(true);
      return;
    }
    if (key.tab) {
      navigate(nextView(activeView));
      return;
    }

    // View navigation
    const navTarget = NAV_KEYS[input];
    if (navTarget) {
      navigate(navTarget);
    }
  });

  if (siteLoading) {
    return <SpinnerView label="Connecting to UniFi controller..." />;
  }

  if (!currentSite) {
    return (
      <ErrorBox
        error={new Error("No sites found. Is the UniFi controller accessible?")}
      />
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Header
        activeView={activeView}
        siteName={currentSite.name ?? currentSite.internalReference ?? currentSite.id}
        onSwitchSite={() => setShowSiteSwitcher(true)}
      />

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        <ActiveView view={activeView} />
      </Box>

      <StatusBar
        connected={true}
        lastRefresh={lastRefresh}
      />

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      {showSiteSwitcher && (
        <SiteSwitcher
          onClose={() => setShowSiteSwitcher(false)}
        />
      )}
    </Box>
  );
}

function ActiveView({ view }: { view: ViewId }): React.ReactElement {
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "devices":
      return <DevicesView />;
    case "network":
      return <NetworkView />;
    case "clients":
      return <ClientsView />;
  }
}

function HelpOverlay({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.primary}
      padding={1}
      position="absolute"
      marginLeft={4}
      marginTop={2}
    >
      <Text bold color={colors.primary}>Keyboard Shortcuts</Text>
      <Text> </Text>
      <Text bold color={colors.accent}>Navigation</Text>
      {GLOBAL_KEYS.map((k) => (
        <Text key={k.key}>
          <Text color={colors.primary} bold>{` ${k.key.padEnd(6)}`}</Text>
          <Text>{` ${k.label}`}</Text>
        </Text>
      ))}
      <Text> </Text>
      <Text bold color={colors.accent}>Lists</Text>
      {LIST_KEYS.map((k) => (
        <Text key={k.key}>
          <Text color={colors.primary} bold>{` ${k.key.padEnd(6)}`}</Text>
          <Text>{` ${k.label}`}</Text>
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>Press any key to close</Text>
    </Box>
  );
}

function SiteSwitcher({ onClose }: { onClose: () => void }): React.ReactElement {
  const { sites, switchSite } = useSite();
  const [selectedIdx, setSelectedIdx] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.return) {
      const site = sites[selectedIdx];
      if (site) {
        switchSite(site.id);
        onClose();
      }
      return;
    }
    if (input === "j" || key.downArrow) {
      setSelectedIdx((i) => Math.min(i + 1, sites.length - 1));
    }
    if (input === "k" || key.upArrow) {
      setSelectedIdx((i) => Math.max(i - 1, 0));
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.accent}
      padding={1}
      position="absolute"
      marginLeft={4}
      marginTop={2}
    >
      <Text bold color={colors.accent}>Switch Site</Text>
      <Text> </Text>
      {sites.map((site, i) => (
        <Text key={site.id} inverse={i === selectedIdx}>
          {` ${site.name ?? site.internalReference ?? site.id} `}
        </Text>
      ))}
      <Text> </Text>
      <Text dimColor>Enter: Select  Esc: Cancel</Text>
    </Box>
  );
}
