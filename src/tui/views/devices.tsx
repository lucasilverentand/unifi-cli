import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import { useState, useCallback } from "react";
import { COMMANDS } from "../../commands.ts";
import { executeCommand } from "../../execute.ts";
import { useApi, useAppContext } from "../hooks/use-api.ts";
import { useSite } from "../hooks/use-site.tsx";
import { useConfirm } from "../hooks/use-confirm.ts";
import { colors } from "../theme.ts";
import { DataTable, type Column } from "../components/data-table.tsx";
import { DetailPane } from "../components/detail-pane.tsx";
import { SpinnerView } from "../components/spinner.tsx";
import { ErrorBox } from "../components/error-box.tsx";
import { Badge, type BadgeProps } from "../components/badge.tsx";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import type { Device } from "../types.ts";

// ---------------------------------------------------------------------------
// Command lookups
// ---------------------------------------------------------------------------

const devicesCmd = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceOverviewPage")!;
const deviceDetailCmd = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceDetails")!;
const deviceStatsCmd = COMMANDS.find((c) => c.operationId === "getAdoptedDeviceLatestStatistics")!;
const pendingCmd = COMMANDS.find((c) => c.operationId === "getPendingDevicePage")!;
const deviceActionCmd = COMMANDS.find((c) => c.operationId === "executeAdoptedDeviceAction")!;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = "list" | "detail" | "actions";

interface PageResponse<T> {
  data: T[];
  totalCount?: number;
}

interface DeviceDetail extends Device {
  [key: string]: unknown;
}

