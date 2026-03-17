import { Box, Text } from "ink";
import { colors, symbols } from "../theme.ts";

export interface StatusBarProps {
  connected: boolean;
  lastRefresh: Date | null;
  extraHints?: string;
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function StatusBar({ connected, lastRefresh, extraHints }: StatusBarProps) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Box gap={1}>
        <Text color={connected ? colors.online : colors.offline}>
          {symbols.bullet}
        </Text>
        <Text dimColor>{connected ? "Connected" : "Disconnected"}</Text>
        {lastRefresh && (
          <Text dimColor>{symbols.dot} {formatRelativeTime(lastRefresh)}</Text>
        )}
      </Box>
      <Box gap={1}>
        {extraHints && <Text dimColor>{extraHints}</Text>}
        <Text dimColor>
          q:Quit r:Refresh s:Site ?:Help
        </Text>
      </Box>
    </Box>
  );
}
