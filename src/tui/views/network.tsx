import { Box, Text, useInput } from "ink";
import { useState, useMemo } from "react";
import { COMMANDS } from "../../commands.ts";
import { useApi } from "../hooks/use-api.ts";
import { useSite } from "../hooks/use-site.tsx";
import { colors } from "../theme.ts";
import { DataTable, type Column } from "../components/data-table.tsx";
import { DetailPane } from "../components/detail-pane.tsx";
import { SpinnerView } from "../components/spinner.tsx";
import { ErrorBox } from "../components/error-box.tsx";
import { Tabs } from "../components/tabs.tsx";
import type { SubTab, Network } from "../types.ts";

// ---------------------------------------------------------------------------
// Command lookups
// ---------------------------------------------------------------------------

const networksCmd = COMMANDS.find((c) => c.operationId === "getNetworksOverviewPage")!;
const firewallZonesCmd = COMMANDS.find((c) => c.operationId === "getFirewallZones")!;
const firewallPoliciesCmd = COMMANDS.find((c) => c.operationId === "getFirewallPolicies")!;
const dnsCmd = COMMANDS.find((c) => c.operationId === "getDnsPolicyPage")!;
const wifiCmd = COMMANDS.find((c) => c.operationId === "getWifiBroadcastPage")!;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "list" | "detail";

interface PageResponse<T> {
  data: T[];
  totalCount?: number;
}

interface FirewallZone {
  id: string;
  name?: string;
  networkIds?: string[];
  networks?: { id: string; name?: string }[];
  [key: string]: unknown;
}