interface DeviceStats {
  cpuUtilizationPercent?: number;
  memoryUtilizationPercent?: number;
  uptimeSeconds?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

export function formatUptime(seconds?: number): string {
  if (seconds === undefined || seconds === null) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function utilizationColor(percent?: number): string {
  if (percent === undefined) return colors.muted;
  if (percent > 80) return colors.error;
  if (percent > 60) return colors.warning;
  return colors.success;
}

function formatUtilization(percent?: number): string {
  if (percent === undefined || percent === null) return "-";
  return `${percent.toFixed(0)}%`;
}

function deviceStatus(status?: string): BadgeProps["status"] {
  switch (status) {
    case "online":
      return "online";
    case "offline":
      return "offline";
    case "pending":
    case "adopting":
      return "pending";
    case "upgrading":
      return "upgrading";
    default:
      return "offline";
  }
}

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const deviceColumns: Column<Device>[] = [
  { key: "name", label: "Name", width: 22, render: (d) => d.name ?? d.mac ?? "-" },
  { key: "model", label: "Model", width: 16, render: (d) => d.model ?? "-" },
  { key: "status", label: "Status", width: 12, render: (d) => d.status ?? "-" },
  { key: "ip", label: "IP", width: 18, render: (d) => d.ip ?? "-" },
  { key: "uptime", label: "Uptime", width: 12, render: (d) => formatUptime(d.uptime) },
  {
    key: "cpuUtilizationPercent",
    label: "CPU%",
    width: 8,
    render: (d) => formatUtilization(d.cpuUtilizationPercent),
  },
  {
    key: "memoryUtilizationPercent",
    label: "Mem%",
    width: 8,
    render: (d) => formatUtilization(d.memoryUtilizationPercent),
  },
];

// ---------------------------------------------------------------------------
// Devices View
// ---------------------------------------------------------------------------

export function DevicesView(): React.ReactElement {
  const { resolvedSiteId } = useSite();
  const { client } = useAppContext();
  const { confirmState, requestConfirm } = useConfirm();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Fetch adopted devices
  const devices = useApi<PageResponse<Device>>(
    devicesCmd,
    { siteId: resolvedSiteId, args: {} },
    { enabled: !!resolvedSiteId, pollInterval: 15000 },
  );

  // Fetch pending devices
  const pending = useApi<PageResponse<Device>>(pendingCmd, { args: {} });

  // Fetch device detail (only when viewing detail)
  const detail = useApi<DeviceDetail>(
    deviceDetailCmd,
    { siteId: resolvedSiteId, args: { deviceId: selectedDevice?.id ?? "" } },
    { enabled: viewMode !== "list" && !!selectedDevice?.id && !!resolvedSiteId },
  );

  // Fetch live stats (only when viewing detail)
  const stats = useApi<DeviceStats>(
    deviceStatsCmd,
    { siteId: resolvedSiteId, args: { deviceId: selectedDevice?.id ?? "" } },
    {
      enabled: viewMode !== "list" && !!selectedDevice?.id && !!resolvedSiteId,
      pollInterval: 10000,
    },
  );

  const deviceList = devices.data?.data ?? [];
  const pendingList = pending.data?.data ?? [];

  // Keyboard handler
  useInput(
    (input, key) => {
      if (confirmState.isOpen) return;

      if (viewMode === "list") {
        if (key.downArrow || input === "j") {
          setSelectedIndex((prev) => Math.min(prev + 1, deviceList.length - 1));
        } else if (key.upArrow || input === "k") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (key.return && deviceList.length > 0) {
          const device = deviceList[selectedIndex];
          if (device) {
            setSelectedDevice(device);
            setViewMode("detail");
          }
        } else if (input === "a" && deviceList.length > 0) {
          const device = deviceList[selectedIndex];
          if (device) {
            setSelectedDevice(device);
            setViewMode("actions");
          }
        }
      } else if (viewMode === "detail") {
        if (key.escape) {
          setViewMode("list");
          setSelectedDevice(null);
          setActionMessage(null);
        } else if (input === "a" && selectedDevice) {
          setViewMode("actions");
        }
      } else if (viewMode === "actions") {
        if (key.escape) {
          setViewMode("detail");
        }
      }
    },
  );

  // Action handler
  const handleAction = useCallback(
    async (action: string) => {
      if (!selectedDevice || !resolvedSiteId) return;

      if (action === "back") {
        setViewMode("detail");
        return;
      }

      if (action === "restart") {
        const confirmed = await requestConfirm(
          `Restart device "${selectedDevice.name ?? selectedDevice.id}"?`,
        );
        if (!confirmed) return;
      }

      try {
        await executeCommand(
          deviceActionCmd,
          {
            siteId: resolvedSiteId,
            args: { deviceId: selectedDevice.id },
            body: { action },
          },
          client,
        );
        setActionMessage(`Action "${action}" executed successfully`);
        setViewMode("detail");
        devices.refetch();
      } catch (err) {
        setActionMessage(
          `Action failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        setViewMode("detail");
      }
    },
    [selectedDevice, resolvedSiteId, client, requestConfirm, devices],
  );

  // --- Loading / Error states ---

  if (devices.loading && !devices.data) {
    return <SpinnerView label="Loading devices..." />;
  }

  if (devices.error && !devices.data) {
    return <ErrorBox error={devices.error} onRetry={devices.refetch} />;
  }

  // --- List mode ---

  if (viewMode === "list") {
    return (
      <Box flexDirection="column">
        <Box marginBottom={1} gap={2}>
          <Text bold color={colors.primary}>
            Adopted Devices ({deviceList.length})
          </Text>
          {pendingList.length > 0 && (
            <Text color={colors.pending}>
              Pending: {pendingList.length}
            </Text>
          )}
        </Box>

        <DataTable<Device>
          columns={deviceColumns}
          data={deviceList}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
          onActivate={(device) => {
            setSelectedDevice(device);
            setViewMode("detail");
          }}
        />

        {/* Status column color coding (inline with the row) */}
        {deviceList.length > 0 && deviceList[selectedIndex] && (
          <Box marginTop={1} gap={2}>
            <Badge status={deviceStatus(deviceList[selectedIndex].status)} />
            <Text dimColor>
              CPU:{" "}
              <Text color={utilizationColor(deviceList[selectedIndex].cpuUtilizationPercent)}>
                {formatUtilization(deviceList[selectedIndex].cpuUtilizationPercent)}
              </Text>
            </Text>
            <Text dimColor>
              Mem:{" "}
              <Text color={utilizationColor(deviceList[selectedIndex].memoryUtilizationPercent)}>
                {formatUtilization(deviceList[selectedIndex].memoryUtilizationPercent)}
              </Text>
            </Text>
          </Box>
        )}

        <Box marginTop={1}>
          <Text dimColor>Enter:Detail a:Actions j/k:Navigate</Text>
        </Box>
      </Box>
    );
  }

  // --- Detail mode ---

  if (viewMode === "detail" && selectedDevice) {
    const d = detail.data ?? selectedDevice;
    const s = stats.data;

    const entries = [
      { label: "Name", value: d.name },
      { label: "ID", value: d.id },
      { label: "Model", value: d.model },
      { label: "Status", value: d.status },
      { label: "IP Address", value: d.ip },
      { label: "MAC Address", value: d.mac },
      { label: "Firmware", value: d.firmwareVersion },
      { label: "Type", value: d.type },
      { label: "Uptime", value: formatUptime(d.uptime ?? s?.uptimeSeconds) },
      {
        label: "CPU",
        value: formatUtilization(s?.cpuUtilizationPercent ?? d.cpuUtilizationPercent),
      },
      {
        label: "Memory",
        value: formatUtilization(s?.memoryUtilizationPercent ?? d.memoryUtilizationPercent),
      },
    ];

    return (
      <Box flexDirection="column">
        {(detail.loading && !detail.data) ? (
          <SpinnerView label="Loading device details..." />
        ) : detail.error && !detail.data ? (
          <ErrorBox error={detail.error} onRetry={detail.refetch} />
        ) : (
          <DetailPane
            title={`Device: ${d.name ?? d.id}`}
            entries={entries}
            onBack={() => {
              setViewMode("list");
              setSelectedDevice(null);
              setActionMessage(null);
            }}
          />
        )}

        {actionMessage && (
          <Box paddingX={1}>
            <Text color={actionMessage.startsWith("Action failed") ? colors.error : colors.success}>
              {actionMessage}
            </Text>
          </Box>
        )}

        {stats.loading && (
          <Box paddingX={1}>
            <Text dimColor>Refreshing stats...</Text>
          </Box>
        )}

        <Box paddingX={1}>
          <Text dimColor>Esc:Back a:Actions</Text>
        </Box>

        <ConfirmDialog
          message={confirmState.message}
          isOpen={confirmState.isOpen}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      </Box>
    );
  }

  // --- Actions mode ---

  if (viewMode === "actions" && selectedDevice) {
    const actionItems = [
      { label: "Restart", value: "restart" },
      { label: "Locate", value: "locate" },
      { label: "Back", value: "back" },
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color={colors.primary}>
            Actions: {selectedDevice.name ?? selectedDevice.id}
          </Text>
        </Box>

        <SelectInput
          items={actionItems}
          onSelect={(item) => {
            handleAction(item.value);
          }}
        />

        <Box marginTop={1}>
          <Text dimColor>Esc:Back</Text>
        </Box>

        <ConfirmDialog
          message={confirmState.message}
          isOpen={confirmState.isOpen}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      </Box>
    );
  }

  // Fallback
  return <SpinnerView label="Loading..." />;
}
