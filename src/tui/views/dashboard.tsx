import { Box, Text } from "ink";
import { useMemo } from "react";
import { COMMANDS } from "../../commands.ts";
import { useApi } from "../hooks/use-api.ts";
import { useSite } from "../hooks/use-site.tsx";
import { colors, symbols } from "../theme.ts";
import { SpinnerView } from "../components/spinner.tsx";
import { ErrorBox } from "../components/error-box.tsx";
import type { Device } from "../types.ts";

// ---------------------------------------------------------------------------
// Command lookups
// ---------------------------------------------------------------------------

const infoCmd = COMMANDS.find((c) => c.operationId === "getInfo")!;
const devicesCmd = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceOverviewPage")!;
const clientsCmd = COMMANDS.find((c) => c.operationId === "getConnectedClientOverviewPage")!;
const networksCmd = COMMANDS.find((c) => c.operationId === "getNetworksOverviewPage")!;

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

interface InfoResponse {
  name?: string;
  version?: string;
  [key: string]: unknown;
}

interface PageResponse<T> {
  data: T[];
  totalCount?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Dashboard View
// ---------------------------------------------------------------------------

export function DashboardView(): React.ReactElement {
  const { currentSite, resolvedSiteId } = useSite();

  const pollOptions = { pollInterval: 30000 };

  const info = useApi<InfoResponse>(infoCmd, { args: {} }, pollOptions);

  const devices = useApi<PageResponse<Device>>(
    devicesCmd,
    { siteId: resolvedSiteId, args: {} },
    { ...pollOptions, enabled: !!resolvedSiteId },
  );

  const clients = useApi<PageResponse<Record<string, unknown>>>(
    clientsCmd,
    { siteId: resolvedSiteId, args: {} },
    { ...pollOptions, enabled: !!resolvedSiteId },
  );

  const networks = useApi<PageResponse<Record<string, unknown>>>(
    networksCmd,
    { siteId: resolvedSiteId, args: {} },
    { ...pollOptions, enabled: !!resolvedSiteId },
  );

  // Derive device stats
  const deviceSummary = useMemo(() => {
    const list = devices.data?.data ?? [];
    const total = list.length;
    const online = list.filter((d) => d.status === "online").length;
    const offline = list.filter((d) => d.status === "offline").length;
    const pending = list.filter((d) => d.status === "pending" || d.status === "adopting").length;

    // Group by type
    const byType: Record<string, number> = {};
    for (const d of list) {
      const t = d.type ?? "unknown";
      byType[t] = (byType[t] ?? 0) + 1;
    }

    // Aggregate CPU/memory averages
    const withCpu = list.filter((d) => d.cpuUtilizationPercent !== undefined);
    const withMem = list.filter((d) => d.memoryUtilizationPercent !== undefined);
    const avgCpu =
      withCpu.length > 0
        ? withCpu.reduce((sum, d) => sum + (d.cpuUtilizationPercent ?? 0), 0) / withCpu.length
        : null;
    const avgMem =
      withMem.length > 0
        ? withMem.reduce((sum, d) => sum + (d.memoryUtilizationPercent ?? 0), 0) / withMem.length
        : null;

    return { total, online, offline, pending, byType, avgCpu, avgMem };
  }, [devices.data]);

  const clientCount = (clients.data?.data ?? []).length;
  const networkCount = (networks.data?.data ?? []).length;

  // Show loading state on first load
  const isInitialLoading =
    (info.loading && !info.data) ||
    (devices.loading && !devices.data) ||
    (clients.loading && !clients.data) ||
    (networks.loading && !networks.data);

  // Show error if any critical fetch failed with no data
  const firstError = info.error ?? devices.error ?? clients.error ?? networks.error;
  const hasNoData = !info.data && !devices.data && !clients.data && !networks.data;

  if (isInitialLoading) {
    return <SpinnerView label="Loading dashboard..." />;
  }

  if (firstError && hasNoData) {
    const retryAll = () => {
      info.refetch();
      devices.refetch();
      clients.refetch();
      networks.refetch();
    };
    return <ErrorBox error={firstError} onRetry={retryAll} />;
  }

  return (
    <Box flexDirection="column" gap={1}>
      {/* Site Info */}
      <Box borderStyle="round" borderColor={colors.border} flexDirection="column" paddingX={1}>
        <Box marginBottom={0}>
          <Text bold color={colors.primary}>
            Site Info
          </Text>
        </Box>
        <Box gap={2}>
          <Box gap={1}>
            <Text dimColor>Site:</Text>
            <Text color={colors.text}>{currentSite?.name ?? "Unknown"}</Text>
          </Box>
          <Box gap={1}>
            <Text dimColor>Controller:</Text>
            <Text color={colors.text}>{info.data?.version ?? "-"}</Text>
          </Box>
          {info.data?.name && (
            <Box gap={1}>
              <Text dimColor>Name:</Text>
              <Text color={colors.text}>{info.data.name}</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box gap={1}>
        {/* Device Summary */}
        <Box
          borderStyle="round"
          borderColor={colors.border}
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
        >
          <Box marginBottom={0}>
            <Text bold color={colors.primary}>
              Devices
            </Text>
          </Box>
          <Box gap={2}>
            <Text color={colors.text}>Total: {deviceSummary.total}</Text>
            <Text color={colors.online}>
              {symbols.bullet} Online: {deviceSummary.online}
            </Text>
            <Text color={colors.offline}>
              {symbols.bullet} Offline: {deviceSummary.offline}
            </Text>
            {deviceSummary.pending > 0 && (
              <Text color={colors.pending}>
                {symbols.bullet} Pending: {deviceSummary.pending}
              </Text>
            )}
          </Box>
          {Object.keys(deviceSummary.byType).length > 0 && (
            <Box gap={2} marginTop={0}>
              {Object.entries(deviceSummary.byType).map(([type, count]) => (
                <Box key={type} gap={1}>
                  <Text dimColor>{type}:</Text>
                  <Text color={colors.text}>{count}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Client Count */}
        <Box
          borderStyle="round"
          borderColor={colors.border}
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
        >
          <Box marginBottom={0}>
            <Text bold color={colors.primary}>
              Clients
            </Text>
          </Box>
          <Text color={colors.text}>Connected: {clientCount}</Text>
        </Box>

        {/* Network Count */}
        <Box
          borderStyle="round"
          borderColor={colors.border}
          flexDirection="column"
          paddingX={1}
          flexGrow={1}
        >
          <Box marginBottom={0}>
            <Text bold color={colors.primary}>
              Networks
            </Text>
          </Box>
          <Text color={colors.text}>Total: {networkCount}</Text>
        </Box>
      </Box>

      {/* Quick Stats */}
      {(deviceSummary.avgCpu !== null || deviceSummary.avgMem !== null) && (
        <Box borderStyle="round" borderColor={colors.border} flexDirection="column" paddingX={1}>
          <Box marginBottom={0}>
            <Text bold color={colors.primary}>
              Quick Stats
            </Text>
          </Box>
          <Box gap={3}>
            {deviceSummary.avgCpu !== null && (
              <Box gap={1}>
                <Text dimColor>Avg CPU:</Text>
                <Text color={utilizationColor(deviceSummary.avgCpu)}>
                  {deviceSummary.avgCpu.toFixed(1)}%
                </Text>
              </Box>
            )}
            {deviceSummary.avgMem !== null && (
              <Box gap={1}>
                <Text dimColor>Avg Memory:</Text>
                <Text color={utilizationColor(deviceSummary.avgMem)}>
                  {deviceSummary.avgMem.toFixed(1)}%
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box>
        <Text dimColor>
          Auto-refreshes every 30s {symbols.dot} r:Refresh
        </Text>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function utilizationColor(percent: number): string {
  if (percent > 80) return colors.error;
  if (percent > 60) return colors.warning;
  return colors.success;
}