interface FirewallPolicy {
  id: string;
  name?: string;
  sourceFirewallZoneName?: string;
  sourceFirewallZoneId?: string;
  destinationFirewallZoneName?: string;
  destinationFirewallZoneId?: string;
  action?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

interface DnsPolicy {
  id: string;
  name?: string;
  action?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

interface WifiBroadcast {
  id: string;
  name?: string;
  ssid?: string;
  security?: string;
  networkId?: string;
  networkName?: string;
  enabled?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Sub-tab definitions
// ---------------------------------------------------------------------------

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: "networks", label: "Networks" },
  { id: "firewall-zones", label: "FW Zones" },
  { id: "firewall-policies", label: "FW Policies" },
  { id: "dns", label: "DNS" },
  { id: "wifi", label: "WiFi" },
];

const SUB_TAB_ORDER: SubTab[] = SUB_TABS.map((t) => t.id);

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------

const networkColumns: Column<Network>[] = [
  { key: "name", label: "Name", width: 22, render: (n) => n.name ?? "-" },
  { key: "vlanId", label: "VLAN ID", width: 10, render: (n) => n.vlanId !== undefined ? String(n.vlanId) : "-" },
  { key: "subnet", label: "Subnet", width: 20, render: (n) => n.subnet ?? "-" },
  { key: "dhcpEnabled", label: "DHCP", width: 8, render: (n) => n.dhcpEnabled !== undefined ? (n.dhcpEnabled ? "Yes" : "No") : "-" },
  { key: "purpose", label: "Purpose", width: 16, render: (n) => n.purpose ?? "-" },
];

const zoneColumns: Column<FirewallZone>[] = [
  { key: "name", label: "Name", width: 24, render: (z) => z.name ?? "-" },
  {
    key: "networkIds",
    label: "Networks",
    width: 12,
    render: (z) => {
      const count = z.networkIds?.length ?? z.networks?.length ?? 0;
      return String(count);
    },
  },
];

const policyColumns: Column<FirewallPolicy>[] = [
  { key: "name", label: "Name", width: 22, render: (p) => p.name ?? "-" },
  { key: "sourceFirewallZoneName", label: "Source Zone", width: 16, render: (p) => p.sourceFirewallZoneName ?? "-" },
  { key: "destinationFirewallZoneName", label: "Dest Zone", width: 16, render: (p) => p.destinationFirewallZoneName ?? "-" },
  { key: "action", label: "Action", width: 12, render: (p) => p.action ?? "-" },
  { key: "enabled", label: "Enabled", width: 10, render: (p) => p.enabled !== undefined ? (p.enabled ? "Yes" : "No") : "-" },
];

const dnsColumns: Column<DnsPolicy>[] = [
  { key: "name", label: "Name", width: 28, render: (d) => d.name ?? "-" },
  { key: "action", label: "Action", width: 16, render: (d) => d.action ?? "-" },
  { key: "enabled", label: "Enabled", width: 10, render: (d) => d.enabled !== undefined ? (d.enabled ? "Yes" : "No") : "-" },
];

const wifiColumns: Column<WifiBroadcast>[] = [
  { key: "name", label: "Name", width: 20, render: (w) => w.name ?? "-" },
  { key: "ssid", label: "SSID", width: 20, render: (w) => w.ssid ?? "-" },
  { key: "security", label: "Security", width: 14, render: (w) => w.security ?? "-" },
  { key: "networkName", label: "Network", width: 16, render: (w) => w.networkName ?? "-" },
  { key: "enabled", label: "Enabled", width: 10, render: (w) => w.enabled !== undefined ? (w.enabled ? "Yes" : "No") : "-" },
];

// ---------------------------------------------------------------------------
// Network View
// ---------------------------------------------------------------------------

export function NetworkView(): React.ReactElement {
  const { resolvedSiteId } = useSite();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("networks");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIndices, setSelectedIndices] = useState<Record<SubTab, number>>({
    networks: 0,
    "firewall-zones": 0,
    "firewall-policies": 0,
    dns: 0,
    wifi: 0,
  });
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);

  // Fetch data per sub-tab (only when that tab is active)
  const networks = useApi<PageResponse<Network>>(
    networksCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: activeSubTab === "networks" && !!resolvedSiteId },
  );

  const zones = useApi<PageResponse<FirewallZone>>(
    firewallZonesCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: activeSubTab === "firewall-zones" && !!resolvedSiteId },
  );

  const policies = useApi<PageResponse<FirewallPolicy>>(
    firewallPoliciesCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: activeSubTab === "firewall-policies" && !!resolvedSiteId },
  );

  const dns = useApi<PageResponse<DnsPolicy>>(
    dnsCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: activeSubTab === "dns" && !!resolvedSiteId },
  );

  const wifi = useApi<PageResponse<WifiBroadcast>>(
    wifiCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: activeSubTab === "wifi" && !!resolvedSiteId },
  );

  // Get current tab's data, columns, loading, error
  const tabState = useMemo(() => {
    switch (activeSubTab) {
      case "networks":
        return {
          data: networks.data?.data ?? [],
          loading: networks.loading && !networks.data,
          error: networks.error && !networks.data ? networks.error : null,
          refetch: networks.refetch,
          columns: networkColumns,
        };
      case "firewall-zones":
        return {
          data: zones.data?.data ?? [],
          loading: zones.loading && !zones.data,
          error: zones.error && !zones.data ? zones.error : null,
          refetch: zones.refetch,
          columns: zoneColumns,
        };
      case "firewall-policies":
        return {
          data: policies.data?.data ?? [],
          loading: policies.loading && !policies.data,
          error: policies.error && !policies.data ? policies.error : null,
          refetch: policies.refetch,
          columns: policyColumns,
        };
      case "dns":
        return {
          data: dns.data?.data ?? [],
          loading: dns.loading && !dns.data,
          error: dns.error && !dns.data ? dns.error : null,
          refetch: dns.refetch,
          columns: dnsColumns,
        };
      case "wifi":
        return {
          data: wifi.data?.data ?? [],
          loading: wifi.loading && !wifi.data,
          error: wifi.error && !wifi.data ? wifi.error : null,
          refetch: wifi.refetch,
          columns: wifiColumns,
        };
    }
  }, [activeSubTab, networks, zones, policies, dns, wifi]);

  const currentIndex = selectedIndices[activeSubTab];

  // Switch sub-tab and reset selection
  function switchTab(tab: SubTab) {
    setActiveSubTab(tab);
    setViewMode("list");
    setSelectedItem(null);
  }

  function cycleTab() {
    const idx = SUB_TAB_ORDER.indexOf(activeSubTab);
    const next = SUB_TAB_ORDER[(idx + 1) % SUB_TAB_ORDER.length];
    switchTab(next);
  }

  // Keyboard handler
  useInput(
    (input, key) => {
      if (viewMode === "list") {
        if (key.tab) {
          cycleTab();
        } else if (key.downArrow || input === "j") {
          setSelectedIndices((prev) => ({
            ...prev,
            [activeSubTab]: Math.min(prev[activeSubTab] + 1, tabState.data.length - 1),
          }));
        } else if (key.upArrow || input === "k") {
          setSelectedIndices((prev) => ({
            ...prev,
            [activeSubTab]: Math.max(prev[activeSubTab] - 1, 0),
          }));
        } else if (key.return && tabState.data.length > 0) {
          const item = tabState.data[currentIndex];
          if (item) {
            setSelectedItem(item as Record<string, unknown>);
            setViewMode("detail");
          }
        }
      } else if (viewMode === "detail") {
        if (key.escape) {
          setViewMode("list");
          setSelectedItem(null);
        }
      }
    },
  );

  // --- Detail mode ---

  if (viewMode === "detail" && selectedItem) {
    const entries = buildDetailEntries(activeSubTab, selectedItem);
    const title = detailTitle(activeSubTab, selectedItem);

    return (
      <Box flexDirection="column">
        <Tabs tabs={SUB_TABS} activeTab={activeSubTab} onSwitch={switchTab} />
        <Box marginTop={1}>
          <DetailPane
            title={title}
            entries={entries}
            onBack={() => {
              setViewMode("list");
              setSelectedItem(null);
            }}
          />
        </Box>
      </Box>
    );
  }

  // --- List mode ---

  return (
    <Box flexDirection="column">
      <Tabs tabs={SUB_TABS} activeTab={activeSubTab} onSwitch={switchTab} />

      <Box marginTop={1} flexDirection="column">
        {tabState.loading ? (
          <SpinnerView label={`Loading ${activeSubTab}...`} />
        ) : tabState.error ? (
          <ErrorBox error={tabState.error} onRetry={tabState.refetch} />
        ) : (
          <>
            <Box marginBottom={1}>
              <Text bold color={colors.primary}>
                {SUB_TABS.find((t) => t.id === activeSubTab)?.label} ({tabState.data.length})
              </Text>
            </Box>

            <DataTable
              columns={tabState.columns as Column<Record<string, unknown>>[]}
              data={tabState.data as Record<string, unknown>[]}
              selectedIndex={currentIndex}
              onSelect={(idx) =>
                setSelectedIndices((prev) => ({ ...prev, [activeSubTab]: idx }))
              }
              onActivate={(item) => {
                setSelectedItem(item as Record<string, unknown>);
                setViewMode("detail");
              }}
            />
          </>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Tab:Switch sub-tab Enter:Detail j/k:Navigate</Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail entry builders
// ---------------------------------------------------------------------------

function detailTitle(tab: SubTab, item: Record<string, unknown>): string {
  const name = (item.name as string) ?? (item.id as string) ?? "Unknown";
  switch (tab) {
    case "networks":
      return `Network: ${name}`;
    case "firewall-zones":
      return `Firewall Zone: ${name}`;
    case "firewall-policies":
      return `Firewall Policy: ${name}`;
    case "dns":
      return `DNS Policy: ${name}`;
    case "wifi":
      return `WiFi Broadcast: ${name}`;
  }
}

function buildDetailEntries(
  tab: SubTab,
  item: Record<string, unknown>,
): { label: string; value: string | number | boolean | undefined }[] {
  switch (tab) {
    case "networks":
      return buildNetworkEntries(item);
    case "firewall-zones":
      return buildZoneEntries(item);
    case "firewall-policies":
      return buildPolicyEntries(item);
    case "dns":
      return buildDnsEntries(item);
    case "wifi":
      return buildWifiEntries(item);
  }
}

function buildNetworkEntries(item: Record<string, unknown>) {
  return [
    { label: "Name", value: item.name as string | undefined },
    { label: "ID", value: item.id as string | undefined },
    { label: "VLAN ID", value: item.vlanId as number | undefined },
    { label: "Subnet", value: item.subnet as string | undefined },
    { label: "DHCP Enabled", value: item.dhcpEnabled as boolean | undefined },
    { label: "Purpose", value: item.purpose as string | undefined },
    { label: "Domain Name", value: item.domainName as string | undefined },
    { label: "DHCP Range Start", value: item.dhcpRangeStart as string | undefined },
    { label: "DHCP Range Stop", value: item.dhcpRangeStop as string | undefined },
    { label: "IPv6 Enabled", value: item.ipv6Enabled as boolean | undefined },
  ];
}

function buildZoneEntries(item: Record<string, unknown>) {
  const networks = item.networkIds as string[] | undefined;
  const namedNetworks = item.networks as { id: string; name?: string }[] | undefined;
  const networkDisplay = namedNetworks
    ? namedNetworks.map((n) => n.name ?? n.id).join(", ")
    : networks
      ? networks.join(", ")
      : undefined;

  return [
    { label: "Name", value: item.name as string | undefined },
    { label: "ID", value: item.id as string | undefined },
    { label: "Networks", value: networkDisplay },
    { label: "Network Count", value: networks?.length ?? namedNetworks?.length },
  ];
}

function buildPolicyEntries(item: Record<string, unknown>) {
  return [
    { label: "Name", value: item.name as string | undefined },
    { label: "ID", value: item.id as string | undefined },
    { label: "Source Zone", value: item.sourceFirewallZoneName as string | undefined },
    { label: "Source Zone ID", value: item.sourceFirewallZoneId as string | undefined },
    { label: "Dest Zone", value: item.destinationFirewallZoneName as string | undefined },
    { label: "Dest Zone ID", value: item.destinationFirewallZoneId as string | undefined },
    { label: "Action", value: item.action as string | undefined },
    { label: "Enabled", value: item.enabled as boolean | undefined },
    { label: "Logging", value: item.logging as boolean | undefined },
    { label: "Description", value: item.description as string | undefined },
  ];
}

function buildDnsEntries(item: Record<string, unknown>) {
  return [
    { label: "Name", value: item.name as string | undefined },
    { label: "ID", value: item.id as string | undefined },
    { label: "Action", value: item.action as string | undefined },
    { label: "Enabled", value: item.enabled as boolean | undefined },
    { label: "Description", value: item.description as string | undefined },
  ];
}

function buildWifiEntries(item: Record<string, unknown>) {
  return [
    { label: "Name", value: item.name as string | undefined },
    { label: "ID", value: item.id as string | undefined },
    { label: "SSID", value: item.ssid as string | undefined },
    { label: "Security", value: item.security as string | undefined },
    { label: "Network", value: item.networkName as string | undefined },
    { label: "Network ID", value: item.networkId as string | undefined },
    { label: "Enabled", value: item.enabled as boolean | undefined },
    { label: "Hidden", value: item.hidden as boolean | undefined },
    { label: "Band", value: item.band as string | undefined },
    { label: "WPA Mode", value: item.wpaMode as string | undefined },
  ];
}
