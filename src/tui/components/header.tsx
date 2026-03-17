import { Box, Text } from "ink";
import { VIEW_ORDER } from "../keys.ts";
import { colors } from "../theme.ts";
import type { ViewId } from "../types.ts";

export interface HeaderProps {
  activeView: ViewId;
  siteName: string;
  onSwitchSite: () => void;
}

const TAB_LABELS: Record<ViewId, string> = {
  dashboard: "Dashboard",
  devices: "Devices",
  network: "Network",
  clients: "Clients",
};

export function Header({ activeView, siteName }: HeaderProps) {
  return (
    <Box justifyContent="space-between" width="100%">
      <Box gap={1}>
        {VIEW_ORDER.map((view, i) => {
          const isActive = view === activeView;
          const label = TAB_LABELS[view];
          const number = i + 1;
          return (
            <Box key={view} marginRight={1}>
              <Text
                color={isActive ? colors.tabActive : colors.tabInactive}
                bold={isActive}
              >
                {number}:{label}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box>
        <Text dimColor>site:</Text>
        <Text color={colors.accent}>{siteName}</Text>
      </Box>
    </Box>
  );
}
