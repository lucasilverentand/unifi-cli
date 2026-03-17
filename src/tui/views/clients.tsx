import { Box, Text, useInput } from "ink";
import { useState, useMemo } from "react";
import { COMMANDS } from "../../commands.ts";
import { useApi } from "../hooks/use-api.ts";
import { useSite } from "../hooks/use-site.tsx";
import { colors, symbols } from "../theme.ts";
import { DataTable, type Column } from "../components/data-table.tsx";
import { DetailPane } from "../components/detail-pane.tsx";
import { SpinnerView } from "../components/spinner.tsx";
import { ErrorBox } from "../components/error-box.tsx";
import { SearchInput } from "../components/search-input.tsx";
import type { Client } from "../types.ts";

// ---------------------------------------------------------------------------
// Command lookups
// ---------------------------------------------------------------------------

const clientsCmd = COMMANDS.find((c) => c.operationId === "getConnectedClientOverviewPage")!;
const clientDetailCmd = COMMANDS.find((c) => c.operationId === "getConnectedClientDetails")!;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "list" | "detail";

interface PageResponse<T> {
  data: T[];
  totalCount?: number;
}

interface ClientDetail extends Client {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "-";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / k ** i;

  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function signalColor(dbm?: number): string {
  if (dbm === undefined || dbm === null) return colors.muted;
  if (dbm > -50) return colors.signalGood;
  if (dbm > -65) return colors.signalGood;
  if (dbm > -75) return colors.signalFair;
  return colors.signalPoor;
}

export function signalBars(dbm?: number): string {
  if (dbm === undefined || dbm === null) return "-";

  // Map dBm to 0-4 bar index
  let bars: number;
  if (dbm > -50) bars = 4;
  else if (dbm > -60) bars = 3;
  else if (dbm > -70) bars = 2;
  else if (dbm > -80) bars = 1;
  else bars = 0;

  return symbols.signal.slice(0, bars + 1).join("");
}

function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const clientColumns: Column<Client>[] = [
  {
    key: "name",
    label: "Name",
    width: 22,
    render: (c) => c.name ?? c.hostname ?? "-",
  },
  { key: "ip", label: "IP", width: 18, render: (c) => c.ip ?? "-" },
  { key: "mac", label: "MAC", width: 20, render: (c) => c.mac ?? "-" },
  { key: "type", label: "Type", width: 10, render: (c) => c.type ?? "-" },
  { key: "ssid", label: "SSID", width: 16, render: (c) => c.ssid ?? "-" },
  {
    key: "signalStrength",
    label: "Signal",
    width: 10,
    render: (c) =>
      c.signalStrength !== undefined ? `${c.signalStrength}dBm` : "-",
  },
  {
    key: "rxBytes",
    label: "Rx",
    width: 10,
    render: (c) => formatBytes(c.rxBytes),
  },
  {
    key: "txBytes",
    label: "Tx",
    width: 10,
    render: (c) => formatBytes(c.txBytes),
  },
  {
    key: "uptime",
    label: "Uptime",
    width: 10,
    render: (c) => formatUptime(c.uptime),
  },
];

// ---------------------------------------------------------------------------
// Clients View
// ---------------------------------------------------------------------------

export function ClientsView(): React.ReactElement {
  const { resolvedSiteId } = useSite();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch clients with fast polling
  const clients = useApi<PageResponse<Client>>(
    clientsCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: !!resolvedSiteId, pollInterval: 5000 },
  );

  // Fetch client detail
  const detail = useApi<ClientDetail>(
    clientDetailCmd,
    { siteId: resolvedSiteId, args: { clientId: selectedClient?.id ?? "" } },
    { enabled: viewMode === "detail" && !!selectedClient?.id && !!resolvedSiteId },
  );

  const clientList = clients.data?.data ?? [];

  // Filter by search query
  const filteredClients = useMemo(() => {
    if (!searchQuery) return clientList;
    const q = searchQuery.toLowerCase();
    return clientList.filter((c) => {
      const name = (c.name ?? c.hostname ?? "").toLowerCase();
      const ip = (c.ip ?? "").toLowerCase();
      const mac = (c.mac ?? "").toLowerCase();
      return name.includes(q) || ip.includes(q) || mac.includes(q);
    });
  }, [clientList, searchQuery]);

  // Keyboard handler
  useInput(
    (input, key) => {
      if (searchActive) return; // SearchInput handles its own keys

      if (viewMode === "list") {
        if (key.downArrow || input === "j") {
          setSelectedIndex((prev) => Math.min(prev + 1, filteredClients.length - 1));
        } else if (key.upArrow || input === "k") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (key.return && filteredClients.length > 0) {
          const client = filteredClients[selectedIndex];
          if (client) {
            setSelectedClient(client);
            setViewMode("detail");
          }
        } else if (input === "/") {
          setSearchActive(true);
        }
      } else if (viewMode === "detail") {
        if (key.escape) {
          setViewMode("list");
          setSelectedClient(null);
        }
      }
    },
  );

  // --- Loading / Error states ---

  if (clients.loading && !clients.data) {
    return <SpinnerView label="Loading clients..." />;
  }

  if (clients.error && !clients.data) {
    return <ErrorBox error={clients.error} onRetry={clients.refetch} />;
  }

  // --- List mode ---

  if (viewMode === "list") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} gap={2}>
          <Text bold color={colors.primary}>
            Connected Clients ({filteredClients.length}
            {searchQuery ? ` / ${clientList.length}` : ""})
          </Text>
          {clients.loading && <Text dimColor>refreshing...</Text>}
        </Box>

        <SearchInput
          isActive={searchActive}
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setSelectedIndex(0);
          }}
          onSubmit={() => setSearchActive(false)}
          onCancel={() => {
            setSearchActive(false);
            setSearchQuery("");
            setSelectedIndex(0);
          }}
          placeholder="Filter by name, IP, or MAC..."
        />

        <DataTable<Client>
          columns={clientColumns}
          data={filteredClients}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onActivate={(client) => {
            setSelectedClient(client);
            setViewMode("detail");
          }}
        />

        {/* Signal strength indicator for selected client */}
        {filteredClients.length > 0 && filteredClients[selectedIndex] && (
          <Box marginTop={1} gap={2}>
            {filteredClients[selectedIndex].signalStrength !== undefined && (
              <Text>
                <Text dimColor>Signal: </Text>
                <Text color={signalColor(filteredClients[selectedIndex].signalStrength)}>
                  {signalBars(filteredClients[selectedIndex].signalStrength)}{" "}
                  {filteredClients[selectedIndex].signalStrength}dBm
                </Text>
              </Text>
            )}
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Enter:Detail /:Search j/k:Navigate</Text>
        </Box>
      </Box>
    );
  }

  // --- Detail mode ---

  if (viewMode === "detail" && selectedClient) {
    const c = detail.data ?? selectedClient;

    const entries = [
      { label: "Name", value: c.name ?? c.hostname },
      { label: "Hostname", value: c.hostname },
      { label: "ID", value: c.id },
      { label: "IP Address", value: c.ip },
      { label: "MAC Address", value: c.mac },
      { label: "Type", value: c.type },
      { label: "SSID", value: c.ssid },
      {
        label: "Signal Strength",
        value:
          c.signalStrength !== undefined
            ? `${signalBars(c.signalStrength)} ${c.signalStrength}dBm`
            : undefined,
      },
      { label: "Rx", value: formatBytes(c.rxBytes) },
      { label: "Tx", value: formatBytes(c.txBytes) },
      { label: "Uptime", value: formatUptime(c.uptime) },
    ];

    return (
      <Box flexDirection="column">
        {detail.loading && !detail.data ? (
          <SpinnerView label="Loading client details..." />
        ) : detail.error && !detail.data ? (
          <ErrorBox error={detail.error} onRetry={detail.refetch} />
        ) : (
          <DetailPane
            title={`Client: ${c.name ?? c.hostname ?? c.id}`}
            entries={entries}
            onBack={() => {
              setViewMode("list");
              setSelectedClient(null);
            }}
          />
        )}
      </Box>
    );
  }

  // Fallback
  return <SpinnerView label="Loading..." />;
}
